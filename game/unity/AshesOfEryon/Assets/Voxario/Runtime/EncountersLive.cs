using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace Voxario.Ashes
{
    // ------------------------------------------------------------------ aktivní boj (0.9)
    [Serializable] public class LiveEvent { public string who; public int d, i, hp_p, hp_e, ms; public bool c, e, b, active, skill; }
    [Serializable] public class LiveRules { public int attack_ms, skill_ms, dodge_ms; public float range; public string skill, skill_desc; }
    [Serializable] public class LiveEnemy { public string name, @class; public int level; }
    [Serializable]
    public class LiveState
    {
        public string id, status, cls, title;
        public int hp_p, max_p, hp_e, max_e, swing_index, swing_ms, next_swing_in, attack_ready_in, skill_ready_in;
        public LiveRules rules;
        public LiveEnemy enemy;
        public LiveEvent[] events;
        public bool won;
        public int xp, gold, levels;
        public string[] quests;
        public Item item;
        public GameState state;
    }

    /// <summary>
    /// Aktivní boj ve světě: útok (levé tlačítko myši), dovednost (1), úhyb (Q), blok (držet F).
    /// Nepřítel útočí v rytmu, který drží server; před každou ranou se napřáhne (červené „!“) –
    /// to je chvíle pro úhyb nebo blok. Výsledek, poškození i odměny počítá server (ashes_live_*).
    /// </summary>
    public partial class Encounters
    {
        bool live;
        LiveRules liveRules;
        string liveId, liveSkillName = "Dovednost";
        float swingLandAt, attackReadyAt, skillReadyAt, dodgeReadyAt, stunnedUntil;
        int swingIndex, warnedIndex = -1, defendedIndex = -1, tickedIndex = -1, rpcInFlight;
        bool blocking, liveEnded;
        LiveState liveFinal;
        static bool liveHelpShown;

        /// <summary>Jsou zrovna aktivní bojové klávesy (kamera pak nepoužívá Q/E).</summary>
        public static bool LiveCombatActive;

        IEnumerator RunLiveFight(Enemy e)
        {
            fighting = true;
            live = true;
            liveEnded = false;
            liveFinal = null;
            LiveCombatActive = true;
            boot.player.speedMul = 1f;
            string json = null, err = null;
            float t0 = Time.realtimeSinceStartup;
            yield return boot.api.Rpc("ashes_live_begin", $"{{\"p_region\":\"{e.region}\",\"p_enemy\":\"{e.def.id}\"}}", (j, er) => { json = j; err = er; });
            if (err != null)
            {
                Note(err);
                e.calmUntil = Time.time + 6;
                EndLive();
                yield break;
            }
            var st = JsonUtility.FromJson<LiveState>(json);
            float half = (Time.realtimeSinceStartup - t0) / 2f;
            liveId = st.id;
            liveRules = st.rules ?? new LiveRules { attack_ms = 900, skill_ms = 7000, dodge_ms = 1100, range = 3.2f };
            liveSkillName = string.IsNullOrEmpty(liveRules.skill) ? "Dovednost" : liveRules.skill;
            fName1 = boot.state?.character?.name ?? "Ty";
            fName2 = $"{st.enemy?.name ?? e.def.name} · úroveň {st.enemy?.level}";
            max1 = st.max_p; max2 = st.max_e; hp1 = st.hp_p; hp2 = st.hp_e;
            swingIndex = st.swing_index;
            swingLandAt = Time.time + st.next_swing_in / 1000f - half;
            attackReadyAt = skillReadyAt = dodgeReadyAt = Time.time;
            warnedIndex = defendedIndex = tickedIndex = -1;
            ModManager.Fire("fight_start", e.def.id, e.def.name);
            if (!liveHelpShown)
            {
                liveHelpShown = true;
                Note($"{KeyBinds.Label("attack")} = útok · {KeyBinds.Label("skill")} = dovednost · {KeyBinds.Label("dodge")} = úhyb · {KeyBinds.Label("block")} (držet) = blok. Uhni, když se nepřítel napřáhne! Klávesy změníš v Nastavení → Ovládání.");
            }

            bool enemyRanged = e.def.cls == "lucistnik" || e.def.cls == "vestec";
            while (!liveEnded)
            {
                float now = Time.time, dt = Time.deltaTime;
                var pw = WorldMap.ToWeb(boot.player.transform.position);
                float dist = Vector2.Distance(pw, e.pos);

                // --- nepřítel: drží si odstup (střelci) nebo jde k hráči
                float want = enemyRanged ? 7f : 1.6f;
                float spd = 0;
                if (now > stunnedUntil && dist > want + 0.3f && now < swingLandAt - 0.55f)
                {
                    var d = (pw - e.pos).normalized;
                    var next = e.pos + d * 3.6f * dt;
                    if (WorldMap.HeightAt(next.x, next.y) > 0.3f) { e.pos = next; spd = 3.6f; }
                }
                var look = pw - e.pos;
                if (look.sqrMagnitude > 0.01f)
                    e.view.transform.rotation = Quaternion.Slerp(e.view.transform.rotation, Quaternion.LookRotation(new Vector3(look.x, 0, -look.y)), 1 - Mathf.Exp(-10 * dt));
                e.view.speed = spd;
                e.view.transform.position = WorldMap.ToWorld(e.pos.x, e.pos.y);

                // --- napřažení nepřítele (signál k úhybu / bloku)
                if (now >= swingLandAt - 0.65f && warnedIndex < swingIndex && now > stunnedUntil)
                {
                    warnedIndex = swingIndex;
                    Float(e.view.transform.position + Vector3.up * 2.6f, "!", new Color(1f, 0.25f, 0.2f));
                    Sfx.Play("warn");
                }

                bool inputOk = !Chat.Typing && boot.player.inputEnabled && !(NpcDialog.Instance != null && NpcDialog.Instance.IsOpen);
                float range = liveRules.range > 0 ? liveRules.range : 3.2f;

                // --- blok (držet F): pomalejší pohyb, ohlásí se na nejbližší úder
                blocking = inputOk && KeyBinds.Held("block");
                boot.player.speedMul = blocking ? 0.4f : 1f;
                bool inWindow = now >= swingLandAt - 0.85f && now <= swingLandAt + 0.2f;
                if (blocking && inWindow && defendedIndex < swingIndex)
                {
                    defendedIndex = swingIndex;
                    StartCoroutine(LiveAct("block", swingIndex, e));
                }

                // --- úhyb (Q): odskok bokem; když přijde včas, rána mine
                if (inputOk && KeyBinds.Down("dodge") && now >= dodgeReadyAt)
                {
                    dodgeReadyAt = now + Mathf.Max(0.9f, liveRules.dodge_ms / 1000f + 0.05f);
                    var toEnemy = e.view.transform.position - boot.player.transform.position; toEnemy.y = 0;
                    var side = Vector3.Cross(Vector3.up, toEnemy.normalized);
                    if (UnityEngine.Random.value < 0.5f) side = -side;
                    boot.player.Dash((side * 0.8f - toEnemy.normalized * 0.4f).normalized);
                    Sfx.Play("dodge");
                    if (inWindow && defendedIndex < swingIndex)
                    {
                        defendedIndex = swingIndex;
                        StartCoroutine(LiveAct("dodge", swingIndex, e));
                    }
                }

                // --- útok (levé tlačítko myši) a dovednost (1)
                bool wantAttack = inputOk && !blocking && KeyBinds.Down("attack") && (KeyBinds.Get("attack") != KeyCode.Mouse0 || GUIUtility.hotControl == 0);
                bool wantSkill = inputOk && !blocking && KeyBinds.Down("skill");
                if ((wantAttack && now >= attackReadyAt) || (wantSkill && now >= skillReadyAt))
                {
                    if (dist > range) Note(range > 5 ? "Nepřítel je příliš daleko." : "Přibliž se k nepříteli.");
                    else
                    {
                        bool skill = wantSkill && now >= skillReadyAt;
                        attackReadyAt = now + liveRules.attack_ms / 1000f;
                        if (skill) skillReadyAt = now + liveRules.skill_ms / 1000f;
                        var dir = e.view.transform.position - boot.player.transform.position; dir.y = 0;
                        if (dir.sqrMagnitude > 0.01f) boot.player.transform.rotation = Quaternion.LookRotation(dir);
                        boot.player.view.Lunge();
                        Sfx.Play("swing");
                        StartCoroutine(LiveAct(skill ? "skill" : "attack", null, e));
                    }
                }

                // --- vyhodnocení úderu nepřítele (server) chvíli po jeho dopadu
                if (now >= swingLandAt + 0.38f && tickedIndex < swingIndex && rpcInFlight == 0)
                {
                    tickedIndex = swingIndex;
                    StartCoroutine(LiveAct("tick", null, e));
                }

                // --- útěk: příliš daleko od nepřítele
                if (dist > 26f && rpcInFlight == 0)
                {
                    StartCoroutine(LiveAct("flee", null, e));
                    yield return new WaitForSeconds(0.4f);
                }
                yield return null;
            }

            // --- konec souboje
            var fin = liveFinal;
            boot.player.speedMul = 1f;
            LiveCombatActive = false;
            if (fin == null) { EndLive(); yield break; }
            if (fin.status == "won")
            {
                e.view.Fall();
                yield return new WaitForSeconds(0.9f);
                e.alive = false;
                e.respawnAt = Time.time + 35;
                e.view.gameObject.SetActive(false);
            }
            else if (fin.status == "lost")
            {
                boot.player.view.Fall();
                yield return new WaitForSeconds(0.9f);
                e.calmUntil = Time.time + 6;
            }
            else
            {
                e.calmUntil = Time.time + 8;
                Note("Utekl jsi ze souboje.");
                EndLive();
                yield break;
            }
            if (fin.state?.character != null) boot.state = fin.state;
            RefreshBeacons();
            boot.player.inputEnabled = false;
            result = new FightResult { won = fin.won, xp = fin.xp, gold = fin.gold, levels = fin.levels, quests = fin.quests, item = fin.item, state = fin.state };
            ResultSound();
            ModManager.Fire("fight_end", fin.won ? "won" : "lost", e.def.name);
            live = false;
            fighting = false;
        }

        void EndLive()
        {
            live = false;
            fighting = false;
            LiveCombatActive = false;
            boot.player.speedMul = 1f;
            boot.player.inputEnabled = true;
        }

        /// <summary>Jedna akce na serveru; odpověď přehraje události (zásahy, úhyby, bloky).</summary>
        IEnumerator LiveAct(string action, int? index, Enemy e)
        {
            if (liveEnded || liveId == null) yield break;
            rpcInFlight++;
            string args = $"{{\"p_id\":\"{liveId}\",\"p_action\":\"{action}\"" + (index.HasValue ? $",\"p_index\":{index.Value}" : "") + "}";
            string json = null, err = null;
            float t0 = Time.realtimeSinceStartup;
            yield return boot.api.Rpc("ashes_live_act", args, (j, er) => { json = j; err = er; });
            rpcInFlight--;
            if (liveEnded) yield break;
            if (err != null) { Note(err); yield break; }
            var st = JsonUtility.FromJson<LiveState>(json);
            if (st == null) yield break;
            float half = (Time.realtimeSinceStartup - t0) / 2f;
            foreach (var ev in st.events ?? new LiveEvent[0]) PlayLiveEvent(ev, e);
            hp1 = st.hp_p; hp2 = st.hp_e;
            if (st.swing_index != swingIndex) { swingIndex = st.swing_index; }
            swingLandAt = Time.time + st.next_swing_in / 1000f - half;
            // srovnat odpočty s autoritativním serverem (jen když server hlásí delší čekání)
            attackReadyAt = Mathf.Max(attackReadyAt, Time.time + st.attack_ready_in / 1000f - half);
            skillReadyAt = Mathf.Max(skillReadyAt, Time.time + st.skill_ready_in / 1000f - half);
            if (st.status != "active")
            {
                liveFinal = st;
                liveEnded = true;
            }
        }

        void PlayLiveEvent(LiveEvent ev, Enemy e)
        {
            var pHead = boot.player.transform.position + Vector3.up * 2f;
            var eHead = e.view.transform.position + Vector3.up * 2f;
            if (ev.who == "e")
            {
                e.view.Lunge();
                if (ev.e) { Float(pHead, ev.active ? "ÚHYB!" : "úhyb", new Color(0.7f, 0.85f, 1f)); Sfx.Play("dodge"); }
                else if (ev.d <= 0 && ev.b) { Float(pHead, "blok", new Color(0.8f, 0.8f, 0.8f)); Sfx.Play("block"); }
                else
                {
                    if (ev.b) { Float(pHead + Vector3.up * 0.4f, "BLOK", new Color(0.8f, 0.85f, 0.9f)); Sfx.Play("block"); }
                    else Sfx.Play(ev.c ? "crit" : "hit");
                    Float(pHead, (ev.c ? "KRITICKÝ  " : "") + "-" + ev.d, new Color(1f, 0.35f, 0.3f));
                    boot.player.view.Flinch();
                }
            }
            else if (ev.who == "p")
            {
                if (ev.e) { Float(eHead, "minul", new Color(0.75f, 0.75f, 0.75f)); }
                else if (ev.d <= 0 && ev.b) { Float(eHead, "vykryto", new Color(0.8f, 0.8f, 0.8f)); Sfx.Play("block"); }
                else
                {
                    Sfx.Play(ev.c || ev.skill ? "crit" : "hit");
                    Float(eHead, (ev.skill ? liveSkillName.ToUpperInvariant() + "  " : ev.c ? "KRITICKÝ  " : "") + "-" + ev.d,
                        ev.skill ? new Color(1f, 0.6f, 0.2f) : ev.c ? new Color(1f, 0.45f, 0.2f) : new Color(1f, 0.9f, 0.5f));
                    e.view.Flinch();
                }
            }
            else if (ev.who == "stun")
            {
                stunnedUntil = Time.time + ev.ms / 1000f;
                Float(eHead + Vector3.up * 0.5f, "OMRÁČEN", new Color(1f, 0.85f, 0.4f));
            }
        }

        /// <summary>Lišta akcí dole uprostřed (odpočty, klávesy) a ukazatel napřažení.</summary>
        void DrawLiveHud(float W, float H)
        {
            if (!live || liveRules == null) return;
            float now = Time.time;
            string[] keys = { KeyBinds.Label("attack"), KeyBinds.Label("skill"), KeyBinds.Label("dodge"), KeyBinds.Label("block") };
            string[] names = { "Útok", liveSkillName, "Úhyb", "Blok" };
            float[] left = {
                Mathf.Max(0, attackReadyAt - now) / Mathf.Max(0.1f, liveRules.attack_ms / 1000f),
                Mathf.Max(0, skillReadyAt - now) / Mathf.Max(0.1f, liveRules.skill_ms / 1000f),
                Mathf.Max(0, dodgeReadyAt - now) / Mathf.Max(0.1f, liveRules.dodge_ms / 1000f + 0.05f),
                0 };
            float bw = 150, gap = 14, total = bw * 4 + gap * 3, x0 = W / 2 - total / 2, y = H - 210;
            for (int i = 0; i < 4; i++)
            {
                var r = new Rect(x0 + i * (bw + gap), y, bw, 74);
                bool active = i == 3 ? blocking : left[i] <= 0;
                EryonSkin.Fill(r, new Color(0.05f, 0.04f, 0.03f, 0.78f));
                if (left[i] > 0) EryonSkin.Fill(new Rect(r.x, r.y, r.width * Mathf.Clamp01(left[i]), r.height), new Color(0, 0, 0, 0.55f));
                if (active) EryonSkin.Fill(new Rect(r.x, r.yMax - 4, r.width, 4), i == 3 ? EryonSkin.Sky : EryonSkin.GoldBright);
                EryonSkin.KeyCap(new Rect(r.x + 8, r.y + 8, 14 + keys[i].Length * 10, 24), keys[i]);
                GUI.Label(new Rect(r.x + 8, r.y + 38, r.width - 16, 30), names[i], new GUIStyle(EryonSkin.Small) { alignment = TextAnchor.MiddleLeft, normal = { textColor = active ? EryonSkin.GoldBright : new Color(0.7f, 0.65f, 0.58f) } });
            }
            // napřažení: blikající varování nad lištou
            float toSwing = swingLandAt - now;
            if (toSwing <= 0.65f && toSwing > -0.15f && now > stunnedUntil)
            {
                float a = 0.55f + 0.45f * Mathf.Sin(now * 30f);
                var wr = new Rect(W / 2 - 220, y - 56, 440, 40);
                EryonSkin.Shadowed(wr, $"Nepřítel se napřahuje – {KeyBinds.Label("dodge")} úhyb / {KeyBinds.Label("block")} blok", new GUIStyle(EryonSkin.Center) { font = EryonSkin.CinzelBold, fontSize = 22, normal = { textColor = new Color(1f, 0.35f, 0.28f, a) } });
            }
        }
    }
}
