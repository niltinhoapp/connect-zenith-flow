# supabase/

Configuração e migrações do backend Supabase (PostgreSQL + Auth + Storage + RLS).

## Estado (F0)

Base **não provisionada**. Contém:

- `migrations/0001_init_multitenant.sql` — fundação multiempresa (organizations,
  profiles, memberships, helper `is_member_of`, RLS). Não aplicada ainda.
- `config.toml` — configuração local do Supabase CLI.

## Ativação (F1)

```bash
bun add @supabase/supabase-js @supabase/ssr
supabase login
supabase link --project-ref <ref>
supabase db push                                   # aplica as migrações
supabase gen types typescript --linked > src/types/database.ts
```

Depois preencha `.env` a partir de `.env.example` e ative os clientes em
`src/lib/supabase/` e `src/server/supabase.ts` (descomente os imports do SDK).

Ver `docs/DATABASE.md` e `docs/ROADMAP.md · F1`.
