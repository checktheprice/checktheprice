import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AIReelCreator } from "@/components/admin/AIReelCreator";

export const Route = createFileRoute("/admin-ai-reel")({
  component: AdminAIReelPage,
  head: () => ({
    meta: [
      { title: "AI Reel Creator — CheckThePrice" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function AdminAIReelPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!mounted) return;
      if (!userData.user) {
        navigate({ to: "/auth" });
        return;
      }
      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: userData.user.id,
        _role: "admin",
      });
      if (!mounted) return;
      setAllowed(!!isAdmin);
      setChecking(false);
    })();
    return () => { mounted = false; };
  }, [navigate]);

  if (checking) {
    return <main className="mx-auto max-w-md px-4 py-16 text-center text-sm text-muted-foreground">Checking access…</main>;
  }

  if (!allowed) {
    return <main className="mx-auto max-w-md px-4 py-16 text-center text-sm text-muted-foreground">Access denied.</main>;
  }

  return (
    <main className="mx-auto max-w-md px-4 py-6 pb-24">
      <button
        type="button"
        onClick={() => navigate({ to: "/admin" })}
        className="mb-2 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        ← Back to Admin
      </button>
      <AIReelCreator />
    </main>
  );
}
