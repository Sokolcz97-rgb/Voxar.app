using System.Collections;
using UnityEngine;

namespace Voxario.Ashes
{
    /// <summary>
    /// Více postav na účet (nejvýše 4): seznam, přepnutí a založení nové postavy
    /// (ashes_characters_list / ashes_switch_character / ashes_new_character).
    /// Vykresluje ho GameUI v nastavení (záložka Postavy) a na obrazovce tvorby postavy.
    /// </summary>
    public class CharacterSlots : MonoBehaviour
    {
        public GameBootstrap boot;

        [System.Serializable]
        public class Slot { public string id, name, @class, faction; public int level; public Appearance appearance; }
        [System.Serializable]
        class SlotList { public int max; public Slot active; public Slot[] others; }

        SlotList data;
        bool busy, loaded;
        string error;
        public bool Loaded => loaded;
        public bool HasOthers => data?.others != null && data.others.Length > 0;

        public void Refresh() { loaded = false; if (!busy && boot.api.SignedIn) StartCoroutine(Load()); }

        IEnumerator Load()
        {
            busy = true;
            string json = null, err = null;
            yield return boot.api.Rpc("ashes_characters_list", "{}", (j, e) => { json = j; err = e; });
            busy = false;
            loaded = true;
            if (err != null) { error = err; yield break; }
            data = JsonUtility.FromJson<SlotList>(json);
        }

        IEnumerator Act(string fn, string args)
        {
            busy = true;
            string json = null, err = null;
            yield return boot.api.Rpc(fn, args, (j, e) => { json = j; err = e; });
            busy = false;
            if (err != null) { error = err; yield break; }
            error = null;
            loaded = false;
            boot.Reload();
        }

        /// <summary>Seznam postav s tlačítky (GUILayout uvnitř oblasti volajícího).</summary>
        public void Draw(bool inWorld)
        {
            if (!loaded && !busy && boot.api.SignedIn) StartCoroutine(Load());
            if (!loaded) { GUILayout.Label("Načítám postavy…", EryonSkin.Body); return; }
            if (data == null) { if (error != null) GUILayout.Label($"<color=#e0672a>{error}</color>", new GUIStyle(EryonSkin.Body) { richText = true }); return; }
            GUI.enabled = !busy;
            int count = (data.active != null && !string.IsNullOrEmpty(data.active.name) ? 1 : 0) + (data.others?.Length ?? 0);
            if (data.active != null && !string.IsNullOrEmpty(data.active.name))
                Row(data.active, true);
            foreach (var s in data.others ?? new Slot[0]) Row(s, false);
            GUILayout.Space(10);
            if (inWorld)
            {
                GUI.enabled = !busy && count < Mathf.Max(1, data.max);
                if (GUILayout.Button($"+ Založit novou postavu  ({count}/{Mathf.Max(1, data.max)})", EryonSkin.Button, GUILayout.Height(46), GUILayout.Width(420)))
                    StartCoroutine(Act("ashes_new_character", "{}"));
                GUILayout.Label("Současná postava se uloží a kdykoli se k ní vrátíš.", EryonSkin.Small);
            }
            GUI.enabled = true;
            if (error != null) GUILayout.Label($"<color=#e0672a>{error}</color>", new GUIStyle(EryonSkin.BodyBold) { richText = true });
        }

        void Row(Slot s, bool active)
        {
            GUILayout.BeginHorizontal(GUILayout.Height(76));
            var pr = GUILayoutUtility.GetRect(66, 66, GUILayout.Width(66), GUILayout.Height(66));
            EryonSkin.Portrait(pr, EryonSkin.PortraitFor(s.@class, s.appearance?.gender));
            GUILayout.Space(12);
            GUILayout.BeginVertical();
            GUILayout.Label($"<b>{s.name}</b>{(active ? "  <color=#8cc06b>· hraješ</color>" : "")}", new GUIStyle(EryonSkin.Body) { fontSize = 22, richText = true });
            GUILayout.Label($"{EryonSkin.ClassName(s.@class)} · úroveň {s.level} · {EryonSkin.FactionName(s.faction)}", EryonSkin.Small);
            GUILayout.EndVertical();
            GUILayout.FlexibleSpace();
            if (!active && GUILayout.Button("Hrát za tuto postavu", EryonSkin.ButtonPrimary, GUILayout.Width(260), GUILayout.Height(48)))
                StartCoroutine(Act("ashes_switch_character", "{\"p_slot\":" + MiniJson.Write(s.id) + "}"));
            GUILayout.EndHorizontal();
            EryonSkin.Fill(GUILayoutUtility.GetRect(200, 1, GUILayout.ExpandWidth(true)), EryonSkin.Line);
        }
    }
}
