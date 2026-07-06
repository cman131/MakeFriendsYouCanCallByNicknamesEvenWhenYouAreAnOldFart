# Discord Bot Permissions

Derived by auditing all Discord API calls across the codebase.

---

## Bot Permissions (OAuth2)

### Text Channel Permissions

| Permission | Why It's Needed |
|---|---|
| View Channels | Read channels to detect `!commands` |
| Send Messages | All `!commands` reply to channels; scheduled daily posts |
| Send Messages in Threads | Messaging inside event forum threads |
| Read Message History | `!editmessage` fetches a past message by ID to edit it |
| Embed Links | `postBannedRestricted()` sends an embed message |
| Add Reactions | `!poll` adds emoji reactions; `messageCreate` auto-reacts |
| Use External Emojis | Poll emoji reactions may use custom server emojis |

### Thread / Forum Permissions

| Permission | Why It's Needed |
|---|---|
| Create Public Threads | `handleEventInterestAdd()` creates a forum thread per event |
| Manage Threads | `handleEventInterestAdd()` and `handleEventDelete()` delete forum threads |

### DMs

No guild permission required — DMs are sent via the user object directly in `alertAttendees()`.

---

## Gateway Intents

Must be declared in `new Client({ intents: [...] })` in `app.js`.

| Intent | Privileged | Why It's Needed |
|---|---|---|
| `Guilds` | No | Guild structure and channel access |
| `GuildMessages` | No | Receive `messageCreate` events to handle commands |
| `MessageContent` | **Yes** | Read command text from messages |
| `GuildScheduledEvents` | No | Receive event add/remove/update/delete events |
| `DirectMessages` | No | Send DMs to attendees in `alertAttendees()` |
| `GuildMembers` | **Yes** | `guild.members.fetch()` in `lobby()` and subscriber lookups |

The two privileged intents (`Message Content Intent` and `Server Members Intent`) must be explicitly enabled in the Discord Developer Portal under the Bot tab.

---

## Permissions NOT Needed

- Administrator
- Manage Messages (bot only edits its own messages)
- Manage Channels (bot creates threads, not channels)
- Kick / Ban Members
- Manage Roles
- Mention Everyone

---

## Setup Checklist

1. **Discord Developer Portal → Bot tab**: Enable `Server Members Intent` and `Message Content Intent`
2. **OAuth2 URL Generator**: Select `bot` scope and all permissions listed above
3. **`app.js`**: Confirm all intents above are declared in the `Client` constructor
