# Протокол сайт ⇄ плагин

Все запросы плагина — `POST`, JSON, заголовки:

| Заголовок | Значение |
|---|---|
| `X-Kry-Timestamp` | unix-время в секундах (допуск ±5 минут) |
| `X-Kry-Nonce` | случайная строка 16–64 символа, одноразовая |
| `X-Kry-Signature` | `hex(HMAC_SHA256(secret, ts + "\n" + nonce + "\n" + "POST" + "\n" + path + "\n" + hex(SHA256(body))))` |

Ответ подписан: `X-Kry-Signature = hex(HMAC_SHA256(secret, ts + "\n" + nonce + "\n" + hex(SHA256(body))))`,
где `nonce` — из запроса. Плагин отбрасывает успешные ответы без верной подписи.

| Endpoint | Запрос | Ответ |
|---|---|---|
| `/api/plugin/sync` | `{online, max, version, players:[{uuid,name}]}` | `{config:{vip, features, rewards}, vips:[{uuid,name,expiresAt}], deliveries:[{id,type,uuid,payload}]}` |
| `/api/plugin/ack` | `{ids:[...]}` | `{acknowledged}` |
| `/api/plugin/link` | `{code, uuid, name}` | `{ok, username}` / `{ok:false, error, message}` |
| `/api/plugin/playtime` | `{batchId, entries:[{uuid,name,activeSeconds≤3600,rewardProgressSeconds,rewardsStored}]}` | `{duplicate, updated}` |
| `/api/plugin/rewards` | `{claims:[{claimId,uuid,name,rewardKey,source,items,claimedAt}]}` | `{recorded}` |

Типы доставок: `VIP_SYNC {uuid, expiresAt|null}`, `NOTIFY {uuid, message}`,
`REWARD_CREDIT {uuid, rewardKey, count, source}`, `COMMANDS {uuid, commands[]}`, `CONFIG_RELOAD {}`.
Идемпотентность: `batchId`, `claimId` и `id` доставки уникальны; повтор не создаёт дублей.
