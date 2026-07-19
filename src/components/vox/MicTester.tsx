import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  deviceId?: string;
  noiseSuppression?: boolean;
  echoCancellation?: boolean;
  autoGainControl?: boolean;
}

/**
 * Standalone microphone tester: shows a live level meter and can play back
 * captured audio (with a short delay) so the user can hear themselves.
 */
export function MicTester({ deviceId, noiseSuppression = true, echoCancellation = true, autoGainControl = true }: Props) {
  const [active, setActive] = useState(false);
  const [playback, setPlayback] = useState(false);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  const stop = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.srcObject = null;
    }
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setLevel(0);
    setActive(false);
  };

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          noiseSuppression, echoCancellation, autoGainControl,
        },
        video: false,
      });
      streamRef.current = stream;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i] - 128));
        setLevel(peak / 128);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
      setActive(true);
    } catch (e: any) {
      setError(e?.message || "Nepodařilo se otevřít mikrofon");
    }
  };

  const togglePlayback = () => {
    const next = !playback;
    setPlayback(next);
    if (!audioElRef.current) return;
    if (next && streamRef.current) {
      audioElRef.current.srcObject = streamRef.current;
      audioElRef.current.play().catch(() => {});
    } else {
      audioElRef.current.pause();
      audioElRef.current.srcObject = null;
    }
  };

  useEffect(() => () => stop(), []);
  // If device/prefs change while active, restart
  useEffect(() => {
    if (!active) return;
    stop();
    void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, noiseSuppression, echoCancellation, autoGainControl]);

  const pct = Math.min(100, Math.round(level * 180));
  const bars = Array.from({ length: 20 });

  return (
    <div className="rounded-lg border border-border/40 bg-secondary/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Test mikrofonu</div>
        <div className="flex gap-2">
          {active && (
            <Button size="sm" variant="secondary" onClick={togglePlayback} className="gap-1.5">
              {playback ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              {playback ? "Ztlumit poslech" : "Poslech"}
            </Button>
          )}
          <Button size="sm" onClick={active ? stop : start} variant={active ? "destructive" : "default"} className="gap-1.5">
            {active ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            {active ? "Zastavit" : "Spustit test"}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-1 h-6">
        {bars.map((_, i) => {
          const on = active && pct >= (i + 1) * 5;
          return (
            <div
              key={i}
              className={cn(
                "flex-1 h-full rounded-sm transition-colors",
                on
                  ? i < 12 ? "bg-emerald-400" : i < 16 ? "bg-yellow-400" : "bg-destructive"
                  : "bg-background/60"
              )}
            />
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        {active
          ? "Mluvte do mikrofonu – měl by se rozsvítit ukazatel. Pomocí tlačítka Poslech si přehrajete vlastní hlas."
          : "Klikněte na Spustit test a povolte přístup k mikrofonu."}
      </p>

      {error && <p className="text-xs text-destructive">{error}</p>}
      <audio ref={audioElRef} hidden />
    </div>
  );
}
