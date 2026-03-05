# Daily Task Tracker — Documentation

## Architecture Overview

A self-hosted PWA for tracking recurring personal tasks, built for Tailscale networks.

- **Backend**: Bun + Hono, SQLite via `bun:sqlite`
- **Frontend**: React 18 + Vite, minimal CSS (no Tailwind), Lucide icons
- **Auth**: Tailscale-User header injection (no passwords)
- **Sync**: WebSocket broadcast per-user

### Request Flow

```
Browser → Caddy :80 → /api/* → backend:3001
                     → /ws    → backend:3001 (WebSocket)
                     → *      → frontend:3000 (static)
```

---

## Local Dev Setup

### Backend

```bash
cd backend
bun install
DATABASE_PATH=./data/tasks.db bun run dev
```

### Frontend

```bash
cd frontend
bun install
bun run dev
# → http://localhost:5173 (proxied to backend:3001)
```

For local dev without Tailscale, the backend falls back to `dev-user` when the `Tailscale-User` header is absent.

---

## Task Frequency Logic

Each task has a `freq_type` and optional `freq_config`:

| freq_type     | freq_config                    | Applies to                          |
|---------------|--------------------------------|-------------------------------------|
| `daily`       | null                           | Every calendar day                  |
| `days_of_week`| `{"days":[0,1,2,3,4,5,6]}`    | Specific weekdays (0=Sun, 6=Sat)    |
| `weekly`      | null                           | Once per ISO week (Mon–Sun)         |
| `monthly`     | null                           | Once per calendar month             |

Tasks do **not** appear retroactively. `taskAppliesOnDate` returns false for any date before `task.created_at`.

### period_key Semantics

Completions are stored with a `period_key` that identifies the period:

- **daily / days_of_week**: `period_key = YYYY-MM-DD`
- **weekly**: `period_key = ISO Monday of the week` (e.g. `2026-03-02` for Mar 2–8)
- **monthly**: `period_key = YYYY-MM`

One completion record per task per period (`UNIQUE INDEX uq_completion ON completions(task_id, period_key)`). For weekly/monthly tasks a single row covers all days in the period; the `actual_date` column records which day the checkbox was ticked.

### completion_state

The `/api/days` endpoint computes a `completion_state` for each task on each day:

| State | Meaning |
|---|---|
| `none` | No completion for this period |
| `this_day` | `completion.actual_date === dateStr` |
| `earlier_in_period` | Completed on an earlier day in the same week/month |
| `later_in_period` | Completed on a later day in the same week/month |

### Missed Streak Calculation

For each incomplete task on each applicable day, the backend walks backward through prior applicable days (up to 30) counting consecutive days with no completion. Returned as `missed_streak`. Displayed in the UI as a red badge when ≥ 1; warning styling when ≥ 2.

Streak is only calculated for past and present days, not future.

---

## Multi-count Tasks

Tasks with `target_count > 1` use a count stored in `completions.count`.

- The UI renders `−` / `n/target` / `+` buttons instead of a checkbox.
- `+` is disabled once `count >= target_count`.
- Incrementing calls `POST /api/completions` with the new count (upsert).
- Decrementing to 0 calls `DELETE /api/completions/:task_id/:period`.
- Sorting and completion state treat the task as incomplete until `count >= target_count`.

---

## WebSocket Message Protocol

All messages are JSON objects with a `type` field.

### Server → Client

```json
{ "type": "sync", "payload": { "tasks": [...], "completions": [...] } }
```
Sent immediately on WebSocket connection. Full state for the authenticated user.

```json
{ "type": "patch", "payload": { "tasks": [...], "completions": [...] } }
```
Sent to all connections of the same user after any mutation. The client calls `reload()` to re-fetch `/api/days` (which recalculates streaks and completion states server-side).

### Client → Server

Clients send mutations via REST. The server updates the DB, broadcasts a `patch` to all WS connections for that user, and the client reloads.

Keepalive: the client sends `"ping"` every 25 s; the server responds `"pong"`. Reconnection uses exponential backoff starting at 1 s, capped at 30 s.

---

## Frontend Views

### Strip view
Full-viewport-width horizontal scroll. Cards are vertically centred. Today's card is scrolled into centre on mount and highlighted with a purple ring. `scroll-snap-type: x mandatory` provides snap-to-card behaviour.

### Calendar view
Month grid (7 columns). Each cell shows:
- Day number (bold + purple for today)
- Progress dots (up to 5 filled/empty circles), `✓` for all-done, `!` for warned
- `n/m` count

Clicking a cell expands a full `DayCard` below the grid. Month navigation with prev/next buttons.

### Stats view
Task list sorted by most-recently-completed. Each row has a colour-coded rate bar (green ≥ 80%, purple ≥ 40%, red below). Clicking a row shows:
- Stat chips: created, first completion, last completion, total completions, possible periods, frequency
- Completion rate bar with percentage
- 12-week activity heatmap (purple = completed, grey = missed, transparent = before creation)
- Hour-of-day histogram converted to the browser's local timezone

---

## Service Worker & PWA

The service worker (`public/sw.js`) uses a **versioned cache name** stamped at build time by a Vite plugin in `vite.config.ts`:

```
const CACHE_NAME = "daily-1772720980417";  // replaced per build
```

**Caching strategy:**
- `/api/*`, `/ws` — pass-through, never cached
- `/assets/*` — cache-first (Vite content-hashes these filenames; a hit is always fresh)
- Everything else (HTML, manifest, icons) — network-first, cache as offline fallback

On each deploy the new cache name differs from the old one. The `activate` handler deletes all caches with a different name, then calls `clients.claim()` so open tabs immediately use the new SW.

---

## Adding a New Task via UI

1. Click the Settings icon (top right toolbar) to open the Task Manager modal.
2. Click **New Task**.
3. Fill in:
   - **Name**: short label shown on each day card
   - **Description**: optional detail shown below the name
   - **Frequency**: Daily / Specific days / Weekly / Monthly
   - **Days**: (if Specific days) toggle weekday buttons
   - **Target count**: default 1; set higher for multi-completion tasks (e.g. 8 for glasses of water)
4. Click **Save**. The task appears in today's card and future applicable days only.

---

## Docker Compose Deployment

```bash
# First time
docker compose up --build -d

# View logs
docker compose logs -f

# Rebuild after code changes
docker compose up --build -d backend   # or frontend

# Stop
docker compose down
```

The SQLite database is stored at `./data/tasks.db` on the host (bind-mounted into the backend container).

---

## Caddy HTTPS Configuration

For a real domain, update `Caddyfile`:

```caddyfile
yourdomain.com {
    reverse_proxy /api/* backend:3001
    reverse_proxy /ws    backend:3001 {
        transport http { versions h1 }
    }
    reverse_proxy * frontend:3000
}
```

Caddy handles TLS automatically via Let's Encrypt. Ensure ports 80 and 443 are exposed in `docker-compose.yml`.

---

## Tailscale Auth Header Setup

The backend reads `Tailscale-User` (or `X-Webauth-User` as fallback). In development, if neither header is present, it uses `dev-user`.

In production, configure Tailscale Serve or your ACL to inject the header before requests reach Caddy.

---

## Backup / Restore SQLite

```bash
# Manual backup
cp ./data/tasks.db ./data/tasks.backup.$(date +%Y%m%d).db

# Restore
docker compose down
cp ./data/tasks.backup.YYYYMMDD.db ./data/tasks.db
docker compose up -d
```

Automated nightly backup via cron:

```cron
0 2 * * * cp /path/to/daily/data/tasks.db /path/to/backups/tasks.$(date +\%Y\%m\%d).db
```
