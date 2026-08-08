/**
 * Onboarding guiado — checklist de implantação para o lojista dar os primeiros
 * passos e extrair valor rápido. O progresso fica por organização (localStorage);
 * v1 com marcação manual + atalhos (auto-detecção pode ser plugada depois).
 * (Frente Claude: experiência/ativação.)
 */
import { useCallback, useEffect, useState } from "react";

export interface OnboardingStep {
  id: string;
  title: string;
  desc: string;
  to: string;
  cta: string;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "whatsapp",
    title: "Conectar o WhatsApp",
    desc: "Ligue o WhatsApp oficial (Meta) para enviar e receber mensagens dos clientes.",
    to: "/configuracoes",
    cta: "Ir para Configurações",
  },
  {
    id: "clientes",
    title: "Cadastrar seus clientes",
    desc: "Adicione ou importe seus contatos — é a base de tudo no CRM.",
    to: "/clientes",
    cta: "Ir para Clientes",
  },
  {
    id: "automacao",
    title: "Criar sua 1ª automação",
    desc: "Monte um fluxo que trabalha por você (boas-vindas, nota, tag...).",
    to: "/automacoes/builder",
    cta: "Abrir o construtor",
  },
  {
    id: "ia",
    title: "Gerar um fluxo com IA",
    desc: "Descreva em português e deixe a IA montar a automação pra você.",
    to: "/automacoes",
    cta: "Gerar com IA",
  },
];

const KEY = (org: string) => `cw.onboarding.${org}`;

/** Progresso do onboarding por organização (localStorage). */
export function useOnboarding(org: string | null) {
  const [done, setDone] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!org || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(KEY(org));
      setDone(raw ? (JSON.parse(raw) as Record<string, boolean>) : {});
    } catch {
      setDone({});
    }
  }, [org]);

  const toggle = useCallback(
    (id: string, value?: boolean) => {
      if (!org || typeof window === "undefined") return;
      setDone((prev) => {
        const next = { ...prev, [id]: value ?? !prev[id] };
        try {
          window.localStorage.setItem(KEY(org), JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [org],
  );

  const completed = ONBOARDING_STEPS.filter((s) => done[s.id]).length;
  const total = ONBOARDING_STEPS.length;
  const allDone = completed >= total;
  const percent = Math.round((completed / total) * 100);

  return { done, toggle, completed, total, allDone, percent };
}
