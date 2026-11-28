# TikTok-ролик «Как прогреть аккаунт TikTok за 3 дня»

Готовые файлы — в `output/`: видео MP4 (1080×1920, 60 с), обложка, SRT, текст для публикации.

Сборка с нуля: `./build.sh` (Piper TTS, голос ru_RU-dmitri → faster-whisper для таймингов → анимация HTML/CSS
покадрово в Chromium через Playwright → синтезированная музыка и SFX → FFmpeg).
- `src/script.py` — текст озвучки и субтитров (разметка акцентов ^ ~ !)
- `src/scene.js` / `scene.css` — сцены и анимации; `src/cover.html` — обложка
- `src/make_audio.py` — музыка, эффекты, дакинг, громкость −14 LUFS
