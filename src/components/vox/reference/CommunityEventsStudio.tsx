import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  Edit3,
  Eye,
  EyeOff,
  Gamepad2,
  Loader2,
  MapPin,
  Mic,
  MonitorUp,
  Plus,
  Radio,
  Settings2,
  Square,
  Trash2,
  Twitch,
  UsersRound,
  Youtube,
  Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { useCommunityEvents, type VoxCommunityEvent, type VoxEventRsvpStatus } from "@/hooks/useCommunityEvents";
import {
  BROADCAST_DEFAULTS,
  buildRtmpUrl,
  loadBroadcastSettings,
  saveBroadcastSettings,
  type BroadcastDestination,
  type BroadcastPlatform,
  type BroadcastSettings,
} from "@/lib/broadcastConfig";

const PLATFORM_META: Record<BroadcastPlatform, { icon: any; handle: "twitch_username" | "youtube_handle" | "kick_username"; accent: string }> = {
  twitch: { icon: Twitch, handle: "twitch_username", accent: "#9d7bff" },
  youtube: { icon: Youtube, handle: "youtube_handle", accent: "#ff6374" },
  kick: { icon: Zap, handle: "kick_username", accent: "#8dff64" },
};

type CaptureSource = { id: string; name: string; type?: string; thumbnail?: string | null; appIcon?: string | null };
type ProfileLinks = { twitch_username?: string | null; youtube_handle?: string | null; kick_username?: string | null };
type Props = {
  guildId?: string | null;
  isAdmin?: boolean;
  onOpenChannel?: (channelId: string) => void;
};

type EventForm = {
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  location: string;
  channelId: string;
  capacity: string;
};

const emptyForm = (): EventForm => {
  const start = new Date(Date.now() + 60 * 60 * 1000);
  start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15, 0, 0);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const local = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  return { title: "", description: "", startsAt: local(start), endsAt: local(end), location: "", channelId: "", capacity: "" };
};

function maskKey(value: string) {
  if (!value) return "nenastaven";
  if (value.length < 8) return "••••••••";
  return `${value.slice(0, 3)}••••••••${value.slice(-3)}`;
}

function eventDate(value: string) {
  return new Date(value).toLocaleString("cs-CZ", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function eventTimeLabel(event: VoxCommunityEvent) {
  const start = new Date(event.starts_at);
  const now = new Date();
  const sameDay = start.toDateString() === now.toDateString();
  return `${sameDay ? "DNES" : start.toLocaleDateString("cs-CZ", { weekday: "short", day: "numeric", month: "short" }).toUpperCase()} · ${start.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}`;
}

function makeCombinedStream(videoStream: MediaStream, micStream: MediaStream | null) {
  const videoTracks = videoStream.getVideoTracks();
  const audioTracks = [...videoStream.getAudioTracks(), ...(micStream?.getAudioTracks() ?? [])];
  if (audioTracks.length <= 1) return new MediaStream([...videoTracks, ...audioTracks]);

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const context = new AudioCtx();
    const destination = context.createMediaStreamDestination();
    for (const stream of [videoStream, micStream].filter(Boolean) as MediaStream[]) {
      if (stream.getAudioTracks().length) context.createMediaStreamSource(stream).connect(destination);
    }
    const combined = new MediaStream([...videoTracks, ...destination.stream.getAudioTracks()]);
    (combined as any).__voxAudioContext = context;
    return combined;
  } catch {
    return new MediaStream([...videoTracks, audioTracks[0]]);
  }
}

async function captureSelectedSource(sourceId: string | null, withSystemAudio: boolean) {
  if (sourceId) {
    const mandatory: Record<string, any> = {
      chromeMediaSource: "desktop",
      chromeMediaSourceId: sourceId,
      maxFrameRate: 60,
    };
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: withSystemAudio ? ({ mandatory: { chromeMediaSource: "desktop" } } as any) : false,
        video: ({ mandatory } as any),
      });
    } catch {
      return navigator.mediaDevices.getUserMedia({ audio: false, video: ({ mandatory } as any) });
    }
  }

  return navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: { ideal: 30, max: 60 } },
    audio: withSystemAudio,
  });
}

export function CommunityEventsStudio({ guildId, isAdmin = false, onOpenChannel }: Props) {
  const { user } = useAuth();
  const [tab, setTab] = useState<"events" | "broadcast">("events");
  const [settings, setSettings] = useState<BroadcastSettings>(BROADCAST_DEFAULTS);
  const [links, setLinks] = useState<ProfileLinks>({});
  const [sources, setSources] = useState<CaptureSource[]>([]);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [loadingSources, setLoadingSources] = useState(false);
  const [starting, setStarting] = useState(false);
  const [live, setLive] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [nativeReady, setNativeReady] = useState(false);
  const [lastLog, setLastLog] = useState("");
  const [channels, setChannels] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingEvent, setSavingEvent] = useState(false);
  const [form, setForm] = useState<EventForm>(() => emptyForm());
  const recorderRef = useRef<MediaRecorder | null>(null);
  const captureRef = useRef<MediaStream | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number | null>(null);

  const {
    activeEvents,
    loading: eventsLoading,
    error: eventsError,
    createEvent,
    updateEvent,
    deleteEvent,
    setRsvp,
  } = useCommunityEvents(guildId);

  const desktop = (window as any).studioVoxarioDesktop;

  useEffect(() => {
    void loadBroadcastSettings().then(setSettings);
    if (user) {
      void supabase
        .from("profiles")
        .select("twitch_username,youtube_handle,kick_username")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }) => setLinks((data as ProfileLinks) || {}));
    }
    if (desktop?.broadcastAvailable) {
      void desktop.broadcastAvailable().then((result: any) => setNativeReady(!!result?.available));
    }
    const offState = desktop?.onBroadcastState?.((state: any) => setLive(!!state?.active));
    const offLog = desktop?.onBroadcastLog?.((entry: any) => {
      const text = String(entry?.text || "").trim();
      if (text) setLastLog(text.split("\n").at(-1) || text);
    });
    return () => { offState?.(); offLog?.(); };
  }, [user]);

  useEffect(() => {
    if (!guildId) { setChannels([]); return; }
    void supabase
      .from("vox_channels")
      .select("id,name,type")
      .eq("guild_id", guildId)
      .order("position")
      .then(({ data }) => setChannels((data ?? []) as any[]));
  }, [guildId]);

  useEffect(() => {
    if (!live) { setElapsed(0); return; }
    if (!startedAtRef.current) startedAtRef.current = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.max(0, Math.floor((Date.now() - (startedAtRef.current || Date.now())) / 1000))), 1000);
    return () => window.clearInterval(timer);
  }, [live]);

  const selected = useMemo(
    () => settings.destinations.filter((destination) => destination.enabled && !!buildRtmpUrl(destination)),
    [settings],
  );

  const updateDestination = (platform: BroadcastPlatform, patch: Partial<BroadcastDestination>) => {
    setSettings((current) => ({
      ...current,
      destinations: current.destinations.map((destination) => destination.platform === platform ? { ...destination, ...patch } : destination),
    }));
  };

  const persist = async () => {
    const saved = await saveBroadcastSettings(settings);
    setSettings(saved);
    toast({ title: "Vysílací nastavení uloženo", description: "RTMP údaje zůstávají lokálně v tomto zařízení." });
  };

  const refreshSources = async () => {
    setLoadingSources(true);
    try {
      if (desktop?.getCaptureSources) {
        const list = await desktop.getCaptureSources();
        setSources(Array.isArray(list) ? list : []);
        if (!sourceId && list?.[0]?.id) setSourceId(list[0].id);
      } else {
        setSources([]);
      }
    } finally {
      setLoadingSources(false);
    }
  };

  const stop = async () => {
    try { recorderRef.current?.stop(); } catch {}
    recorderRef.current = null;
    for (const stream of [captureRef.current, micRef.current]) {
      stream?.getTracks().forEach((track) => track.stop());
    }
    const context = (captureRef.current as any)?.__voxAudioContext;
    try { await context?.close?.(); } catch {}
    captureRef.current = null;
    micRef.current = null;
    startedAtRef.current = null;
    if (desktop?.broadcastStop) await desktop.broadcastStop();
    setLive(false);
    toast({ title: "Vysílání ukončeno" });
  };

  const start = async () => {
    if (!desktop?.broadcastStart || !desktop?.broadcastWriteChunk) {
      toast({ title: "RTMP je dostupné v desktop aplikaci", description: "Webová verze nemůže přímo odesílat RTMP stream.", variant: "destructive" });
      return;
    }
    if (!nativeReady) {
      toast({ title: "FFmpeg není dostupný", description: "Aktualizuj desktop klienta na build s RTMP modulem.", variant: "destructive" });
      return;
    }
    if (!selected.length) {
      toast({ title: "Vyber RTMP cíl", description: "Zapni alespoň jednu platformu a nastav server i stream key.", variant: "destructive" });
      return;
    }

    setStarting(true);
    try {
      if (sourceId && desktop.selectCaptureSource) await desktop.selectCaptureSource(sourceId);
      const display = await captureSelectedSource(sourceId, settings.includeSystemAudio);
      const mic = settings.includeMic
        ? await navigator.mediaDevices.getUserMedia({ audio: true, video: false }).catch(() => null)
        : null;
      const combined = makeCombinedStream(display, mic);
      captureRef.current = combined;
      micRef.current = mic;

      const result = await desktop.broadcastStart({
        destinations: selected.map((destination) => ({ platform: destination.platform, url: buildRtmpUrl(destination) })),
        videoBitrate: settings.videoBitrate,
        fps: settings.fps,
      });
      if (!result?.ok) throw new Error(result?.error || "RTMP službu se nepodařilo spustit.");

      const candidates = ["video/webm;codecs=vp8,opus", "video/webm;codecs=vp9,opus", "video/webm"];
      const mimeType = candidates.find((mime) => MediaRecorder.isTypeSupported(mime)) || "";
      const recorder = new MediaRecorder(combined, mimeType ? { mimeType, videoBitsPerSecond: settings.videoBitrate * 1000 } : undefined);
      recorder.ondataavailable = async (event) => {
        if (!event.data?.size) return;
        const chunk = await event.data.arrayBuffer();
        desktop.broadcastWriteChunk(chunk);
      };
      recorder.onerror = () => void stop();
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      recorder.start(500);
      setLive(true);
      toast({ title: "RTMP vysílání spuštěno", description: `Cíle: ${selected.map((item) => item.label).join(", ")}` });
    } catch (error) {
      await desktop?.broadcastStop?.().catch?.(() => undefined);
      captureRef.current?.getTracks().forEach((track) => track.stop());
      micRef.current?.getTracks().forEach((track) => track.stop());
      captureRef.current = null;
      micRef.current = null;
      toast({ title: "Vysílání se nepodařilo spustit", description: (error as Error).message, variant: "destructive" });
    } finally {
      setStarting(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setEditorOpen(true);
  };

  const openEdit = (event: VoxCommunityEvent) => {
    const local = (value: string | null) => value ? new Date(new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : "";
    setEditingId(event.id);
    setForm({
      title: event.title,
      description: event.description || "",
      startsAt: local(event.starts_at),
      endsAt: local(event.ends_at),
      location: event.location || "",
      channelId: event.channel_id || "",
      capacity: event.capacity ? String(event.capacity) : "",
    });
    setEditorOpen(true);
  };

  const saveEvent = async () => {
    if (!form.title.trim() || !form.startsAt) {
      toast({ title: "Doplň název a začátek události", variant: "destructive" });
      return;
    }
    setSavingEvent(true);
    try {
      const payload = {
        title: form.title,
        description: form.description || null,
        starts_at: new Date(form.startsAt).toISOString(),
        ends_at: form.endsAt ? new Date(form.endsAt).toISOString() : null,
        location: form.location || null,
        channel_id: form.channelId || null,
        capacity: form.capacity ? Math.max(1, Number(form.capacity)) : null,
      };
      if (editingId) await updateEvent(editingId, payload);
      else await createEvent(payload);
      toast({ title: editingId ? "Událost upravena" : "Událost vytvořena" });
      setEditorOpen(false);
      setEditingId(null);
    } catch (error) {
      toast({ title: "Událost se nepodařilo uložit", description: (error as Error).message, variant: "destructive" });
    } finally {
      setSavingEvent(false);
    }
  };

  const removeEvent = async (event: VoxCommunityEvent) => {
    if (!confirm(`Smazat událost „${event.title}“?`)) return;
    try {
      await deleteEvent(event.id);
      toast({ title: "Událost odstraněna" });
    } catch (error) {
      toast({ title: "Událost se nepodařilo odstranit", description: (error as Error).message, variant: "destructive" });
    }
  };

  const rsvp = async (event: VoxCommunityEvent, status: VoxEventRsvpStatus) => {
    try {
      await setRsvp(event.id, event.myRsvp === status ? null : status);
    } catch (error) {
      toast({ title: "Účast se nepodařilo uložit", description: (error as Error).message, variant: "destructive" });
    }
  };

  const time = `${String(Math.floor(elapsed / 3600)).padStart(2, "0")}:${String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;
  const hero = activeEvents[0] ?? null;

  const rsvpButtons = (event: VoxCommunityEvent) => (
    <div className="sv-event-rsvp">
      <button className={event.myRsvp === "going" ? "active" : ""} onClick={() => void rsvp(event, "going")}><Check /> Jdu <b>{event.rsvp.going}</b></button>
      <button className={event.myRsvp === "interested" ? "active" : ""} onClick={() => void rsvp(event, "interested")}><UsersRound /> Zajímá mě <b>{event.rsvp.interested}</b></button>
    </div>
  );

  return (
    <div className="sv-feature-page sv-events-studio sv-events-studio-v26">
      <div className="sv-feature-heading">
        <div><span>STUDIOVOXARIO</span><h2>Události & vysílání</h2><p>Komunitní program, potvrzení účasti a RTMP studio přímo ve Voxar.app.</p></div>
        <div className="sv-event-heading-actions">
          {tab === "events" && isAdmin && guildId && <button className="sv-hud-button" onClick={openCreate}><Plus /> Nová událost</button>}
          <div className={`sv-live-chip${live ? " is-live" : ""}`}><i />{live ? `LIVE ${time}` : "OFFLINE"}</div>
        </div>
      </div>

      <div className="sv-feature-tabs">
        <button className={tab === "events" ? "active" : ""} onClick={() => setTab("events")}><CalendarDays />Události</button>
        <button className={tab === "broadcast" ? "active" : ""} onClick={() => setTab("broadcast")}><Radio />Vysílací studio</button>
      </div>

      {tab === "events" ? (
        !guildId ? (
          <div className="sv-feature-empty"><CalendarDays /><strong>Vyber komunitu</strong><span>Události jsou navázané na konkrétní komunitu.</span></div>
        ) : eventsLoading ? (
          <div className="sv-feature-loading"><Loader2 className="animate-spin" /> Načítám komunitní události…</div>
        ) : eventsError ? (
          <div className="sv-feature-empty"><CalendarDays /><strong>Databáze událostí zatím není dostupná</strong><span>{eventsError}</span></div>
        ) : (
          <>
            {editorOpen && (
              <section className="sv-event-editor">
                <div className="sv-event-editor-head"><div><small>EVENT CONTROL</small><h3>{editingId ? "Upravit událost" : "Nová komunitní událost"}</h3></div><button onClick={() => setEditorOpen(false)}>Zavřít</button></div>
                <div className="sv-event-form-grid">
                  <label className="wide">Název<input value={form.title} maxLength={120} onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))} placeholder="Např. Páteční herní večer" /></label>
                  <label>Začátek<input type="datetime-local" value={form.startsAt} onChange={(e) => setForm((current) => ({ ...current, startsAt: e.target.value }))} /></label>
                  <label>Konec<input type="datetime-local" value={form.endsAt} onChange={(e) => setForm((current) => ({ ...current, endsAt: e.target.value }))} /></label>
                  <label>Místo / popis místa<input value={form.location} onChange={(e) => setForm((current) => ({ ...current, location: e.target.value }))} placeholder="Voxar.app / Discord / server" /></label>
                  <label>Kanál<select value={form.channelId} onChange={(e) => setForm((current) => ({ ...current, channelId: e.target.value }))}><option value="">Bez konkrétního kanálu</option>{channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.type === "voice" ? "🔊" : "#"} {channel.name}</option>)}</select></label>
                  <label>Kapacita<input type="number" min="1" value={form.capacity} onChange={(e) => setForm((current) => ({ ...current, capacity: e.target.value }))} placeholder="Bez limitu" /></label>
                  <label className="wide">Popis<textarea value={form.description} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} rows={3} placeholder="Co se bude dít, co si připravit, pro koho je akce…" /></label>
                </div>
                <div className="sv-event-editor-actions"><button className="sv-hud-button secondary" onClick={() => setEditorOpen(false)}>Zrušit</button><button className="sv-hud-button" disabled={savingEvent} onClick={() => void saveEvent()}>{savingEvent ? <Loader2 className="animate-spin" /> : <Check />} {editingId ? "Uložit změny" : "Vytvořit událost"}</button></div>
              </section>
            )}

            {hero ? (
              <div className="sv-events-grid sv-events-grid-v26">
                <article className="sv-event-hero-card sv-event-live-card">
                  <div className="sv-event-hero-art" style={hero.cover_url ? { backgroundImage: `linear-gradient(rgba(2,13,25,.4),rgba(2,13,25,.82)),url(${hero.cover_url})` } : undefined}><span>LIVE COMMUNITY</span><Gamepad2 /></div>
                  <div className="sv-event-hero-copy">
                    <small>{eventTimeLabel(hero)}</small>
                    <h3>{hero.title}</h3>
                    <p>{hero.description || "Komunitní událost ve Voxar.app."}</p>
                    <div className="sv-event-meta-row"><span><Clock3 />{eventDate(hero.starts_at)}</span>{hero.location && <span><MapPin />{hero.location}</span>}<span><UsersRound />{hero.rsvp.going} potvrzeno{hero.capacity ? ` / ${hero.capacity}` : ""}</span></div>
                    {rsvpButtons(hero)}
                    <div className="sv-event-actions-row">
                      {hero.channel_id && onOpenChannel && <button onClick={() => onOpenChannel(hero.channel_id!)}>Otevřít kanál</button>}
                      <button onClick={() => setTab("broadcast")}>Otevřít vysílací studio</button>
                      {isAdmin && <button className="icon" onClick={() => openEdit(hero)} title="Upravit"><Edit3 /></button>}
                      {isAdmin && <button className="icon danger" onClick={() => void removeEvent(hero)} title="Smazat"><Trash2 /></button>}
                    </div>
                  </div>
                </article>

                {activeEvents.slice(1).map((event) => (
                  <article className="sv-event-card sv-event-card-v26" key={event.id}>
                    <CalendarDays />
                    <div className="sv-event-card-copy"><small>{eventTimeLabel(event)}</small><h3>{event.title}</h3><p>{event.description || event.location || "Komunitní událost"}</p><div className="sv-event-compact-meta"><span>{event.rsvp.going} jde</span>{event.location && <span>{event.location}</span>}</div>{rsvpButtons(event)}</div>
                    {isAdmin && <div className="sv-event-card-admin"><button onClick={() => openEdit(event)}><Edit3 /></button><button className="danger" onClick={() => void removeEvent(event)}><Trash2 /></button></div>}
                  </article>
                ))}
              </div>
            ) : (
              <div className="sv-feature-empty"><CalendarDays /><strong>Žádná naplánovaná událost</strong><span>{isAdmin ? "Vytvoř první komunitní událost tlačítkem nahoře." : "Až správci něco naplánují, objeví se to tady."}</span>{isAdmin && <button className="sv-hud-button" onClick={openCreate}><Plus /> Vytvořit událost</button>}</div>
            )}
          </>
        )
      ) : (
        <div className="sv-broadcast-layout">
          <section className="sv-broadcast-main">
            <div className="sv-studio-block">
              <div className="sv-studio-title"><MonitorUp /><div><h3>Zdroj obrazu</h3><p>Vyber monitor nebo okno, které chceš vysílat.</p></div><button onClick={refreshSources} disabled={loadingSources}>{loadingSources ? <Loader2 className="animate-spin" /> : "Načíst zdroje"}</button></div>
              {sources.length > 0 ? (
                <div className="sv-source-grid">
                  {sources.slice(0, 8).map((source) => (
                    <button key={source.id} className={sourceId === source.id ? "active" : ""} onClick={() => setSourceId(source.id)}>
                      {source.thumbnail ? <img src={source.thumbnail} alt="" /> : <MonitorUp />}
                      <span>{source.name}</span>
                    </button>
                  ))}
                </div>
              ) : <div className="sv-studio-empty">{desktop?.isDesktop ? "Načti seznam monitorů a oken." : "Ve webové verzi se systémový výběr otevře při spuštění náhledu; RTMP publikování vyžaduje desktop klienta."}</div>}
            </div>

            <div className="sv-studio-block">
              <div className="sv-studio-title"><Radio /><div><h3>RTMP cíle</h3><p>Profily jsou převzaté z Nastavení → Propojení. Server a klíč se ukládají jen lokálně.</p></div><button onClick={persist}><Settings2 />Uložit</button></div>
              <div className="sv-destination-list">
                {settings.destinations.map((destination) => {
                  const meta = PLATFORM_META[destination.platform];
                  const Icon = meta.icon;
                  const handle = links[meta.handle];
                  return (
                    <div key={destination.platform} className={`sv-destination${destination.enabled ? " enabled" : ""}`} style={{ ["--platform-accent" as any]: meta.accent }}>
                      <button className="sv-destination-toggle" onClick={() => updateDestination(destination.platform, { enabled: !destination.enabled })}><span>{destination.enabled ? <CheckCircle2 /> : <i />}</span><Icon /></button>
                      <div className="sv-destination-copy"><strong>{destination.label}</strong><small>{handle ? `Propojeno: ${handle}` : "Profil zatím není propojen v Nastavení → Propojení"}</small></div>
                      <label><span>RTMP server</span><input value={destination.server} onChange={(event) => updateDestination(destination.platform, { server: event.target.value })} placeholder="rtmp://…" /></label>
                      <label><span>Stream key</span><div className="sv-secret-input"><input type={showKeys[destination.platform] ? "text" : "password"} value={destination.streamKey} onChange={(event) => updateDestination(destination.platform, { streamKey: event.target.value })} placeholder="Vlož stream key" /><button onClick={() => setShowKeys((current) => ({ ...current, [destination.platform]: !current[destination.platform] }))}>{showKeys[destination.platform] ? <EyeOff /> : <Eye />}</button><button onClick={() => navigator.clipboard?.writeText(destination.streamKey)} title="Kopírovat"><Copy /></button></div><em>{maskKey(destination.streamKey)}</em></label>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <aside className="sv-broadcast-side">
            <div className="sv-broadcast-meter"><span>VYSÍLACÍ STAV</span><strong>{live ? "LIVE" : "PŘIPRAVENO"}</strong><i className={live ? "active" : ""} /></div>
            <label>Video bitrate<strong>{settings.videoBitrate} kb/s</strong><input type="range" min="2500" max="12000" step="500" value={settings.videoBitrate} onChange={(event) => setSettings((current) => ({ ...current, videoBitrate: Number(event.target.value) }))} /></label>
            <label>FPS<select value={settings.fps} onChange={(event) => setSettings((current) => ({ ...current, fps: Number(event.target.value) }))}><option value={30}>30 FPS</option><option value={60}>60 FPS</option></select></label>
            <button className={`sv-audio-option${settings.includeMic ? " active" : ""}`} onClick={() => setSettings((current) => ({ ...current, includeMic: !current.includeMic }))}><Mic />Mikrofon<span>{settings.includeMic ? "ON" : "OFF"}</span></button>
            <button className={`sv-audio-option${settings.includeSystemAudio ? " active" : ""}`} onClick={() => setSettings((current) => ({ ...current, includeSystemAudio: !current.includeSystemAudio }))}><VolumeBadge />Zvuk systému<span>{settings.includeSystemAudio ? "ON" : "OFF"}</span></button>
            <div className="sv-selected-targets"><span>AKTIVNÍ CÍLE</span>{selected.length ? selected.map((item) => <b key={item.platform}>{item.label}</b>) : <small>Žádný kompletní RTMP cíl.</small>}</div>
            {lastLog && <div className="sv-broadcast-log">{lastLog}</div>}
            {live ? <button className="sv-broadcast-stop" onClick={stop}><Square />Ukončit vysílání</button> : <button className="sv-broadcast-start" disabled={starting || !selected.length} onClick={start}>{starting ? <Loader2 className="animate-spin" /> : <Radio />}Spustit RTMP</button>}
            <p className="sv-broadcast-note">Desktop Voxar.app používá lokálně přibalený FFmpeg. Stream keys se neposílají do Supabase.</p>
          </aside>
        </div>
      )}
    </div>
  );
}

function VolumeBadge() {
  return <span className="sv-volume-glyph" aria-hidden="true">)))</span>;
}
