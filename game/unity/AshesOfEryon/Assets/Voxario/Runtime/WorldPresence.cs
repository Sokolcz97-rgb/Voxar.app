using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;

namespace Voxario.Ashes
{
    /// <summary>
    /// Ostatní hráči ve světě přes Supabase Realtime – společný soukromý kanál ashes:world:all,
    /// takže se vidí hráči obou frakcí (Kalidra i Legie); frakce je vidět pod jménem.
    /// Presence nese jméno, povolání a vzhled, broadcast „pos“ polohu (4× za sekundu).
    /// </summary>
    public class WorldPresence : MonoBehaviour
    {
        public GameBootstrap boot;

        ClientWebSocket ws;
        CancellationTokenSource cts;
        readonly ConcurrentQueue<string> inbox = new ConcurrentQueue<string>();
        readonly ConcurrentQueue<string> outbox = new ConcurrentQueue<string>();
        string topic, uid, myFaction = "kalidra";
        int refNo = 1;
        float heartbeatAt, sendAt, reconnectAt;
        bool joined;
        Vector3 lastSent;

        class Other
        {
            public string name, cls, gender;
            public int level;
            public CharacterView view;
            public Vector2 pos, target, vel;
            public float stamp;
            public float ry;
            public bool hasPos;
        }
        readonly Dictionary<string, Other> others = new Dictionary<string, Other>();

        public int Count => others.Count;
        public static WorldPresence Instance { get; private set; }
        /// <summary>Odezva serveru (WebSocket, tam a zpět) v ms; 0 = zatím neměřeno.</summary>
        public static int PingMs { get; private set; }
        string pingRef;
        float pingSentAt;
        Vector3 lastVel;
        float lastSendTime;

        void Awake() => Instance = this;

        /// <summary>Krátký signál ostatním (např. „chat“ = nová zpráva).</summary>
        public void Signal(string ev)
        {
            if (!joined) return;
            Enqueue(new Dictionary<string, object>
            {
                ["topic"] = topic, ["event"] = "broadcast", ["ref"] = NextRef(), ["join_ref"] = "1",
                ["payload"] = new Dictionary<string, object> { ["type"] = "broadcast", ["event"] = ev, ["payload"] = new Dictionary<string, object> { ["uid"] = uid } },
            });
        }

        static double R2(float v) => Math.Round(v, 2);

        /// <summary>Znovu poslat údaje o sobě (např. po vstupu do oddílu).</summary>
        public void Retrack()
        {
            if (joined) Track();
            if (boot.player != null)
            {
                var t = boot.player.GetComponent<NameTag>();
                var ch = boot.state?.character;
                if (t != null && ch != null) t.title = TagName(Oddil.Instance?.MyTag, string.IsNullOrEmpty(ch.display_name) ? ch.name : ch.display_name);
            }
        }

        public static string TagName(string tag, string name) => string.IsNullOrEmpty(tag) ? name : $"[{tag}] {name}";

        public void Connect()
        {
            Disconnect();
            var st = boot.state;
            if (st?.character == null || !boot.api.SignedIn) return;
            uid = UserIdFromJwt(boot.api.AccessToken);
            if (string.IsNullOrEmpty(uid)) return;
            string faction = string.IsNullOrEmpty(st.character.faction) ? "kalidra" : st.character.faction;
            myFaction = faction;
            // společný svět pro obě frakce (dřív ashes:world:<frakce>)
            topic = "realtime:ashes:world:all";
            cts = new CancellationTokenSource();
            _ = Run(cts.Token);
        }

        public void Disconnect()
        {
            joined = false;
            try { cts?.Cancel(); } catch { }
            cts = null;
            try { ws?.Dispose(); } catch { }
            ws = null;
            foreach (var o in others.Values) if (o.view != null) Destroy(o.view.gameObject);
            others.Clear();
        }

        void OnDestroy() => Disconnect();

        static string UserIdFromJwt(string jwt)
        {
            try
            {
                var part = jwt.Split('.')[1].Replace('-', '+').Replace('_', '/');
                while (part.Length % 4 != 0) part += "=";
                var json = Encoding.UTF8.GetString(Convert.FromBase64String(part));
                return MiniJson.S(MiniJson.Obj(MiniJson.Parse(json)), "sub");
            }
            catch { return null; }
        }

        async Task Run(CancellationToken ct)
        {
            try
            {
                ws = new ClientWebSocket();
                var url = $"{SupabaseClient.Url.Replace("https://", "wss://")}/realtime/v1/websocket?apikey={SupabaseClient.PublishableKey}&vsn=1.0.0";
                await ws.ConnectAsync(new Uri(url), ct);
                var buffer = new byte[64 * 1024];
                var sb = new StringBuilder();
                _ = SendLoop(ct);
                // přihlášení do kanálu
                Enqueue(new Dictionary<string, object>
                {
                    ["topic"] = topic, ["event"] = "phx_join", ["ref"] = "1", ["join_ref"] = "1",
                    ["payload"] = new Dictionary<string, object>
                    {
                        ["config"] = new Dictionary<string, object>
                        {
                            ["broadcast"] = new Dictionary<string, object> { ["self"] = false, ["ack"] = false },
                            ["presence"] = new Dictionary<string, object> { ["key"] = uid },
                            ["postgres_changes"] = new List<object>(),
                            ["private"] = true,
                        },
                        ["access_token"] = boot.api.AccessToken,
                    },
                });
                while (!ct.IsCancellationRequested && ws.State == WebSocketState.Open)
                {
                    var r = await ws.ReceiveAsync(new ArraySegment<byte>(buffer), ct);
                    if (r.MessageType == WebSocketMessageType.Close) break;
                    sb.Append(Encoding.UTF8.GetString(buffer, 0, r.Count));
                    if (r.EndOfMessage) { inbox.Enqueue(sb.ToString()); sb.Clear(); }
                }
            }
            catch (Exception e)
            {
                if (!ct.IsCancellationRequested) Debug.Log("[Voxario] realtime: " + e.Message);
            }
            inbox.Enqueue("{\"event\":\"__closed\"}");
        }

        async Task SendLoop(CancellationToken ct)
        {
            try
            {
                while (!ct.IsCancellationRequested)
                {
                    while (ws != null && ws.State == WebSocketState.Open && outbox.TryDequeue(out var msg))
                        await ws.SendAsync(new ArraySegment<byte>(Encoding.UTF8.GetBytes(msg)), WebSocketMessageType.Text, true, ct);
                    await Task.Delay(30, ct);
                }
            }
            catch { }
        }

        void Enqueue(Dictionary<string, object> msg) => outbox.Enqueue(MiniJson.Write(msg));

        string NextRef() => (++refNo).ToString();

        void Track()
        {
            var ch = boot.state.character;
            var p = boot.player != null ? WorldMap.ToWeb(boot.player.transform.position) : Vector2.zero;
            Enqueue(new Dictionary<string, object>
            {
                ["topic"] = topic, ["event"] = "presence", ["ref"] = NextRef(), ["join_ref"] = "1",
                ["payload"] = new Dictionary<string, object>
                {
                    ["type"] = "presence", ["event"] = "track",
                    ["payload"] = new Dictionary<string, object>
                    {
                        ["name"] = string.IsNullOrEmpty(ch.display_name) ? ch.name : ch.display_name,
                        ["cls"] = ch.@class, ["level"] = ch.level,
                        ["appearance"] = new Dictionary<string, object> { ["gender"] = ch.appearance?.gender ?? "m" },
                        ["eryon"] = ch.is_eryon, ["azkar"] = ch.is_azkar, ["faction"] = ch.faction, ["uid"] = uid,
                        ["tag"] = Oddil.Instance?.MyTag ?? "",
                        ["x"] = p.x, ["z"] = p.y, ["ry"] = Ry(),
                    },
                },
            });
        }

        float Ry()
        {
            if (boot.player == null) return 0;
            var f = boot.player.transform.forward;
            return Mathf.Atan2(f.x, -f.z);
        }

        void Update()
        {
            if (!boot.inWorld) { if (cts != null) Disconnect(); return; }
            if (cts == null && Time.unscaledTime > reconnectAt) { reconnectAt = Time.unscaledTime + 10; Connect(); }
            while (inbox.TryDequeue(out var text)) Handle(text);
            float now = Time.unscaledTime;
            if (joined && now > heartbeatAt)
            {
                // heartbeat drží spojení a zároveň měří odezvu
                heartbeatAt = now + 5;
                pingRef = NextRef();
                pingSentAt = now;
                Enqueue(new Dictionary<string, object> { ["topic"] = "phoenix", ["event"] = "heartbeat", ["payload"] = new Dictionary<string, object>(), ["ref"] = pingRef });
            }
            if (joined && boot.player != null && now > sendAt)
            {
                // posílá se poloha + rychlost; ostatní si mezi zprávami pohyb dopočítají.
                // Rovný běh = 3× za s, změna směru = hned (max 6× za s), stání = nic.
                sendAt = now + 0.16f;
                var pos = boot.player.transform.position;
                float since = now - lastSendTime;
                var vel = since > 0.01f ? (pos - lastSent) / Mathf.Max(since, 0.16f) : Vector3.zero;
                bool moved = (pos - lastSent).sqrMagnitude > 0.0025f;
                bool turned = (vel - lastVel).sqrMagnitude > 0.8f;
                bool stopped = !moved && lastVel.sqrMagnitude > 0.01f;
                if ((moved && (turned || since > 0.33f)) || stopped)
                {
                    if (stopped) vel = Vector3.zero;
                    lastSent = pos;
                    lastVel = vel;
                    lastSendTime = now;
                    var p = WorldMap.ToWeb(pos);
                    var v = new Vector2(vel.x, -vel.z);
                    Enqueue(new Dictionary<string, object>
                    {
                        ["topic"] = topic, ["event"] = "broadcast", ["ref"] = NextRef(), ["join_ref"] = "1",
                        ["payload"] = new Dictionary<string, object>
                        {
                            ["type"] = "broadcast", ["event"] = "pos",
                            ["payload"] = new Dictionary<string, object> { ["x"] = R2(p.x), ["z"] = R2(p.y), ["vx"] = R2(v.x), ["vz"] = R2(v.y), ["ry"] = R2(Ry()), ["uid"] = uid },
                        },
                    });
                }
            }
            // plynulý pohyb ostatních
            float dt = Time.deltaTime;
            foreach (var o in others.Values)
            {
                if (o.view == null || !o.hasPos) continue;
                var before = o.pos;
                // dopočet polohy podle poslední rychlosti (max 0,6 s), skryje zpoždění sítě
                float age = Mathf.Min(Time.unscaledTime - o.stamp + PingMs / 2000f, 0.6f);
                var predicted = o.target + o.vel * age;
                o.pos = Vector2.Lerp(o.pos, predicted, 1 - Mathf.Exp(-10 * dt));
                float spd = (o.pos - before).magnitude / Mathf.Max(dt, 0.001f);
                o.view.speed = spd > 0.3f ? spd : 0;
                o.view.transform.position = WorldMap.ToWorld(o.pos.x, o.pos.y);
                o.view.transform.rotation = Quaternion.Slerp(o.view.transform.rotation, WorldMap.FaceToRotation(o.ry), 1 - Mathf.Exp(-10 * dt));
            }
        }

        void Handle(string text)
        {
            var msg = MiniJson.Obj(MiniJson.Parse(text));
            if (msg == null) return;
            string ev = MiniJson.S(msg, "event");
            var payload = MiniJson.Obj(msg.TryGetValue("payload", out var pl) ? pl : null);
            switch (ev)
            {
                case "__closed":
                    joined = false;
                    cts = null;
                    reconnectAt = Time.unscaledTime + 5;
                    break;
                case "phx_reply":
                    if (pingRef != null && MiniJson.S(msg, "ref") == pingRef)
                    {
                        int ms = Mathf.RoundToInt((Time.unscaledTime - pingSentAt) * 1000f);
                        PingMs = PingMs == 0 ? ms : Mathf.RoundToInt(PingMs * 0.6f + ms * 0.4f);
                        pingRef = null;
                        break;
                    }
                    if (MiniJson.S(msg, "ref") == "1")
                    {
                        if (MiniJson.S(payload, "status") == "ok") { joined = true; heartbeatAt = Time.unscaledTime + 25; Track(); }
                        else Debug.Log("[Voxario] realtime join: " + text);
                    }
                    break;
                case "presence_state":
                    foreach (var kv in payload ?? new Dictionary<string, object>()) Join(kv.Key, kv.Value);
                    break;
                case "presence_diff":
                    // nejdřív odchody, pak příchody (změna údajů = odchod + příchod se stejným klíčem)
                    var joins = MiniJson.Obj(payload != null && payload.TryGetValue("joins", out var jv) ? jv : null);
                    var leaves = MiniJson.Obj(payload != null && payload.TryGetValue("leaves", out var lv) ? lv : null);
                    if (leaves != null) foreach (var kv in leaves) if (joins == null || !joins.ContainsKey(kv.Key)) Leave(kv.Key);
                    if (joins != null) foreach (var kv in joins) Join(kv.Key, kv.Value);
                    break;
                case "broadcast":
                    if (MiniJson.S(payload, "event") == "chat") { Chat.Instance?.PollNow(); break; }
                    if (MiniJson.S(payload, "event") != "pos") break;
                    var p = MiniJson.Obj(payload.TryGetValue("payload", out var bp) ? bp : null);
                    string id = MiniJson.S(p, "uid");
                    if (id == null || id == uid || !others.TryGetValue(id, out var o)) break;
                    double x = MiniJson.N(p, "x", double.NaN), z = MiniJson.N(p, "z", double.NaN), ry = MiniJson.N(p, "ry", 0);
                    if (double.IsNaN(x) || double.IsNaN(z) || Math.Abs(x) > 200 || Math.Abs(z) > 200) break;
                    o.target = new Vector2((float)x, (float)z);
                    o.vel = new Vector2((float)MiniJson.N(p, "vx", 0), (float)MiniJson.N(p, "vz", 0));
                    if (o.vel.sqrMagnitude > 200) o.vel = Vector2.zero;
                    o.stamp = Time.unscaledTime;
                    o.ry = (float)ry;
                    if (!o.hasPos) { o.pos = o.target; o.hasPos = true; o.view.gameObject.SetActive(true); }
                    break;
            }
        }

        void Join(string key, object value)
        {
            if (key == uid) return;
            var metas = MiniJson.Obj(value);
            var list = metas != null && metas.TryGetValue("metas", out var m) ? m as List<object> : null;
            var meta = list != null && list.Count > 0 ? MiniJson.Obj(list[0]) : null;
            string name = MiniJson.S(meta, "name");
            if (string.IsNullOrEmpty(name)) return;
            if (name.Length > 24) name = name.Substring(0, 24);
            string cls = MiniJson.S(meta, "cls");
            if (cls != "hoplit" && cls != "lucistnik" && cls != "vestec") cls = "hoplit";
            string gender = MiniJson.S(MiniJson.Obj(meta.TryGetValue("appearance", out var ap) ? ap : null), "gender") == "f" ? "f" : "m";
            int level = (int)MiniJson.N(meta, "level", 1);
            string fac = MiniJson.S(meta, "faction") == "legie" ? "legie" : "kalidra";
            string sub = $"úroveň {level} · {(fac == "legie" ? "Legie" : "Kalidra")}";
            // druhá frakce: načervenalý podtitul, vlastní frakce: zlatavý
            var subColor = fac == myFaction ? new Color(0.92f, 0.80f, 0.52f, 1f) : new Color(0.95f, 0.45f, 0.38f, 1f);
            string tagStr = MiniJson.S(meta, "tag") ?? "";
            if (tagStr.Length > 5) tagStr = tagStr.Substring(0, 5);
            if (others.TryGetValue(key, out var o))
            {
                o.level = level;
                if (o.view != null)
                {
                    var nt = o.view.GetComponent<NameTag>();
                    nt.subtitle = sub;
                    nt.subtitleColor = subColor;
                    nt.title = TagName(tagStr, name);
                }
                return;
            }
            o = new Other { name = name, cls = cls, gender = gender, level = level };
            var parent = boot.WorldRoot;
            o.view = CharacterView.Create(boot.library.Hero($"{cls}_{gender}_lo") ?? boot.library.Hero($"{cls}_{gender}"), parent, gender == "f" ? 1.55f : 1.62f, "Hráč " + name);
            var tag = o.view.gameObject.AddComponent<NameTag>();
            tag.title = TagName(tagStr, name);
            tag.subtitle = sub;
            tag.subtitleColor = subColor;
            tag.isPlayer = true;
            double x = MiniJson.N(meta, "x", double.NaN), z = MiniJson.N(meta, "z", double.NaN);
            if (!double.IsNaN(x) && !double.IsNaN(z) && Math.Abs(x) < 200 && Math.Abs(z) < 200)
            {
                o.pos = o.target = new Vector2((float)x, (float)z);
                o.ry = (float)MiniJson.N(meta, "ry", 0);
                o.hasPos = true;
                o.view.transform.position = WorldMap.ToWorld(o.pos.x, o.pos.y);
            }
            else o.view.gameObject.SetActive(false);
            others[key] = o;
        }

        void Leave(string key)
        {
            if (!others.TryGetValue(key, out var o)) return;
            if (o.view != null) Destroy(o.view.gameObject);
            others.Remove(key);
        }
    }
}
