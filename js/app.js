(() => {
  "use strict";
  const config = window.WARDOGS_CONFIG || {};
  const playerApi = config.playerApiBase || "https://wardogstracker.gg/api/v1";
  const serverApi = config.serverApiBase || "https://wardogsnow.com/api/public/v1";
  const $ = (id) => document.getElementById(id);
  const state = { leaderboards: {}, players: [], sort: "cash", status: null, servers: [] };
  const fmtNum = (v) => v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? "—" : Number(v).toLocaleString("en-US");
  const fmtMoney = (v) => v === null || v === undefined || !Number.isFinite(Number(v)) ? "Hidden" : "$" + fmtNum(v);
  const fmtGold = (v) => v === null || v === undefined || !Number.isFinite(Number(v)) ? "Hidden" : fmtNum(v);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const shortId = (s) => s ? String(s).slice(0, 8) + "…" : "";
  const avatarMarkup = (p, sizeClass = "") => p.avatarUrl
    ? `<img class="avatar ${sizeClass}" src="${esc(p.avatarUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
    : `<span class="avatar avatar-fallback ${sizeClass}">${esc((p.name || "?").slice(0,1).toUpperCase())}</span>`;
  const playerLink = (p) => p.profileUrl || `https://wardogstracker.gg/profile/${encodeURIComponent(p.steamId)}`;
  function toast(message) {
    const el = $("toast"); el.textContent = message; el.classList.add("show");
    clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), 2400);
  }
  async function getJson(url) {
    const res = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!res.ok) {
      if (res.status === 404) throw new Error("Player or server was not found in the public data source.");
      if (res.status === 429) throw new Error("The public stats service is rate-limiting requests. Please wait a minute.");
      throw new Error(`Stats service returned HTTP ${res.status}.`);
    }
    return res.json();
  }
  function normalizePlayer(p) {
    return {
      steamId: String(p.steamId || p.steam_id || ""),
      name: p.name || p.nickname || "Unknown player",
      avatarUrl: p.avatarUrl || p.avatar_url || "",
      profileUrl: p.profileUrl || (p.steamId ? `https://wardogstracker.gg/profile/${p.steamId}` : ""),
      wardogLevel: p.wardogLevel ?? p.level ?? null,
      careerXp: p.careerXp ?? null,
      cash: p.cash ?? p.stats?.cash ?? null,
      gold: p.gold ?? p.stats?.gold ?? null,
      unlocks: p.unlocks ?? null,
      syncedAt: p.syncedAt || p.synced_at || null,
      leaderboardRank: p.leaderboardRank ?? p.rank ?? null
    };
  }
  async function fetchLeaderboard(sort) {
    if (state.leaderboards[sort]) return state.leaderboards[sort];
    const payload = await getJson(`${playerApi}/leaderboard?sort=${encodeURIComponent(sort)}&limit=100&offset=0`);
    const players = (payload.players || []).map(normalizePlayer);
    state.leaderboards[sort] = players;
    return players;
  }
  async function loadAll() {
    $("community-name").textContent = config.communityName || "WARDOGS";
    try {
      const [cash, gold, level, status] = await Promise.all([
        fetchLeaderboard("cash"), fetchLeaderboard("gold"), fetchLeaderboard("level"),
        getJson(`${playerApi}/status`).catch(() => null)
      ]);
      state.status = status;
      const merged = new Map();
      [...cash, ...gold, ...level].forEach(p => {
        if (!p.steamId) return;
        const old = merged.get(p.steamId) || {};
        merged.set(p.steamId, { ...old, ...p, cash: p.cash ?? old.cash ?? null, gold: p.gold ?? old.gold ?? null });
      });
      state.players = Array.from(merged.values());
      // Load explicitly configured members that may not appear in the top global boards.
      const configured = (config.members || []).filter(m => /^\d{17}$/.test(String(m.steamId || "")));
      await Promise.all(configured.map(async m => {
        if (merged.has(String(m.steamId))) {
          if (m.nickname) merged.get(String(m.steamId)).communityNickname = m.nickname;
          return;
        }
        try {
          const payload = await getJson(`${playerApi}/players/${encodeURIComponent(m.steamId)}`);
          const p = normalizePlayer(payload.player || payload);
          if (m.nickname) p.communityNickname = m.nickname;
          merged.set(p.steamId, p);
        } catch (e) { console.warn("Could not load configured member", m.steamId, e.message); }
      }));
      state.players = Array.from(merged.values());
      $("connection-label").textContent = "PUBLIC STATS CONNECTED";
      $("last-updated").textContent = `Updated ${new Date().toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}`;
      $("metric-players").textContent = fmtNum(state.players.length);
      const topCash = cash.filter(p => p.cash !== null).sort((a,b) => Number(b.cash)-Number(a.cash))[0];
      const topGold = gold.filter(p => p.gold !== null).sort((a,b) => Number(b.gold)-Number(a.gold))[0];
      $("metric-cash").textContent = topCash ? fmtMoney(topCash.cash) : "—";
      $("metric-gold").textContent = topGold ? fmtGold(topGold.gold) : "—";
      const overall = status?.overall || "unknown";
      $("metric-status").textContent = overall.toUpperCase();
      $("metric-status").style.color = overall === "ok" ? "var(--green)" : overall === "down" ? "var(--red)" : "var(--text)";
      $("metric-status-detail").textContent = status?.servers?.summary || "Status supplied by WARDOGS Tracker";
      renderPlayers();
      renderWealth();
      renderDashboardCash();
    } catch (err) {
      $("connection-label").textContent = "STATS FEED UNAVAILABLE";
      $("metric-status").textContent = "UNAVAILABLE";
      $("metric-status-detail").textContent = err.message;
      $("players-table").innerHTML = `<tr><td colspan="7" class="empty-state">${esc(err.message)}<br>Try refreshing in a minute.</td></tr>`;
      $("wealth-table").innerHTML = `<tr><td colspan="6" class="empty-state">${esc(err.message)}</td></tr>`;
      $("dashboard-cash").innerHTML = `<div class="loading-row">${esc(err.message)}</div>`;
    }
  }
  function renderDashboardCash() {
    const list = [...state.players].filter(p => p.cash !== null).sort((a,b) => Number(b.cash)-Number(a.cash)).slice(0,5);
    $("dashboard-cash").innerHTML = list.length ? list.map((p,i) => `
      <div class="compact-row">
        <div class="rank">${String(i+1).padStart(2,"0")}</div>
        <div class="player-mini">${avatarMarkup(p)}<div style="min-width:0"><div class="player-name">${esc(p.communityNickname || p.name)}</div><div class="player-meta">Level ${fmtNum(p.wardogLevel)} · ${esc(shortId(p.steamId))}</div></div></div>
        <div class="money">${fmtMoney(p.cash)}<small>${fmtGold(p.gold)} gold</small></div>
      </div>`).join("") : `<div class="loading-row">No visible cash balances are available.</div>`;
  }
  function renderPlayers() {
    const q = ($("player-search")?.value || "").trim().toLowerCase();
    const filtered = state.players.filter(p => `${p.name} ${p.communityNickname || ""} ${p.steamId}`.toLowerCase().includes(q))
      .sort((a,b) => (a.communityNickname || a.name).localeCompare(b.communityNickname || b.name));
    $("players-count").textContent = `${filtered.length} profiles shown · ${state.players.length} loaded`;
    $("players-table").innerHTML = filtered.length ? filtered.map(p => `
      <tr>
        <td><div class="table-player">${avatarMarkup(p)}<div><strong>${esc(p.communityNickname || p.name)}</strong><small>${esc(p.steamId)}</small></div></div></td>
        <td>${fmtNum(p.wardogLevel)}</td><td class="table-money">${fmtMoney(p.cash)}</td><td class="table-money">${fmtGold(p.gold)}</td>
        <td>${fmtNum(p.unlocks)}</td><td class="table-muted">${esc(formatDate(p.syncedAt))}</td>
        <td><button class="profile-link" data-profile="${esc(p.steamId)}">PROFILE ↗</button></td>
      </tr>`).join("") : `<tr><td colspan="7" class="empty-state">${q ? "No loaded profiles match that search." : "No public profiles loaded yet."}</td></tr>`;
  }
  function renderWealth() {
    const sort = state.sort;
    const list = [...(state.leaderboards[sort] || [])];
    $("leaderboard-title").textContent = sort === "cash" ? "Highest cash balances" : sort === "gold" ? "Highest gold balances" : "Highest Wardog levels";
    $("wealth-table").innerHTML = list.length ? list.map((p,i) => `
      <tr><td class="table-muted">${String(i+1).padStart(2,"0")}</td>
      <td><div class="table-player">${avatarMarkup(p)}<div><strong>${esc(p.name)}</strong><small>${esc(p.steamId)}</small></div></div></td>
      <td>${fmtNum(p.wardogLevel)}</td><td class="table-money">${fmtMoney(p.cash)}</td><td class="table-money">${fmtGold(p.gold)}</td>
      <td><a class="profile-link" href="${esc(playerLink(p))}" target="_blank" rel="noreferrer">OPEN PROFILE ↗</a></td></tr>`).join("") : `<tr><td colspan="6" class="empty-state">No leaderboard data is available for this category.</td></tr>`;
  }
  function formatDate(value) {
    if (!value) return "Unknown";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "Unknown" : d.toLocaleDateString([], {month:"short",day:"numeric",year:"numeric"});
  }
  async function lookupPlayer(raw) {
    const id = raw.trim();
    if (!/^\d{17}$/.test(id)) {
      $("lookup-message").textContent = "Enter a valid 17-digit SteamID64.";
      $("lookup-message").className = "inline-message error";
      return;
    }
    $("lookup-message").textContent = "Looking up public profile…";
    $("lookup-message").className = "inline-message";
    try {
      const payload = await getJson(`${playerApi}/players/${encodeURIComponent(id)}`);
      const p = normalizePlayer(payload.player || payload);
      if (!p.steamId) p.steamId = id;
      const idx = state.players.findIndex(x => x.steamId === id);
      if (idx >= 0) state.players[idx] = { ...state.players[idx], ...p };
      else state.players.unshift(p);
      $("lookup-message").textContent = `Loaded ${p.name}. This lookup is temporary; add the SteamID64 to js/config.js to include it for all visitors.`;
      $("lookup-message").className = "inline-message";
      renderPlayers();
      openPlayer(p.steamId);
    } catch (e) {
      $("lookup-message").textContent = `${e.message} The player may be private or may not have synced with WARDOGS Tracker.`;
      $("lookup-message").className = "inline-message error";
    }
  }
  async function openPlayer(id) {
    let p = state.players.find(x => x.steamId === id);
    try {
      const payload = await getJson(`${playerApi}/players/${encodeURIComponent(id)}`);
      p = { ...(p || {}), ...normalizePlayer(payload.player || payload) };
      const idx = state.players.findIndex(x => x.steamId === id);
      if (idx >= 0) state.players[idx] = p; else state.players.unshift(p);
    } catch (e) {
      if (!p) { toast(e.message); return; }
    }
    $("player-detail-content").innerHTML = `
      <div class="eyebrow">PLAYER DOSSIER</div>
      <div class="profile-hero">${avatarMarkup(p)}<div><h3>${esc(p.communityNickname || p.name)}</h3><div class="player-meta">WARDOG LEVEL ${fmtNum(p.wardogLevel)} · ${esc(p.steamId)}</div><a href="${esc(playerLink(p))}" target="_blank" rel="noreferrer">VIEW WARDOGS TRACKER PROFILE ↗</a></div></div>
      <div class="profile-stats">
        <div class="profile-stat"><span>CURRENT CASH</span><strong>${fmtMoney(p.cash)}</strong></div>
        <div class="profile-stat"><span>GOLD</span><strong>${fmtGold(p.gold)}</strong></div>
        <div class="profile-stat"><span>CAREER XP</span><strong>${fmtNum(p.careerXp)}</strong></div>
        <div class="profile-stat"><span>UNLOCKS</span><strong>${fmtNum(p.unlocks)}</strong></div>
      </div>
      <div class="profile-extra">Last synced: ${esc(formatDate(p.syncedAt))}. Public data may be delayed. Hidden values are not available to this site.</div>`;
    $("player-dialog").showModal();
    renderPlayers();
  }
  async function loadServers() {
    const servers = Array.isArray(config.servers) ? config.servers : [];
    const grid = $("server-grid");
    if (!servers.length) {
      grid.innerHTML = `<div class="server-empty"><strong>No community servers configured yet.</strong>Add your server's WARDOGS NOW public stats ID, region, and optional in-game join code to <code>js/config.js</code>.<br><br>Server owners must enable the Public API and stats tracking on WARDOGS NOW for live status to appear.</div>`;
      return;
    }
    grid.innerHTML = servers.map((s,i) => `<article class="server-card" id="server-${i}"><div class="server-top"><div><div class="server-name">${esc(s.name || `Server ${s.id}`)}</div><div class="server-region">${esc(s.region || "Region not set")} · ID ${esc(s.id)}</div></div><div class="server-state unknown"><span class="pulse"></span> CHECKING</div></div><div class="server-stats"><div class="server-stat"><span>PLAYERS</span><strong>—</strong></div><div class="server-stat"><span>MAP</span><strong>—</strong></div><div class="server-stat"><span>MODE</span><strong>—</strong></div></div><div class="server-actions"></div></article>`).join("");
    await Promise.all(servers.map(async (s,i) => {
      const card = $(`server-${i}`);
      const actions = card.querySelector(".server-actions");
      try {
        const payload = await getJson(`${serverApi}/servers/${encodeURIComponent(s.id)}`);
        const d = payload.data || payload;
        const status = d.state || "unknown";
        card.querySelector(".server-state").className = `server-state ${status === "online" ? "" : status === "offline" ? "offline" : "unknown"}`;
        card.querySelector(".server-state").innerHTML = `<span class="pulse"></span> ${esc(status.toUpperCase())}`;
        const stats = card.querySelectorAll(".server-stat strong");
        stats[0].textContent = `${fmtNum(d.players)}/${fmtNum(d.max_players)}`;
        stats[1].textContent = d.map || "Unknown";
        stats[2].textContent = d.mode || "Unknown";
        if (s.joinCode) {
          const join = document.createElement("button");
          join.className = "button button-primary"; join.type = "button"; join.textContent = "COPY JOIN CODE";
          join.addEventListener("click", async () => {
            try { await navigator.clipboard.writeText(String(s.joinCode)); toast("Join code copied."); }
            catch (_) { window.prompt("Copy this in-game join code:", String(s.joinCode)); }
          });
          actions.appendChild(join);
        }
        if (d.stats_url) {
          const link = document.createElement("a"); link.className = "button button-quiet";
          link.href = d.stats_url; link.target = "_blank"; link.rel = "noreferrer"; link.textContent = "SERVER STATS ↗"; actions.appendChild(link);
        }
      } catch (e) {
        card.querySelector(".server-state").className = "server-state unknown";
        card.querySelector(".server-state").innerHTML = "STATUS UNAVAILABLE";
        card.querySelectorAll(".server-stat strong").forEach(el => el.textContent = "—");
        if (s.joinCode) {
          const join = document.createElement("button"); join.className = "button button-primary"; join.type = "button"; join.textContent = "COPY JOIN CODE";
          join.addEventListener("click", async () => { try { await navigator.clipboard.writeText(String(s.joinCode)); toast("Join code copied."); } catch (_) { window.prompt("Copy this in-game join code:", String(s.joinCode)); } });
          actions.appendChild(join);
        }
        const err = document.createElement("span"); err.className = "table-muted"; err.style.fontSize = "10px"; err.textContent = e.message; actions.appendChild(err);
      }
    }));
  }
  function navigate(view) {
    document.querySelectorAll(".view").forEach(el => el.classList.toggle("active", el.id === `view-${view}`));
    document.querySelectorAll(".nav-item").forEach(el => el.classList.toggle("active", el.dataset.nav === view));
    if (view === "servers") loadServers();
    window.scrollTo({top: 0, behavior: "smooth"});
  }
  document.addEventListener("click", (event) => {
    const nav = event.target.closest("[data-nav]");
    if (nav) { navigate(nav.dataset.nav); return; }
    const profile = event.target.closest("[data-profile]");
    if (profile) openPlayer(profile.dataset.profile);
    const sort = event.target.closest("[data-sort]");
    if (sort) {
      state.sort = sort.dataset.sort;
      document.querySelectorAll(".sort-button").forEach(b => b.classList.toggle("active", b.dataset.sort === state.sort));
      fetchLeaderboard(state.sort).then(() => { renderWealth(); }).catch(e => { $("wealth-table").innerHTML = `<tr><td colspan="6" class="empty-state">${esc(e.message)}</td></tr>`; });
    }
  });
  $("player-search").addEventListener("input", renderPlayers);
  $("player-search-form").addEventListener("submit", (e) => { e.preventDefault(); const raw = $("player-search").value.trim(); if (/^\d{17}$/.test(raw)) lookupPlayer(raw); else { $("lookup-message").textContent = "For a direct lookup, enter a 17-digit SteamID64. Name searches filter profiles already loaded."; $("lookup-message").className = "inline-message"; } });
  $("close-player-dialog").addEventListener("click", () => $("player-dialog").close());
  $("refresh-servers").addEventListener("click", loadServers);
  loadAll();
})();
