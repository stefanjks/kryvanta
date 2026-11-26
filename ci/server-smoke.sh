#!/usr/bin/env bash
# CI: запуск настоящего Paper 1.21.11 + LuckPerms + Kryvanta, связанного с запущенным сайтом.
set -euo pipefail
ROOT=$(pwd)
SRV=$ROOT/ci-server
mkdir -p "$SRV/plugins/Kryvanta"
cd "$SRV"

URL=$(curl -fsSL https://fill.papermc.io/v3/projects/paper/versions/1.21.11/builds/latest | jq -r '.downloads."server:default".url')
curl -fsSL -o paper.jar "$URL"
LP=$(curl -fsSL https://metadata.luckperms.net/data/all | jq -r '.downloads.bukkit')
curl -fsSL -o plugins/LuckPerms.jar "$LP"
cp "$ROOT"/plugin/target/Kryvanta-*.jar plugins/
echo "eula=true" > eula.txt
printf "online-mode=false\nserver-port=25599\nlevel-type=minecraft\\:flat\nspawn-protection=0\n" > server.properties

# конфиг плагина с адресом сайта и секретом
cp "$ROOT/plugin/src/main/resources/config.yml" plugins/Kryvanta/config.yml
sed -i "s#url: \"https://kryvanta.example.com\"#url: \"http://127.0.0.1:3000\"#; s#secret: \"CHANGE_ME\"#secret: \"$PLUGIN_API_SECRET\"#; s#sync-interval-seconds: 30#sync-interval-seconds: 10#" plugins/Kryvanta/config.yml

mkfifo console.in
exec 3<>console.in                      # держим FIFO открытым на чтение и запись
java -Xmx2G -jar paper.jar --nogui <&3 > server.log 2>&1 &
JPID=$!
cmd() { echo "$1" >&3; sleep "${2:-3}"; }

for i in $(seq 1 180); do grep -q 'Done (' server.log && break; sleep 1; done
grep -q 'Done (' server.log || { tail -100 server.log; exit 1; }
sleep 15   # первая синхронизация с сайтом

# офлайн-UUID игрока Tester (как на offline-mode сервере)
UUID=$(python3 -c "import hashlib,uuid;h=bytearray(hashlib.md5(b'OfflinePlayer:Tester').digest());h[6]=h[6]&0x0f|0x30;h[8]=h[8]&0x3f|0x80;print(uuid.UUID(bytes=bytes(h)))")
(cd "$ROOT/web" && npx tsx ../ci/grant-vip.ts "$UUID" Tester)
sleep 20   # плагин забирает VIP_SYNC и выдаёт группу в LuckPerms

cmd "plugins"
cmd "kvip status"
cmd "lp group kryvanta_vip info" 4
cmd "lp group kryvanta_vip permission info" 4
cmd "lp user $UUID parent info" 5
MARK=$(wc -l < server.log)   # граница: всё ниже — после отзыва VIP
(cd "$ROOT/web" && npx tsx ../ci/grant-vip.ts "$UUID" Tester revoke)
sleep 20
cmd "lp user $UUID parent info" 5
cmd "stop" 5
for i in $(seq 1 60); do kill -0 $JPID 2>/dev/null || break; sleep 1; done
kill -9 $JPID 2>/dev/null || true

echo "================ server.log (Kryvanta / LuckPerms) ================"
grep -iE 'kryvanta|luckperms|kvip|vip|exception|error|parent|kryvanta_vip' server.log | grep -v 'Downloading' | tail -120

fail=0
grep -q 'KRYVANTA запущен' server.log || { echo "FAIL: плагин не запустился"; fail=1; }
grep -q 'модуль KRYVANTA VIP отключён\|Не удалось запустить модуль VIP' server.log && { echo "FAIL: модуль VIP не запустился"; fail=1; }
grep -q 'сайт .*доступен' server.log && ! grep -q 'сайт .*недоступен' server.log || { echo "FAIL: нет связи с сайтом"; fail=1; }
grep -q 'kryvanta.vip.enchant' server.log || { echo "FAIL: группа kryvanta_vip не настроена"; fail=1; }
head -n "$MARK" server.log | grep -A4 "Parents:" | grep -q 'kryvanta_vip' || { echo "FAIL: игрок не получил группу kryvanta_vip"; fail=1; }
tail -n +"$((MARK + 1))" server.log | grep -A4 "Parents:" | grep -q 'kryvanta_vip' && { echo "FAIL: группа kryvanta_vip не снята после отзыва VIP"; fail=1; }
if grep -nE '^\s+at net\.kryvanta' server.log ; then echo "FAIL: исключения в плагине"; fail=1; fi
[ $fail -eq 0 ] && echo "OK: плагин запущен на Paper 1.21.11, связь с сайтом есть, VIP с сайта выдан и снят в LuckPerms"
exit $fail
