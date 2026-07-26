# Regras do Projeto — ConnectWeb Automations

Regras de engenharia que todo agente/dev deve seguir. Complementam o
`AGENTS.md` (regras do Lovable) na raiz.

## 1. Design System é intocável

- Não editar `src/styles.css` nem os tokens OKLCH sem decisão explícita.
- Não trocar classes utilitárias das telas por "melhorias" visuais.
- Cores sempre via tokens (`var(--color-*)` / classes semânticas), nunca hex
  cravado.

## 2. Não alterar UI/UX gerada pelo Lovable

- As telas em `src/routes/**` são o produto visual aprovado. Refatorações devem
  manter a **saída renderizada idêntica** (mesmo DOM/classes).
- Extrações de componente são permitidas desde que preservem o output.

## 3. Sincronização com o Lovable

- Nunca reescrever histórico já publicado (sem `--force`, rebase ou squash de
  commits enviados). Ver `AGENTS.md`.
- Manter a branch conectada sempre em estado funcional.
- Não editar `vite.config.ts` além de `defineConfig({ vite: {...} })` — os
  plugins do Lovable já estão embutidos.

## 4. Roteamento

- `src/routes/` é file-based; **não** mover/renomear arquivos de rota (quebra o
  `routeTree.gen.ts` e as URLs). Adicionar rotas segue as convenções em
  `src/routes/README.md`.
- `routeTree.gen.ts` é gerado — nunca editar à mão.

## 5. Fronteira cliente/servidor

- Secrets (service role, tokens de WhatsApp/IA/Stripe) só em `src/server/**`,
  lidos de `process.env`.
- `src/lib/env.ts` é client-safe: apenas variáveis `VITE_*`.
- Proibido importar `src/server/**` em código de cliente.

## 6. Multiempresa e segurança

- Toda tabela de negócio tem `organization_id` + política RLS.
- A organização ativa vem da sessão no servidor; **nunca** confiar em
  `organizationId` vindo do cliente.
- O client admin (service role) ignora RLS — usar só em contexto confiável e
  escopar `organization_id` manualmente.

## 7. Organização por features

- Lógica de domínio vive em `src/features/<módulo>/` (`api`, `schema`, `hooks`,
  `components`), exposta pelo barrel `index.ts`.
- Rotas ficam finas: layout + composição de UI da feature.
- `schema.ts` (zod) é a fonte da verdade de validação e tipos derivados.

## 8. Dependências

- Gerenciador é **Bun**. Instalar com `bun add` (respeita o guard de 24h em
  `bunfig.toml`). Não introduzir `npm install`/`package-lock.json`.
- Adicionar dependência só quando a fase exigir (ver `ROADMAP.md`).

## 9. Convenções de código

- TypeScript `strict`; sem `any` fora de limites justificados.
- Alias `@/*`. Sem imports relativos profundos (`../../..`).
- Rodar `bun run lint` e `bun run format` antes de commitar.
