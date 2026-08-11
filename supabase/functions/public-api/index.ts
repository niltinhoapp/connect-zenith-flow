// Edge Function: public-api
// Gateway inicial da API Pública. Autentica `cw_live_*` via hash no banco,
// aplica escopos + cota e deriva a organização exclusivamente da chave.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });

function bearer(req: Request) {
  const value = req.headers.get("authorization") ?? "";
  return value.toLowerCase().startsWith("bearer ") ? value.slice(7).trim() : "";
}

Deno.serve(async (req) => {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*\/public-api/, "") || "/";
  const secret = bearer(req);
  if (!secret.startsWith("cw_live_")) return json({ error: "unauthorized", requestId }, 401);

  const { data: auth, error: authError } = await admin.rpc("verify_api_key", {
    p_key: secret,
    p_method: req.method,
    p_path: path,
    p_request_id: requestId,
  });
  if (authError) {
    console.error("[public-api] verify", authError);
    return json({ error: "authentication_failed", requestId }, 500);
  }
  if (!auth?.valid) {
    return json(
      { error: auth?.reason === "quota" ? "rate_limit_exceeded" : "unauthorized", requestId },
      auth?.reason === "quota" ? 429 : 401,
    );
  }

  const organizationId = String(auth.organization_id);
  const scopes = Array.isArray(auth.scopes) ? auth.scopes.map(String) : [];
  const requireScope = (scope: string) => scopes.includes(scope);

  try {
    if (path === "/customers" && req.method === "GET") {
      if (!requireScope("customers:read"))
        return json({ error: "insufficient_scope", required: "customers:read", requestId }, 403);
      const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 25)));
      const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
      const { data, error, count } = await admin
        .from("customers")
        .select(
          "id, code, type, first_name, last_name, company_name, email, phone, mobile, status, tags, created_at, updated_at",
          { count: "exact" },
        )
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) throw error;
      return json({ data, pagination: { limit, offset, total: count ?? 0 }, requestId });
    }

    if (path === "/customers" && req.method === "POST") {
      if (!requireScope("customers:write"))
        return json({ error: "insufficient_scope", required: "customers:write", requestId }, 403);
      const body = await req.json().catch(() => null);
      if (!body || typeof body !== "object" || Array.isArray(body))
        return json({ error: "invalid_json", requestId }, 400);
      const type = body.type === "company" ? "company" : "person";
      if (
        type === "person" &&
        (typeof body.first_name !== "string" || body.first_name.trim().length < 2)
      )
        return json({ error: "first_name_required", requestId }, 422);
      if (
        type === "company" &&
        (typeof body.company_name !== "string" || body.company_name.trim().length < 2)
      )
        return json({ error: "company_name_required", requestId }, 422);
      const clean = {
        organization_id: organizationId,
        type,
        first_name:
          typeof body.first_name === "string" ? body.first_name.trim().slice(0, 120) : null,
        last_name: typeof body.last_name === "string" ? body.last_name.trim().slice(0, 120) : null,
        company_name:
          typeof body.company_name === "string" ? body.company_name.trim().slice(0, 160) : null,
        email: typeof body.email === "string" ? body.email.trim().slice(0, 254) : null,
        phone: typeof body.phone === "string" ? body.phone.trim().slice(0, 40) : null,
        mobile: typeof body.mobile === "string" ? body.mobile.trim().slice(0, 40) : null,
        source: "public_api",
        tags: Array.isArray(body.tags)
          ? body.tags
              .filter((tag: unknown) => typeof tag === "string")
              .slice(0, 20)
              .map((tag: string) => tag.slice(0, 50))
          : [],
      };
      const { data, error } = await admin
        .from("customers")
        .insert(clean)
        .select(
          "id, code, type, first_name, last_name, company_name, email, phone, mobile, status, tags, created_at, updated_at",
        )
        .single();
      if (error) throw error;
      return json({ data, requestId }, 201);
    }

    if (path === "/health" && req.method === "GET") return json({ ok: true, requestId });
    return json({ error: "not_found", requestId }, 404);
  } catch (error) {
    console.error("[public-api]", requestId, error);
    return json({ error: "internal_error", requestId }, 500);
  }
});
