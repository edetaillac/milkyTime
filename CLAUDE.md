# CLAUDE.md - MilkyTime

## What is this project?

MilkyTime is a baby feeding tracker built with Next.js. It tracks breastfeeding and bottle sessions with smart predictions, records, and statistics. Single-page app with multi-user auth backed by Supabase.

## Tech stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS 4 + shadcn/ui (Radix primitives)
- **Database:** Supabase (PostgreSQL + Auth)
- **Charts:** Recharts 3
- **State:** React Context + custom hook (`useFoodTracker`)
- **Testing:** Playwright (E2E only, no unit tests)
- **Deploy:** Docker multi-stage build, SSH deploy via Makefile

## Project structure

```
app/                          # Next.js App Router
  page.tsx                    # Main dashboard (presentation layer)
  api/auth/route.ts           # POST login endpoint (bcrypt)
src/
  components/                 # 18 React components (UI features)
  hooks/
    useFoodTracker.ts         # Central hook: auth, data, records, alerts
    useFoodTrackerContext.tsx  # React Context provider
  lib/
    index.ts                  # Barrel export
    types.ts                  # All TypeScript interfaces
    constants.ts              # Labels, colors, prediction config, timings
    predictions.ts            # computePredictions() - slot-based, trimmed mean
    records.ts                # Bronze/Silver/Gold record tracking
    bedtime.ts                # Bedtime window calculation
    scheduleConfig.ts         # Age-based day/night schedule presets
    supabase/                 # Supabase client + query functions
    utils/                    # date, math, business, format, charts
  services/
    feedingService.ts         # Supabase queries, data aggregation
components/ui/                # shadcn/ui primitives (button, card, dialog, etc.)
tests/                        # Playwright E2E tests
  fixtures/                   # Supabase test client + cleanup
  setup/                      # Test initialization
scripts/                      # SQL schema scripts
```

## Architecture layers

1. **Presentation** - `app/page.tsx` + `src/components/` consume context
2. **State/Logic** - `useFoodTracker` hook orchestrates everything, exposed via `FoodTrackerContext`
3. **Services** - `feedingService.ts` handles Supabase queries + aggregation
4. **Library** - `src/lib/` contains pure functions (predictions, records, bedtime, utils)
5. **Data** - Supabase PostgreSQL (`app_users` + `food_logs` tables)

## Key commands

```bash
make dev              # Dev server (localhost:3000)
make build            # Production build
make test             # All Playwright tests
make test-ui          # Tests in visual mode
make docker           # Local Docker production
make deploy           # SSH deploy to production
```

## Development rules

### TypeScript
- **Strict mode is ON.** No `any` types allowed (ESLint `error`).
- Use `unknown` + type guards in catch blocks.
- Unused vars must be prefixed with `_` (ESLint `error`).
- Import types from `src/lib` barrel (`../lib`), not individual files.

### ESLint
- `@typescript-eslint/no-explicit-any`: **error**
- `@typescript-eslint/no-unused-vars`: **error** (with `^_` pattern)
- `react-hooks/exhaustive-deps`: **warn** (intentional, some hooks need stable deps)
- `react/no-unescaped-entities`: off

### Code conventions
- Constants and magic numbers go in `src/lib/constants.ts` (see `TIMINGS`, `PREDICTION`, `PROB_WINDOW`)
- Business logic stays in `src/lib/` as pure functions, NOT in the hook
- New Supabase queries go in `src/services/feedingService.ts`
- UI components consume data via `useFoodTrackerContext()`, not props
- Recharts `dot` prop needs `as unknown as DotProps` cast (library typing limitation)

### Testing
- E2E only (Playwright). No unit tests yet.
- Tests use a **separate Supabase project** (`.env.test`). NEVER use production DB.
- Triple-layer safety: env isolation, code guards, keyword detection.
- Tests run sequentially (`fullyParallel: false`, `workers: 1`).
- Dev server starts on port 3001 for tests.

### Git
- Commit after every change. Keep commits atomic.
- Use conventional prefixes: `feat:`, `fix:`, `refactor:`, `chore:`, `perf:`, `docs:`, `security:`
- Build must pass before committing (`npm run build`).

## Environment variables

```bash
# Required (in .env.development or .env.local)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Testing (in .env.test - SEPARATE project!)
NEXT_PUBLIC_SUPABASE_URL=https://your-TEST-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_test_key

# Deploy (in ~/.zshrc, not versioned)
SERVER_USER, SERVER_HOST, APP_PATH
```

## Database schema

```sql
-- app_users
id (uuid PK), username (text unique), password_hash (text),
baby_birth_date (date), created_at (timestamptz)

-- food_logs
id (uuid PK), user_id (uuid FK), side ('left'|'right'|'bottle'),
timestamp (timestamptz), created_at (timestamptz)
```

## UI sections (single-page dashboard, top to bottom)

1. **Header** — App logo, baby age badge (with info dialog), connected user, logout
2. **Add a feeding** — Left/Right breast buttons (highlighted = recommended side), Bottle button, "Add batch" for bulk import
3. **Today card** — Feeding count for the day, time since last feeding, recommended side alternation
4. **Predictions card** — Next predicted feeding time, reliability %, probability window progress bar (start → end with colored zones)
5. **Feeding Timeline** — Line chart (Recharts) with tabs: 24h / 3 days / 7 days. Shows intervals over time with day (yellow) / night (blue-gray) background zones. Dots colored by feeding side.
6. **Interval Statistics** — Dual line chart with tabs: By days / By weeks. Separate day (orange) and night (blue) trend lines showing median intervals.
7. **Evolution** — Stacked bar chart with tabs: 7 days / 1 month. Shows daily feeding counts by side (left/right/bottle).
8. **Monthly Records** — Two columns: Day and Night. Top 3 longest intervals with gold/silver/bronze medals. Confetti animation on new record.
9. **Recent Feedings** — Table with Date, Side, Gap columns. Record indicators (medals) shown inline. Edit timestamp and delete actions per row.

## Key business logic

- **Predictions:** Uses last 72h of data, groups intervals by time slot, trimmed mean with outlier removal, cluster feeding detection. See `src/lib/predictions.ts`.
- **Records:** Top 3 intervals per month, separate day/night. Bronze/Silver/Gold tiers. Confetti on new records. See `src/lib/records.ts`.
- **Age-based schedule:** Day/night boundaries shift with baby age (0-3m, 3-6m, 6-12m, 12m+). See `src/lib/scheduleConfig.ts`.
- **Bedtime:** Predicted from 35-day lookback. See `src/lib/bedtime.ts`.

## Day/night classification strategy

Two distinct approaches, each used where appropriate:

- **Interval classification (majority-based):** `isNightIntervalByMajority(start, end, schedule)` — classifies based on where >50% of the interval duration falls. Used for **all statistical data**: interval statistics, weekly/daily medians, records, approaching record detection.
- **Point-in-time classification:** `isNightHourWithSchedule(date, schedule)` — classifies based on a single timestamp. Used for **visualization and UI**: chart background zones, dot/row coloring, feeding counts, theme detection, prediction pool selection.

This distinction is intentional: stats need accurate interval classification, while visual elements should reflect the moment in time.

## Improvements roadmap

See `IMPROVEMENTS.md` for the full prioritized list of improvements (product, tech, data/algo, design, security). **Keep this file up to date**: when completing, adding, or reprioritizing an improvement, update `IMPROVEMENTS.md` accordingly.

## Known technical debt

- `useFoodTracker` is a ~1400-line monolith. Should be split into focused hooks (`useAuth`, `useFeedingData`, `useRecords`, `usePredictions`).
- No unit tests. Only E2E via Playwright.
- `react-hooks/exhaustive-deps` warnings are intentionally suppressed to avoid infinite re-render loops. Adding deps would require `useCallback`/`useRef` refactoring.
- Some `console.warn` calls remain for development diagnostics (missing userId guards).
