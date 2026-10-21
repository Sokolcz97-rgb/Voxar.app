using System.Collections;
using UnityEngine;
using UnityEngine.Rendering.HighDefinition;

namespace Voxario.Ashes
{
    /// <summary>
    /// Start hry: přihlášení, načtení postavy ze serveru, stavba světa, hráč a kamera.
    /// Jediný objekt ve scéně – vše ostatní vzniká za běhu.
    /// </summary>
    public class GameBootstrap : MonoBehaviour
    {
        public ModelLibrary library;

        public readonly SupabaseClient api = new SupabaseClient();
        public GameState state;
        public string status = "";
        public bool busy;
        public bool inWorld;
        public PlayerController player;
        public CameraRig rig;
        public Camera cam;
        Transform worldRoot;
        public Transform WorldRoot => worldRoot;
        string savePosKey;
        float savePosAt;

        void Update()
        {
            if (!inWorld || player == null || savePosKey == null || Time.unscaledTime < savePosAt) return;
            savePosAt = Time.unscaledTime + 2f;
            var p = WorldMap.ToWeb(player.transform.position);
            PlayerPrefs.SetString(savePosKey, p.x.ToString("0.0", System.Globalization.CultureInfo.InvariantCulture) + ";" + p.y.ToString("0.0", System.Globalization.CultureInfo.InvariantCulture));
        }

        void Awake()
        {
            Application.targetFrameRate = PlayerPrefs.GetInt("gfx.fpsCap", 0) > 0 ? PlayerPrefs.GetInt("gfx.fpsCap") : -1;
            QualitySettings.vSyncCount = PlayerPrefs.GetInt("gfx.vsync", 1);
            CrashReporter.CheckPrevious();
            SetupCameraAndLight();
            Atmosphere.Create();
            var guard = gameObject.AddComponent<WindowGuard>();
            guard.boot = this;
            var ui = gameObject.AddComponent<GameUI>();
            ui.boot = this;
            ui.guard = guard;
            gameObject.AddComponent<NpcDialog>().boot = this;
            gameObject.AddComponent<Minimap>().boot = this;
            gameObject.AddComponent<Encounters>().boot = this;
            gameObject.AddComponent<WorldPresence>().boot = this;
            gameObject.AddComponent<Music>().boot = this;
            gameObject.AddComponent<ModManager>().boot = this;
        }

        IEnumerator Start()
        {
            if (System.Array.IndexOf(System.Environment.GetCommandLineArgs(), "-voxario-selftest") >= 0)
            {
                yield return SelfTest();
                yield break;
            }
            busy = true;
            status = "Obnovuji přihlášení…";
            bool resumed = false;
            yield return api.Resume(ok => resumed = ok);
            busy = false;
            status = "";
            if (resumed) yield return LoadState();
        }

        void SetupCameraAndLight()
        {
            var camGo = new GameObject("Main Camera") { tag = "MainCamera" };
            cam = camGo.AddComponent<Camera>();
            cam.nearClipPlane = 0.2f;
            cam.farClipPlane = 900f;
            cam.fieldOfView = 55;
            camGo.AddComponent<HDAdditionalCameraData>();
            camGo.AddComponent<AudioListener>();
            camGo.transform.position = new Vector3(-52, 25, -30);
            camGo.transform.LookAt(new Vector3(0, 0, 0));
            Upscaling.Apply(cam);

            var sunGo = new GameObject("Sun");
            var sun = sunGo.AddComponent<Light>();
            sun.type = LightType.Directional;
            sunGo.AddComponent<HDAdditionalLightData>();
            // jednotka lux (vlastnost se mezi verzemi Unity přesouvala – nastavíme přes reflexi)
            var unitProp = typeof(Light).GetProperty("lightUnit");
            if (unitProp != null) unitProp.SetValue(sun, System.Enum.Parse(unitProp.PropertyType, "Lux"));
            sun.intensity = 70000f;
            sun.colorTemperature = 4300;
            sun.useColorTemperature = true;
            sun.shadows = LightShadows.Soft;
            sunGo.transform.rotation = Quaternion.Euler(28, -35, 0);
        }

        public void SignIn(string email, string password) => StartCoroutine(SignInRoutine(email, password));

        IEnumerator SignInRoutine(string email, string password)
        {
            busy = true;
            status = "Přihlašuji…";
            string err = null;
            yield return api.SignIn(email, password, e => err = e);
            busy = false;
            if (err != null) { status = err; yield break; }
            status = "";
            yield return LoadState();
        }

        void OnApplicationQuit() => Debug.Log("[Voxario] konec");

        IEnumerator LoadState()
        {
            StartCoroutine(CrashReporter.SendIfCrashed(api));
            busy = true;
            status = "Načítám postavu…";
            string json = null, err = null;
            yield return api.Rpc("ashes_state", "{}", (j, e) => { json = j; err = e; });
            busy = false;
            if (err != null) { status = err; yield break; }
            state = JsonUtility.FromJson<GameState>(json);
            if (state == null || !state.allowed) { status = "Brány Kalidry jsou zatím zavřené – hrát mohou jen testeři s povolením."; yield break; }
            if (state.character == null || string.IsNullOrEmpty(state.character.name))
            {
                status = "Nemáš ještě postavu – vytvoř si ji na studiovoxario.com/hra.";
                yield break;
            }
            status = "Stavím svět Kalidry…";
            busy = true;
            yield return null;
            yield return null;
            EnterWorld();
            busy = false;
            status = "";
        }

        void EnterWorld()
        {
            if (worldRoot != null) Destroy(worldRoot.gameObject);
            worldRoot = new GameObject("World").transform;
            var ch = state.character;
            string faction = string.IsNullOrEmpty(ch.faction) ? "kalidra" : ch.faction;
            WorldBuilder.Build(worldRoot, library, faction);
            Scenery.Build(worldRoot, PlayerPrefs.GetInt("gfx.quality", 2));
            GetComponent<Encounters>().Build(worldRoot, library, faction);

            string gender = ch.appearance != null && ch.appearance.gender == "f" ? "f" : "m";
            string cls = string.IsNullOrEmpty(ch.@class) ? "hoplit" : ch.@class;
            var playerGo = new GameObject("Player");
            playerGo.transform.SetParent(worldRoot, false);
            var cc = playerGo.AddComponent<CharacterController>();
            var view = CharacterView.Create(library.Hero($"{cls}_{gender}"), playerGo.transform, gender == "f" ? 1.55f : 1.62f, "Model");
            view.transform.localPosition = Vector3.zero;
            player = playerGo.AddComponent<PlayerController>();
            player.view = view;
            var tag = playerGo.AddComponent<NameTag>();
            tag.title = string.IsNullOrEmpty(ch.display_name) ? ch.name : ch.display_name;
            tag.isPlayer = true;
            var spawn = faction == "legie" ? WorldMap.SpawnLegie : WorldMap.SpawnKalidra;
            // pokračovat tam, kde hráč skončil (uloženo v tomto počítači)
            string posKey = $"ashes.pos.{ch.name}.{faction}";
            if (PlayerPrefs.HasKey(posKey))
            {
                var parts = PlayerPrefs.GetString(posKey).Split(';');
                if (parts.Length == 2 && float.TryParse(parts[0], System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var sx)
                    && float.TryParse(parts[1], System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var sz)
                    && Mathf.Abs(sx) < 130 && Mathf.Abs(sz) < 130 && WorldMap.HeightAt(sx, sz) > 0.4f)
                    spawn = new Vector2(sx, sz);
            }
            savePosKey = posKey;
            player.Respawn(spawn);

            var rigGo = new GameObject("CameraRig");
            rigGo.transform.SetParent(worldRoot, false);
            rig = rigGo.AddComponent<CameraRig>();
            rig.target = playerGo.transform;
            rig.cam = cam;
            player.cameraPivot = rigGo.transform;
            inWorld = true;
            Atmosphere.ApplyQuality(PlayerPrefs.GetInt("gfx.quality", 2));
            ModManager.Fire("enter_world");
        }

        /// <summary>
        /// Samotest pro CI (bez přihlášení): postaví svět s ukázkovou postavou, vyfotí
        /// několik pohledů do složky "selftest" vedle hry a ukončí se.
        /// </summary>
        IEnumerator SelfTest()
        {
            string dir = System.IO.Path.Combine(System.IO.Path.GetDirectoryName(Application.dataPath), "selftest");
            System.IO.Directory.CreateDirectory(dir);
            Debug.Log($"[Voxario] SELFTEST gfx={SystemInfo.graphicsDeviceType} {SystemInfo.graphicsDeviceName} hdrp={UnityEngine.Rendering.GraphicsSettings.currentRenderPipeline}");
            // přihlašovací obrazovka
            yield return new WaitForSeconds(1.5f);
            ScreenCapture.CaptureScreenshot(System.IO.Path.Combine(dir, "0-prihlaseni.png"));
            yield return new WaitForSeconds(0.5f);
            state = new GameState
            {
                allowed = true,
                character = new Character { name = "Tester", display_name = "Tester", @class = "hoplit", faction = "kalidra", level = 3, xp = 140, xp_need = 300, gold = 172, honor = 12, appearance = new Appearance { gender = "m" } },
                wquests = new[] { new WQuest { quest_id = "k1", state = "done" }, new WQuest { quest_id = "k2", state = "active", progress = 1 }, new WQuest { quest_id = "k3", state = "ready" } },
            };
            EnterWorld();
            yield return new WaitForSeconds(4f);
            Report();
            ScreenCapture.CaptureScreenshot(System.IO.Path.Combine(dir, "1-hrac.png"));
            yield return new WaitForSeconds(1.5f);
            rig.enabled = false;
            var views = new (string name, Vector3 pos, Vector3 look)[]
            {
                ("2-mesto", WorldMap.ToWorld(40, 15) + new Vector3(0, 18, 0), WorldMap.ToWorld(74, 15)),
                ("3-prehled", new Vector3(0, 140, 60), new Vector3(0, 0, -10)),
                ("4-nikias", WorldMap.ToWorld(-46, 44) + new Vector3(0, 2.5f, 0), WorldMap.ToWorld(-50, 44) + Vector3.up),
                ("7-krajina", WorldMap.ToWorld(-40, 30) + new Vector3(0, 9, 0), WorldMap.ToWorld(-20, 0) + Vector3.up * 3),
                ("8-akvadukt", WorldMap.ToWorld(-30, 12) + new Vector3(0, 5, 0), WorldMap.ToWorld(-45, 13) + Vector3.up * 4),
                ("9-zatoka", WorldMap.ToWorld(-50, -60) + new Vector3(0, 14, 0), WorldMap.ToWorld(-68, -78)),
            };
            foreach (var v in views)
            {
                cam.transform.position = v.pos;
                cam.transform.LookAt(v.look);
                yield return new WaitForSeconds(2f);
                ScreenCapture.CaptureScreenshot(System.IO.Path.Combine(dir, v.name + ".png"));
                yield return new WaitForSeconds(1f);
            }
            // rozhovor s Nikiasem a velká mapa
            rig.enabled = true;
            player.Respawn(new Vector2(-50.5f, 46.5f));
            yield return new WaitForSeconds(1.5f);
            var dialog = GetComponent<NpcDialog>();
            dialog.testMode = true;
            dialog.TestOpen("nikias");
            yield return new WaitForSeconds(1.5f);
            ScreenCapture.CaptureScreenshot(System.IO.Path.Combine(dir, "5-rozhovor.png"));
            yield return new WaitForSeconds(1f);
            dialog.Close();
            // chůze: postava jde dopředu (animace nohou)
            player.view.speed = 4.2f;
            player.enabled = false;
            for (float t = 0; t < 1.2f; t += Time.deltaTime) { player.transform.position += player.transform.forward * 3f * Time.deltaTime; yield return null; }
            ScreenCapture.CaptureScreenshot(System.IO.Path.Combine(dir, "6-chuze.png"));
            yield return new WaitForSeconds(1f);
            // nastavení (záložka Zobrazení)
            player.enabled = true;
            var ui = GetComponent<GameUI>();
            ui.TestOpenSettings(1);
            yield return new WaitForSeconds(1f);
            ScreenCapture.CaptureScreenshot(System.IO.Path.Combine(dir, "10-nastaveni.png"));
            yield return new WaitForSeconds(0.5f);
            ui.TestOpenSettings(4);
            yield return new WaitForSeconds(1f);
            ScreenCapture.CaptureScreenshot(System.IO.Path.Combine(dir, "11-mody.png"));
            yield return new WaitForSeconds(0.5f);
            Debug.Log("[Voxario] SELFTEST hotovo");
            Application.Quit(0);
        }

        void Report()
        {
            var p = player.transform.position;
            Debug.Log($"[Voxario] hráč {p} zem {WorldMap.HeightAt(p.x, -p.z):0.00} kamera {cam.transform.position}");
            int n = 0;
            foreach (var r in FindObjectsByType<Renderer>(FindObjectsSortMode.None))
            {
                if (++n > 50) break;
                var m = r.sharedMaterial;
                Debug.Log($"[Voxario] R {r.GetType().Name} {r.name} enabled={r.enabled} visible={r.isVisible} bounds={r.bounds.center}/{r.bounds.size} mat={(m ? m.name : "null")} shader={(m && m.shader ? m.shader.name : "null")} supported={(m && m.shader ? m.shader.isSupported : false)} passes={(m ? m.passCount : 0)}");
            }
            foreach (var t in FindObjectsByType<Terrain>(FindObjectsSortMode.None))
            {
                var m = t.materialTemplate;
                Debug.Log($"[Voxario] TERRAIN pos={t.transform.position} size={t.terrainData.size} mat={(m ? m.name : "null")} shader={(m && m.shader ? m.shader.name : "null")} supported={(m && m.shader ? m.shader.isSupported : false)} h(-52,50)={t.SampleHeight(WorldMap.ToWorld(-52, 50)) + t.transform.position.y:0.00}");
            }
        }

        /// <summary>Mód nahradil model hráče vlastním GLB (šablona je neaktivní).</summary>
        public void ReplacePlayerModel(GameObject template, float height)
        {
            if (player == null) return;
            var old = player.view;
            var view = CharacterView.Create(template, player.transform, height, "Model (mód)");
            view.transform.localPosition = Vector3.zero;
            foreach (var t in view.GetComponentsInChildren<Transform>(true)) t.gameObject.SetActive(true);
            player.view = view;
            if (old != null) Destroy(old.gameObject);
        }

        public void SignOut()
        {
            GetComponent<WorldPresence>()?.Disconnect();
            api.SignOut();
            state = null;
            inWorld = false;
            if (worldRoot != null) Destroy(worldRoot.gameObject);
        }
    }
}
