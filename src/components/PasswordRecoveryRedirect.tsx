import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/**
 * Když odkaz pro obnovení hesla přistane jinde než na /reset-password (např. na úvodní
 * stránce kvůli nastavení přesměrování v Supabase), přesměruje na formulář nového hesla.
 */
// Zachytit hned při načtení – Supabase po zpracování odkazu hash z adresy smaže.
const landedWithRecovery = typeof window !== "undefined" && /type=recovery/.test(window.location.hash);

export const PasswordRecoveryRedirect = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  useEffect(() => {
    if (landedWithRecovery && window.location.pathname !== "/reset-password") {
      // celý hash zůstává (tokeny), aby ho Supabase mohl zpracovat i na nové adrese
      navigate("/reset-password" + (window.location.hash || "#type=recovery"), { replace: true });
    }
  }, [navigate]);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" && window.location.pathname !== "/reset-password") {
        navigate("/reset-password#type=recovery", { replace: true });
      }
    });
    return () => data.subscription.unsubscribe();
  }, [navigate, pathname]);
  return null;
};
