/* ============================================================
   DISCOVERY JOURNEY — horizontal immersive video universe
   Swipe through people's abilities. One video is the screen.
   ============================================================ */
const DJ = {
  videos: [], idx: 0, muted: true, positions: new Map(),
  source: null, curKey: "", loading: false, done: false, active: false,
  batch: 12, raf: 0,
};

function djSourceKey(src) {
  if (src.type === "list") return "list:" + (src.videos && src.videos[0] ? src.videos[0].id : 0) + ":" + (src.videos ? src.videos.length : 0);
  return src.type + ":" + (src.q || src.slug || src.id || "");
}

// ---------------- shell ----------------
function djShell() {
  return `
  <div class="djr" id="djr">
    <div class="djr-track" id="djr-track"></div>
    <div class="djr-load" id="djr-load" style="display:none">${logoSVG(36)}</div>
    <div class="djr-top">
      <button class="djr-ico djr-back" data-act="dj-exit" aria-label="Back">${ic("arrow", 16)}</button>
      <div class="djr-src" id="djr-src">DISCOVERY</div>
      <div class="djr-topacts">
        <button class="djr-ico" data-act="dj-browse" aria-label="Browse">${ic("globe", 19)}</button>
        <button class="djr-ico" data-act="dj-sound" id="djr-sound" aria-label="Sound">${ic("volumeX", 19)}</button>
      </div>
    </div>
    <div class="djr-count" id="djr-count"></div>
    <div class="djr-bottom">
      <div class="djr-info" id="djr-info"></div>
      <div class="djr-bar">
        <button class="djr-act" data-act="dj-rate">${ic("zap", 20)}<span>RATE</span><em id="djr-rate-n"></em></button>
        <button class="djr-act" data-act="dj-comment">${ic("chat", 20)}<span>COMMENT</span><em id="djr-c-n"></em></button>
        <button class="djr-act" data-act="dj-share">${ic("share", 19)}<span>SHARE</span></button>
        <button class="djr-act djr-go" data-act="dj-attempt" id="djr-attempt">${ic("target", 20)}<span id="djr-attempt-lbl">ATTEMPT</span></button>
      </div>
    </div>
    <div class="djr-progress"><div id="djr-pbar"></div></div>

    <div class="djr-ratepop" id="djr-ratepop" style="display:none">
      <div class="drp-card">
        <div class="drp-h">HOW IMPRESSIVE?</div>
        <div class="drp-gauge" id="drp-gauge">
          ${[5,4,3,2,1].map(n => `<div class="drp-c" data-n="${n}"><b>${n}</b><span>${["","LOW","GOOD","IMPRESSIVE","INSANE","EXCEPTIONAL"][n]}</span></div>`).join("")}
        </div>
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
async function djBoot() {
  const root = document.getElementById("djr");
  if (!root) return;
  DJ.active = true;
  try { DJ.muted = sessionStorage.getItem("dj-muted") !== "0"; } catch (e) {}
  djApplySoundBtn();
  const track = document.getElementById("djr-track");
  track.addEventListener("scroll", djOnScroll, { passive: true });
  if (!DJ.videos.length) await djEnter({ type: "trending", label: "TRENDING" }, 0);
  else { djBuildTrack(); djScrollTo(DJ.idx, false); djActivate(DJ.idx); }
}

function djTeardown() {
  if (!DJ.active) return;
  DJ.active = false;
  const track = document.getElementById("djr-track");
  if (track) { for (const s of track.children) djStripVideo(s); }
}

// ---------------- sources ----------------
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
    djShowLoad(true);
    DJ.videos = await djFetch(source, 0);
    djShowLoad(false);
    if (source.type !== "trending" && source.type !== "new") DJ.done = true;
    if (!DJ.videos.length) {
      const track = document.getElementById("djr-track");
      if (track) track.innerHTML = `<div class="djr-slide"><div class="djr-empty">${ic("film", 26)}<span>Nothing here yet — be the first to CREATE IT.</span></div></div>`;
      return;
    }
    djBuildTrack();
  }
  const i = Math.max(0, Math.min(startIdx || 0, DJ.videos.length - 1));
  djScrollTo(i, false);
  djActivate(i);
}

// ---------------- track & windowing ----------------
function djSlideHTML(v, i) {
  return `<div class="djr-slide" data-i="${i}">
    ${v.poster ? `<img class="djr-bg" src="${v.poster}" alt="" loading="lazy">` : ""}
  </div>`;
}
function djBuildTrack() {
  const track = document.getElementById("djr-track");
  if (!track) return;
  track.innerHTML = DJ.videos.map((v, i) => djSlideHTML(v, i)).join("");
}
function djPageW() {
  const s = document.querySelector("#djr-track .djr-slide");
  return s ? s.clientWidth : window.innerWidth;
}
function djScrollTo(i, smooth) {
  const track = document.getElementById("djr-track");
  if (!track) return;
  track.scrollTo({ left: i * djPageW(), behavior: smooth ? "smooth" : "auto" });
}
function djOnScroll() {
  if (DJ.raf) return;
  DJ.raf = requestAnimationFrame(() => {
    DJ.raf = 0;
    const track = document.getElementById("djr-track");
    if (!track) return;
    const i = Math.round(track.scrollLeft / djPageW());
    if (i !== DJ.idx && i >= 0 && i < DJ.videos.length) djActivate(i);
  });
}

function djMountVideo(slide, i) {
  if (!slide || slide.querySelector("video")) return;
  const v = DJ.videos[i];
  if (!v) return;
  const el = document.createElement("video");
  el.setAttribute("playsinline", ""); el.playsInline = true;
  el.preload = "auto"; el.muted = DJ.muted;
  if (v.poster) el.poster = v.poster;
  el.addEventListener("ended", () => { if (DJ.idx === i) djAutoNext(i); });
  el.addEventListener("timeupdate", () => { if (DJ.idx === i) { DJ.positions.set(i, el.currentTime); djProgress(el); } });
  el.addEventListener("waiting", () => { if (DJ.idx === i) djShowLoad(true); });
  el.addEventListener("playing", () => { if (DJ.idx === i) djShowLoad(false); });
  el.addEventListener("canplay", () => { if (DJ.idx === i) djShowLoad(false); });
  el.addEventListener("error", () => { if (DJ.idx === i) djShowError(slide, i); });
  el.src = v.src;
  slide.appendChild(el);
}
function djStripVideo(slide) {
  const v = slide && slide.querySelector("video");
  if (!v) return;
  try { v.pause(); } catch (e) {}
  v.removeAttribute("src"); v.load();
  v.remove();
}

// ---------------- active video ----------------
function djActivate(i) {
  DJ.idx = i;
  const track = document.getElementById("djr-track");
  if (!track) return;
  const slides = track.children;
  for (let j = 0; j < slides.length; j++) {
    if (Math.abs(j - i) <= 1) djMountVideo(slides[j], j);
    else djStripVideo(slides[j]);
  }
  for (let j = 0; j < slides.length; j++) {
    const vel = slides[j].querySelector && slides[j].querySelector("video");
    if (vel && j !== i) vel.pause();
  }
  const cur = slides[i] && slides[i].querySelector("video");
  if (cur) {
    const pos = DJ.positions.get(i);
    if (pos != null && pos > 0.5) { try { cur.currentTime = pos; } catch (e) {} }
    cur.play().catch(() => {});
  }
  djUpdateOverlay();
  if (DJ.source && (DJ.source.type === "trending" || DJ.source.type === "new") &&
      i >= DJ.videos.length - 3 && !DJ.loading && !DJ.done) djLoadMore();
}

function djAutoNext(i) {
  if (i + 1 < DJ.videos.length) { djScrollTo(i + 1, true); return; }
  if (!DJ.done && DJ.source && (DJ.source.type === "trending" || DJ.source.type === "new")) {
    djLoadMore().then(() => { if (i + 1 < DJ.videos.length) djScrollTo(i + 1, true); else djReplay(i); });
    return;
  }
  djReplay(i);
}
function djReplay(i) {
  const track = document.getElementById("djr-track");
  const el = track && track.children[i] && track.children[i].querySelector("video");
  if (el) { el.currentTime = 0; DJ.positions.set(i, 0); el.play().catch(() => {}); }
}

async function djLoadMore() {
  if (DJ.loading || DJ.done) return;
  DJ.loading = true;
  const vids = await djFetch(DJ.source, DJ.videos.length);
  DJ.loading = false;
  const track = document.getElementById("djr-track");
  if (!track) return;
  if (!vids.length) { DJ.done = true; return; }
  const base = DJ.videos.length;
  DJ.videos = DJ.videos.concat(vids);
  track.insertAdjacentHTML("beforeend", vids.map((v, k) => djSlideHTML(v, base + k)).join(""));
  if (DJ.idx >= DJ.videos.length - 3 && !DJ.done) djLoadMore();
}

// ---------------- overlay ----------------
function djUpdateOverlay() {
  const v = DJ.videos[DJ.idx];
  if (!v) return;
  const cnt = document.getElementById("djr-count");
  if (cnt) cnt.textContent = `${DJ.idx + 1} / ${DJ.videos.length}`;
  let kicker, sub;
  if (v.djChapter) { kicker = v.djChapter; sub = v.challenge ? `${v.challenge.code} · ${v.challenge.title}` : ""; }
  else if (v.kind === "creation") { kicker = "ORIGINAL CREATION"; sub = v.challenge ? `${v.challenge.code} · ${v.challenge.title}` : "POTENTIAL CREATEIT CHALLENGE"; }
  else if (v.kind === "beatit") { kicker = `BEAT IT · FINAL${v.score != null ? ` · ${v.score}%` : ""}`; sub = v.challenge ? `${v.challenge.code} · ${v.challenge.title}` : ""; }
  else { kicker = `ATTEMPT #${v.attempt_no || "?"}${v.score != null ? ` · ${v.score}% MATCH` : ""}`; sub = v.challenge ? `${v.challenge.code} · ${v.challenge.title}` : ""; }
  const info = document.getElementById("djr-info");
  if (info) info.innerHTML = `
    <div class="djr-kicker">${kicker}</div>
    <div class="djr-creator" data-nav="/user/${v.owner.username}">${avatar(v.owner, "sm")} <b>@${esc(v.owner.username)}</b></div>
    ${v.title ? `<div class="djr-title">${esc(v.title)}</div>` : ""}
    ${sub ? `<div class="djr-sub">${esc(sub)}</div>` : ""}`;
  const cn = document.getElementById("djr-c-n");
  if (cn) cn.textContent = v.comments || 0;
  const rn = document.getElementById("djr-rate-n");
  if (rn) rn.textContent = v.rating && v.rating.mine ? `${v.rating.mine}/5` : "";
  const att = document.getElementById("djr-attempt");
  if (att) {
    if (v.challenge) {
      att.style.display = "";
      att.dataset.cid = v.challenge.id;
      document.getElementById("djr-attempt-lbl").textContent = (v.challenge.mine && v.challenge.mine.saved) ? "SAVED ✓" : "ATTEMPT";
    } else att.style.display = "none";
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
  const track = document.getElementById("djr-track");
  const slide = track && track.children[i];
  if (!slide) return;
  const err = slide.querySelector(".djr-err"); if (err) err.remove();
  djStripVideo(slide); djMountVideo(slide, i);
  const el = slide.querySelector("video"); if (el) el.play().catch(() => {});
}

// ---------------- sound ----------------
function djApplySoundBtn() {
  const b = document.getElementById("djr-sound");
  if (!b) return;
  b.innerHTML = ic(DJ.muted ? "volumeX" : "volume2", 19);
  b.classList.toggle("on", !DJ.muted);
}
function djToggleSound() {
  DJ.muted = !DJ.muted;
  try { sessionStorage.setItem("dj-muted", DJ.muted ? "1" : "0"); } catch (e) {}
  const track = document.getElementById("djr-track");
  if (track) {
    const cur = track.children[DJ.idx] && track.children[DJ.idx].querySelector("video");
    if (cur) cur.muted = DJ.muted;
  }
  djApplySoundBtn();
  if (!DJ.muted) toast("Sound on");
}

// ---------------- rating ----------------
function djOpenRate() {
  const v = DJ.videos[DJ.idx];
  if (!v) return;
  const pop = document.getElementById("djr-ratepop");
  const g = document.getElementById("drp-gauge");
  [...g.children].forEach(c => c.classList.toggle("on", !!(v.rating && v.rating.mine) && +c.dataset.n <= v.rating.mine));
  document.getElementById("drp-avg").innerHTML = v.rating && v.rating.count
    ? `<b>${v.rating.avg}</b>/5 · ${v.rating.count} rating${v.rating.count === 1 ? "" : "s"}` : "BE THE FIRST TO RATE";
  pop.style.display = "flex";
}
async function djCommitRate(n) {
  const pop = document.getElementById("djr-ratepop");
  pop.style.display = "none";
  const v = DJ.videos[DJ.idx];
  if (!v) return;
  if (!ME) { toast("Log in to rate creations"); setTimeout(() => location.hash = "/login", 400); return; }
  try {
    const d = await api(`/api/video/${v.id}/rate`, { method: "POST", json: { score: n } });
    v.rating = { avg: d.avg, count: d.count, mine: n };
    const rn = document.getElementById("djr-rate-n");
    if (rn) rn.textContent = `${n}/5`;
    toast(`Rated ${n}/5 — ${RATE_WORDS[n]}`);
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
      <div class="c-body"><b>@${esc(c.username)}</b><span class="t">${timeAgo(c.created_at)}</span><br>${esc(c.text)}</div></div>`).join("")
      : `<div class="empty" style="padding:18px">No comments yet. Say something.</div>`;
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
  const [jr, cr, tr, ch] = await Promise.allSettled([
    api("/api/journeys"), api("/api/categories"), api("/api/discover?filter=trending&limit=6"), api("/api/challenges")]);
  if (!document.getElementById("djb-feed")) return;
  const journeys = jr.status === "fulfilled" ? jr.value.journeys : [];
  const upcoming = jr.status === "fulfilled" ? jr.value.upcoming : [];
  const groups = cr.status === "fulfilled" ? cr.value.groups : [];
  const trend = tr.status === "fulfilled" ? tr.value.videos : [];
  window.__djbTrend = trend;
  const all = ch.status === "fulfilled" ? ch.value.challenges : [];
  const live = all.filter(c => c.stage === "recreate_it");
  const beat = all.filter(c => c.stage === "beat_it" || c.stage === "recreate_closed");
  feed.innerHTML = `
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

// ---------------- wiring (delegated) ----------------
document.addEventListener("pointerdown", e => {
  const g = e.target.closest("#drp-gauge");
  if (!g) return;
  e.preventDefault();
  const move = ev => {
    const r = g.getBoundingClientRect();
    const rel = 1 - (ev.clientY - r.top) / r.height;
    const n = Math.max(1, Math.min(5, Math.ceil(rel * 5)));
    [...g.children].forEach(c => c.classList.toggle("on", +c.dataset.n <= n));
    g.dataset.peek = n;
  };
  move(e);
  const up = () => {
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerup", up);
    const n = +g.dataset.peek || 0;
    if (n) djCommitRate(n);
  };
  document.addEventListener("pointermove", move);
  document.addEventListener("pointerup", up);
});

document.addEventListener("click", e => {
  const pop = e.target.closest("#djr-ratepop");
  if (pop && !e.target.closest(".drp-card")) pop.style.display = "none";
});

document.addEventListener("dj-route", () => {});

// resize: re-snap
window.addEventListener("resize", () => {
  if (DJ.active && document.getElementById("djr-track")) djScrollTo(DJ.idx, false);
});

// ---------------- act delegation for discovery ----------------
document.addEventListener("click", async e => {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  const act = el.dataset.act;
  if (!act.startsWith("dj-")) return;
  switch (act) {
    case "dj-exit": location.hash = "/"; break;
    case "dj-sound": djToggleSound(); break;
    case "dj-browse": djOpenBrowse(); break;
    case "dj-close-browse": djCloseBrowse(); break;
    case "dj-rate": djOpenRate(); break;
    case "dj-comment": djOpenComments(); break;
    case "dj-close-sheet": djCloseSheet(); break;
    case "dj-send-comment": djSendComment(); break;
    case "dj-share": djShare(); break;
    case "dj-attempt": djAttempt(el); break;
    case "dj-retry": djRetry(+el.dataset.i); break;
    case "dj-enter-cat": djEnterCat(el.dataset.slug, el.dataset.label || el.dataset.slug); break;
    case "dj-enter-story": djEnterStory(el.dataset.id, el.dataset.label); break;
    case "dj-pick-trend": if (window.__djbTrend) djPickFrom(window.__djbTrend, "TRENDING", +el.dataset.pi); break;
    case "dj-pick-search": if (window.__djbSearch) djPickFrom(window.__djbSearch.videos, `SEARCH · ${window.__djbSearch.q.toUpperCase()}`, +el.dataset.pi); break;
  }
});

// point the router at the journey experience
if (typeof VIEWS !== "undefined") VIEWS["/discover"] = viewDiscover;
