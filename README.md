# Daily

A self-hosted PWA for tracking personal recurring tasks. Designed for Tailscale networks — users are identified automatically by the `Tailscale-User` header, no login required.

## Features

- **Recurring tasks** — daily, specific weekdays, weekly, or monthly
- **Strip view** — horizontal scrolling day cards, today centred, ±14 days
- **Calendar view** — month grid with per-day progress dots; click any day to expand details
- **Stats view** — per-task completion rate, activity heatmap, and hour-of-day histogram
- **Streak warnings** — tasks missed for 2+ consecutive applicable days are highlighted in red
- **Period-aware completion** — marking a weekly task on any day marks it for the whole week; the UI shows chevrons when completion happened on a different day in the period
- **Multi-count tasks** — tasks with `target_count > 1` show `−` / `n/target` / `+` buttons instead of a checkbox
- **Multi-device sync** — WebSocket broadcast keeps all open tabs/devices in sync instantly
- **PWA** — installable on mobile and desktop, offline-capable app shell; cache is versioned per build so deploys always serve fresh assets
- **Dark mode** — respects `prefers-color-scheme`, no toggle needed
- **No passwords** — identity comes from Tailscale header injection

---

## Quick start — prebuilt images

The fastest way to run Daily. No source checkout or build step required.

Create a `docker-compose.yml`:

```yaml
services:
  backend:
    image: ghcr.io/mtib/daily/backend:latest
    volumes:
      - ./data:/app/data
    environment:
      - DATABASE_PATH=/app/data/tasks.db
    restart: unless-stopped

  frontend:
    image: ghcr.io/mtib/daily/frontend:latest
    restart: unless-stopped

  caddy:
    image: caddy:2-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - backend
      - frontend
    restart: unless-stopped

volumes:
  caddy_data:
  caddy_config:
```

Create a `Caddyfile` in the same directory:

```caddyfile
:80 {
    reverse_proxy /api/* backend:3001
    reverse_proxy /ws    backend:3001 {
        transport http { versions h1 }
    }
    reverse_proxy * frontend:3000
}
```

Then:

```bash
mkdir data
docker compose up -d
```

Open [http://localhost](http://localhost). Add tasks with the Settings (⚙) button.

Images are published to [GitHub Container Registry](https://github.com/mtib/daily/pkgs/container/daily%2Fbackend) on every push to `main`. Pin a specific commit SHA for reproducible deployments:

```yaml
image: ghcr.io/mtib/daily/backend:abc1234
```

## Quick start — build from source

```bash
git clone https://github.com/mtib/daily.git
cd daily
docker compose up --build -d
```

---

## Local development

**Requirements:** [Bun](https://bun.sh) ≥ 1.0

```bash
# Backend (port 3001)
cd backend
bun install
DATABASE_PATH=./data/tasks.db bun run dev

# Frontend (port 5173, proxied to backend)
cd frontend
bun install
bun run dev
```

Open [http://localhost:5173](http://localhost:5173). In dev mode the backend falls back to `dev-user` when no Tailscale header is present.

---

## Project structure

```
daily/
├── Caddyfile
├── docker-compose.yml
├── data/                     SQLite database (host bind-mount)
├── backend/
│   └── src/
│       ├── index.ts          Hono + Bun.serve entrypoint, WebSocket upgrade
│       ├── db.ts             SQLite schema, migrations, frequency helpers
│       ├── auth.ts           Tailscale-User header middleware
│       ├── ws.ts             Per-user WebSocket connection registry
│       └── routes/
│           ├── tasks.ts      CRUD — GET/POST/PUT/DELETE /api/tasks
│           ├── completions.ts POST/DELETE /api/completions
│           ├── days.ts       GET /api/days (structured day+task+streak data)
│           └── stats.ts      GET /api/stats (per-task completion statistics)
└── frontend/
    ├── vite.config.ts        Vite config + sw.js build-timestamp plugin
    ├── public/
    │   ├── sw.js             Service worker (versioned cache, network-first HTML)
    │   └── manifest.json     PWA manifest
    └── src/
        ├── App.tsx           Root — toolbar, view switcher, modal management
        ├── api.ts            fetch wrappers for all REST endpoints
        ├── types.ts          Shared TypeScript types
        ├── hooks/
        │   ├── useTaskStore.ts  State: days, tasks, toggleCompletion, setCount
        │   └── useWS.ts         WebSocket with exponential-backoff reconnect
        └── components/
            ├── DayStrip.tsx     Horizontal scroll container (full-width)
            ├── DayCard.tsx      Single day — header, progress ring, task list
            ├── TaskItem.tsx     Checkbox / ±count buttons + streak badge
            ├── ProgressRing.tsx SVG arc progress indicator
            ├── CalendarView.tsx Month grid + selected-day detail panel
            ├── StatsView.tsx    Task list + detail with rate bar, heatmap, histogram
            ├── TaskManager.tsx  Centred modal — task CRUD form
            └── Tooltip.tsx      Portal-based tooltip (not clipped by overflow)
```

---

## Views

### Strip view (default)
Horizontally scrollable day cards spanning today ±14 days. Today's card is centred on load and highlighted with a purple ring. Cards are vertically centred in the viewport. Full viewport width — not constrained by the page container.

### Calendar view
Month grid. Each cell shows a progress summary (dots, `✓`, or `!` for warnings). Click a cell to expand a full `DayCard` below the grid. Navigate months with the chevron buttons.

### Stats view
Lists all tasks ordered by most-recently-completed. Each row shows a completion-rate bar. Click a task to see:
- Key metrics (created, first/last completion, total count, possible periods)
- Completion rate bar
- 12-week activity heatmap
- Hour-of-day completion histogram (displayed in local timezone)

---

## Task frequency types

| Type | Applies to | `period_key` |
|---|---|---|
| `daily` | Every day from creation date | `YYYY-MM-DD` |
| `days_of_week` | Selected weekdays from creation date | `YYYY-MM-DD` |
| `weekly` | All days of the ISO week | Monday of the week (`YYYY-MM-DD`) |
| `monthly` | All days of the month | `YYYY-MM` |

Tasks do **not** appear retroactively — they only show from their creation date forward.

For weekly/monthly tasks, completing on any day in the period marks the whole period. The UI shows:
- `✓` Check — completed on this exact day
- `‹` ChevronLeft — completed earlier in the period
- `›` ChevronRight — completed later in the period

### Multi-count tasks

Setting `target_count > 1` (e.g. "drink 8 glasses of water") replaces the checkbox with `−` / `n/target` / `+` controls. The count turns green when the target is reached. Count zero removes the completion record.

---

## API reference

```
GET    /api/tasks
POST   /api/tasks                 { name, description?, freq_type, freq_config?, target_count? }
PUT    /api/tasks/:id
DELETE /api/tasks/:id             soft-delete (preserves history)

GET    /api/days?from=YYYY-MM-DD&to=YYYY-MM-DD
POST   /api/completions           { task_id, date, count? }
DELETE /api/completions/:task_id/:period_key

GET    /api/stats

WS     /ws                        sync on connect, patch on any mutation
```

---

## Deployment

### Tailscale auth header

In your Tailscale ACL / serve config, ensure the `Tailscale-User` header is injected before reaching Caddy. The backend reads it from each request to identify the user — no session storage needed.

### Custom domain with HTTPS

Update `Caddyfile`:

```caddyfile
yourdomain.example.com {
    reverse_proxy /api/* backend:3001
    reverse_proxy /ws    backend:3001 {
        transport http { versions h1 }
    }
    reverse_proxy * frontend:3000
}
```

Caddy handles TLS via Let's Encrypt automatically.

### Data persistence

SQLite is stored at `./data/tasks.db` on the host (bind-mounted into the backend container).

```bash
# Backup
cp ./data/tasks.db ./data/tasks.$(date +%Y%m%d).db

# Restore
docker compose down
cp ./data/tasks.YYYYMMDD.db ./data/tasks.db
docker compose up -d
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Runtime | [Bun](https://bun.sh) |
| Backend framework | [Hono](https://hono.dev) |
| Database | SQLite via `bun:sqlite` |
| Frontend | React 18 + Vite |
| Icons | [Lucide React](https://lucide.dev) |
| Proxy | [Caddy 2](https://caddyserver.com) |
| Container | Docker Compose |
