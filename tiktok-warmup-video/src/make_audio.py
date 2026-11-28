# -*- coding: utf-8 -*-
"""Оригинальная фоновая музыка (синтез), звуковые эффекты и финальное сведение.

Вход:  build/voice.wav, build/timeline.json, build/cues.json (из рендерера)
Выход: build/music.wav, build/mix.wav
"""
import json, os, subprocess, wave
import numpy as np
from scipy import signal

HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(HERE, "..", "build")
SR = 48000
BPM = 118
BEAT = 60 / BPM
rng = np.random.default_rng(7)


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def env_adsr(n, a, d, s, r, sr=SR):
    a, d, r = int(a * sr), int(d * sr), int(r * sr)
    sus = max(n - a - d - r, 0)
    e = np.concatenate([np.linspace(0, 1, a, endpoint=False), np.linspace(1, s, d, endpoint=False),
                        np.full(sus, s), np.linspace(s, 0, r)])
    return e[:n] if len(e) >= n else np.pad(e, (0, n - len(e)))


def lp(x, fc, order=2):
    b, a = signal.butter(order, min(fc / (SR / 2), 0.99), "low")
    return signal.lfilter(b, a, x)


def hp(x, fc, order=2):
    b, a = signal.butter(order, fc / (SR / 2), "high")
    return signal.lfilter(b, a, x)


def bp(x, lo, hi, order=2):
    b, a = signal.butter(order, [lo / (SR / 2), hi / (SR / 2)], "band")
    return signal.lfilter(b, a, x)


def saw(f, n, phase=0.0):
    t = np.arange(n) / SR
    return 2 * ((f * t + phase) % 1.0) - 1


# ---------------------------------------------------------------- music
def kick():
    n = int(0.42 * SR); t = np.arange(n) / SR
    f = 48 + 110 * np.exp(-t * 32)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 7.5) * 1.0 + 0.25 * np.exp(-t * 300) * rng.standard_normal(n) * 0.3


def clap():
    n = int(0.25 * SR); t = np.arange(n) / SR
    nz = bp(rng.standard_normal(n), 900, 5000)
    e = np.exp(-t * 22) * (1 + 0.6 * (np.sin(2 * np.pi * 90 * t) > 0) * (t < 0.03))
    return nz * e * 0.55


def hat(open_=False):
    n = int((0.18 if open_ else 0.05) * SR); t = np.arange(n) / SR
    return hp(rng.standard_normal(n), 7500) * np.exp(-t * (18 if open_ else 80)) * 0.22


def place(buf, x, at, gain=1.0):
    i = int(at * SR)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(x))
    buf[i:j] += x[:j - i] * gain


def make_music(duration):
    n = int(duration * SR)
    drums, bass, pad, pluck = (np.zeros(n) for _ in range(4))
    pump = np.ones(n)
    # Am – F – C – G (по 1 такту), тоника A
    prog = [(57, [57, 60, 64]), (53, [53, 57, 60]), (48, [55, 60, 64]), (55, [55, 59, 62])]
    bars = int(duration / (4 * BEAT)) + 2
    K, C, H, HO = kick(), clap(), hat(), hat(True)
    pk = np.exp(-np.arange(int(0.32 * SR)) / SR * 9)
    for bar in range(bars):
        t0 = bar * 4 * BEAT
        root, chord = prog[bar % 4]
        intro = bar < 1
        for b in range(4):
            tb = t0 + b * BEAT
            if not intro or b >= 2:
                place(drums, K, tb, 0.9)
                # pump (сайдчейн от бочки)
                i = int(tb * SR); j = min(n, i + len(pk))
                if i < n:
                    pump[i:j] = np.minimum(pump[i:j], 1 - 0.55 * pk[:j - i])
            if b in (1, 3) and not intro:
                place(drums, C, tb, 0.8)
            for s in range(2):
                place(drums, HO if (s == 1 and b == 3) else H, tb + s * BEAT / 2, 0.9 if s else 0.55)
            if bar % 2 == 1 and b == 3:
                for s in range(4):
                    place(drums, H, tb + s * BEAT / 4, 0.4)
        # бас: восьмые, октавный рисунок
        for e8 in range(8):
            if intro and e8 < 4:
                continue
            m = root - 12 + (12 if e8 in (3, 7) else 0)
            ln = int(BEAT / 2 * SR * 0.9)
            f = mtof(m)
            x = 0.6 * np.sin(2 * np.pi * f * np.arange(ln) / SR) + 0.35 * lp(saw(f, ln), 600)
            place(bass, x * env_adsr(ln, 0.005, 0.08, 0.7, 0.05), t0 + e8 * BEAT / 2, 0.55)
        # пэд: аккорд на весь такт
        ln = int(4 * BEAT * SR)
        x = np.zeros(ln)
        for m in chord:
            for det in (-0.07, 0.07):
                x += saw(mtof(m + 12) * (1 + det / 100 * 3), ln, rng.random())
        x = lp(x, 1800) * env_adsr(ln, 0.25, 0.4, 0.8, 0.4)
        place(pad, x, t0, 0.07)
        # арпеджио-плак шестнадцатыми через одну
        arp = chord + [chord[0] + 12, chord[1] + 12]
        for s in range(8):
            if intro and s < 4:
                continue
            m = arp[[0, 2, 1, 3, 2, 4, 3, 1][s]] + 12
            ln = int(0.22 * SR); tt = np.arange(ln) / SR
            f = mtof(m)
            x = (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(2 * np.pi * 2 * f * tt)) * np.exp(-tt * 14)
            place(pluck, x, t0 + s * BEAT / 2, 0.16)
    # дилэй на плак
    d = int(BEAT * 0.75 * SR)
    pl = pluck.copy()
    for k in range(1, 4):
        pl[d * k:] += pluck[:-d * k] * (0.35 ** k)
    music = drums * 0.9 + (bass + pad) * pump + pl * (0.6 + 0.4 * pump)
    music = hp(music, 30)
    # финальное затухание
    fo = int(2.5 * SR)
    music[-fo:] *= np.linspace(1, 0, fo) ** 1.5
    music = np.tanh(music * 1.2) / np.tanh(1.2)
    return music / np.abs(music).max() * 0.9


# ---------------------------------------------------------------- sfx
def sfx_whoosh(ln=0.38):
    n = int(ln * SR); t = np.arange(n) / SR
    nz = rng.standard_normal(n)
    out = np.zeros(n)
    seg = 256
    for i in range(0, n, seg):  # бегущий полосовой фильтр
        fc = 400 + 5000 * (i / n) ** 1.3
        out[i:i + seg] = bp(nz[max(0, i - 2048):i + seg], fc * 0.6, min(fc * 1.6, 20000))[-len(nz[i:i + seg]):]
    e = np.sin(np.pi * np.clip(t / ln, 0, 1)) ** 2
    return out * e * 0.5


def sfx_pop():
    n = int(0.12 * SR); t = np.arange(n) / SR
    f = 500 + 900 * np.exp(-t * 40)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 35) * 0.7


def sfx_ding():
    n = int(0.9 * SR); t = np.arange(n) / SR
    x = sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t * d)
            for f, a, d in [(1318, 1, 5), (2637, 0.4, 8), (1975, 0.3, 6), (3951, 0.15, 12)])
    return x * 0.35


def sfx_tap():
    n = int(0.04 * SR); t = np.arange(n) / SR
    return hp(rng.standard_normal(n), 2000) * np.exp(-t * 160) * 0.5 + np.sin(2 * np.pi * 1800 * t) * np.exp(-t * 120) * 0.25


def sfx_type():
    n = int(0.03 * SR); t = np.arange(n) / SR
    return bp(rng.standard_normal(n), 2500, 7000) * np.exp(-t * 220) * 0.28


def sfx_thud():
    n = int(0.6 * SR); t = np.arange(n) / SR
    f = 40 + 90 * np.exp(-t * 20)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 6) + lp(rng.standard_normal(n), 900) * np.exp(-t * 25) * 0.5) * 0.9


def sfx_success():
    out = np.zeros(int(1.1 * SR))
    for k, m in enumerate([72, 76, 79, 84]):
        n = int(0.6 * SR); t = np.arange(n) / SR
        x = (np.sin(2 * np.pi * mtof(m) * t) + 0.25 * np.sin(4 * np.pi * mtof(m) * t)) * np.exp(-t * 6)
        place(out, x, k * 0.07, 0.25)
    return out


def sfx_shutter():
    n = int(0.15 * SR); t = np.arange(n) / SR
    nz = bp(rng.standard_normal(n), 1500, 9000)
    return nz * (np.exp(-t * 60) + 0.6 * np.exp(-np.clip(t - 0.06, 0, None) * 70) * (t > 0.06)) * 0.5


def sfx_riser(ln=0.9):
    n = int(ln * SR); t = np.arange(n) / SR
    f = 200 + 1400 * (t / ln) ** 2
    x = saw(1, n) * 0
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.3 + hp(rng.standard_normal(n), 3000) * 0.15
    return x * (t / ln) ** 2 * 0.6


SFX = dict(whoosh=sfx_whoosh, pop=sfx_pop, ding=sfx_ding, tap=sfx_tap, type=sfx_type, thud=sfx_thud,
           success=sfx_success, shutter=sfx_shutter, riser=sfx_riser)
SFX_GAIN = dict(whoosh=0.55, pop=0.6, ding=0.5, tap=0.6, type=0.45, thud=0.7, success=0.6, shutter=0.5, riser=0.45)


def read_wav(p):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)


def write_wav(p, x, ch=1):
    x = np.clip(x, -1, 1)
    with wave.open(p, "wb") as wf:
        wf.setnchannels(ch); wf.setsampwidth(2); wf.setframerate(SR)
        wf.writeframes((x * 32767).astype(np.int16).tobytes())


def main():
    tl = json.load(open(os.path.join(BUILD, "timeline.json")))
    cues = json.load(open(os.path.join(BUILD, "cues.json")))
    dur = tl["duration"]
    n = int(dur * SR)
    voice = read_wav(os.path.join(BUILD, "voice.wav"))[:n]
    voice = np.pad(voice, (0, n - len(voice)))
    # голос: лёгкий EQ (срез низа, присутствие) и компрессия
    v = hp(voice, 85)
    v = v + 0.18 * bp(v, 2500, 6000)
    env = np.sqrt(lp(v ** 2, 12) .clip(1e-9))
    gain = np.minimum(1.0, (0.12 / np.maximum(env, 1e-4)) ** 0.35)
    v = v * lp(gain, 30)
    v = v / np.abs(v).max() * 0.9

    music = make_music(dur)
    write_wav(os.path.join(BUILD, "music.wav"), music)
    # дакинг музыки под голос
    venv = lp(np.abs(v), 6)
    duck = 1 - 0.55 * np.clip(venv / (np.percentile(venv, 90) + 1e-9), 0, 1)
    duck = lp(duck, 4)
    m = music * 0.16 * duck

    fx = np.zeros(n)
    for c in cues:
        kind = c["type"]
        if kind in SFX:
            x = SFX[kind]()
            place(fx, x, max(0.0, c["t"] - (0.12 if kind == "whoosh" else 0)), SFX_GAIN[kind] * c.get("g", 1.0))
    fx *= 0.55

    mix = v * 1.0 + m + fx
    # стерео: музыка чуть шире (Хаас на пэде не делаем — простое расширение)
    L = mix + 0.0
    R = mix + 0.0
    st = np.stack([L, R], 1).reshape(-1)
    tmp = os.path.join(BUILD, "mix_raw.wav")
    write_wav(tmp, st / np.abs(st).max() * 0.95, ch=2)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", tmp, "-af",
                    "loudnorm=I=-14:TP=-1.5:LRA=9,aresample=48000", "-ar", "48000",
                    os.path.join(BUILD, "mix.wav")], check=True)
    print("mix ok", dur)


if __name__ == "__main__":
    main()
