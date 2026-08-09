/* ============================================================
   CREATEIT — frontend SPA
   Create It. Recreate It. Beat It.
   ============================================================ */

// ---------------- helpers ----------------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function api(path, opts = {}) {
  const o = { headers: {}, ...opts };
  if (o.json !== undefined) { o.headers["Content-Type"] = "application/json"; o.body = JSON.stringify(o.json); delete o.json; }
  const r = await fetch(path, o);
  let data = {};
  try { data = await r.json(); } catch (e) {}
  if (!r.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

function toast(msg, err = false) {
  const t = document.createElement("div");
  t.className = "toast" + (err ? " err" : "");
  t.textContent = msg;
  $("#toast-root").appendChild(t);
  setTimeout(() => t.remove(), 3400);
}

function timeAgo(iso) {
  if (!iso) return "";
  const d = new Date(iso.replace ? iso.replace(" ", "T") : iso);
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
}

const STAGE_META = {
  create_it:       { label: "CREATE IT",       icon: "🎬" },
  recreate_it:     { label: "RECREATE IT",     icon: "🔄" },
  recreate_closed: { label: "RECREATE CLOSED", icon: "🔒" },
  beat_it:         { label: "BEAT IT",         icon: "⚔️" },
  champion:        { label: "CHAMPION",        icon: "👑" },
};
const stagePill = st => `<span class="pill st-${st}">${STAGE_META[st].icon} ${STAGE_META[st].label}</span>`;

function scoreBadge(score) {
  if (score === null || score === undefined) return `<span class="pill-mini pm-dim">AWAITING SCORE</span>`;
  const cls = score > 100 ? "sc-beat" : score === 100 ? "sc-full" : score >= 80 ? "sc-hi" : score >= 50 ? "sc-mid" : "sc-low";
  return `<span class="score-badge ${cls}">${score}<span class="pc">%</span></span>`;
}

function avatar(u, cls = "") {
  return `<span class="avatar ${cls}" style="background:${u.color}22;border-color:${u.color}55">${u.avatar}</span>`;
}

function thumb(v, extra = "") {
  return `<video src="${v.src}#t=0.7" preload="metadata" muted playsinline ${extra}></video>`;
}

let ME = null;
async function refreshMe() {
  try { const d = await api("/api/me"); ME = d.me; } catch (e) { ME = null; }
}

// ---------------- chrome (topbar + navs) ----------------
function renderChrome() {
  const unread = ME?.unread || 0;
  const bell = ME ? `<button class="icon-btn" data-nav="/notifications" title="Notifications">🔔${unread ? `<span class="dot-badge">${unread}</span>` : ""}</button>` : "";
  const userBtn = ME
    ? `<button class="icon-btn" data-nav="/user/${ME.username}" title="Profile" style="width:auto;padding:0 6px;gap:6px;display:flex;align-items:center">${avatar(ME)}</button>
       <button class="icon-btn" id="btn-logout" title="Log out">↩</button>`
    : `<button class="btn btn-fire btn-sm" data-nav="/login" style="border-radius:11px">LOG IN</button>`;
  $("#topbar").innerHTML = `
    <a class="wordmark" data-nav="/" href="#/">CREATE<span class="w-it">IT</span></a>
    <span class="tagline">Create It · Recreate It · Beat It</span>
    <span class="tb-spacer"></span>${bell}${userBtn}`;

  const items = [
    { ico: "🏠", label: "HOME", path: "/" },
    { ico: "🔥", label: "CHALLENGES", path: "/challenges" },
    { ico: "➕", label: "CREATE", path: "/create", special: true },
    { ico: "🏆", label: "RANKS", path: "/leaderboard" },
    { ico: "👤", label: "PROFILE", path: ME ? "/user/" + ME.username : "/login" },
  ];
  const route = location.hash.slice(1).split("?")[0] || "/";
  $("#bottomnav").innerHTML = items.map(it => it.special
    ? `<button class="bn-create" data-nav="${it.path}" title="Create">＋</button>`
    : `<button class="bn-item ${route === it.path || (it.path !== "/" && route.startsWith(it.path)) ? "active" : ""}" data-nav="${it.path}"><span class="ico">${it.ico}</span>${it.label}</button>`
  ).join("");

  const railUser = ME ? `
    <div class="rail-user" data-nav="/user/${ME.username}">${avatar(ME)}
      <div><div class="ru-n">${esc(ME.display_name)}</div><div class="ru-s">@${esc(ME.username)} · ${ME.followers} followers</div></div>
    </div>` : `<button class="rail-item" data-nav="/login"><span class="ico">🔑</span>Log in</button>`;
  const rail = $("#railnav");
  rail.innerHTML = `
    <a class="wordmark" data-nav="/" href="#/">CREATE<span class="w-it">IT</span></a>
    <span class="tagline">Create It · Recreate It · Beat It</span>
    <button class="rail-item ${route === "/" ? "active" : ""}" data-nav="/"><span class="ico">🏠</span>Home</button>
    <button class="rail-item ${route.startsWith("/challenges") ? "active" : ""}" data-nav="/challenges"><span class="ico">🔥</span>Challenges</button>
    <button class="rail-item rail-create" data-nav="/create"><span class="ico">➕</span>Create</button>
    <button class="rail-item ${route.startsWith("/leaderboard") ? "active" : ""}" data-nav="/leaderboard"><span class="ico">🏆</span>Ranks</button>
    <button class="rail-item ${route.startsWith("/notifications") ? "active" : ""}" data-nav="/notifications"><span class="ico">🔔</span>Notifications${unread ? ` <span class="dot-badge" style="position:static;margin-left:4px">${unread}</span>` : ""}</button>
    ${ME?.is_admin ? `<button class="rail-item ${route.startsWith("/admin") ? "active" : ""}" data-nav="/admin"><span class="ico">🛡️</span>Admin</button>` : ""}
    ${railUser}`;
}

document.addEventListener("click", e => {
  if (e.target.id === "btn-logout") {
    api("/api/logout", { method: "POST" }).then(() => { ME = null; toast("Logged out. Come back with something unique."); route(); });
    return;
  }
  // data-act (play video, like…) always wins over an ancestor data-nav
  if (e.target.closest("[data-act]")) return;
  const navEl = e.target.closest("[data-nav]");
  if (navEl) {
    e.preventDefault();
    const path = navEl.dataset.nav;
    if (location.hash.slice(1).split("?")[0] === path) { route(); return; }
    location.hash = path;
  }
});

// ---------------- components ----------------
function challengeCard(c) {
  const pct = c.recreate_target ? Math.min(100, Math.round(c.recreate_count / c.recreate_target * 100)) : 0;
  const barCls = c.stage === "champion" ? "t-gold" : "";
  let foot;
  if (c.stage === "champion") {
    foot = `<button class="btn btn-sm" data-act="watch" data-vid="${c.original_video.id}">▶ WATCH</button>
            <button class="btn btn-sm btn-gold" data-nav="/challenge/${c.id}">👑 RECORD</button>`;
  } else if (c.stage === "beat_it" || c.stage === "recreate_closed") {
    foot = `<button class="btn btn-sm" data-act="watch" data-vid="${c.original_video.id}">▶ WATCH</button>
            <button class="btn btn-sm btn-fire" data-nav="/challenge/${c.id}">⚔️ BEAT IT</button>`;
  } else {
    foot = `<button class="btn btn-sm" data-act="watch" data-vid="${c.original_video.id}">▶ WATCH</button>
            <button class="btn btn-sm btn-teal" data-nav="/create?kind=recreate&challenge=${c.id}">🔄 RECREATE</button>`;
  }
  const days = c.stage === "recreate_it" && c.days_left != null ? `<span>⏳ ${c.days_left}d left</span>` : "";
  return `<div class="ch-card" data-nav="/challenge/${c.id}">
    <div class="ch-thumb">${thumb(c.original_video)}<div class="veil"></div>
      <span class="corner">${stagePill(c.stage)}</span>
      ${c.featured ? `<span class="corner-r"><span class="pill-mini pm-gold">⭐ FEATURED</span></span>` : ""}
    </div>
    <div class="ch-body">
      <span class="ch-code">🏆 ${esc(c.code)}</span>
      <span class="ch-title">${esc(c.title)}</span>
      <span class="ch-by">Created by <b>@${esc(c.creator.username)}</b></span>
      <div class="progress-line"><span><b>${c.recreate_count.toLocaleString()}</b> / ${c.recreate_target.toLocaleString()} recreations</span>${days}</div>
      <div class="progress ${barCls}"><div style="width:${pct}%"></div></div>
      <div class="ch-foot">${foot}</div>
    </div>
  </div>`;
}

function videoCard(v, opts = {}) {
  const ch = v.challenge;
  const kindTag = v.kind === "beatit" ? `<span class="pill-mini pm-fire">⚔️ BEAT IT</span>`
    : v.kind === "creation" ? `<span class="pill-mini pm-violet">🌍 CREATION</span>`
    : `<span class="pill-mini pm-teal">ATTEMPT ${v.attempt_no ? "#" + v.attempt_no : ""}</span>`;
  return `<div class="v-card" data-act="open-video" data-vid="${v.id}">
    <div class="v-thumb">${thumb(v)}<div class="veil"></div>
      <span class="play-tag">${kindTag} ${scoreBadge(v.score)}</span>
      <div class="v-overlay">
        ${ch ? `<span class="chip-link">${esc(ch.code)} · ${esc(ch.title)}</span>` : ""}
        <span class="v-title">${esc(v.title)}</span>
      </div>
    </div>
    <div class="v-foot">${avatar(v.owner, "sm")}
      <span class="who">@${esc(v.owner.username)}</span>
      <span class="stats"><span>❤️ ${v.likes}</span><span>💬 ${v.comments}</span></span>
    </div>
  </div>`;
}

// ---------------- player ----------------
let PLAYER_OPEN = false, PLAYER_VID = null;
async function openPlayer(vid) {
  PLAYER_VID = vid;
  const d = await api(`/api/video/${vid}`);
  const v = d.video;
  const ch = v.challenge;
  const ctx = ch ? `<div class="ctx-card">
      <span class="ctx-code">🏆 ${esc(ch.code)} — ${STAGE_META[ch.stage].icon} ${STAGE_META[ch.stage].label}</span>
      <div class="ctx-title">${esc(ch.title)}</div>
      <div class="ctx-sub">${v.kind === "recreate" ? `Attempt <b>#${v.attempt_no}</b> · ` : v.kind === "beatit" ? "Final submission · " : ""}Score ${v.score != null ? `<b>${v.score}%</b>` : "<b>awaiting evaluation</b>"}</div>
    </div>` : "";
  const canAttempt = ch && (ch.stage === "recreate_it");
  $("#player-root").innerHTML = `
  <div class="player" id="player">
    <button class="icon-btn p-close" data-act="close-player">✕</button>
    <div class="p-wrap">
      <div class="p-video">
        <video src="${v.src}" controls autoplay playsinline></video>
        <div class="p-ctx">${ctx}</div>
      </div>
      <div class="p-side">
        <div class="ps-block">
          <h4>${v.kind === "creation" ? "Creation" : v.kind === "beatit" ? "Beat It submission" : "Recreate attempt"}</h4>
          <div style="font-weight:800;font-size:16px">${esc(v.title)}</div>
          <div style="color:var(--mut);font-size:13px;margin:6px 0 12px">${esc(v.description || "")}</div>
          <div class="user-chip" data-nav="/user/${v.owner.username}">${avatar(v.owner, "sm")} @${esc(v.owner.username)} · ${v.owner.followers} followers</div>
          ${ch ? `<div style="margin-top:10px"><button class="chip" data-nav="/challenge/${ch.id}">View ${esc(ch.code)} →</button></div>` : ""}
        </div>
        <div class="ps-block">
          <div class="p-acts">
            <button class="btn ${v.liked ? "btn-fire" : ""}" data-act="like" data-vid="${v.id}" id="pl-like">❤️ <span>${v.likes}</span></button>
            <button class="btn" data-act="share">🔗 SHARE</button>
          </div>
          ${canAttempt ? `<button class="btn btn-teal btn-block" style="margin-top:9px" data-nav="/create?kind=recreate&challenge=${ch.id}">🔄 RECREATE THIS CHALLENGE</button>` : ""}
        </div>
        <div class="ps-block">
          <h4>Comments (${d.comments.length})</h4>
          <div id="pl-comments">${d.comments.map(c => `
            <div class="c-row">${`<span class="avatar sm" style="background:var(--surface3)">💬</span>`}
              <div class="c-body"><b>@${esc(c.username)}</b><span class="t">${timeAgo(c.created_at)}</span><br>${esc(c.text)}</div>
            </div>`).join("") || `<div class="empty" style="padding:18px">No comments yet. Say something.</div>`}
          </div>
          <div class="c-input">
            <input class="input" id="pl-comment-input" placeholder="${ME ? "Add a comment…" : "Log in to comment"}" ${ME ? "" : "disabled"}>
            <button class="btn btn-sm btn-fire" data-act="send-comment" data-vid="${v.id}" ${ME ? "" : "disabled"}>SEND</button>
          </div>
        </div>
      </div>
    </div>
  </div>`;
  PLAYER_OPEN = true;
  document.body.style.overflow = "hidden";
}
function closePlayer() {
  $("#player-root").innerHTML = "";
  PLAYER_OPEN = false;
  document.body.style.overflow = "";
  if ((location.hash || "").startsWith("#/video/")) location.hash = "/";
}

document.addEventListener("click", async e => {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  const act = el.dataset.act;
  const vid = el.dataset.vid;
  try {
    if (act === "watch" || act === "open-video") { e.stopPropagation(); openPlayer(vid); }
    else if (act === "close-player") closePlayer();
    else if (act === "share") { try { await navigator.clipboard.writeText(location.origin + "/#/video/" + PLAYER_VID); } catch (err) {} toast("🔗 Link copied — share the journey."); }
    else if (act === "like") {
      if (!ME) { location.hash = "/login"; return; }
      const d = await api(`/api/video/${vid}/like`, { method: "POST" });
      el.classList.toggle("btn-fire", d.liked);
      el.querySelector("span").textContent = d.likes;
    }
    else if (act === "send-comment") {
      const inp = $("#pl-comment-input");
      const text = inp.value.trim();
      if (!text) return;
      await api(`/api/video/${vid}/comment`, { method: "POST", json: { text } });
      inp.value = "";
      openPlayer(vid);
    }
  } catch (err) { toast(err.message, true); }
});
document.addEventListener("keydown", e => { if (e.key === "Escape" && PLAYER_OPEN) closePlayer(); });

// ---------------- views ----------------
async function viewHome() {
  const d = await api("/api/home");
  const h = d.hero;
  return `
  <div class="loop-strip">
    <span class="loop-step c">CREATE IT</span><span class="loop-arrow">→</span>
    <span class="loop-step r">RECREATE IT</span><span class="loop-arrow">→</span>
    <span class="loop-step b">BEAT IT</span>
    <span class="loop-cap">What can you do that is uniquely yours? Followers don't matter here — the challenge does.</span>
  </div>
  ${h ? `
  <div class="sec"><h2>🏆 CREATEIT OF THE WEEK</h2><span class="sub">the benchmark everyone is chasing</span></div>
  <div class="hero">
    ${h.featured ? `<div class="week-ribbon"><span class="wr-1">⭐ CREATEIT CREATOR OF THE WEEK</span><span class="wr-2">@${esc(h.creator.username)}</span></div>` : ""}
    <div class="hero-media" data-act="watch" data-vid="${h.original_video.id}" style="cursor:pointer">${thumb(h.original_video)}</div>
    <div class="hero-body">
      <span class="hero-code">🏆 ${esc(h.code)}</span>
      <div class="hero-title">${esc(h.title)}</div>
      <div style="color:var(--mut);font-size:14px;max-width:640px">${esc(h.description)}</div>
      <div class="hero-meta">
        ${stagePill(h.stage)}
        <span>Creator <b>@${esc(h.creator.username)}</b></span>
        <span>👥 <b>${h.participants}</b> participants</span>
        <span>🎯 <b>${h.recreate_count.toLocaleString()}</b> / ${h.recreate_target.toLocaleString()} recreations</span>
        ${h.stage === "recreate_it" && h.days_left != null ? `<span>⏳ <b>${h.days_left}</b> days left</span>` : ""}
      </div>
      <div class="progress" style="max-width:520px"><div style="width:${Math.min(100, Math.round(h.recreate_count / h.recreate_target * 100))}%"></div></div>
      <div class="hero-cta" style="margin-top:14px">
        <button class="btn btn-fire" data-act="watch" data-vid="${h.original_video.id}">▶ WATCH THE ORIGINAL</button>
        ${h.stage === "recreate_it" ? `<button class="btn btn-teal" data-nav="/create?kind=recreate&challenge=${h.id}">🔄 RECREATE IT</button>` : ""}
        <button class="btn btn-ghost" data-nav="/challenge/${h.id}">CHALLENGE PAGE →</button>
      </div>
    </div>
  </div>` : `<div class="empty">No live challenges yet. Be the first to CREATE IT.</div>`}

  <div class="sec"><h2>🔥 LIVE CHALLENGES</h2><span class="sub">in the RECREATE IT stage</span><a class="more" href="#/challenges">See all →</a></div>
  ${d.live.length ? `<div class="hscroll">${d.live.map(challengeCard).join("")}</div>` : `<div class="empty">Nothing live right now.</div>`}

  <div class="sec"><h2>⚔️ BEAT IT</h2><span class="sub">one final submission. surpass the original.</span></div>
  ${d.beat.length ? `<div class="hscroll">${d.beat.map(challengeCard).join("")}</div>` : `<div class="empty">No challenges in Beat It right now — recreate something first.</div>`}

  <div class="sec"><h2>🔥 TRENDING ATTEMPTS</h2><span class="sub">the highest-scored recreations on the platform</span></div>
  ${d.trending.length ? `<div class="grid3">${d.trending.map(v => videoCard(v)).join("")}</div>` : ""}

  <div class="sec"><h2>🌍 DISCOVER</h2><span class="sub">exceptional creations — tomorrow's challenges</span></div>
  ${d.discover.length ? `<div class="grid3">${d.discover.map(v => videoCard(v)).join("")}</div>`
    : `<div class="empty">Scouts are watching. Upload something uniquely yours → <a href="#/create" style="color:var(--fire2);font-weight:700">CREATE IT</a></div>`}

  <div class="sec"><h2>👑 CHAMPIONS</h2><a class="more" href="#/leaderboard">Records →</a></div>
  ${d.champions.length ? `<div class="hscroll">${d.champions.map(challengeCard).join("")}</div>` : ""}

  <div class="quote">“Maybe I don't have millions of followers. Maybe I'm not famous.<br>But I have something that is <em>uniquely mine</em>.”</div>`;
}

async function viewChallenges(query) {
  const stage = query.get("stage") || "";
  const d = await api("/api/challenges" + (stage ? `?stage=${stage}` : ""));
  const tabs = [["", "ALL"], ["recreate_it", "🔄 RECREATE"], ["beat_it", "⚔️ BEAT IT"], ["recreate_closed", "🔒 CLOSED"], ["champion", "👑 CHAMPIONS"]];
  return `
  <div class="page-head"><span class="crumb">CHALLENGES</span>
    <h1 class="big-title">THE ARENA</h1>
    <div class="meta-row">Every challenge starts with one person's unique creation. Pick one. Attempt it. Beat it.</div>
  </div>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px">
    ${tabs.map(([k, l]) => `<button class="chip ${stage === k ? "active" : ""}" data-nav="/challenges${k ? "?stage=" + k : ""}">${l}</button>`).join("")}
  </div>
  ${d.challenges.length ? `<div class="hscroll" style="flex-wrap:wrap">${d.challenges.map(challengeCard).join("")}</div>` : `<div class="empty">No challenges in this stage.</div>`}`;
}

function stageTrack(stage) {
  const steps = [
    ["create_it", "CREATE IT", "🎬"], ["recreate_it", "RECREATE IT", "🔄"], ["recreate_closed", "CLOSED", "🔒"],
    ["beat_it", "BEAT IT", "⚔️"], ["champion", "CHAMPION", "👑"], ["record", "RECORD", "📜"],
  ];
  const idx = stage === "champion" ? 4 : steps.findIndex(s => s[0] === stage);
  return `<div class="stage-track">${steps.map((s, i) => {
    const cls = i < idx ? "done" : i === idx ? "now" : "";
    const join = i < steps.length - 1 ? `<div class="st-join ${i < idx ? "done" : ""}"></div>` : "";
    return `<div class="st-step ${cls}"><span class="n">${i < idx ? "✓" : s[2]}</span><span class="l">${s[1]}</span></div>${join}`;
  }).join("")}</div>`;
}

async function viewChallenge(id) {
  const d = await api(`/api/challenge/${id}`);
  const c = d.challenge, m = c.mine;
  let cta = "";
  if (c.stage === "recreate_it") {
    cta = ME ? `<button class="btn btn-teal" data-nav="/create?kind=recreate&challenge=${c.id}">🔄 RECREATE IT</button>`
             : `<button class="btn btn-teal" data-nav="/login">LOG IN TO ATTEMPT</button>`;
  } else if ((c.stage === "beat_it" || c.stage === "recreate_closed")) {
    if (!ME) cta = `<button class="btn btn-fire" data-nav="/login">LOG IN</button>`;
    else if (m?.beatit_submitted) cta = `<button class="btn" disabled>⚔️ FINAL SUBMISSION SENT</button>`;
    else if (m?.can_beatit) cta = `<button class="btn btn-fire" data-nav="/create?kind=beatit&challenge=${c.id}">⚔️ USE MY FINAL SUBMISSION</button>`;
    else if (!m?.qualified) cta = `<button class="btn" disabled title="Reach 100% in Recreate It first">🔒 QUALIFY AT 100% FIRST</button>`;
  }
  const champ = c.champion;
  return `
  <div class="page-head">
    <span class="crumb">🏆 <b>${esc(c.code)}</b></span>
    <h1 class="big-title">${esc(c.title)}</h1>
    <div class="meta-row">${stagePill(c.stage)}
      <span class="user-chip" data-nav="/user/${c.creator.username}">${avatar(c.creator, "sm")} <b>@${esc(c.creator.username)}</b> · original creator</span>
      ${c.stage === "recreate_it" && c.days_left != null ? `<span>⏳ ${c.days_left} days left</span>` : ""}
    </div>
  </div>
  ${stageTrack(c.stage)}
  ${champ ? `
  <div class="champ-banner">
    <span class="crown">👑</span>
    <div style="flex:1;min-width:180px">
      <h3>CHAMPION — @${esc(champ.user.username)}</h3>
      <p>Final Beat It score: <b style="color:var(--gold)">${champ.score}%</b> · crowned ${timeAgo(champ.at)} · unbeaten for ${champ.unbeaten_days} day${champ.unbeaten_days === 1 ? "" : "s"}. Records exist to be broken.</p>
    </div>
    <button class="btn btn-gold" data-act="watch" data-vid="${champ.video_id}">▶ WATCH THE WIN</button>
  </div>` : ""}
  <div class="bench">
    <div class="b-thumb" data-act="watch" data-vid="${c.original_video.id}">${thumb(c.original_video)}</div>
    <div style="flex:1;min-width:200px">
      <span class="pill-mini pm-violet">THE BENCHMARK</span>
      <h3>THE ORIGINAL CREATION</h3>
      <p>${esc(c.description || "Recreate this creation exactly as it was performed.")}</p>
      <p style="margin-top:8px;color:var(--text);font-size:13px">🎯 <b>${c.recreate_count.toLocaleString()}</b> / ${c.recreate_target.toLocaleString()} recreations · ${c.participants} participants · ${c.qualified} qualified for Beat It</p>
      <div class="progress t-teal" style="max-width:380px;margin-top:10px"><div style="width:${Math.min(100, Math.round(c.recreate_count / c.recreate_target * 100))}%"></div></div>
    </div>
    <div style="display:flex;flex-direction:column;gap:9px">
      <button class="btn btn-fire" data-act="watch" data-vid="${c.original_video.id}">▶ WATCH</button>${cta}
    </div>
  </div>
  ${m && m.attempts ? `<div class="adm-card" style="margin-top:14px"><h3>MY STATUS IN THIS CHALLENGE</h3>
    <div class="meta-row">${scoreBadge(m.best)} <span>${m.attempts} attempt${m.attempts === 1 ? "" : "s"}</span>
    ${m.qualified ? `<span class="pill-mini pm-teal">✓ QUALIFIED FOR BEAT IT</span>` : ""}
    ${m.beatit_submitted ? `<span class="pill-mini pm-fire">⚔️ FINAL SUBMISSION IN</span>` : ""}</div></div>` : ""}
  <div class="sec"><h2>🥇 TOP PARTICIPANTS</h2><span class="sub">best recreate score per person</span></div>
  ${d.leaderboard.length ? d.leaderboard.map((b, i) => `
    <div class="board-row"><span class="rank">${i + 1}</span>${avatar(b.user, "sm")}
      <div class="mid"><div class="t" data-nav="/user/${b.user.username}" style="cursor:pointer">@${esc(b.user.username)} · ${esc(b.user.display_name)}</div>
      <div class="s">${b.attempts} attempt${b.attempts === 1 ? "" : "s"} ${b.qualified ? "· ✓ Beat It qualified" : ""}</div></div>
      ${scoreBadge(b.best)}
    </div>`).join("") : `<div class="empty">No attempts yet. The arena is open.</div>`}
  ${c.stage !== "champion" && d.beatits.length ? `
  <div class="sec"><h2>⚔️ BEAT IT SUBMISSIONS</h2><span class="sub">one final shot each</span></div>
  <div class="grid3">${d.beatits.map(v => videoCard(v)).join("")}</div>` : ""}
  <div class="sec"><h2>🔥 RECENT ATTEMPTS</h2></div>
  ${d.attempts.length ? `<div class="grid3">${d.attempts.map(v => videoCard(v)).join("")}</div>` : `<div class="empty">Nobody has attempted yet. Be first.</div>`}`;
}

async function viewCreate(query) {
  if (!ME) return viewAuth("login", "Log in to create. You don't need followers — you need something uniquely yours.");
  const kind = query.get("kind") || "";
  const chId = query.get("challenge");
  const chD = await api("/api/challenges?stage=recreate_it");
  const live = chD.challenges;

  if (!kind) return `
  <div class="page-head"><span class="crumb">CREATE</span><h1 class="big-title">MAKE YOUR MOVE</h1>
  <div class="meta-row">The three-stage philosophy, in one place.</div></div>
  <div class="grid3" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">
    <div class="v-card" data-nav="/create?kind=creation" style="cursor:pointer"><div class="v-thumb" style="aspect-ratio:4/3;background:linear-gradient(140deg,#3d2b7a,#141b34)">
      <div class="v-overlay" style="position:absolute;inset:auto 0 0 0;padding:16px"><span class="pill-mini pm-violet">STAGE 1</span><div class="v-title" style="font-family:var(--display);font-size:20px;letter-spacing:1px">🎬 CREATE SOMETHING</div></div></div>
      <div class="v-foot" style="display:block;color:var(--mut);font-size:13px">Submit your own unique creation. If CreateIt believes it's special enough, it becomes a challenge — and you become the benchmark.</div></div>
    <div class="v-card" data-nav="/create?kind=recreate" style="cursor:pointer"><div class="v-thumb" style="aspect-ratio:4/3;background:linear-gradient(140deg,#0d5c4b,#0f2038)">
      <div class="v-overlay" style="position:absolute;inset:auto 0 0 0;padding:16px"><span class="pill-mini pm-teal">STAGE 2</span><div class="v-title" style="font-family:var(--display);font-size:20px;letter-spacing:1px">🔄 RECREATE</div></div></div>
      <div class="v-foot" style="display:block;color:var(--mut);font-size:13px">Choose an active challenge and attempt it. Unlimited tries. Every attempt becomes part of your journey.</div></div>
    <div class="v-card" data-nav="/create?kind=beatit" style="cursor:pointer"><div class="v-thumb" style="aspect-ratio:4/3;background:linear-gradient(140deg,#7a2410,#341420)">
      <div class="v-overlay" style="position:absolute;inset:auto 0 0 0;padding:16px"><span class="pill-mini pm-fire">STAGE 3</span><div class="v-title" style="font-family:var(--display);font-size:20px;letter-spacing:1px">⚔️ BEAT IT</div></div></div>
      <div class="v-foot" style="display:block;color:var(--mut);font-size:13px">Qualified only. ONE final submission to prove you can surpass the original. No retakes. No luck runs.</div></div>
  </div>`;

  const form = (extra) => `
  <div class="adm-card" style="max-width:560px">
    <div class="field"><label>VIDEO FILE *</label>
      <input type="file" id="up-file" accept="video/mp4,video/webm,video/quicktime,.mkv" class="input">
      <div class="hint">mp4 / webm / mov · up to 256 MB · film the full attempt in one take when possible</div>
      <video id="up-preview" style="display:none;margin-top:10px;max-height:300px;border-radius:12px" controls muted playsinline></video>
    </div>
    <div class="field"><label>TITLE</label><input class="input" id="up-title" maxlength="120" placeholder="${kind === "creation" ? "e.g. The Impossible Trick" : "e.g. Attempt #4"}"></div>
    <div class="field"><label>DESCRIPTION</label><textarea class="input" id="up-desc" maxlength="400" placeholder="What makes this special?"></textarea></div>
    ${extra}
    <button class="btn btn-fire btn-block" id="up-submit">${kind === "creation" ? "🎬 SUBMIT FOR REVIEW" : kind === "recreate" ? "🔄 SUBMIT ATTEMPT" : "⚔️ LOCK IN FINAL SUBMISSION"}</button>
  </div>`;

  let extra = "";
  if (kind === "recreate") {
    if (!live.length) return `<div class="empty">No challenges are in the RECREATE IT stage right now.<br><br><button class="btn btn-fire" data-nav="/challenges">BROWSE CHALLENGES</button></div>`;
    extra = `<div class="field"><label>CHALLENGE</label><select class="input" id="up-challenge">
      ${live.map(c => `<option value="${c.id}" ${c.id == chId ? "selected" : ""}>${esc(c.code)} — ${esc(c.title)}</option>`).join("")}</select></div>`;
  } else if (kind === "beatit") {
    extra = `<div class="field"><label>CHALLENGE</label><select class="input" id="up-challenge"><option value="">Loading your eligible challenges…</option></select></div>
      <div class="hint" style="margin:-6px 0 14px">⚠️ ONE FINAL SUBMISSION per challenge. It cannot be replaced.</div>`;
  } else {
    extra = `<label class="check" style="margin-bottom:14px"><input type="checkbox" id="up-nominate" checked>
      <span><b>Nominate for CREATE IT</b><br><span style="color:var(--mut);font-size:12.5px">Tell CreateIt: “this is something people should try to beat.” A person with 50 followers can start the next big challenge.</span></span></label>`;
  }

  setTimeout(async () => {
    const fileInp = $("#up-file");
    fileInp.addEventListener("change", () => {
      const f = fileInp.files[0];
      const pv = $("#up-preview");
      if (f) { pv.src = URL.createObjectURL(f); pv.style.display = "block"; } else pv.style.display = "none";
    });
    if (kind === "beatit") {
      const sel = $("#up-challenge");
      try {
        const me = await api(`/api/user/${ME.username}`);
        const elig = me.journeys.filter(j => j.completed && ["recreate_closed", "beat_it"].includes(j.challenge.stage) && !j.beatit);
        sel.innerHTML = elig.length
          ? elig.map(j => `<option value="${j.challenge.id}" ${j.challenge.id == chId ? "selected" : ""}>${esc(j.challenge.code)} — ${esc(j.challenge.title)}</option>`).join("")
          : `<option value="">You're not eligible yet — reach 100% in a challenge that has entered Beat It.</option>`;
      } catch (e) { sel.innerHTML = `<option value="">Could not load challenges</option>`; }
    }
    $("#up-submit").addEventListener("click", async () => {
      const f = fileInp.files[0];
      if (!f) return toast("Pick a video file first.", true);
      const fd = new FormData();
      fd.append("file", f);
      fd.append("kind", kind);
      fd.append("title", $("#up-title").value);
      fd.append("description", $("#up-desc").value);
      if (kind !== "creation") {
        const cid = $("#up-challenge").value;
        if (!cid) return toast("Pick a challenge.", true);
        fd.append("challenge_id", cid);
      } else if ($("#up-nominate")?.checked) fd.append("nominated", "1");
      const btn = $("#up-submit"); btn.disabled = true; btn.textContent = "UPLOADING…";
      try {
        const d = await api("/api/upload", { method: "POST", body: fd });
        toast(d.message);
        location.hash = kind === "creation" ? "/" : `/video/${d.video_id}`;
      } catch (err) { toast(err.message, true); btn.disabled = false; btn.textContent = "TRY AGAIN"; }
    });
  }, 0);

  const back = `<button class="chip" data-nav="/create" style="margin-bottom:14px">← Back to options</button>`;
  const heads = {
    creation: ["🎬 CREATE SOMETHING", "Submit your own unique creation for CreateIt review."],
    recreate: ["🔄 RECREATE", "Attempt an active challenge. Every attempt joins your journey."],
    beatit: ["⚔️ BEAT IT", "Your one final submission. Surpass the original."],
  };
  return `${back}<div class="page-head"><h1 class="big-title" style="font-size:30px">${heads[kind][0]}</h1><div class="meta-row">${heads[kind][1]}</div></div>${form(extra)}`;
}

async function viewLeaderboard() {
  const d = await api("/api/leaderboard");
  return `
  <div class="page-head"><span class="crumb">RANKS</span><h1 class="big-title">LEADERBOARD</h1>
  <div class="meta-row">Performance over popularity. A 200-follower account can sit above 2 million.</div></div>
  <div class="sec" style="margin-top:6px"><h2>🎯 TOP PARTICIPANTS</h2><span class="sub">best recreate score, all challenges</span></div>
  ${d.top.map((t, i) => `
    <div class="board-row"><span class="rank">${i + 1}</span>${avatar(t.user, "sm")}
      <div class="mid"><div class="t" data-nav="/user/${t.user.username}" style="cursor:pointer">@${esc(t.user.username)} · ${esc(t.user.display_name)}</div>
      <div class="s">${t.attempts} total attempts · best on ${t.challenge_code ? `<a href="#/challenge/${t.challenge_id}" style="color:var(--ice)">${esc(t.challenge_code)}</a>` : "—"}</div></div>
      ${scoreBadge(t.best)}
    </div>`).join("") || `<div class="empty">No scored attempts yet.</div>`}
  <div class="sec"><h2>👑 PAST CHAMPIONS</h2><span class="sub">permanently linked to their challenges</span></div>
  ${d.champions.map(c => `
    <div class="board-row"><span class="rank">👑</span>${avatar(c.champion, "sm")}
      <div class="mid"><div class="t">@${esc(c.champion.username)}</div><div class="s">${esc(c.challenge.code)} — ${esc(c.challenge.title)} · crowned ${timeAgo(c.at)}</div></div>
      ${scoreBadge(c.score)} <button class="btn btn-sm" data-nav="/challenge/${c.challenge.id}">VIEW</button>
    </div>`).join("") || `<div class="empty">No champions crowned yet.</div>`}
  <div class="sec"><h2>📜 RECORDS</h2><span class="sub">unbeaten marks. come break them.</span></div>
  <div class="grid3" style="grid-template-columns:repeat(auto-fill,minmax(230px,1fr))">
  ${d.records.map(r => `<div class="records-card">
      <span class="rc-code">🏆 ${esc(r.challenge.code)}</span>
      <div style="font-family:var(--display);letter-spacing:1px;font-size:17px">${esc(r.challenge.title)}</div>
      <div class="meta-row" style="font-size:12.5px">${avatar(r.holder, "sm")} @${esc(r.holder.username)}</div>
      <div style="display:flex;align-items:center;gap:10px">${scoreBadge(r.score)}<span style="color:var(--mut);font-size:12px">unbeaten for ${r.unbeaten_days} day${r.unbeaten_days === 1 ? "" : "s"}</span></div>
      <button class="btn btn-sm btn-ghost" data-nav="/challenge/${r.challenge.id}" style="align-self:flex-start">VIEW CHALLENGE →</button>
    </div>`).join("") || `<div class="empty">No records set yet.</div>`}
  </div>`;
}

async function viewProfile(username) {
  const d = await api(`/api/user/${username}`);
  const u = d.user, s = d.stats;
  const followBtn = ME && ME.username !== u.username
    ? `<button class="btn btn-sm ${u.i_follow ? "" : "btn-fire"}" id="btn-follow">${u.i_follow ? "✓ FOLLOWING" : "➕ FOLLOW"}</button>` : "";
  setTimeout(() => {
    $("#btn-follow")?.addEventListener("click", async e => {
      try {
        const r = await api(`/api/user/${u.username}/follow`, { method: "POST" });
        e.target.textContent = r.following ? "✓ FOLLOWING" : "➕ FOLLOW";
        e.target.classList.toggle("btn-fire", !r.following);
      } catch (err) { toast(err.message, true); if (err.message === "Login required") location.hash = "/login"; }
    });
  }, 0);
  return `
  <div class="prof-head">
    ${avatar(u, "lg")}
    <div class="prof-id"><h1>${esc(u.display_name)}</h1><div class="un">@${esc(u.username)} ${u.is_admin ? '· <span class="pill-mini pm-gold">CREATEIT TEAM</span>' : ""}</div>
      <div style="color:var(--mut);font-size:13.5px;margin-top:4px">${esc(u.bio || "No bio yet — too busy practicing.")}</div></div>
    <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end">${followBtn}
      <div style="color:var(--mut);font-size:13px"><b style="color:var(--text)">${u.followers}</b> followers · <b style="color:var(--text)">${u.following}</b> following</div></div>
  </div>
  <div class="stat-strip">
    <div class="stat-box gold"><div class="v">${s.champion}</div><div class="k">🏆 Champion</div></div>
    <div class="stat-box teal"><div class="v">${s.completed}</div><div class="k">🔥 Challenges completed</div></div>
    <div class="stat-box fire"><div class="v">${s.beatit}</div><div class="k">⚔️ Beat It entries</div></div>
    <div class="stat-box violet"><div class="v">${s.attempts}</div><div class="k">🎯 Total attempts</div></div>
  </div>
  ${d.champion_of.length ? `<div class="sec" style="margin-top:10px"><h2>👑 CHAMPION OF</h2></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">${d.champion_of.map(c => `<button class="chip" data-nav="/challenge/${c.id}">👑 ${esc(c.code)} · ${c.score}%</button>`).join("")}</div>` : ""}
  <div class="sec"><h2>🧭 MY JOURNEYS</h2><span class="sub">failure and practice are part of the entertainment</span></div>
  ${d.journeys.length ? d.journeys.map(j => {
    const max = Math.max(100, ...j.attempts.map(a => a.score || 0), j.beatit?.score || 0);
    return `<div class="journey">
      <div class="j-head"><h3 data-nav="/challenge/${j.challenge.id}" style="cursor:pointer">${esc(j.challenge.code)} — ${esc(j.challenge.title)}</h3>
        ${stagePill(j.challenge.stage)} ${j.won ? `<span class="pill-mini pm-gold">👑 CHAMPION</span>` : j.completed ? `<span class="pill-mini pm-teal">✓ COMPLETED</span>` : ""}
      </div>
      <div class="j-dots">${j.attempts.map(a => `
        <div class="j-dot ${a.score >= 100 ? "hit" : ""}" data-act="open-video" data-vid="${a.id}" style="cursor:pointer" title="Attempt #${a.attempt_no} — ${a.score ?? "awaiting"}%">
          <div class="bar" style="height:${Math.max(7, (a.score || 3) / max * 56)}px"></div>
          <span class="lb">#${a.attempt_no}<br>${a.score != null ? a.score + "%" : "…"}</span>
        </div>`).join("")}
        ${j.beatit ? `<div class="j-dot beat" data-act="open-video" data-vid="${j.beatit.id}" style="cursor:pointer" title="Beat It — ${j.beatit.score}%">
          <div class="bar" style="height:${Math.max(7, (j.beatit.score || 3) / max * 56)}px"></div><span class="lb">⚔️<br>${j.beatit.score}%</span></div>` : ""}
      </div>
      <div class="j-msg">${j.attempts.length} attempt${j.attempts.length === 1 ? "" : "s"} logged — ${j.won ? "and it ended with a crown." : j.completed ? "recreate complete. Beat It awaits." : "the story is still being written."}</div>
    </div>`;
  }).join("") : `<div class="empty">No journeys yet. Every legend starts at attempt #1.</div>`}
  <div class="sec"><h2>🎬 CREATIONS</h2></div>
  ${d.creations.length ? `<div class="grid3">${d.creations.map(v => videoCard(v)).join("")}</div>` : `<div class="empty">No creations yet.</div>`}`;
}

async function viewNotifications() {
  if (!ME) return viewAuth("login", "Log in to see your notifications.");
  const d = await api("/api/notifications");
  api("/api/notifications/read", { method: "POST" }).then(refreshMe).then(renderChrome);
  const icons = { like: "❤️", comment: "💬", follow: "➕", score: "🎯", review: "📥", challenge: "🏆", stage: "⚔️", champion: "👑", featured: "🌟", welcome: "👋" };
  return `
  <div class="page-head"><span class="crumb">INBOX</span><h1 class="big-title">NOTIFICATIONS</h1></div>
  ${d.notifications.length ? d.notifications.map(n => `
    <div class="notif ${n.read ? "" : "unread"}" data-nav="${n.link || "/"}">
      <span class="n-ico">${icons[n.kind] || "🔔"}</span>
      <span class="n-text">${esc(n.text)}</span>
      <span class="n-time">${timeAgo(n.created_at)}</span>
    </div>`).join("") : `<div class="empty">Nothing yet. Go make some noise.</div>`}`;
}

// ---------------- auth ----------------
function viewAuth(mode, note) {
  setTimeout(() => {
    const tabL = $("#tab-login"), tabR = $("#tab-reg");
    const setMode = m => {
      $("#auth-title").textContent = m === "login" ? "WELCOME BACK" : "JOIN THE ARENA";
      $("#reg-name-field").style.display = m === "login" ? "none" : "block";
      $("#auth-btn").textContent = m === "login" ? "LOG IN" : "CREATE ACCOUNT";
      tabL.classList.toggle("active", m === "login"); tabR.classList.toggle("active", m !== "login");
      tabL.onclick = () => setMode("login"); tabR.onclick = () => setMode("register");
      $("#auth-btn").onclick = async () => {
        const body = { username: $("#auth-user").value.trim(), password: $("#auth-pass").value };
        if (m === "register") body.display_name = $("#auth-name").value.trim();
        try {
          const d = await api(m === "login" ? "/api/login" : "/api/register", { method: "POST", json: body });
          ME = d.me; toast(m === "login" ? `Welcome back, @${ME.username}.` : `Welcome to CreateIt, @${ME.username}. Bring something unique.`);
          location.hash = "/";
        } catch (err) { toast(err.message, true); }
      };
    };
    setMode(mode === "register" ? "register" : "login");
    $$(".demo-chips .chip").forEach(ch => ch.onclick = () => {
      $("#auth-user").value = ch.dataset.u; $("#auth-pass").value = ch.dataset.p; setMode("login"); toast("Demo credentials filled — hit LOG IN.");
    });
  }, 0);
  return `
  <div class="auth-wrap">
    <div class="auth-card">
      <div class="auth-brand"><div class="wordmark">CREATE<span class="w-it">IT</span></div><p>Create It · Recreate It · Beat It</p></div>
      ${note ? `<div class="empty" style="margin-bottom:16px;padding:16px">${esc(note)}</div>` : ""}
      <div class="m-tabs"><button class="chip active" id="tab-login">Log in</button><button class="chip" id="tab-reg">Register</button></div>
      <h2 id="auth-title" style="font-family:var(--display);letter-spacing:1.4px;margin-bottom:14px">WELCOME BACK</h2>
      <div class="field" id="reg-name-field" style="display:none"><label>DISPLAY NAME</label><input class="input" id="auth-name" placeholder="How the arena should call you"></div>
      <div class="field"><label>USERNAME</label><input class="input" id="auth-user" autocomplete="username" placeholder="e.g. sarah"></div>
      <div class="field"><label>PASSWORD</label><input class="input" id="auth-pass" type="password" autocomplete="current-password" placeholder="••••••••"></div>
      <button class="btn btn-fire btn-block" id="auth-btn">LOG IN</button>
      <div class="demo-accounts"><h5>Demo accounts (password shown)</h5>
        <div class="demo-chips">
          <button class="chip" data-u="admin" data-p="admin123">🛡️ admin · admin123</button>
          <button class="chip" data-u="sarah" data-p="demo1234">🦋 sarah · demo1234</button>
          <button class="chip" data-u="david" data-p="demo1234">🚀 david · demo1234</button>
          <button class="chip" data-u="zoe" data-p="demo1234">🌙 zoe · demo1234</button>
          <button class="chip" data-u="nina" data-p="demo1234">🌶️ nina · demo1234</button>
        </div>
      </div>
    </div>
  </div>`;
}

// ---------------- admin ----------------
async function viewAdmin() {
  if (!ME?.is_admin) return `<div class="empty">🛡️ Admins only.</div>`;
  const [q1d, chd, ud] = await Promise.all([api("/api/admin/queue"), api("/api/admin/challenges"), api("/api/admin/users")]);
  const stages = ["create_it", "recreate_it", "recreate_closed", "beat_it", "champion"];
  setTimeout(() => {
    // review actions
    $$("[data-review]").forEach(b => b.onclick = async () => {
      const id = b.dataset.review, act = b.dataset.reviewAct;
      const payload = { video_id: +id, action: act };
      if (act === "approve" && b.dataset.challenge === "1") {
        payload.make_challenge = true;
        payload.title = $(`#ch-title-${id}`).value;
        payload.target = $(`#ch-target-${id}`).value;
        payload.featured = $(`#ch-featured-${id}`).checked ? 1 : 0;
      }
      try { await api("/api/admin/review", { method: "POST", json: payload }); toast(act === "reject" ? "Submission rejected." : "Approved."); route(); refreshMe().then(renderChrome); }
      catch (e) { toast(e.message, true); }
    });
    $$("[data-mkch]").forEach(b => b.onclick = () => {
      const panel = $(`#mkch-${b.dataset.mkch}`);
      panel.style.display = panel.style.display === "none" ? "block" : "none";
    });
    // scoring
    $$("[data-score]").forEach(b => b.onclick = async () => {
      const id = b.dataset.score;
      const score = $(`#score-${id}`).value;
      try { await api("/api/admin/score", { method: "POST", json: { video_id: +id, score: +score } }); toast(`Scored ${score}%. Owner notified.`); route(); }
      catch (e) { toast(e.message, true); }
    });
    // stage / target / featured / crown
    $$("[data-stage]").forEach(sel => sel.onchange = async () => {
      try { await api("/api/admin/stage", { method: "POST", json: { challenge_id: +sel.dataset.stage, stage: sel.value } }); toast("Stage updated."); route(); } catch (e) { toast(e.message, true); }
    });
    $$("[data-target]").forEach(inp => inp.onchange = async () => {
      try { await api("/api/admin/stage", { method: "POST", json: { challenge_id: +inp.dataset.target, recreate_target: +inp.value } }); toast("Target updated."); } catch (e) { toast(e.message, true); }
    });
    $$("[data-feature]").forEach(b => b.onclick = async () => {
      try { await api("/api/admin/featured", { method: "POST", json: { challenge_id: +b.dataset.feature } }); toast("⭐ Now the Creator of the Week feature."); route(); } catch (e) { toast(e.message, true); }
    });
    $$("[data-crown]").forEach(b => b.onclick = async () => {
      try { await api("/api/admin/crown", { method: "POST", json: { challenge_id: +b.dataset.crown, video_id: +b.dataset.vid } }); toast("👑 Champion crowned. History written."); route(); } catch (e) { toast(e.message, true); }
    });
  }, 0);

  return `
  <div class="page-head"><span class="crumb">🛡️ CONTROL ROOM</span><h1 class="big-title">ADMIN</h1>
  <div class="meta-row">V1 relies on human evaluation. You are the judge, scout and historian.</div></div>
  <div class="adm-stats">
    <div class="stat-box"><div class="v">${q1d.stats.users}</div><div class="k">Users</div></div>
    <div class="stat-box"><div class="v">${q1d.stats.videos}</div><div class="k">Videos</div></div>
    <div class="stat-box"><div class="v">${q1d.stats.challenges}</div><div class="k">Challenges</div></div>
    <div class="stat-box fire"><div class="v">${q1d.stats.pending}</div><div class="k">Pending review</div></div>
    <div class="stat-box teal"><div class="v">${q1d.stats.unscored}</div><div class="k">Awaiting score</div></div>
  </div>

  <div class="adm-card"><h3>📥 SUBMISSION REVIEW — Create It candidates</h3>
    ${q1d.pending.length ? q1d.pending.map(v => `
    <div class="adm-row">
      <video src="${v.src}#t=0.7" preload="metadata" muted playsinline></video>
      <div class="ar-mid"><div class="t">${esc(v.title)} ${v.nominated ? '<span class="pill-mini pm-fire">SELF-NOMINATED</span>' : ""}</div>
        <div class="s">@${esc(v.owner.username)} · ${esc(v.description || "—")}</div></div>
      <div class="ar-acts">
        <button class="mini-btn" data-review="${v.id}" data-review-act="approve">✅ Approve (Discover)</button>
        <button class="mini-btn" data-mkch="${v.id}" style="background:var(--grad-fire);border:none;color:#fff;font-weight:800">🏆 Make Challenge</button>
        <button class="mini-btn" data-review="${v.id}" data-review-act="reject">✕ Reject</button>
      </div>
      <div id="mkch-${v.id}" style="display:none;width:100%;border-top:1px dashed var(--line2);padding-top:10px;margin-top:4px">
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <input class="input" id="ch-title-${v.id}" value="${esc(v.title)}" style="flex:2;min-width:160px">
          <input class="input" id="ch-target-${v.id}" type="number" value="100" min="1" style="width:110px" title="Recreate target">
          <label style="font-size:12px;display:flex;gap:6px;align-items:center"><input type="checkbox" id="ch-featured-${v.id}"> ⭐ Feature as Creator of the Week</label>
          <button class="btn btn-sm btn-fire" data-review="${v.id}" data-review-act="approve" data-challenge="1">CREATE THE CHALLENGE</button>
        </div>
      </div>
    </div>`).join("") : `<div class="empty">No pending submissions.</div>`}
  </div>

  <div class="adm-card"><h3>🎯 SCORING QUEUE — attempts awaiting evaluation</h3>
    ${q1d.unscored.length ? q1d.unscored.map(v => `
    <div class="adm-row">
      <video src="${v.src}#t=0.7" preload="metadata" muted playsinline></video>
      <div class="ar-mid"><div class="t">${esc(v.title)} <span class="pill-mini ${v.kind === "beatit" ? "pm-fire" : "pm-teal"}">${v.kind === "beatit" ? "⚔️ BEAT IT" : "RECREATE #" + v.attempt_no}</span></div>
        <div class="s">@${esc(v.owner.username)} · ${v.challenge ? esc(v.challenge.code) : ""}</div></div>
      <div class="ar-acts">
        ${[42, 67, 83, 97, 100].map(s => `<button class="mini-btn" onclick="document.getElementById('score-${v.id}').value=${s}">${s}%</button>`).join("")}
        <input class="score-input" id="score-${v.id}" type="number" min="0" max="120" step="0.5" placeholder="0–120">
        <button class="btn btn-sm btn-fire" data-score="${v.id}">SCORE IT</button>
      </div>
    </div>`).join("") : `<div class="empty">Everything scored. Scout for more in Discover.</div>`}
    <div class="hint">Beat It submissions can score above 100 — that's how originals get surpassed.</div>
  </div>

  <div class="adm-card"><h3>🎛️ CHALLENGE MANAGEMENT</h3>
    ${chd.challenges.map(c => `
    <div class="adm-row">
      <div class="ar-mid" style="min-width:220px">
        <div class="t">${esc(c.code)} — ${esc(c.title)} ${c.featured ? '<span class="pill-mini pm-gold">⭐ FEATURED</span>' : ""}</div>
        <div class="s">${c.recreate_count}/${c.recreate_target} recreations · ${c.participants} participants · ${c.qualified} qualified ${c.champion ? `· 👑 @${c.champion.user.username} (${c.champion.score}%)` : ""}</div>
      </div>
      <div class="ar-acts">
        <select class="mini" data-stage="${c.id}">${stages.map(s => `<option value="${s}" ${c.stage === s ? "selected" : ""}>${STAGE_META[s].icon} ${STAGE_META[s].label}</option>`).join("")}</select>
        <input class="score-input" data-target="${c.id}" type="number" value="${c.recreate_target}" min="1" title="Recreate target" style="width:90px">
        <button class="mini-btn" data-feature="${c.id}">⭐ Creator of the Week</button>
      </div>
      ${c.stage === "beat_it" && c.beatits.length ? `<div style="width:100%;display:flex;gap:8px;flex-wrap:wrap;border-top:1px dashed var(--line2);padding-top:9px">
        ${c.beatits.map(b => `<span class="chip" style="cursor:default">@${esc(b.owner.username)} · ${b.score != null ? b.score + "%" : "unscored"}
          ${b.score != null && !c.champion ? `<button class="mini-btn" style="margin-left:6px;background:linear-gradient(135deg,#d9a90e,#f5c518);border:none;color:#241a00;font-weight:800" data-crown="${c.id}" data-vid="${b.id}">👑 CROWN</button>` : ""}</span>`).join("")}
      </div>` : ""}
    </div>`).join("")}
  </div>

  <div class="adm-card"><h3>👥 USERS</h3>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
    ${ud.users.map(u => `<span class="user-chip" data-nav="/user/${u.username}">${avatar(u, "sm")} @${esc(u.username)} · ${u.followers} ${u.is_admin ? "🛡️" : ""}</span>`).join("")}
    </div>
  </div>`;
}

// ---------------- router ----------------
const VIEWS = {
  "/": viewHome,
  "/challenges": viewChallenges,
  "/challenge": viewChallenge,
  "/create": viewCreate,
  "/leaderboard": viewLeaderboard,
  "/user": viewProfile,
  "/notifications": viewNotifications,
  "/admin": viewAdmin,
  "/login": (q) => viewAuth("login"),
  "/register": (q) => viewAuth("register"),
};

async function route() {
  if (PLAYER_OPEN) closePlayer();
  const raw = (location.hash || "#/").slice(1);
  const [path, qs] = raw.split("?");
  const query = new URLSearchParams(qs || "");
  const app = $("#app");
  window.scrollTo(0, 0);
  app.innerHTML = `<div class="loading"><div class="spinner"></div><p>LOADING…</p></div>`;
  renderChrome();
  try {
    let html;
    const parts = path.split("/").filter(Boolean);
    if (parts.length === 2 && VIEWS["/" + parts[0]]) {
      html = await VIEWS["/" + parts[0]](decodeURIComponent(parts[1]), query);
    } else if (parts.length === 1 && VIEWS["/" + parts[0]]) {
      html = await VIEWS["/" + parts[0]](query);
    } else if (path === "/" || path === "") {
      html = await viewHome();
    } else {
      html = `<div class="empty">Lost in the arena. <a href="#/" style="color:var(--fire2)">Go home</a></div>`;
    }
    app.innerHTML = html;
  } catch (err) {
    app.innerHTML = `<div class="empty">⚠️ ${esc(err.message)}</div>`;
  }
}

// video route = player page
async function openVideoRoute(id) {
  $("#app").innerHTML = "";
  await openPlayer(id);
}

window.addEventListener("hashchange", () => {
  const path = (location.hash || "#/").slice(1).split("?")[0];
  if (path.startsWith("/video/")) { openVideoRoute(path.split("/")[2]); return; }
  route();
});

(async function boot() {
  await refreshMe();
  const path = (location.hash || "#/").slice(1).split("?")[0];
  if (path.startsWith("/video/")) openVideoRoute(path.split("/")[2]);
  else route();
})();
