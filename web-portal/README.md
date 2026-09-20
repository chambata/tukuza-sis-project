# Tukuza SIS Web Portal

The public-facing half of Tukuza SIS: a small, separate web app meant to be
deployed at `edu.fpuniversitycollege.com` (the URL the main website's
"SIS Portal" nav link already points to).

**This is a read-only replica, not a second copy of the desktop app.** The
desktop app (in `../` — the main Tukuza SIS Electron app) stays the only
place anyone registers a student, records a payment, or enters a result.
This portal only ever *receives* a periodic snapshot from the desktop app
(students with a portal login, their fees, their **published** results,
programmes, and public announcements) and shows it to:

- **Students**, who log in with the same Student ID + password they use on
  the desktop app's own Student Portal
- **The public**, who see programme listings and announcements with no login
  at all — this is what the main website's visitors would see

Nothing a student or visitor does here can ever write back into the desktop
app's database. There is no route in this service that accepts anything
except the one sync endpoint, which only the desktop app (holding the secret
sync key) can call.

## How the sync works

1. On the desktop app, an Administrator or Super Administrator opens
   **Settings → Website Sync**, enters this service's URL and the sync key
   (shown once in this service's own server logs the first time it starts —
   see below), and clicks **Sync Now** (or lets it happen automatically,
   since the desktop app can be extended to run this on a schedule the same
   way it already does daily database backups).
2. The desktop app gathers a safe subset of data — see
   `server/lib/websiteSync.js` in the main project for exactly what's
   included — and POSTs it to this service's `/api/sync` endpoint with the
   key in an `X-Sync-Key` header.
3. This service wipes and reloads its own small database with that payload,
   inside one transaction, so visitors never see a half-updated state.

## Deploying this

This is a normal single-process Node/Express app that serves its own built
React frontend, so it deploys the same way as any small Node web service —
no special hosting is required, just something that can run `npm install &&
npm run build && npm start` and keep the process alive.

### Option A: Render.com (recommended — free tier, minimal setup)

1. Push this repository to GitHub (already done, if you're reading this from
   the repo) and create a free Render account.
2. **New → Web Service**, connect the `tukuza-sis-project` repo, and set:
   - **Root Directory**: `web-portal`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: Free (fine for this — low traffic, small data)
3. Add a **Persistent Disk** (Render's free tier includes a small one) mounted
   at `/data`, and set the environment variable `DATA_DIR=/data` so the
   portal's SQLite database survives restarts/redeploys instead of resetting.
4. Deploy. Watch the deploy logs for the line:
   ```
   [portal] Generated sync API key (copy this into the desktop app,
   [portal] Settings > Website Sync):
   [portal]   <a long random string>
   ```
   Copy that key — it's shown **once**, on first boot. If you miss it, you
   can also set your own by adding the `SYNC_API_KEY` environment variable
   *before* the first deploy (with a value you choose), or by shelling into
   the persistent disk later and reading `settings` table's `sync_api_key`
   row directly.
5. In Render's dashboard, add a **Custom Domain**: `edu.fpuniversitycollege.com`,
   and follow Render's instructions to add the CNAME record it gives you at
   wherever `fpuniversitycollege.com`'s DNS is managed. Render provisions
   HTTPS automatically once the domain is verified.
6. On the desktop app: **Settings → Website Sync** → paste the Render URL
   (or the custom domain once DNS is live) and the sync key → **Save Sync
   Settings** → **Sync Now**.

### Option B: Railway.app

Nearly identical to Render — connect the repo, set the root directory to
`web-portal`, add a volume for `DATA_DIR`, deploy, copy the generated key
from the logs, then add the custom domain in Railway's settings and point
your DNS at it.

### Option C: Any VPS you already control

```bash
cd web-portal
npm install
npm run build
DATA_DIR=/var/lib/tukuza-portal PORT=4100 npm start
```
Put this behind a reverse proxy (nginx/Caddy) for HTTPS and to map port 80/443
to 4100, and use a process manager (`pm2`, or a systemd service) to keep it
running and restart it on boot.

## Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `PORT` | Port to listen on | `4100` |
| `DATA_DIR` | Where the SQLite database is stored — **must** point at a persistent disk/volume in cloud hosting, or the database (and generated sync key) resets on every redeploy | `./server/data` |
| `SYNC_API_KEY` | Set this to choose your own sync key instead of letting one be generated | (auto-generated on first run) |
| `JWT_SECRET` | Signs student login sessions — set this to a long random string in production | a dev default (**change this**) |

## Local development

```bash
cd web-portal
npm install          # installs server deps, then client deps via postinstall
npm run build        # builds the React client into client/dist
npm start             # serves API + built client on http://localhost:4100
```

Or run the client with hot-reload against a separately-running server:
```bash
npm run server                 # in one terminal — API on :4100
npm --prefix client run dev    # in another — Vite dev server on :5174, proxying /api to :4100
```
