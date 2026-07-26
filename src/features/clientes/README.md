# feature: Clientes

Base de clientes e contatos: listagem, filtros, perfil detalhado e histórico.

- **Module key:** `clientes` — registered in `src/config/modules.ts`.
- **Current screens:** /clientes, /clientes/$id (in `src/routes/`, unchanged during F0).
- **Activated in:** F2.

## Planned structure

```
clientes/
├── api.ts          # data access (Supabase queries, RLS-scoped)
├── schema.ts       # zod schemas + inferred types (validation source of truth)
├── hooks/          # TanStack Query hooks (useX, useCreateX…)
├── components/     # feature-specific components
└── index.ts        # public barrel (this module)
```

## Multi-tenant

All data access is scoped to the active `organizationId` and protected by
Row Level Security (see `docs/DATABASE.md`). The server derives the org from
the session — never trust an org id sent by the client.
