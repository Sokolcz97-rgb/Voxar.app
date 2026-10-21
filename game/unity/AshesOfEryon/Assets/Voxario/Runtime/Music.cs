using System;
using System.Collections;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;

namespace Voxario.Ashes
{
    /// <summary>
    /// Hudba alba „Eryon“ ze soukromého bucketu ashes-music (stejně jako web):
    /// album.json → skladba podle kapitoly → podepsaný odkaz → přehrávání ve smyčce.
    /// </summary>
    public class Music : MonoBehaviour
    {
        public GameBootstrap boot;
        AudioSource source;
        bool started;
        public static float Volume
        {
            get => PlayerPrefs.GetFloat("audio.music", 0.5f);
            set { PlayerPrefs.SetFloat("audio.music", Mathf.Clamp01(value)); }
        }
        public string NowPlaying { get; private set; }

        [Serializable] class Track { public string id, title, file; public int[] chapters; }
        [Serializable] class Album { public string album, artist; public Track[] tracks; }
        [Serializable] class Signed { public string signedURL; }

        void Awake()
        {
            source = gameObject.AddComponent<AudioSource>();
            source.loop = true;
            source.playOnAwake = false;
            source.spatialBlend = 0;
            source.volume = 0;
        }

        void Update()
        {
            if (boot.inWorld && !started && boot.api.SignedIn) { started = true; StartCoroutine(Load()); }
            if (!boot.inWorld && started) { started = false; source.Stop(); NowPlaying = null; }
            float target = boot.inWorld ? Volume * 0.6f : 0;
            source.volume = Mathf.MoveTowards(source.volume, target, Time.unscaledDeltaTime * 0.25f);
        }

        IEnumerator Get(string url, Action<UnityWebRequest> done)
        {
            using var req = UnityWebRequest.Get(url);
            req.SetRequestHeader("apikey", SupabaseClient.PublishableKey);
            req.SetRequestHeader("Authorization", "Bearer " + boot.api.AccessToken);
            yield return req.SendWebRequest();
            done(req);
        }

        IEnumerator Load()
        {
            Album album = null;
            yield return Get($"{SupabaseClient.Url}/storage/v1/object/authenticated/ashes-music/album.json", r =>
            {
                if (r.result == UnityWebRequest.Result.Success) album = JsonUtility.FromJson<Album>(r.downloadHandler.text);
            });
            if (album?.tracks == null || album.tracks.Length == 0) yield break;
            int chapter = Mathf.Clamp(boot.state?.character?.chapter ?? 1, 1, 6);
            Track track = album.tracks[0];
            foreach (var t in album.tracks) if (t.chapters != null && Array.IndexOf(t.chapters, chapter) >= 0) { track = t; break; }

            string signed = null;
            using (var req = new UnityWebRequest($"{SupabaseClient.Url}/storage/v1/object/sign/ashes-music/{track.file}", "POST"))
            {
                req.uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes("{\"expiresIn\":21600}"));
                req.downloadHandler = new DownloadHandlerBuffer();
                req.SetRequestHeader("Content-Type", "application/json");
                req.SetRequestHeader("apikey", SupabaseClient.PublishableKey);
                req.SetRequestHeader("Authorization", "Bearer " + boot.api.AccessToken);
                yield return req.SendWebRequest();
                if (req.result == UnityWebRequest.Result.Success) signed = JsonUtility.FromJson<Signed>(req.downloadHandler.text)?.signedURL;
            }
            if (string.IsNullOrEmpty(signed)) yield break;
            string url = signed.StartsWith("http") ? signed : $"{SupabaseClient.Url}/storage/v1{signed}";
            var type = track.file.EndsWith(".ogg") ? AudioType.OGGVORBIS : track.file.EndsWith(".wav") ? AudioType.WAV : AudioType.MPEG;
            using var audio = UnityWebRequestMultimedia.GetAudioClip(url, type);
            ((DownloadHandlerAudioClip)audio.downloadHandler).streamAudio = false;
            yield return audio.SendWebRequest();
            if (audio.result != UnityWebRequest.Result.Success || !boot.inWorld) yield break;
            var clip = DownloadHandlerAudioClip.GetContent(audio);
            if (clip == null) yield break;
            source.clip = clip;
            source.volume = 0;
            source.Play();
            NowPlaying = $"{track.title} · {album.artist}";
        }
    }
}
