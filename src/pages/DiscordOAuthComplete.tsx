import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function DiscordOAuthComplete() {
  useEffect(() => {
    const nonce = new URLSearchParams(window.location.search).get("discord_session");
    if (!nonce) {
      window.location.replace("/dashboard/bot/guilds");
      return;
    }

    const payload = { type: "discord-oauth-result", nonce };

    try {
      window.opener?.postMessage(payload, window.location.origin);
    } catch {
      // Ignore opener access errors and use the same-origin fallbacks below.
    }

    try {
      const channel = new BroadcastChannel("discord-oauth");
      channel.postMessage(payload);
      channel.close();
    } catch {
      // BroadcastChannel is only a fallback, so failures are non-fatal.
    }

    try {
      localStorage.setItem("discord-oauth-result", JSON.stringify({ ...payload, at: Date.now() }));
    } catch {
      // Storage may be disabled in some browsers.
    }

    window.setTimeout(() => {
      if (window.opener && !window.opener.closed) {
        window.close();
        return;
      }
      window.location.replace(`/dashboard/bot/guilds?discord_session=${encodeURIComponent(nonce)}`);
    }, 250);
  }, []);

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <div className="text-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        <h1 className="text-2xl font-bold">Discord připojen</h1>
        <p className="text-sm text-muted-foreground">Dokončuji autorizaci…</p>
      </div>
    </main>
  );
}