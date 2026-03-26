# MilkyTime - Improvements Roadmap

> Last updated: 2026-03-26

## Priority matrix

| # | Area | Improvement | Impact | Effort |
|---|------|------------|--------|--------|
| 1 | Product | PWA (manifest + service worker) | High | S |
| 2 | Tech | Split `useFoodTracker` hook | High | L |
| 3 | Tech | Unit tests on pure logic | High | M |
| 4 | Product | Notes/context on feedings | Medium | S |
| 5 | Data/Algo | Schedule-aware prediction time slots | Medium | M |
| 6 | Tech | Lazy loading charts | Medium | S |
| 7 | Data/Algo | Adaptive cluster feeding detection | Medium | M |
| 8 | Design | Accessibility improvements | Medium | M |
| 9 | Product | Data export (CSV/PDF) | Medium | M |
| 10 | Data/Algo | Prediction reliability edge case | Low | S |
| 11 | Design | i18n consistency | Low | M |
| 12 | Security | Auth hardening | Low | M |

---

## Product

### 1. PWA: manifest.json + service worker
**Impact:** High | **Effort:** S

No manifest or service worker currently. For a parent opening the app 8-12x/day on their phone, this is the highest-impact quick win:
- Install to home screen (true native look)
- Basic offline support (cache latest data, queue new entries)
- Future: push notifications for predictions ("feeding expected in 10min")

### 4. Notes/context on feedings
**Impact:** Medium | **Effort:** S

No `notes` field in `food_logs`. Being able to annotate "fussy", "spit-up", "teething" would allow correlating interval patterns with events. Light on data, high on insight.

### 9. Data export (CSV/PDF)
**Impact:** Medium | **Effort:** M

No export feature. A CSV/PDF of stats for the pediatrician would be very useful (feedings/day, interval curve, evolution).

---

## Tech

### 2. Split `useFoodTracker` hook
**Impact:** High | **Effort:** L

The most structurally important debt. 1,243 lines, 40+ state variables, single Context — any state change re-renders the entire dashboard.

Proposed split:
- `useAuth` — login/logout/session
- `useFeedingLogs` — CRUD + polling
- `useRecords` — record calculation + approaching record
- `usePredictions` — algorithm + smart alerts

Alternative: migrate to Zustand with granular stores (selective subscriptions, no cascade re-renders).

### 3. Unit tests on pure logic
**Impact:** High | **Effort:** M

`predictions.ts`, `scheduleConfig.ts`, `records.ts` are pure functions, perfectly testable. Vitest + a few edge cases (DST, first feeding, gap > 48h, cluster feeding) would secure future refactors with no overhead.

### 6. Lazy loading charts
**Impact:** Medium | **Effort:** S

Recharts = ~117KB gzipped, loaded on first render. `React.lazy()` on the 4 chart components + confetti = much faster first paint, especially on 4G.

---

## Data / Algorithm

### 5. Predictions: schedule-aware time slots
**Impact:** Medium | **Effort:** M

Time slots in `predictions.ts` (`"7-9"`, `"9-12"`, etc.) are hardcoded and ignore the `schedule` which varies with baby age. If night starts at 19h (6-12m preset), the `"18-21"` slot straddles day and night. Slots should derive from the active schedule.

### 7. Adaptive cluster feeding detection
**Impact:** Medium | **Effort:** M

Currently hardcoded to `17h-21h` with a minimum of 5 samples. Not universal (some babies cluster-feed in the morning), and too restrictive for the first weeks. Should derive from schedule + be adaptive based on observed patterns.

### 10. Prediction reliability edge case
**Impact:** Low | **Effort:** S

`regularityFactor = Math.max(0, 1 - coefficientOfVariation) * 0.4` — if CV > 1 (very irregular intervals), the factor goes negative before `Math.max`. This is handled, but there's no final clamp on the total reliability score, which could theoretically exceed 100% in edge cases.

---

## Design / UX

### 8. Accessibility improvements
**Impact:** Medium | **Effort:** M

Estimated score ~65/100. Key gaps:
- Alerts (cluster feeding, approaching record) missing `role="alert"` and `aria-live`
- Status indicators use color only (green/red) — colorblind issue
- Edit mode inputs in table missing associated `<label>`
- Charts have no text alternative for screen readers

### 11. i18n consistency
**Impact:** Low | **Effort:** M

English/French mix in code (`"Chargement..."` in HydrationWrapper, `"en-US"` hardcoded in formatters). Not blocking but inconsistent if the app is ever shared.

---

## Security

### 12. Auth hardening
**Impact:** Low (given audience) | **Effort:** M

- `localStorage.setItem("diaper-user-id", user.id)` — vulnerable to XSS. Acceptable for a personal app, but switching to `httpOnly` cookies would be cleaner.
- No rate limiting on `/api/auth` endpoint.
- No password strength requirements.
