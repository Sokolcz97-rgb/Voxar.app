import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Cached set of "module:action" strings for the current user
let cachedUid: string | null = null;
let cachedSet: Set<string> | null = null;
let cachedPromise: Promise<Set<string>> | null = null;

async function loadPermissions(uid: string): Promise<Set<string>> {
  // user_roles -> role_permissions -> permissions
  // Two queries to avoid complex select; small data.
  const { data: ur } = await supabase
    .from("user_roles")
    .select("role_id, role")
    .eq("user_id", uid);

  const roleIds = new Set<string>();
  const slugs = new Set<string>();
  (ur ?? []).forEach((r: any) => {
    if (r.role_id) roleIds.add(r.role_id);
    if (r.role) slugs.add(r.role);
  });

  // Resolve slug-only rows to role_ids (legacy)
  if (slugs.size) {
    const { data: rs } = await supabase
      .from("roles")
      .select("id, slug")
      .in("slug", Array.from(slugs));
    (rs ?? []).forEach((r: any) => roleIds.add(r.id));
  }

  if (!roleIds.size) return new Set();

  const { data: rp } = await supabase
    .from("role_permissions")
    .select("permissions(module, action)")
    .in("role_id", Array.from(roleIds));

  const set = new Set<string>();
  (rp ?? []).forEach((row: any) => {
    if (row.permissions) set.add(`${row.permissions.module}:${row.permissions.action}`);
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
