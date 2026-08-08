/**
 * Onboarding guiado — checklist de ativação para o lojista dar os primeiros
 * passos sozinho. A conclusão de cada item é DERIVADA dos dados reais já
 * disponíveis (perfil, empresa, clientes, WhatsApp, automações, uso), nunca
 * marcada manualmente — assim nada é declarado como "concluído" sem confirmação.
 *
 * Aqui ficam só os METADADOS dos passos + a preferência de "recolhido" por
 * empresa (localStorage — infra já existente). A detecção de status vive no
 * componente `onboarding-checklist.tsx`, que consome os hooks de dados.
 * (Frente Claude: experiência/ativação.)
 */
import { useCallback, useEffect, useState } from "react";

/** Módulos que podem tornar um passo indisponível quando não habilitados. */
export type ChecklistModule = "clientes" | "whatsapp" | "automacoes" | "relatorios";

export interface OnboardingStep {
  id: "profile" | "empresa" | "cliente" | "whatsapp" | "automacao" | "relatorio";
  title: string;
  /** Benefício em português simples: por que fazer isso. */
  benefit: string;
  to: string;
  cta: string;
  /** Se definido, o passo fica "indisponível" quando o módulo não está ativo. */
  module?: ChecklistModule;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "profile",
    title: "Complete seu perfil",
    benefit: "Seu nome identifica você para a equipe e nas mensagens. Leva 1 minuto.",
    to: "/configuracoes",
    cta: "Leve-me até lá",
  },
  {
    id: "empresa",
    title: "Confira o nome da empresa",
    benefit: "É como seus clientes reconhecem você. Confira se está escrito certo.",
    to: "/configuracoes",
    cta: "Leve-me até lá",
  },
  {
    id: "cliente",
    title: "Cadastre o primeiro cliente",
    benefit: "Os clientes são a base do CRM, das conversas e das automações.",
    to: "/clientes",
    cta: "Leve-me até lá",
    module: "clientes",
  },
  {
    id: "whatsapp",
    title: "Conecte o WhatsApp",
    benefit: "Envie e receba mensagens dos clientes direto no painel, com a IA ajudando.",
    to: "/configuracoes",
    cta: "Leve-me até lá",
    module: "whatsapp",
  },
  {
    id: "automacao",
    title: "Crie a primeira automação",
    benefit: "Deixe tarefas repetitivas no automático: boas-vindas, tags e notas.",
    to: "/automacoes",
    cta: "Leve-me até lá",
    module: "automacoes",
  },
  {
    id: "relatorio",
    title: "Acompanhe o primeiro relatório",
    benefit: "Veja com números reais o que está funcionando e onde focar.",
    to: "/relatorios",
    cta: "Leve-me até lá",
    module: "relatorios",
  },
];

const KEY = (org: string) => `cw.onboarding.collapsed.${org}`;

/**
 * Preferência de "recolhido" do checklist por empresa (localStorage).
 * Permite ao lojista recolher e retomar sem perder o progresso — que é sempre
 * recalculado a partir dos dados.
 */
export function useChecklistCollapsed(org: string | null) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!org || typeof window === "undefined") return;
    try {
      setCollapsed(window.localStorage.getItem(KEY(org)) === "1");
    } catch {
      setCollapsed(false);
    }
  }, [org]);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      if (org && typeof window !== "undefined") {
        try {
          window.localStorage.setItem(KEY(org), next ? "1" : "0");
        } catch {
          /* ignore */
        }
      }
      return next;
    });
  }, [org]);

  return { collapsed, toggle };
}
