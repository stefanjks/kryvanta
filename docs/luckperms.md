# LuckPerms для KRYVANTA VIP

Плагин Kryvanta создаёт и поддерживает группу автоматически при каждом запуске. Ниже — эквивалентные
команды на случай ручной настройки или проверки.

```text
/lp creategroup kryvanta_vip
/lp group kryvanta_vip setweight 20
/lp group kryvanta_vip meta addprefix 50 "&#d4af37&l✦ VIP"
/lp group kryvanta_vip permission set kryvanta.vip true
/lp group kryvanta_vip permission set kryvanta.vip.menu true
/lp group kryvanta_vip permission set kryvanta.vip.size true
/lp group kryvanta_vip permission set kryvanta.vip.boat true
/lp group kryvanta_vip permission set kryvanta.vip.ec true
/lp group kryvanta_vip permission set kryvanta.vip.anvil true
/lp group kryvanta_vip permission set kryvanta.vip.craft true
/lp group kryvanta_vip permission set kryvanta.vip.enchant true
/lp group kryvanta_vip permission set kryvanta.vip.grindstone true
/lp group kryvanta_vip permission set kryvanta.vip.smithing true
/lp group kryvanta_vip permission set kryvanta.vip.loom true
/lp group kryvanta_vip permission set kryvanta.vip.stonecutter true
/lp group kryvanta_vip permission set kryvanta.vip.cartography true
/lp group kryvanta_vip permission set kryvanta.vip.brew true
/lp group kryvanta_vip permission set kryvanta.vip.rewards true
/lp group kryvanta_vip permission set kryvanta.vip.settings true
/lp group kryvanta_vip permission set kryvanta.admin false
```

VIP выдаётся временным членством (так делает плагин после оплаты):
```text
/lp user <ник> parent addtemp kryvanta_vip 30d
```
Но выдавайте VIP через сайт (`/admin → VIP`) — тогда срок хранится в БД, попадает в журнал и
переживает переустановку сервера. Ручная выдача через `/lp` будет снята плагином при следующей
сверке, если на сайте нет активной подписки.

## Проверка конфликтов
* `/lp group kryvanta_vip info` — нет `parent`-групп, нет прав кроме `kryvanta.vip*`, `kryvanta.admin=false`.
* `/lp user <ник> info` — VIP-игрок: `default` + `kryvanta_vip` (с временем окончания).
* Если у вас есть другие группы с префиксами, у них должен быть свой приоритет префикса: префикс с
  бо́льшим приоритетом побеждает (у VIP — 50).
* Префикс показывается в чате и TAB плагином Kryvanta (`vip.luckperms-prefix: true`). Если игроку
  выдан префикс командой `/prefix give`, он важнее LuckPerms-префикса.
* Никогда не выдавайте игрокам OP и `*`.
