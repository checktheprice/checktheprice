// Verifies the caller is a signed-in administrator before any PA API call.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function requireAdmin(request: Request): Promise<{ ok: true } | { ok: false; response: Response }> {
  const header = request.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) {
    return { ok: false, response: json({ error: "Unauthorized" }, 401) };
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    return { ok: false, response: json({ error: "Unauthorized" }, 401) };
  }

  const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
    _user_id: data.user.id,
    _role: "admin",
  });
  if (!isAdmin) {
    return { ok: false, response: json({ error: "Forbidden" }, 403) };
  }

  return { ok: true };
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
