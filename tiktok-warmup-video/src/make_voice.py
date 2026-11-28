# -*- coding: utf-8 -*-
"""Озвучка (Piper TTS, голос ru_RU-dmitri) + тайминги слов (faster-whisper).

Результат: build/voice.wav (48 кГц, моно) и build/timeline.json
"""
import difflib, json, os, re, subprocess, sys, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from script import PHRASES

BUILD = os.path.join(HERE, "..", "build")
VOICE_MODEL = os.environ.get("VOICE_MODEL", "voices/ru_RU-dmitri-medium.onnx")
LENGTH_SCALE = float(os.environ.get("LENGTH_SCALE", "0.86"))
SR = 48000
LEAD_IN = 0.30
TAIL = 1.4
os.makedirs(os.path.join(BUILD, "phr"), exist_ok=True)

VOWELS = set("аеёиоуыэюяaeiouy")


def is_word(tok):
    return re.search(r"[0-9A-Za-zА-Яа-яЁё]", tok) is not None


def words_of(text):
    toks = text.split()
    out = []
    for t in toks:
        if is_word(t):
            out.append(t)
        elif out:
            out[-1] += " " + t  # тире и т.п. приклеиваем к предыдущему слову
    return out


NORM = {"тик-ток": "тикток", "tiktok": "тикток", "майн-крафт": "майнкрафт", "minecraft": "майнкрафт",
        "1": "первый", "2": "второй", "3": "третий"}


def norm(s):
    s = s.lower().replace("ё", "е")
    for a, b in NORM.items():
        s = s.replace(a, b)
    return re.sub(r"[^а-яa-z0-9]", "", s)


def syl(w):
    w = re.sub(r"[^\wЁё]", "", w.lower())
    n = sum(1 for c in w if c in VOWELS)
    if w.isdigit():
        n = 2
    return max(n, 1)


def load_pcm(path, sr):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(sr),
                          "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).copy()


def trim(x, sr, thr=0.004):
    env = np.convolve(np.abs(x), np.ones(int(sr * 0.01)) / int(sr * 0.01), mode="same")
    idx = np.where(env > thr)[0]
    if len(idx) == 0:
        return x
    a = max(idx[0] - int(sr * 0.06), 0)
    b = min(idx[-1] + int(sr * 0.06), len(x))
    return x[a:b]


def main():
    from faster_whisper import WhisperModel
    asr = WhisperModel(os.environ.get("ASR_MODEL", "small"), device="cpu", compute_type="int8")

    pieces, timeline, t = [], [], LEAD_IN
    pieces.append(np.zeros(int(SR * LEAD_IN), np.float32))
    report = []
    for p in PHRASES:
        best = None
        for k, ns in enumerate([0.667, 0.6, 0.72, 0.55, 0.64, 0.7]):
            wav = os.path.join(BUILD, "phr", f"{p['id']}_{k}.wav")
            subprocess.run([sys.executable, "-m", "piper", "-m", VOICE_MODEL, "-f", wav,
                            "--length-scale", str(LENGTH_SCALE), "--noise-scale", str(ns),
                            "--sentence-silence", "0"],
                           input=p["tts"].encode(), check=True, capture_output=True)
            x16 = trim(load_pcm(wav, 16000), 16000)
            segs, _ = asr.transcribe(x16, language="ru", beam_size=5, word_timestamps=True)
            aw = [w for s_ in segs for w in (s_.words or [])]
            heard = " ".join(w.word.strip() for w in aw)
            score = difflib.SequenceMatcher(None, norm(p["tts"]), norm(heard)).ratio()
            if best is None or score > best[0]:
                best = (score, wav, aw, heard)
            if score > 0.985:
                break
        score, wav, aw, heard = best
        x = trim(load_pcm(wav, SR), SR)
        f = int(SR * 0.008)
        x[:f] *= np.linspace(0, 1, f); x[-f:] *= np.linspace(1, 0, f)
        dur = len(x) / SR
        report.append(f"{p['id']}: {p['tts']}\n   ASR({score:.3f}, take {wav[-5]}): {heard}")
        print(report[-1], flush=True)

        sub_words = words_of(p["sub"])
        tts_words = words_of(p["tts"])
        assert len(sub_words) == len(tts_words), (p["id"], sub_words, tts_words)
        if len(aw) == len(sub_words):
            times = [(max(0.0, w.start), min(dur, w.end)) for w in aw]
        else:  # пропорционально слогам внутри распознанной речи
            s0 = aw[0].start if aw else 0.0
            s1 = aw[-1].end if aw else dur
            sy = np.array([syl(w) for w in tts_words], float)
            edges = s0 + (s1 - s0) * np.concatenate([[0], np.cumsum(sy) / sy.sum()])
            times = [(edges[i], edges[i + 1]) for i in range(len(sy))]
        words = []
        for w, (a, b) in zip(sub_words, times):
            hl = None
            if w[0] in "^~!":
                hl = {"^": "y", "~": "g", "!": "r"}[w[0]]
                w = w[1:]
            words.append(dict(w=w, s=round(t + a, 3), e=round(t + b, 3), hl=hl))
        timeline.append(dict(id=p["id"], sec=p["sec"], start=round(t, 3), end=round(t + dur, 3),
                             words=words, text=re.sub(r"[\^~!](?=\w)", "", p["sub"])))
        pieces.append(x)
        gap = p["gap"]
        pieces.append(np.zeros(int(SR * gap), np.float32))
        t += dur + gap

    pieces.append(np.zeros(int(SR * TAIL), np.float32))
    y = np.concatenate(pieces)
    y = y / (np.abs(y).max() + 1e-9) * 0.89
    with wave.open(os.path.join(BUILD, "voice.wav"), "wb") as wf:
        wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(SR)
        wf.writeframes((y * 32767).astype(np.int16).tobytes())
    total = len(y) / SR
    json.dump(dict(duration=round(total, 3), phrases=timeline), open(os.path.join(BUILD, "timeline.json"), "w"),
              ensure_ascii=False, indent=1)
    open(os.path.join(BUILD, "asr_report.txt"), "w").write("\n".join(report))

    print("TOTAL", round(total, 2), "s")


if __name__ == "__main__":
    main()
