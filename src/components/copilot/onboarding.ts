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
  id: "empresa" | "whatsapp" | "cliente" | "mensagem" | "crm" | "automacao" | "primeiro_valor";
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
    id: "empresa",
    title: "Configure sua empresa",
    benefit: "Isso identifica sua operação e prepara o ConnectWeb para trabalhar com seus dados.",
    to: "/configuracoes",
    cta: "Fazer agora",
  },
  {
    id: "whatsapp",
    title: "Conecte o WhatsApp",
    benefit: "É por aqui que uma mensagem real entra e inicia a jornada.",
    to: "/configuracoes",
    cta: "Fazer agora",
    module: "whatsapp",
  },
  {
    id: "cliente",
    title: "Registre o primeiro cliente ou lead",
    benefit: "O CRM precisa de uma pessoa real para organizar o atendimento.",
    to: "/clientes",
    cta: "Fazer agora",
    module: "clientes",
  },
  {
    id: "mensagem",
    title: "Receba a primeira mensagem",
    benefit: "Uma mensagem real comprova que o canal está funcionando.",
    to: "/whatsapp",
    cta: "Fazer agora",
    module: "whatsapp",
  },
  {
    id: "crm",
    title: "Identifique o cliente no CRM",
    benefit: "Vincule a conversa ao cliente para transformar atendimento em oportunidade.",
    to: "/whatsapp",
    cta: "Fazer agora",
    module: "clientes",
  },
  {
    id: "automacao",
    title: "Crie e ative a primeira automação",
    benefit: "Somente uma automação ativa pode reagir às mensagens recebidas.",
    to: "/automacoes",
    cta: "Fazer agora",
    module: "automacoes",
  },
  {
    id: "primeiro_valor",
    title: "Execute a primeira automação",
    benefit:
      "O primeiro valor acontece quando uma mensagem recebida dispara uma automação com sucesso.",
    to: "/automacoes",
    cta: "Fazer agora",
    module: "automacoes",
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
