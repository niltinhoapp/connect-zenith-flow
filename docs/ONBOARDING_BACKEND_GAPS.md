# Onboarding — lacunas que dependem de backend

O checklist de ativação (`src/components/copilot/onboarding-checklist.tsx`) deriva
a conclusão de cada passo **apenas dos dados reais já disponíveis** via hooks
existentes (perfil, empresa, clientes, WhatsApp, automações, uso). Nenhum passo é
marcado manualmente. Os pontos abaixo melhorariam a experiência, mas exigem
trabalho de backend (frente do Codex) e **não** foram implementados aqui.

## 1. Sinal real de "primeiro relatório acompanhado"

- **Hoje (proxy visual):** o passo "Acompanhe o primeiro relatório" fica
  concluído quando existe qualquer uso medido (`usage[].used > 0`) — ou seja,
  quando já há dados reais para relatar.
- **Gap:** não há um sinal de que o lojista **abriu/visualizou** um relatório.
  Um evento leve (ex.: `report.viewed`) ou uma coluna de telemetria permitiria
  confirmar a ação de "acompanhar", não só a existência de dados.

## 2. Estado de onboarding por empresa no servidor

- **Hoje:** o progresso é **derivado dos dados** (portanto já é consistente
  entre dispositivos). A única preferência persistida é "recolhido/expandido",
  guardada em `localStorage` por organização (infra já existente) — logo, é por
  navegador, não por empresa no servidor.
- **Gap:** uma coluna/tabela `onboarding_state` por empresa (ex.: `dismissed_at`,
  `completed_at`) permitiria: (a) recolher o checklist e manter recolhido em
  qualquer dispositivo; (b) registrar quando a ativação foi concluída para
  métricas de sucesso do cliente.

## 3. Confirmação explícita do nome da empresa

- **Hoje:** o passo "Confira o nome da empresa" é considerado concluído quando
  existe um nome definido (`workspace.name` preenchido) — confirmável pelos
  dados.
- **Gap:** não é possível confirmar que o lojista **revisou e aprovou** o nome
  (correção, não apenas presença). Um flag de "confirmado pelo usuário" exigiria
  backend. Mantido como presença de nome para não declarar algo não confirmável.

---

Nenhum destes itens bloqueia o uso: o checklist funciona com detecção real e
degrada com clareza para "pendente"/"indisponível" quando não há dado ou módulo.
