# Copiloto ConnectWeb — visão de produto e roadmap

> A IA não é só "gerar automação". Ela é um **Copiloto do lojista**: presente em
> todo o painel, **faz por você** e **te ensina a usar** — um cérebro só, em
> várias telas. Objetivo: ativação rápida, uso fácil e **valor real** para a
> empresa (o que mantém o sistema vivo e justifica o preço).

## 1. Princípio central
Um assistente contextual (sabe em que tela você está) que responde em português,
**executa** tarefas com segurança (via contratos do Core) e **ensina** o caminho.
Reaproveita a infra de IA já existente — é incremental, não do zero.

## 2. O que a IA faz por módulo (valor para o dono da loja)
| Módulo | Como a IA gera valor |
|---|---|
| **WhatsApp** | Responder com IA (no tom da loja) · resumir a conversa · classificar intenção (venda/suporte/cobrança) · sinalizar cliente quente |
| **Clientes / CRM** | Resumir histórico · sugerir próximo passo · detectar quem esfriou · segmentar por texto ("comprou e sumiu há 30 dias") |
| **Automações** | Gerar fluxo por linguagem natural (✅ pronto) · biblioteca de fluxos prontos · explicar o que um fluxo faz |
| **Relatórios** | "Pergunte aos seus dados" — "quanto vendi essa semana?" → número + gráfico |
| **Configurações / Onboarding** | Assistente de setup guiado: conectar WhatsApp → importar contatos → 1ª automação |

## 3. Menu de ajuda interativo (a experiência)
- **Assistente sempre à mão** — botão/painel global "Ajuda + IA", contextual à rota atual.
- **Onboarding guiado** — checklist de implantação com progresso e atalhos.
- **"Como faço X?"** — a IA explica **e faz/leva** você até a tela certa (deep-link).
- **Dicas proativas** — "você tem 12 conversas sem resposta; quer uma automação?".
- **Linguagem simples** — escrita para o lojista, sem jargão.

## 4. Por que isso mantém o sistema vivo
- **Ativação:** configura em ~20 min guiado — sem consultoria de R$850.
- **Retenção:** mata o "não sei usar" (causa nº1 de churn em CRM).
- **Diferencial:** concorrentes (Wazzup + Bitrix) não têm um copiloto que ensina e faz.

## 5. Arquitetura (colaboração Claude × Codex)
Um só **serviço de Copiloto** com "ferramentas" por módulo (ler contexto + agir).
- **Core (Codex)** — `src/core/copilot/**`: contratos das ferramentas, registro por
  módulo, autorização por permissões da sessão, classificação de risco +
  confirmação obrigatória, auditoria. Org/ator sempre vêm da sessão do servidor.
- **Experiência (Claude)** — onboarding guiado, painel global Ajuda + IA, contexto
  visual da rota, estados vazios e atalhos, integração no `AppLayout`.

O contrato de integração: a UI lista as ferramentas disponíveis (`listCopilotTools`)
e envia solicitações de execução (`executeCopilotTool`); o Core decide habilitação,
permissão e se exige confirmação (retorna `CONFIRMATION_REQUIRED`). Detalhes em
[`COPILOT_COLLABORATION.md`](./COPILOT_COLLABORATION.md).

## 6. Roadmap (impacto × esforço)
1. **Onboarding guiado + assistente contextual** — maior impacto em ativação/retenção. *(em construção)*
2. **WhatsApp: responder/resumir com IA** — uso diário, valor imediato.
3. **"Pergunte aos dados" (relatórios em NL)** — encanta e mostra ROI.
4. **Biblioteca de automações prontas + gerar por IA** — base já existe.

Cada item acima é uma **ferramenta** nova plugada na mesma plataforma do Copiloto.
