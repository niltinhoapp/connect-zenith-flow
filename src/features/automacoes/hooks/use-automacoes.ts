import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession, type AuthSession } from "@/core/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { queryKeys, mutationDefaults } from "@/lib/query";
import { AutomacaoApplicationService, type SaveAutomationInput } from "@/features/automacoes";

function makeService(session: AuthSession): AutomacaoApplicationService {
  const db = getSupabaseBrowserClient();
  return new AutomacaoApplicationService(db, {
    organizationId: session.activeOrganization!.organizationId,
    actorId: session.user.id,
    enabledModules: session.enabledModules,
  });
}

function useOrg() {
  const session = useSession();
  return { session, org: session?.activeOrganization?.organizationId ?? null };
}

export function useAutomations() {
  const { session, org } = useOrg();
  return useQuery({
    queryKey: org ? queryKeys.automacoes.list(org) : ["automacoes", "none"],
    enabled: !!org && !!session,
    queryFn: () => makeService(session!).list(),
  });
}

export function useAutomationGraph(automationId: string | null) {
  const { session, org } = useOrg();
  return useQuery({
    queryKey:
      org && automationId
        ? queryKeys.automacoes.detail(org, automationId)
        : ["automacoes", "detail", "none"],
    enabled: !!org && !!session && !!automationId,
    queryFn: () => makeService(session!).getGraph(automationId!),
  });
}

export function useAutomationRuns(automationId: string | null) {
  const { session, org } = useOrg();
  return useQuery({
    queryKey:
      org && automationId
        ? queryKeys.automacoes.runs(org, automationId)
        : ["automacoes", "runs", "none"],
    enabled: !!org && !!session && !!automationId,
    refetchInterval: (q) => {
      const rows = (q.state.data as Array<{ status: string }> | undefined) ?? [];
      return rows.some((r) => r.status === "queued" || r.status === "running") ? 3000 : false;
    },
    queryFn: () => makeService(session!).listRuns(automationId!),
  });
}

export function useAutomationRunSteps(runId: string | null) {
  const { session, org } = useOrg();
  return useQuery({
    queryKey:
      org && runId ? queryKeys.automacoes.runSteps(org, runId) : ["automacoes", "steps", "none"],
    enabled: !!org && !!session && !!runId,
    queryFn: () => makeService(session!).listRunSteps(runId!),
  });
}

function useInvalidateList() {
  const { org } = useOrg();
  const qc = useQueryClient();
  return () => {
    if (org) qc.invalidateQueries({ queryKey: queryKeys.automacoes.all(org) });
  };
}

export function useSaveAutomation() {
  const session = useSession();
  const invalidate = useInvalidateList();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (input: SaveAutomationInput) => makeService(session!).save(input),
    onSuccess: invalidate,
  });
}

export function useSetAutomationStatus() {
  const session = useSession();
  const invalidate = useInvalidateList();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (v: { id: string; status: "draft" | "active" | "paused" }) =>
      makeService(session!).setStatus(v.id, v.status),
    onSuccess: invalidate,
  });
}

export function useDuplicateAutomation() {
  const session = useSession();
  const invalidate = useInvalidateList();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (id: string) => makeService(session!).duplicate(id),
    onSuccess: invalidate,
  });
}

export function useDeleteAutomation() {
  const session = useSession();
  const invalidate = useInvalidateList();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (id: string) => makeService(session!).remove(id),
    onSuccess: invalidate,
  });
}

export function useGenerateFlow() {
  const session = useSession();
  const invalidate = useInvalidateList();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (description: string) => makeService(session!).generateAndSaveFlow(description),
    onSuccess: invalidate,
  });
}

export function useTestAutomation() {
  const session = useSession();
  const { org } = useOrg();
  const qc = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (v: { id: string; context?: Record<string, unknown> }) =>
      makeService(session!).startRun(v.id, v.context),
    onSuccess: (_data, v) => {
      if (org) qc.invalidateQueries({ queryKey: queryKeys.automacoes.runs(org, v.id) });
    },
  });
}
