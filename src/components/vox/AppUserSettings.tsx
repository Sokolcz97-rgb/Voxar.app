import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import {
  User as UserIcon, Lock, Mic, Palette, Info, LogOut, X, Bell, Radio, Link2, RefreshCw, MonitorCog,
ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AvatarUpload } from "@/components/AvatarUpload";
import { SocialHandleField } from "@/components/SocialHandleField";
import { MicTester } from "@/components/vox/MicTester";
import { GdprPanel } from "@/components/vox/GdprPanel";

type TabKey = "profile" | "connections" | "account" | "voice" | "appearance" | "notifications" | "app" | "privacy" | "about";

interface Props {
  onClose: () => void;
}

const VOICE_PREF_KEY = "sv.voicePrefs";
type VoicePrefs = {
  inputDeviceId?: string;
  outputDeviceId?: string;
  inputGainDb: number;         // -30..+20 dB
  outputVolume: number;         // 0..200 %
  autoDetect: boolean;          // Automatická detekce hlasu (VAD)
  vadThresholdDb: number;       // -80..-10 dB
  noiseSuppression: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
  pushToTalk: boolean;
};
const defaultVoice: VoicePrefs = {
  inputGainDb: 0, outputVolume: 100,
  autoDetect: true, vadThresholdDb: -50,
  noiseSuppression: true, echoCancellation: true, autoGainControl: true, pushToTalk: false,
};

const APPEARANCE_KEY = "sv.appearance";
type Appearance = { compact: boolean; reduceMotion: boolean };
const defaultAppearance: Appearance = { compact: false, reduceMotion: false };

const NOTIF_KEY = "sv.notifPrefs";
type NotifPrefs = { desktop: boolean; sounds: boolean; mentions: boolean };
const defaultNotif: NotifPrefs = { desktop: true, sounds: true, mentions: true };

export function AppUserSettings({ onClose }: Props) {
  const { user, signOut } = useAuth();
  const [tab, setTab] = useState<TabKey>("profile");

  // Profile
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // Connections
  const [twitch, setTwitch] = useState("");
  const [youtube, setYoutube] = useState("");
  const [kick, setKick] = useState("");
  const [savingConn, setSavingConn] = useState(false);

  // Password
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  // Voice
  const [voice, setVoice] = useState<VoicePrefs>(defaultVoice);
  const [devices, setDevices] = useState<{ inputs: MediaDeviceInfo[]; outputs: MediaDeviceInfo[] }>({ inputs: [], outputs: [] });

  // Appearance
  const [appearance, setAppearance] = useState<Appearance>(defaultAppearance);

  // Notifications
  const [notif, setNotif] = useState<NotifPrefs>(defaultNotif);

  useEffect(() => {
    try { setVoice({ ...defaultVoice, ...JSON.parse(localStorage.getItem(VOICE_PREF_KEY) || "{}") }); } catch {}
    try { setAppearance({ ...defaultAppearance, ...JSON.parse(localStorage.getItem(APPEARANCE_KEY) || "{}") }); } catch {}
    try { setNotif({ ...defaultNotif, ...JSON.parse(localStorage.getItem(NOTIF_KEY) || "{}") }); } catch {}
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles")
      .select("display_name, username, bio, avatar_url, twitch_username, youtube_handle, kick_username")
      .eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        const d: any = data || {};
        setDisplayName(d.display_name ?? "");
        setUsername(d.username ?? "");
        setBio(d.bio ?? "");
        setAvatarUrl(d.avatar_url ?? null);
        setTwitch(d.twitch_username ?? "");
        setYoutube(d.youtube_handle ?? "");
        setKick(d.kick_username ?? "");
      });
  }, [user]);

  useEffect(() => {
    if (tab !== "voice") return;
    (async () => {
      try {
        // Prompt permissions so device labels appear
        try { await navigator.mediaDevices.getUserMedia({ audio: true }); } catch {}
        const all = await navigator.mediaDevices.enumerateDevices();
        setDevices({
          inputs: all.filter(d => d.kind === "audioinput"),
          outputs: all.filter(d => d.kind === "audiooutput"),
        });
      } catch {}
    })();
  }, [tab]);

  const saveVoice = (patch: Partial<VoicePrefs>) => {
    const next = { ...voice, ...patch };
    setVoice(next);
    localStorage.setItem(VOICE_PREF_KEY, JSON.stringify(next));
  };
  const saveAppearance = (patch: Partial<Appearance>) => {
    const next = { ...appearance, ...patch };
    setAppearance(next);
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify(next));
  };
  const saveNotif = (patch: Partial<NotifPrefs>) => {
    const next = { ...notif, ...patch };
    setNotif(next);
    localStorage.setItem(NOTIF_KEY, JSON.stringify(next));
  };

  const saveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    const { error } = await supabase.from("profiles").update({
      display_name: displayName.trim() || null,
      username: username.trim() || null,
      bio: bio.trim() || null,
    } as any).eq("user_id", user.id);
    setSavingProfile(false);
    if (error) toast({ title: "Chyba", description: error.message, variant: "destructive" });
    else toast({ title: "Uloženo", description: "Profil aktualizován." });
  };

  const saveConnections = async () => {
    if (!user) return;
    setSavingConn(true);
    const { error } = await supabase.from("profiles").update({
      twitch_username: twitch.trim() || null,
      youtube_handle: youtube.trim() || null,
      kick_username: kick.trim() || null,
    } as any).eq("user_id", user.id);
    setSavingConn(false);
    if (error) toast({ title: "Chyba", description: error.message, variant: "destructive" });
    else toast({ title: "Uloženo", description: "Propojení aktualizována." });
  };

  const changePassword = async () => {
    if (newPw.length < 8) return toast({ title: "Slabé heslo", description: "Alespoň 8 znaků.", variant: "destructive" });
    if (newPw !== confirmPw) return toast({ title: "Neshodují se", description: "Hesla musí být shodná.", variant: "destructive" });
    setSavingPw(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setSavingPw(false);
    if (error) toast({ title: "Chyba", description: error.message, variant: "destructive" });
    else { toast({ title: "Uloženo", description: "Heslo změněno." }); setNewPw(""); setConfirmPw(""); }
  };

  const tabs: { key: TabKey; label: string; icon: any }[] = [
    { key: "profile", label: "Profil", icon: UserIcon },
    { key: "connections", label: "Propojení", icon: Link2 },
    { key: "account", label: "Účet a heslo", icon: Lock },
    { key: "voice", label: "Hlas a video", icon: Mic },
    { key: "notifications", label: "Notifikace", icon: Bell },
    { key: "appearance", label: "Vzhled", icon: Palette },
    { key: "app", label: "Aplikace", icon: MonitorCog },
    { key: "privacy", label: "Soukromí a GDPR", icon: ShieldCheck },
    { key: "about", label: "O aplikaci", icon: Info },
  ];

  return (
    <div className="hud-settings flex-1 flex bg-transparent overflow-hidden holo-scanline">
      <aside className="w-64 shrink-0 border-r border-primary/15 bg-[hsl(222_35%_5%/0.85)] p-4 overflow-y-auto backdrop-blur-sm">
        <div className="px-2 mb-3">
          <div className="text-[10px] font-display uppercase tracking-[0.28em] text-primary/70 text-glow">
            // Entity
          </div>
          <div className="mt-1 text-sm font-display uppercase tracking-[0.14em] text-foreground truncate">
            Uživatelská nastavení
          </div>
          <div className="mt-2 h-px bg-gradient-to-r from-primary/60 via-primary/20 to-transparent" />
        </div>
        <nav className="space-y-0.5">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded text-[12px] font-display uppercase tracking-[0.16em] transition-colors",
                tab === t.key
                  ? "bg-primary/15 text-foreground border-l-2 border-primary shadow-[inset_0_0_16px_hsl(var(--primary)/0.2)]"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground border-l-2 border-transparent"
              )}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
          <div className="h-px bg-primary/15 my-2" />
          <button
            onClick={() => signOut()}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-[12px] font-display uppercase tracking-[0.16em] text-destructive hover:bg-destructive/10"
          >
            <LogOut className="w-4 h-4" />
            Odhlásit se
          </button>
        </nav>
      </aside>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-8">
          <div className="flex items-center justify-between mb-6 pb-3 border-b border-primary/15">
            <div>
              <div className="text-[10px] font-display uppercase tracking-[0.32em] text-primary/60">
                // Sekce
              </div>
              <h1 className="mt-0.5 text-2xl font-display font-bold uppercase tracking-[0.14em] text-glow">
                {tabs.find(t => t.key === tab)?.label}
              </h1>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} title="Zavřít" className="text-primary/70 hover:text-primary hover:bg-primary/10">
              <X className="w-5 h-5" />
            </Button>
          </div>

          {tab === "profile" && (
            <div className="space-y-5">
              {user && (
                <AvatarUpload
                  userId={user.id}
                  avatarUrl={avatarUrl}
                  fallback={(displayName || username || user?.email || "?").slice(0, 2).toUpperCase()}
                  onChange={setAvatarUrl}
                />
              )}
              <div>
                <Label>Zobrazované jméno</Label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label>Uživatelské jméno</Label>
                <Input value={username} onChange={(e) => setUsername(e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label>Bio</Label>
                <Textarea value={bio} onChange={(e) => setBio(e.target.value)} className="mt-1.5" rows={3} />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={user?.email ?? ""} disabled className="mt-1.5" />
              </div>
              <Button onClick={saveProfile} disabled={savingProfile}>
                {savingProfile ? "Ukládám…" : "Uložit změny"}
              </Button>
            </div>
          )}

          {tab === "connections" && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Radio className="w-4 h-4 text-primary" />
                Propojení streamovacích účtů — použije se v přehledu i pro upozornění na živé vysílání.
              </p>
              <SocialHandleField id="tw" label="Twitch" color="#9146FF" value={twitch} onChange={setTwitch} platform="twitch" />
              <SocialHandleField id="yt" label="YouTube" color="#FF0033" value={youtube} onChange={setYoutube} platform="youtube" />
              <SocialHandleField id="ki" label="Kick" color="#53FC18" value={kick} onChange={setKick} platform="kick" />
              <Button onClick={saveConnections} disabled={savingConn}>
                {savingConn ? "Ukládám…" : "Uložit propojení"}
              </Button>
            </div>
          )}

          {tab === "account" && (
            <div className="space-y-5">
              <div>
                <Label>Nové heslo</Label>
                <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label>Potvrzení hesla</Label>
                <Input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} className="mt-1.5" />
              </div>
              <Button onClick={changePassword} disabled={savingPw || !newPw}>
                {savingPw ? "Ukládám…" : "Změnit heslo"}
              </Button>
            </div>
          )}

          {tab === "voice" && (
            <div className="space-y-5">
              <div>
                <Label>Vstupní zařízení (mikrofon)</Label>
                <select
                  value={voice.inputDeviceId ?? ""}
                  onChange={(e) => saveVoice({ inputDeviceId: e.target.value || undefined })}
                  className="mt-1.5 w-full h-10 rounded-md bg-secondary/50 border border-border/40 px-3 text-sm"
                >
                  <option value="">Výchozí</option>
                  {devices.inputs.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || `Mikrofon (${d.deviceId.slice(0,6)})`}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Výstupní zařízení (reproduktory)</Label>
                <select
                  value={voice.outputDeviceId ?? ""}
                  onChange={(e) => saveVoice({ outputDeviceId: e.target.value || undefined })}
                  className="mt-1.5 w-full h-10 rounded-md bg-secondary/50 border border-border/40 px-3 text-sm"
                >
                  <option value="">Výchozí</option>
                  {devices.outputs.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || `Výstup (${d.deviceId.slice(0,6)})`}</option>
                  ))}
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label>Zesílení vstupu ({voice.inputGainDb > 0 ? "+" : ""}{voice.inputGainDb} dB)</Label>
                  <span className="text-xs text-muted-foreground">-30 dB … +20 dB</span>
                </div>
                <input type="range" min={-30} max={20} step={1} value={voice.inputGainDb}
                  onChange={(e) => saveVoice({ inputGainDb: Number(e.target.value) })}
                  className="w-full mt-2 accent-primary" />
                <p className="text-[11px] text-muted-foreground mt-1">0 dB = původní hlasitost mikrofonu. Kladné hodnoty zesilují, záporné ztlumují.</p>
              </div>
              <div>
                <Label>Hlasitost výstupu ({voice.outputVolume}%)</Label>
                <input type="range" min={0} max={200} value={voice.outputVolume}
                  onChange={(e) => saveVoice({ outputVolume: Number(e.target.value) })}
                  className="w-full mt-2 accent-primary" />
              </div>
              <div className="space-y-3 pt-2 border-t border-border/40">
                <ToggleRow label="Automatická detekce hlasu (VAD)" val={voice.autoDetect} onChange={(v) => saveVoice({ autoDetect: v })} />
                {voice.autoDetect && (
                  <div className="pl-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Práh detekce ({voice.vadThresholdDb} dB)</Label>
                      <span className="text-[11px] text-muted-foreground">tišší než práh = ticho</span>
                    </div>
                    <input type="range" min={-80} max={-10} step={1} value={voice.vadThresholdDb}
                      onChange={(e) => saveVoice({ vadThresholdDb: Number(e.target.value) })}
                      className="w-full mt-2 accent-primary" />
                  </div>
                )}
                <ToggleRow label="Potlačení šumu" val={voice.noiseSuppression} onChange={(v) => saveVoice({ noiseSuppression: v })} />
                <ToggleRow label="Potlačení ozvěny" val={voice.echoCancellation} onChange={(v) => saveVoice({ echoCancellation: v })} />
                <ToggleRow label="Automatické zesílení" val={voice.autoGainControl} onChange={(v) => saveVoice({ autoGainControl: v })} />
                <ToggleRow label="Push-to-talk (držet mluvit)" val={voice.pushToTalk} onChange={(v) => saveVoice({ pushToTalk: v })} />
              </div>
              <MicTester
                deviceId={voice.inputDeviceId}
                noiseSuppression={voice.noiseSuppression}
                echoCancellation={voice.echoCancellation}
                autoGainControl={voice.autoGainControl}
              />
              <p className="text-xs text-muted-foreground">Změny se použijí při dalším připojení do hlasového kanálu.</p>
            </div>
          )}

          {tab === "notifications" && (
            <div className="space-y-3">
              <ToggleRow label="Zobrazovat desktopové notifikace" val={notif.desktop} onChange={(v) => {
                saveNotif({ desktop: v });
                if (v && "Notification" in window && Notification.permission === "default") Notification.requestPermission();
              }} />
              <ToggleRow label="Přehrávat zvuky" val={notif.sounds} onChange={(v) => saveNotif({ sounds: v })} />
              <ToggleRow label="Upozornit na zmínky" val={notif.mentions} onChange={(v) => saveNotif({ mentions: v })} />
            </div>
          )}

          {tab === "appearance" && (
            <div className="space-y-6">
              <div className="space-y-3">
                <ToggleRow label="Kompaktní zobrazení" val={appearance.compact} onChange={(v) => saveAppearance({ compact: v })} />
                <ToggleRow label="Omezit animace" val={appearance.reduceMotion} onChange={(v) => saveAppearance({ reduceMotion: v })} />
              </div>
              <AppearanceInventory avatarUrl={avatarUrl} name={displayName || username} />
              <GuildCosmeticsPanel />
            </div>
          )}

          {tab === "app" && <AppSettingsPanel />}

          {tab === "privacy" && <GdprPanel />}

          {tab === "about" && <AboutPanel userEmail={user?.email ?? ""} />}
        </div>
      </div>
    </div>
  );
}

function ToggleRow({ label, val, onChange }: { label: string; val: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/20">
      <span className="text-sm">{label}</span>
      <Switch checked={val} onCheckedChange={onChange} />
    </div>
  );
}

function AboutPanel({ userEmail }: { userEmail: string }) {
  const desktop = (typeof window !== "undefined" ? (window as any).studioVoxarioDesktop : null) as any;
  const isDesktop = !!desktop?.isDesktop;
  const APP_VERSION_FALLBACK = "0.0.7-alpha";
  const [version, setVersion] = useState<string>(APP_VERSION_FALLBACK);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (isDesktop && typeof desktop.getVersion === "function") {
      desktop.getVersion().then((v: string) => setVersion(v || APP_VERSION_FALLBACK)).catch(() => {});
    }
  }, [isDesktop, desktop]);

  const platformLabel = (() => {
    if (!isDesktop) return "Webová verze (prohlížeč)";
    const p = String(desktop?.platform || "").toLowerCase();
    const arch = desktop?.arch ? ` · ${desktop.arch}` : "";
    if (p === "win32") return `Windows${arch}`;
    if (p === "darwin") return `macOS${arch}`;
    if (p === "linux") return `Linux${arch}`;
    return `${p || "Desktop"}${arch}`;
  })();

  const checkUpdates = async () => {
    if (!isDesktop || typeof desktop.checkForUpdates !== "function") return;
    setChecking(true);
    try { await desktop.checkForUpdates(); } finally { setChecking(false); }
  };

  const row = (label: string, value: React.ReactNode) => (
    <div className="flex justify-between gap-4 py-2 border-b border-border/20">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right">{value}</span>
    </div>
  );

  return (
    <div className="space-y-1 text-sm">
      {row("Aplikace", "StudioVoxario")}
      {row("Verze", version)}
      {row("Kanál", "alpha")}
      {row("Prostředí", platformLabel)}
      {isDesktop && desktop?.electronVersion && row("Electron", desktop.electronVersion)}
      {isDesktop && desktop?.chromeVersion && row("Chromium", desktop.chromeVersion)}
      {row("Přihlášen jako", userEmail || "—")}
      {isDesktop && (
        <div className="pt-4">
          <Button onClick={checkUpdates} disabled={checking} variant="outline" className="gap-2">
            <RefreshCw className={cn("w-4 h-4", checking && "animate-spin")} />
            {checking ? "Kontroluji…" : "Zkontrolovat aktualizace"}
          </Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground pt-3">© StudioVoxario</p>
    </div>
  );
}

type AppPrefs = {
  minimizeToTray: boolean;
  closeToTray: boolean;
  autoStart: boolean;
  notifications: boolean;
  hardwareAcceleration: boolean;
  startMinimized: boolean;
  updateChannel?: "stable" | "beta";
  betaUnlocked?: boolean;
};

function AppSettingsPanel() {
  const desktop = (typeof window !== "undefined" ? (window as any).studioVoxarioDesktop : null) as any;
  const isDesktop = !!desktop?.isDesktop;
  // Support both new (getAppSettings/setAppSettings/quitApp) and legacy (getSettings/setSettings/quit) preload APIs
  const getFn: undefined | (() => Promise<AppPrefs>) =
    desktop?.getAppSettings || desktop?.getSettings;
  const setFn: undefined | ((p: Partial<AppPrefs>) => Promise<any>) =
    desktop?.setAppSettings || desktop?.setSettings;
  const unlockFn: undefined | ((ok: boolean) => Promise<any>) = desktop?.unlockBeta;
  const quitFn: undefined | (() => any) = desktop?.quitApp || desktop?.quit;
  const reloadFn: undefined | (() => any) = desktop?.reloadApp;

  const defaults: AppPrefs = {
    minimizeToTray: true, closeToTray: true, autoStart: false,
    notifications: true, hardwareAcceleration: true, startMinimized: false,
    updateChannel: "stable", betaUnlocked: false,
  };
  const [prefs, setPrefs] = useState<AppPrefs | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isDesktop) return;
    if (typeof getFn !== "function") {
      setError("Tato verze aplikace ještě nepodporuje in-app nastavení. Aktualizuj aplikaci na nejnovější verzi.");
      setPrefs(defaults);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      if (!cancelled) {
        setError((prev) => prev ?? "Načítání trvá déle než obvykle — zobrazuji výchozí hodnoty.");
        setPrefs((prev) => prev ?? defaults);
      }
    }, 3500);
    Promise.resolve()
      .then(() => getFn())
      .then((s: AppPrefs) => { if (!cancelled) setPrefs({ ...defaults, ...(s || {}) }); })
      .catch((e: any) => { if (!cancelled) { setError(String(e?.message || e)); setPrefs(defaults); } })
      .finally(() => window.clearTimeout(t));
    return () => { cancelled = true; window.clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDesktop]);

  const patch = async (p: Partial<AppPrefs>) => {
    if (!prefs) return;
    const next = { ...prefs, ...p };
    setPrefs(next);
    if (typeof setFn !== "function") return;
    setSaving(true);
    try { await setFn(p); } finally { setSaving(false); }
  };

  if (!isDesktop) {
    return (
      <div className="space-y-3">
        <div className="rounded-md border border-border/40 bg-secondary/30 p-4 text-sm">
          <p className="font-medium mb-1">Nastavení desktopové aplikace</p>
          <p className="text-muted-foreground">
            Tato nastavení (tray, autostart, hardwarová akcelerace…) jsou dostupná jen v desktopové
            aplikaci StudioVoxario. Stáhni si ji na <a className="text-primary hover:underline" href="/desktop">/desktop</a>.
          </p>
        </div>
      </div>
    );
  }

  if (!prefs) {
    return <p className="text-sm text-muted-foreground">Načítám nastavení…</p>;
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
          {error}
        </div>
      )}
      <ToggleRow label="Minimalizovat do tray" val={prefs.minimizeToTray} onChange={(v) => patch({ minimizeToTray: v })} />
      <ToggleRow label="Zavřít do tray místo ukončení" val={prefs.closeToTray} onChange={(v) => patch({ closeToTray: v })} />
      <ToggleRow label="Spouštět při startu systému" val={prefs.autoStart} onChange={(v) => patch({ autoStart: v })} />
      <ToggleRow label="Startovat minimalizovaně" val={prefs.startMinimized} onChange={(v) => patch({ startMinimized: v })} />
      <ToggleRow label="Systémové notifikace" val={prefs.notifications} onChange={(v) => patch({ notifications: v })} />
      <ToggleRow label="Hardwarová akcelerace" val={prefs.hardwareAcceleration} onChange={(v) => patch({ hardwareAcceleration: v })} />

      <UpdateChannelRow
        channel={prefs.updateChannel || "stable"}
        unlocked={!!prefs.betaUnlocked}
        onChange={(ch) => patch({ updateChannel: ch })}
        onUnlock={async (code) => {
          const { data, error } = await supabase.rpc("redeem_download_code", { _code: code.trim() });
          if (error || data !== true) {
            toast({ title: "Neplatný kód", description: error?.message || "Kód nebyl uznán.", variant: "destructive" });
            return false;
          }
          if (unlockFn) await unlockFn(true);
          await patch({ betaUnlocked: true, updateChannel: "beta" });
          toast({ title: "Beta odemčena", description: "Budete dostávat předběžné buildy." });
          return true;
        }}
      />

      <p className="text-xs text-muted-foreground pt-2">
        Změny hardwarové akcelerace se projeví po restartu aplikace.
        {saving && " • Ukládám…"}
      </p>
      <div className="flex gap-2 pt-2">
        {reloadFn && <Button variant="outline" onClick={() => reloadFn()}>Restartovat okno</Button>}
        {quitFn && <Button variant="destructive" onClick={() => quitFn()}>Ukončit aplikaci</Button>}
      </div>
    </div>
  );
}

function UpdateChannelRow({
  channel, unlocked, onChange, onUnlock,
}: {
  channel: "stable" | "beta";
  unlocked: boolean;
  onChange: (c: "stable" | "beta") => void;
  onUnlock: (code: string) => Promise<boolean>;
}) {
  const [showCode, setShowCode] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="pt-3 border-t border-border/40 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">Kanál aktualizací</div>
          <div className="text-xs text-muted-foreground">
            Release = stabilní veřejné verze. Beta = předběžné buildy (vyžaduje přístupový kód).
          </div>
        </div>
        <div className="flex rounded-md overflow-hidden border border-border/40">
          <button
            className={cn("px-3 py-1.5 text-xs", channel === "stable" ? "bg-primary/20 text-foreground" : "text-muted-foreground hover:bg-secondary/60")}
            onClick={() => onChange("stable")}
          >
            Release
          </button>
          <button
            className={cn("px-3 py-1.5 text-xs", channel === "beta" ? "bg-primary/20 text-foreground" : "text-muted-foreground hover:bg-secondary/60")}
            onClick={() => {
              if (unlocked) onChange("beta");
              else setShowCode(true);
            }}
          >
            Beta
          </button>
        </div>
      </div>
      {showCode && !unlocked && (
        <div className="flex gap-2 items-center">
          <Input
            placeholder="Zadejte přístupový kód"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="h-8 text-sm"
          />
          <Button
            size="sm"
            disabled={busy || !code.trim()}
            onClick={async () => {
              setBusy(true);
              const ok = await onUnlock(code);
              setBusy(false);
              if (ok) { setShowCode(false); setCode(""); }
            }}
          >
            {busy ? "Ověřuji…" : "Odemknout"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowCode(false)}>Zrušit</Button>
        </div>
      )}
      {unlocked && channel === "beta" && (
        <p className="text-xs text-emerald-400">✓ Beta kanál odemčen — dostáváte předběžné buildy.</p>
      )}
    </div>
  );
}
