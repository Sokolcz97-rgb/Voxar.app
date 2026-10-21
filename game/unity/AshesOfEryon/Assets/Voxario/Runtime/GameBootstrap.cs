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

        void Awake()
        {
            Application.targetFrameRate = PlayerPrefs.GetInt("gfx.fpsCap", 0) > 0 ? PlayerPrefs.GetInt("gfx.fpsCap") : -1;
            QualitySettings.vSyncCount = PlayerPrefs.GetInt("gfx.vsync", 1);
            SetupCameraAndLight();
            gameObject.AddComponent<GameUI>().boot = this;
        }

        IEnumerator Start()
        {
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

        IEnumerator LoadState()
        {
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
            status = "";
            EnterWorld();
        }

        void EnterWorld()
        {
            if (worldRoot != null) Destroy(worldRoot.gameObject);
            worldRoot = new GameObject("World").transform;
            var ch = state.character;
            string faction = string.IsNullOrEmpty(ch.faction) ? "kalidra" : ch.faction;
            WorldBuilder.Build(worldRoot, library, faction);

            string gender = ch.appearance != null && ch.appearance.gender == "f" ? "f" : "m";
            string cls = string.IsNullOrEmpty(ch.@class) ? "hoplit" : ch.@class;
            var playerGo = new GameObject("Player");
            playerGo.transform.SetParent(worldRoot, false);
            var cc = playerGo.AddComponent<CharacterController>();
            var view = CharacterView.Create(library.Hero($"{cls}_{gender}"), playerGo.transform, gender == "f" ? 1.55f : 1.62f, "Model");
            view.transform.localPosition = Vector3.zero;
            player = playerGo.AddComponent<PlayerController>();
            player.view = view;
            var spawn = faction == "legie" ? WorldMap.SpawnLegie : WorldMap.SpawnKalidra;
            player.Respawn(spawn);

            var rigGo = new GameObject("CameraRig");
            rigGo.transform.SetParent(worldRoot, false);
            rig = rigGo.AddComponent<CameraRig>();
            rig.target = playerGo.transform;
            rig.cam = cam;
            player.cameraPivot = rigGo.transform;
            inWorld = true;
        }

        public void SignOut()
        {
            api.SignOut();
            state = null;
            inWorld = false;
            if (worldRoot != null) Destroy(worldRoot.gameObject);
        }
    }
}
