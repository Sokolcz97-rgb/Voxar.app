import { supabase } from "@/integrations/supabase/client";

/**
 * Hudba alba „Eryon“. Soubory leží v soukromém bucketu `ashes-music`
 * (čtení jen pro hráče) a přehrávají se přes krátkodobé podepsané odkazy.
 */
export type Track = {
  id: string;
  title: string;
  file: string;
  cover: string;
  lyrics: string;
  chapters: number[];
  coverUrl?: string;
};

export type Album = { album: string; artist: string; tracks: Track[] };

const BUCKET = "ashes-music";
const VOLUME_KEY = "ashes.music.volume";
const MUTED_KEY = "ashes.music.muted";

function readNumber(key: string, fallback: number) {
  try {
    const raw = localStorage.getItem(key);
    const value = raw === null ? NaN : Number(raw);
    return Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* úložiště nemusí být dostupné */
  }
}

type Listener = () => void;

class MusicDirector {
  album: Album | null = null;
  current: Track | null = null;
  playing = false;
  volume = readNumber(VOLUME_KEY, 0.55);
  muted = readNumber(MUTED_KEY, 0) === 1;
  private audio: HTMLAudioElement | null = null;
  private urls = new Map<string, string>();
  private listeners = new Set<Listener>();
  private fadeTimer: number | null = null;
  private loading: Promise<Album | null> | null = null;

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    this.listeners.forEach((fn) => fn());
  }

  async loadAlbum(): Promise<Album | null> {
    if (this.album) return this.album;
    if (!this.loading) {
      this.loading = (async () => {
        const { data, error } = await supabase.storage.from(BUCKET).download("album.json");
        if (error || !data) return null;
        const album = JSON.parse(await data.text()) as Album;
        const covers = await supabase.storage.from(BUCKET).createSignedUrls(album.tracks.map((t) => t.cover), 60 * 60 * 6);
        album.tracks.forEach((track, index) => {
          track.coverUrl = covers.data?.[index]?.signedUrl ?? undefined;
        });
        this.album = album;
        this.emit();
        return album;
      })().catch(() => null);
    }
    return this.loading;
  }

  private async urlFor(track: Track) {
    const cached = this.urls.get(track.id);
    if (cached) return cached;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(track.file, 60 * 60 * 6);
    if (error || !data?.signedUrl) throw new Error("Hudbu se nepodařilo načíst.");
    this.urls.set(track.id, data.signedUrl);
    return data.signedUrl;
  }

  trackForChapter(chapter: number) {
    const tracks = this.album?.tracks ?? [];
    return tracks.find((t) => t.chapters.includes(Math.min(chapter, 6))) ?? tracks[0] ?? null;
  }

  /** Spustí skladbu (s plynulým přechodem). Prohlížeč vyžaduje předchozí interakci uživatele. */
  async play(track: Track | null, { restart = false } = {}) {
    if (!track) return;
    if (this.current?.id === track.id && this.audio && !restart) {
      if (this.audio.paused) await this.resume();
      return;
    }
    const url = await this.urlFor(track);
    const previous = this.audio;
    const next = new Audio(url);
    next.loop = true;
    next.preload = "auto";
    next.volume = 0;
    this.audio = next;
    this.current = track;
    try {
      await next.play();
      this.playing = true;
    } catch {
      this.playing = false;
    }
    this.fade(next, previous);
    this.emit();
  }

  private fade(next: HTMLAudioElement, previous: HTMLAudioElement | null) {
    if (this.fadeTimer) window.clearInterval(this.fadeTimer);
    const target = this.muted ? 0 : this.volume;
    let step = 0;
    this.fadeTimer = window.setInterval(() => {
      step += 1;
      const k = Math.min(1, step / 30);
      next.volume = target * k;
      if (previous) previous.volume = Math.max(0, previous.volume * (1 - k));
      if (k >= 1) {
        if (this.fadeTimer) window.clearInterval(this.fadeTimer);
        this.fadeTimer = null;
        previous?.pause();
      }
    }, 50);
  }

  async resume() {
    if (!this.audio) return;
    try {
      await this.audio.play();
      this.playing = true;
    } catch {
      this.playing = false;
    }
    this.emit();
  }

  pause() {
    this.audio?.pause();
    this.playing = false;
    this.emit();
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    write(VOLUME_KEY, String(this.volume));
    if (this.audio && !this.muted) this.audio.volume = this.volume;
    this.emit();
  }

  toggleMute() {
    this.muted = !this.muted;
    write(MUTED_KEY, this.muted ? "1" : "0");
    if (this.audio) this.audio.volume = this.muted ? 0 : this.volume;
    this.emit();
  }

  get position() {
    return this.audio ? { time: this.audio.currentTime, duration: this.audio.duration || 0 } : { time: 0, duration: 0 };
  }

  stop() {
    if (this.fadeTimer) window.clearInterval(this.fadeTimer);
    this.audio?.pause();
    this.audio = null;
    this.current = null;
    this.playing = false;
    this.emit();
  }
}

export const music = new MusicDirector();
