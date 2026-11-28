# Рекламный TikTok-ролик сервера ✦ KRYVANTA ✦

Готовое — в `output/`: `kryvanta-promo.mp4` (1080×1920, 69 с), `cover.png`, `subtitles.srt`, `publikaciya.txt`.

Видеоряд — собственный процедурный воксельный мир на three.js (без игровых текстур и персонажей Mojang,
без выдуманных скриншотов сервера): ночь → рассвет → золотой час, тени, AO, bloom, цветокоррекция.
Озвучка — Piper TTS (голос ru_RU-dmitri), проверка дикции и тайминги слов — faster-whisper.
Музыка и звуки синтезированы (`src/make_audio.py`) — авторских прав третьих лиц нет.

Пересборка: `./build.sh` (сценарий — `src/script.py`, режиссура/камера — `src/main.js`, мир — `src/world.js`).
