# CREATEIT — Create It. Recreate It. Beat It.

V1 foundation of a social creativity & competition platform where **the challenge — not the video — is the central object**.
Followers don't decide anything. Performance does.

## Stack
- **Backend:** Python Flask + SQLite (`app.py`) — session-cookie auth, human-judged scoring, challenge lifecycle engine, admin API.
- **Frontend:** vanilla JS SPA (`static/app.js`, `static/style.css`, `static/index.html`) — hash router, immersive video player, challenge cards.
- **Seed content:** 24 generated demo clips in `uploads/`, 11 users, 3 challenges in different lifecycle stages.

## Run
```bash
pip install flask imageio-ffmpeg   # only needed to regenerate demo videos
python3 app.py                     # serves on 0.0.0.0:8000, seeds DB on first run
```
Delete `createit.db` to reset to pristine demo state.

## Demo accounts
| account | password | role |
|---|---|---|
| `admin` | `admin123` | CreateIt HQ — review queue, scoring, stage control, crowning |
| `sarah` | `demo1234` | Champion of #001 (41% → 100% → 104% journey) |
| `david`, `zoe`, `nina`, … | `demo1234` | participants / creators |

## V1 scope (all 18 required items implemented)
Registration/login · profiles · video upload/playback (Range-seekable) · CreateIt submissions with self-nomination ·
challenge creation & pages · recreate submissions · 0–120% scoring (100% = qualified; >100% = original surpassed) ·
six-phase lifecycle (CREATE → RECREATE → CLOSED → BEAT IT → CHAMPION → RECORD) · attempt history & journeys ·
likes/comments/follows · notifications · admin dashboard with approve/reject/make-challenge · leaderboards, champions & unbeaten records.

## The loop, end to end
1. User uploads a creation (optionally self-nominates) → **admin approves → becomes CREATEIT #NNN**.
2. Users attempt it during RECREATE IT (unlimited attempts, each scored by admin, journey recorded).
3. At the recreate target → stage auto-closes; qualified (100%) users are notified.
4. Each qualified user gets **one final Beat It submission** (>100% allowed).
5. Admin crowns a champion → challenge enters RECORD/history.

## Deploy for testing (GitHub + Render)

**GitHub** = code repo · **Render** = the app. Firebase/Netlify don't fit this stack (Flask + SQLite + video uploads) without a rewrite.

```bash
git init && git add -A && git commit -m "CREATEIT V1 foundation"
# create an empty repo on GitHub, then:
git remote add origin https://github.com/<you>/createit.git
git push -u origin main
```

On [render.com](https://render.com) → **New → Blueprint** → pick the repo. `render.yaml` configures everything
(free web service, gunicorn, auto-deploy). It goes live at `https://createit.onrender.com`.

**Know these free-tier behaviors (fine for the testing stage):**
- Service sleeps after 15 min idle → first hit after a pause takes ~30–60 s to wake. ($7/mo Starter removes this.)
- Disk is ephemeral: on each redeploy the DB resets and the app **auto-reseeds pristine demo data** — users you
  registered disappear, but the arena is always ready for fresh testers. Uploaded videos during a test cycle reset too.
- When data must survive: add a Render **persistent disk** ($0.25/GB/mo) and point `DB_PATH`/`UPLOADS` at it,
  or migrate SQLite → Render Postgres + uploads → S3/Cloudinary before public beta.

## Intentionally deferred (future, per vision doc)
AI-assisted scoring · sponsored/celebrity challenges · open challenges · money & rewards · follower-free discovery ranking algorithms.

## Android app (Capacitor)
The native shell lives in `mobile/`. It wraps the live CreateIt backend (`createit.onrender.com`) — the API, videos and database stay server-side; the APK is the native experience around them.

- **App name:** CreateIt · **App ID:** `com.createit.app`
- Plugins: status bar (theme-synced), splash screen, keyboard resize, native back button, offline guard

### Build the APK
**Option A — GitHub Actions (no local Android SDK needed):**
Push to `main` (touching `mobile/` or `static/`) or run the **Android debug APK** workflow manually → download `createit-debug.apk` from the run's artifacts.

**Option B — Android Studio:**
```bash
cd mobile && npm install && npx cap sync android
npx cap open android   # then Run ▶ in Android Studio
```
