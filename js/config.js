/*
  WARDOGS COMMUNITY HUB — CONFIGURATION
  Edit this file to personalize the site. Do not put passwords, private API keys,
  or server RCON credentials in this public file.

  Add public player profiles by SteamID64 to members.
  Add server IDs from WARDOGS NOW to servers. Server owners must enable its Public API.
  joinCode is optional; when provided, the site offers a copy button rather than
  assuming that a browser can launch the game directly.
*/
window.WARDOGS_CONFIG = {
  communityName: "WARDOGS",
  playerApiBase: "https://wardogstracker.gg/api/v1",
  serverApiBase: "https://wardogsnow.com/api/public/v1",

  // Example:
  // members: [
  //   { steamId: "76561198000000000", nickname: "Ghost" }
  // ]
  members: [],

  // Example:
  // servers: [
  //   { id: "12", name: "Wardogs Main", region: "US East", joinCode: "YOUR-IN-GAME-JOIN-CODE" }
  // ]
  servers: []
};
