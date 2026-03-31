# BBB Dining Group — Admin Hub

## Purpose

Single landing page for all BBB internal tools. Managers and admin (Simon) log in once and see cards linking to every tool with live status summaries. Admin sees all tools; managers see only tools assigned to them.

## Architecture

- **Hosting:** Cloudflare Pages (auto-deploy from GitHub)
- **Backend:** Cloudflare Worker (`_worker.js`)
- **Database:** Cloudflare D1 (own database, separate from other tools)
- **Frontend:** Vanilla HTML/CSS/JS (same pattern as all BBB tools)
- **Live URL:** `admin-hub.pages.dev`

## Pages

### Login (`index.html`)

Same pattern as diesel tracker: pick your name from dropdown, enter passcode. Staff table is hub-specific (not shared with diesel tracker).

### Hub (`hub.html`)

Grid of tool cards. Each card shows:
- Icon + tool name
- 1-2 live status lines (fetched from each tool's API via the hub's own worker)
- "Open →" button linking to the tool's admin page
- "Coming Soon" badge for tools not yet on Cloudflare

## Tool Cards

| Tool | Icon | Status Line | Links To | Live at Launch? |
|------|------|-------------|----------|-----------------|
| Diesel Tracker | 🚗 | "X overdue services" | diesel-tracker.pages.dev/admin.html | Yes |
| Staff Applications | 📋 | "X pending applications" | staff-application-form.pages.dev/admin.html | Yes |
| Staff Dashboard | 👥 | — | — | Coming Soon |
| Eighteen Daily Sales | 💰 | — | — | Coming Soon |
| Dining Club | 🎁 | — | — | Coming Soon |

As tools get rebuilt on Cloudflare, their cards become live with status summaries.

## Database Schema

```sql
CREATE TABLE hub_staff (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','manager')),
  passcode TEXT NOT NULL,
  venue TEXT DEFAULT 'All',
  allowed_tools TEXT DEFAULT 'all',
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
```

- `allowed_tools`: comma-separated tool slugs (e.g. `diesel-tracker,staff-applications`) or `all` for admin.
- Admin role always sees everything regardless of `allowed_tools`.

## Worker API Routes

### Auth
- `POST /api/login` — verify name + passcode, return role + allowed_tools
- `GET /api/staff` — list active staff (for login dropdown)

### Status Proxy
- `GET /api/status/diesel-tracker` — calls diesel tracker's API, returns summary counts
- `GET /api/status/staff-applications` — calls staff applications API, returns summary counts
- Future: add more `/api/status/<tool>` routes as tools come online

### Staff Management (admin only)
- `POST /api/staff/add` — add a manager with allowed_tools
- `POST /api/staff/update` — update manager's allowed_tools or passcode
- `POST /api/staff/deactivate` — deactivate a manager

## Auth Flow

1. Login page loads staff names from `GET /api/staff`
2. User picks name, enters passcode
3. `POST /api/login` returns `{ role, allowed_tools }`
4. Stored in `sessionStorage`
5. Hub page renders only cards the user is allowed to see
6. Session-based (no tokens, same as diesel tracker)

## Status Fetching

The hub worker acts as a proxy. When the frontend requests `/api/status/diesel-tracker`, the worker:
1. Fetches from the diesel tracker's API (server-to-server, no CORS issues)
2. Extracts relevant counts (overdue services, pending reports)
3. Returns a simple JSON summary to the hub frontend

If a status call fails (tool is down, not yet live), the card shows gracefully — no status line, just the link.

## Access Control

- **Admin (Simon):** sees all 5 cards, can manage managers
- **Manager:** sees only cards matching their `allowed_tools` list
- Admin manages who sees what from a simple settings section on the hub

## Brand Style

Same as all BBB tools:
- Background: `#f5f4f0`
- Accent: `#c8410a`
- Text: `#1a1a1a`
- Cards: white, `border-radius: 16px`, `box-shadow: 0 1px 4px rgba(0,0,0,0.07)`
- Font: system font stack
- Mobile-first, responsive grid

## Card Layout

- Mobile: 1 card per row (full width)
- Tablet: 2 cards per row
- Desktop: 3 cards per row
- Each card has consistent height with status text at a fixed position

## Future Additions

When a new tool is added to BBB:
1. Add a card config (icon, name, slug, URL)
2. Add a `/api/status/<slug>` route in the worker
3. Add the slug to managers' `allowed_tools` as needed

No frontend rewrite needed — just add the card and route.
