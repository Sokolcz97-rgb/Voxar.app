using System.Collections.Generic;
using UnityEngine;

namespace Voxario.Ashes
{
    /// <summary>
    /// Zvukové efekty generované v kódu (bez souborů): zásah, kritický zásah, blok, úhyb,
    /// mince, nová úroveň, úkol, kliknutí. Hlasitost v Nastavení → Zvuk (audio.sfx).
    /// </summary>
    public static class Sfx
    {
        static AudioSource source;
        static readonly Dictionary<string, AudioClip> clips = new Dictionary<string, AudioClip>();
        const int Rate = 44100;

        public static float Volume
        {
            get => PlayerPrefs.GetFloat("audio.sfx", 0.7f);
            set => PlayerPrefs.SetFloat("audio.sfx", Mathf.Clamp01(value));
        }

        public static void Play(string id, float gain = 1f)
        {
            if (Volume <= 0.001f) return;
            if (source == null)
            {
                var go = new GameObject("Sfx");
                Object.DontDestroyOnLoad(go);
                source = go.AddComponent<AudioSource>();
                source.playOnAwake = false;
                source.spatialBlend = 0;
            }
            if (!clips.TryGetValue(id, out var clip))
            {
                clip = Make(id);
                if (clip == null) return;
                clips[id] = clip;
            }
            source.pitch = 1f + Random.Range(-0.06f, 0.06f);
            source.PlayOneShot(clip, Volume * gain);
        }

        static AudioClip Make(string id)
        {
            switch (id)
            {
                case "hit": return Synth(id, 0.22f, (t, n) => (Noise(n) * 0.7f + Mathf.Sin(t * 2 * Mathf.PI * 110) * 0.5f) * Env(t, 0.004f, 0.18f));
                case "crit": return Synth(id, 0.4f, (t, n) => (Noise(n) * 0.6f + Mathf.Sin(t * 2 * Mathf.PI * (180 - t * 200)) * 0.7f) * Env(t, 0.003f, 0.35f));
                case "block": return Synth(id, 0.3f, (t, n) => (Mathf.Sin(t * 2 * Mathf.PI * 820) * 0.5f + Mathf.Sin(t * 2 * Mathf.PI * 1230) * 0.3f + Noise(n) * 0.2f) * Env(t, 0.002f, 0.26f));
                case "dodge": return Synth(id, 0.25f, (t, n) => Noise(n) * 0.35f * Mathf.Sin(Mathf.PI * t / 0.25f));
                case "coin": return Synth(id, 0.35f, (t, n) => (Mathf.Sin(t * 2 * Mathf.PI * (t < 0.08f ? 1320 : 1760))) * 0.45f * Env(t, 0.002f, 0.3f));
                case "level": return Synth(id, 1.1f, (t, n) => Chord(t, new[] { 523.25f, 659.25f, 783.99f, 1046.5f }, 0.12f) * Env(t, 0.01f, 1.0f));
                case "quest": return Synth(id, 0.7f, (t, n) => Chord(t, new[] { 587.33f, 880f }, 0.15f) * Env(t, 0.01f, 0.6f));
                case "swing": return Synth(id, 0.2f, (t, n) => Noise(n) * 0.4f * Mathf.Sin(Mathf.PI * t / 0.2f) * (1 - t * 2f));
                case "warn": return Synth(id, 0.16f, (t, n) => (Mathf.Sin(t * 2 * Mathf.PI * 660) * 0.35f + Mathf.Sin(t * 2 * Mathf.PI * 990) * 0.2f) * Env(t, 0.003f, 0.14f));
                case "click": return Synth(id, 0.06f, (t, n) => Noise(n) * 0.3f * Env(t, 0.001f, 0.05f));
                case "fall": return Synth(id, 0.5f, (t, n) => (Noise(n) * 0.5f + Mathf.Sin(t * 2 * Mathf.PI * (90 - t * 80)) * 0.6f) * Env(t, 0.01f, 0.45f));
                default: return null;
            }
        }

        static float Env(float t, float attack, float decay) => t < attack ? t / attack : Mathf.Exp(-(t - attack) / (decay * 0.3f));

        static uint seed = 22222;
        static float Noise(int n)
        {
            seed = seed * 1664525u + 1013904223u;
            return ((seed >> 9) / 4194304f) * 2f - 1f;
        }

        static float Chord(float t, float[] notes, float step)
        {
            float v = 0;
            for (int i = 0; i < notes.Length; i++)
            {
                float t0 = i * step;
                if (t < t0) continue;
                float tt = t - t0;
                v += Mathf.Sin(tt * 2 * Mathf.PI * notes[i]) * Mathf.Exp(-tt * 3f) * 0.3f;
            }
            return v;
        }

        static AudioClip Synth(string name, float seconds, System.Func<float, int, float> f)
        {
            int n = Mathf.CeilToInt(seconds * Rate);
            var data = new float[n];
            for (int i = 0; i < n; i++) data[i] = Mathf.Clamp(f(i / (float)Rate, i), -1f, 1f);
            var clip = AudioClip.Create("sfx_" + name, n, 1, Rate, false);
            clip.SetData(data, 0);
            return clip;
        }
    }
}
