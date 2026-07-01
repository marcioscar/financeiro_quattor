# AGENTS.md

Contexto do projeto para agentes no Cursor. Baseado em `CLAUDE.md`.

## Commands

```bash
npm run dev          # dev server at http://localhost:5173 (HMR enabled)
npm run build        # production build
npm run start        # serve production build (port 3001 in Docker)
npm run typecheck    # react-router typegen + tsc (no test suite)
```

Não há suite de testes. Type checking é o principal gate de correção.

## Architecture

Sistema financeiro da Quattor Academia (academia). Usa **React Router v7** (SSR, rotas explícitas) com **Prisma + MongoDB**, **TailwindCSS v4** e componentes **shadcn/ui**.

### Data flow

Rotas em `app/routes/*.tsx` tratam loader (leitura) e action (mutações) via convenções do React Router. Todo acesso ao banco fica em arquivos server-only (`app/models/*.server.ts`) — nunca importar esses models em componentes client.

- `app/db.server.ts` — singleton Prisma client (padrão global seguro em dev)
- `app/models/*.server.ts` — queries Prisma e chamadas a APIs externas
- `app/routes.ts` — configuração explícita de rotas (não é filesystem-based)
- `app/routes/_layout.tsx` — shell compartilhado: sidebar + header com logo

### External integrations

- **PocketBase** (`app/models/pocketbase.server.ts`): storage de recibos (`recibo_path`) e boletos (`boleto_path`) em `despesas`. Autentica como admin por upload, retry até 3x em erros 5xx/rede.
- **EVO API / W12** (`app/models/evo.server.ts`): alunos ativos de `https://evo-integracao-api.w12app.com.br`. Retorna Excel (.xlsx) parseado com `xlsx`. Auth Basic (DNS + secret key).
- **Excel local** (`app/dados/Contas_receber.xlsx`): `recebimentos.server.ts` lê do disco e soma coluna "Valor baixa". Upload via action da home, sobrescreve em `app/dados/`.

### Route modules

| Route | Purpose |
|---|---|
| `home.tsx` | Dashboard com KPIs e gráficos Recharts |
| `despesas.tsx` | CRUD despesas com upload PocketBase |
| `receitas.tsx` | CRUD receitas |
| `folha.tsx` | Folha de pagamento |
| `cancelamentos.tsx` | Cancelamentos de matrícula |
| `contas.tsx` | Categorias de contas a pagar |
| `treinos.tsx` | CRUD treinos |
| `ponto.tsx` | Ponto / importação TXT |
| `treinos.pdf.tsx`, `ponto.pdf.tsx`, `ponto.espelho-pdf.tsx`, `ponto.espelho-todos-pdf.tsx` | PDFs com `@react-pdf/renderer` |

### Component organization

- `app/components/ui/` — shadcn/ui (Button, Card, Dialog, etc.)
- `app/components/{feature}/` — dialogs e tabelas por feature (`despesas/`, `folha/`, `ponto/`, etc.)
- `app/components/columns-desp.tsx`, `app/components/desp-table.tsx` — TanStack Table para despesas

### Utility libraries

- `app/lib/despesas-calendar.ts` — limites de mês civil em UTC
- `app/lib/upload-errors.ts` — helpers tipados para erros de upload
- `app/lib/utils.ts` — `cn()`, `toTitleCase()`, `parseLocalDate()`

### PDF responses

Ao retornar PDF em rotas loader, converter `Buffer` para `Uint8Array` antes de `new Response(body)` (compatível com `BodyInit`).

### Required environment variables

```
DATABASE_URL
POCKETBASE_URL
POCKETBASE_ADMIN_EMAIL
POCKETBASE_ADMIN_PASSWORD
POCKETBASE_COLLECTION   # default: arquivos_compartilhados
POCKETBASE_FIELD        # default: documento
EVO_USER
EVO_SECRET
```

### Deployment

Build Docker multi-stage na porta 3001. `app/dados/` é copiado na imagem; alterações em runtime são gravadas no mesmo path via `writeFileSync`.
