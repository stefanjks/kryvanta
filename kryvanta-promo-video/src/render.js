// node src/render.js <srt|preview t...|frames N|cover>
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http');
const { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..'), BUILD = path.join(ROOT, 'build');
const TL = JSON.parse(fs.readFileSync(path.join(BUILD, 'timeline.json'), 'utf8'));
const FPS = 30, mode = process.argv[2] || 'frames';
const MIME = { '.js': 'text/javascript', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.css': 'text/css' };
const srv = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); });
async function open(browser, file = 'src/world.html', scale = 1) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('PAGEERR', e.message)); page.on('console', m => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });
  await page.addInitScript(([tl, s, aa, sh, nv]) => { window.TL = tl; window.RENDER_SCALE = s; window.AA = aa; window.SHADOW = sh; window.NOOV = !!nv; }, [TL, scale, process.env.AA === '1', Number(process.env.SHADOW || 2048), process.env.NOOV === '1']);
  await page.goto(`http://127.0.0.1:${srv.address().port}/${file}`);
  if (file.includes('world')) await page.waitForFunction(() => window.ready, null, { timeout: 120000 });
  await page.evaluate(() => document.fonts.ready); return page;
}
(async () => {
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const scale = Number(process.env.RS || 1);
  if (mode === 'srt') {
    const page = await open(browser);
    fs.writeFileSync(path.join(BUILD, 'subtitles.srt'), await page.evaluate(() => window.getSRT()));
    fs.writeFileSync(path.join(BUILD, 'shots.json'), JSON.stringify(await page.evaluate(() => window.SHOTS)));
    console.log(JSON.stringify(await page.evaluate(() => window.SHOTS.map(s => s.from + '@' + s.start.toFixed(2)))));
  } else if (mode === 'preview') {
    const page = await open(browser, 'src/world.html', scale); fs.mkdirSync(path.join(BUILD, 'preview'), { recursive: true });
    for (const t of process.argv.slice(3).map(Number)) { const t0 = Date.now(); await page.evaluate(t => window.render(t), t);
      await page.screenshot({ path: path.join(BUILD, 'preview', `t_${t.toFixed(2)}.png`) }); console.log('t', t, Date.now() - t0, 'ms'); }
  } else if (mode === 'cover') {
    const page = await open(browser, 'src/cover.html'); await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(BUILD, 'cover.png') }); console.log('cover ok');
  } else {
    const NW = Number(process.argv[3] || 4); const total = Math.ceil(TL.duration * FPS); const per = Math.ceil(total / NW); const t0 = Date.now();
    await Promise.all([...Array(NW).keys()].map(async w => {
      const a = w * per, b = Math.min(total, a + per); const page = await open(browser, 'src/world.html', scale);
      const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-pix_fmt', 'yuv420p', path.join(BUILD, `seg_${w}.mp4`)], { stdio: ['pipe', 'inherit', 'inherit'] });
      for (let f = a; f < b; f++) { await page.evaluate(t => window.render(t), f / FPS);
        const buf = await page.screenshot({ type: 'jpeg', quality: 94 });
        if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
        if (w === 0 && (f - a) % 30 === 0) console.log(`w0 ${f - a}/${b - a} ${((Date.now() - t0) / 1000).toFixed(0)}s`); }
      ff.stdin.end(); await new Promise(r => ff.on('close', r)); await page.close(); }));
    fs.writeFileSync(path.join(BUILD, 'segs.txt'), [...Array(NW).keys()].map(w => `file 'seg_${w}.mp4'`).join('\n'));
    console.log('frames done', total, ((Date.now() - t0) / 1000).toFixed(0) + 's');
  }
  await browser.close(); srv.close();
})();
