/* ============================================================
   CREATEIT — frontend SPA
   Create It. Recreate It. Beat It.
   ============================================================ */

// ---------------- helpers ----------------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const _apiCache = new Map();
const CACHE_TTL = 20000;
function invalidateCache() { _apiCache.clear(); }
async function api(path, opts = {}) {
  const o = { headers: {}, ...opts };
  const isGet = !o.method || o.method === "GET";
  if (o.json !== undefined) { o.headers["Content-Type"] = "application/json"; o.body = JSON.stringify(o.json); delete o.json; }
  if (!isGet) {
    const r = await fetch(path, o);
    let data = {};
    try { data = await r.json(); } catch (e) {}
    if (!r.ok) throw new Error(data.error || "Something went wrong");
    invalidateCache();
    return data;
  }
  const hit = _apiCache.get(path);
  if (hit && Date.now() - hit.t < CACHE_TTL) return hit.d;
  const r = await fetch(path, o);
  let data = {};
  try { data = await r.json(); } catch (e) {}
  if (!r.ok) throw new Error(data.error || "Something went wrong");
  _apiCache.set(path, { d: data, t: Date.now() });
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
const stagePill = st => `<span class="pill st-${st}"><span class="pd"></span>${STAGE_META[st].label}</span>`;

function scoreBadge(score) {
  if (score === null || score === undefined) return `<span class="pill-mini pm-dim">AWAITING SCORE</span>`;
  const cls = score > 100 ? "sc-beat" : score === 100 ? "sc-full" : score >= 80 ? "sc-hi" : score >= 50 ? "sc-mid" : "sc-low";
  return `<span class="score-badge ${cls}">${score}<span class="pc">%</span></span>`;
}

function avatar(u, cls = "") {
  return `<span class="avatar ${cls}" style="background:${u.color}22;border-color:${u.color}55">${u.avatar}</span>`;
}

// ---------------- video state machine ----------------
function mountVid(video) {
  const frame = video.closest(".vid-frame");
  if (!frame || frame.dataset.mounted) return;
  frame.dataset.mounted = "1";
  const ui = document.createElement("div");
  ui.className = "vid-ui";
  ui.innerHTML = `<div class="vid-loading"></div>
    <button class="vid-playbtn" type="button" aria-label="Play">${ic("play", 26)}</button>
    <div class="vid-error"><span>We couldn't load this creation.</span><button class="btn btn-sm btn-fire" type="button">TRY AGAIN</button></div>`;
  frame.appendChild(ui);
  const loading = frame.querySelector(".vid-loading"),
        playbtn = frame.querySelector(".vid-playbtn"),
        err = frame.querySelector(".vid-error");
  const show = (el, on) => el && el.classList.toggle("show", !!on);
  video.addEventListener("waiting", () => show(loading, true));
  video.addEventListener("playing", () => { show(loading, false); show(playbtn, false); show(err, false); frame.classList.add("is-playing"); });
  video.addEventListener("pause", () => { frame.classList.remove("is-playing"); if (!video.ended && video.currentTime > 0 && video.src) show(playbtn, true); });
  video.addEventListener("error", () => { if (!video.src) return; show(loading, false); show(playbtn, false); show(err, true); frame.classList.remove("is-playing"); });
  playbtn.addEventListener("click", e => { e.stopPropagation(); show(playbtn, false); show(loading, true); video.play().then(() => show(loading, false)).catch(() => { show(loading, false); show(playbtn, true); }); });
  err.querySelector(".btn").addEventListener("click", e => { e.stopPropagation(); show(err, false); show(loading, true); video.load(); video.play().then(() => show(loading, false)).catch(() => { show(loading, false); show(playbtn, true); }); });
  if (video.src) { show(loading, true); video.play().then(() => show(loading, false)).catch(() => { show(loading, false); show(playbtn, true); }); }
}

function thumb(v, extra = "") {
  return v.poster
    ? `<img src="${v.poster}" alt="" loading="lazy" ${extra}>`
    : `<video src="${v.src}#t=0.7" preload="metadata" muted playsinline ${extra}></video>`;
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
    <path class="lm-spark" d="M77 5l3.2 8.8L89 17l-8.8 3.2L77 29l-3.2-8.8L65 17l8.8-3.2z" fill="#E0A83F"/>
  </svg>`;
}
const brandHTML = (size = 26) => `<span class="brand">${logoSVG(size)}<span class="wm"><span class="wm-create">CREATE</span><span class="wm-it">IT</span></span></span>`;

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
  gear: "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z|M12 1.5v2.6|M12 19.9v2.6|M4.6 4.6l1.9 1.9|M17.5 17.5l1.9 1.9|M1.5 12h2.6|M19.9 12h2.6|M4.6 19.4l1.9-1.9|M17.5 6.5l1.9-1.9",
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

// ---------------- theme: dark / light / system ----------------
function themePref() { try { return localStorage.getItem("ci-theme") || "system"; } catch (e) { return "system"; } }
function resolveTheme(pref) {
  if (pref === "system") return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  return pref;
}
function applyTheme(t) {
  if (t === "dark") document.documentElement.setAttribute("data-theme", "dark");
  else document.documentElement.removeAttribute("data-theme");
}
function applyThemePref(pref) {
  applyTheme(resolveTheme(pref));
  try { localStorage.setItem("ci-theme", pref); } catch (e) {}
}
matchMedia("(prefers-color-scheme: dark)").addEventListener && matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (themePref() === "system") applyThemePref("system");
});

// ---------------- splash ----------------
(function splash() {
  const s = document.getElementById("splash");
  if (!s) return;
  let done = false;
  const dismiss = () => {
    if (done) return; done = true;
    s.classList.add("sp-exit");
    setTimeout(() => s.remove(), 500);
  };
  s.addEventListener("click", dismiss);
  const fast = matchMedia("(prefers-reduced-motion: reduce)").matches;
  setTimeout(dismiss, fast ? 250 : 1250);
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
    ? `<button class="icon-btn" data-nav="/user/${ME.username}" title="Profile" style="width:auto;padding:0 6px;gap:6px;display:flex;align-items:center">${avatar(ME)}</button>`
    : `<button class="btn btn-fire btn-sm" data-nav="/login" style="border-radius:11px">LOG IN</button>`;
  $("#topbar").innerHTML = `
    <a data-nav="/" href="#/" aria-label="CreateIt home">${brandHTML(24)}</a>
    <span class="tagline">Create It · Recreate It · Beat It</span>
    <span class="tb-spacer"></span>${bell}${userBtn}`;

  const items = [
    { ico: "home", label: "HOME", path: "/" },
    { ico: "flame", label: "ARENA", path: "/challenges" },
    { ico: "plus", label: "CREATE", path: "/create", special: true },
    { ico: "eye", label: "DISCOVER", path: "/discover" },
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
    <button class="rail-item ${route.startsWith("/challenges") ? "active" : ""}" data-nav="/challenges"><span class="ico">${ic("flame", 18)}</span>Arena</button>
    <button class="rail-item rail-create" data-nav="/create"><span class="ico">${ic("plus", 18)}</span>Create</button>
    <button class="rail-item ${route.startsWith("/discover") ? "active" : ""}" data-nav="/discover"><span class="ico">${ic("eye", 18)}</span>Discover</button>
    <button class="rail-item ${route.startsWith("/attempts") ? "active" : ""}" data-nav="/attempts"><span class="ico">${ic("target", 18)}</span>Attempts</button>
    <button class="rail-item ${route.startsWith("/leaderboard") ? "active" : ""}" data-nav="/leaderboard"><span class="ico">${ic("trophy", 18)}</span>Ranks</button>
    <button class="rail-item ${route.startsWith("/notifications") ? "active" : ""}" data-nav="/notifications"><span class="ico">${ic("bell", 18)}</span>Notifications${unread ? ` <span class="dot-badge" style="position:static;margin-left:4px">${unread}</span>` : ""}</button>
    ${ME?.is_admin ? `<button class="rail-item ${route.startsWith("/admin") ? "active" : ""}" data-nav="/admin"><span class="ico">${ic("shield", 18)}</span>Admin</button>` : ""}
    ${railUser}`;
}

document.addEventListener("click", e => {
  if (!e.target.closest(".rate")) $$(".rate.open").forEach(r => r.classList.remove("open"));
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
      <span class="stats"><span>${ic("eye", 12)} ${v.views || 0}</span><span class="rate-chip">${ic("zap", 12)} <b>${v.rating && v.rating.avg ? v.rating.avg : "—"}</b>${v.rating && v.rating.count ? ` <em>(${v.rating.count})</em>` : ""}</span></span>
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
  const kindLabel = v.kind === "creation" ? "ORIGINAL CREATION"
    : v.kind === "beatit" ? "BEAT IT · FINAL SUBMISSION"
    : `ATTEMPT #${v.attempt_no}`;
  const scoreLine = v.score != null ? `· <b>${v.score}% MATCH</b>` : "· AWAITING SCORE";
  const commentsHTML = d.comments.map(c => `
    <div class="c-row"><span class="avatar sm" style="background:var(--surface3);font-weight:800;font-size:12px">${esc(c.username[0].toUpperCase())}</span>
      <div class="c-body"><b>@${esc(c.username)}</b><span class="t">${timeAgo(c.created_at)}</span><br>${esc(c.text)}</div>
    </div>`).join("") || `<div class="empty" style="padding:18px">No comments yet. Say something.</div>`;
  $("#player-root").innerHTML = `
  <div class="player p-full" id="player">
    <div class="pf-video"><video id="pl-video" src="${v.src}" poster="${v.poster || ""}" autoplay muted loop playsinline preload="auto"></video></div>
    <button class="icon-btn p-close" data-act="close-player">✕</button>
    <button class="p-sound" data-act="player-sound" title="Tap to unmute">${ic("volumeX", 18)}</button>
    ${ch ? `<div class="p-top-ctx"><div class="ptc-pill">
      <span class="ptc-line1">${esc(ch.code)} · ${STAGE_META[ch.stage].label}</span>
      <span class="ptc-line2">${esc(ch.title)}</span></div></div>` : ""}
    <div class="p-ctx">
      <div class="pc-kind">${kindLabel} ${scoreLine}</div>
      <div class="pc-owner" data-nav="/user/${v.owner.username}">${avatar(v.owner, "sm")} <b>@${esc(v.owner.username)}</b>
        <span class="pv">${ic("eye", 12)} ${v.views.toLocaleString()}</span></div>
      <div class="pc-acts">
        ${ch && ch.stage === "recreate_it" ? `<button class="btn btn-teal btn-sm" data-nav="/create?kind=recreate&challenge=${ch.id}">${ic("refresh", 13)} SUBMIT ATTEMPT</button>` : ""}
        ${v.kind === "recreate" && ch ? `<button class="btn btn-sm" data-nav="/journey/${ch.id}/${v.owner.id}">${ic("spark", 13)} VIEW JOURNEY</button>` : ""}
        ${ch ? `<button class="btn btn-sm btn-ghost" data-nav="/challenge/${ch.id}">CHALLENGE ${ic("arrow", 13)}</button>` : ""}
      </div>
    </div>
    <div class="p-rail">
      ${rateControl(v)}
      <button class="rail-act" data-act="player-comments">${ic("chat", 22)}<span>${v.comments}</span></button>
      <button class="rail-act" data-act="share" data-vid="${v.id}">${ic("share", 20)}<span class="rate-lbl">SHARE</span></button>
      ${ch ? `<button class="rail-act attempt-btn ${ch.mine && ch.mine.saved ? "on" : ""}" data-act="attempt-save" data-cid="${ch.id}">${ic("target", 20)}<span class="rate-lbl att-lbl">${ch.mine && ch.mine.saved ? "SAVED" : "ATTEMPT"}</span></button>` : ""}
    </div>
    <div class="p-comments" id="p-comments" style="display:none">
      <h4>COMMENTS (${d.comments.length}) <button class="icon-btn" style="width:30px;height:30px;font-size:13px" data-act="player-comments">✕</button></h4>
      <div class="pc-list">${commentsHTML}</div>
      <div class="c-input">
        <input class="input" id="pl-comment-input" placeholder="${ME ? "Add a comment…" : "Log in to comment"}" ${ME ? "" : "disabled"}>
        <button class="btn btn-sm btn-fire" data-act="send-comment" data-vid="${v.id}" ${ME ? "" : "disabled"}>SEND</button>
      </div>
    </div>
  </div>`;
  if (v.score != null && v.score >= 100) showMoment(v.score, v.id);
  const el = $("#pl-video");
  el.addEventListener("click", () => {
    if (el.muted) { el.muted = false; const b = $(".p-sound"); if (b) { b.innerHTML = ic("volume2", 18); b.classList.add("on"); } }
    else if (!el.paused) el.pause(); else el.play();
  });
  el.play().catch(() => {});
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
    else if (act === "stage-tab") {
      if (!HOME_DATA) return;
      $$(".st-tab").forEach(t => t.classList.toggle("active", t === el));
      const area = $("#stage-feed-area");
      const vids = HOME_DATA[el.dataset.feed] || [];
      area.classList.remove("stage-area"); void area.offsetWidth;
      area.innerHTML = vids.length
        ? `<div class="grid3">${vids.map(v => videoCard(v)).join("")}</div>`
        : `<div class="empty">${el.dataset.empty}</div>`;
      area.classList.add("stage-area");
      runCountUps(); bindTilt();
    }
    else if (act === "rate-open") {
      const rateEl = el.closest(".rate");
      const wasOpen = rateEl.classList.contains("open");
      $$(".rate.open").forEach(r => r.classList.remove("open"));
      if (!wasOpen) {
        rateEl.classList.add("open");
        paintGauge(rateEl, +rateEl.dataset.mine || 0, 0);
      }
    }
    else if (act === "attempt-save") {
      if (!ME) { toast("Log in to add challenges to your Attempts"); setTimeout(() => location.hash = "/login", 400); return; }
      const cid = el.dataset.cid;
      try {
        const d = await api(`/api/challenge/${cid}/attempt-toggle`, { method: "POST" });
        el.classList.toggle("on", d.saved);
        el.classList.remove("attempt-saved"); void el.offsetWidth; el.classList.add("attempt-saved");
        const l = el.querySelector(".att-lbl"); if (l) l.textContent = d.saved ? "SAVED" : "ATTEMPT";
        toast(d.saved ? "Saved to Attempts — go practice." : "Removed from Attempts");
      } catch (err) { toast(err.message, true); }
    }
    else if (act === "disc-follow") {
      if (!ME) { location.hash = "/login"; return; }
      try {
        const r = await api(`/api/user/${el.dataset.user}/follow`, { method: "POST" });
        el.classList.toggle("on", r.following);
        el.innerHTML = r.following ? ic("check", 17) : "＋";
        toast(r.following ? `Following @${el.dataset.user}` : `Unfollowed @${el.dataset.user}`);
      } catch (err) { toast(err.message, true); }
    }
    else if (act === "player-sound") {
      const v = $("#pl-video");
      if (v) { v.muted = !v.muted; el.innerHTML = ic(v.muted ? "volumeX" : "volume2", 18); el.classList.toggle("on", !v.muted); }
    }
    else if (act === "player-comments") {
      const p = $("#p-comments");
      if (p) p.style.display = p.style.display === "none" ? "flex" : "none";
    }
    else if (act === "hero-sound") {
      const v = $("#hero-video");
      if (v) { v.muted = !v.muted; el.innerHTML = ic(v.muted ? "volumeX" : "volume2", 16); el.classList.toggle("on", !v.muted); }
    }
    else if (act === "close-player") closePlayer();
    else if (act === "share") { try { await navigator.clipboard.writeText(location.origin + "/#/video/" + (el.dataset.vid || PLAYER_VID)); } catch (err) {} toast("Link copied — share the journey."); }
    else if (act === "like") {
      if (!ME) { toast("Log in to react to creations"); setTimeout(() => location.hash = "/login", 400); return; }
      const span = el.querySelector("span");
      const wasLiked = el.classList.contains("btn-fire") || el.classList.contains("on");
      el.classList.toggle("btn-fire", !wasLiked); el.classList.toggle("on", !wasLiked);
      if (span) span.textContent = Math.max(0, (parseInt(span.textContent) || 0) + (wasLiked ? -1 : 1));
      if (!wasLiked) { el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop"); burst(el); }
      try { const d = await api(`/api/video/${vid}/like`, { method: "POST" }); if (span) span.textContent = d.likes; }
      catch (err) { toast(err.message, true); }
    }
    else if (act === "send-comment") {
      const inp = $("#pl-comment-input");
      if (!ME) { toast("Log in to join the conversation"); setTimeout(() => location.hash = "/login", 400); return; }
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

// sports ticker (ESPN-style live wire)
function tickerHTML(d) {
  const items = [];
  (d.trending || []).slice(0, 5).forEach(v => {
    if (v.score != null && v.challenge) items.push(`<b>@${esc(v.owner.username)}</b> SCORED <span class="g">${v.score}%</span> ON ${esc(v.challenge.code)}`);
  });
  (d.champions || []).forEach(c => items.push(`<b>@${esc(c.champion.user.username)}</b> HOLDS THE ${esc(c.code)} RECORD AT <span class="g">${c.champion.score}%</span>`));
  (d.live || []).forEach(c => items.push(`${esc(c.code)} IS LIVE — <span class="g">${c.recreate_count.toLocaleString()}/${c.recreate_target.toLocaleString()}</span> RECREATIONS`));
  if (!items.length) return "";
  const track = items.map(i => `<span class="tk-item">${i}</span>`).join("");
  return `<div class="ticker"><span class="tk-label"><span class="live-dot"></span> LIVE WIRE</span><div class="tk-mask"><div class="tk-track">${track}${track}</div></div></div>`;
}

// hero parallax
let _pxRaf = null;
window.addEventListener("scroll", () => {
  if (_pxRaf) return;
  _pxRaf = requestAnimationFrame(() => {
    _pxRaf = null;
    const hm = $(".hero-media");
    if (!hm) return;
    const y = Math.min(window.scrollY, 700);
    hm.style.transform = `translateY(${(y * 0.14).toFixed(1)}px)`;
  });
}, { passive: true });

// like burst particles
function burst(btn) {
  for (let i = 0; i < 8; i++) {
    const p = document.createElement("span");
    p.className = "burst-p";
    const a = (i / 8) * Math.PI * 2 + Math.random() * 0.5, r = 22 + Math.random() * 14;
    p.style.setProperty("--dx", Math.cos(a) * r + "px");
    p.style.setProperty("--dy", Math.sin(a) * r + "px");
    btn.appendChild(p);
    setTimeout(() => p.remove(), 750);
  }
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

function beatBoard(c) {
  return `<div class="beat-board">
    <div class="bb-top"><span class="bb-code">${esc(c.code)}</span>${stagePill(c.stage)}
      ${c.days_left != null ? `<span style="margin-left:auto;color:var(--mut);font-size:12px;font-weight:700;display:flex;align-items:center;gap:5px">${ic("clock", 12)} ${c.days_left}d remaining</span>` : ""}</div>
    <div class="bb-title">${esc(c.title)}</div>
    <div style="color:var(--mut);font-size:13px">created by <b style="color:var(--text)">@${esc(c.creator.username)}</b> · ${esc(c.description || "")}</div>
    <div class="bb-stats">
      <div class="bb-stat"><div class="v g">100%</div><div class="k">Benchmark</div></div>
      <div class="bb-stat"><div class="v">${c.top ? "@" + esc(c.top.user.username) : "—"}</div><div class="k">Current leader</div></div>
      <div class="bb-stat"><div class="v g">${c.top ? c.top.score + "%" : "—"}</div><div class="k">Top score</div></div>
      <div class="bb-stat"><div class="v">${c.qualified}</div><div class="k">Finalists</div></div>
    </div>
    <button class="btn btn-fire" data-nav="/challenge/${c.id}">${ic("zap", 14)} ENTER THE FINAL</button>
  </div>`;
}

let HOME_DATA = null;
async function viewHome() {
  const d = await api("/api/home");
  HOME_DATA = d;
  const h = d.hero;
  return `
  ${tickerHTML(d)}

  ${h ? `
  ${secHead("01", "crown", "CREATEIT OF THE WEEK", "the benchmark the world is chasing")}
  <div class="event-frame"><div class="event-inner">
    <div class="vid-frame hero-vid">
      <video id="hero-video" src="${h.original_video.src}" poster="${h.original_video.poster || ""}" autoplay muted loop playsinline preload="auto"></video>
      <div class="hero-grad"></div>
      <div class="hero-info">
        <div class="hi-kicker">
          <span class="event-badge">${ic("crown", 12)} OFFICIAL CHALLENGE · ${esc(h.code)}</span>
          ${stagePill(h.stage)}
        </div>
        <div class="hi-title">${esc(h.title)}</div>
        <div class="hi-sub">
          <span class="ds-owner" data-nav="/user/${h.creator.username}">${avatar(h.creator, "sm")} <b>@${esc(h.creator.username)}</b></span>
          <span class="hi-livechip"><span class="live-dot"></span> THE ORIGINAL <span class="eq on"><i></i><i></i><i></i></span> ON REPEAT</span>
        </div>
      </div>
      <button class="p-sound" data-act="hero-sound" title="Toggle sound">${ic("volumeX", 18)}</button>
    </div>
    <div class="event-stats">
      <div class="ev-stat"><div class="v" data-count="${h.attempts_total}">0</div><div class="k">Attempts</div></div>
      <div class="ev-stat"><div class="v gold" data-count="${h.recreate_count}">0</div><div class="k">of ${h.recreate_target.toLocaleString()} recreations</div></div>
      <div class="ev-stat"><div class="v" data-count="${h.qualified}">0</div><div class="k">Beat-It qualified</div></div>
      ${h.stage === "recreate_it" && h.days_left != null ? `<div class="ev-stat"><div class="v">${h.days_left}<span style="font-size:14px">d</span></div><div class="k">Remaining</div></div>` : ""}
    </div>
    <div class="event-cta">
      ${h.stage === "recreate_it" ? `<button class="btn btn-fire" data-nav="/create?kind=recreate&challenge=${h.id}">${ic("refresh", 14)} RECREATE THIS</button>` : ""}
      <button class="btn ${h.stage === "recreate_it" ? "btn-ghost" : "btn-fire"}" data-nav="/challenge/${h.id}">ENTER CHALLENGE ${ic("arrow", 14)}</button>
    </div>
  </div></div>
  ${d.hero_feed.length ? `
  <div class="hero-feed" style="margin-top:18px">
    <div class="hf-label"><span class="live-dot"></span> RECREATE IT — LIVE ATTEMPTS ON ${esc(h.code)}</div>
    <div class="feed-strip">${d.hero_feed.map(feedCard).join("")}</div>
  </div>` : ""}` : `<div class="empty">${ic("film", 22)}<br>The Arena is waiting for its first challenge.</div>`}

  ${secHead("02", "film", "THE ORIGINAL CHALLENGE", "this is the benchmark everyone is chasing")}
  <div class="orig-band">
    <div class="ob-left">
      <span class="ob-code">${esc(h.code)}</span>
      <span class="ob-title">${esc(h.title)}</span>
      <span class="ob-meta">${stagePill(h.stage)} <span class="ob-by" data-nav="/user/${h.creator.username}">created by <b>@${esc(h.creator.username)}</b></span></span>
    </div>
    <div class="ob-right">
      ${h.stage === "recreate_it" && h.days_left != null ? `<div class="ob-count"><b>${h.days_left}</b><span>DAYS LEFT</span></div>` : ""}
      <div class="ob-acts">
        ${h.stage === "recreate_it" ? `<button class="btn btn-fire" data-nav="/create?kind=recreate&challenge=${h.id}">${ic("refresh", 14)} RECREATE THIS</button>` : ""}
        <button class="btn" data-nav="/challenge/${h.id}">OPEN CHALLENGE ${ic("arrow", 13)}</button>
      </div>
    </div>
  </div>

  ${d.hero_feed.length ? `
  ${secHead("03", "refresh", "LATEST RECREATIONS", "the community is attempting it right now")}
  <div class="feed-strip">${d.hero_feed.map(feedCard).join("")}</div>` : ""}

  ${d.hero_success.length ? `
  ${secHead("04", "check", "VERIFIED — 100% RECREATIONS", "these people proved they can do it")}
  <div class="feed-strip verified-strip">${d.hero_success.map(feedCard).join("")}</div>` : ""}

  ${secHead("05", "crown", "CURRENT CHAMPION", "")}
  ${h.champion ? `
  <div class="champ-plate">
    <span class="cp-crown">${ic("crown", 48)}</span>
    <div style="flex:1;min-width:190px">
      <div class="cp-label">CHAMPION · ${esc(h.code)}</div>
      <div class="cp-name">@${esc(h.champion.user.username)}</div>
      <p style="color:var(--ink3);font-size:13px;margin-top:4px">Beat It score <b style="color:var(--gold)">${h.champion.score}%</b> · unbeaten ${h.champion.unbeaten_days} day${h.champion.unbeaten_days === 1 ? "" : "s"}</p>
    </div>
    <button class="btn btn-gold" data-act="watch" data-vid="${h.champion.video_id}">${ic("play", 14)} WATCH THE WIN</button>
  </div>` : `
  <div class="champ-open">
    ${ic("crown", 20)}
    <span>${h.stage === "beat_it" || h.stage === "recreate_closed" ? "Beat It is live — the champion will be crowned soon." : "No champion yet. The crown is decided in Beat It."}</span>
    ${h.stage === "beat_it" ? `<button class="btn btn-sm btn-fire" data-nav="/challenge/${h.id}">WATCH THE FINAL</button>` : ""}
  </div>`}

  ${d.champions.length ? `
  ${secHead("06", "disc", "RECORDS & CHAMPIONS", "permanent history — records exist to be broken", ["Full ranks", "#/leaderboard"])}
  <div class="records-grid">${d.champions.map(recordCard).join("")}</div>` : ""}

  <div class="quote">“Maybe I don't have millions of followers. Maybe I'm not famous.<br>But I have something that is <em>uniquely mine</em>.”</div>`;
}

function arenaCard(c) {
  const pct = c.recreate_target ? Math.min(100, Math.round(c.recreate_count / c.recreate_target * 100)) : 0;
  const left = Math.max(0, c.recreate_target - c.recreate_count);
  const timeChip = c.stage === "recreate_it" && c.days_left != null ? `<span class="ar-time">${ic("clock", 12)} ${c.days_left}d left</span>` : "";
  const enter = c.stage === "champion" ? `${ic("crown", 14)} VIEW RECORD` : c.stage === "beat_it" || c.stage === "recreate_closed" ? `${ic("zap", 14)} BEAT IT LIVE` : `${ic("zap", 14)} ENTER CHALLENGE`;
  return `<div class="arena-card" data-nav="/challenge/${c.id}"><div class="card-glare"></div>
    <div class="ar-thumb">${thumb(c.original_video)}<div class="veil"></div>
      <div class="ar-toprow">${stagePill(c.stage)}${c.featured ? `<span class="pill-mini pm-gold">${ic("star", 10)} FEATURED</span>` : ""}${c.sponsor ? `<span class="pill-mini pm-gold">${esc(c.sponsor)} ×</span>` : ""}</div>
      <div class="ar-bottom"><span class="ar-code">${esc(c.code)}</span><span class="ar-title">${esc(c.title)}</span></div>
    </div>
    <div class="ar-body">
      <div class="ar-creator">${avatar(c.creator, "sm")} created by <b>@${esc(c.creator.username)}</b>${timeChip}</div>
      <div class="ar-stats">
        <div class="ars"><span class="ars-v">${c.top ? c.top.score + "%" : "—"}</span><span class="ars-k">Top score</span></div>
        <div class="ars"><span class="ars-v">${c.top ? "@" + esc(c.top.user.username) : "—"}</span><span class="ars-k">Leader</span></div>
        <div class="ars"><span class="ars-v">${c.participants}</span><span class="ars-k">Fighters</span></div>
        <div class="ars"><span class="ars-v">${left.toLocaleString()}</span><span class="ars-k">Slots left</span></div>
      </div>
      <div class="progress-line"><span><b>${c.recreate_count.toLocaleString()}</b> / ${c.recreate_target.toLocaleString()} recreations</span></div>
      <div class="progress ${c.stage === "champion" ? "t-gold" : ""}"><div style="width:${pct}%"></div></div>
      <button class="btn btn-fire btn-block ar-enter">${enter}</button>
    </div>
  </div>`;
}

function emblemSVG() {
  return `<svg viewBox="0 0 120 120" fill="none" aria-hidden="true">
    <defs><linearGradient id="aeg" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#17140E"/><stop offset="1" stop-color="#17140E"/></linearGradient></defs>
    <circle class="ae-pulse" cx="60" cy="60" r="46" stroke="#D9331F" stroke-width="1.5"/>
    <circle class="ae2-ring" cx="60" cy="60" r="46" stroke="url(#aeg)" stroke-width="2.5" stroke-linecap="round" transform="rotate(-90 60 60)"/>
    <g class="ae2-clash" stroke="url(#aeg)" stroke-width="4" stroke-linecap="round">
      <path d="M38 82 82 38"/><path d="M38 38 82 82"/>
    </g>
    <g class="ae2-target">
      <circle cx="60" cy="60" r="17" stroke="#D9331F" stroke-width="2.5"/>
      <circle cx="60" cy="60" r="5.5" fill="#D9331F"/>
    </g>
  </svg>`;
}

async function viewChallenges(query) {
  const [cdr, atr] = await Promise.allSettled([api("/api/challenges"), ME ? api("/api/attempts") : Promise.resolve(null)]);
  const all = cdr.status === "fulfilled" ? cdr.value.challenges : [];
  const saved = atr.status === "fulfilled" && atr.value ? atr.value.challenges.length : null;
  const live = all.filter(c => c.stage === "recreate_it");
  const beatAll = all.filter(c => c.stage === "beat_it" || c.stage === "recreate_closed");
  const ready = ME ? beatAll.filter(c => c.mine && c.mine.qualified && !c.mine.beatit_submitted) : [];
  return `
  <div class="arena-head">
    <div class="arena-emblem">${emblemSVG()}</div>
    <div class="ah-mid">
      <div class="ah-tag ah-live"><span class="live-dot"></span> COMPETITION CENTER</div>
      <div class="arena-q">What can you <em>compete</em> in today?</div>
      <p style="margin-top:9px">Discovery is for watching. The Arena is for doing. Pick your stage.</p>
      <div class="ah-stats">
        <div class="ah-stat"><span class="hv">${all.length}</span><span class="hk">Challenges</span></div>
        <div class="ah-stat"><span class="hv">${live.length}</span><span class="hk">Open now</span></div>
        <div class="ah-stat"><span class="hv">${beatAll.length}</span><span class="hk">Final stage</span></div>
      </div>
    </div>
  </div>
  <div class="stage-panels">
    <button class="stage-panel sp-rec" data-nav="/arena/recreate">
      <span class="sp-k">STAGE 1 · OPEN TO EVERYONE</span>
      <span class="sp-name">RECREATE IT</span>
      <span class="sp-desc">Prove you can reproduce the original creation, exactly as it was done.</span>
      <span class="sp-meta">${live.length} CHALLENGE${live.length === 1 ? "" : "S"} OPEN ${ic("arrow", 14)}</span>
    </button>
    <button class="stage-panel sp-beat" data-nav="/arena/beatit">
      ${ready.length ? `<span class="sp-flag">YOU'RE READY</span>` : ""}
      <span class="sp-k">STAGE 2 · QUALIFIED ONLY</span>
      <span class="sp-name">BEAT IT</span>
      <span class="sp-desc">Reach 100% first. Then one final submission to surpass the original.</span>
      <span class="sp-meta">${ME ? ready.length + " READY FOR YOU" : beatAll.length + " IN FINAL STAGE"} ${ic("arrow", 14)}</span>
    </button>
  </div>
  <div class="att-strip" data-nav="/attempts">
    ${ic("target", 18)} <b>MY ATTEMPTS</b>
    <span class="att-n">${ME && saved != null ? saved + " SAVED" : "CHALLENGES YOU SAVED TO TRY"} ${ic("arrow", 14)}</span>
  </div>
  <div class="arena-explainer">${ic("spark", 16)} <span><b>ATTEMPT</b> saves a challenge for later. <b>SUBMIT ATTEMPT</b> uploads your video. Two different actions — one goal.</span></div>`;
}

async function viewArenaRecreate() {
  const cdr = await api("/api/challenges").catch(() => ({ challenges: [] }));
  const live = cdr.challenges.filter(c => c.stage === "recreate_it");
  return `
  <div class="page-head">
    <span class="crumb">ARENA / STAGE 1</span>
    <h1 class="big-title">RECREATE IT</h1>
    <div class="meta-row">Watch the original. Practice. Submit your recreation for CreateIt evaluation.</div>
  </div>
  ${live.length ? live.map(c => `
    ${arenaCard(c)}
    <div class="arena-row-acts">
      <button class="btn ${c.mine && c.mine.saved ? "btn-teal" : "btn-ghost"}" data-act="attempt-save" data-cid="${c.id}">${ic("target", 13)} <span class="att-lbl">${c.mine && c.mine.saved ? "SAVED" : "ATTEMPT"}</span></button>
      <button class="btn btn-fire" data-nav="/create?kind=recreate&challenge=${c.id}">${ic("refresh", 13)} SUBMIT ATTEMPT</button>
    </div>`).join("") : `<div class="empty">${ic("flame", 22)}<br>The Arena is waiting for its first challenge.</div>`}`;
}

async function viewArenaBeatit() {
  if (!ME) return viewAuth("login", "Log in to see the challenges you are ready to beat.");
  const cdr = await api("/api/challenges").catch(() => ({ challenges: [] }));
  const beatAll = cdr.challenges.filter(c => c.stage === "beat_it" || c.stage === "recreate_closed");
  const ready = beatAll.filter(c => c.mine && c.mine.qualified && !c.mine.beatit_submitted);
  const submitted = beatAll.filter(c => c.mine && c.mine.beatit_submitted);
  return `
  <div class="page-head">
    <span class="crumb">ARENA / STAGE 2</span>
    <h1 class="big-title">BEAT IT</h1>
    <div class="meta-row">One final submission. Surpass the original. No retakes.</div>
  </div>
  ${ready.length ? `${secHead("", "zap", "READY FOR YOUR FINAL SUBMISSION", "")}
    ${ready.map(c => `
    <div class="beat-brief">
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center">
        <span class="ch-code">${esc(c.code)}</span>${stagePill(c.stage)}
      </div>
      <div class="ch-title" style="font-family:var(--display);font-weight:900;font-size:21px;margin:9px 0 10px">${esc(c.title)}</div>
      <div class="bb-line"><span>THE ORIGINAL</span><b>@${esc(c.creator.username)} · BENCHMARK 100%</b></div>
      <div class="bb-line"><span>CURRENT BEST</span><b class="g">${c.top ? c.top.score + "% · @" + esc(c.top.user.username) : "NO SCORES YET"}</b></div>
      <div class="bb-line"><span>YOUR STATUS</span><b class="r">QUALIFIED · FINAL SUBMISSION OPEN</b></div>
      <div style="display:flex;gap:9px;margin-top:14px">
        <button class="btn btn-fire" style="flex:1" data-nav="/create?kind=beatit&challenge=${c.id}">${ic("zap", 13)} SUBMIT FINAL</button>
        <button class="btn" data-nav="/challenge/${c.id}">VIEW</button>
      </div>
    </div>`).join("")}` : `
    <div class="arena-explainer" style="margin-top:8px">${ic("zap", 16)} <span>You have no Beat It slots open yet. Pass a challenge's RECREATE IT stage with <b>100%</b> to qualify for the final.</span></div>
    <div style="margin-top:12px"><button class="btn btn-fire" data-nav="/arena/recreate">GO TO RECREATE IT ${ic("arrow", 13)}</button></div>`}
  ${submitted.length ? `${secHead("", "target", "YOUR FINAL SUBMISSIONS", "")}
    ${submitted.map(c => `<div class="beat-brief">
      <span class="ch-code">${esc(c.code)}</span>
      <div class="ch-title" style="font-family:var(--display);font-weight:900;font-size:19px;margin:8px 0 6px">${esc(c.title)}</div>
      <div class="bb-line"><span>STATUS</span><b>SUBMITTED · AWAITING CHAMPION</b></div>
      <button class="btn" style="margin-top:12px" data-nav="/challenge/${c.id}">VIEW CHALLENGE</button>
    </div>`).join("")}` : ""}
  ${beatAll.length ? `${secHead("", "flame", "FINAL-STAGE CHALLENGES", "watch the finalists")}
    <div class="arena-grid">${beatAll.map(arenaCard).join("")}</div>` : ""}`;
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
  const top = d.leaderboard[0];
  const fightRight = top ? `
    <div class="fc-side right" data-nav="/user/${top.user.username}" style="cursor:pointer">
      ${avatar(top.user)}
      <span class="fc-name">${esc(top.user.display_name)}</span>
      <span class="fc-handle">@${esc(top.user.username)}</span>
      <span class="fc-scoreline">${top.best}%</span>
      <span class="fc-role">TOP CHALLENGER · ${top.attempts} ATTEMPTS</span>
    </div>` : `
    <div class="fc-side right">
      <span class="avatar" style="background:var(--surface3);color:var(--dim)">?</span>
      <span class="fc-name" style="color:var(--mut)">THE ARENA AWAITS</span>
      <span class="fc-role">NO ATTEMPTS YET — BE FIRST</span>
    </div>`;
  return `
  <div class="page-head">
    <span class="crumb">CHALLENGE / <b>${esc(c.code)}</b></span>
    <div class="fight-card">
      <div class="fc-side left" data-nav="/user/${c.creator.username}" style="cursor:pointer">
        ${avatar(c.creator)}
        <span class="fc-name">${esc(c.creator.display_name)}</span>
        <span class="fc-handle">@${esc(c.creator.username)}</span>
        <span class="fc-role">ORIGINAL CREATOR · THE BENCHMARK</span>
      </div>
      <div class="fc-mid"><span class="fc-vs">VS</span><span class="fc-stage">${stagePill(c.stage)}</span></div>
      ${fightRight}
    </div>
    <h1 class="big-title mask-reveal"><span>${esc(c.title)}</span></h1>
    <div class="meta-row">${stagePill(c.stage)}
      <span class="user-chip" data-nav="/user/${c.creator.username}">${avatar(c.creator, "sm")} <b>@${esc(c.creator.username)}</b> · original creator</span>
      ${c.stage === "recreate_it" && c.days_left != null ? `<span>⏳ ${c.days_left} days left</span>` : ""}
    </div>
  </div>
  ${stageTrack(c.stage)}
  ${champ ? `
  <div class="champ-plate">
    <span class="cp-crown">${ic("crown", 48)}</span>
    <div style="flex:1;min-width:190px">
      <div class="cp-label">CHAMPION · ${esc(c.code)}</div>
      <div class="cp-name">@${esc(champ.user.username)}</div>
      <p style="color:var(--mut);font-size:13px;margin-top:4px">Final Beat It score <b style="color:var(--champ)">${champ.score}%</b> · crowned ${timeAgo(champ.at)} · unbeaten ${champ.unbeaten_days} day${champ.unbeaten_days === 1 ? "" : "s"}. Records exist to be broken.</p>
    </div>
    <button class="btn btn-gold" data-act="watch" data-vid="${champ.video_id}">${ic("play", 14)} WATCH THE WIN</button>
  </div>` : ""}
  ${d.history && d.history.length ? `
  ${secHead("", "disc", "CHALLENGE HISTORY", "previous champions — records never disappear")}
  ${d.history.map(x => `<div class="hist-row">
    ${avatar(x.user, "sm")}
    <div class="hr-mid"><b>@${esc(x.user.username)}</b><span class="hr-d">champion ${timeAgo(x.achieved_at)} · superseded ${timeAgo(x.superseded_at)}</span></div>
    ${scoreBadge(x.score)}
    ${x.video_id ? `<button class="btn btn-sm" data-act="watch" data-vid="${x.video_id}">${ic("play", 12)} WATCH</button>` : ""}
  </div>`).join("")}` : ""}
  <div class="bench">
    <div class="b-thumb" data-act="watch" data-vid="${c.original_video.id}">${thumb(c.original_video)}</div>
    <div style="flex:1;min-width:200px">
      <span class="pill-mini pm-violet">THE BENCHMARK</span>
      <h3>THE ORIGINAL CREATION</h3>
      <p>${esc(c.description || "Recreate this creation exactly as it was performed.")}</p>
      <p style="margin-top:8px;color:var(--text);font-size:13px">${ic("target", 13)} <b data-count="${c.recreate_count}">0</b> / ${c.recreate_target.toLocaleString()} recreations · <span data-count="${c.participants}">0</span> participants · <span data-count="${c.qualified}">0</span> qualified for Beat It</p>
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
    <div class="board-row ${i < 3 ? "pod-" + (i + 1) : ""}"><span class="rank">${i + 1}</span>${avatar(b.user, "sm")}
      <div class="mid"><div class="t" data-nav="/user/${b.user.username}" style="cursor:pointer">@${esc(b.user.username)} · ${esc(b.user.display_name)}</div>
      <div class="s">${b.attempts} attempt${b.attempts === 1 ? "" : "s"} ${b.qualified ? `· ${ic("check", 10)} Beat It qualified` : ""}</div></div>
      ${scoreBadge(b.best)}
    </div>`).join("") : `<div class="empty">${ic("target", 22)}<br>Be the first to attempt it.</div>`}
  ${c.stage !== "champion" && d.beatits.length ? `
  <div class="sec"><h2>${ic("zap",18)} BEAT IT SUBMISSIONS</h2><span class="sub">one final shot each</span><span class="sec-rule"></span></div>
  <div class="grid3">${d.beatits.map(v => videoCard(v)).join("")}</div>` : ""}
  <div class="sec"><h2>${ic("flame",18)} RECENT ATTEMPTS</h2><span class="sec-rule"></span></div>
  ${d.attempts.length ? `<div class="grid3">${d.attempts.map(v => videoCard(v)).join("")}</div>` : `<div class="empty">${ic("target", 22)}<br>Be the first to attempt it.</div>`}`;
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

// ---------------- socials icons ----------------
function socIcon(k) {
  if (k === "youtube") return `<svg class="ic" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="1.5" y="5" width="21" height="14" rx="4"/><path d="m10 9.5 5 2.5-5 2.5z" fill="currentColor" stroke="none"/></svg>`;
  if (k === "instagram") return `<svg class="ic" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none"/></svg>`;
  return `<svg class="ic" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>`;
}

function uploadStatus(v) {
  if (v.kind === "recreate") return ["ATTEMPT", "stc-attempt"];
  if (v.kind === "beatit") return ["BEAT IT", "stc-beatit"];
  if (v.status === "pending") return ["PENDING REVIEW", "stc-pending"];
  if (v.status === "rejected") return ["REJECTED", "stc-rejected"];
  if (v.challenge) return ["SELECTED · CHALLENGE", "stc-challenge"];
  return ["APPROVED", "stc-approved"];
}

let PROF = null, PROF_TAB = "creations";
function profTabHTML(tab) {
  const d = PROF;
  if (tab === "creations") {
    return `<div class="hf-label" style="margin-bottom:12px">${ic("film", 13)} ${d.creations.length} CREATION${d.creations.length === 1 ? "" : "S"} · FULL UPLOAD HISTORY</div>
    ${d.uploads.length ? d.uploads.map(v => {
      const [label, cls] = uploadStatus(v);
      return `<div class="up-row">
        <div class="up-th" data-act="open-video" data-vid="${v.id}">${thumb(v)}</div>
        <div class="up-mid"><div class="up-t">${esc(v.title)}</div>
          <div class="up-s"><span>${timeAgo(v.created_at)}</span><span>${ic("eye", 11)} ${v.views || 0}</span><span>${ic("heart", 11)} ${v.likes}</span>
          ${v.challenge ? `<span style="color:var(--ice)">${esc(v.challenge.code)}</span>` : ""}</div></div>
        <span class="st-chip ${cls}">${label}</span>
      </div>`;
    }).join("") : `<div class="empty">${ic("spark", 22)}<br>What can you do that nobody else can?</div>`}`;
  }
  if (tab === "attempts") {
    return d.attempts.length ? `<div class="grid3">${d.attempts.map(v => videoCard(v)).join("")}</div>`
      : `<div class="empty">${ic("target", 22)}<br>Every legend starts at attempt #1.</div>`;
  }
  if (tab === "journeys") {
    return d.journeys.length ? d.journeys.map(j => `
      <div class="journey">
        <div class="j-head"><h3 data-nav="/challenge/${j.challenge.id}" style="cursor:pointer">${esc(j.challenge.code)} — ${esc(j.challenge.title)}</h3>
          ${stagePill(j.challenge.stage)} ${j.won ? `<span class="pill-mini pm-gold">${ic("crown", 10)} CHAMPION</span>` : j.completed ? `<span class="pill-mini pm-teal">${ic("check", 10)} COMPLETED</span>` : `<span class="pill-mini pm-violet">RECREATING</span>`}
        </div>
        <div class="ar-stats" style="margin:12px 0 4px;max-width:420px">
          <div class="ars"><span class="ars-v">${j.attempts.length}</span><span class="ars-k">Attempts</span></div>
          <div class="ars"><span class="ars-v">${Math.max(...j.attempts.map(a => a.score || 0), 0)}%</span><span class="ars-k">Best score</span></div>
          <div class="ars"><span class="ars-v">${j.beatit ? j.beatit.score + "%" : "—"}</span><span class="ars-k">Beat it</span></div>
          <div class="ars"><span class="ars-v">${j.won ? "WON" : j.completed ? "DONE" : "LIVE"}</span><span class="ars-k">Status</span></div>
        </div>
        <button class="btn btn-sm" data-nav="/journey/${j.challenge.id}/${PROF.user.id}">${ic("spark", 13)} OPEN ATTEMPT TIMELINE</button>
      </div>`).join("") : `<div class="empty">${ic("spark", 22)}<br>Every legend starts at attempt #1.</div>`;
  }
  if (tab === "wins") {
    return d.champion_of.length ? d.champion_of.map(c => `
      <div class="board-row pod-1"><span class="rank" style="color:#d8ab4e">${ic("crown", 17)}</span>
        <div class="mid"><div class="t">${esc(c.code)} — ${esc(c.title)}</div><div class="s">Final Beat It score ${c.score}%</div></div>
        <button class="btn btn-sm btn-gold" data-nav="/challenge/${c.id}">VIEW</button>
      </div>`).join("") : `<div class="empty">${ic("crown", 22)}<br>No crowns yet. The first one is the hardest.</div>`;
  }
  // records
  return d.records.length ? `<div class="records-grid">${d.records.map(r => `
    <div class="records-card">
      <div class="rc-top"><span class="rc-code">${esc(r.challenge.code)}</span><span class="pill-mini pm-gold">${ic("disc", 10)} RECORD HOLDER</span></div>
      <div class="rc-title">${esc(r.challenge.title)}</div>
      <div class="rc-holder"><span class="rc-score">${r.score}<span>%</span></span></div>
      <div class="rc-unb">${ic("clock", 12)} unbeaten for ${r.unbeaten_days} day${r.unbeaten_days === 1 ? "" : "s"}</div>
      <div class="rc-acts"><button class="btn btn-sm" data-nav="/challenge/${r.challenge.id}">VIEW ${ic("arrow", 12)}</button></div>
    </div>`).join("")}</div>` : `<div class="empty">${ic("disc", 22)}<br>No records yet — win a challenge to set one.</div>`;
}
function renderProfTab(tab) {
  PROF_TAB = tab;
  $$(".pf-tab").forEach(t => t.classList.toggle("active", t.dataset.ptab === tab));
  const area = $("#prof-area");
  area.classList.remove("prof-area"); void area.offsetWidth;
  area.innerHTML = profTabHTML(tab);
  area.classList.add("prof-area");
}

async function viewProfile(username) {
  const d = await api(`/api/user/${username}`);
  PROF = d; PROF_TAB = "creations";
  const u = d.user, st = d.stats;
  const own = ME && ME.username === u.username;
  const followBtn = ME && !own
    ? `<button class="btn btn-sm ${u.i_follow ? "" : "btn-fire"}" id="btn-follow">${u.i_follow ? ic("check", 13) + " FOLLOWING" : ic("plus", 13) + " FOLLOW"}</button>` : "";
  const soc = u.socials || {};
  const socChips = [["youtube", soc.youtube, "YouTube"], ["tiktok", soc.tiktok, "TikTok"], ["instagram", soc.instagram, "Instagram"]]
    .filter(([k, v]) => v).map(([k, v, label]) => `<a class="soc-chip ${k === "youtube" ? "yt" : ""}" href="${esc(v)}" target="_blank" rel="noopener">${socIcon(k)} ${label}</a>`).join("");
  setTimeout(() => {
    $("#btn-follow")?.addEventListener("click", async e => {
      try {
        const r = await api(`/api/user/${u.username}/follow`, { method: "POST" });
        e.target.innerHTML = r.following ? ic("check", 13) + " FOLLOWING" : ic("plus", 13) + " FOLLOW";
        e.target.classList.toggle("btn-fire", !r.following);
      } catch (err) { toast(err.message, true); if (err.message === "Login required") location.hash = "/login"; }
    });
    $$(".pf-tab").forEach(t => t.addEventListener("click", () => renderProfTab(t.dataset.ptab)));
    $("#btn-edit-socials")?.addEventListener("click", () => {
      const f = $("#socials-form");
      f.style.display = f.style.display === "none" ? "flex" : "none";
    });
    $("#btn-save-socials")?.addEventListener("click", async () => {
      try {
        await api("/api/user/socials", { method: "POST", json: {
          youtube: $("#soc-yt").value.trim(), tiktok: $("#soc-tk").value.trim(), instagram: $("#soc-ig").value.trim() } });
        toast("Socials saved."); route();
      } catch (err) { toast(err.message, true); }
    });
  }, 0);
  const tabs = [["creations", "CREATIONS", d.creations.length], ["attempts", "ATTEMPTS", d.attempts.length],
                ["journeys", "JOURNEYS", d.journeys.length], ["wins", "WINS", d.champion_of.length], ["records", "RECORDS", d.records.length]];
  return `
  <div class="prof-head">
    ${avatar(u, "lg")}
    <div class="prof-id"><h1>${esc(u.display_name)}</h1><div class="un">@${esc(u.username)} ${u.is_admin ? '· <span class="pill-mini pm-gold">CREATEIT TEAM</span>' : ""}</div>
      <div style="color:var(--mut);font-size:13.5px;margin-top:4px">${esc(u.bio || "No bio yet — too busy practicing.")}</div></div>
    <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end">${followBtn}
      ${own ? `<button class="btn btn-sm" data-nav="/settings">${ic("gear", 14)} SETTINGS</button>` : ""}
      <div style="color:var(--mut);font-size:13px"><b style="color:var(--text)">${u.followers}</b> followers · <b style="color:var(--text)">${u.following}</b> following</div></div>
  </div>
  <div class="socials" style="margin:4px 0 6px">${socChips}${own ? `<button class="soc-chip" id="btn-edit-socials">${ic("plus", 12)} EDIT SOCIALS</button>` : ""}
    ${!socChips && !own ? `<span style="color:var(--dim);font-size:12px">No socials linked yet.</span>` : ""}
  </div>
  ${own ? `<div id="socials-form" style="display:none;gap:8px;flex-wrap:wrap;margin:10px 0;max-width:640px">
    <input class="input" id="soc-yt" placeholder="YouTube channel URL" value="${esc(soc.youtube || "")}" style="flex:1;min-width:180px">
    <input class="input" id="soc-tk" placeholder="TikTok URL" value="${esc(soc.tiktok || "")}" style="flex:1;min-width:180px">
    <input class="input" id="soc-ig" placeholder="Instagram URL" value="${esc(soc.instagram || "")}" style="flex:1;min-width:180px">
    <button class="btn btn-sm btn-fire" id="btn-save-socials">SAVE</button></div>` : ""}
  <div class="stat-strip">
    <div class="stat-box gold"><div class="v">${st.champion}</div><div class="k">Championships</div></div>
    <div class="stat-box teal"><div class="v">${st.completed}</div><div class="k">Successful recreations</div></div>
    <div class="stat-box violet"><div class="v">${st.attempts}</div><div class="k">Recreations</div></div>
    <div class="stat-box fire"><div class="v">${st.beatit}</div><div class="k">Beat It entries</div></div>
    <div class="stat-box"><div class="v">${st.created || 0}</div><div class="k">Challenges created</div></div>
    <div class="stat-box gold"><div class="v">${st.best_score != null ? st.best_score + "%" : "—"}</div><div class="k">Best score</div></div>
  </div>
  <div class="prof-tabs">
    ${tabs.map(([k, l, n]) => `<button class="pf-tab ${k === "creations" ? "active" : ""}" data-ptab="${k}">${l} <span class="ct">${n}</span></button>`).join("")}
  </div>
  <div id="prof-area" class="prof-area">${profTabHTML("creations")}</div>`;
}

// ---------------- DISCOVER: immersive vertical feed ----------------
const DISC = { muted: true };
function discSlideHTML(v, i) {
  const ch = v.challenge;
  const kind = v.kind === "creation"
    ? `<span class="ds-kind">${ic("spark", 12)} ORIGINAL CREATION${!ch ? " · POTENTIAL CHALLENGE" : ""}</span>`
    : v.kind === "beatit"
    ? `<span class="ds-kind">${ic("zap", 12)} BEAT IT · FINAL ${v.score != null ? `· <b>${v.score}%</b>` : ""}</span>`
    : `<span class="ds-kind">${ic("refresh", 12)} ATTEMPT #${v.attempt_no} ${v.score != null ? `· <b>${v.score}% MATCH</b>` : ""}</span>`;
  return `<div class="disc-slide vid-frame" data-di="${i}" data-score="${v.score ?? ""}" data-vid="${v.id}" ${v.poster ? `style="background-image:url(${v.poster});background-size:contain;background-position:center;background-repeat:no-repeat"` : ""}>
    <video playsinline loop preload="none" muted ${v.poster ? `poster="${v.poster}"` : ""} data-dsrc="${v.src}"></video>
    <div class="disc-ctx">
      ${kind}
      <div class="ds-owner" data-nav="/user/${v.owner.username}">${avatar(v.owner, "sm")} @${esc(v.owner.username)}</div>
      ${ch ? `<div class="ds-act">
        <button class="btn btn-sm" data-nav="/challenge/${ch.id}">${esc(ch.code)} ${ic("arrow", 12)}</button>
        ${ch.stage === "recreate_it" ? `<button class="btn btn-sm btn-fire" data-nav="/create?kind=recreate&challenge=${ch.id}">${ic("zap", 12)} SUBMIT ATTEMPT</button>` : ""}
      </div>` : ""}
    </div>
    <div class="disc-rail">
      ${rateControl(v)}
      <button class="rail-act" data-act="open-video" data-vid="${v.id}">${ic("chat", 22)}<span>${v.comments}</span></button>
      <button class="rail-act" data-act="share" data-vid="${v.id}">${ic("share", 20)}</button>
      ${ch ? `<button class="rail-act attempt-btn ${ch.mine && ch.mine.saved ? "on" : ""}" data-act="attempt-save" data-cid="${ch.id}">${ic("target", 20)}<span class="rate-lbl att-lbl">${ch.mine && ch.mine.saved ? "SAVED" : "ATTEMPT"}</span></button>` : ""}
    </div>
  </div>`;
}
function discActivate(i) {
  const slides = $$(".disc-slide");
  slides.forEach((sl, j) => {
    const vid = sl.querySelector("video");
    if (!vid) return;
    if (Math.abs(j - i) <= 1) {
      if (!vid.src && vid.dataset.dsrc) { vid.src = vid.dataset.dsrc; sl.querySelector(".vid-loading")?.classList.add("show"); }
      if (j === i) {
        vid.muted = DISC.muted; vid.play().catch(() => {});
        const sc = parseFloat(sl.dataset.score);
        if (sc >= 100) showMoment(sc, "disc-" + sl.dataset.vid);
      } else vid.pause();
    } else if (vid.src) { vid.pause(); vid.removeAttribute("src"); vid.load(); sl.classList.remove("is-playing"); }
  });
}
function setupDisc() {
  const feed = $("#disc-feed");
  if (!feed || feed.dataset.ready) return;
  feed.dataset.ready = "1";
  const io = new IntersectionObserver(es => {
    es.forEach(en => { if (en.isIntersecting && en.intersectionRatio >= 0.6) discActivate(+en.target.dataset.di); });
  }, { root: feed, threshold: [0.6] });
  $$(".disc-slide", feed).forEach(sl => { const v = sl.querySelector("video"); if (v) mountVid(v); io.observe(sl); });
  discActivate(0);
  feed.addEventListener("click", e => {
    if (e.target.closest("button,[data-nav],a")) return;
    const sl = e.target.closest(".disc-slide");
    const vid = sl && sl.querySelector("video");
    if (!vid || !vid.src) return;
    if (DISC.muted) { DISC.muted = false; vid.muted = false; toast("Sound on"); }
  });
}
let DISC_TIMER = null;
let DISC_TREND_LIMIT = 6;

async function viewDiscover(query) {
  const q0 = query.get("q") || "";
  const shell = `
  <div class="page-head" style="margin-bottom:10px">
    <h1 class="big-title">DISCOVERY</h1>
    <div class="meta-row">What is happening on CreateIt right now.</div>
  </div>
  <div class="disc-searchbig">${ic("target", 18)}<input id="disc-search" type="search" placeholder="Search CreateIt — skills, challenges, creators…" value="${esc(q0)}" autocomplete="off"></div>
  <div class="disc-hint">TRY · FOOTBALL TRICKS · DANCING · COOKING INDOMIE · UNUSUAL SKILLS</div>
  <div id="disc-body"><div class="loading" style="padding:50px 0"><div class="spinner"></div></div></div>`;
  setTimeout(() => {
    const inp = $("#disc-search");
    if (inp) {
      inp.addEventListener("input", () => {
        clearTimeout(DISC_TIMER);
        DISC_TIMER = setTimeout(() => renderDiscBody(inp.value.trim()), 380);
      });
      inp.addEventListener("keydown", e => { if (e.key === "Enter") { clearTimeout(DISC_TIMER); renderDiscBody(inp.value.trim()); } });
    }
    renderDiscBody(q0);
  }, 0);
  return shell;
}

async function renderDiscBody(q) {
  const body = $("#disc-body");
  if (!body) return;
  if (q) { renderSearchResults(body, q); return; }
  DISC_TREND_LIMIT = 6;
  const [hr, jr, cr] = await Promise.allSettled([api("/api/home"), api("/api/journeys"), api("/api/categories")]);
  if (!document.contains(body)) return;
  const h = hr.status === "fulfilled" ? hr.value : { live: [], beat: [] };
  const jd = jr.status === "fulfilled" ? jr.value : { journeys: [], upcoming: [] };
  const cats = cr.status === "fulfilled" ? cr.value : { groups: [] };
  body.innerHTML = `
    ${(jd.journeys.length || jd.upcoming.length) ? `
    ${secHead("", "film", "JOURNEYS", "official CreateIt success stories")}
    <div class="hscroll">
      ${jd.journeys.map(j => `<div class="jrn-card" data-nav="/story/${j.id}">
        <span class="jrn-k">OFFICIAL JOURNEY · ${esc(j.challenge.code)}</span>
        <span class="jrn-t">${esc(j.title)}</span>
        <span class="jrn-tag">${esc(j.tagline)}</span>
        <span class="jrn-meta">${j.moments} MOMENTS ${ic("arrow", 12)}</span>
      </div>`).join("")}
      ${jd.upcoming.map(u => `<div class="jrn-card jrn-next" data-nav="/challenge/${u.challenge.id}">
        <span class="jrn-k">IN PRODUCTION · ${esc(u.challenge.code)}</span>
        <span class="jrn-t">THE NEXT JOURNEY</span>
        <span class="jrn-tag">${esc(u.challenge.title)} — Beat It is live. The story is being written.</span>
        <span class="jrn-meta">WATCH THE FINAL ${ic("arrow", 12)}</span>
      </div>`).join("")}
    </div>` : ""}
    ${secHead("", "flame", "TRENDING", "what CreateIt is watching right now")}
    <div id="disc-trending"><div class="loading" style="padding:26px 0"><div class="spinner"></div></div></div>
    <div class="load-more"><button class="btn" id="disc-more">LOAD MORE</button></div>
    ${secHead("", "refresh", "RECREATE IT", "open challenges — prove you can do it")}
    ${h.live.length ? `<div class="hscroll">${h.live.map(c => challengeCard(c)).join("")}</div>` : `<div class="empty">The Arena is waiting for its first challenge.</div>`}
    ${h.beat.length ? `${secHead("", "zap", "BEAT IT", "final stage — one shot each")}
    <div class="hscroll">${h.beat.map(c => challengeCard(c)).join("")}</div>` : ""}
    ${secHead("", "globe", "EXPLORE", "browse by topic")}
    ${cats.groups.map(g => `<div class="cat-group">
      <div class="cat-group-h">${esc(g.group.name)}</div>
      <div class="cat-chips">
        <button class="cat-chip" data-nav="/category/${g.group.slug}">ALL ${esc(g.group.name).toUpperCase()}</button>
        ${g.children.map(c => `<button class="cat-chip" data-nav="/category/${c.slug}">${esc(c.name)}${c.count ? ` <em>${c.count}</em>` : ""}</button>`).join("")}
      </div>
    </div>`).join("")}`;
  const more = $("#disc-more");
  if (more) more.addEventListener("click", () => { DISC_TREND_LIMIT += 6; loadTrending(); });
  loadTrending();
}

async function loadTrending() {
  const box = $("#disc-trending");
  if (!box) return;
  try {
    const d = await api(`/api/discover?filter=trending&limit=${DISC_TREND_LIMIT}`);
    if (!document.contains(box)) return;
    box.innerHTML = d.videos.length ? `<div class="grid3">${d.videos.map(v => videoCard(v)).join("")}</div>` : `<div class="empty">Nothing trending yet.</div>`;
  } catch (e) { box.innerHTML = `<div class="empty">Could not load trending.</div>`; }
}

async function renderSearchResults(body, q) {
  body.innerHTML = `<div class="loading" style="padding:40px 0"><div class="spinner"></div></div>`;
  try {
    const d = await api(`/api/search?q=${encodeURIComponent(q)}`);
    if (!document.contains(body)) return;
    const total = d.videos.length + d.challenges.length + d.creators.length + d.categories.length + d.journeys.length;
    body.innerHTML = total ? `
      ${d.journeys.length ? `<div class="srch-group">${secHead("", "film", "JOURNEYS", "")}
        ${d.journeys.map(j => `<div class="srch-ch-row" data-nav="/story/${j.id}"><div style="flex:1;min-width:0"><div class="sc-code">OFFICIAL JOURNEY</div><div class="sc-title">${esc(j.title)}</div></div>${ic("arrow", 14)}</div>`).join("")}</div>` : ""}
      ${d.challenges.length ? `<div class="srch-group">${secHead("", "flame", "CHALLENGES", "")}
        ${d.challenges.map(c => `<div class="srch-ch-row" data-nav="/challenge/${c.id}">
          <div style="flex:1;min-width:0"><div class="sc-code">${esc(c.code)}</div><div class="sc-title">${esc(c.title)}</div></div>${stagePill(c.stage)}</div>`).join("")}</div>` : ""}
      ${d.creators.length ? `<div class="srch-group">${secHead("", "user", "CREATORS", "")}
        ${d.creators.map(u => `<div class="srch-creator" data-nav="/user/${u.username}">${avatar(u, "sm")}
          <div><div class="sc-n">${esc(u.display_name)}</div><div class="sc-u">@${esc(u.username)} · ${u.followers} followers</div></div></div>`).join("")}</div>` : ""}
      ${d.categories.length ? `<div class="srch-group">${secHead("", "globe", "TOPICS", "")}
        <div class="cat-chips">${d.categories.map(c => `<button class="cat-chip" data-nav="/category/${c.slug}">${esc(c.name)}</button>`).join("")}</div></div>` : ""}
      ${d.videos.length ? `<div class="srch-group">${secHead("", "eye", "VIDEOS", "")}
        <div class="grid3">${d.videos.map(v => videoCard(v)).join("")}</div></div>` : ""}`
    : `<div class="empty">${ic("target", 22)}<br>No results for "${esc(q)}". Try "dance", "football" or "cooking".</div>`;
  } catch (e) { body.innerHTML = `<div class="empty">Search failed — try again.</div>`; }
}

async function viewCategory(slug) {
  const d = await api(`/api/category/${encodeURIComponent(slug)}`).catch(() => null);
  if (!d) return `<div class="err-block"><h3>THIS TOPIC HAS LEFT THE ARENA</h3><p>It may have been renamed.</p><br><button class="btn btn-fire" data-nav="/discover">BACK TO DISCOVERY</button></div>`;
  return `
  <div class="page-head">
    <span class="crumb">DISCOVERY / TOPIC</span>
    <h1 class="big-title">${esc(d.category.name).toUpperCase()}</h1>
    <div class="meta-row">${d.challenges.length} challenge${d.challenges.length === 1 ? "" : "s"} · ${d.videos.length} videos${d.category.parent ? ` · under ${esc(d.category.parent)}` : ""}</div>
  </div>
  ${d.challenges.length ? `${secHead("", "flame", "CHALLENGES", "")}<div class="arena-grid">${d.challenges.map(arenaCard).join("")}</div>` : ""}
  ${d.videos.length ? `${secHead("", "eye", "VIDEOS", "")}<div class="grid3">${d.videos.map(v => videoCard(v)).join("")}</div>`
    : `<div class="empty">Nothing in this topic yet — be the first to CREATE IT.</div>`}`;
}

async function viewStory(jid) {
  const d = await api(`/api/journey-story/${encodeURIComponent(jid)}`).catch(() => null);
  if (!d) return `<div class="err-block"><h3>THIS STORY HAS LEFT THE ARENA</h3><br><button class="btn btn-fire" data-nav="/discover">BACK TO DISCOVERY</button></div>`;
  let chNo = 0;
  const chapter = (label, v, cap, cls = "") => v ? `<div class="chapter ${cls}">
    <div class="ch-no"><b>${String(++chNo).padStart(2, "0")}</b>SCENE</div>
    <div class="ch-th" data-act="open-video" data-vid="${v.id}">${thumb(v)}</div>
    <div class="ch-body"><div class="ch-label">${label}</div>
      <div style="font-weight:700">${esc(v.title)}</div>
      <div class="ch-cap">${cap}</div></div>
  </div>` : "";
  const arc = d.arc || [];
  const picks = arc.length > 4 ? [arc[0], arc[Math.floor(arc.length / 2)], arc[arc.length - 1]] : arc;
  return `
  <div class="story-head">
    <div class="story-k">OFFICIAL CREATEIT JOURNEY · ${esc(d.challenge.code)}</div>
    <div class="story-t">${esc(d.journey.title)}</div>
    <div class="story-tag">${esc(d.journey.tagline)}</div>
  </div>
  ${chapter("THE ORIGINAL — WHERE IT ALL BEGAN", d.original, `Created by @${esc(d.challenge.creator.username)}. The benchmark the world had to chase.`)}
  ${picks.map(v => chapter(`RECREATE — ATTEMPT #${v.attempt_no}${v.score != null ? ` · ${v.score}%` : ""}`, v,
    `@${esc(v.owner.username)} — ${v.score >= 100 ? "recreate complete." : "the story continues."}`)).join("")}
  ${(d.beatits || []).map(v => chapter(`BEAT IT — FINAL SUBMISSION${v.score != null ? ` · ${v.score}%` : ""}`, v,
    `@${esc(v.owner.username)} took one final shot at the original.`, v.score > 100 ? "champ-ch" : "")).join("")}
  ${d.champion_video && d.champion && !d.beatits.some(b => b.score > 100) ? `<div class="chapter champ-ch">
    <div class="ch-no"><b>${String(++chNo).padStart(2, "0")}</b>SCENE</div>
    <div class="ch-th" data-act="open-video" data-vid="${d.champion_video.id}">${thumb(d.champion_video)}</div>
    <div class="ch-body"><div class="ch-label" style="color:var(--gold)">CHAMPION</div>
      <div style="font-weight:700">@${esc(d.champion.username)}${d.challenge.champion ? ` — ${d.challenge.champion.score}%` : ""}</div>
      <div class="ch-cap">The crown. The record. The next challenger is already watching.</div></div>
  </div>` : ""}
  <div style="margin-top:22px;display:flex;gap:10px;flex-wrap:wrap">
    <button class="btn btn-fire" data-nav="/challenge/${d.challenge.id}">${ic("flame", 13)} ENTER THIS CHALLENGE</button>
    <button class="btn" data-nav="/discover">BACK TO DISCOVERY</button>
  </div>`;
}

// ---------------- confirm modal ----------------
function confirmModal(title, body, okLabel, danger, cb) {
  const root = $("#modal-root");
  root.innerHTML = `<div class="modal-backdrop" id="cfm">
    <div class="modal" style="max-width:390px">
      <h2>${title}</h2>
      <p class="m-sub" style="margin-top:6px">${body}</p>
      <div style="display:flex;gap:9px;margin-top:16px">
        <button class="btn btn-ghost" style="flex:1" id="cfm-cancel">CANCEL</button>
        <button class="btn ${danger ? "btn-fire" : "btn-teal"}" style="flex:1" id="cfm-ok">${okLabel}</button>
      </div>
    </div>
  </div>`;
  $("#cfm-cancel").onclick = () => root.innerHTML = "";
  $("#cfm").addEventListener("click", e => { if (e.target.id === "cfm") root.innerHTML = ""; });
  $("#cfm-ok").onclick = () => { root.innerHTML = ""; cb(); };
}

// ---------------- SETTINGS ----------------
async function viewSettings() {
  if (!ME) return viewAuth("login", "Log in to open your settings.");
  const cur = themePref();
  setTimeout(() => {
    $$(".app-opt").forEach(o => o.addEventListener("click", () => {
      applyThemePref(o.dataset.theme);
      $$(".app-opt").forEach(x => x.classList.toggle("active", x === o));
      toast(`Theme set to ${o.dataset.theme.toUpperCase()}`);
    }));
    $("#set-save-acct")?.addEventListener("click", async () => {
      try {
        const d = await api("/api/me/update", { method: "POST", json: {
          display_name: $("#set-name").value.trim(), bio: $("#set-bio").value.trim() } });
        ME = { ...ME, ...d.me }; toast("Account saved."); renderChrome();
      } catch (err) { toast(err.message, true); }
    });
    $("#set-save-pw")?.addEventListener("click", async () => {
      try {
        await api("/api/me/password", { method: "POST", json: { old: $("#set-pw-old").value, new: $("#set-pw-new").value } });
        $("#set-pw-old").value = ""; $("#set-pw-new").value = "";
        toast("Password updated.");
      } catch (err) { toast(err.message, true); }
    });
    $("#set-logout")?.addEventListener("click", () => {
      confirmModal("Log out of CreateIt?", "You can come back anytime — your journey is saved.", "LOG OUT", true, async () => {
        try { await api("/api/logout", { method: "POST" }); } catch (e) {}
        ME = null; invalidateCache(); toast("Logged out. Come back with something unique.");
        location.hash = "/";
      });
    });
  }, 0);
  return `
  <div class="page-head">
    <span class="crumb">PROFILE / SETTINGS</span>
    <h1 class="big-title">SETTINGS</h1>
  </div>

  ${secHead("", "gear", "ACCOUNT", "")}
  <div class="set-card">
    <div class="field"><label>DISPLAY NAME</label><input class="input" id="set-name" value="${esc(ME.display_name)}" maxlength="40"></div>
    <div class="field"><label>BIO</label><textarea class="input" id="set-bio" maxlength="160" placeholder="What makes you uniquely you?">${esc(ME.bio || "")}</textarea></div>
    <div class="field"><label>USERNAME</label><input class="input" value="@${esc(ME.username)}" disabled style="opacity:.6"></div>
    <button class="btn btn-fire btn-sm" id="set-save-acct">SAVE ACCOUNT</button>
  </div>

  ${secHead("", "spark", "APPEARANCE", "")}
  <div class="set-card">
    <div class="app-opts">
      <button class="app-opt ${cur === "light" ? "active" : ""}" data-theme="light"><span class="ao-ico">☀</span><b>LIGHT</b><span class="ao-s">Bone paper</span></button>
      <button class="app-opt ${cur === "dark" ? "active" : ""}" data-theme="dark"><span class="ao-ico">●</span><b>DARK</b><span class="ao-s">Ink studio</span></button>
      <button class="app-opt ${cur === "system" ? "active" : ""}" data-theme="system"><span class="ao-ico">◐</span><b>SYSTEM</b><span class="ao-s">Follow device</span></button>
    </div>
  </div>

  ${secHead("", "bell", "NOTIFICATIONS", "")}
  <div class="set-card">
    <p class="set-note">CreateIt tells you about the things that matter to your journey:</p>
    <ul class="set-list">
      <li>Someone attempted your challenge</li>
      <li>Your attempt was scored — including the 100% moment</li>
      <li>You became eligible for Beat It</li>
      <li>Someone challenged your record</li>
      <li>CreateIt selected your creation</li>
    </ul>
  </div>

  ${secHead("", "shield", "PRIVACY & SECURITY", "")}
  <div class="set-card">
    <p class="set-note">During the beta, profiles and submissions are visible inside CreateIt. Change your password below.</p>
    <div class="field" style="margin-top:12px"><label>CURRENT PASSWORD</label><input class="input" type="password" id="set-pw-old" autocomplete="current-password"></div>
    <div class="field"><label>NEW PASSWORD</label><input class="input" type="password" id="set-pw-new" autocomplete="new-password"></div>
    <button class="btn btn-sm" id="set-save-pw">UPDATE PASSWORD</button>
  </div>

  ${secHead("", "globe", "LANGUAGE", "")}
  <div class="set-card"><p class="set-note">English (beta). More languages arrive as CreateIt grows.</p></div>

  ${secHead("", "user", "HELP & SUPPORT", "")}
  <div class="set-card"><p class="set-note">Stuck? The core loop is simple: CREATE something unique → the world RECREATES it → someone BEATS it → a CHAMPION is crowned. If anything feels broken, tell the CreateIt team and it becomes part of the journey.</p></div>

  ${secHead("", "film", "ABOUT CREATEIT", "")}
  <div class="set-card">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">${logoSVG(34)}<div><b style="font-family:var(--display);font-weight:900;font-size:18px">CREATE<span style="color:var(--red)">IT</span></b><div class="set-note" style="margin:0">Create It · Recreate It · Beat It</div></div></div>
    <p class="set-note">A platform where people create something unique, challenge the world to recreate it, and compete to beat it. Followers don't decide anything here — the challenge does.</p>
    <p class="set-note" style="margin-top:8px;font-family:var(--mono);font-size:9.5px;letter-spacing:.18em">BETA v17 · THE ARENA JOURNAL</p>
  </div>

  <div class="set-card set-danger">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <div><b>LOG OUT</b><div class="set-note" style="margin:2px 0 0">@${esc(ME.username)} · your journey stays saved</div></div>
      <button class="btn btn-fire btn-sm" id="set-logout">${ic("logout", 14)} LOG OUT</button>
    </div>
  </div>`;
}

// ---------------- MY ATTEMPTS page ----------------
async function viewAttempts() {
  if (!ME) return viewAuth("login", "Log in to see the challenges you saved to attempt.");
  const d = await api("/api/attempts");
  return `
  <div class="page-head">
    <span class="crumb">MY ATTEMPTS</span>
    <h1 class="big-title">THE ATTEMPT LIST</h1>
    <div class="meta-row">Challenges you chose to try. Watch · practice · record · submit.</div>
  </div>
  ${d.challenges.length ? d.challenges.map(c => `
    <div class="att-row">
      <div class="att-th" data-nav="/challenge/${c.id}">${thumb(c.original_video)}</div>
      <div class="att-mid">
        <div class="att-code">${esc(c.code)}</div>
        <div class="att-title">${esc(c.title)}</div>
        <div class="att-meta"><span>by @${esc(c.creator.username)}</span><span>BENCHMARK ${c.top ? c.top.score + "%" : "100%"}</span>
          <span style="color:${c.submitted ? "var(--green)" : "var(--red)"}">${c.submitted ? "SUBMITTED" : "NOT SUBMITTED YET"}</span></div>
        <div style="margin-top:7px">${stagePill(c.stage)}</div>
      </div>
      <div class="att-acts">
        <button class="btn btn-sm" data-nav="/challenge/${c.id}">OPEN</button>
        ${c.stage === "recreate_it" ? `<button class="btn btn-sm btn-fire" data-nav="/create?kind=recreate&challenge=${c.id}">SUBMIT ATTEMPT</button>` : ""}
        <button class="btn btn-sm btn-ghost" data-act="attempt-save" data-cid="${c.id}">REMOVE</button>
      </div>
    </div>`).join("") : `<div class="empty">${ic("target", 22)}<br>Your attempt list is empty. Find a challenge in Discover and press ATTEMPT.</div>`}`;
}

// ---------------- attempt journey timeline ----------------
async function viewJourney(cid, uid) {
  const d = await api(`/api/journey/${cid}/${uid}`);
  const c = d.challenge;
  return `
  <div class="page-head">
    <span class="crumb">JOURNEY / <b>${esc(c.code)}</b></span>
    <div class="j-page-head">
      ${avatar(d.user, "lg")}
      <div><h1 class="big-title" style="font-size:clamp(26px,4.5vw,38px)">@${esc(d.user.username)}'s JOURNEY</h1>
        <div class="meta-row" style="margin-top:6px">${stagePill(c.stage)} <span data-nav="/challenge/${c.id}" style="cursor:pointer;color:var(--ice);font-weight:700">${esc(c.code)} — ${esc(c.title)} ${ic("arrow", 13)}</span></div></div>
    </div>
  </div>
  <div class="j-timeline">
    ${d.attempts.map(a => `
    <div class="j-row ${a.score >= 100 ? "hit" : ""}">
      <div class="jr-no"><span>ATTEMPT</span>#${a.attempt_no}</div>
      <div class="jr-th" data-act="open-video" data-vid="${a.id}">${thumb(a)}</div>
      <div class="jr-meta">${timeAgo(a.created_at)} · ${ic("eye", 11)} ${a.views || 0} views<br>${a.score != null ? (a.score >= 100 ? "Recreate complete." : "The story continues.") : "Awaiting CreateIt evaluation."}</div>
      ${scoreBadge(a.score)}
    </div>`).join("")}
    ${d.beatit ? `
    <div class="j-row beat">
      <div class="jr-no"><span>BEAT IT</span>${ic("zap", 16)}</div>
      <div class="jr-th" data-act="open-video" data-vid="${d.beatit.id}">${thumb(d.beatit)}</div>
      <div class="jr-meta">The final submission. One shot.</div>
      ${scoreBadge(d.beatit.score)}
    </div>` : ""}
  </div>
  ${!d.attempts.length ? `<div class="empty">No attempts logged yet.</div>` : ""}`;
}

async function viewNotifications() {
  if (!ME) return viewAuth("login", "Log in to see your notifications.");
  const d = await api("/api/notifications");
  api("/api/notifications/read", { method: "POST" }).then(refreshMe).then(renderChrome);
  const icons = { like: "heart", comment: "chat", follow: "user", score: "target", review: "upload", challenge: "trophy", stage: "zap", champion: "crown", featured: "star", welcome: "spark", attempt: "target", beatit: "zap", record: "disc" };
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
    $$("[data-closes]").forEach(b => b.onclick = async () => {
      const val = $(`#closes-${b.dataset.closes}`).value;
      if (!val) return toast("Pick a date first.", true);
      try { await api("/api/admin/stage", { method: "POST", json: { challenge_id: +b.dataset.closes, closes_at: val } }); toast("Deadline set."); route(); } catch (e) { toast(e.message, true); }
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
        <input type="date" class="score-input" id="closes-${c.id}" value="${(c.closes_at || "").slice(0, 10)}" style="width:150px">
        <button class="mini-btn" data-closes="${c.id}">${ic("clock", 12)} SET DEADLINE</button>
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

// ---------------- CREATEIT RATING (1–5 swipe gauge) ----------------
const RATE_WORDS = ["", "LOW", "GOOD", "IMPRESSIVE", "INSANE", "EXCEPTIONAL"];
function rateControl(v, compact = false) {
  const mine = (v.rating && v.rating.mine) || 0;
  const avg = (v.rating && v.rating.avg) || 0;
  const count = (v.rating && v.rating.count) || 0;
  return `<div class="rate ${mine ? "mine" : ""}" data-vid="${v.id}" data-mine="${mine}" data-avg="${avg}" data-count="${count}">
    <button class="rate-btn" data-act="rate-open" aria-label="Rate this">
      ${ic("zap", 20)}<span class="rate-lbl">${mine ? mine + "/5" : "RATE"}</span>
    </button>
    <div class="rate-pop">
      <div class="rate-head">HOW IMPRESSIVE?</div>
      <div class="rate-gauge">${[1,2,3,4,5].map(n => `<div class="rg-c" data-n="${n}">${n}</div>`).join("")}</div>
      <div class="rate-foot">${avg ? `<b>${avg}</b>/5 · ${count} rating${count === 1 ? "" : "s"}` : "BE THE FIRST"}</div>
    </div>
  </div>`;
}
let _rateDrag = null;
function paintGauge(rateEl, n, peek) {
  rateEl.querySelectorAll(".rg-c").forEach(c => {
    const cn = +c.dataset.n;
    c.classList.toggle("on", cn <= n);
    c.classList.toggle("peek", !!peek && cn === peek);
  });
}
function gaugeValFromY(g, y) {
  const r = g.getBoundingClientRect();
  const rel = 1 - (y - r.top) / r.height;
  return Math.max(1, Math.min(5, Math.ceil(rel * 5)));
}
async function commitRate(rateEl, n) {
  const vid = rateEl.dataset.vid;
  rateEl.dataset.mine = n;
  rateEl.classList.add("mine");
  const lbl = rateEl.querySelector(".rate-lbl");
  if (lbl) lbl.textContent = n + "/5";
  rateEl.classList.remove("rate-flash"); void rateEl.offsetWidth; rateEl.classList.add("rate-flash");
  rateEl.classList.remove("open");
  try {
    const d = await api(`/api/video/${vid}/rate`, { method: "POST", json: { score: n } });
    rateEl.dataset.avg = d.avg; rateEl.dataset.count = d.count;
    const foot = rateEl.querySelector(".rate-foot");
    if (foot) foot.innerHTML = `<b>${d.avg}</b>/5 · ${d.count} rating${d.count === 1 ? "" : "s"}`;
    toast(`Rated ${n}/5 — ${RATE_WORDS[n]}`);
  } catch (err) { toast(err.message, true); }
}
document.addEventListener("pointerdown", e => {
  const g = e.target.closest(".rate-gauge");
  if (!g) return;
  e.preventDefault();
  const rateEl = g.closest(".rate");
  _rateDrag = { g, rateEl };
  paintGauge(rateEl, gaugeValFromY(g, e.clientY), gaugeValFromY(g, e.clientY));
});
document.addEventListener("pointermove", e => {
  if (!_rateDrag) return;
  paintGauge(_rateDrag.rateEl, 0, gaugeValFromY(_rateDrag.g, e.clientY));
});
document.addEventListener("pointerup", e => {
  if (!_rateDrag) return;
  const { g, rateEl } = _rateDrag;
  _rateDrag = null;
  if (!ME) { toast("Log in to rate creations"); setTimeout(() => location.hash = "/login", 400); rateEl.classList.remove("open"); return; }
  commitRate(rateEl, gaugeValFromY(g, e.clientY));
});

// ---------------- signature moments ----------------
const MOMENTS = new Set();
function showMoment(pct, vid) {
  if (vid && MOMENTS.has(vid)) return;
  if (vid) MOMENTS.add(vid);
  const m = document.createElement("div");
  m.className = "moment";
  m.innerHTML = `<div class="moment-card"><div class="moment-pct">${pct}%</div>
    <div class="moment-txt">${pct > 100 ? "THE ORIGINAL HAS BEEN BEATEN" : "CHALLENGE COMPLETED"}</div></div>`;
  document.body.appendChild(m);
  setTimeout(() => m.remove(), 1750);
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

let NAV_STACK = [];
const ROOT_PATHS = new Set(["/", "/challenges", "/discover", "/leaderboard"]);
function updateBackBtn(path) {
  let bb = $("#backbtn");
  if (!bb) {
    bb = document.createElement("button");
    bb.id = "backbtn";
    bb.innerHTML = ic("arrow", 13) + " BACK";
    bb.style.cssText = "display:none";
    document.body.appendChild(bb);
    bb.addEventListener("click", () => {
      if (NAV_STACK.length >= 2) { NAV_STACK.pop(); const prev = NAV_STACK.pop() || "/"; location.hash = prev; }
      else location.hash = "/";
    });
  }
  bb.querySelector("svg").style.transform = "rotate(180deg)";
  const show = !ROOT_PATHS.has(path);
  bb.style.display = show ? "inline-flex" : "none";
  bb.classList.toggle("show", show);
}
function routeLine() {
  let l = $("#routeline");
  if (!l) { l = document.createElement("div"); l.id = "routeline"; document.body.appendChild(l); }
  l.className = ""; void l.offsetWidth;
  l.style.width = "0"; l.classList.add("go");
  requestAnimationFrame(() => { l.style.width = "72%"; });
  setTimeout(() => { l.classList.add("done"); setTimeout(() => l.classList.add("hide"), 220); }, 350);
}
async function route() {
  if (PLAYER_OPEN) closePlayer();
  routeLine();
  const raw = (location.hash || "#/").slice(1);
  const [path, qs] = raw.split("?");
  NAV_STACK.push(path === "" ? "/" : path);
  if (NAV_STACK.length > 40) NAV_STACK.shift();
  updateBackBtn(path === "" ? "/" : path);
  const query = new URLSearchParams(qs || "");
  const app = $("#app");
  window.scrollTo(0, 0);
  const isHome = path === "/" || path === "";
  app.innerHTML = isHome
    ? `<div class="skel skel-hero"></div><div class="skel-row"><div class="skel skel-card"></div><div class="skel skel-card"></div><div class="skel skel-card"></div></div>`
    : `<div class="loading">${logoSVG(38)}<div class="spinner"></div><p>LOADING…</p></div>`;
  renderChrome();
  try {
    let html;
    const parts = path.split("/").filter(Boolean);
    if (parts.length === 1 && parts[0] === "attempts") {
      html = await viewAttempts();
    } else if (parts.length === 1 && parts[0] === "settings") {
      html = await viewSettings();
    } else if (parts.length === 2 && parts[0] === "arena" && parts[1] === "recreate") {
      html = await viewArenaRecreate();
    } else if (parts.length === 2 && parts[0] === "arena" && parts[1] === "beatit") {
      html = await viewArenaBeatit();
    } else if (parts.length === 2 && parts[0] === "category") {
      html = await viewCategory(decodeURIComponent(parts[1]));
    } else if (parts.length === 2 && parts[0] === "story") {
      html = await viewStory(decodeURIComponent(parts[1]));
    } else if (parts.length === 1 && parts[0] === "discover") {
      html = await viewDiscover(query);
    } else if (parts.length === 3 && parts[0] === "journey") {
      html = await viewJourney(parts[1], parts[2]);
    } else if (parts.length === 2 && VIEWS["/" + parts[0]]) {
      html = await VIEWS["/" + parts[0]](decodeURIComponent(parts[1]), query);
    } else if (parts.length === 1 && VIEWS["/" + parts[0]]) {
      html = await VIEWS["/" + parts[0]](query);
    } else if (path === "/" || path === "") {
      html = await viewHome();
    } else {
      html = `<div class="empty">Lost in the arena. <a href="#/" style="color:var(--fire2)">Go home</a></div>`;
    }
    app.innerHTML = html;
    app.classList.remove("view-in"); void app.offsetWidth; app.classList.add("view-in");
    const hv = $("#hero-video"); if (hv) mountVid(hv);
    observeReveals();
    runCountUps();
    bindTilt();
    bindDecks();
  } catch (err) {
    app.innerHTML = `<div class="err-block"><h3>SOMETHING LEFT THE ARENA</h3><p>${esc(err.message)}</p><br><button class="btn btn-fire" data-nav="/">GO HOME</button></div>`;
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
