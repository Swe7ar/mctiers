# MCTiersTierTest — Paper 1.21.11 plugin

The bridge between your Minecraft server and the MCTiers website. It hands players a **tier test
code**, tells the website that the code exists, and announces the tier once a tester awards it.

```
player (game)            website (chat)                  tester
     |  /tiertest              |                            |
     |------ code ABC123 ----->|  paste code in "get tier"  |
     |                         |-------- claim ------------>|
     |<---- "tester ready" ----|                            |
     |                         |<----- chat + tier ---------|
     |<---- "your tier is X" -|                            |
```

## How the code works

1. A player runs `/tiertest` in game. The plugin generates a six character code
   (`PLAY77`), registers it with the website hub and prints it in chat.
2. The player opens the website → **Chat** → **New** → names the chat `get tier` → pastes the code.
3. The website verifies the code and opens a thread between the player and a **tester**
   (anybody on the site who has a rank, plus the admin).
4. The tester runs the fight and picks the tier in the website. The hub refuses to let a tester
   award a tier to themselves.
5. The plugin picks the new tier up and announces it in game.

## Build

Requires **JDK 21** and **Maven 3.9+**.

```bash
cd minecraft-plugin
mvn clean package
```

The jar lands in `target/mctiers-tiertest-1.2.2.jar`.

## Install

1. Drop the jar into the `plugins/` folder of your Paper 1.21.11 server.
2. Start the server once to create `plugins/MCTiersTierTest/config.yml`.
3. Point `hub.url` at the machine that runs the website server
   (`node tools/serve.mjs 4173`) — use `http://localhost:4173` when both are on the same box,
   or `https://crakedmctiers.gg` when the website is hosted.
4. Make sure the `hub.token` in `config.yml` matches the website server's token
   (the `TIERHUB_TOKEN` environment variable, default `mctiers-local`).
5. Restart the server.

## Tier tag in game

Whatever you change on the website ends up in the game:

- The plugin reads every online player's tiers from the hub every few seconds.
- The **highest tier** the player holds is applied in game as a coloured tag in front of their name
  (`[HT1] Steve`) and as a permission `mctiers.tier.<TIER>` other plugins can check.
- A change made in the admin panel or in the chat shows up in game within a few seconds — no
  rejoin needed.
- Tier colours: HT1 gold, LT1 yellow, HT2 white, LT2 dark grey, HT3 gold, LT3 yellow, HT4 purple,
  LT4 light purple, HT5 dark aqua, LT5 aqua.

Turn the tag off with `tier-tag.enabled: false` in `config.yml`.

## Commands

| Command | Permission | What it does |
| --- | --- | --- |
| `/tiertest` | `mctiers.tiertest` | Issue a tier test code |
| `/tiertest reset` | `mctiers.tiertest` | Drop your current code |
| `/tiertest list` | `mctiers.tiertest.admin` | Point staff at the website queue |
| `/tiers` | `mctiers.tiers` | Show the tiers you currently hold |
| `/register <password>` | `mctiers.auth` | Create an offline account (teleports you to the void, then login) |
| `/login <password>` | `mctiers.auth` | Log in and teleport from the void to spawn |
| `/logout` | `mctiers.auth` | Log out and sent back to the void |
| `/skin <name>` | `mctiers.skin` | Pull the skin from Mojang for that account (not offline-limited) |

## Offline login

The server runs in offline mode, so Minecraft cannot authenticate people — the plugin does it:

1. Player joins. If they are not logged in, the plugin teleports them to the void world and
   freezes them (no movement, no interactions, no commands except `/register` and `/login`).
2. `/register <password>` — account is created (SHA-256 hashed, with a per-account salt),
   the player is marked as logged in and teleported back to spawn.
3. `/login <password>` — password check, then teleported to spawn.
4. `/logout` — back to the void.

Passwords live in `plugins/MCTiersTierTest/auth.yml` (salted SHA-256). Never stored in plaintext.

## Skins from namemc.com

Players can change their skin to any name style from Mojang's records:

```
/skin Notch
/skin ilMango
```

The plugin looks up the name on `api.mojang.com`, fetches the textures from Mojang's session
server and applies them to the player so the skin is visible to everyone online. Names must be
actual Mojang accounts.

## One click from the game to the website

Minecraft chat cannot reach the system clipboard, so the code is sent as a **clickable message**.
Clicking it opens the website chat page with the code already pasted in:

```
[TierTest] Your tier test code is PLAY99. Click it, or paste it on the website in chat.
```

That link is `https://crakedmctiers.gg/chat.html?code=PLAY99` — the page fills the code box and, if
you are signed in, joins the queue automatically.


## Server name

The server list name comes from `config.yml`:

```yaml
server:
  name: "CrackedMCTiers"
  motd: "&6&lCrackedMCTiers &8• &7Cracked PvP tier list &8• &f130.78.218.210:25606"
  write-server-properties: true
```

On Paper the plugin overrides the server list title live (through `PaperServerListPingEvent`) and
also writes the MOTD into `server.properties`, so the name survives a restart. Restart once after
changing it.

## Configuration

```yaml
hub:
  url: "https://crakedmctiers.gg"     # the live website / hub
  token: "mctiers-local"              # must match the server's TIERHUB_TOKEN
  poll-interval-ticks: 40      # 20 ticks = 1 second
  website: "https://crakedmctiers.gg/chat.html"
messages:
  prefix: "&8[&6TierTest&8] &r"
  code-issued: "&aYour tier test code is &f&l%code%&a."
  # ... every message can be reworded, colours use & codes
```

## Notes

- Paper 1.21.11 → `paper-api:1.21.11-R0.1-SNAPSHOT`.
- The plugin only needs Gson, which ships with the Paper server.
- Nothing is stored on the game server: codes, chats and tiers live in `data/tiertest.json`
  next to the website, so the plugin can be rebuilt without losing anything.
- If the website server is offline the plugin keeps working — it just cannot issue or confirm
  codes, and the player gets a "hub is not reachable" message.
