# WARDOGS Community Hub — v0.1

A first static website version for a WARDOGS gaming community. Built to be hosted from GitHub Pages and expanded over time.

## Included in version 0.1

- Live public player profiles, including cash, gold, level, XP, and unlock count where available.
- Global cash, gold, and level leaderboards.
- Player directory with name search and SteamID64 lookup.
- Game status panel.
- Configurable community member list.
- Configurable server cards using WARDOGS NOW's public stats API.
- Optional join-code copy buttons.
- Responsive dark tactical styling.

## Data sources and limitations

### WARDOGS Tracker

Player statistics come from `https://wardogstracker.gg/api/v1`. The API only returns profiles that have synced to WARDOGS Tracker and are public. A profile can be missing, private, or have cash/gold hidden. Data is cached by the source for about 60 seconds.

API documentation: https://wardogstracker.gg/developers

### WARDOGS NOW

Server cards use `https://wardogsnow.com/api/public/v1/servers/{id}`. A server owner must enable Public API and player stats tracking in WARDOGS NOW for its status to be exposed. Server IDs here are WARDOGS NOW stats IDs, not necessarily the in-game join codes.

API documentation: https://wardogsnow.com/developers/stats-api

The join-code button copies a code you supply; it does not promise direct launching into the game. This is intentional until we verify the supported join protocol.

## Configure your community

Edit `js/config.js` in GitHub.

### Add community members

```js
members: [
  { steamId: "76561198000000000", nickname: "Ghost" },
  { steamId: "76561198000000001", nickname: "Reaper" }
],
```

Use the player's 17-digit SteamID64. The member must have a public WARDOGS Tracker profile for the website to retrieve stats. This list is part of the public website source; do not add information you intend to keep private.

### Add community servers

```js
servers: [
  {
    id: "12",
    name: "Wardogs Main",
    region: "US East",
    joinCode: "YOUR_IN_GAME_JOIN_CODE"
  }
],
```

`id` is the WARDOGS NOW server stats ID. `joinCode` is optional. If omitted, no copy-code button appears.

## Publish with GitHub Pages

1. Create a new repository on GitHub, for example `wardogs-community-hub`.
2. Upload the contents of this folder to the repository root. `index.html` must be at the root.
3. Open repository **Settings → Pages**.
4. Under Build and deployment, select **Deploy from a branch**.
5. Choose the `main` branch and `/ (root)`, then save.
6. Wait for GitHub Pages to publish the site. The URL will appear in the Pages settings.

## Local preview

Because this version calls public APIs, serve the folder from a local web server rather than opening `index.html` as a file. For example, if Python is installed:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Suggested next versions

- v0.2: community roster management, member verification, and persistent shared data.
- v0.3: robust server discovery and confirmed game join links.
- v0.4: historical cash/gold snapshots and wealth changes over time.
- v1.0: authentication, moderation/admin tools, privacy controls, and a proper database if needed.

## Security notes

- Do not put passwords, Steam Web API keys, RCON passwords, service-role keys, or other secrets in `js/config.js`.
- This is a static prototype. The configured member list is visible to visitors and is not a secure membership system.
- The site does not bypass privacy settings or scrape private accounts.
