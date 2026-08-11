/* ============================================================
   DISCOVERY JOURNEY — finger-tracking horizontal video pager
   Forward: unpredictable (shuffled). Backward: exact history.
   ============================================================ */
const DJ = {
  videos: [], idx: 0, muted: false, positions: new Map(),
  source: null, curKey: "", loading: false, done: false, active: false,
  batch: 12, pool: [], offset: 0, viewer: false, rateVal: 3,
};
const DG = { down:false, sx:0, sy:0, dx:0, t0:0, axis:null, animating:false };
function djShuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function djCanShuffle() { return DJ.source && (DJ.source.type === "trending" || DJ.source.type === "new"); }
function djSourceKey(src) {
  if (src.type === "list") return "list:" + (src.videos && src.videos[0] ? src.videos[0].id : 0) + ":" + (src.videos ? src.videos.length : 0);
  return src.type + ":" + (src.q || src.slug || src.id || "");
}

// ---------------- shell ----------------
function djShell() {
  return `
  <div class="djr" id="djr">
    <div class="djr-track" id="djr-track">
      <div class="djr-window" id="djr-window">
        <div class="djr-slot" data-slot="0"></div>
        <div class="djr-slot" data-slot="1"></div>
        <div class="djr-slot" data-slot="2"></div>
      </div>
    </div>
    <div class="djr-load" id="djr-load" style="display:none">${logoSVG(36)}</div>
    <div class="djr-top">
      <button class="djr-ico djr-back" data-act="dj-exit" aria-label="Back">${ic("arrow", 16)}</button>
      <div class="djr-src" id="djr-src">DISCOVERY</div>
      <div class="djr-topacts">
        <button class="djr-ico" data-act="dj-browse" aria-label="Browse">${ic("globe", 19)}</button>
      </div>
    </div>
    <div class="djr-bottom">
      <div class="djr-info" id="djr-info"></div>
      <div class="djr-bar">
        <button class="djr-act" data-act="dj-rate">${ic("zap", 20)}<span>RATE</span><em id="djr-rate-avg"></em></button>
        <button class="djr-act" data-act="dj-comment">${ic("chat", 20)}<span>COMMENT</span><em id="djr-c-n"></em></button>
        <button class="djr-act" data-act="dj-share">${ic("share", 19)}<span>SHARE</span></button>
        <button class="djr-act djr-go" data-act="dj-attempt" id="djr-attempt"><span class="act-ic">${ic("target", 20)}</span><span id="djr-attempt-lbl">ATTEMPT</span></button>
      </div>
    </div>
    <div class="djr-progress"><div id="djr-pbar"></div></div>

    <div class="djr-ratepop" id="djr-ratepop" style="display:none">
      <div class="drp-card" id="drp-card">
        <div class="drp-h">HOW IMPRESSIVE IS THIS?</div>
        <div class="drp-val"><b id="drp-num">3</b><span id="drp-word">IMPRESSIVE</span></div>
        <div class="drp-bars" id="drp-bars"><i></i><i></i><i></i><i></i><i></i></div>
        <div class="drp-hint">SWIPE UP / DOWN · THEN SUBMIT</div>
        <button class="btn btn-fire btn-block" id="drp-save">SUBMIT RATING</button>
        <div class="drp-avg" id="drp-avg"></div>
      </div>
    </div>

    <div class="djr-sheet" id="djr-sheet" style="display:none">
      <div class="sheet-grip"></div>
      <div class="djr-sheet-h">COMMENTS <button class="djr-ico" data-act="dj-close-sheet" aria-label="Close">${ic("arrow", 15)}</button></div>
      <div class="djr-sheet-body" id="djr-sheet-body"></div>
      <div class="djr-sheet-in">
        <input class="input" id="djr-cin" placeholder="${ME ? "Add a comment…" : "Log in to comment"}" ${ME ? "" : "disabled"}>
        <button class="btn btn-sm btn-fire" data-act="dj-send-comment">SEND</button>
      </div>
    </div>

    <div class="djr-browse" id="djr-browse" style="display:none"></div>
  </div>`;
}

async function viewDiscover(query) {
  setTimeout(() => djBoot(), 0);
  return djShell();
}

// ---------------- boot / lifecycle ----------------
function djSwipeHint() {
  try { if (sessionStorage.getItem("dj-hinted")) return; } catch (e) { return; }
  try { sessionStorage.setItem("dj-hinted", "1"); } catch (e) {}
  const djr = document.getElementById("djr");
  if (!djr) return;
  const hint = document.createElement("div");
  hint.className = "dj-swipehint";
  hint.innerHTML = `<span class="djsh-arr">${(typeof ic === "function") ? ic("arrow", 20) : "→"}</span><span>SWIPE</span>`;
  djr.appendChild(hint);
  setTimeout(() => hint.remove(), 2300);
}

async function djBoot() {
  const root = document.getElementById("djr");
  if (!root) return;
  DJ.active = true;
  try { DJ.muted = sessionStorage.getItem("dj-muted") === "1"; } catch (e) {}
  djApplySoundBtn();
  djArmPager();
  if (!DJ.videos.length) await djEnter({ type: "trending", label: "TRENDING" }, 0);
  else { djPaintWindow(); djCenter(); djActivateCurrent(); }
  djSwipeHint();
}

function djTeardown() {
  if (!DJ.active) return;
  DJ.active = false;
  const win = document.getElementById("djr-window");
  if (win) for (const slot of win.children) djClearSlot(slot);
}

// ---------------- finger-tracking pager ----------------
function djWin() { return document.getElementById("djr-window"); }
function djTrackW() {
  const t = document.getElementById("djr-track");
  return t ? t.clientWidth : window.innerWidth;
}
function djSetX(px, animate) {
  const win = djWin();
  if (!win) return;
  win.style.transition = animate ? "transform .28s cubic-bezier(.25,.9,.3,1)" : "none";
  win.style.transform = `translateX(${px}px)`;
}
function djCenter() { djSetX(-djTrackW(), false); }

function djArmPager() {
  const track = document.getElementById("djr-track");
  if (!track || track.dataset.pagered) return;
  track.dataset.pagered = "1";
  let tapX = 0, tapY = 0;
  track.addEventListener("pointerdown", e => {
    if (DG.animating) { if (DG.finish) DG.finish(); else return; }
    DG.down = true; DG.sx = e.clientX; DG.sy = e.clientY; tapX = e.clientX; tapY = e.clientY;
    DG.dx = 0; DG.t0 = performance.now(); DG.axis = null;
    DG.W = djTrackW();
    djSetX(-DG.W, false);
  }, { passive: true });
  track.addEventListener("pointermove", e => {
    if (!DG.down || DG.animating) return;
    const dx = e.clientX - DG.sx, dy = e.clientY - DG.sy;
    if (DG.axis === null && (Math.abs(dx) > 7 || Math.abs(dy) > 7)) DG.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    if (DG.axis !== "x") return;
    DG.dx = dx;
    djSetX(-(DG.W || djTrackW()) + dx, false);
  }, { passive: true });
  const finish = () => {
    if (!DG.down) return;
    DG.down = false;
    if (DG.axis === null) { djHandleTap(); djCenter(); return; }
    if (DG.axis !== "x" || DG.animating) { djCenter(); return; }
    const W = DG.W || djTrackW();
    const dt = Math.max(1, performance.now() - DG.t0);
    const vel = Math.abs(DG.dx) / dt;
    const far = Math.abs(DG.dx) > W * 0.20;
    const flick = vel > 0.55 && Math.abs(DG.dx) > 30;
    if (DG.dx < 0 && (far || flick)) djGo(1);
    else if (DG.dx > 0 && (far || flick)) djGo(-1);
    else djCenter();
  };
  track.addEventListener("pointerup", finish, { passive: true });
  track.addEventListener("pointercancel", () => { if (DG.down) { DG.down = false; djCenter(); } }, { passive: true });
}

let _djLastTap = 0;
function djHandleTap() {
  const now = Date.now();
  if (now - _djLastTap < 300) { _djLastTap = 0; djReact(); return; }  // double-tap
  _djLastTap = now;
  setTimeout(() => { if (_djLastTap === now) djSoundTap(); }, 270);   // single tap (confirmed)
}
function djSoundTap() {
  const vid = djActiveVideo();
  if (!vid) return;
  if (vid.muted) {
    vid.muted = false; DJ.muted = false;
    try { sessionStorage.setItem("dj-muted", "0"); } catch (e) {}
    if (typeof soloAudio === "function") soloAudio(vid);
    djApplySoundBtn();
    vid.play().catch(() => {});
  } else if (!vid.paused) vid.pause();
  else vid.play().catch(() => {});
}
async function djReact() {
  const v = DJ.videos[DJ.idx];
  if (!v) return;
  if (typeof haptic === "function") haptic([14, 40, 20]);
  djShowHeart();
  if (!ME) { toast("Log in to react to creations"); return; }
  try {
    const d = await api(`/api/video/${v.id}/like`, { method: "POST" });
    v.likes = d.likes; v.liked = d.liked;
    if (d.liked && typeof burst === "function") { const rail = document.querySelector(".djr-bottom .djr-act"); if (rail) burst(rail); }
  } catch (e) {}
}
function djShowHeart() {
  const track = document.getElementById("djr-track");
  const slide = track && track.children[DJ.idx];
  if (!slide) return;
  const h = document.createElement("div");
  h.className = "dj-heart";
  h.innerHTML = (typeof ic === "function") ? ic("heart", 96) : "❤";
  slide.appendChild(h);
  requestAnimationFrame(() => h.classList.add("go"));
  setTimeout(() => h.remove(), 850);
}

function djGo(dir) {
  if (DG.animating) { return; }
  if (dir === 1) {
    if (DJ.videos[DJ.idx + 1]) { djGoAnimated(1); return; }
    if (djCanShuffle()) {
      djShowLoad(true);
      djEnsureNext().then(() => {
        djShowLoad(false);
        if (DJ.videos[DJ.idx + 1]) djGoAnimated(1); else { djCenter(); djReplay(); }
      });
      return;
    }
    djCenter(); djReplay(); return;
  }
  if (DJ.idx > 0) { djPaintWindow(); djGoAnimated(-1); } else djCenter();
}
function djGoAnimated(dir) {
  if (DG.animating) { if (DG.finish) DG.finish(); else djCenter(); return; }
  const W = djTrackW();
  const valid = dir === 1 ? !!DJ.videos[DJ.idx + 1] : DJ.idx > 0;
  if (!valid) { djCenter(); return; }
  DG.animating = true;
  djSetX(dir === 1 ? -2 * W : 0, true);
  let done = false;
  const after = () => {
    if (done) return; done = true;
    DG.finish = null;
    DJ.idx += dir;
    if (dir === 1) djEnsureNext();
    djPaintWindow();
    djSetX(-djTrackW(), false);
    DG.animating = false;
    djActivateCurrent();
  };
  DG.finish = after;
  djWin().addEventListener("transitionend", after, { once: true });
  setTimeout(after, 320);
}

// ---------------- slots ----------------
function djSlideHTML(v) {
  return `${v.poster ? `<img class="djr-bg" src="${v.poster}" alt="" loading="lazy">` : ""}`;
}
function djClearSlot(slot) {
  if (!slot) return;
  const vid = slot.querySelector("video");
  if (vid) { try { vid.pause(); } catch (e) {} vid.removeAttribute("src"); vid.load(); }
  slot.innerHTML = "";
  delete slot.dataset.vid;
}
function djBuildSlot(slot, v, resumeAt) {
  djClearSlot(slot);
  if (!v) return;
  slot.dataset.vid = String(v.id);
  slot.innerHTML = djSlideHTML(v);
  const el = document.createElement("video");
  el.setAttribute("playsinline", ""); el.playsInline = true;
  el.preload = "auto"; el.muted = DJ.muted;
  if (v.poster) el.poster = v.poster;
  el.addEventListener("ended", () => {
    if (slot.dataset.slot === "1" && DJ.videos[DJ.idx] && DJ.videos[DJ.idx].id === v.id) djAutoNext();
  });
  el.addEventListener("timeupdate", () => { if (slot.dataset.slot === "1") { DJ.positions.set(DJ.idx, el.currentTime); djProgress(el); } });
  el.addEventListener("waiting", () => { if (slot.dataset.slot === "1") djShowLoad(true); });
  el.addEventListener("playing", () => { if (slot.dataset.slot === "1") djShowLoad(false); });
  el.addEventListener("canplay", () => { if (slot.dataset.slot === "1") djShowLoad(false); });
  el.addEventListener("error", () => { if (slot.dataset.slot === "1") djShowError(slot, DJ.idx); });
  if (resumeAt != null && resumeAt > 0.5) {
    const applyResume = () => {
      if (el.duration && resumeAt >= el.duration - 1) return;   // finished video → clean replay
      try { el.currentTime = resumeAt; } catch (e) {}
    };
    if (el.readyState >= 1) applyResume();
    else el.addEventListener("loadedmetadata", applyResume, { once: true });
  }
  el.src = v.src;
  slot.appendChild(el);
}
function djResumeFor(i) {
  const pos = DJ.positions.get(i);
  if (pos == null || pos <= 0.5) return null;
  return pos;
}
function djPaintWindow() {
  const win = djWin();
  if (!win) return;
  const slots = [...win.children];
  const hist = [DJ.idx - 1, DJ.idx, DJ.idx + 1];
  slots.forEach((slot, i) => {
    slot.dataset.slot = String(i);
    const v = DJ.videos[hist[i]];
    if (!v) { djClearSlot(slot); return; }
    if (slot.dataset.vid === String(v.id)) return;
    djBuildSlot(slot, v, djResumeFor(hist[i]));
  });
}
function djActiveVideo() {
  const win = djWin();
  const slot = win && win.children[1];
  return slot && slot.querySelector("video");
}

// ---------------- pool (forward shuffle) ----------------
async function djEnsureNext() {
  if (DJ.videos[DJ.idx + 1]) return;
  if (!djCanShuffle()) return;
  let guard = 0;
  while (!DJ.videos[DJ.idx + 1] && guard++ < 24) {
    if (!DJ.pool.length) { await djRefillPool(); if (!DJ.pool.length) break; }
    const cand = DJ.pool.shift();
    const recent = DJ.videos.slice(Math.max(0, DJ.idx - 7));
    if (!recent.some(v => v.id === cand.id)) { DJ.videos.push(cand); break; }
    DJ.pool.push(cand);                  // rotate to the back — keeps the wall endless
  }
}
async function djRefillPool() {
  if (!djCanShuffle() || DJ.loading) return;
  DJ.loading = true;
  let vids = await djFetch(DJ.source, DJ.offset);
  if (!vids.length && DJ.offset > 0) { DJ.offset = 0; vids = await djFetch(DJ.source, 0); }  // wrap → truly endless
  DJ.loading = false;
  if (!vids.length) { DJ.done = true; return; }
  DJ.offset += vids.length;
  DJ.pool = DJ.pool.concat(djShuffle(vids));
}
function djPreloadPoolSoon() {
  if (djCanShuffle() && !DJ.done && DJ.pool.length < 4) djRefillPool();
}

// ---------------- active video ----------------
function djActivateCurrent() {
  if (typeof haptic === "function") haptic(7);
  const win = djWin();
  if (!win) return;
  const slots = [...win.children];
  for (let j = 0; j < slots.length; j++) {
    const vel = slots[j].querySelector("video");
    if (vel && j !== 1) vel.pause();
  }
  const cur = djActiveVideo();
  if (cur) {
    const pos = DJ.positions.get(DJ.idx);
    if (pos != null && pos > 0.5) {
      const doSeek = () => {
        if (cur.duration && pos >= cur.duration - 1) { cur.currentTime = 0; DJ.positions.set(DJ.idx, 0); return; }
        try { cur.currentTime = pos; } catch (e) {}
      };
      if (cur.readyState >= 1) doSeek();
      else cur.addEventListener("loadedmetadata", doSeek, { once: true });
    }
    cur.muted = DJ.muted;
    const p = cur.play();
    if (p) p.catch(() => {
      cur.muted = true;
      if (!DJ.muted) { djApplySoundBtn(); djSoundHint(); }
      cur.play().catch(() => {});
    });
  }
  djUpdateOverlay();
  djEnsureNext();
  djPreloadPoolSoon();
}
function djAutoNext() {
  if (DJ.videos[DJ.idx + 1] || djCanShuffle()) djGo(1);
  else djReplay();
}
function djReplay() {
  const el = djActiveVideo();
  if (el) { el.currentTime = 0; DJ.positions.set(DJ.idx, 0); el.play().catch(() => {}); }
}

async function djFetch(source, offset) {
  try {
    if (source.type === "trending" || source.type === "new") {
      const d = await api(`/api/discover?filter=${source.type}&limit=${DJ.batch}&offset=${offset}`);
      return d.videos || [];
    }
    if (source.type === "category") {
      const d = await api(`/api/category/${encodeURIComponent(source.slug)}`);
      return d.videos || [];
    }
    if (source.type === "search") {
      const d = await api(`/api/search?q=${encodeURIComponent(source.q)}`);
      return d.videos || [];
    }
    if (source.type === "story") {
      const d = await api(`/api/journey-story/${source.id}`);
      const list = [];
      if (d.original) list.push({ ...d.original, djChapter: "THE ORIGINAL" });
      (d.arc || []).forEach(v => list.push({ ...v, djChapter: `RECREATE · ATTEMPT #${v.attempt_no}${v.score != null ? ` · ${v.score}%` : ""}` }));
      (d.beatits || []).forEach(v => list.push({ ...v, djChapter: `BEAT IT · FINAL${v.score != null ? ` · ${v.score}%` : ""}` }));
      if (d.champion_video) list.push({ ...d.champion_video, djChapter: "CHAMPION" });
      return list;
    }
    if (source.type === "list") return source.videos || [];
  } catch (e) { /* fall through */ }
  return [];
}

async function djEnter(source, startIdx) {
  const srcEl = document.getElementById("djr-src");
  if (srcEl) srcEl.textContent = source.label || "DISCOVERY";
  const key = djSourceKey(source);
  if (key !== DJ.curKey || !DJ.videos.length) {
    DJ.source = source; DJ.curKey = key; DJ.done = false; DJ.positions.clear();
    DJ.pool = []; DJ.offset = 0;
    djShowLoad(true);
    let vids = await djFetch(source, 0);
    djShowLoad(false);
    if (djCanShuffle() && vids.length) {
      djShuffle(vids);
      DJ.offset = vids.length;
      DJ.pool = vids.slice(1);
      DJ.videos = [vids[0]];
      DJ.idx = 0;
    } else {
      DJ.offset = vids.length;
      DJ.videos = vids;
      DJ.idx = Math.max(0, Math.min(startIdx || 0, Math.max(0, vids.length - 1)));
      if (source.type !== "trending" && source.type !== "new") DJ.done = true;
    }
    if (!DJ.videos.length) {
      const slot = djWin() && djWin().children[1];
      if (slot) slot.innerHTML = `<div class="djr-empty">${ic("film", 26)}<span>Nothing here yet — be the first to CREATE IT.</span></div>`;
      return;
    }
  } else {
    DJ.idx = Math.max(0, Math.min(startIdx || 0, DJ.videos.length - 1));
  }
  djPaintWindow();
  djCenter();
  djActivateCurrent();
}

// ---------------- overlay ----------------
function djUpdateOverlay() {
  const v = DJ.videos[DJ.idx];
  if (!v) return;
  let kicker, sub;
  if (v.djChapter) { kicker = v.djChapter; sub = v.challenge ? `${v.challenge.code} · ${v.challenge.title}` : ""; }
  else if (v.kind === "creation") {
    if (v.challenge) { kicker = `OFFICIAL CREATEIT CHALLENGE · ${v.challenge.code}`; sub = v.challenge.title; }
    else { kicker = "ORIGINAL CREATION"; sub = "POTENTIAL CREATEIT CHALLENGE"; }
  }
  else if (v.kind === "beatit") { kicker = `BEAT IT · FINAL${v.score != null ? ` · ${v.score}%` : ""}`; sub = v.challenge ? `${v.challenge.code} · ${v.challenge.title}` : ""; }
  else { kicker = `ATTEMPT #${v.attempt_no || "?"}${v.score != null ? ` · ${v.score}% MATCH` : ""}`; sub = v.challenge ? `${v.challenge.code} · ${v.challenge.title}` : ""; }
  const info = document.getElementById("djr-info");
  if (info) info.innerHTML = `
    <div class="djr-kicker">${kicker}</div>
    <div class="djr-crow">
      <div class="djr-creator" data-nav="/user/${v.owner.username}">${avatar(v.owner, "sm")} <b>@${esc(v.owner.username)}</b></div>
      ${ME && ME.username !== v.owner.username ? (() => {
        const f = (typeof FOLLOW_STATE !== "undefined" && v.owner.username in FOLLOW_STATE) ? FOLLOW_STATE[v.owner.username] : !!v.owner.you_follow;
        return `<button class="djr-follow ${f ? "on" : ""}" data-follow="${esc(v.owner.username)}" data-follow-style="chip">${f ? "FOLLOWING ✓" : "FOLLOW"}</button>`;
      })() : ""}
    </div>
    ${v.title ? `<div class="djr-title">${esc(v.title)}</div>` : ""}
    ${sub ? `<div class="djr-sub">${esc(sub)}</div>` : ""}`;
  // follow handled globally via [data-follow]; keep the global cache warm from fresh server data
  if (typeof FOLLOW_STATE !== "undefined" && v.owner && v.owner.you_follow !== undefined && !(v.owner.username in FOLLOW_STATE)) {
    FOLLOW_STATE[v.owner.username] = !!v.owner.you_follow;
  }
  const cn = document.getElementById("djr-c-n");
  if (cn) cn.textContent = v.comments || 0;
  const ra = document.getElementById("djr-rate-avg");
  if (ra) ra.textContent = v.rating && v.rating.count ? v.rating.avg : "";
  const att = document.getElementById("djr-attempt");
  const lbl = document.getElementById("djr-attempt-lbl");
  const ico = att && att.querySelector(".act-ic");
  if (att) {
    att.style.display = "";
    att.classList.remove("djr-view");
    if (v.kind === "creation" && v.challenge) {
      // official CreateIt challenge → challenge flow, not attempts
      att.dataset.mode = "challenge"; att.dataset.cid = v.challenge.id; delete att.dataset.vid2;
      if (ico) ico.innerHTML = ic("refresh", 20);
      lbl.textContent = "RECREATE IT";
      att.dataset.nav = "/challenge/" + v.challenge.id;
    } else if (v.kind === "recreate" && v.challenge) {
      att.dataset.mode = "challenge"; att.dataset.cid = v.challenge.id;
      if (ico) ico.innerHTML = ic("eye", 20);
      lbl.textContent = "VIEW CHALLENGE";
      att.dataset.nav = "/challenge/" + v.challenge.id;
    } else if (v.kind === "beatit" && v.challenge) {
      att.dataset.mode = "challenge"; att.dataset.cid = v.challenge.id;
      if (ico) ico.innerHTML = ic("disc", 20);
      lbl.textContent = "VIEW RECORD";
      att.dataset.nav = "/challenge/" + v.challenge.id;
    } else {
      // normal video → ATTEMPT = save it for later
      att.dataset.mode = "save"; att.dataset.vid2 = v.id; delete att.dataset.nav;
      if (ico) ico.innerHTML = ic("target", 20);
      lbl.textContent = v.saved ? "SAVED ✓" : "ATTEMPT";
      att.classList.toggle("saved", !!v.saved);
    }
  }
  const pb = document.getElementById("djr-pbar");
  if (pb) pb.style.width = "0%";
}
function djProgress(el) {
  const pb = document.getElementById("djr-pbar");
  if (pb && el.duration) pb.style.width = Math.min(100, (el.currentTime / el.duration) * 100) + "%";
}
function djShowLoad(on) {
  const el = document.getElementById("djr-load");
  if (el) el.style.display = on ? "flex" : "none";
}
function djShowError(slide, i) {
  djShowLoad(false);
  if (slide.querySelector(".djr-err")) return;
  slide.insertAdjacentHTML("beforeend", `<div class="djr-err" data-act="dj-retry" data-i="${i}">COULDN'T LOAD THIS — TAP TO RETRY</div>`);
}
function djRetry(i) {
  const win = djWin();
  const slot = win && win.children[1];
  if (!slot) return;
  const err = slot.querySelector(".djr-err"); if (err) err.remove();
  const v = DJ.videos[DJ.idx];
  if (v) djBuildSlot(slot, v);
  const el = slot.querySelector("video"); if (el) el.play().catch(() => {});
}

// ---------------- sound ----------------
function djSoundHint() {
  const b = document.getElementById("djr-sound");
  if (!b) return;
  b.classList.remove("hint"); void b.offsetWidth; b.classList.add("hint");
}
function djApplySoundBtn() {
  const b = document.getElementById("djr-sound");
  if (!b) return;
  b.innerHTML = ic(DJ.muted ? "volumeX" : "volume2", 19);
  b.classList.toggle("on", !DJ.muted);
}
function djToggleSound() {
  DJ.muted = !DJ.muted;
  try { sessionStorage.setItem("dj-muted", DJ.muted ? "1" : "0"); } catch (e) {}
  if (!DJ.muted) { const c = djActiveVideo(); if (c && typeof soloAudio === "function") soloAudio(c); }
  const track = document.getElementById("djr-track");
  if (track) {
    const cur = track.children[DJ.idx] && track.children[DJ.idx].querySelector("video");
    if (cur) cur.muted = DJ.muted;
  }
  djApplySoundBtn();
  if (!DJ.muted) toast("Sound on");
}


// ---------------- rate: vertical swipe bars ----------------
const DJ_RATE_WORDS = ["", "LOW", "GOOD", "IMPRESSIVE", "INSANE", "EXCEPTIONAL"];
function djPaintRate(n) {
  DJ.rateVal = n;
  const num = document.getElementById("drp-num");
  const word = document.getElementById("drp-word");
  const bars = document.getElementById("drp-bars");
  if (num) { num.textContent = n; num.classList.remove("pop"); void num.offsetWidth; num.classList.add("pop"); }
  if (word) word.textContent = DJ_RATE_WORDS[n] || "";
  if (bars) [...bars.children].forEach((b, i) => b.classList.toggle("on", i < n));
}
function djHaptic() { try { if (navigator.vibrate) navigator.vibrate(14); } catch (e) {} }
function djOpenRate() {
  const v = DJ.videos[DJ.idx];
  if (!v) return;
  djPaintRate((v.rating && v.rating.mine) || 3);
  document.getElementById("drp-avg").innerHTML = v.rating && v.rating.count
    ? `COMMUNITY · <b>${v.rating.avg}</b>/5 · ${v.rating.count} rating${v.rating.count === 1 ? "" : "s"}` : "BE THE FIRST TO RATE THIS";
  document.getElementById("djr-ratepop").style.display = "flex";
  djArmRateGestures();
}
function djArmRateGestures() {
  const card = document.getElementById("drp-card");
  if (!card || card.dataset.rated) return;
  card.dataset.rated = "1";
  let sy = 0, startVal = 3, moved = false;
  card.addEventListener("pointerdown", e => {
    if (e.target.closest("#drp-save")) return;
    sy = e.clientY; startVal = DJ.rateVal; moved = false;
    const move = ev => {
      const dy = sy - ev.clientY;                     // up = positive
      if (Math.abs(dy) > 6) moved = true;
      const steps = Math.round(dy / 30);              // tighter steps = sharper response
      const n = Math.max(1, Math.min(5, startVal + steps));
      if (n !== DJ.rateVal) { djPaintRate(n); djHaptic(); }
    };
    const up = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  });
  card.querySelector("#drp-save").addEventListener("click", () => djCommitRate(DJ.rateVal));
}
function djCloseRate() {
  const pop = document.getElementById("djr-ratepop");
  if (pop) pop.style.display = "none";
}
async function djCommitRate(n) {
  djCloseRate();
  const v = DJ.videos[DJ.idx];
  if (!v) return;
  if (!ME) { toast("Log in to rate creations"); setTimeout(() => location.hash = "/login", 400); return; }
  try {
    const d = await api(`/api/video/${v.id}/rate`, { method: "POST", json: { score: n } });
    v.rating = { avg: d.avg, count: d.count, mine: n };
    const ra = document.getElementById("djr-rate-avg");
    if (ra) ra.textContent = d.avg;
    djHaptic();
    toast(`Rated ${n}/5 — ${DJ_RATE_WORDS[n]}`);
  } catch (err) { toast(err.message, true); }
}

// ---------------- comments ----------------
async function djOpenComments() {
  const v = DJ.videos[DJ.idx];
  if (!v) return;
  document.getElementById("djr-sheet").style.display = "flex";
  const body = document.getElementById("djr-sheet-body");
  body.innerHTML = `<div class="loading" style="padding:24px 0"><div class="spinner"></div></div>`;
  try {
    const d = await api(`/api/video/${v.id}`);
    body.innerHTML = d.comments.length ? d.comments.map(c => `
      <div class="c-row"><span class="avatar sm" style="background:var(--surface3);font-weight:800;font-size:12px">${esc((c.username[0] || "?").toUpperCase())}</span>
      <div class="c-body"><b>@${esc(c.username)}</b><span class="t">${timeAgo(c.created_at)}</span><br>${esc(c.text)}</div>
      <button class="c-like ${c.liked ? "on" : ""}" data-clike="${c.id}">${ic("heart", 13)}<em>${c.likes || ""}</em></button></div>`).join("")
      : `<div class="empty" style="padding:18px">No comments yet. Say something.</div>`;
    body.querySelectorAll("[data-clike]").forEach(b => b.addEventListener("click", async () => {
      if (!ME) { toast("Log in to like comments"); return; }
      try {
        const d2 = await api(`/api/comment/${b.dataset.clike}/like`, { method: "POST" });
        b.classList.toggle("on", d2.liked);
        b.querySelector("em").textContent = d2.likes || "";
      } catch (err) { toast(err.message, true); }
    }));
    v.comments = d.video.comments;
    const cn = document.getElementById("djr-c-n"); if (cn) cn.textContent = v.comments;
  } catch (e) { body.innerHTML = `<div class="empty">Could not load comments.</div>`; }
}
function djCloseSheet() { const s = document.getElementById("djr-sheet"); if (s) s.style.display = "none"; }
async function djSendComment() {
  const v = DJ.videos[DJ.idx];
  const inp = document.getElementById("djr-cin");
  if (!v || !inp) return;
  if (!ME) { toast("Log in to join the conversation"); setTimeout(() => location.hash = "/login", 400); return; }
  const text = inp.value.trim();
  if (!text) return;
  try {
    await api(`/api/video/${v.id}/comment`, { method: "POST", json: { text } });
    inp.value = "";
    djOpenComments();
  } catch (err) { toast(err.message, true); }
}

// ---------------- attempt / share ----------------
async function djSaveVideo(btn) {
  if (!ME) { toast("Log in to save videos to your Attempts"); setTimeout(() => location.hash = "/login", 400); return; }
  const v = DJ.videos[DJ.idx];
  if (!v) return;
  try {
    const d = await api(`/api/video/${v.id}/save-toggle`, { method: "POST" });
    v.saved = d.saved;
    const lbl = document.getElementById("djr-attempt-lbl");
    if (lbl) lbl.textContent = d.saved ? "SAVED ✓" : "ATTEMPT";
    btn.classList.toggle("saved", d.saved);
    toast(d.saved ? "Saved to Attempts — go practice." : "Removed from Attempts");
  } catch (err) { toast(err.message, true); }
}

async function djAttempt(btn) {
  if (!ME) { toast("Log in to save challenges to your Attempts"); setTimeout(() => location.hash = "/login", 400); return; }
  const cid = btn.dataset.cid;
  if (!cid) return;
  try {
    const d = await api(`/api/challenge/${cid}/attempt-toggle`, { method: "POST" });
    const lbl = document.getElementById("djr-attempt-lbl");
    if (lbl) lbl.textContent = d.saved ? "SAVED ✓" : "ATTEMPT";
    btn.classList.toggle("saved", d.saved);
    toast(d.saved ? "Saved to Attempts — go practice." : "Removed from Attempts");
  } catch (err) { toast(err.message, true); }
}
async function djShare() {
  const v = DJ.videos[DJ.idx];
  if (!v) return;
  try { await navigator.clipboard.writeText(location.origin + "/#/video/" + v.id); } catch (e) {}
  toast("Link copied — share the ability.");
}

// ---------------- browse overlay ----------------
async function djOpenBrowse() {
  const el = document.getElementById("djr-browse");
  if (!el) return;
  el.style.display = "";
  el.innerHTML = `<div class="djb-inner">
    <div class="djb-top">
      <button class="djr-ico" data-act="dj-close-browse" aria-label="Close">${ic("arrow", 15)}</button>
      <div class="djb-title">Explore CreateIt</div>
    </div>
    <div class="disc-searchbig">${ic("target", 18)}<input id="djb-search" type="search" placeholder="Search abilities, challenges, creators…" autocomplete="off"></div>
    <div id="djb-results" style="display:none"></div>
    <div id="djb-feed"><div class="loading" style="padding:30px 0"><div class="spinner"></div></div></div>
  </div>`;
  const inp = document.getElementById("djb-search");
  let t;
  inp.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => djbSearch(inp.value.trim()), 350); });
  inp.addEventListener("keydown", e => { if (e.key === "Enter") { clearTimeout(t); djbSearch(inp.value.trim()); } });
  djbLoadSections();
}
function djCloseBrowse() { const el = document.getElementById("djr-browse"); if (el) el.style.display = "none"; }

async function djbLoadSections() {
  const feed = document.getElementById("djb-feed");
  if (!feed) return;
  const [jr, cr, tr, ch, ff] = await Promise.allSettled([
    api("/api/journeys"), api("/api/categories"), api("/api/discover?filter=trending&limit=6"), api("/api/challenges"),
    ME ? api("/api/following-feed?limit=6") : Promise.resolve({ videos: [] })]);
  if (!document.getElementById("djb-feed")) return;
  const journeys = jr.status === "fulfilled" ? jr.value.journeys : [];
  const upcoming = jr.status === "fulfilled" ? jr.value.upcoming : [];
  const groups = cr.status === "fulfilled" ? cr.value.groups : [];
  const trend = tr.status === "fulfilled" ? tr.value.videos : [];
  window.__djbTrend = trend;
  const all = ch.status === "fulfilled" ? ch.value.challenges : [];
  const live = all.filter(c => c.stage === "recreate_it");
  const beat = all.filter(c => c.stage === "beat_it" || c.stage === "recreate_closed");
  const fvids = ff.status === "fulfilled" ? (ff.value.videos || []) : [];
  window.__djbFollowing = fvids;
  feed.innerHTML = `
    ${fvids.length ? `<div class="djb-sec">FROM CREATORS YOU FOLLOW</div><div class="grid3">${fvids.map((v, i) => {
      const card = videoCard(v);
      return card.replace('data-act="open-video"', `data-act="dj-pick-following" data-pi="${i}"`);
    }).join("")}</div>` : ""}
    ${(journeys.length || upcoming.length) ? `<div class="djb-sec">OFFICIAL JOURNEYS</div>
      <div class="hscroll">
        ${journeys.map(j => `<div class="jrn-card" data-act="dj-enter-story" data-id="${j.id}" data-label="${esc(j.title)}">
          <span class="jrn-k">OFFICIAL JOURNEY · ${esc(j.challenge.code)}</span>
          <span class="jrn-t">${esc(j.title)}</span><span class="jrn-tag">${esc(j.tagline)}</span>
          <span class="jrn-meta">${j.moments} MOMENTS ${ic("arrow", 12)}</span></div>`).join("")}
        ${upcoming.map(u => `<div class="jrn-card jrn-next" data-nav="/challenge/${u.challenge.id}">
          <span class="jrn-k">IN PRODUCTION · ${esc(u.challenge.code)}</span>
          <span class="jrn-t">THE NEXT JOURNEY</span><span class="jrn-tag">${esc(u.challenge.title)}</span>
          <span class="jrn-meta">WATCH THE FINAL ${ic("arrow", 12)}</span></div>`).join("")}
      </div>` : ""}
    <div class="djb-sec">TOPICS</div>
    <div class="cat-chips" style="margin-bottom:6px">
      ${groups.map(g => [
        `<button class="cat-chip" data-act="dj-enter-cat" data-slug="${g.group.slug}" data-label="${esc(g.group.name)}">ALL ${esc(g.group.name).toUpperCase()}</button>`,
        ...g.children.map(c => `<button class="cat-chip" data-act="dj-enter-cat" data-slug="${c.slug}" data-label="${esc(c.name)}">${esc(c.name)}${c.count ? ` <em>${c.count}</em>` : ""}</button>`)],
      ).flat().join("")}
    </div>
    ${trend.length ? `<div class="djb-sec">TRENDING NOW</div><div class="grid3">${trend.map((v, i) => {
      const card = videoCard(v);
      return card.replace('data-act="open-video"', `data-act="dj-pick-trend" data-pi="${i}"`);
    }).join("")}</div>` : ""}
    ${live.length ? `<div class="djb-sec">OPEN CHALLENGES</div>${live.map(c => `
      <div class="srch-ch-row" data-nav="/challenge/${c.id}">
        <div style="flex:1;min-width:0"><div class="sc-code">${esc(c.code)}</div><div class="sc-title">${esc(c.title)}</div></div>${stagePill(c.stage)}
      </div>`).join("")}` : ""}
    ${beat.length ? `<div class="djb-sec">BEAT IT LIVE</div>${beat.map(c => `
      <div class="srch-ch-row" data-nav="/challenge/${c.id}">
        <div style="flex:1;min-width:0"><div class="sc-code">${esc(c.code)}</div><div class="sc-title">${esc(c.title)}</div></div>${stagePill(c.stage)}
      </div>`).join("")}` : ""}`;
}

async function djbSearch(q) {
  const res = document.getElementById("djb-results");
  const feed = document.getElementById("djb-feed");
  if (!res) return;
  if (!q) { res.style.display = "none"; res.innerHTML = ""; if (feed) feed.style.display = ""; return; }
  res.style.display = "";
  if (feed) feed.style.display = "none";
  res.innerHTML = `<div class="loading" style="padding:24px 0"><div class="spinner"></div></div>`;
  try {
    const d = await api(`/api/search?q=${encodeURIComponent(q)}`);
    window.__djbSearch = { q, videos: d.videos };
    const total = d.videos.length + d.challenges.length + d.creators.length + d.categories.length;
    res.innerHTML = total ? `
      ${d.videos.length ? `<div class="djb-sec">VIDEOS — TAP TO ENTER THE JOURNEY</div><div class="grid3">${d.videos.map((v, i) => {
        const card = videoCard(v);
        return card.replace('data-act="open-video"', `data-act="dj-pick-search" data-pi="${i}"`);
      }).join("")}</div>` : ""}
      ${d.challenges.length ? `<div class="djb-sec">CHALLENGES</div>${d.challenges.map(c => `
        <div class="srch-ch-row" data-nav="/challenge/${c.id}">
          <div style="flex:1;min-width:0"><div class="sc-code">${esc(c.code)}</div><div class="sc-title">${esc(c.title)}</div></div>${stagePill(c.stage)}
        </div>`).join("")}` : ""}
      ${d.creators.length ? `<div class="djb-sec">CREATORS</div>${d.creators.map(u => `
        <div class="srch-creator" data-nav="/user/${u.username}">${avatar(u, "sm")}
          <div><div class="sc-n">${esc(u.display_name)}</div><div class="sc-u">@${esc(u.username)} · ${u.followers} followers</div></div>
        </div>`).join("")}` : ""}
      ${d.categories.length ? `<div class="djb-sec">TOPICS</div><div class="cat-chips">${d.categories.map(c =>
        `<button class="cat-chip" data-act="dj-enter-cat" data-slug="${c.slug}" data-label="${esc(c.name)}">${esc(c.name)}</button>`).join("")}</div>` : ""}`
    : `<div class="empty">${ic("target", 22)}<br>No results for "${esc(q)}". Try "dance", "football" or "cooking".</div>`;
  } catch (e) { res.innerHTML = `<div class="empty">Search failed — try again.</div>`; }
}

// ---------------- browse → journey handoffs ----------------
function djPickFrom(list, label, idx) {
  djCloseBrowse();
  djEnter({ type: "list", label, videos: list }, idx);
}
function djEnterCat(slug, label) {
  djCloseBrowse();
  djEnter({ type: "category", slug, label: label.toUpperCase() }, 0);
}
function djEnterStory(id, label) {
  djCloseBrowse();
  djEnter({ type: "story", id, label: "JOURNEY" }, 0);
}


// ---------------- shared immersive viewer (reused outside /discover) ----------------
const VLISTS = {};
function regList(name, vids) { VLISTS[name] = vids; }
function openViewer(list, idx, label) {
  if (!list || !list.length) return;
  if ((location.hash || "").startsWith("#/discover") && DJ.active) return;
  djTeardown();
  const root = document.getElementById("player-root");
  root.innerHTML = djShell();
  DJ.viewer = true; DJ.active = true;
  try { DJ.muted = sessionStorage.getItem("dj-muted") === "1"; } catch (e) {}
  djApplySoundBtn();
  DJ.source = { type: "viewer", label: label || "WATCH" };
  DJ.curKey = "viewer:" + Date.now();
  DJ.videos = list; DJ.pool = []; DJ.done = true; DJ.positions = new Map();
  DJ.idx = Math.max(0, Math.min(idx || 0, list.length - 1));
  const srcEl = document.getElementById("djr-src"); if (srcEl) srcEl.textContent = DJ.source.label;
  djArmPager();
  djPaintWindow();
  djCenter();
  djActivateCurrent();
}
function closeViewer() {
  djTeardown();
  DJ.viewer = false;
  const root = document.getElementById("player-root");
  if (root) root.innerHTML = "";
}
function viewerFromEl(el) {
  const wrap = el.closest("[data-vlist]");
  const vid = el.dataset.vid;
  if (wrap && VLISTS[wrap.dataset.vlist]) {
    const list = VLISTS[wrap.dataset.vlist];
    const idx = Math.max(0, list.findIndex(v => String(v.id) === String(vid)));
    openViewer(list, idx, wrap.dataset.vlabel || "WATCH");
    return true;
  }
  return false;
}

// ---------------- global wiring ----------------
document.addEventListener("click", e => {
  const pop = e.target.closest("#djr-ratepop");
  if (pop && !e.target.closest(".drp-card")) djCloseRate();
});

window.addEventListener("resize", () => {
  if (DJ.active && djWin()) { djPaintWindow(); djCenter(); }
});

document.addEventListener("click", async e => {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  const act = el.dataset.act;
  if (!act.startsWith("dj-")) return;
  switch (act) {
    case "dj-exit": if (DJ.viewer) closeViewer(); else location.hash = "/"; break;
    case "dj-sound": djToggleSound(); break;
    case "dj-browse": djOpenBrowse(); break;
    case "dj-close-browse": djCloseBrowse(); break;
    case "dj-rate": djOpenRate(); break;
    case "dj-comment": djOpenComments(); break;
    case "dj-close-sheet": djCloseSheet(); break;
    case "dj-send-comment": djSendComment(); break;
    case "dj-share": djShare(); break;
    case "dj-attempt": {
      if (el.dataset.mode === "challenge" && el.dataset.nav) { location.hash = el.dataset.nav; break; }
      if (el.dataset.mode === "save") { djSaveVideo(el); break; }
      djAttempt(el); break;
    }
    case "dj-retry": djRetry(+el.dataset.i); break;
    case "dj-enter-cat": djEnterCat(el.dataset.slug, el.dataset.label || el.dataset.slug); break;
    case "dj-enter-story": djEnterStory(el.dataset.id, el.dataset.label); break;
    case "dj-pick-trend": if (window.__djbTrend) djPickFrom(window.__djbTrend, "TRENDING", +el.dataset.pi); break;
    case "dj-pick-following": if (window.__djbFollowing) djPickFrom(window.__djbFollowing, "FOLLOWING", +el.dataset.pi); break;
    case "dj-pick-search": if (window.__djbSearch) djPickFrom(window.__djbSearch.videos, `SEARCH · ${window.__djbSearch.q.toUpperCase()}`, +el.dataset.pi); break;
  }
});

// point the router at the journey experience
if (typeof VIEWS !== "undefined") VIEWS["/discover"] = viewDiscover;
