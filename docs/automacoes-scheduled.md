# Gatilho agendado (cron) — Automações

Completa o conjunto de gatilhos: fluxos com trigger **"scheduled"** disparam
sozinhos por horário. Sem lib de cron — dois modos simples e determinísticos.

## Modos (config em `automations.trigger_config`)
- **Intervalo:** `{ mode: "interval", every: N, unit: "minutes"|"hours"|"days" }`
- **Diário:** `{ mode: "daily", at: "HH:MM" }` — horário em **UTC**.

## Como funciona
```
Builder (nó trigger = "scheduled")
  └─ campos de agendamento → salvos em trigger_config (automation_save)
Worker (a cada ~30s)
  └─ automation_due_scheduled()  → fluxos ativos vencidos (next_run_at <= now, ou null)
  └─ nextRunAt(config, now)       [schedule.ts / espelho no worker]
       ├─ next_run_at null → 1ª vez: só agenda (não dispara)
       └─ vencido → automation_start_run('scheduled', idempotente 'sched:<slot>')
                    + automation_set_next_run(próximo)
```

- **Idempotente por slot:** `start_run` deduplica por `sched:<slot>`, então mesmo
  que o worker veja o fluxo em ticks seguidos, dispara **uma vez por horário**.
- **Sem enxurrada:** o próximo horário é calculado a partir de "agora", pulando
  slots perdidos se o worker esteve fora.
- **Ativação:** o fluxo precisa estar **ativo** (status `active`). Rascunho/pausado
  não agenda.

## Migration
`supabase/migrations/0066_automation_scheduled.sql` — coluna `next_run_at` +
`automation_due_scheduled()` + `automation_set_next_run()`. Reinicie o worker
depois de aplicar.

## Arquivos
- `src/features/automacoes/domain/schedule.ts` — `parseSchedule` / `nextRunAt` (puro).
- `src/features/automacoes/schedule.test.ts` — 9 testes.
- `scripts/worker.mjs` — `dispatchScheduled()` (espelho JS) + cadência de 30s.
- `src/routes/automacoes_.builder.tsx` — campos de agendamento no inspector do gatilho.
