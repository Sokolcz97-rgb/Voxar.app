using UnityEngine;

namespace Voxario.Ashes
{
    /// <summary>
    /// Návrat do bezpečí (klávesa T): 5 s soustředění (přeruší ho pohyb, skok nebo souboj),
    /// pak přenos do Kalidry / tábora Legie. Znovu za 3 minuty.
    /// </summary>
    public class Recall : MonoBehaviour
    {
        public GameBootstrap boot;
        const float CastTime = 5f, Cooldown = 180f;
        float castStart = -1, readyAt;
        Vector3 castPos;
        string note;
        float noteUntil;

        bool Casting => castStart >= 0;

        void Update()
        {
            if (!boot.inWorld || boot.player == null) { castStart = -1; return; }
            bool busy = Encounters.Instance != null && Encounters.Instance.Busy;
            if (!Chat.Typing && Input.GetKeyDown(KeyCode.T) && !busy)
            {
                if (Casting) { castStart = -1; Note("Návrat zrušen."); }
                else if (Time.time < readyAt) Note($"Návrat půjde znovu za {Mathf.CeilToInt(readyAt - Time.time)} s.");
                else { castStart = Time.time; castPos = boot.player.transform.position; Sfx.Play("quest", 0.4f); }
            }
            if (!Casting) return;
            if (busy || Vector3.Distance(castPos, boot.player.transform.position) > 0.6f)
            {
                castStart = -1;
                Note("Návrat přerušen.");
                return;
            }
            if (Time.time - castStart >= CastTime)
            {
                castStart = -1;
                readyAt = Time.time + Cooldown;
                bool legie = boot.state?.character?.faction == "legie";
                boot.player.Respawn(legie ? Encounters.RespawnLegie : Encounters.RespawnKalidra);
                Sfx.Play("level", 0.5f);
                Note(legie ? "Jsi zpět v táboře Legie." : "Jsi zpět u hradeb Kalidry.");
            }
        }

        void Note(string s) { note = s; noteUntil = Time.time + 3; }

        void OnGUI()
        {
            if (!boot.inWorld) return;
            EryonSkin.Begin();
            float W = EryonSkin.W, H = EryonSkin.H;
            if (Casting)
            {
                float k = Mathf.Clamp01((Time.time - castStart) / CastTime);
                var r = new Rect(W / 2 - 200, H - 230, 400, 26);
                EryonSkin.Bar(r, k, new Color(0.62f, 0.48f, 0.9f), "Návrat do bezpečí…  (pohyb ruší)");
            }
            else if (note != null && Time.time < noteUntil)
                EryonSkin.Shadowed(new Rect(W / 2 - 300, H - 232, 600, 30), note, new GUIStyle(EryonSkin.Center) { font = EryonSkin.CormorantBold, fontSize = 22, normal = { textColor = EryonSkin.GoldBright } });
        }
    }
}
