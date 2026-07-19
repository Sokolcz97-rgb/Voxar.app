import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Cached set of "module:action" strings for the current user
let cachedUid: string | null = null;
let cachedSet: Set<string> | null = null;
let cachedPromise: Promise<Set<string>> | null = null;

async function loadPermissions(_uid: string): Promise<Set<string>> {
  const { data, error } = await supabase.rpc("get_my_permissions");
  const set = new Set<string>();
  if (error || !data) return set;
  (data as Array<{ module: string; action: string }>).forEach((row) => {
    if (row?.module && row?.action) set.add(`${row.module}:${row.action}`);
  });
  return set;
}


export function usePermissions() {
  const { user } = useAuth();
  const [perms, setPerms] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setPerms(new Set());
      setLoading(false);
      cachedUid = null;
      cachedSet = null;
      return;
    }
    setLoading(true);
    if (cachedUid === user.id && cachedSet) {
      setPerms(cachedSet);
      setLoading(false);
      return;
    }
    if (cachedUid === user.id && cachedPromise) {
      const s = await cachedPromise;
      setPerms(s);
      setLoading(false);
      return;
    }
    cachedUid = user.id;
    cachedPromise = loadPermissions(user.id);
    const s = await cachedPromise;
    cachedSet = s;
    cachedPromise = null;
    setPerms(s);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const can = useCallback(
    (module: string, action: string) => perms.has(`${module}:${action}`),
    [perms]
  );

  return { can, perms, loading, refresh };
}

export function clearPermissionsCache() {
  cachedUid = null;
  cachedSet = null;
  cachedPromise = null;
}
