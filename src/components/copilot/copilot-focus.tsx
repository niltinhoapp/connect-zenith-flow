/**
 * CopilotFocusContext — "passagem da conversa selecionada" (frente Claude).
 *
 * Uma tela (ex.: WhatsApp) publica o foco atual (conversa selecionada); o painel
 * global "Ajuda + IA" lê esse foco para mostrar o contexto e passar o
 * `conversationId` como input das ferramentas. Só o ID trafega — leitura,
 * autorização e prompt ocorrem server-side (Edge Function do Core).
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type CopilotFocus =
  | { type: "conversation"; id: string; label?: string }
  | null;

interface FocusValue {
  focus: CopilotFocus;
  setFocus: (focus: CopilotFocus) => void;
}

const FocusContext = createContext<FocusValue>({ focus: null, setFocus: () => {} });

export function CopilotFocusProvider({ children }: { children: ReactNode }) {
  const [focus, setFocus] = useState<CopilotFocus>(null);
  const value = useMemo(() => ({ focus, setFocus }), [focus]);
  return <FocusContext.Provider value={value}>{children}</FocusContext.Provider>;
}

/** Lê o foco atual (para o painel global). */
export function useCopilotFocus(): CopilotFocus {
  return useContext(FocusContext).focus;
}

/** Publica o foco (para as telas). */
export function useSetCopilotFocus(): (focus: CopilotFocus) => void {
  return useContext(FocusContext).setFocus;
}

/** Input para ferramentas com base no foco atual (só o ID trafega). */
export function focusToToolInput(focus: CopilotFocus): Record<string, unknown> {
  if (focus?.type === "conversation") return { conversationId: focus.id };
  return {};
}
