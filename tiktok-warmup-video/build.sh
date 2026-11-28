#!/usr/bin/env bash
# Полная сборка ролика. Требуется: python3 (piper-tts, faster-whisper, scipy, numpy), node + playwright, ffmpeg.
# Голос Piper: voices/ru_RU-dmitri-medium.onnx(+.json) с huggingface.co/rhasspy/piper-voices
set -euo pipefail
cd "$(dirname "$0")"
OUT=output/kak-progret-tiktok-za-3-dnya.mp4
mkdir -p build output
[ "${SKIP_VOICE:-0}" = 1 ] || LENGTH_SCALE=0.93 python3 src/make_voice.py
node src/render.js cues
node src/render.js frames 4
python3 src/make_audio.py
ffmpeg -y -v error -f concat -safe 0 -i build/segs.txt -i build/mix.wav -map 0:v -map 1:a \
  -vf "eq=contrast=1.06:saturation=1.12:gamma=0.98,colorbalance=rs=0.02:bs=0.03:rh=0.02,vignette=angle=PI/5,format=yuv420p" \
  -c:v libx264 -profile:v high -level 4.2 -preset slow -crf 17 -r 30 -g 60 \
  -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart "$OUT"
node src/render.js preview 17.0 >/dev/null
python3 -c "from PIL import Image; Image.open('build/preview/t_17.00.png').crop((282,198,798,1158)).save('build/cover_screen.png')"
node src/render.js cover
cp build/cover.png output/cover.png
cp build/subtitles.srt output/subtitles.srt
echo "OK -> $OUT"
