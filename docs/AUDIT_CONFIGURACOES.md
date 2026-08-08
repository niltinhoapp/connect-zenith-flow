# Auditoria — Configurações (entregas do Codex a815c05)

Base auditada: `origin/main` @ `a815c05`, incluindo os commits do Codex
`9dc8e89` (WhatsApp oficial + webhooks), `7481af0` (2FA + sessões),
`76f5a9a` (preferências persistentes) e `a815c05` (consumo real do plano).

## Método

- `npm run typecheck` → **0 erros**.
- `npm run test` → **89/89** (24 arquivos).
- `npm run build` → **OK**.
- Boot no dev server: app sobe, `/configuracoes` redireciona para `/login`
  (rota protegida por `beforeLoad`), **sem erros de console**.
- **Limitação:** as seções autenticadas de `/configuracoes` não puderam ser
  exercitadas visualmente porque exigem sessão real (não é permitido inserir
  credenciais). A auditoria das seções foi feita por leitura do código-fonte
  (`src/routes/configuracoes.tsx`, `verificar-2fa.tsx`, `__root.tsx`,
  `features/configuracoes/hooks/use-settings.ts`, `schema.ts`).

## Veredito funcional

As integrações do Codex são **reais** (não há botões falsos nas seções
principais):

| Área | Verificação | Situação |
|------|-------------|----------|
| 2FA ativar/confirmar | `auth.mfa.enroll` + `challengeAndVerify` | OK |
| Redirecionar p/ `/verificar-2fa` | `session.mfaRequired` em `__root beforeLoad` | OK |
| Encerrar outras sessões | `auth.signOut({ scope: "others" })` | OK |
| Preferências persistentes | `useUpdatePreferences` → settings-service | OK |
| Conexão manual Meta | `functions.invoke("whatsapp-connect", { mode: "manual" })` | OK |
| Webhooks criar/pausar/remover | `WebhookService` (create/setEnabled/remove) | OK |
| Plano/limites/consumo | `usage[]` real do settings-service | OK |

Nenhum defeito **bloqueante** encontrado. Botões honestos: "Gestão de
assinatura em breve" está `disabled` e rotulado como indisponível.

## Achados (lacunas de UX/robustez na camada visual — frente Claude)

Os itens abaixo estão na rota (`src/routes/**`) e foram corrigidos nesta frente
visual, **sem tocar** em Core/serviços/hooks/schema/cobrança.

- **F1 — Exclusão de webhook sem confirmação.** O ícone de lixeira removia o
  endpoint em um clique. → Adicionado `AlertDialog` de confirmação.
- **F2 — Desativar 2FA sem confirmação.** "Desativar" desligava o fator em um
  clique. → Adicionado `AlertDialog` de confirmação.
- **F3 — `listFactors()` sem tratamento de erro/carregamento.** Promise sem
  `.catch` (risco de rejeição não tratada) e flash de "Desativado" antes de
  carregar. → Adicionado `.catch` + estado de carregamento do fator.
- **F4 — `/verificar-2fa` sem saída quando não há fator verificado.** Botão
  ficava desabilitado sem orientação. → Adicionada mensagem + link para login.
- **F5 — "Encerrar outras sessões" sem estado de ocupado.** Permitia clique
  duplo, sem feedback. → Adicionado estado `busy` + spinner.

## Achados (experiência/educação — implementados nesta frente)

- **E1 — Sem orientação de onde achar WABA ID, Phone Number ID e token
  permanente na Meta.** → Passo a passo colapsável no formulário de conexão.
- **E2 — Textos confusos** (ex.: "Modo compacto — Preferência preparada para a
  interface"). → Reescritos para linguagem de lojista.
- **E3 — Sem ajuda contextual por seção.** → Notas educativas colapsáveis
  (`<details>` nativo, acessível) em cada seção.
- **E4 — Acessibilidade.** → `aria-current` na navegação; associação
  `label/htmlFor` no código 2FA; foco por teclado nas ajudas nativas.

## Fora do escopo (permanece com o Codex)

`src/core/**`, `src/features/configuracoes/application/**`,
`hooks/use-settings.ts`, `schema.ts`, migrations, API Keys e a lógica de
cobrança não foram alterados.
