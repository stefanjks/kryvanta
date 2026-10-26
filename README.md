# Kryvanta — плагин для сервера KRYVANTA (Paper 1.21.11)

Заменяет TAB, EssentialsXChat и Vault. Один набор префиксов работает сразу везде:
чат, список игроков (TAB), над головой и скорборд.

## Сборка
Нужны JDK 21 и Maven:
    mvn package
Готовый файл: target/Kryvanta-1.0.0.jar -> положить в plugins/

Без установки Java: залить папку на GitHub, вкладка Actions -> build -> скачать Kryvanta.jar.

## Команды
/prefix create <id> <вес> <текст>   создать префикс (вес: больше = выше в TAB)
/prefix edit <id> <текст>           изменить текст
/prefix weight <id> <вес>           изменить вес
/prefix delete <id>                 удалить
/prefix list                        список
/prefix give <игрок> <id>           выдать
/prefix remove <игрок>              забрать
/kryvanta reload                    перезагрузить config.yml
/board [on|off]                     скрыть/показать скорборд (для всех игроков)

Права: kryvanta.admin (OP) — управление, kryvanta.board (все) — /board.

Примеры текста: &c[Модератор]  |  &#4dabf7&l[Модератор]  |  <gradient:#ff4d6d:#ffb347>[Тильт]</gradient>

## Что настраивать
Всё в plugins/Kryvanta/config.yml: IP, Discord, интервал рекламы (180 с),
вид скорборда, заголовок и подвал TAB, формат чата.
Префиксы и выданные игрокам хранятся в plugins/Kryvanta/data.yml.

## Не ставить вместе с этим плагином
TAB, EssentialsXChat, ChatControl и другие плагины форматирования чата/таба/скорборда.
Essentials (основной jar), LuckPerms, WorldGuard и остальные — оставляем.
