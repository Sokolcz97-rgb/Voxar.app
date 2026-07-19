import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useVoxHeartbeat(status: "online" | "idle" | "dnd" | "offline" = "online") {
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    const beat = () => {
      supabase.rpc("vox_heartbeat", { _status: status, _custom: null }).then(() => {});
    };
    beat();
    const t = setInterval(beat, 30_000);
    return () => clearInterval(t);
  }, [user, status]);
}
