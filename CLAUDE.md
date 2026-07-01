# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # dev server at http://localhost:5173 (HMR enabled)
npm run build        # production build
npm run start        # serve production build (port 3001 in Docker)
npm run typecheck    # react-router typegen + tsc (no test suite)
```

There is no test suite. Type checking is the main correctness gate.

## Architecture

This is a financial management system for Quattor Academia (a gym). It uses **React Router v7** (SSR, file-based routing) with **Prisma + MongoDB** as the database, **TailwindCSS v4**, and shadcn/ui components.

### Data flow

Routes in `app/routes/*.tsx` handle both loader (data fetching) and action (mutations) via React Router conventions. All DB access happens in server-only model files (`app/models/*.server.ts`) — never import these in client components.

- `app/db.server.ts` — singleton Prisma client (dev-safe global pattern)
- `app/models/*.server.ts` — all Prisma queries and external API calls
- `app/routes.ts` — explicit route config (not filesystem-based)
- `app/routes/_layout.tsx` — shared shell: sidebar + logo header wrapping all routes

### External integrations

- **PocketBase** (`app/models/pocketbase.server.ts`): file storage for receipts (`recibo_path`) and bank slips (`boleto_path`) attached to `despesas`. Authenticates as admin per upload, retries up to 3 times on 5xx/network errors.
- **EVO API / W12** (`app/models/evo.server.ts`): fetches active students from `https://evo-integracao-api.w12app.com.br`. Returns Excel (.xlsx) parsed with the `xlsx` package. Auth is Basic (DNS + secret key).
- **Local Excel file** (`app/dados/Contas_receber.xlsx`): `recebimentos.server.ts` reads this file from disk to sum the "Valor baixa" column. The file is uploaded via the home route action and overwritten at `app/dados/`.

### Route modules

| Route | Purpose |
|---|---|
| `home.tsx` | Dashboard with KPI cards and Recharts charts (revenue, expenses, active students, cancellations) |
| `despesas.tsx` | Expenses CRUD with file upload to PocketBase |
| `receitas.tsx` | Revenue entries CRUD |
| `folha.tsx` | Payroll/salary management |
| `cancelamentos.tsx` | Membership cancellation tracking |
| `contas.tsx` | Expense account categories |
| `treinos.tsx` | Workout programs CRUD |
| `ponto.tsx` | Timeclock/attendance records |
| `treinos.pdf.tsx`, `ponto.pdf.tsx`, `ponto.espelho-pdf.tsx`, `ponto.espelho-todos-pdf.tsx` | PDF exports using `@react-pdf/renderer` |

### Component organization

- `app/components/ui/` — shadcn/ui components (Button, Card, Dialog, etc.)
- `app/components/{feature}/` — feature-specific dialogs and tables (e.g. `despesas/`, `folha/`, `ponto/`)
- `app/components/columns-desp.tsx`, `app/components/desp-table.tsx` — TanStack Table setup for expenses

### Utility libraries

- `app/lib/despesas-calendar.ts` — UTC-safe month boundary helpers (`limitesMesCivilUTC`, `despesaCaiNoMesCivil`)
- `app/lib/upload-errors.ts` — typed JSON error helpers for file upload actions
- `app/lib/utils.ts` — `cn()` (Tailwind class merge), `toTitleCase()`, `parseLocalDate()`

### Required environment variables

```
DATABASE_URL                  # MongoDB connection string
POCKETBASE_URL                # PocketBase instance URL
POCKETBASE_ADMIN_EMAIL
POCKETBASE_ADMIN_PASSWORD
POCKETBASE_COLLECTION         # default: arquivos_compartilhados
POCKETBASE_FIELD              # default: documento
EVO_USER                      # EVO/W12 API: academy DNS
EVO_SECRET                    # EVO/W12 API: secret key
```

### Deployment

Docker multi-stage build exposes port 3001. The `app/dados/` directory (local Excel files) is copied into the image — if these files change at runtime they are written back to the same path via `writeFileSync`.
