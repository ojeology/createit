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
const stagePill = st => {
  const dot = st === "recreate_it" ? `<span class="live-dot"></span>` : st === "champion" ? `<span class="live-dot gold"></span>` : "";
  return `<span class="pill st-${st}">${dot}${STAGE_META[st].label}</span>`;
};

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

// ---------------- signature logo — THE BREAKTHROUGH MARK ----------------
// Three ascending strokes of effort breaking through the record bar, igniting into a spark.
let _logoN = 0;
function logoSVG(size = 28) {
  const id = "lg" + (++_logoN);
  return `<svg class="logo-mark" width="${size}" height="${size}" viewBox="0 0 96 96" fill="none" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="#FF3D1F"/><stop offset=".5" stop-color="#FF7A3C"/><stop offset="1" stop-color="#FFC42E"/>
    </linearGradient></defs>
    <path d="M12 58H46" stroke="url(#${id})" stroke-width="7" stroke-linecap="round" opacity=".4"/>
    <path d="M66 58H84" stroke="url(#${id})" stroke-width="7" stroke-linecap="round" opacity=".4"/>
    <path d="M22 80 33 52" stroke="url(#${id})" stroke-width="10" stroke-linecap="round" opacity=".5"/>
    <path d="M38 82 53 42" stroke="url(#${id})" stroke-width="10" stroke-linecap="round" opacity=".8"/>
    <path d="M54 84 73 24" stroke="url(#${id})" stroke-width="11" stroke-linecap="round"/>
    <path d="M77 5l3.2 8.8L89 17l-8.8 3.2L77 29l-3.2-8.8L65 17l8.8-3.2z" fill="#FFC42E"/>
  </svg>`;
}
const brandHTML = (size = 26) => `<span class="brand">${logoSVG(size)}<span class="wordmark">CREATE<span class="w-it">IT</span></span></span>`;

// ---------------- premium SVG icon system ----------------
const ICONS = {
  home: "M3 10.8 12 3l9 7.8V21h-6.2v-6.2h-5.6V21H3z",
  flame: "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z",
  trophy: "M6 9H4.5a2.5 2.5 0 0 1 0-5H6|M18 9h1.5a2.5 2.5 0 0 0 0-5H18|M4 22h16|M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22|M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22|M18 2H6v7a6 6 0 0 0 12 0V2Z",
  zap: "M13 2 3 14h9l-1 8 10-12h-9l1-8z",
  target: "C12 12 10 0 0 0 1|C12 12 6 0 0 0 1|C12 12 2 0 0 0 1",
  globe: "C12 12 10 0 0 0 1|M2 12h20|M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z",
  crown: "M3 17 4.5 8 9 12l3-6 3 6 4.5-4L21 17H3z|M5 20.5h14",
  disc: "C12 12 9 0 0 0 1|C12 12 3 0 0 0 1",
  lock: "M5 11h14v10H5z|M8 11V7a4 4 0 0 1 8 0v4",
  refresh: "M21 12a9 9 0 1 1-2.64-6.36L21 8|M21 3v5h-5",
  play: "M7 4.5 20 12 7 19.5z",
  heart: "M12 21s-7.2-4.6-9.6-9.2A5.6 5.6 0 0 1 12 6.2a5.6 5.6 0 0 1 9.6 5.6C19.2 16.4 12 21 12 21z",
  chat: "M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  clock: "C12 12 9 0 0 0 1|M12 7v5l3.5 2",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2|C9 7 3.5 0 0 0 1|M22 21v-2a4 4 0 0 0-3-3.87|M16 3.13a4 4 0 0 1 0 7.75",
  user: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2|C12 7 4 0 0 0 1",
  plus: "M12 5v14|M5 12h14",
  check: "M4 12.5l5.2 5L20 6.5",
  arrow: "M5 12h14|m13 6 6 6-6 6",
  bell: "M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9|M10.3 21a1.94 1.94 0 0 0 3.4 0",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4|m16 17 5-5-5-5|M21 12H9",
  shield: "M12 22s8-3.6 8-10V5l-8-3-8 3v7c0 6.4 8 10 8 10z",
  upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4|m17 8-5-5-5 5|M12 3v12",
  star: "m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2-6.2 3.2L7 14.2 2 9.3l6.9-1z",
  film: "M2 5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z|M7 3v18|M17 3v18|M2 8h5|M2 16h5|M17 8h5|M17 16h5",
  volume2: "M11 5 6 9H2v6h4l5 4z|M15.5 8.5a5 5 0 0 1 0 7|M19 5a9.5 9.5 0 0 1 0 14",
  volumeX: "M11 5 6 9H2v6h4l5 4z|m22 9-6 6|m16 9l6 6",
  send: "m22 2-7 20-4-9-9-4z|M22 2 11 13",
  share: "M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8|m16 6-4-4-4 4|M12 2v13",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z|C12 12 3 0 0 0 1",
  spark: "M12 2v4|M12 18v4|M4.9 4.9l2.9 2.9|M16.2 16.2l2.9 2.9|M2 12h4|M18 12h4|M4.9 19.1l2.9-2.9|M16.2 7.8l2.9-2.9",
};
function ic(name, size = 16, cls = "") {
  let body = "";
  for (const part of (ICONS[name] || "").split("|")) {
    if (part.startsWith("C")) { // circle: C cx cy r
      const [cx, cy, r] = part.slice(1).split(" ").map(Number);
      body += `<circle cx="${cx}" cy="${cy}" r="${r}"/>`;
    } else if (part) {
      body += `<path d="${part}"/>`;
    }
  }
  const fill = name === "play" ? 'fill="currentColor" stroke="none"' : "";
  return `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${fill}>${body}</svg>`;
}

// ---------------- splash ----------------
(function splash() {
  const s = document.getElementById("splash");
  if (!s) return;
  let done = false;
  const dismiss = () => {
    if (done) return; done = true;
    s.classList.add("sp-exit");
    setTimeout(() => s.remove(), 700);
  };
  s.addEventListener("click", dismiss);
  setTimeout(dismiss, 3300);
})();

// ---------------- scroll reveals + count-ups ----------------
let _io = null;
function observeReveals() {
  if (!_io) _io = new IntersectionObserver(es => {
    es.forEach(en => { if (en.isIntersecting) { en.target.classList.add("revealed"); _io.unobserve(en.target); } });
  }, { threshold: 0.06 });
  $$("#app > *:not(.reveal)").forEach((el, i) => {
    el.classList.add("reveal");
    el.style.transitionDelay = Math.min(i * 45, 270) + "ms";
    _io.observe(el);
  });
  $$("#app .big-title:not(.reveal)").forEach(el => { el.classList.add("reveal"); _io.observe(el); });
}
function runCountUps() {
  $$("[data-count]").forEach(el => {
    if (el.dataset.counted) return;
    el.dataset.counted = "1";
    const target = parseFloat(el.dataset.count), suffix = el.dataset.suffix || "";
    const t0 = performance.now(), dur = 1100;
    const step = t => {
      const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * e).toLocaleString() + suffix;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

// ---------------- chrome (topbar + navs) ----------------
function renderChrome() {
  const unread = ME?.unread || 0;
  const bell = ME ? `<button class="icon-btn" data-nav="/notifications" title="Notifications">${ic("bell", 18)}${unread ? `<span class="dot-badge">${unread}</span>` : ""}</button>` : "";
  const userBtn = ME
    ? `<button class="icon-btn" data-nav="/user/${ME.username}" title="Profile" style="width:auto;padding:0 6px;gap:6px;display:flex;align-items:center">${avatar(ME)}</button>
       <button class="icon-btn" id="btn-logout" title="Log out">${ic("logout", 17)}</button>`
    : `<button class="btn btn-fire btn-sm" data-nav="/login" style="border-radius:11px">LOG IN</button>`;
  $("#topbar").innerHTML = `
    <a data-nav="/" href="#/" aria-label="CreateIt home">${brandHTML(24)}</a>
    <span class="tagline">Create It · Recreate It · Beat It</span>
    <span class="tb-spacer"></span>${bell}${userBtn}`;

  const items = [
    { ico: "home", label: "HOME", path: "/" },
    { ico: "flame", label: "CHALLENGES", path: "/challenges" },
    { ico: "plus", label: "CREATE", path: "/create", special: true },
    { ico: "trophy", label: "RANKS", path: "/leaderboard" },
    { ico: "user", label: "PROFILE", path: ME ? "/user/" + ME.username : "/login" },
  ];
  const route = location.hash.slice(1).split("?")[0] || "/";
  $("#bottomnav").innerHTML = items.map(it => it.special
    ? `<button class="bn-create" data-nav="${it.path}" title="Create">${ic("plus", 24)}</button>`
    : `<button class="bn-item ${route === it.path || (it.path !== "/" && route.startsWith(it.path)) ? "active" : ""}" data-nav="${it.path}"><span class="ico">${ic(it.ico, 20)}</span>${it.label}</button>`
  ).join("");

  const railUser = ME ? `
    <div class="rail-user" data-nav="/user/${ME.username}">${avatar(ME)}
      <div><div class="ru-n">${esc(ME.display_name)}</div><div class="ru-s">@${esc(ME.username)} · ${ME.followers} followers</div></div>
    </div>` : `<button class="rail-item" data-nav="/login"><span class="ico">🔑</span>Log in</button>`;
  const rail = $("#railnav");
  rail.innerHTML = `
    <a data-nav="/" href="#/" aria-label="CreateIt home">${brandHTML(28)}</a>
    <span class="tagline">Create It · Recreate It · Beat It</span>
    <button class="rail-item ${route === "/" ? "active" : ""}" data-nav="/"><span class="ico">${ic("home", 18)}</span>Home</button>
    <button class="rail-item ${route.startsWith("/challenges") ? "active" : ""}" data-nav="/challenges"><span class="ico">${ic("flame", 18)}</span>Challenges</button>
    <button class="rail-item rail-create" data-nav="/create"><span class="ico">${ic("plus", 18)}</span>Create</button>
    <button class="rail-item ${route.startsWith("/leaderboard") ? "active" : ""}" data-nav="/leaderboard"><span class="ico">${ic("trophy", 18)}</span>Ranks</button>
    <button class="rail-item ${route.startsWith("/notifications") ? "active" : ""}" data-nav="/notifications"><span class="ico">${ic("bell", 18)}</span>Notifications${unread ? ` <span class="dot-badge" style="position:static;margin-left:4px">${unread}</span>` : ""}</button>
    ${ME?.is_admin ? `<button class="rail-item ${route.startsWith("/admin") ? "active" : ""}" data-nav="/admin"><span class="ico">${ic("shield", 18)}</span>Admin</button>` : ""}
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
function challengeCard(c, big = false) {
  const pct = c.recreate_target ? Math.min(100, Math.round(c.recreate_count / c.recreate_target * 100)) : 0;
  const barCls = c.stage === "champion" ? "t-gold" : "";
  let foot;
  if (c.stage === "champion") {
    foot = `<button class="btn btn-sm" data-act="watch" data-vid="${c.original_video.id}">${ic("play", 13)} WATCH</button>
            <button class="btn btn-sm btn-gold" data-nav="/challenge/${c.id}">${ic("crown", 13)} RECORD</button>`;
  } else if (c.stage === "beat_it" || c.stage === "recreate_closed") {
    foot = `<button class="btn btn-sm" data-act="watch" data-vid="${c.original_video.id}">${ic("play", 13)} WATCH</button>
            <button class="btn btn-sm btn-fire" data-nav="/challenge/${c.id}">${ic("zap", 13)} BEAT IT</button>`;
  } else {
    foot = `<button class="btn btn-sm" data-act="watch" data-vid="${c.original_video.id}">${ic("play", 13)} WATCH</button>
            <button class="btn btn-sm btn-teal" data-nav="/create?kind=recreate&challenge=${c.id}">${ic("refresh", 13)} RECREATE</button>`;
  }
  const days = c.stage === "recreate_it" && c.days_left != null ? `<span>${ic("clock", 12)} ${c.days_left}d left</span>` : "";
  return `<div class="ch-card" data-nav="/challenge/${c.id}"><div class="card-glare"></div>
    <div class="ch-thumb">${thumb(c.original_video)}<div class="veil"></div>
      <span class="corner">${stagePill(c.stage)}</span>
      ${c.featured ? `<span class="corner-r"><span class="pill-mini pm-gold">${ic("star", 10)} FEATURED</span></span>` : ""}
    </div>
    <div class="ch-body">
      ${c.sponsor ? `<span class="ch-sponsor">${ic("star", 10)} ${esc(c.sponsor)} × CREATEIT</span>` : ""}
      <span class="ch-code">${esc(c.code)}</span>
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
  const kindTag = v.kind === "beatit" ? `<span class="pill-mini pm-fire">${ic("zap", 10)} BEAT IT</span>`
    : v.kind === "creation" ? `<span class="pill-mini pm-violet">${ic("globe", 10)} CREATION</span>`
    : `<span class="pill-mini pm-teal">ATTEMPT ${v.attempt_no ? "#" + v.attempt_no : ""}</span>`;
  return `<div class="v-card" data-act="open-video" data-vid="${v.id}"><div class="card-glare"></div>
    <div class="v-thumb">${thumb(v)}<div class="veil"></div>
      <span class="play-tag">${kindTag} ${scoreBadge(v.score)}</span>
      <div class="v-overlay">
        ${ch ? `<span class="chip-link">${esc(ch.code)} · ${esc(ch.title)}</span>` : ""}
        <span class="v-title">${esc(v.title)}</span>
      </div>
    </div>
    <div class="v-foot">${avatar(v.owner, "sm")}
      <span class="who">@${esc(v.owner.username)}</span>
      <span class="stats"><span>${ic("heart", 12)} ${v.likes}</span><span>${ic("chat", 12)} ${v.comments}</span></span>
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
      <span class="ctx-code">${esc(ch.code)} — ${STAGE_META[ch.stage].label}</span>
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
            <button class="btn ${v.liked ? "btn-fire" : ""}" data-act="like" data-vid="${v.id}" id="pl-like">${ic("heart",15)} <span>${v.likes}</span></button>
            <button class="btn" data-act="share">${ic("share",15)} SHARE</button>
          </div>
          ${canAttempt ? `<button class="btn btn-teal btn-block" style="margin-top:9px" data-nav="/create?kind=recreate&challenge=${ch.id}">${ic("refresh",14)} RECREATE THIS CHALLENGE</button>` : ""}
        </div>
        <div class="ps-block">
          <h4>Comments (${d.comments.length})</h4>
          <div id="pl-comments">${d.comments.map(c => `
            <div class="c-row"><span class="avatar sm" style="background:var(--surface3);font-weight:800;font-size:12px">${esc(c.username[0].toUpperCase())}</span>
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
    else if (act === "hero-sound") {
      const v = $("#hero-video");
      if (v) { v.muted = !v.muted; el.innerHTML = ic(v.muted ? "volumeX" : "volume2", 16); el.classList.toggle("on", !v.muted); }
    }
    else if (act === "close-player") closePlayer();
    else if (act === "share") { try { await navigator.clipboard.writeText(location.origin + "/#/video/" + PLAYER_VID); } catch (err) {} toast("Link copied — share the journey."); }
    else if (act === "like") {
      if (!ME) { location.hash = "/login"; return; }
      const d = await api(`/api/video/${vid}/like`, { method: "POST" });
      el.classList.toggle("btn-fire", d.liked);
      el.querySelector("span").textContent = d.likes;
      el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop");
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
function secHead(n, icon, title, sub, more) {
  return `<div class="sec"><span class="sec-n">${n}</span><h2>${ic(icon, 18)} ${title}</h2>${sub ? `<span class="sub">${sub}</span>` : ""}<span class="sec-rule"></span>${more ? `<a class="more" href="${more[1]}">${more[0]} ${ic("arrow", 13)}</a>` : ""}</div>`;
}

// sideways snap deck — TikTok energy, horizontal direction
function deckOf(items, cardFn) {
  const cards = items.map(cardFn).join("");
  const dots = items.map((_, i) => `<span class="${i === 0 ? "on" : ""}"></span>`).join("");
  return `<div class="deck">
    <button class="dk-btn dk-prev" type="button" aria-label="Previous">${ic("arrow", 18)}</button>
    <div class="deck-track">${cards}</div>
    <button class="dk-btn dk-next" type="button" aria-label="Next">${ic("arrow", 18)}</button>
    <div class="deck-dots">${dots}</div>
  </div>`;
}
function bindDecks() {
  $$(".deck").forEach(deck => {
    if (deck.dataset.bound) return; deck.dataset.bound = "1";
    const track = deck.querySelector(".deck-track");
    const dots = [...deck.querySelectorAll(".deck-dots span")];
    const step = () => (track.firstElementChild ? track.firstElementChild.offsetWidth + 16 : 300);
    const upd = () => {
      const i = Math.max(0, Math.min(dots.length - 1, Math.round(track.scrollLeft / step())));
      dots.forEach((d, j) => d.classList.toggle("on", j === i));
      deck.querySelector(".dk-prev").classList.toggle("off", track.scrollLeft < 20);
      deck.querySelector(".dk-next").classList.toggle("off", track.scrollLeft > track.scrollWidth - track.clientWidth - 20);
    };
    track.addEventListener("scroll", () => requestAnimationFrame(upd), { passive: true });
    deck.querySelector(".dk-prev").addEventListener("click", () => track.scrollBy({ left: -step(), behavior: "smooth" }));
    deck.querySelector(".dk-next").addEventListener("click", () => track.scrollBy({ left: step(), behavior: "smooth" }));
    upd();
  });
}

const feedCard = v => `<div class="feed-card" data-act="open-video" data-vid="${v.id}">
  <div class="fc-thumb">${thumb(v)}<div class="veil"></div><div class="fc-score">${scoreBadge(v.score)}</div></div>
  <div class="fc-meta">${avatar(v.owner, "sm")}<span>@${esc(v.owner.username)}</span>${v.attempt_no ? `<em>#${v.attempt_no}</em>` : ""}</div>
</div>`;

const recordCard = c => `<div class="records-card">
  <div class="rc-top"><span class="rc-code">${esc(c.code)}</span>${stagePill("champion")}</div>
  <div class="rc-title">${esc(c.title)}</div>
  <div class="rc-holder">${avatar(c.champion.user, "sm")} <b>@${esc(c.champion.user.username)}</b><span class="rc-score">${c.champion.score}<span>%</span></span></div>
  <div class="rc-unb">${ic("clock", 12)} unbeaten for ${c.champion.unbeaten_days} day${c.champion.unbeaten_days === 1 ? "" : "s"}</div>
  <div class="rc-acts"><button class="btn btn-sm btn-gold" data-act="watch" data-vid="${c.champion.video_id}">${ic("play", 12)} THE WIN</button>
  <button class="btn btn-sm" data-nav="/challenge/${c.id}">VIEW ${ic("arrow", 12)}</button></div>
</div>`;

async function viewHome() {
  const d = await api("/api/home");
  const h = d.hero;
  return `
  <div class="loop-strip">
    <span class="loop-step c">CREATE IT</span><span class="loop-arrow">${ic("arrow", 13)}</span>
    <span class="loop-step r">RECREATE IT</span><span class="loop-arrow">${ic("arrow", 13)}</span>
    <span class="loop-step b">BEAT IT</span>
    <span class="loop-cap">What can you do that is uniquely yours? Followers don't matter here — the challenge does.</span>
  </div>

  ${h ? `
  ${secHead("01", "crown", "CREATEIT OF THE WEEK", "the benchmark everyone is chasing")}
  <div class="hero">
    ${h.featured ? `<div class="week-ribbon"><span class="wr-1">${ic("star", 11)} CREATOR OF THE WEEK</span><span class="wr-2">@${esc(h.creator.username)}</span></div>` : ""}
    <div class="hero-media" data-act="watch" data-vid="${h.original_video.id}" style="cursor:pointer">
      <video id="hero-video" src="${h.original_video.src}" autoplay muted loop playsinline preload="auto"></video>
      <button class="hero-sound" data-act="hero-sound" title="Toggle sound">${ic("volumeX", 16)}</button>
      <div class="hero-live"><span class="live-dot"></span> NOW PLAYING · ON REPEAT</div>
    </div>
    <div class="hero-body">
      <span class="hero-kicker"><span class="live-dot"></span> ${esc(h.code)} ${h.sponsor ? `· ${esc(h.sponsor.toUpperCase())} × CREATEIT` : ""} · THE BENCHMARK IS SET</span>
      <div class="hero-title">${esc(h.title)}</div>
      <div class="hero-sub">${esc(h.description)}</div>
      <div class="hero-stats">
        <div class="hstat"><span class="hv" data-count="${h.recreate_count}">0</span><span class="hk">of ${h.recreate_target.toLocaleString()} recreations</span></div>
        <div class="hstat"><span class="hv" data-count="${h.participants}">0</span><span class="hk">participants</span></div>
        <div class="hstat"><span class="hv" data-count="${h.qualified}">0</span><span class="hk">beat-it qualified</span></div>
        ${h.stage === "recreate_it" && h.days_left != null ? `<div class="hstat"><span class="hv">${h.days_left}<span class="u">d</span></span><span class="hk">remaining</span></div>` : ""}
      </div>
      <div class="hero-meta">${stagePill(h.stage)}<span>Created by <b>@${esc(h.creator.username)}</b></span></div>
      <div class="progress hero-progress"><div style="width:${Math.min(100, Math.round(h.recreate_count / h.recreate_target * 100))}%"></div></div>
      <div class="hero-cta" style="margin-top:16px">
        <button class="btn btn-fire" data-act="watch" data-vid="${h.original_video.id}">${ic("play", 14)} WATCH THE ORIGINAL</button>
        ${h.stage === "recreate_it" ? `<button class="btn btn-teal" data-nav="/create?kind=recreate&challenge=${h.id}">${ic("refresh", 14)} RECREATE IT</button>` : ""}
        <button class="btn btn-ghost" data-nav="/challenge/${h.id}">CHALLENGE PAGE ${ic("arrow", 14)}</button>
      </div>
      ${d.hero_feed.length ? `
      <div class="hero-feed">
        <div class="hf-label">${ic("flame", 13)} LATEST SUBMISSIONS ON ${esc(h.code)}</div>
        <div class="feed-strip">${d.hero_feed.map(feedCard).join("")}</div>
      </div>` : ""}
    </div>
  </div>` : `<div class="empty">No live challenges yet. Be the first to CREATE IT.</div>`}

  ${d.sponsored.length ? `
  ${secHead("02", "star", "SPONSORED CHALLENGES", "partners fuel the prizes")}
  <div class="hscroll">${d.sponsored.map(c => challengeCard(c, true)).join("")}</div>` : ""}

  ${secHead(d.sponsored.length ? "03" : "02", "flame", "LIVE CHALLENGES", "swipe through the arena", ["See all", "#/challenges"])}
  ${d.live.length ? deckOf(d.live, c => `<div class="deck-card">${challengeCard(c)}</div>`) : `<div class="empty">Nothing live right now.</div>`}

  ${secHead("04", "film", "CREATE IT", "fresh originals — tomorrow's benchmarks")}
  ${d.feed_create.length ? `<div class="grid3">${d.feed_create.map(v => videoCard(v)).join("")}</div>` : `<div class="empty">Scouts are watching. Upload something uniquely yours.</div>`}

  ${secHead("05", "refresh", "RECREATE IT", "the most recent attempts from the community")}
  ${d.feed_recreate.length ? `<div class="grid3">${d.feed_recreate.map(v => videoCard(v)).join("")}</div>` : `<div class="empty">Nobody has attempted yet. Be first.</div>`}

  ${secHead("06", "zap", "BEAT IT", "final submissions — one shot to surpass the original")}
  ${d.feed_beatit.length ? `<div class="grid3">${d.feed_beatit.map(v => videoCard(v)).join("")}</div>` : `<div class="empty">No final submissions yet — qualify at 100% first.</div>`}

  ${d.champions.length ? `
  ${secHead("07", "disc", "UNBEATEN RECORDS", "nobody has broken these marks yet")}
  <div class="records-grid">${d.champions.map(recordCard).join("")}</div>
  ${secHead("08", "crown", "CHAMPIONS", "", ["Full ranks", "#/leaderboard"])}
  <div class="hscroll">${d.champions.map(challengeCard).join("")}</div>` : ""}

  <div class="quote">“Maybe I don't have millions of followers. Maybe I'm not famous.<br>But I have something that is <em>uniquely mine</em>.”</div>`;
}

async function viewChallenges(query) {
  const stage = query.get("stage") || "";
  const d = await api("/api/challenges" + (stage ? `?stage=${stage}` : ""));
  const tabs = [["", "ALL"], ["recreate_it", "RECREATE"], ["beat_it", "BEAT IT"], ["recreate_closed", "CLOSED"], ["champion", "CHAMPIONS"]];
  return `
  <div class="page-head"><span class="crumb">THE ARENA / ALL CHALLENGES</span>
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
    ["create_it", "CREATE IT", "film"], ["recreate_it", "RECREATE IT", "refresh"], ["recreate_closed", "CLOSED", "lock"],
    ["beat_it", "BEAT IT", "zap"], ["champion", "CHAMPION", "crown"], ["record", "RECORD", "disc"],
  ];
  const idx = stage === "champion" ? 4 : steps.findIndex(s => s[0] === stage);
  return `<div class="stage-track">${steps.map((s, i) => {
    const cls = i < idx ? "done" : i === idx ? "now" : "";
    const join = i < steps.length - 1 ? `<div class="st-join ${i < idx ? "done" : ""}"></div>` : "";
    return `<div class="st-step ${cls}"><span class="n">${i < idx ? ic("check", 15) : ic(s[2], 15)}</span><span class="l">${s[1]}</span></div>${join}`;
  }).join("")}</div>`;
}

async function viewChallenge(id) {
  const d = await api(`/api/challenge/${id}`);
  const c = d.challenge, m = c.mine;
  let cta = "";
  if (c.stage === "recreate_it") {
    cta = ME ? `<button class="btn btn-teal" data-nav="/create?kind=recreate&challenge=${c.id}">${ic("refresh",14)} RECREATE IT</button>`
             : `<button class="btn btn-teal" data-nav="/login">LOG IN TO ATTEMPT</button>`;
  } else if ((c.stage === "beat_it" || c.stage === "recreate_closed")) {
    if (!ME) cta = `<button class="btn btn-fire" data-nav="/login">LOG IN</button>`;
    else if (m?.beatit_submitted) cta = `<button class="btn" disabled>${ic("check",14)} FINAL SUBMISSION SENT</button>`;
    else if (m?.can_beatit) cta = `<button class="btn btn-fire" data-nav="/create?kind=beatit&challenge=${c.id}">${ic("zap",14)} USE MY FINAL SUBMISSION</button>`;
    else if (!m?.qualified) cta = `<button class="btn" disabled title="Reach 100% in Recreate It first">${ic("lock",14)} QUALIFY AT 100% FIRST</button>`;
  }
  const champ = c.champion;
  return `
  <div class="page-head">
    <span class="crumb">CHALLENGE / <b>${esc(c.code)}</b></span>
    <h1 class="big-title">${esc(c.title)}</h1>
    <div class="meta-row">${stagePill(c.stage)}
      <span class="user-chip" data-nav="/user/${c.creator.username}">${avatar(c.creator, "sm")} <b>@${esc(c.creator.username)}</b> · original creator</span>
      ${c.stage === "recreate_it" && c.days_left != null ? `<span>⏳ ${c.days_left} days left</span>` : ""}
    </div>
  </div>
  ${stageTrack(c.stage)}
  ${champ ? `
  <div class="champ-banner">
    <span class="crown">${ic("crown", 42)}</span>
    <div style="flex:1;min-width:180px">
      <h3>CHAMPION — @${esc(champ.user.username)}</h3>
      <p>Final Beat It score: <b style="color:var(--gold)">${champ.score}%</b> · crowned ${timeAgo(champ.at)} · unbeaten for ${champ.unbeaten_days} day${champ.unbeaten_days === 1 ? "" : "s"}. Records exist to be broken.</p>
    </div>
    <button class="btn btn-gold" data-act="watch" data-vid="${champ.video_id}">${ic("play", 14)} WATCH THE WIN</button>
  </div>` : ""}
  <div class="bench">
    <div class="b-thumb" data-act="watch" data-vid="${c.original_video.id}">${thumb(c.original_video)}</div>
    <div style="flex:1;min-width:200px">
      <span class="pill-mini pm-violet">THE BENCHMARK</span>
      <h3>THE ORIGINAL CREATION</h3>
      <p>${esc(c.description || "Recreate this creation exactly as it was performed.")}</p>
      <p style="margin-top:8px;color:var(--text);font-size:13px">${ic("target", 13)} <b>${c.recreate_count.toLocaleString()}</b> / ${c.recreate_target.toLocaleString()} recreations · ${c.participants} participants · ${c.qualified} qualified for Beat It</p>
      <div class="progress t-teal" style="max-width:380px;margin-top:10px"><div style="width:${Math.min(100, Math.round(c.recreate_count / c.recreate_target * 100))}%"></div></div>
    </div>
    <div style="display:flex;flex-direction:column;gap:9px">
      <button class="btn btn-fire" data-act="watch" data-vid="${c.original_video.id}">${ic("play", 14)} WATCH</button>${cta}
    </div>
  </div>
  ${m && m.attempts ? `<div class="adm-card" style="margin-top:14px"><h3>MY STATUS IN THIS CHALLENGE</h3>
    <div class="meta-row">${scoreBadge(m.best)} <span>${m.attempts} attempt${m.attempts === 1 ? "" : "s"}</span>
    ${m.qualified ? `<span class="pill-mini pm-teal">${ic("check",10)} QUALIFIED FOR BEAT IT</span>` : ""}
    ${m.beatit_submitted ? `<span class="pill-mini pm-fire">${ic("zap",10)} FINAL SUBMISSION IN</span>` : ""}</div></div>` : ""}
  <div class="sec"><h2>${ic("trophy",18)} TOP PARTICIPANTS</h2><span class="sub">best recreate score per person</span><span class="sec-rule"></span></div>
  ${d.leaderboard.length ? d.leaderboard.map((b, i) => `
    <div class="board-row"><span class="rank">${i + 1}</span>${avatar(b.user, "sm")}
      <div class="mid"><div class="t" data-nav="/user/${b.user.username}" style="cursor:pointer">@${esc(b.user.username)} · ${esc(b.user.display_name)}</div>
      <div class="s">${b.attempts} attempt${b.attempts === 1 ? "" : "s"} ${b.qualified ? `· ${ic("check", 10)} Beat It qualified` : ""}</div></div>
      ${scoreBadge(b.best)}
    </div>`).join("") : `<div class="empty">No attempts yet. The arena is open.</div>`}
  ${c.stage !== "champion" && d.beatits.length ? `
  <div class="sec"><h2>${ic("zap",18)} BEAT IT SUBMISSIONS</h2><span class="sub">one final shot each</span><span class="sec-rule"></span></div>
  <div class="grid3">${d.beatits.map(v => videoCard(v)).join("")}</div>` : ""}
  <div class="sec"><h2>${ic("flame",18)} RECENT ATTEMPTS</h2><span class="sec-rule"></span></div>
  ${d.attempts.length ? `<div class="grid3">${d.attempts.map(v => videoCard(v)).join("")}</div>` : `<div class="empty">Nobody has attempted yet. Be first.</div>`}`;
}

async function viewCreate(query) {
  if (!ME) return viewAuth("login", "Log in to create. You don't need followers — you need something uniquely yours.");
  const kind = query.get("kind") || "";
  const chId = query.get("challenge");
  const chD = await api("/api/challenges?stage=recreate_it");
  const live = chD.challenges;

  if (!kind) return `
  <div class="page-head"><span class="crumb">MAKE YOUR MOVE</span><h1 class="big-title">MAKE YOUR MOVE</h1>
  <div class="meta-row">The three-stage philosophy, in one place.</div></div>
  <div class="grid3" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">
    <div class="v-card" data-nav="/create?kind=creation" style="cursor:pointer"><div class="v-thumb" style="aspect-ratio:4/3;background:linear-gradient(140deg,#3d2b7a,#141b34)">
      <div class="v-overlay" style="position:absolute;inset:auto 0 0 0;padding:16px"><span class="pill-mini pm-violet">STAGE 1</span><div class="v-title" style="font-family:var(--display);font-size:20px;letter-spacing:1px">${ic("film",18)} CREATE SOMETHING</div></div></div>
      <div class="v-foot" style="display:block;color:var(--mut);font-size:13px">Submit your own unique creation. If CreateIt believes it's special enough, it becomes a challenge — and you become the benchmark.</div></div>
    <div class="v-card" data-nav="/create?kind=recreate" style="cursor:pointer"><div class="v-thumb" style="aspect-ratio:4/3;background:linear-gradient(140deg,#0d5c4b,#0f2038)">
      <div class="v-overlay" style="position:absolute;inset:auto 0 0 0;padding:16px"><span class="pill-mini pm-teal">STAGE 2</span><div class="v-title" style="font-family:var(--display);font-size:20px;letter-spacing:1px">${ic("refresh",18)} RECREATE</div></div></div>
      <div class="v-foot" style="display:block;color:var(--mut);font-size:13px">Choose an active challenge and attempt it. Unlimited tries. Every attempt becomes part of your journey.</div></div>
    <div class="v-card" data-nav="/create?kind=beatit" style="cursor:pointer"><div class="v-thumb" style="aspect-ratio:4/3;background:linear-gradient(140deg,#7a2410,#341420)">
      <div class="v-overlay" style="position:absolute;inset:auto 0 0 0;padding:16px"><span class="pill-mini pm-fire">STAGE 3</span><div class="v-title" style="font-family:var(--display);font-size:20px;letter-spacing:1px">${ic("zap",18)} BEAT IT</div></div></div>
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
    <button class="btn btn-fire btn-block" id="up-submit">${kind === "creation" ? ic("upload",14) + " SUBMIT FOR REVIEW" : kind === "recreate" ? ic("refresh",14) + " SUBMIT ATTEMPT" : ic("zap",14) + " LOCK IN FINAL SUBMISSION"}</button>
  </div>`;

  let extra = "";
  if (kind === "recreate") {
    if (!live.length) return `<div class="empty">No challenges are in the RECREATE IT stage right now.<br><br><button class="btn btn-fire" data-nav="/challenges">BROWSE CHALLENGES</button></div>`;
    extra = `<div class="field"><label>CHALLENGE</label><select class="input" id="up-challenge">
      ${live.map(c => `<option value="${c.id}" ${c.id == chId ? "selected" : ""}>${esc(c.code)} — ${esc(c.title)}</option>`).join("")}</select></div>`;
  } else if (kind === "beatit") {
    extra = `<div class="field"><label>CHALLENGE</label><select class="input" id="up-challenge"><option value="">Loading your eligible challenges…</option></select></div>
      <div class="hint" style="margin:-6px 0 14px">ONE FINAL SUBMISSION per challenge. It cannot be replaced.</div>`;
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
    creation: [ic("film",22) + " CREATE SOMETHING", "Submit your own unique creation for CreateIt review."],
    recreate: [ic("refresh",22) + " RECREATE", "Attempt an active challenge. Every attempt joins your journey."],
    beatit: [ic("zap",22) + " BEAT IT", "Your one final submission. Surpass the original."],
  };
  return `${back}<div class="page-head"><h1 class="big-title" style="font-size:30px">${heads[kind][0]}</h1><div class="meta-row">${heads[kind][1]}</div></div>${form(extra)}`;
}

async function viewLeaderboard() {
  const d = await api("/api/leaderboard");
  return `
  <div class="page-head"><span class="crumb">RANKS / HALL OF FAME</span><h1 class="big-title">LEADERBOARD</h1>
  <div class="meta-row">Performance over popularity. A 200-follower account can sit above 2 million.</div></div>
  <div class="sec" style="margin-top:6px"><h2>${ic("target",18)} TOP PARTICIPANTS</h2><span class="sub">best recreate score, all challenges</span><span class="sec-rule"></span></div>
  ${d.top.map((t, i) => `
    <div class="board-row"><span class="rank">${i + 1}</span>${avatar(t.user, "sm")}
      <div class="mid"><div class="t" data-nav="/user/${t.user.username}" style="cursor:pointer">@${esc(t.user.username)} · ${esc(t.user.display_name)}</div>
      <div class="s">${t.attempts} total attempts · best on ${t.challenge_code ? `<a href="#/challenge/${t.challenge_id}" style="color:var(--ice)">${esc(t.challenge_code)}</a>` : "—"}</div></div>
      ${scoreBadge(t.best)}
    </div>`).join("") || `<div class="empty">No scored attempts yet.</div>`}
  <div class="sec"><h2>${ic("crown",18)} PAST CHAMPIONS</h2><span class="sub">permanently linked to their challenges</span><span class="sec-rule"></span></div>
  ${d.champions.map(c => `
    <div class="board-row"><span class="rank" style="color:var(--gold)">${ic("crown",16)}</span>${avatar(c.champion, "sm")}
      <div class="mid"><div class="t">@${esc(c.champion.username)}</div><div class="s">${esc(c.challenge.code)} — ${esc(c.challenge.title)} · crowned ${timeAgo(c.at)}</div></div>
      ${scoreBadge(c.score)} <button class="btn btn-sm" data-nav="/challenge/${c.challenge.id}">VIEW</button>
    </div>`).join("") || `<div class="empty">No champions crowned yet.</div>`}
  <div class="sec"><h2>${ic("disc",18)} RECORDS</h2><span class="sub">unbeaten marks. come break them.</span><span class="sec-rule"></span></div>
  <div class="grid3" style="grid-template-columns:repeat(auto-fill,minmax(230px,1fr))">
  ${d.records.map(r => `<div class="records-card">
      <span class="rc-code">${esc(r.challenge.code)}</span>
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
    ? `<button class="btn btn-sm ${u.i_follow ? "" : "btn-fire"}" id="btn-follow">${u.i_follow ? ic("check",13) + " FOLLOWING" : ic("plus",13) + " FOLLOW"}</button>` : "";
  setTimeout(() => {
    $("#btn-follow")?.addEventListener("click", async e => {
      try {
        const r = await api(`/api/user/${u.username}/follow`, { method: "POST" });
        e.target.innerHTML = r.following ? ic("check",13) + " FOLLOWING" : ic("plus",13) + " FOLLOW";
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
    <div class="stat-box gold"><div class="v">${s.champion}</div><div class="k">${ic("trophy",12)} Champion</div></div>
    <div class="stat-box teal"><div class="v">${s.completed}</div><div class="k">${ic("flame",12)} Challenges completed</div></div>
    <div class="stat-box fire"><div class="v">${s.beatit}</div><div class="k">${ic("zap",12)} Beat It entries</div></div>
    <div class="stat-box violet"><div class="v">${s.attempts}</div><div class="k">${ic("target",12)} Total attempts</div></div>
  </div>
  ${d.champion_of.length ? `<div class="sec" style="margin-top:10px"><h2>${ic("crown",18)} CHAMPION OF</h2><span class="sec-rule"></span></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">${d.champion_of.map(c => `<button class="chip" data-nav="/challenge/${c.id}">${ic("crown",12)} ${esc(c.code)} · ${c.score}%</button>`).join("")}</div>` : ""}
  <div class="sec"><h2>${ic("spark",18)} MY JOURNEYS</h2><span class="sub">failure and practice is part of the entertainment</span><span class="sec-rule"></span></div>
  ${d.journeys.length ? d.journeys.map(j => {
    const max = Math.max(100, ...j.attempts.map(a => a.score || 0), j.beatit?.score || 0);
    return `<div class="journey">
      <div class="j-head"><h3 data-nav="/challenge/${j.challenge.id}" style="cursor:pointer">${esc(j.challenge.code)} — ${esc(j.challenge.title)}</h3>
        ${stagePill(j.challenge.stage)} ${j.won ? `<span class="pill-mini pm-gold">${ic("crown",10)} CHAMPION</span>` : j.completed ? `<span class="pill-mini pm-teal">${ic("check",10)} COMPLETED</span>` : ""}
      </div>
      <div class="j-dots">${j.attempts.map(a => `
        <div class="j-dot ${a.score >= 100 ? "hit" : ""}" data-act="open-video" data-vid="${a.id}" style="cursor:pointer" title="Attempt #${a.attempt_no} — ${a.score ?? "awaiting"}%">
          <div class="bar" style="height:${Math.max(7, (a.score || 3) / max * 56)}px"></div>
          <span class="lb">#${a.attempt_no}<br>${a.score != null ? a.score + "%" : "…"}</span>
        </div>`).join("")}
        ${j.beatit ? `<div class="j-dot beat" data-act="open-video" data-vid="${j.beatit.id}" style="cursor:pointer" title="Beat It — ${j.beatit.score}%">
          <div class="bar" style="height:${Math.max(7, (j.beatit.score || 3) / max * 56)}px"></div><span class="lb">${ic("zap",9)}<br>${j.beatit.score}%</span></div>` : ""}
      </div>
      <div class="j-msg">${j.attempts.length} attempt${j.attempts.length === 1 ? "" : "s"} logged — ${j.won ? "and it ended with a crown." : j.completed ? "recreate complete. Beat It awaits." : "the story is still being written."}</div>
    </div>`;
  }).join("") : `<div class="empty">No journeys yet. Every legend starts at attempt #1.</div>`}
  <div class="sec"><h2>${ic("film",18)} CREATIONS</h2><span class="sec-rule"></span></div>
  ${d.creations.length ? `<div class="grid3">${d.creations.map(v => videoCard(v)).join("")}</div>` : `<div class="empty">No creations yet.</div>`}`;
}

async function viewNotifications() {
  if (!ME) return viewAuth("login", "Log in to see your notifications.");
  const d = await api("/api/notifications");
  api("/api/notifications/read", { method: "POST" }).then(refreshMe).then(renderChrome);
  const icons = { like: "heart", comment: "chat", follow: "user", score: "target", review: "upload", challenge: "trophy", stage: "zap", champion: "crown", featured: "star", welcome: "spark" };
  return `
  <div class="page-head"><span class="crumb">INBOX</span><h1 class="big-title">NOTIFICATIONS</h1></div>
  ${d.notifications.length ? d.notifications.map(n => `
    <div class="notif ${n.read ? "" : "unread"}" data-nav="${n.link || "/"}">
      <span class="n-ico">${ic(icons[n.kind] || "bell", 17)}</span>
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
          <button class="chip" data-u="admin" data-p="admin123">${ic("shield",12)} admin · admin123</button>
          <button class="chip" data-u="sarah" data-p="demo1234">sarah · demo1234</button>
          <button class="chip" data-u="david" data-p="demo1234">david · demo1234</button>
          <button class="chip" data-u="zoe" data-p="demo1234">zoe · demo1234</button>
          <button class="chip" data-u="nina" data-p="demo1234">nina · demo1234</button>
        </div>
      </div>
    </div>
  </div>`;
}

// ---------------- admin ----------------
async function viewAdmin() {
  if (!ME?.is_admin) return `<div class="empty">${ic("shield",16)} Admins only.</div>`;
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
      try { await api("/api/admin/featured", { method: "POST", json: { challenge_id: +b.dataset.feature } }); toast("Now the Creator of the Week feature."); route(); } catch (e) { toast(e.message, true); }
    });
    $$("[data-sponsor]").forEach(b => b.onclick = async () => {
      const sponsor = $(`#sponsor-${b.dataset.sponsor}`).value.trim();
      try { await api("/api/admin/sponsor", { method: "POST", json: { challenge_id: +b.dataset.sponsor, sponsor } }); toast(sponsor ? `${sponsor} × CREATEIT is now live on the home page.` : "Sponsor removed."); route(); } catch (e) { toast(e.message, true); }
    });
    $$("[data-crown]").forEach(b => b.onclick = async () => {
      try { await api("/api/admin/crown", { method: "POST", json: { challenge_id: +b.dataset.crown, video_id: +b.dataset.vid } }); toast("Champion crowned. History written."); route(); } catch (e) { toast(e.message, true); }
    });
  }, 0);

  return `
  <div class="page-head"><span class="crumb">CONTROL ROOM</span><h1 class="big-title">ADMIN</h1>
  <div class="meta-row">V1 relies on human evaluation. You are the judge, scout and historian.</div></div>
  <div class="adm-stats">
    <div class="stat-box"><div class="v">${q1d.stats.users}</div><div class="k">Users</div></div>
    <div class="stat-box"><div class="v">${q1d.stats.videos}</div><div class="k">Videos</div></div>
    <div class="stat-box"><div class="v">${q1d.stats.challenges}</div><div class="k">Challenges</div></div>
    <div class="stat-box fire"><div class="v">${q1d.stats.pending}</div><div class="k">Pending review</div></div>
    <div class="stat-box teal"><div class="v">${q1d.stats.unscored}</div><div class="k">Awaiting score</div></div>
  </div>

  <div class="adm-card"><h3>${ic("upload",14)} SUBMISSION REVIEW — Create It candidates</h3>
    ${q1d.pending.length ? q1d.pending.map(v => `
    <div class="adm-row">
      <video src="${v.src}#t=0.7" preload="metadata" muted playsinline></video>
      <div class="ar-mid"><div class="t">${esc(v.title)} ${v.nominated ? '<span class="pill-mini pm-fire">SELF-NOMINATED</span>' : ""}</div>
        <div class="s">@${esc(v.owner.username)} · ${esc(v.description || "—")}</div></div>
      <div class="ar-acts">
        <button class="mini-btn" data-review="${v.id}" data-review-act="approve">Approve (Discover)</button>
        <button class="mini-btn" data-mkch="${v.id}" style="background:var(--grad-fire);border:none;color:#fff;font-weight:800">${ic("trophy",12)} Make Challenge</button>
        <button class="mini-btn" data-review="${v.id}" data-review-act="reject">Reject</button>
      </div>
      <div id="mkch-${v.id}" style="display:none;width:100%;border-top:1px dashed var(--line2);padding-top:10px;margin-top:4px">
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <input class="input" id="ch-title-${v.id}" value="${esc(v.title)}" style="flex:2;min-width:160px">
          <input class="input" id="ch-target-${v.id}" type="number" value="100" min="1" style="width:110px" title="Recreate target">
          <label style="font-size:12px;display:flex;gap:6px;align-items:center"><input type="checkbox" id="ch-featured-${v.id}"> Feature as Creator of the Week</label>
          <button class="btn btn-sm btn-fire" data-review="${v.id}" data-review-act="approve" data-challenge="1">CREATE THE CHALLENGE</button>
        </div>
      </div>
    </div>`).join("") : `<div class="empty">No pending submissions.</div>`}
  </div>

  <div class="adm-card"><h3>${ic("target",14)} SCORING QUEUE — attempts awaiting evaluation</h3>
    ${q1d.unscored.length ? q1d.unscored.map(v => `
    <div class="adm-row">
      <video src="${v.src}#t=0.7" preload="metadata" muted playsinline></video>
      <div class="ar-mid"><div class="t">${esc(v.title)} <span class="pill-mini ${v.kind === "beatit" ? "pm-fire" : "pm-teal"}">${v.kind === "beatit" ? ic("zap",10) + " BEAT IT" : "RECREATE #" + v.attempt_no}</span></div>
        <div class="s">@${esc(v.owner.username)} · ${v.challenge ? esc(v.challenge.code) : ""}</div></div>
      <div class="ar-acts">
        ${[42, 67, 83, 97, 100].map(s => `<button class="mini-btn" onclick="document.getElementById('score-${v.id}').value=${s}">${s}%</button>`).join("")}
        <input class="score-input" id="score-${v.id}" type="number" min="0" max="120" step="0.5" placeholder="0–120">
        <button class="btn btn-sm btn-fire" data-score="${v.id}">SCORE IT</button>
      </div>
    </div>`).join("") : `<div class="empty">Everything scored. Scout for more in Discover.</div>`}
    <div class="hint">Beat It submissions can score above 100 — that's how originals get surpassed.</div>
  </div>

  <div class="adm-card"><h3>${ic("film",14)} CHALLENGE MANAGEMENT</h3>
    ${chd.challenges.map(c => `
    <div class="adm-row">
      <div class="ar-mid" style="min-width:220px">
        <div class="t">${esc(c.code)} — ${esc(c.title)} ${c.featured ? `<span class="pill-mini pm-gold">${ic("star",10)} FEATURED</span>` : ""}</div>
        <div class="s">${c.recreate_count}/${c.recreate_target} recreations · ${c.participants} participants · ${c.qualified} qualified ${c.champion ? `· ${ic("crown",11)} @${c.champion.user.username} (${c.champion.score}%)` : ""}</div>
      </div>
      <div class="ar-acts">
        <select class="mini" data-stage="${c.id}">${stages.map(s => `<option value="${s}" ${c.stage === s ? "selected" : ""}>${STAGE_META[s].icon} ${STAGE_META[s].label}</option>`).join("")}</select>
        <input class="score-input" data-target="${c.id}" type="number" value="${c.recreate_target}" min="1" title="Recreate target" style="width:90px">
        <button class="mini-btn" data-feature="${c.id}">${ic("star",12)} Creator of the Week</button>
      </div>
      <div style="width:100%;display:flex;gap:8px;align-items:center;border-top:1px dashed var(--line2);padding-top:9px;flex-wrap:wrap">
        <input class="score-input" id="sponsor-${c.id}" value="${esc(c.sponsor || "")}" placeholder="Sponsor name (blank = none)" style="width:230px;text-align:left">
        <button class="mini-btn" data-sponsor="${c.id}">${ic("star",12)} SET SPONSOR</button>
        ${c.sponsor ? `<span class="pill-mini pm-gold">${esc(c.sponsor)} × CREATEIT is live</span>` : ""}
      </div>
      ${c.stage === "beat_it" && c.beatits.length ? `<div style="width:100%;display:flex;gap:8px;flex-wrap:wrap;border-top:1px dashed var(--line2);padding-top:9px">
        ${c.beatits.map(b => `<span class="chip" style="cursor:default">@${esc(b.owner.username)} · ${b.score != null ? b.score + "%" : "unscored"}
          ${b.score != null && !c.champion ? `<button class="mini-btn" style="margin-left:6px;background:linear-gradient(135deg,#d9a90e,#f5c518);border:none;color:#241a00;font-weight:800" data-crown="${c.id}" data-vid="${b.id}">${ic("crown",12)} CROWN</button>` : ""}</span>`).join("")}
      </div>` : ""}
    </div>`).join("")}
  </div>

  <div class="adm-card"><h3>${ic("users",14)} USERS</h3>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
    ${ud.users.map(u => `<span class="user-chip" data-nav="/user/${u.username}">${avatar(u, "sm")} @${esc(u.username)} · ${u.followers} ${u.is_admin ? ic("shield",11) : ""}</span>`).join("")}
    </div>
  </div>`;
}

// ---------------- 3D tilt grip ----------------
function bindTilt() {
  if (!matchMedia("(pointer:fine)").matches || window.__tiltBound) return;
  window.__tiltBound = true;
  document.addEventListener("mousemove", e => {
    const card = e.target.closest(".ch-card, .v-card, .records-card");
    $$(".tilting").forEach(c => { if (c !== card) { c.classList.remove("tilting"); c.style.transform = ""; } });
    if (!card) return;
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    if (x < -0.6 || x > 0.6 || y < -0.6 || y > 0.6) return;
    card.classList.add("tilting");
    card.style.transform = `translateY(-5px) perspective(700px) rotateX(${(-y * 5).toFixed(2)}deg) rotateY(${(x * 6).toFixed(2)}deg)`;
    card.style.setProperty("--gx", ((x + 0.5) * 100).toFixed(1) + "%");
    card.style.setProperty("--gy", ((y + 0.5) * 100).toFixed(1) + "%");
  });
  document.addEventListener("mouseout", e => {
    const card = e.target.closest(".ch-card, .v-card, .records-card");
    if (card && !card.contains(e.relatedTarget)) { card.classList.remove("tilting"); card.style.transform = ""; }
  });
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
  app.innerHTML = `<div class="loading">${logoSVG(38)}<div class="spinner"></div><p>LOADING…</p></div>`;
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
    observeReveals();
    runCountUps();
    bindTilt();
    bindDecks();
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
  bindTilt();
  const path = (location.hash || "#/").slice(1).split("?")[0];
  if (path.startsWith("/video/")) openVideoRoute(path.split("/")[2]);
  else route();
})();
