/**
 * CopilotFocusContext — "passagem da conversa selecionada" (frente Claude).
 *
 * Uma tela (ex.: WhatsApp) publica o foco atual (conversa selecionada); o painel
 * global "Ajuda + IA" lê esse foco para mostrar o contexto e passar o
 * `conversationId` como input das ferramentas. Só o ID trafega — leitura,
 * autorização e prompt ocorrem server-side (Edge Function do Core).
 *
 * O contexto também expõe um "draft sink": a tela registra como receber um
 * rascunho (inserir no compositor) e o painel entrega o texto quando o
 * atendente escolhe "Inserir no campo". Nunca envia — só preenche.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type CopilotFocus =
  | { type: "conversation"; id: string; label?: string }
  | null;

type DraftSink = (text: string) => void;

interface FocusValue {
  focus: CopilotFocus;
  setFocus: (focus: CopilotFocus) => void;
  /** A tela registra (ou limpa com null) como receber um rascunho. */
  registerDraftSink: (sink: DraftSink | null) => void;
  /** O painel entrega o rascunho ao campo de mensagem. Retorna false se não há destino. */
  insertDraft: (text: string) => boolean;
}

const FocusContext = createContext<FocusValue>({
  focus: null,
  setFocus: () => {},
  registerDraftSink: () => {},
  insertDraft: () => false,
});

export function CopilotFocusProvider({ children }: { children: ReactNode }) {
  const [focus, setFocus] = useState<CopilotFocus>(null);
  const draftSink = useRef<DraftSink | null>(null);

  const registerDraftSink = useCallback((sink: DraftSink | null) => {
    draftSink.current = sink;
  }, []);

  const insertDraft = useCallback((text: string) => {
    if (!draftSink.current) return false;
    draftSink.current(text);
    return true;
  }, []);

  const value = useMemo(
    () => ({ focus, setFocus, registerDraftSink, insertDraft }),
    [focus, registerDraftSink, insertDraft],
  );
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

/** A tela registra o destino do rascunho (ex.: setDraft do compositor). */
export function useRegisterDraftSink(): (sink: DraftSink | null) => void {
  return useContext(FocusContext).registerDraftSink;
}

/** O painel insere o rascunho no campo de mensagem (nunca envia). */
export function useInsertDraft(): (text: string) => boolean {
  return useContext(FocusContext).insertDraft;
}

/** Input para ferramentas com base no foco atual (só o ID trafega). */
export function focusToToolInput(focus: CopilotFocus): Record<string, unknown> {
  if (focus?.type === "conversation") return { conversationId: focus.id };
  return {};
}
