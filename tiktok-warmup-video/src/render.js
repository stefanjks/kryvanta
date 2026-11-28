// Драйвер рендера: node render.js <cues|preview|frames|cover> [...]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const SRC = __dirname;
const BUILD = path.join(SRC, '..', 'build');
const TL = JSON.parse(fs.readFileSync(path.join(BUILD, 'timeline.json'), 'utf8'));
const FPS = 30;
const mode = process.argv[2] || 'frames';

async function openPage(browser, file = 'scene.html') {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.addInitScript(tl => { window.TL = tl; }, TL);
  await page.goto('file://' + path.join(SRC, file));
  await page.evaluate(() => document.fonts.ready);
  return page;
}

async function warm(page) {
  const starts = await page.evaluate(() => window.SCENES.map(s => s.start + 0.6));
  for (const t of starts) await page.evaluate(t => window.render(t), t);
}

(async () => {
  const browser = await chromium.launch({ args: ['--font-render-hinting=none', '--disable-lcd-text'] });
  if (mode === 'cues') {
    const page = await openPage(browser);
    const cues = await page.evaluate(() => window.getCues());
    fs.writeFileSync(path.join(BUILD, 'cues.json'), JSON.stringify(cues, null, 1));
    fs.writeFileSync(path.join(BUILD, 'subtitles.srt'), await page.evaluate(() => window.getSRT()));
    console.log('cues', cues.length, 'scenes', JSON.stringify(await page.evaluate(() => window.SCENES.map(s => s.from + '@' + s.start.toFixed(2)))));
  } else if (mode === 'preview') {
    const page = await openPage(browser); await warm(page);
    const times = process.argv.slice(3).map(Number);
    fs.mkdirSync(path.join(BUILD, 'preview'), { recursive: true });
    for (const t of times) {
      await page.evaluate(t => window.render(t), t);
      await page.screenshot({ path: path.join(BUILD, 'preview', `t_${t.toFixed(2)}.png`) });
    }
    console.log('preview', times.length);
  } else if (mode === 'cover') {
    const page = await openPage(browser, 'cover.html');
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(BUILD, 'cover.png') });
    console.log('cover ok');
  } else {
    const N = Number(process.argv[3] || 4);
    const total = Math.ceil(TL.duration * FPS);
    const per = Math.ceil(total / N);
    const t0 = Date.now();
    await Promise.all([...Array(N).keys()].map(async w => {
      const a = w * per, b = Math.min(total, a + per);
      const page = await openPage(browser); await warm(page);
      const out = path.join(BUILD, `seg_${w}.mp4`);
      const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-pix_fmt', 'yuv420p', '-r', String(FPS), out], { stdio: ['pipe', 'inherit', 'inherit'] });
      for (let f = a; f < b; f++) {
        await page.evaluate(t => window.render(t), f / FPS);
        const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
        if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
        if (w === 0 && f % 60 === 0) console.log(`w0 frame ${f - a}/${b - a}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
      }
      ff.stdin.end();
      await new Promise(r => ff.on('close', r));
    }));
    fs.writeFileSync(path.join(BUILD, 'segs.txt'), [...Array(N).keys()].map(w => `file 'seg_${w}.mp4'`).join('\n'));
    console.log('frames done', total, ((Date.now() - t0) / 1000).toFixed(0) + 's');
  }
  await browser.close();
})();
