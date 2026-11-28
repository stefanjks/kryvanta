# -*- coding: utf-8 -*-
"""Оригинальный саундтрек (синтез): грустное фортепиано -> мотивирующая середина -> энергичный финал.
Плюс эмбиент, звуковые эффекты, обработка голоса, дакинг и мастеринг (-14 LUFS).
Вход: build/voice.wav, build/timeline.json, build/shots.json. Выход: build/mix.wav
"""
import json, os, subprocess, wave
import numpy as np
from scipy import signal

HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(HERE, "..", "build")
SR = 48000
BPM = 84
BEAT = 60 / BPM
BAR = 4 * BEAT
rng = np.random.default_rng(11)


def mtof(m): return 440.0 * 2 ** ((m - 69) / 12)
def lp(x, fc, o=2): b, a = signal.butter(o, min(fc / (SR / 2), .99), "low"); return signal.lfilter(b, a, x)
def hp(x, fc, o=2): b, a = signal.butter(o, fc / (SR / 2), "high"); return signal.lfilter(b, a, x)
def bp(x, lo, hi, o=2): b, a = signal.butter(o, [lo / (SR / 2), hi / (SR / 2)], "band"); return signal.lfilter(b, a, x)
def saw(f, n, ph=0.0): t = np.arange(n) / SR; return 2 * ((f * t + ph) % 1.0) - 1


def place(buf, x, at, g=1.0):
    i = int(at * SR)
    if i < 0:
        x = x[-i:]; i = 0
    if i >= len(buf): return
    j = min(len(buf), i + len(x)); buf[i:j] += x[:j - i] * g


def piano(m, dur=2.6, vel=1.0):
    n = int(dur * SR); t = np.arange(n) / SR; f = mtof(m); x = np.zeros(n)
    for k in range(1, 9):
        fk = f * k * (1 + .0004 * k * k)
        x += np.sin(2 * np.pi * fk * t + rng.random()) * (1 / k ** 1.4) * np.exp(-t * (1.1 + .55 * k))
    x += hp(rng.standard_normal(n), 2000) * np.exp(-t * 90) * .05
    att = np.minimum(1, t / .004)
    return x * att * vel * .5


def pad(chord, dur, bright=1200, amp=1.0):
    n = int(dur * SR); x = np.zeros(n)
    for m in chord:
        for d in (-.12, .0, .12):
            x += saw(mtof(m) * (1 + d / 100 * 2), n, rng.random())
    x = lp(x, bright)
    t = np.arange(n) / SR
    env = np.minimum(1, t / .9) * np.minimum(1, (dur - t) / .9).clip(0, 1)
    return x * env * amp * .05


def kick(g=1.0):
    n = int(.45 * SR); t = np.arange(n) / SR; f = 45 + 100 * np.exp(-t * 28)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 6.5) * g


def clap():
    n = int(.3 * SR); t = np.arange(n) / SR
    return bp(rng.standard_normal(n), 900, 6000) * np.exp(-t * 18) * .5


def hat(o=False):
    n = int((.2 if o else .05) * SR); t = np.arange(n) / SR
    return hp(rng.standard_normal(n), 8000) * np.exp(-t * (14 if o else 75)) * .2


def bass(m, dur):
    n = int(dur * SR); t = np.arange(n) / SR; f = mtof(m)
    x = np.sin(2 * np.pi * f * t) * .8 + lp(saw(f, n), 500) * .35
    return x * np.minimum(1, t / .01) * np.exp(-t * 1.2) * .5


def bell(m, dur=1.2):
    n = int(dur * SR); t = np.arange(n) / SR; f = mtof(m)
    x = np.sin(2 * np.pi * f * t) + .35 * np.sin(2 * np.pi * 2.76 * f * t) * np.exp(-t * 4) + .2 * np.sin(2 * np.pi * 4 * f * t) * np.exp(-t * 6)
    return x * np.exp(-t * 2.6) * .22


def reverb(x, sec=2.4, wet=.3, seed=1):
    r = np.random.default_rng(seed); n = int(sec * SR); t = np.arange(n) / SR
    ir = r.standard_normal(n) * np.exp(-t * 6.9 / sec); ir = lp(ir, 6000); ir[:int(.02 * SR)] *= np.linspace(0, 1, int(.02 * SR))
    y = signal.fftconvolve(x, ir)[:len(x)]; y /= (np.abs(y).max() + 1e-9)
    return x * (1 - wet) + y * wet * np.abs(x).max()


def make_music(tl, dur):
    P = {p["id"]: p for p in tl["phrases"]}
    t_s3, t_s4, t_s5 = P["c1"]["start"], P["d1"]["start"], P["e1"]["start"]
    t_vend = tl["phrases"][-1]["end"]
    origin = t_s4 - 9 * BAR  # сетка тактов: удар на логотипе = начало такта
    while origin > 0: origin -= BAR
    n = int(dur * SR)
    L = {k: np.zeros(n) for k in ["piano", "pad", "drums", "bass", "bell", "str"]}
    sad = [(57, [57, 60, 64]), (53, [53, 57, 60]), (48, [52, 55, 60]), (55, [55, 59, 62])]       # Am F C G
    up = [(48, [48, 52, 55]), (55, [55, 59, 62]), (57, [57, 60, 64]), (53, [53, 57, 60])]        # C G Am F
    nb = int((dur - origin) / BAR) + 1
    for b in range(nb):
        t0 = origin + b * BAR
        if t0 + BAR < 0 or t0 > dur: continue
        stage = 0 if t0 < t_s3 - .1 else 1 if t0 < t_s4 - .1 else 2
        root, ch = (sad if stage < 2 else up)[b % 4]
        # фортепиано: арпеджио (грусть — медленно, дальше — восьмые)
        notes = ch + [ch[0] + 12, ch[1] + 12]
        if stage == 0:
            pat = [0, 2, 4, 2]; step = BEAT
        else:
            pat = [0, 2, 4, 3, 1, 4, 2, 3]; step = BEAT / 2
        for i, k in enumerate(pat):
            place(L["piano"], piano(notes[k] + 12, 2.4, .75 if i else 1.0), t0 + i * step)
        place(L["piano"], piano(root - 12, 3.2, .8), t0)
        if stage == 0 and b % 2 == 1:  # простая мелодия
            place(L["piano"], piano(ch[2] + 24, 2.2, .55), t0 + 2.5 * BEAT)
        L["pad"][:0]
        place(L["pad"], pad([m + 12 for m in ch], BAR + 1.0, 900 if stage == 0 else 1600 if stage == 1 else 2600, 1.0 if stage else .8), t0)
        if stage >= 1:  # сердцебиение / пульс
            for bt in range(4):
                if stage == 1 and bt % 2: continue
                place(L["drums"], kick(.55 if stage == 1 else .95), t0 + bt * BEAT)
            place(L["str"], pad([m + 24 for m in ch], BAR + .6, 3000, .45), t0)
        if stage == 2:
            for bt in (1, 3): place(L["drums"], clap(), t0 + bt * BEAT, .8)
            for e in range(8): place(L["drums"], hat(e == 7), t0 + e * BEAT / 2, .8 if e % 2 else .45)
            for e in range(4): place(L["bass"], bass(root - 12, BEAT * .95), t0 + e * BEAT)
            mel = [ch[2] + 12, ch[1] + 12, ch[2] + 12, ch[0] + 24][b % 4]
            for i, mm in enumerate([mel, mel - 3 if b % 2 else mel + 2, mel]):
                place(L["bell"], bell(mm + 12), t0 + [0, 1.5, 2.5][i] * BEAT)
    # переходы: свип и тарелка перед логотипом
    sw_n = int(BAR * 2 * SR); t = np.arange(sw_n) / SR
    sweep = hp(rng.standard_normal(sw_n), 1200) * (t / t[-1]) ** 2.5 * .35
    place(L["drums"], sweep, t_s4 - BAR * 2)
    crash_n = int(2.5 * SR); tc = np.arange(crash_n) / SR
    place(L["drums"], hp(rng.standard_normal(crash_n), 4000) * np.exp(-tc * 1.6) * .35, t_s4)
    place(L["drums"], kick(1.4), t_s4)
    # финальный аккорд после голоса
    place(L["pad"], pad([60, 64, 67, 72], dur - t_vend + .5, 2600, 1.4), t_vend - .3)
    place(L["piano"], piano(48, 4, 1) + piano(60, 4, .8) + piano(64, 4, .7) + piano(67, 4, .7), t_vend + .1)

    pianoW = reverb(L["piano"], 2.8, .42, 1)
    padW = reverb(L["pad"] + L["str"], 3.2, .35, 2)
    bellW = reverb(L["bell"], 2.0, .3, 3)
    # сайдчейн от бочки
    env = np.ones(n)
    kd = lp(np.abs(L["drums"]), 8); env -= .35 * np.clip(kd / (kd.max() + 1e-9) * 3, 0, 1)
    tt = np.arange(n) / SR
    lvl = np.interp(tt, [0, t_s3, t_s4 - .5, t_s4, dur], [.75, .85, .95, 1.0, 1.0])
    mus = (pianoW * .9 + padW * env * .9 + L["drums"] * .55 + L["bass"] * env * .6 + bellW * .8) * lvl
    mus = hp(mus, 30)
    fo = int(2.2 * SR); mus[-fo:] *= np.linspace(1, 0, fo) ** 1.4
    fi = int(.8 * SR); mus[:fi] *= np.linspace(0, 1, fi)
    return np.tanh(mus / (np.abs(mus).max() + 1e-9) * 1.3) / np.tanh(1.3)


def ambience(tl, dur):
    P = {p["id"]: p for p in tl["phrases"]}; n = int(dur * SR); tt = np.arange(n) / SR
    wind = lp(rng.standard_normal(n), 500) * (.6 + .4 * np.sin(tt * .7))
    wind *= np.interp(tt, [0, P["c1"]["start"], P["c2"]["start"], dur], [1, 1, .25, .15]) * .25
    birds = np.zeros(n); r = np.random.default_rng(4); t = P["c1"]["start"] + 1
    while t < dur - 2:
        for k in range(r.integers(2, 5)):
            m = int(.09 * SR); x = np.arange(m) / SR; f0 = 3000 + r.random() * 2500
            f = f0 + 900 * np.sin(np.pi * x / x[-1]) * (1 if r.random() > .5 else -1)
            place(birds, np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * x / x[-1]) ** 2 * .08, t + k * .13)
        t += 1.2 + r.random() * 2.2
    return wind + reverb(birds, 1.2, .3, 5)


def sfx(tl, shots, dur):
    P = {p["id"]: p for p in tl["phrases"]}; n = int(dur * SR); fx = np.zeros(n)
    def whoosh(ln=.5):
        m = int(ln * SR); x = np.arange(m) / SR; nz = rng.standard_normal(m); out = np.zeros(m)
        for i in range(0, m, 512):
            fc = 300 + 3500 * (i / m); out[i:i + 512] = bp(nz[max(0, i - 2048):i + 512], fc * .6, min(fc * 1.7, 18000))[-len(nz[i:i + 512]):]
        return out * np.sin(np.pi * x / ln) ** 2 * .35
    for s in shots:
        if s["start"] > P["c4"]["start"]: place(fx, whoosh(), s["start"] - .25, .8)
    boom_n = int(2.4 * SR); t = np.arange(boom_n) / SR
    place(fx, np.sin(2 * np.pi * np.cumsum(38 + 50 * np.exp(-t * 6)) / SR) * np.exp(-t * 1.8) * .9, P["d1"]["start"])
    def thock(): m = int(.08 * SR); x = np.arange(m) / SR; return (lp(rng.standard_normal(m), 900) * .6 + np.sin(2 * np.pi * 160 * x)) * np.exp(-x * 60) * .25
    def tick(): m = int(.06 * SR); x = np.arange(m) / SR; return bp(rng.standard_normal(m), 1500, 5000) * np.exp(-x * 80) * .3
    sh = {s["from"]: s for s in shots}
    for name, fn, step in [("b1", thock, .22), ("d2", thock, .28), ("d4", tick, .3)]:
        s = sh[name]; t0 = s["start"] + .3
        while t0 < s["end"] - .2: place(fx, fn(), t0 + rng.random() * .05, .7); t0 += step
    return fx


def read(p):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)


def write(p, x, ch=1):
    with wave.open(p, "wb") as wf:
        wf.setnchannels(ch); wf.setsampwidth(2); wf.setframerate(SR); wf.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())


def main():
    tl = json.load(open(os.path.join(BUILD, "timeline.json"))); shots = json.load(open(os.path.join(BUILD, "shots.json")))
    dur = tl["duration"]; n = int(dur * SR)
    v = read(os.path.join(BUILD, "voice.wav"))[:n]; v = np.pad(v, (0, n - len(v)))
    v = hp(v, 80); v = v + .15 * bp(v, 2500, 6000) - .1 * bp(v, 250, 450)
    env = np.sqrt(lp(v ** 2, 12).clip(1e-9)); v = v * lp(np.minimum(1, (.12 / np.maximum(env, 1e-4)) ** .35), 30)
    v = v / np.abs(v).max() * .9
    v = reverb(v, .6, .08, 9)  # лёгкая «комната», чтобы голос не звучал сухо
    music = make_music(tl, dur); write(os.path.join(BUILD, "music.wav"), music)
    venv = lp(np.abs(v), 6); duck = lp(1 - .5 * np.clip(venv / (np.percentile(venv, 90) + 1e-9), 0, 1), 4)
    tt = np.arange(n) / SR; P = {p["id"]: p for p in tl["phrases"]}
    mlev = np.interp(tt, [0, P["c1"]["start"], P["d1"]["start"], tl["phrases"][-1]["end"], tl["phrases"][-1]["end"] + .8, dur],
                     [.33, .33, .32, .32, .55, .55])
    amb = ambience(tl, dur); fx = sfx(tl, shots, dur)
    mono = v + music * mlev * duck + amb * .5 + fx * .5
    # стерео: эмбиент/музыка чуть шире
    side = lp(hp(music, 200) * mlev * duck * .25 + amb * .2, 9000)
    L, R = mono + side, mono - side
    st = np.stack([L, R], 1).reshape(-1); tmp = os.path.join(BUILD, "mix_raw.wav")
    write(tmp, st / np.abs(st).max() * .95, 2)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", tmp, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-ar", "48000", os.path.join(BUILD, "mix.wav")], check=True)
    db = lambda x: 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)
    sp = np.abs(v) > .03
    print("mix ok", dur, "| voice dB", round(db(v[sp]), 1), "| music bed dB (s1/s4)",
          round(db((music * mlev)[: int(P["c1"]["start"] * SR)]), 1), round(db((music * mlev)[int(P["d1"]["start"] * SR):int(P["e1"]["start"] * SR)]), 1))


if __name__ == "__main__":
    main()
