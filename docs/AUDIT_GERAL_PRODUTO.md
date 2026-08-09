# Auditoria geral do produto — ConnectWeb

Branch auditada: `claude/work` sincronizada com `origin/main` @ `64eb49b`
(fast-forward). Auditoria **estática + gates**; nada foi corrigido ou
reformatado. Data: 2026-08-09.

## Resultado exato dos três gates

| Gate | Comando | Resultado |
|------|---------|-----------|
| Typecheck | `npm run typecheck` | **exit 0** — sem erros |
| Testes | `npm run test` | **exit 0** — 31 arquivos, **106/106** aprovados |
| Build | `npm run build` | **exit 0** — build de produção gerado (nitro) |

### Lint (registrado à parte, conforme instruído)

`npx eslint .` → **exit 1**, porém **100% por formatação**:
- `prettier/prettier`: **1521** ocorrências (formatação pré-existente do projeto);
- erros reais (não-prettier): **0**;
- restante: apenas *warnings* `react-refresh/only-export-components`.

**Não reformatar o projeto inteiro.** Se desejado, rodar `prettier --write` numa
passada dedicada e separada (fora do escopo desta auditoria).

## Limitações de teste

- **Teste autenticado não foi possível**: todas as telas do app estão atrás de
  login (`/whatsapp`, `/configuracoes`, etc.) e não há credenciais disponíveis
  para o agente. A verificação foi **estática (leitura de código) + os três
  gates**. Fluxos que dependem de sessão real (checkout Asaas, envio no WhatsApp,
  geração de IA, dados por empresa) precisam de validação logada pelo time.

## Achados

> Legenda de responsável: **Claude visual** (camada de UI/experiência) ·
> **Codex funcional** (Core, serviços, contratos, dados).

### F1 · Cobrança · Gravidade: BAIXA
- **Evidência:** `src/components/billing/plan-showcase.tsx:40,42-45,118-144`
  mantém um `useState pending` + `AlertDialog` "Compra em breve" + nota de
  fallback. Em `src/routes/configuracoes.tsx:357` a `BillingSection` **sempre**
  passa `onPurchasePackage={setCheckoutPackage}` (abre o `AddonCheckoutDialog`
  real). Logo o diálogo interno e a nota **nunca renderizam** — código morto.
- **Impacto para o lojista:** nenhum hoje (nunca aparece); risco de manutenção e
  de mensagens conflitantes se alguém remover o `onPurchasePackage`.
- **Arquivo:** `src/components/billing/plan-showcase.tsx`
- **Recomendação:** remover o estado `pending`, o `AlertDialog` interno e a nota
  `!onPurchasePackage`, deixando o `PlanShowcase` apenas emitir `onPurchasePackage`.
- **Responsável:** Claude visual

### F2 · Core / Cobrança · Gravidade: MÉDIA
- **Evidência:** `SubscriptionStatus` definido em dois lugares com valores
  **divergentes**: `src/core/billing/types.ts:2` (7 estados:
  `incomplete|trialing|active|past_due|unpaid|paused|canceled`) vs
  `src/types/domain.ts:143` (4 estados: `trialing|active|past_due|canceled`).
- **Impacto para o lojista:** se a UI consumir a versão curta, estados como
  `unpaid`, `paused` e `incomplete` não são reconhecidos → assinatura "atrasada"/
  "suspensa" pode não ser exibida com a orientação correta.
- **Arquivo:** `src/types/domain.ts` / `src/core/billing/types.ts`
- **Recomendação:** unificar numa fonte única (ex.: `types/domain.ts` re-exporta
  de `core/billing`), evitando duas verdades.
- **Responsável:** Codex funcional

### F3 · Relatórios · Gravidade: MÉDIA
- **Evidência:** `src/routes/relatorios.tsx:27` usa
  `const { data: m, isError, refetch } = useReports();` — **sem `isLoading`** e
  **sem estado vazio**. Os gráficos renderizam `m?.x ?? []`, ficando em branco
  durante o carregamento e para empresas sem dados; só `isError` é tratado.
- **Impacto para o lojista:** empresa nova vê gráficos vazios sem explicação —
  parece quebrado, não "ainda sem dados".
- **Arquivo:** `src/routes/relatorios.tsx`
- **Recomendação:** adicionar *skeleton* de carregamento e um estado vazio
  honesto ("Seus relatórios aparecerão conforme você usa o sistema").
- **Responsável:** Claude visual

### F4 · WhatsApp · Gravidade: MÉDIA
- **Evidência:** `src/routes/whatsapp.tsx:74,77` — a ajuda de falha de envio usa
  jargão técnico da Meta: "token com `whatsapp_business_messaging`", "número
  atribuído ao **usuário do sistema**", "**token permanente**".
- **Impacto para o lojista:** linguagem pouco acessível ao dono da loja; roça o
  critério de "não expor termos técnicos".
- **Arquivo:** `src/routes/whatsapp.tsx`
- **Recomendação:** simplificar ("Não foi possível enviar. Reconecte o WhatsApp
  em Configurações → Integrações; se persistir, peça ajuda ao responsável
  técnico."), deixando o detalhe técnico só para admins.
- **Responsável:** Claude visual

### F5 · Core / WhatsApp · Gravidade: BAIXA
- **Evidência:** `MessageDirection` duplicado (idêntico) em
  `src/features/whatsapp/domain/entities/message.ts:3` e `src/types/domain.ts:80`.
- **Impacto para o lojista:** nenhum direto; risco de *drift* futuro.
- **Arquivo:** `src/types/domain.ts`
- **Recomendação:** manter uma fonte única e re-exportar.
- **Responsável:** Codex funcional

### F6 · Global / DX · Gravidade: BAIXA
- **Evidência:** `npx eslint .` falha só por **1521** `prettier/prettier`
  (formatação) e *warnings* `react-refresh/only-export-components`; **0** erros
  reais.
- **Impacto para o lojista:** nenhum.
- **Arquivo:** projeto inteiro (formatação).
- **Recomendação:** não reformatar em massa; passada de prettier dedicada se e
  quando desejado.
- **Responsável:** Codex funcional (dono dos gates)

### F7 · Cobrança / tipos · Gravidade: BAIXA
- **Evidência:** `src/routes/configuracoes.tsx` (BillingSection) casta
  `product.id as "ai_advantage" | "ai_turbo" | "ai_ultra"`; `commercial.ts:8`
  espelha os IDs do backend. Se o catálogo do banco divergir desses IDs, o cast
  esconde a incompatibilidade.
- **Impacto para o lojista:** baixo enquanto os IDs coincidem.
- **Arquivo:** `src/routes/configuracoes.tsx`, `src/components/billing/commercial.ts`
- **Recomendação:** derivar os pacotes do `overview` sem *cast* (ou validar).
- **Responsável:** Codex funcional / Claude visual

## Estado por módulo

| Módulo | Situação | Observações |
|--------|----------|-------------|
| Dashboard | ✅ Bom | Dados reais, KPIs, cockpit de atendimento prioritário, estado vazio de atividade. |
| CRM | ✅ Bom | `loading` (skeleton), `isError`, vazio ("Nenhum funil configurado"). |
| Clientes | ✅ Bom | `loading`/`skeleton`, `isError`, lista/detalhe. *(Confirmar estado vazio explícito ao logar.)* |
| WhatsApp + IA | ⚠️ OK com ressalva | Inbox, insights, filtros, fila; ajuda de erro técnica demais (**F4**). Envio depende de token Meta válido. |
| Automações | ✅ Bom | Lista, builder, gerar com IA. |
| Relatórios | ⚠️ Ajustar | Sem loading/vazio (**F3**). |
| Configurações | ✅ Bom | Perfil, workspace, 2FA/sessões, integrações, API Keys, webhooks — com ajuda contextual e confirmações. |
| Monitoramento | ✅ Bom | Saúde real (jobs/runs/billing), alertas 70/90/100, orientações; degrada honesto. |
| Cobrança + Checkout | ⚠️ OK com ressalva | Plano, pacotes, `AddonCheckoutDialog`, resumo da conta e histórico ligados; código morto no `PlanShowcase` (**F1**). Cobrança real depende do Asaas. |
| Copiloto + Onboarding | ✅ Bom | Painel Ajuda+IA, checklist data-driven, ajuda por rota. |

## Funcionalidades prontas
- Dashboard, CRM, Clientes, Automações (+ gerar com IA), Configurações
  (perfil/2FA/sessões/integrações/API Keys/webhooks), Monitoramento, Copiloto e
  onboarding, apresentação de plano e pacotes de IA.

## Funcionalidades parcialmente ligadas (dependem de dado/config real)
- **WhatsApp — envio**: depende de token permanente válido da Meta e da conta
  conectada; recebimento via webhook.
- **IA (assist, insights, gerar fluxo)**: depende da franquia/saldo de créditos e
  das Edge Functions publicadas + chave da IA.
- **Checkout Asaas**: `AddonCheckoutDialog` ligado, mas a cobrança real depende
  das credenciais Asaas e do webhook `asaas-webhook` publicado.
- **Assinatura/Histórico**: consomem `useBillingOverview`; refletem dados reais
  quando as migrations de billing estiverem aplicadas e houver movimentação.

## Dependências externas ainda pendentes
- **Meta/WhatsApp**: token permanente (usuário do sistema) + app configurado.
- **Asaas**: chaves de API + endpoint do webhook configurado no painel Asaas.
- **IA (Anthropic)**: chave como secret no Supabase.
- **Deploy das Edge Functions**: `whatsapp-connect`, `ai-whatsapp-assist`,
  `ai-generate-flow`, `asaas-webhook`, `public-api`.

## Migrations necessárias (presentes no repo, aplicar no banco)
- `0070_whatsapp_awaiting_reply.sql`
- `0071_billing_and_ai_addons.sql`
- `0072_asaas_billing_provider.sql`
- `0073_billing_history_overview.sql`

*(Aplicação é responsabilidade do Codex/infra — fora da frente visual.)*

## Próximas 10 tarefas (priorizadas)

1. **[Codex]** Unificar `SubscriptionStatus` numa fonte única (**F2**).
2. **[Claude]** Relatórios: estados de carregamento e vazio (**F3**).
3. **[Claude]** WhatsApp: simplificar a mensagem de falha de envio (**F4**).
4. **[Claude]** Limpar código morto do `PlanShowcase` (**F1**).
5. **[Codex]** Aplicar migrations `0070`–`0073` e publicar as Edge Functions.
6. **[Codex]** Configurar Asaas (chaves + webhook) e validar o checkout ponta a
   ponta logado.
7. **[Codex]** Confirmar deploy/`verify_jwt` das funções chamadas do navegador
   (connect/assist/generate) para evitar CORS.
8. **[Claude+Codex]** Teste autenticado guiado de cada módulo (checklist logado),
   já que o agente não consegue logar.
9. **[Codex]** Remover duplicidade de `MessageDirection` (**F5**).
10. **[Claude]** Revisar estados vazios/erro remanescentes (confirmar Clientes,
    padronizar linguagem de lojista em toasts de erro).

---

*Auditoria estática + gates. Nenhum recurso implementado, nenhum arquivo
corrigido, nenhum arquivo pessoal/untracked tocado.*
