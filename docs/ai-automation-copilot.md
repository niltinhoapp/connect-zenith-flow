# AI Automation Copilot (F3.3)

O botão **"Gerar com IA"** do módulo Automações, real: você descreve um fluxo em
português e a IA (Claude Opus 5) monta o **grafo de automação** (nós + arestas).
O rascunho abre no builder para **revisão humana** — nada é ativado sozinho.

## Arquitetura

```
Lista de Automações  ──"Gerar com IA"──▶  diálogo (descrição em NL)
        │
        ▼  useGenerateFlow()  →  AutomacaoApplicationService.generateAndSaveFlow()
        │
        ├─▶ Edge Function `ai-generate-flow` (Deno, JWT + RBAC automacoes.manage)
        │       └─ Claude Opus 5 (Messages API, tool-use estrito) → grafo bruto
        │          [ ANTHROPIC_API_KEY = secret do projeto, nunca vai ao browser ]
        │
        ├─▶ normalizeAiFlow(grafo)   ← CAMADA DE SEGURANÇA (TS puro, testado)
        │       valida contra o catálogo do motor; descarta o desconhecido
        │
        └─▶ automation_save (RASCUNHO)  →  navega para o builder ?id=
                └─ humano revisa, edita e ATIVA quando quiser (RBAC/RLS no save)
```

## Segurança (defesa em profundidade)

1. **Chave nunca no cliente.** `ANTHROPIC_API_KEY` é secret do projeto; só a Edge
   Function a lê. O frontend chama a function com o JWT do usuário.
2. **RBAC no servidor.** A function exige JWT válido e `has_permission(org, 'automacoes.manage')`.
3. **Saída da IA é não-confiável.** `src/features/automacoes/domain/ai-flow.ts`
   (`normalizeAiFlow`) sanitiza o grafo: só tipos/ações/operadores conhecidos,
   exatamente 1 gatilho, arestas apenas entre nós existentes, sem loops/duplicatas.
   Coberto por `src/features/automacoes/ai-flow.test.ts` (8 testes).
4. **Human-in-the-loop.** O fluxo gerado é salvo como **rascunho** e só executa
   depois que a pessoa revisa e ativa. O motor, por sua vez, só executa nós/ações
   conhecidos (o executor `automation_action` ignora ações fora da lista).

## Ativação (ações suas — envolvem a chave/secret)

1. Obtenha uma chave em https://console.anthropic.com e configure como secret:
   ```bash
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   ```
2. Faça o deploy da função:
   ```bash
   supabase functions deploy ai-generate-flow
   ```
3. Pronto. No app: **Automações → Gerar com IA**, descreva o fluxo, revise no builder.

> Sem a chave, a function responde `503 ANTHROPIC_API_KEY não configurada` e a UI
> mostra o erro no diálogo — o resto do sistema segue funcionando normalmente.

## Modelo e custo

- Modelo: **`claude-opus-5`** (tool-use estrito garante a forma do grafo).
- Cada geração é 1 request (~alguns milhares de tokens). Ajuste o modelo em
  `supabase/functions/ai-generate-flow/index.ts` se quiser (ex.: `claude-sonnet-5`
  para reduzir custo).

## Arquivos

- `src/features/automacoes/domain/ai-flow.ts` — contrato + normalizador (segurança).
- `src/features/automacoes/ai-flow.test.ts` — testes do normalizador.
- `supabase/functions/ai-generate-flow/index.ts` — Edge Function (Claude Opus 5).
- `src/features/automacoes/application/automacao-application-service.ts` — `generateAndSaveFlow`.
- `src/features/automacoes/hooks/use-automacoes.ts` — `useGenerateFlow`.
- `src/routes/automacoes.tsx` — diálogo "Gerar com IA".
