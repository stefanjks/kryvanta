#!/usr/bin/env bash
# Сборка рекламного ролика KRYVANTA. Нужны: python3 (piper-tts, faster-whisper, scipy, numpy), node (playwright, three), ffmpeg.
# Голос Piper ru_RU-dmitri-medium (huggingface.co/rhasspy/piper-voices) — в папке voices/.
set -euo pipefail; cd "$(dirname "$0")"; mkdir -p build output
[ -d node_modules/three ] || npm i
[ "${SKIP_VOICE:-0}" = 1 ] || LENGTH_SCALE=0.93 python3 src/make_voice.py
node src/render.js srt
node src/render.js frames 4
python3 src/make_audio.py
ffmpeg -y -v error -f concat -safe 0 -i build/segs.txt -i build/mix.wav -map 0:v -map 1:a \
  -vf "hqdn3d=2:1.5:4:3,eq=contrast=1.03:saturation=1.05,format=yuv420p" -c:v libx264 -profile:v high -level 4.2 -preset slow -crf 21 -maxrate 14M -bufsize 28M -r 30 -g 60 \
  -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart output/kryvanta-promo.mp4
NOOV=1 node src/render.js preview 22.84 >/dev/null && cp build/preview/t_22.84.png build/cover_bg.png
node src/render.js cover && cp build/cover.png output/cover.png && cp build/subtitles.srt output/subtitles.srt
echo "OK -> output/kryvanta-promo.mp4"
