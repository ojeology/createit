#!/usr/bin/env python3
"""
CREATEIT — Create It. Recreate It. Beat It.
V1 backend: Flask + SQLite. Human-judged scoring, challenge lifecycle, admin dashboard.
"""
import os, re, uuid, sqlite3, hashlib, secrets, datetime, math
from functools import wraps
from flask import Flask, g, request, jsonify, send_from_directory

BASE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE, "createit.db")
UPLOADS = os.path.join(BASE, "uploads")
os.makedirs(UPLOADS, exist_ok=True)

app = Flask(__name__, static_folder="static", static_url_path="/static")
app.config["MAX_CONTENT_LENGTH"] = 256 * 1024 * 1024
ALLOWED_EXT = {"mp4", "webm", "mov", "m4v", "mkv"}

# ---------------------------------------------------------------- utilities
def now_iso(offset_days=0):
    return (datetime.datetime.utcnow() + datetime.timedelta(days=offset_days)).strftime("%Y-%m-%dT%H:%M:%SZ")

def parse_iso(s):
    if not s: return None
    try: return datetime.datetime.strptime(s, "%Y-%m-%dT%H:%M:%SZ")
    except Exception: return None

def days_ago(s):
    d = parse_iso(s)
    if not d: return 0
    return max(0, (datetime.datetime.utcnow() - d).days)

def db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys=ON")
    return g.db

@app.teardown_appcontext
def _close(exc):
    d = g.pop("db", None)
    if d: d.close()

def q(sql, args=()):  return db().execute(sql, args)
def q1(sql, args=()): return db().execute(sql, args).fetchone()
def qa(sql, args=()): return db().execute(sql, args).fetchall()
def commit():         db().commit()

def hash_pw(pw, salt=None):
    salt = salt or secrets.token_hex(8)
    return salt + ":" + hashlib.sha256((salt + pw).encode()).hexdigest()

def check_pw(pw, stored):
    salt, h = stored.split(":", 1)
    return hashlib.sha256((salt + pw).encode()).hexdigest() == h

def current_user():
    tok = request.cookies.get("ci_token")
    if not tok: return None
    return q1("SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=?", (tok,))

def require_user(f):
    @wraps(f)
    def w(*a, **k):
        u = current_user()
        if not u: return jsonify(error="Login required"), 401
        return f(u, *a, **k)
    return w

def require_admin(f):
    @wraps(f)
    def w(*a, **k):
        u = current_user()
        if not u: return jsonify(error="Login required"), 401
        if not u["is_admin"]: return jsonify(error="Admin only"), 403
        return f(u, *a, **k)
    return w

def notify(user_id, kind, text, link=""):
    q("INSERT INTO notifications (user_id, kind, text, link, read, created_at) VALUES (?,?,?,?,0,?)",
      (user_id, kind, text, link, now_iso()))

STAGES = ["create_it", "recreate_it", "recreate_closed", "beat_it", "champion"]

# ---------------------------------------------------------------- schema + seed
SCHEMA = """
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL,
  pw TEXT NOT NULL, bio TEXT DEFAULT '', avatar TEXT DEFAULT '⭐', color TEXT DEFAULT '#7C5CFF',
  is_admin INTEGER DEFAULT 0, created_at TEXT);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER, created_at TEXT);
CREATE TABLE IF NOT EXISTS follows(id INTEGER PRIMARY KEY, follower_id INTEGER, followee_id INTEGER,
  UNIQUE(follower_id, followee_id));
CREATE TABLE IF NOT EXISTS videos(
  id INTEGER PRIMARY KEY, user_id INTEGER, kind TEXT NOT NULL,            -- creation|recreate|beatit
  challenge_id INTEGER, title TEXT DEFAULT '', description TEXT DEFAULT '',
  file TEXT NOT NULL, status TEXT DEFAULT 'approved',                     -- pending|approved|rejected
  score REAL, attempt_no INTEGER, nominated INTEGER DEFAULT 0, created_at TEXT);
CREATE TABLE IF NOT EXISTS challenges(
  id INTEGER PRIMARY KEY, code TEXT, title TEXT NOT NULL, description TEXT DEFAULT '',
  creator_id INTEGER, original_video_id INTEGER, stage TEXT DEFAULT 'recreate_it',
  recreate_target INTEGER DEFAULT 100, recreate_count INTEGER DEFAULT 0,
  featured INTEGER DEFAULT 0, champion_id INTEGER, champion_video_id INTEGER,
  champion_score REAL, champion_at TEXT, created_at TEXT, closes_at TEXT);
CREATE TABLE IF NOT EXISTS likes(id INTEGER PRIMARY KEY, user_id INTEGER, video_id INTEGER,
  UNIQUE(user_id, video_id));
CREATE TABLE IF NOT EXISTS comments(id INTEGER PRIMARY KEY, user_id INTEGER, video_id INTEGER,
  text TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS notifications(id INTEGER PRIMARY KEY, user_id INTEGER, kind TEXT,
  text TEXT, link TEXT, read INTEGER DEFAULT 0, created_at TEXT);
"""

INDEXES = """
CREATE INDEX IF NOT EXISTS idx_videos_ch ON videos(challenge_id, kind);
CREATE INDEX IF NOT EXISTS idx_videos_user ON videos(user_id, kind);
CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status, kind);
CREATE INDEX IF NOT EXISTS idx_likes_video ON likes(video_id);
CREATE INDEX IF NOT EXISTS idx_likes_user ON likes(user_id, video_id);
CREATE INDEX IF NOT EXISTS idx_comments_video ON comments(video_id);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_follows_target ON follows(followee_id);
CREATE INDEX IF NOT EXISTS idx_follows_src ON follows(follower_id);
"""

def seed_if_empty():
    db().executescript(SCHEMA)
    db().executescript(INDEXES)
    # migrations (safe to re-run)
    try: q("ALTER TABLE challenges ADD COLUMN sponsor TEXT")
    except sqlite3.OperationalError: pass
    # demo sponsor: show the sponsored model in action (never overwrites real data)
    if not q1("SELECT 1 FROM challenges WHERE sponsor IS NOT NULL AND sponsor != ''"):
        q("UPDATE challenges SET sponsor='INDOMIE' WHERE id=3")
    for stmt in ("ALTER TABLE videos ADD COLUMN views INTEGER DEFAULT 0",
                 "ALTER TABLE users ADD COLUMN youtube TEXT DEFAULT ''",
                 "ALTER TABLE users ADD COLUMN tiktok TEXT DEFAULT ''",
                 "ALTER TABLE users ADD COLUMN instagram TEXT DEFAULT ''"):
        try: q(stmt)
        except sqlite3.OperationalError: pass
    commit()
    if q1("SELECT COUNT(*) c FROM users")["c"]:
        return
    def user(un, dn, av, color, bio, admin=0):
        q("INSERT INTO users (username, display_name, pw, bio, avatar, color, is_admin, created_at) VALUES (?,?,?,?,?,?,?,?)",
          (un, dn, hash_pw("admin123" if admin else "demo1234"), bio, av, color, admin, now_iso(-30)))
        return q1("SELECT id FROM users WHERE username=?", (un,))["id"]
    U = {}
    U["admin"] = user("admin", "CreateIt HQ", "🛡️", "#F5C518", "Official CreateIt evaluation team.", 1)
    U["alex"]  = user("alex",  "Alex Okafor",  "🎩", "#FF4D2E", "Street footballer. I made the trick nobody could copy.")
    U["sarah"] = user("sarah", "Sarah Adeyemi","🦋", "#22D3A5", "53 attempts. One champion. The journey is the story.")
    U["david"] = user("david", "David Kim",    "🚀", "#5B8CFF", "I recreate everything. Beat me if you can.")
    U["mike"]  = user("mike",  "Mike Eze",     "⚡", "#FFB300", "98% is not enough.")
    U["john"]  = user("john",  "John Danladi", "🎯", "#FF6FB2", "Precision is a habit.")
    U["zoe"]   = user("zoe",   "Zoe Martins",  "🌙", "#9D6BFF", "Dancer. Creator of the Moonwalk Ladder.")
    U["efe"]   = user("efe",   "Efe Ogbe",     "🧩", "#3ECF8E", "Speedcuber. Blindfolded. 60 seconds.")
    U["nina"]  = user("nina",  "Nina Bello",   "🌶️", "#FF7849", "Chef. I cook fast and I recreate faster.")
    U["tobi"]  = user("tobi",  "Tobi Akin",    "🎲", "#4CC9F0", "Bottle flip scientist.")
    U["kofi"]  = user("kofi",  "Kofi Mensah",  "🥁", "#F4A259", "Drummer with too many hands.")

    def vid(uid, kind, file, title, desc="", status="approved", score=None, attempt=None, ch=None, nominated=0, ago=0):
        q("INSERT INTO videos (user_id, kind, challenge_id, title, description, file, status, score, attempt_no, nominated, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
          (uid, kind, ch, title, desc, file, status, score, attempt, nominated, now_iso(-ago)))
        return q1("SELECT last_insert_rowid() id")["id"]

    def chal(code, title, desc, creator, orig, stage, target, count, featured=0, ago=10, champion=None, champ_vid=None, champ_score=None, champ_ago=0):
        q("INSERT INTO challenges (code, title, description, creator_id, original_video_id, stage, recreate_target, recreate_count, featured, champion_id, champion_video_id, champion_score, champion_at, created_at, closes_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
          (code, title, desc, creator, orig, stage, target, count, featured, champion, champ_vid, champ_score,
           now_iso(-champ_ago) if champ_ago else None, now_iso(-ago), now_iso(-ago + 14)))
        return q1("SELECT last_insert_rowid() id")["id"]

    # ---- Challenge #001 — THE IMPOSSIBLE TRICK — CHAMPION ----
    v = vid(U["alex"], "creation", "c1_original.mp4", "The Impossible Trick", "Ball up the ladder, around the neck, sole roll into a no-look nutmeg. Nobody had done this combo.", ago=26)
    C1 = chal("CREATEIT #001", "THE IMPOSSIBLE TRICK", "Recreate the full combo exactly as @alex performed it. Style counts. Control counts.", U["alex"], v, "champion", 50, 50, ago=26)
    q("UPDATE videos SET challenge_id=? WHERE id=?", (C1, v))
    # Sarah's journey (the story of the platform)
    journey = [(1,41,24),(5,53,21),(10,67,18),(20,78,15),(35,91,12),(49,98,10),(53,100,9)]
    sarah_vids = []
    for no, sc, ago in journey:
        sarah_vids.append(vid(U["sarah"], "recreate", f"c1_sarah_{no}.mp4", f"Attempt #{no}", "The journey continues.", score=sc, attempt=no, ch=C1, ago=ago))
    d_c1 = vid(U["david"], "recreate", "c1_david.mp4", "Attempt #12", "Took me 12 tries to lock the combo.", score=100, attempt=12, ch=C1, ago=11)
    bs = vid(U["sarah"], "beatit", "c1_beat_sarah.mp4", "Beat It — Final Submission", "One final attempt. Added a mid-air sole roll the original never had.", score=104, ch=C1, ago=8)
    bd = vid(U["david"], "beatit", "c1_beat_david.mp4", "Beat It — Final Submission", "Cleaner landing than the original. Judge it.", score=101, ch=C1, ago=8)
    q("UPDATE challenges SET champion_id=?, champion_video_id=?, champion_score=104, champion_at=? WHERE id=?",
      (U["sarah"], bs, now_iso(-7), C1))

    # ---- Challenge #002 — MOONWALK LADDER — RECREATE IT, FEATURED ----
    v2 = vid(U["zoe"], "creation", "c2_original.mp4", "Moonwalk Ladder", "Moonwalk backwards up a ladder while keeping the beat. Looks easy. It is not.", ago=6)
    C2 = chal("CREATEIT #002", "MOONWALK LADDER", "Recreate the moonwalk ladder groove. Timing and smoothness are everything.", U["zoe"], v2, "recreate_it", 1000, 783, featured=1, ago=6)
    q("UPDATE videos SET challenge_id=? WHERE id=?", (C2, v2))
    vid(U["david"], "recreate", "c2_david.mp4", "Attempt #9", "Finally smooth enough.", score=100, attempt=9, ch=C2, ago=2)
    vid(U["mike"],  "recreate", "c2_mike.mp4",  "Attempt #14", "So close. The last step rushed.", score=98, attempt=14, ch=C2, ago=2)
    vid(U["john"],  "recreate", "c2_john.mp4",  "Attempt #6", "Precision run.", score=96, attempt=6, ch=C2, ago=1)
    vid(U["kofi"],  "recreate", "c2_zoe2.mp4",  "Attempt #3", "Drummer rhythm helps.", score=100, attempt=3, ch=C2, ago=3)

    # ---- Challenge #003 — BLINDFOLDED RUBIK 60s — BEAT IT ----
    v3 = vid(U["efe"], "creation", "c3_original.mp4", "Blindfolded Rubik in 60 Seconds", "Solve from any scramble, blindfolded, under one minute.", ago=12)
    C3 = chal("CREATEIT #003", "BLINDFOLDED RUBIK · 60s", "Recreate a blindfolded solve in 60 seconds. Then Beat It by going faster or fancier.", U["efe"], v3, "beat_it", 30, 30, ago=12)
    q("UPDATE videos SET challenge_id=? WHERE id=?", (C3, v3))
    vid(U["david"], "recreate", "c3_david.mp4", "Attempt #4", "58 seconds. Hands shaking.", score=100, attempt=4, ch=C3, ago=6)
    vid(U["nina"],  "recreate", "c3_nina.mp4",  "Attempt #7", "I dream in algorithms now.", score=100, attempt=7, ch=C3, ago=5)
    vid(U["david"], "beatit", "c3_beat_david.mp4", "Beat It — Final Submission", "51 seconds. New record pace.", score=102, ch=C3, ago=1)
    vid(U["nina"],  "beatit", "c3_beat_nina.mp4",  "Beat It — Final Submission", "One-handed attempt. 59 seconds.", score=99, ch=C3, ago=1)

    # ---- Pending submissions (admin queue) + Discover ----
    vid(U["nina"], "creation", "pend_nina.mp4", "Fire Jollof in 30 Seconds", "Full jollof plating in half a minute. I believe this deserves a challenge.", status="pending", nominated=1, ago=1)
    vid(U["tobi"], "creation", "pend_tobi.mp4", "Bottle Flip Ladder Edition", "Five consecutive ladder flips. Submitting for CreateIt consideration.", status="pending", ago=1)
    vid(U["kofi"], "creation", "disc_kofi.mp4", "Drumstick Isolation", "Viral clip — CreateIt scouts flagged this as exceptional.", status="approved", ago=2)

    # ---- Social graph ----
    follows = [("sarah","alex"),("sarah","zoe"),("david","sarah"),("david","alex"),("mike","sarah"),("john","david"),
               ("zoe","sarah"),("efe","david"),("nina","sarah"),("tobi","mike"),("kofi","zoe"),("alex","sarah"),
               ("sarah","david"),("sarah","efe"),("david","zoe"),("mike","david"),("john","sarah"),("nina","efe"),
               ("kofi","sarah"),("tobi","sarah"),("zoe","efe"),("alex","zoe")]
    for a, b in follows:
        q("INSERT OR IGNORE INTO follows (follower_id, followee_id) VALUES (?,?)", (U[a], U[b]))

    # ---- Likes + comments ----
    likes = [(bs,["alex","david","mike","john","zoe","efe","nina","tobi","kofi"]),
             (v,["sarah","david","mike","john","zoe","kofi"]),
             (v2,["sarah","david","mike","john","efe","nina","tobi","kofi","alex"]),
             (sarah_vids[-1],["alex","zoe","david","mike","john","kofi"]),
             (v3,["david","nina","sarah","zoe"])]
    for vidn, users in likes:
        for u2 in users:
            q("INSERT OR IGNORE INTO likes (user_id, video_id) VALUES (?,?)", (U[u2], vidn))
    comments = [(bs,"sarah","FROM 41% TO 104%. This journey is why I love CreateIt. 👑"),
                (bs,"alex","You added something new. That is what Beat It is for. Respect."),
                (v,"sarah","Wait... how did he do that?"),
                (v2,"david","This took me 9 attempts. Do not rush the last step."),
                (v2,"nina","Attempting this tonight. Ladder ordered already 😅"),
                (sarah_vids[0],"zoe","Everyone starts somewhere. Watch this journey."),
                (v3,"sarah","Blindfolded?! OK this is special.")]
    for vidn, who, text in comments:
        q("INSERT INTO comments (user_id, video_id, text, created_at) VALUES (?,?,?,?)", (U[who], vidn, text, now_iso(-1)))

    notify(U["sarah"], "champion", "You are the CHAMPION of CREATEIT #001 — THE IMPOSSIBLE TRICK, with a final score of 104%.", "/challenge/1")
    notify(U["david"], "stage", "CREATEIT #003 entered BEAT IT. You are qualified — you have ONE FINAL SUBMISSION.", "/challenge/3")
    notify(U["nina"], "stage", "CREATEIT #003 entered BEAT IT. You are qualified — you have ONE FINAL SUBMISSION.", "/challenge/3")
    notify(U["nina"], "review", "Your submission 'Fire Jollof in 30 Seconds' is under review by CreateIt.", "/notifications")
    commit()

# ---------------------------------------------------------------- serializers
def users_pub_map(uids):
    """Batched user serialization — 3 queries for any number of users."""
    uids = list({u for u in uids if u})
    if not uids: return {}
    ph = ",".join("?" * len(uids))
    users = {r["id"]: r for r in qa(f"SELECT * FROM users WHERE id IN ({ph})", tuple(uids))}
    fwers = {a: b for a, b in qa(f"SELECT followee_id, COUNT(*) FROM follows WHERE followee_id IN ({ph}) GROUP BY followee_id", tuple(uids))}
    fwing = {a: b for a, b in qa(f"SELECT follower_id, COUNT(*) FROM follows WHERE follower_id IN ({ph}) GROUP BY follower_id", tuple(uids))}
    out = {}
    for i, r in users.items():
        keys = r.keys()
        out[i] = {
            "id": r["id"], "username": r["username"], "display_name": r["display_name"],
            "avatar": r["avatar"], "color": r["color"], "bio": r["bio"], "is_admin": bool(r["is_admin"]),
            "followers": fwers.get(i, 0), "following": fwing.get(i, 0),
            "socials": {"youtube": (r["youtube"] or "") if "youtube" in keys else "",
                        "tiktok": (r["tiktok"] or "") if "tiktok" in keys else "",
                        "instagram": (r["instagram"] or "") if "instagram" in keys else ""},
        }
    return out

def user_pub(uid_or_row):
    rid = uid_or_row["id"] if isinstance(uid_or_row, sqlite3.Row) else uid_or_row
    return users_pub_map([rid]).get(rid)

def _poster_for(file):
    stem = os.path.splitext(file)[0]
    return f"/uploads/posters/{stem}.jpg" if os.path.exists(os.path.join(UPLOADS, "posters", stem + ".jpg")) else None

def videos_pub(rows, me=None):
    """Batched video serialization — ~6 queries total for any number of videos."""
    rows = list(rows)
    if not rows: return []
    me_id = me["id"] if me else None
    vids = [r["id"] for r in rows]
    ph = ",".join("?" * len(vids))
    like_c = {a: b for a, b in qa(f"SELECT video_id, COUNT(*) FROM likes WHERE video_id IN ({ph}) GROUP BY video_id", tuple(vids))}
    com_c = {a: b for a, b in qa(f"SELECT video_id, COUNT(*) FROM comments WHERE video_id IN ({ph}) GROUP BY video_id", tuple(vids))}
    liked = set()
    if me_id:
        liked = {x[0] for x in qa(f"SELECT video_id FROM likes WHERE user_id=? AND video_id IN ({ph})", (me_id, *vids))}
    owners = users_pub_map([r["user_id"] for r in rows])
    ch_ids = list({r["challenge_id"] for r in rows if r["challenge_id"]})
    chs = {}
    if ch_ids:
        phc = ",".join("?" * len(ch_ids))
        chs = {r["id"]: {"id": r["id"], "code": r["code"], "title": r["title"], "stage": r["stage"]}
               for r in qa(f"SELECT id, code, title, stage FROM challenges WHERE id IN ({phc})", tuple(ch_ids))}
    out = []
    for r in rows:
        out.append({
            "id": r["id"], "kind": r["kind"], "title": r["title"], "description": r["description"],
            "src": "/uploads/" + r["file"], "poster": _poster_for(r["file"]), "status": r["status"], "score": r["score"],
            "views": (r["views"] or 0) if "views" in r.keys() else 0,
            "attempt_no": r["attempt_no"], "nominated": bool(r["nominated"]), "created_at": r["created_at"],
            "owner": owners.get(r["user_id"]),
            "challenge": chs.get(r["challenge_id"]),
            "likes": like_c.get(r["id"], 0), "liked": r["id"] in liked, "comments": com_c.get(r["id"], 0),
        })
    return out

def video_pub(r, me=None):
    return videos_pub([r], me)[0]

def get_video(vid):
    return q1("SELECT * FROM videos WHERE id=?", (vid,))

def challenges_pub(rows, me=None):
    """Batched challenge serialization — ~8 queries total for any number of challenges."""
    rows = list(rows)
    if not rows: return []
    me_id = me["id"] if me else None
    cids = [r["id"] for r in rows]
    ph = ",".join("?" * len(cids))
    stats = {}
    for x in qa(f"""SELECT challenge_id, COUNT(DISTINCT user_id) p, COUNT(*) a,
                    COUNT(DISTINCT CASE WHEN score>=100 THEN user_id END) q
                    FROM videos WHERE challenge_id IN ({ph}) AND kind='recreate' GROUP BY challenge_id""", tuple(cids)):
        stats[x[0]] = {"p": x[1], "a": x[2], "q": x[3]}
    tops = {}
    for x in qa(f"""SELECT challenge_id, user_id, MAX(score) s FROM videos
                    WHERE challenge_id IN ({ph}) AND kind='recreate' AND score IS NOT NULL GROUP BY challenge_id""", tuple(cids)):
        tops[x[0]] = (x[1], x[2])
    orig_ids = [r["original_video_id"] for r in rows if r["original_video_id"]]
    origs = {}
    if orig_ids:
        pho = ",".join("?" * len(orig_ids))
        origs = {r["id"]: r for r in qa(f"SELECT * FROM videos WHERE id IN ({pho})", tuple(orig_ids))}
        origs = {vid: v for vid, v in zip(orig_ids, videos_pub([origs[i] for i in orig_ids], me))}
    uid_needed = {r["creator_id"] for r in rows} | {r["champion_id"] for r in rows if r["champion_id"]} | {t[0] for t in tops.values()}
    umap = users_pub_map(uid_needed)
    mine_stats, mine_beat = {}, set()
    if me_id:
        for x in qa(f"""SELECT challenge_id, COUNT(*) n, MAX(score) best, MAX(CASE WHEN score>=100 THEN 1 ELSE 0 END) qual
                        FROM videos WHERE user_id=? AND kind='recreate' AND challenge_id IN ({ph}) GROUP BY challenge_id""", (me_id, *cids)):
            mine_stats[x[0]] = {"n": x[1], "best": x[2], "qual": x[3]}
        mine_beat = {x[0] for x in qa(f"SELECT challenge_id FROM videos WHERE user_id=? AND kind='beatit' AND challenge_id IN ({ph})", (me_id, *cids))}
    out = []
    for r in rows:
        st = stats.get(r["id"], {"p": 0, "a": 0, "q": 0})
        t = tops.get(r["id"])
        champ = None
        if r["champion_id"]:
            champ = {"user": umap.get(r["champion_id"]), "score": r["champion_score"], "video_id": r["champion_video_id"],
                     "at": r["champion_at"], "unbeaten_days": days_ago(r["champion_at"])}
        closes = parse_iso(r["closes_at"])
        days_left = max(0, (closes - datetime.datetime.utcnow()).days) if closes else None
        mine = None
        if me_id:
            ms = mine_stats.get(r["id"], {"n": 0, "best": None, "qual": 0})
            beat_in = r["id"] in mine_beat
            mine = {"attempts": ms["n"], "best": ms["best"], "qualified": bool(ms["qual"]),
                    "beatit_submitted": beat_in,
                    "can_recreate": r["stage"] == "recreate_it",
                    "can_beatit": r["stage"] in ("recreate_closed", "beat_it") and bool(ms["qual"]) and not beat_in}
        out.append({
            "id": r["id"], "code": r["code"], "title": r["title"], "description": r["description"],
            "stage": r["stage"], "recreate_target": r["recreate_target"], "recreate_count": r["recreate_count"],
            "featured": bool(r["featured"]), "participants": st["p"], "qualified": st["q"],
            "days_left": days_left, "created_at": r["created_at"], "closes_at": r["closes_at"],
            "attempts_total": st["a"], "top": ({"user": umap.get(t[0]), "score": t[1]} if t else None),
            "sponsor": (r["sponsor"] if "sponsor" in r.keys() else None),
            "creator": umap.get(r["creator_id"]), "original_video": origs.get(r["original_video_id"]), "champion": champ,
            "mine": mine,
        })
    return out

def challenge_pub(r, me=None):
    return challenges_pub([r], me)[0]

def get_challenge(cid):
    return q1("SELECT * FROM challenges WHERE id=?", (cid,))

def notif_pub(r):
    return {"id": r["id"], "kind": r["kind"], "text": r["text"], "link": r["link"], "read": bool(r["read"]), "created_at": r["created_at"]}

# ---------------------------------------------------------------- auth
@app.post("/api/register")
def register():
    d = request.get_json(silent=True) or {}
    un = (d.get("username") or "").strip().lower()
    dn = (d.get("display_name") or "").strip() or un.title()
    pw = d.get("password") or ""
    if not re.fullmatch(r"[a-z0-9_]{3,20}", un): return jsonify(error="Username: 3–20 chars, a-z 0-9 _"), 400
    if len(pw) < 6: return jsonify(error="Password must be at least 6 characters"), 400
    if q1("SELECT 1 FROM users WHERE username=?", (un,)): return jsonify(error="Username already taken"), 400
    q("INSERT INTO users (username, display_name, pw, bio, avatar, color, created_at) VALUES (?,?,?,?,?,?,?)",
      (un, dn, hash_pw(pw), "", "🌟", secrets.choice(["#FF4D2E", "#22D3A5", "#7C5CFF", "#FFB300", "#5B8CFF", "#FF6FB2"]), now_iso()))
    uid = q1("SELECT id FROM users WHERE username=?", (un,))["id"]
    tok = secrets.token_hex(24)
    q("INSERT INTO sessions VALUES (?,?,?)", (tok, uid, now_iso()))
    notify(uid, "welcome", "Welcome to CreateIt. Upload something uniquely yours — followers don't matter here.", "/create")
    commit()
    resp = jsonify(me=user_pub(uid)); resp.set_cookie("ci_token", tok, httponly=True, samesite="Lax", max_age=86400*30)
    return resp

@app.post("/api/login")
def login():
    d = request.get_json(silent=True) or {}
    u = q1("SELECT * FROM users WHERE username=?", ((d.get("username") or "").strip().lower(),))
    if not u or not check_pw(d.get("password") or "", u["pw"]):
        return jsonify(error="Invalid username or password"), 401
    tok = secrets.token_hex(24)
    q("INSERT INTO sessions VALUES (?,?,?)", (tok, u["id"], now_iso())); commit()
    resp = jsonify(me=user_pub(u)); resp.set_cookie("ci_token", tok, httponly=True, samesite="Lax", max_age=86400*30)
    return resp

@app.post("/api/logout")
def logout():
    tok = request.cookies.get("ci_token")
    if tok: q("DELETE FROM sessions WHERE token=?", (tok,)); commit()
    resp = jsonify(ok=True); resp.delete_cookie("ci_token"); return resp

@app.get("/api/me")
def me():
    u = current_user()
    if not u: return jsonify(me=None)
    unread = q1("SELECT COUNT(*) c FROM notifications WHERE user_id=? AND read=0", (u["id"],))["c"]
    return jsonify(me={**user_pub(u), "unread": unread})

# ---------------------------------------------------------------- home & discovery
@app.get("/api/home")
def home():
    me = current_user()
    feat = q1("SELECT * FROM challenges WHERE featured=1 ORDER BY id DESC") or \
           q1("SELECT * FROM challenges WHERE stage='recreate_it' ORDER BY id DESC")
    live_rows = qa("SELECT * FROM challenges WHERE stage='recreate_it' ORDER BY id DESC")
    beat_rows = qa("SELECT * FROM challenges WHERE stage IN ('recreate_closed','beat_it') ORDER BY id DESC")
    champ_rows = qa("SELECT * FROM challenges WHERE stage='champion' ORDER BY champion_at DESC LIMIT 6")
    spon_rows = qa("SELECT * FROM challenges WHERE sponsor IS NOT NULL AND sponsor != '' ORDER BY id DESC")
    all_ch = {r["id"]: p for r, p in zip(live_rows + beat_rows + champ_rows + spon_rows + ([feat] if feat else []),
                                          challenges_pub(live_rows + beat_rows + champ_rows + spon_rows + ([feat] if feat else []), me))}
    hero = all_ch.get(feat["id"]) if feat else None
    live = [all_ch[r["id"]] for r in live_rows]
    beat = [all_ch[r["id"]] for r in beat_rows]
    champs = [all_ch[r["id"]] for r in champ_rows]
    sponsored = [all_ch[r["id"]] for r in spon_rows]
    trending = videos_pub(qa("SELECT * FROM videos WHERE kind='recreate' AND score IS NOT NULL AND status='approved' ORDER BY score DESC, id DESC LIMIT 8"), me)
    discover = videos_pub(qa("SELECT * FROM videos WHERE kind='creation' AND status='approved' AND id NOT IN (SELECT COALESCE(original_video_id,0) FROM challenges) ORDER BY id DESC LIMIT 8"), me)
    hero_feed = videos_pub(qa("SELECT * FROM videos WHERE challenge_id=? AND kind='recreate' AND status='approved' ORDER BY (score IS NULL), id DESC LIMIT 12", (feat["id"],)), me) if feat else []
    feed_create = videos_pub(qa("SELECT * FROM videos WHERE kind='creation' AND status='approved' ORDER BY id DESC LIMIT 10"), me)
    feed_recreate = videos_pub(qa("SELECT * FROM videos WHERE kind='recreate' AND status='approved' AND score>=100 ORDER BY id DESC LIMIT 10"), me)
    feed_beatit = videos_pub(qa("SELECT * FROM videos WHERE kind='beatit' AND status='approved' ORDER BY id DESC LIMIT 10"), me)
    return jsonify(hero=hero, live=live, beat=beat, trending=trending, discover=discover, champions=champs,
                   hero_feed=hero_feed, feed_create=feed_create, feed_recreate=feed_recreate,
                   feed_beatit=feed_beatit, sponsored=sponsored)

@app.get("/api/challenges")
def challenges_list():
    me = current_user()
    stage = request.args.get("stage") or ""
    if stage == "open":   rows = qa("SELECT * FROM challenges WHERE stage IN ('create_it','recreate_it') ORDER BY id DESC")
    elif stage in STAGES: rows = qa("SELECT * FROM challenges WHERE stage=? ORDER BY id DESC", (stage,))
    else:                 rows = qa("SELECT * FROM challenges ORDER BY id DESC")
    return jsonify(challenges=challenges_pub(rows, me))

@app.get("/api/challenge/<int:cid>")
def challenge_detail(cid):
    me = current_user()
    r = get_challenge(cid)
    if not r: return jsonify(error="Not found"), 404
    board = []
    for row in qa("""SELECT v.user_id uid, COUNT(*) n, MAX(v.score) best,
                     MAX(CASE WHEN v.score>=100 THEN 1 ELSE 0 END) qual FROM videos v
                     WHERE v.challenge_id=? AND v.kind='recreate' GROUP BY v.user_id ORDER BY best DESC LIMIT 12""", (cid,)):
        board.append({"user": user_pub(row["uid"]), "attempts": row["n"], "best": row["best"], "qualified": bool(row["qual"])})
    attempts = videos_pub(qa(
        "SELECT * FROM videos WHERE challenge_id=? AND kind='recreate' AND status='approved' ORDER BY COALESCE(score,-1) DESC, id DESC LIMIT 12", (cid,)), me)
    beatits = videos_pub(qa(
        "SELECT * FROM videos WHERE challenge_id=? AND kind='beatit' ORDER BY COALESCE(score,-1) DESC", (cid,)), me)
    return jsonify(challenge=challenge_pub(r, me), leaderboard=board, attempts=attempts, beatits=beatits)

@app.get("/api/video/<int:vid>")
def video_detail(vid):
    me = current_user()
    r = get_video(vid)
    if not r: return jsonify(error="Not found"), 404
    q("UPDATE videos SET views=COALESCE(views,0)+1 WHERE id=?", (vid,)); commit(); r = get_video(vid)
    cs = qa("SELECT c.*, u.username FROM comments c JOIN users u ON u.id=c.user_id WHERE video_id=? ORDER BY c.id DESC LIMIT 50", (vid,))
    comments = [{"id": c["id"], "text": c["text"], "username": c["username"], "created_at": c["created_at"]} for c in cs]
    return jsonify(video=video_pub(r, me), comments=comments)

# ---------------------------------------------------------------- interactions
@app.post("/api/video/<int:vid>/like")
@require_user
def like(u, vid):
    r = get_video(vid)
    if not r: return jsonify(error="Not found"), 404
    if q1("SELECT 1 FROM likes WHERE user_id=? AND video_id=?", (u["id"], vid)):
        q("DELETE FROM likes WHERE user_id=? AND video_id=?", (u["id"], vid)); liked = False
    else:
        q("INSERT INTO likes (user_id, video_id) VALUES (?,?)", (u["id"], vid)); liked = True
        if r["user_id"] != u["id"]:
            notify(r["user_id"], "like", f"@{u['username']} liked your video “{r['title'] or 'Untitled'}”", f"/video/{vid}")
    commit()
    return jsonify(liked=liked, likes=q1("SELECT COUNT(*) c FROM likes WHERE video_id=?", (vid,))["c"])

@app.post("/api/video/<int:vid>/comment")
@require_user
def comment(u, vid):
    d = request.get_json(silent=True) or {}
    text = (d.get("text") or "").strip()
    if not text: return jsonify(error="Empty comment"), 400
    r = get_video(vid)
    if not r: return jsonify(error="Not found"), 404
    q("INSERT INTO comments (user_id, video_id, text, created_at) VALUES (?,?,?,?)", (u["id"], vid, text[:500], now_iso()))
    if r["user_id"] != u["id"]:
        notify(r["user_id"], "comment", f"@{u['username']} commented on “{r['title'] or 'Untitled'}”", f"/video/{vid}")
    commit()
    return jsonify(ok=True, comments=q1("SELECT COUNT(*) c FROM comments WHERE video_id=?", (vid,))["c"])

@app.post("/api/user/<username>/follow")
@require_user
def follow(u, username):
    t = q1("SELECT * FROM users WHERE username=?", (username.lower(),))
    if not t: return jsonify(error="Not found"), 404
    if t["id"] == u["id"]: return jsonify(error="You cannot follow yourself"), 400
    if q1("SELECT 1 FROM follows WHERE follower_id=? AND followee_id=?", (u["id"], t["id"])):
        q("DELETE FROM follows WHERE follower_id=? AND followee_id=?", (u["id"], t["id"])); f = False
    else:
        q("INSERT INTO follows (follower_id, followee_id) VALUES (?,?)", (u["id"], t["id"])); f = True
        notify(t["id"], "follow", f"@{u['username']} started following you", f"/user/{u['username']}")
    commit()
    return jsonify(following=f, followers=q1("SELECT COUNT(*) c FROM follows WHERE followee_id=?", (t["id"],))["c"])

# ---------------------------------------------------------------- profile
@app.get("/api/user/<username>")
def profile(username):
    me = current_user()
    u = q1("SELECT * FROM users WHERE username=?", (username.lower(),))
    if not u: return jsonify(error="Not found"), 404
    pub = user_pub(u)
    pub["following_me"] = False
    if me: pub["i_follow"] = bool(q1("SELECT 1 FROM follows WHERE follower_id=? AND followee_id=?", (me["id"], u["id"])))
    champs = qa("SELECT * FROM challenges WHERE champion_id=? ORDER BY champion_at DESC", (u["id"],))
    completed = q1("SELECT COUNT(DISTINCT challenge_id) c FROM videos WHERE user_id=? AND kind='recreate' AND score>=100", (u["id"],))["c"]
    attempts = q1("SELECT COUNT(*) c FROM videos WHERE user_id=? AND kind='recreate'", (u["id"],))["c"]
    creations = q1("SELECT COUNT(*) c FROM videos WHERE user_id=? AND kind='creation'", (u["id"],))["c"]
    beatit = q1("SELECT COUNT(*) c FROM videos WHERE user_id=? AND kind='beatit'", (u["id"],))["c"]
    journeys = []
    for row in qa("SELECT DISTINCT challenge_id FROM videos WHERE user_id=? AND kind IN ('recreate','beatit') ORDER BY challenge_id DESC", (u["id"],)):
        ch = get_challenge(row["challenge_id"])
        if not ch: continue
        atts = qa("SELECT id, attempt_no, score, kind, created_at FROM videos WHERE challenge_id=? AND user_id=? AND kind='recreate' ORDER BY attempt_no", (ch["id"], u["id"]))
        bt = q1("SELECT id, score FROM videos WHERE challenge_id=? AND user_id=? AND kind='beatit'", (ch["id"], u["id"]))
        journeys.append({
            "challenge": {"id": ch["id"], "code": ch["code"], "title": ch["title"], "stage": ch["stage"]},
            "attempts": [{"id": a["id"], "attempt_no": a["attempt_no"], "score": a["score"]} for a in atts],
            "beatit": {"id": bt["id"], "score": bt["score"]} if bt else None,
            "completed": any(a["score"] is not None and a["score"] >= 100 for a in atts),
            "won": ch["champion_id"] == u["id"],
        })
    creation_list = videos_pub(qa("SELECT * FROM videos WHERE user_id=? AND kind='creation' ORDER BY id DESC", (u["id"],)), me)
    uploads = videos_pub(qa("SELECT * FROM videos WHERE user_id=? ORDER BY id DESC", (u["id"],)), me)
    attempts = videos_pub(qa("SELECT * FROM videos WHERE user_id=? AND kind='recreate' ORDER BY id DESC LIMIT 60", (u["id"],)), me)
    records = [{"challenge": {"id": c["id"], "code": c["code"], "title": c["title"]}, "score": c["champion_score"],
                "unbeaten_days": days_ago(c["champion_at"])} for c in qa("SELECT * FROM challenges WHERE champion_id=? ORDER BY champion_at DESC", (u["id"],))]
    return jsonify(user=pub, stats={"champion": len(champs), "completed": completed, "attempts": attempts,
                                     "creations": creations, "beatit": beatit},
                   champion_of=[{"id": c["id"], "code": c["code"], "title": c["title"], "score": c["champion_score"]} for c in champs],
                   journeys=journeys, creations=creation_list, uploads=uploads, attempts=attempts, records=records)

@app.post("/api/user/socials")
@require_user
def socials_update(u):
    d = request.get_json(silent=True) or {}
    yt = (d.get("youtube") or "").strip()[:160]
    tk = (d.get("tiktok") or "").strip()[:160]
    ig = (d.get("instagram") or "").strip()[:160]
    try:
        q("UPDATE users SET youtube=?, tiktok=?, instagram=? WHERE id=?", (yt, tk, ig, u["id"]))
    except sqlite3.OperationalError:
        return jsonify(error="Socials not available yet"), 400
    commit()
    return jsonify(ok=True)

# ---------------------------------------------------------------- journey
@app.get("/api/journey/<int:cid>/<int:uid>")
def journey(cid, uid):
    me = current_user()
    ch = get_challenge(cid)
    u = q1("SELECT * FROM users WHERE id=?", (uid,))
    if not ch or not u: return jsonify(error="Not found"), 404
    attempts = videos_pub(qa(
        "SELECT * FROM videos WHERE challenge_id=? AND user_id=? AND kind='recreate' ORDER BY attempt_no", (cid, uid)), me)
    beatit = q1("SELECT * FROM videos WHERE challenge_id=? AND user_id=? AND kind='beatit'", (cid, uid))
    return jsonify(user=user_pub(u), challenge=challenge_pub(ch, me), attempts=attempts,
                   beatit=video_pub(beatit, me) if beatit else None)

# ---------------------------------------------------------------- notifications
@app.get("/api/notifications")
@require_user
def notifications(u):
    rows = qa("SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 60", (u["id"],))
    return jsonify(notifications=[notif_pub(r) for r in rows])

@app.post("/api/notifications/read")
@require_user
def notifications_read(u):
    q("UPDATE notifications SET read=1 WHERE user_id=?", (u["id"],)); commit()
    return jsonify(ok=True)

# ---------------------------------------------------------------- upload
def make_poster(saved_path, fname):
    """Best-effort poster frame extraction (keeps pages fast)."""
    try:
        import imageio_ffmpeg, subprocess
        ff = imageio_ffmpeg.get_ffmpeg_exe()
        stem = os.path.splitext(fname)[0]
        out = os.path.join(UPLOADS, "posters", stem + ".jpg")
        os.makedirs(os.path.dirname(out), exist_ok=True)
        subprocess.run([ff, "-hide_banner", "-loglevel", "error", "-ss", "0.7", "-i", saved_path,
                        "-frames:v", "1", "-vf", "scale=360:-2", "-q:v", "4", out, "-y"],
                       timeout=40, check=False)
    except Exception:
        pass

@app.post("/api/upload")
@require_user
def upload(u):
    f = request.files.get("file")
    if not f or not f.filename: return jsonify(error="No video file"), 400
    ext = f.filename.rsplit(".", 1)[-1].lower() if "." in f.filename else ""
    if ext not in ALLOWED_EXT: return jsonify(error=f"Unsupported format .{ext}. Use mp4/webm/mov."), 400
    kind = request.form.get("kind")
    title = (request.form.get("title") or "").strip()[:120]
    desc = (request.form.get("description") or "").strip()[:400]
    cid = request.form.get("challenge_id", type=int)
    fname = f"{uuid.uuid4().hex}.{ext}"
    dest = os.path.join(UPLOADS, fname)
    f.save(dest)
    make_poster(dest, fname)

    if kind == "recreate":
        ch = get_challenge(cid) if cid else None
        if not ch: return jsonify(error="Pick a challenge"), 400
        if ch["stage"] != "recreate_it": return jsonify(error=f"{ch['code']} is not in the RECREATE IT stage"), 400
        n = q1("SELECT COUNT(*) c FROM videos WHERE challenge_id=? AND user_id=? AND kind='recreate'", (cid, u["id"]))["c"] + 1
        q("INSERT INTO videos (user_id, kind, challenge_id, title, description, file, status, attempt_no, created_at) VALUES (?,?,?,?,?,?, 'approved', ?, ?)",
          (u["id"], "recreate", cid, title or f"Attempt #{n}", desc, fname, n, now_iso()))
        vid = q1("SELECT last_insert_rowid() id")["id"]; commit()
        return jsonify(ok=True, video_id=vid, message=f"Attempt #{n} submitted. CreateIt evaluators will score it.")
    if kind == "beatit":
        ch = get_challenge(cid) if cid else None
        if not ch: return jsonify(error="Pick a challenge"), 400
        if ch["stage"] not in ("recreate_closed", "beat_it"): return jsonify(error=f"{ch['code']} is not in the Beat It stage"), 400
        qual = q1("SELECT 1 FROM videos WHERE challenge_id=? AND user_id=? AND kind='recreate' AND score>=100", (cid, u["id"]))
        if not qual: return jsonify(error="You must reach 100% in Recreate It first"), 400
        if q1("SELECT 1 FROM videos WHERE challenge_id=? AND user_id=? AND kind='beatit'", (cid, u["id"])):
            return jsonify(error="You already used your ONE FINAL SUBMISSION"), 400
        q("INSERT INTO videos (user_id, kind, challenge_id, title, description, file, status, created_at) VALUES (?,?,?,?,?,?,'approved',?)",
          (u["id"], "beatit", cid, title or "Beat It — Final Submission", desc, fname, now_iso()))
        vid = q1("SELECT last_insert_rowid() id")["id"]
        if ch["stage"] == "recreate_closed":
            q("UPDATE challenges SET stage='beat_it' WHERE id=?", (cid,))
        commit()
        return jsonify(ok=True, video_id=vid, message="Final submission locked in. One shot. Make it count.")
    # creation / self-nomination
    nominated = 1 if request.form.get("nominated") else 0
    q("INSERT INTO videos (user_id, kind, title, description, file, status, nominated, created_at) VALUES (?,?,?,?,?,'pending',?,?)",
      (u["id"], "creation", title or "Untitled creation", desc, fname, nominated, now_iso()))
    vid = q1("SELECT last_insert_rowid() id")["id"]
    notify(u["id"], "review", f"“{title or 'Your creation'}” was submitted and is under review by CreateIt.", "/notifications")
    commit()
    return jsonify(ok=True, video_id=vid, message="Submitted to CreateIt for review. If it's special enough, it becomes a challenge.")

# ---------------------------------------------------------------- discover feed
@app.get("/api/discover")
def discover_feed():
    me = current_user()
    f = request.args.get("filter") or "trending"
    try: limit = min(int(request.args.get("limit", 30)), 50)
    except ValueError: limit = 30
    if f == "new":
        rows = qa("SELECT * FROM videos WHERE status='approved' ORDER BY id DESC LIMIT ?", (limit,))
    elif f == "originals":
        rows = qa("SELECT * FROM videos WHERE status='approved' AND kind='creation' ORDER BY id DESC LIMIT ?", (limit,))
    elif f == "challenges":
        rows = qa("SELECT * FROM videos WHERE status='approved' AND kind IN ('recreate','beatit') ORDER BY id DESC LIMIT ?", (limit,))
    elif f == "champions":
        rows = qa("SELECT * FROM videos WHERE kind='beatit' AND score IS NOT NULL ORDER BY score DESC LIMIT ?", (limit,))
    else:
        rows = qa("""SELECT v.*, (SELECT COUNT(*) FROM likes l WHERE l.video_id=v.id) lc FROM videos v
                     WHERE v.status='approved' ORDER BY (lc*2 + COALESCE(v.score,0)) DESC, v.id DESC LIMIT ?""", (limit,))
    return jsonify(videos=videos_pub(rows, me), filter=f)

# ---------------------------------------------------------------- leaderboard & records
@app.get("/api/leaderboard")
def leaderboard():
    me = current_user()
    top = []
    for row in qa("""SELECT v.user_id uid, MAX(v.score) best, COUNT(*) n FROM videos v
                     WHERE v.kind='recreate' AND v.score IS NOT NULL GROUP BY v.user_id ORDER BY best DESC, n ASC LIMIT 20"""):
        best_vid = q1("SELECT v.*, c.code, c.id cid FROM videos v JOIN challenges c ON c.id=v.challenge_id WHERE v.user_id=? AND v.kind='recreate' ORDER BY v.score DESC LIMIT 1", (row["uid"],))
        top.append({"user": user_pub(row["uid"]), "best": row["best"], "attempts": row["n"],
                    "challenge_code": best_vid["code"] if best_vid else None, "challenge_id": best_vid["cid"] if best_vid else None})
    champs = []
    for r in qa("SELECT * FROM challenges WHERE stage='champion' ORDER BY champion_at DESC"):
        champs.append({"challenge": {"id": r["id"], "code": r["code"], "title": r["title"]},
                       "champion": user_pub(r["champion_id"]), "score": r["champion_score"], "at": r["champion_at"]})
    records = []
    for r in qa("SELECT * FROM challenges WHERE stage='champion' ORDER BY champion_at ASC"):
        records.append({"challenge": {"id": r["id"], "code": r["code"], "title": r["title"]},
                        "holder": user_pub(r["champion_id"]), "score": r["champion_score"],
                        "unbeaten_days": days_ago(r["champion_at"])})
    return jsonify(top=top, champions=champs, records=records)

# ---------------------------------------------------------------- ADMIN
@app.get("/api/admin/queue")
@require_admin
def admin_queue(u):
    me = current_user()
    pending = videos_pub(qa("SELECT * FROM videos WHERE status='pending' ORDER BY id DESC"), me)
    unscored = videos_pub(qa("SELECT * FROM videos WHERE kind IN ('recreate','beatit') AND score IS NULL AND status='approved' ORDER BY id DESC"), me)
    stats = {"users": q1("SELECT COUNT(*) c FROM users")["c"],
             "videos": q1("SELECT COUNT(*) c FROM videos")["c"],
             "challenges": q1("SELECT COUNT(*) c FROM challenges")["c"],
             "pending": len(pending), "unscored": len(unscored),
             "attempts": q1("SELECT COUNT(*) c FROM videos WHERE kind='recreate'")["c"]}
    return jsonify(pending=pending, unscored=unscored, stats=stats)

@app.post("/api/admin/review")
@require_admin
def admin_review(u):
    d = request.get_json(silent=True) or {}
    r = get_video(d.get("video_id", 0))
    if not r or r["status"] != "pending": return jsonify(error="Not a pending submission"), 404
    action = d.get("action")
    if action == "reject":
        q("UPDATE videos SET status='rejected' WHERE id=?", (r["id"],))
        notify(r["user_id"], "review", f"Your submission “{r['title']}” was not selected this time. Keep creating — the next one might be it.", "/notifications")
        commit(); return jsonify(ok=True)
    if action != "approve": return jsonify(error="Bad action"), 400
    if d.get("make_challenge"):
        code = f"CREATEIT #{q1('SELECT COUNT(*) c FROM challenges')['c'] + 1:03d}"
        q("INSERT INTO challenges (code, title, description, creator_id, original_video_id, stage, recreate_target, recreate_count, featured, created_at, closes_at) VALUES (?,?,?,?,?,'recreate_it',?,0,?,?,?)",
          (code, d.get("title") or r["title"], d.get("description") or r["description"] or "Recreate this creation.",
           r["user_id"], r["id"], int(d.get("target") or 100), int(d.get("featured") or 0), now_iso(), now_iso(14)))
        cid = q1("SELECT last_insert_rowid() id")["id"]
        q("UPDATE videos SET status='approved', challenge_id=? WHERE id=?", (cid, r["id"]))
        notify(r["user_id"], "challenge", f"“{r['title']}” was selected! It is now {code} — you are the benchmark everyone must chase.", f"/challenge/{cid}")
    else:
        q("UPDATE videos SET status='approved' WHERE id=?", (r["id"],))
        notify(r["user_id"], "review", f"Your creation “{r['title']}” was approved and is now live in Discover.", "/")
    commit()
    return jsonify(ok=True)

@app.post("/api/admin/score")
@require_admin
def admin_score(u):
    d = request.get_json(silent=True) or {}
    r = get_video(d.get("video_id", 0))
    if not r: return jsonify(error="Not found"), 404
    try: score = float(d.get("score"))
    except (TypeError, ValueError): return jsonify(error="Bad score"), 400
    if not (0 <= score <= 120): return jsonify(error="Score must be 0–120"), 400
    prev = r["score"]
    q("UPDATE videos SET score=? WHERE id=?", (score, r["id"]))
    if r["kind"] == "recreate" and r["challenge_id"]:
        ch = get_challenge(r["challenge_id"])
        if (prev is None or prev < 100) and score >= 100:
            q("UPDATE challenges SET recreate_count=recreate_count+1 WHERE id=?", (ch["id"],))
        elif prev is not None and prev >= 100 and score < 100:
            q("UPDATE challenges SET recreate_count=MAX(recreate_count-1,0) WHERE id=?", (ch["id"],))
        ch = get_challenge(ch["id"])
        if ch["stage"] == "recreate_it" and ch["recreate_count"] >= ch["recreate_target"]:
            q("UPDATE challenges SET stage='recreate_closed' WHERE id=?", (ch["id"],))
            for row in qa("SELECT DISTINCT user_id FROM videos WHERE challenge_id=? AND kind='recreate' AND score>=100", (ch["id"],)):
                notify(row["user_id"], "stage", f"{ch['code']} hit its recreate target — RECREATE CLOSED. Get ready for BEAT IT.", f"/challenge/{ch['id']}")
    extra = " RECREATE COMPLETE — you are qualified for Beat It!" if r["kind"] == "recreate" and score >= 100 else ""
    notify(r["user_id"], "score", f"CreateIt scored your “{r['title'] or 'submission'}”: {score:g}%.{extra}", f"/video/{r['id']}")
    commit()
    return jsonify(ok=True, score=score)

@app.post("/api/admin/stage")
@require_admin
def admin_stage(u):
    d = request.get_json(silent=True) or {}
    ch = get_challenge(d.get("challenge_id", 0))
    if not ch: return jsonify(error="Not found"), 404
    stage = d.get("stage")
    if stage:
        if stage not in STAGES: return jsonify(error="Bad stage"), 400
        q("UPDATE challenges SET stage=? WHERE id=?", (stage, ch["id"]))
    if d.get("recreate_target"):
        q("UPDATE challenges SET recreate_target=? WHERE id=?", (int(d["recreate_target"]), ch["id"]))
    if d.get("closes_at"):
        q("UPDATE challenges SET closes_at=? WHERE id=?", (d["closes_at"] + "T23:59:59Z", ch["id"]))
    if stage == "beat_it":
        for row in qa("SELECT DISTINCT user_id FROM videos WHERE challenge_id=? AND kind='recreate' AND score>=100", (ch["id"],)):
            notify(row["user_id"], "stage", f"{ch['code']} entered BEAT IT. You are qualified — ONE FINAL SUBMISSION.", f"/challenge/{ch['id']}")
    if stage == "champion" and not ch["champion_id"]:
        pass  # champion must be crowned via /api/admin/crown
    commit()
    return jsonify(ok=True)

@app.post("/api/admin/featured")
@require_admin
def admin_featured(u):
    d = request.get_json(silent=True) or {}
    ch = get_challenge(d.get("challenge_id", 0))
    if not ch: return jsonify(error="Not found"), 404
    q("UPDATE challenges SET featured=0")
    q("UPDATE challenges SET featured=1 WHERE id=?", (ch["id"],))
    notify(ch["creator_id"], "featured", f"You are the CREATEIT CREATOR OF THE WEEK for {ch['code']}!", f"/challenge/{ch['id']}")
    commit()
    return jsonify(ok=True)

@app.post("/api/admin/crown")
@require_admin
def admin_crown(u):
    d = request.get_json(silent=True) or {}
    ch = get_challenge(d.get("challenge_id", 0))
    r = get_video(d.get("video_id", 0))
    if not ch or not r or r["kind"] != "beatit" or r["challenge_id"] != ch["id"]:
        return jsonify(error="Invalid beat-it submission"), 400
    if r["score"] is None: return jsonify(error="Score this submission first"), 400
    q("UPDATE challenges SET stage='champion', champion_id=?, champion_video_id=?, champion_score=?, champion_at=? WHERE id=?",
      (r["user_id"], r["id"], r["score"], now_iso(), ch["id"]))
    notify(r["user_id"], "champion", f"You are the CHAMPION of {ch['code']} — {ch['title']}, with a final score of {r['score']:g}%!", f"/challenge/{ch['id']}")
    for row in qa("SELECT DISTINCT user_id FROM videos WHERE challenge_id=? AND kind='beatit' AND user_id != ?", (ch["id"], r["user_id"])):
        notify(row["user_id"], "champion", f"{ch['code']} has a new champion: @{q1('SELECT username FROM users WHERE id=?',(r['user_id'],))['username']} ({r['score']:g}%). Records can be broken…", f"/challenge/{ch['id']}")
    commit()
    return jsonify(ok=True)

@app.post("/api/admin/sponsor")
@require_admin
def admin_sponsor(u):
    d = request.get_json(silent=True) or {}
    ch = get_challenge(d.get("challenge_id", 0))
    if not ch: return jsonify(error="Not found"), 404
    sponsor = (d.get("sponsor") or "").strip()[:40] or None
    q("UPDATE challenges SET sponsor=? WHERE id=?", (sponsor, ch["id"]))
    commit()
    return jsonify(ok=True, sponsor=sponsor)

@app.get("/api/admin/challenges")
@require_admin
def admin_challenges(u):
    me = current_user()
    rows = qa("SELECT * FROM challenges ORDER BY id DESC")
    out = challenges_pub(rows, me)
    for c in out:
        c["beatits"] = videos_pub(qa("SELECT * FROM videos WHERE challenge_id=? AND kind='beatit' ORDER BY COALESCE(score,-1) DESC", (c["id"],)), me)
    return jsonify(challenges=out)

@app.get("/api/admin/users")
@require_admin
def admin_users(u):
    rows = qa("SELECT * FROM users ORDER BY id")
    return jsonify(users=[user_pub(r) for r in rows])

# ---------------------------------------------------------------- static serving
@app.get("/uploads/<path:fn>")
def uploads_file(fn):
    resp = send_from_directory(UPLOADS, fn, conditional=True)
    if "/posters/" in fn or fn.endswith((".jpg",)):
        resp.headers["Cache-Control"] = "public, max-age=604800"
    else:
        resp.headers["Cache-Control"] = "public, max-age=86400"
    return resp

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def spa(path):
    if path.startswith(("api/", "uploads/", "static/")):
        return jsonify(error="Not found"), 404
    resp = app.send_static_file("index.html")
    resp.headers["Cache-Control"] = "no-cache, must-revalidate"
    return resp

# Seed on import so it works with `python app.py` AND gunicorn (app:app)
with app.app_context():
    seed_if_empty()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8000)), debug=False)
