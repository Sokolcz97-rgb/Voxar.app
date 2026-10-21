import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { SEO } from "@/components/SEO";
import logo from "./voxario-studio-icon.png";
import {
  DEFAULT_ENV,
  PRESET_MATERIALS,
  PRESET_MODELS,
  StudioEngine,
  type EnvSettings,
  type MaterialSnap,
  type ObjType,
  type PresetModel,
  type SceneEntry,
  type Stats,
  type Tool,
  type TransformSnap,
  type ViewMode,
} from "./studioEngine";

/* ------------------------------------------------------------------ vzhled (ImGui tmavý + fialová Voxario) */
const CSS = `
.vsd{--bg:#141319;--panel:#1c1b23;--panel2:#23222c;--line:#2f2d3b;--text:#dcdae6;--mute:#8f8ca3;--acc:#7c5cff;--acc2:#a48bff;--good:#5fd38d;--bad:#ff6b7d;
  position:fixed;inset:0;display:flex;flex-direction:column;background:var(--bg);color:var(--text);font:13px/1.35 Inter,system-ui,-apple-system,"Segoe UI",sans-serif;user-select:none;overflow:hidden}
.vsd *{box-sizing:border-box}
.vsd button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}
.vsd input,.vsd select{font:inherit;color:var(--text);background:#121118;border:1px solid var(--line);border-radius:3px;padding:3px 6px;min-width:0}
.vsd input:focus,.vsd select:focus{outline:1px solid var(--acc);border-color:var(--acc)}
.vsd .demo{display:flex;align-items:center;gap:10px;padding:5px 12px;background:linear-gradient(90deg,#3a2a8a,#5a3fd6 60%,#3a2a8a);font-size:12px;flex-wrap:wrap}
.vsd .demo b{letter-spacing:.08em}
.vsd .demo a{margin-left:auto;background:#fff;color:#2b1d73;font-weight:700;padding:3px 10px;border-radius:3px;text-decoration:none;white-space:nowrap}
.vsd .menubar{display:flex;align-items:center;height:28px;background:var(--panel2);border-bottom:1px solid var(--line);padding:0 6px;gap:2px;position:relative;z-index:30}
.vsd .menubar>.m{position:relative}
.vsd .menubar>.m>button{padding:4px 9px;border-radius:3px}
.vsd .menubar>.m>button:hover,.vsd .menubar>.m.open>button{background:#34314a}
.vsd .dd{position:absolute;top:100%;left:0;min-width:250px;background:#211f2b;border:1px solid #3a374b;border-radius:4px;padding:4px;box-shadow:0 10px 30px #0008}
.vsd .dd button{display:flex;width:100%;justify-content:space-between;gap:18px;padding:5px 10px;border-radius:3px;text-align:left}
.vsd .dd button:hover:not(:disabled){background:var(--acc)}
.vsd .dd button:disabled{opacity:.4;cursor:default}
.vsd .dd hr{border:0;border-top:1px solid var(--line);margin:4px 2px}
.vsd .dd kbd,.vsd .k{color:var(--mute);font:11px ui-monospace,monospace}
.vsd .title{margin-left:auto;color:var(--mute);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vsd .toolbar{display:flex;align-items:center;gap:4px;height:34px;padding:0 8px;background:var(--panel);border-bottom:1px solid var(--line);overflow-x:auto}
.vsd .tb{flex-shrink:0;height:26px;min-width:26px;padding:0 8px;border-radius:3px;background:#2a2836;display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.vsd .tb:hover{background:#383450}.vsd .tb.on{background:var(--acc);color:#fff}
.vsd .sep{width:1px;height:20px;background:var(--line);margin:0 4px}
.vsd .main{flex:1;display:grid;grid-template-columns:var(--lw,240px) 1fr var(--rw,310px);grid-template-rows:1fr var(--bh,210px);min-height:0}
.vsd .pnl{background:var(--panel);border-right:1px solid var(--line);border-bottom:1px solid var(--line);display:flex;flex-direction:column;min-height:0;min-width:0}
.vsd .ph{display:flex;align-items:center;gap:6px;height:26px;padding:0 8px;background:var(--panel2);border-bottom:1px solid var(--line);font-weight:600;font-size:12px;flex-shrink:0}
.vsd .ph .tab{padding:0 8px;height:100%;display:flex;align-items:center;color:var(--mute);border-top:2px solid transparent}
.vsd .ph .tab.on{color:var(--text);border-top-color:var(--acc);background:var(--panel)}
.vsd .pb{flex:1;overflow:auto;padding:6px;min-height:0}
.vsd .row{display:flex;align-items:center;gap:6px;padding:3px 6px;border-radius:3px;cursor:pointer;white-space:nowrap}
.vsd .row:hover{background:#2a2838}.vsd .row.sel{background:#3d3270}
.vsd .row .nm{flex:1;overflow:hidden;text-overflow:ellipsis}
.vsd .eye{opacity:.55;font-size:12px;width:18px}.vsd .eye:hover{opacity:1}
.vsd .vp{position:relative;min-width:0;min-height:0;background:#000;border-bottom:1px solid var(--line)}
.vsd .vp .host{position:absolute;inset:0}
.vsd .vp .ov{position:absolute;left:8px;top:8px;display:flex;gap:4px;flex-wrap:wrap;z-index:2}
.vsd .vp .ov select{background:#1c1b23e6}
.vsd .vp .hint{position:absolute;left:8px;bottom:8px;right:8px;color:#fffb;font-size:11px;text-shadow:0 1px 2px #000;pointer-events:none}
.vsd .vp .drop{position:absolute;inset:10px;border:2px dashed var(--acc2);background:#7c5cff22;display:grid;place-items:center;font-size:16px;z-index:3;pointer-events:none;border-radius:6px}
.vsd .sec{border:1px solid var(--line);border-radius:4px;margin-bottom:8px;background:#191820}
.vsd .sec>.sh{padding:5px 8px;font-weight:600;background:#25232f;border-bottom:1px solid var(--line);border-radius:4px 4px 0 0;display:flex;justify-content:space-between}
.vsd .sec>.sb{padding:8px;display:grid;gap:7px}
.vsd .f{display:grid;grid-template-columns:92px 1fr;align-items:center;gap:6px}
.vsd .f>label{color:var(--mute);font-size:12px}
.vsd .xyz{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}
.vsd .xyz>div{position:relative}.vsd .xyz>div>i{position:absolute;left:0;top:0;bottom:0;width:3px;border-radius:3px 0 0 3px}
.vsd .xyz input{width:100%;padding-left:7px;text-align:right}
.vsd input[type=range]{accent-color:var(--acc);padding:0;border:0;background:none}
.vsd input[type=color]{padding:0 2px;height:24px;width:100%}
.vsd .btn{background:#2d2a3c;border-radius:3px;padding:5px 10px}.vsd .btn:hover{background:#3b3752}
.vsd .btn.pri{background:var(--acc);color:#fff}.vsd .btn.pri:hover{background:#8f74ff}
.vsd .btn.dan:hover{background:#7a2433}
.vsd .mute{color:var(--mute)}
.vsd .assets{display:flex;flex-direction:column;height:100%}
.vsd .crumbs{display:flex;gap:6px;align-items:center;padding:4px 6px;border-bottom:1px solid var(--line);flex-wrap:wrap}
.vsd .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(86px,1fr));gap:6px;padding:8px;overflow:auto;flex:1;align-content:start}
.vsd .tile{display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px 4px;border-radius:4px;cursor:pointer;text-align:center}
.vsd .tile:hover{background:#2a2838}.vsd .tile.sel{background:#3d3270}
.vsd .tile .ic{width:54px;height:54px;border-radius:6px;display:grid;place-items:center;font-size:24px;background:#26243a}
.vsd .tile span{font-size:11px;word-break:break-word;line-height:1.2}
.vsd .stats{display:grid;grid-template-columns:auto 1fr;gap:3px 14px;font:12px ui-monospace,monospace}
.vsd .stats b{color:var(--acc2);font-weight:600}
.vsd .bar{height:6px;background:#2a2838;border-radius:3px;overflow:hidden}.vsd .bar>i{display:block;height:100%;background:linear-gradient(90deg,var(--good),var(--acc))}
.vsd .modal{position:fixed;inset:0;background:#0009;display:grid;place-items:center;z-index:50;padding:16px}
.vsd .dlg{width:min(520px,100%);background:#1f1d29;border:1px solid #3a374b;border-radius:6px;box-shadow:0 20px 60px #000a;max-height:90vh;display:flex;flex-direction:column}
.vsd .dlg>.dh{padding:10px 14px;font-weight:700;border-bottom:1px solid var(--line);display:flex;justify-content:space-between}
.vsd .dlg>.dbody{padding:14px;display:grid;gap:10px;overflow:auto}
.vsd .dlg>.df{padding:10px 14px;border-top:1px solid var(--line);display:flex;justify-content:flex-end;gap:8px}
.vsd .err{color:var(--bad);font-size:12px}
.vsd .mobtabs{display:none}
.vsd .hint.touch{display:none}
@media (pointer:coarse){.vsd .hint.touch{display:block}.vsd .hint.mouse{display:none}}
/* úvodní obrazovka (Hub) */
.vsd .hub{flex:1;overflow:auto;display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:28px;padding:40px clamp(16px,5vw,72px);background:radial-gradient(1200px 600px at 10% 0%,#3a2a8a55,transparent),radial-gradient(900px 500px at 100% 100%,#5a3fd633,transparent)}
.vsd .hub h1{font-size:clamp(26px,4vw,40px);margin:14px 0 6px;font-weight:800;letter-spacing:-.01em}
.vsd .hub .big{display:flex;align-items:center;gap:12px;width:100%;padding:14px 16px;border-radius:6px;background:#211f2bcc;border:1px solid #34314a;text-align:left;margin-bottom:10px}
.vsd .hub .big:hover:not(:disabled){border-color:var(--acc);background:#2a2640}
.vsd .hub .big:disabled{opacity:.45;cursor:default}
.vsd .hub .big .ic{font-size:22px;width:38px;height:38px;display:grid;place-items:center;border-radius:6px;background:#2f2a4f;flex-shrink:0}
.vsd .hub .big small{display:block;color:var(--mute);font-size:12px}
.vsd .hub .card{background:#1c1b23cc;border:1px solid #2f2d3b;border-radius:8px;padding:14px}
.vsd .hub .feat{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}
.vsd .hub .feat div{background:#191820;border:1px solid var(--line);border-radius:6px;padding:10px;font-size:12px}
.vsd .hub .feat b{display:block;color:var(--acc2);margin-bottom:2px}
@media (max-width:900px){
  .vsd .main{grid-template-columns:1fr;grid-template-rows:minmax(260px,52vh) 1fr}
  .vsd .main>.side{display:none}.vsd .main>.side.mob{display:flex;grid-row:2}
  .vsd .main>.vp{grid-row:1}
  .vsd .mobtabs{display:flex;overflow-x:auto;background:var(--panel2);border-bottom:1px solid var(--line)}
  .vsd .mobtabs button{padding:7px 12px;white-space:nowrap;color:var(--mute);border-bottom:2px solid transparent}
  .vsd .mobtabs button.on{color:var(--text);border-bottom-color:var(--acc)}
  .vsd .hub{grid-template-columns:1fr;padding:24px 16px}
  .vsd .title,.vsd .demo span.long{display:none}
}
`;

/* ------------------------------------------------------------------ Prohlížeč assetů (virtuální projekt) */
type AssetKind = "folder" | "model" | "material" | "texture" | "scene" | "upload";
type Asset = { name: string; kind: AssetKind; preset?: PresetModel; file?: File; user?: boolean };
type Tree = Record<string, Asset[]>;

const INITIAL_TREE: Tree = {
  Assets: [
    { name: "Models", kind: "folder" },
    { name: "Materials", kind: "folder" },
    { name: "Textures", kind: "folder" },
    { name: "Scenes", kind: "folder" },
  ],
  "Assets/Models": PRESET_MODELS.map((p) => ({ name: `${p}.glb`, kind: "model" as const, preset: p })),
  "Assets/Materials": Object.keys(PRESET_MATERIALS).map((m) => ({ name: `${m}.vmat`, kind: "material" as const })),
  "Assets/Textures": ["tráva_albedo.png", "kámen_normal.png", "dřevo_roughness.png", "obloha.hdr"].map((n) => ({ name: n, kind: "texture" as const })),
  "Assets/Scenes": [{ name: "Úvodní scéna.vscene", kind: "scene" }],
};

const ICON: Record<AssetKind, string> = { folder: "📁", model: "🧊", material: "🎨", texture: "🖼️", scene: "🎬", upload: "📦" };
const TYPE_ICON: Record<ObjType, string> = { cube: "◼", sphere: "●", plane: "▭", cylinder: "▮", model: "🧊" };
const VIEW_LABEL: Record<ViewMode, string> = {
  final: "Výsledný obraz",
  albedo: "G-Buffer: Albedo",
  normals: "G-Buffer: Normály",
  wire: "Drátový model",
};
const TOOL_KEYS: [Tool, string, string][] = [
  ["select", "Q", "Výběr"],
  ["translate", "W", "Posun"],
  ["rotate", "E", "Rotace"],
  ["scale", "R", "Měřítko"],
];
const RECENT = [
  { name: "MyFirstProject", tpl: "pbr" as const, path: "Dokumenty/Voxario Projects/MyFirstProject", when: "právě teď" },
  { name: "Prázdný projekt", tpl: "empty" as const, path: "Dokumenty/Voxario Projects/Prazdny", when: "včera" },
];
const BAD_NAME = /[\\/:*?"<>|]/;
const SHOP_LINK = "/obchod?tab=software";

/* ------------------------------------------------------------------ malé ovládací prvky */
function Num({ value, onChange, step = 0.1 }: { value: number; onChange: (v: number) => void; step?: number }) {
  const [text, setText] = useState(String(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(String(value));
  }, [value]);
  const commit = () => {
    const v = Number(text.replace(",", "."));
    if (Number.isFinite(v)) onChange(v);
    else setText(String(value));
  };
  return (
    <input
      inputMode="decimal"
      value={text}
      onFocus={() => (focused.current = true)}
      onBlur={() => {
        focused.current = false;
        commit();
      }}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          const v = Math.round((value + (e.key === "ArrowUp" ? step : -step)) * 1000) / 1000;
          onChange(v);
          setText(String(v));
        }
      }}
    />
  );
}

function Vec3({ v, onChange, step }: { v: [number, number, number]; onChange: (v: [number, number, number]) => void; step?: number }) {
  const colors = ["#e0525e", "#5fbf6a", "#4f8de0"];
  return (
    <div className="xyz">
      {v.map((n, i) => (
        <div key={i}>
          <i style={{ background: colors[i] }} />
          <Num
            value={n}
            step={step}
            onChange={(x) => {
              const next = [...v] as [number, number, number];
              next[i] = x;
              onChange(next);
            }}
          />
        </div>
      ))}
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange, fmt }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt?: (v: number) => string }) {
  return (
    <div className="f">
      <label>{label}</label>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ flex: 1 }} />
        <span className="k" style={{ width: 42, textAlign: "right" }}>{fmt ? fmt(value) : value}</span>
      </div>
    </div>
  );
}

function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="sec">
      <div className="sh">
        <span>{title}</span>
        {right}
      </div>
      <div className="sb">{children}</div>
    </div>
  );
}

function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="modal" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dlg" role="dialog" aria-label={title}>
        <div className="dh">
          <span>{title}</span>
          <button onClick={onClose} aria-label="Zavřít">✕</button>
        </div>
        <div className="dbody">{children}</div>
        {footer && <div className="df">{footer}</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ stránka */
export default function StudioDemo() {
  const [screen, setScreen] = useState<"hub" | "editor">("hub");
  const [projectName, setProjectName] = useState("MyFirstProject");
  const [pendingTemplate, setPendingTemplate] = useState<"empty" | "pbr" | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [dialog, setDialog] = useState<null | "new" | "settings" | "controls" | "about" | "projectSettings">(null);
  const [newName, setNewName] = useState("MujProjekt");
  const [newTpl, setNewTpl] = useState<"empty" | "pbr">("pbr");
  const [newErr, setNewErr] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const startProject = (name: string, tpl: "empty" | "pbr", file?: File | null) => {
    setProjectName(name);
    setPendingTemplate(tpl);
    setPendingFile(file ?? null);
    setScreen("editor");
    setDialog(null);
  };

  const createNew = () => {
    const n = newName.trim();
    if (!n) return setNewErr("Zadej název projektu.");
    if (BAD_NAME.test(n)) return setNewErr('Název obsahuje nepovolené znaky: \\ / : * ? " < > |');
    if (RECENT.some((r) => r.name.toLowerCase() === n.toLowerCase())) return setNewErr("Projekt s tímto názvem v tomto umístění už existuje.");
    startProject(n, newTpl);
  };

  const onHubFile = (f: File | undefined) => {
    if (!f) return;
    if (!/\.(glb|gltf)$/i.test(f.name)) {
      toast.error(`V demu umím načíst jen .glb. Plná verze otevře i .fbx, .obj, .stl, .bbmodel a .blend.`);
      return;
    }
    startProject(f.name.replace(/\.[^.]+$/, ""), "empty", f);
  };

  return (
    <div className="vsd">
      <style>{CSS}</style>
      <SEO
        title="Voxario Studio – živé demo"
        description="Vyzkoušej si Voxario Studio Engine přímo v prohlížeči: scéna, hierarchie, inspektor, materiály, světlo a prohlížeč assetů."
      />
      <div className="demo">
        <b>ŽIVÉ DEMO</b>
        <span className="long">Náhled Voxario Studia v prohlížeči (WebGL). Plná verze: Vulkan, deferred PBR, DLSS, import .fbx / .blend / .bbmodel a ukládání projektů.</span>
        <Link to={SHOP_LINK}>Získat plnou verzi</Link>
      </div>

      {screen === "hub" ? (
        <div
          className="hub"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            onHubFile(e.dataTransfer.files[0]);
          }}
        >
          <div>
            <img src={logo} alt="" width={64} height={64} style={{ borderRadius: 14 }} />
            <h1>Vítej ve Voxario Studiu</h1>
            <p className="mute" style={{ marginBottom: 20, fontSize: 14 }}>Vytvoř nový projekt, otevři existující nebo začni z 3D modelu.</p>
            <button className="big" onClick={() => { setNewErr(null); setDialog("new"); }}>
              <span className="ic">＋</span>
              <span>Nový projekt<small>Prázdný projekt nebo ukázková PBR scéna</small></span>
            </button>
            <button className="big" onClick={() => toast.info("Otevírání projektů z disku je jen v plné verzi.")}>
              <span className="ic">📂</span>
              <span>Otevřít projekt…<small>Otevřít soubor .vproject z disku (plná verze)</small></span>
            </button>
            <button className="big" onClick={() => fileInput.current?.click()}>
              <span className="ic">🧊</span>
              <span>Nahrát model<small>.glb → nový projekt (v demu jen .glb, zůstává v tvém prohlížeči)</small></span>
            </button>
            <input ref={fileInput} type="file" accept=".glb,.gltf" hidden onChange={(e) => onHubFile(e.target.files?.[0])} />
            <div className="feat">
              <div><b>Vulkan renderer</b>Deferred PBR, stíny, globální osvětlení</div>
              <div><b>DLSS</b>Na kartách NVIDIA RTX</div>
              <div><b>Import modelů</b>.glb .fbx .obj .stl .bbmodel .blend</div>
              <div><b>Modulární engine</b>C++20, Windows i Linux</div>
            </div>
          </div>
          <div>
            <div className="card">
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Nedávné projekty</div>
              {RECENT.map((r) => (
                <button key={r.name} className="big" style={{ marginBottom: 6 }} onClick={() => startProject(r.name, r.tpl)}>
                  <span className="ic">🎬</span>
                  <span style={{ flex: 1 }}>
                    {r.name}
                    <small>{r.path}</small>
                  </span>
                  <small className="mute">{r.when}</small>
                </button>
              ))}
              <p className="mute" style={{ fontSize: 12, marginTop: 6 }}>Projekt otevřeš kliknutím. Model můžeš také přetáhnout kamkoli do okna.</p>
            </div>
            <div className="card" style={{ marginTop: 14 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Ovládání Viewportu</div>
              <ControlsList />
            </div>
          </div>
        </div>
      ) : (
        <Editor
          projectName={projectName}
          template={pendingTemplate}
          file={pendingFile}
          consumed={() => {
            setPendingTemplate(null);
            setPendingFile(null);
          }}
          onClose={() => setScreen("hub")}
          openDialog={setDialog}
        />
      )}

      {dialog === "new" && (
        <Modal
          title="Nový projekt"
          onClose={() => setDialog(null)}
          footer={
            <>
              <button className="btn" onClick={() => setDialog(null)}>Zrušit</button>
              <button className="btn pri" onClick={createNew}>Vytvořit</button>
            </>
          }
        >
          <div className="f"><label>Název projektu</label><input autoFocus value={newName} onChange={(e) => { setNewName(e.target.value); setNewErr(null); }} onKeyDown={(e) => e.key === "Enter" && createNew()} /></div>
          <div className="f">
            <label>Šablona</label>
            <select value={newTpl} onChange={(e) => setNewTpl(e.target.value as "empty" | "pbr")}>
              <option value="empty">Prázdná scéna (podlaha + slunce)</option>
              <option value="pbr">Ukázková scéna (ukázka PBR materiálů)</option>
            </select>
          </div>
          <div className="f"><label>Umístění</label><input disabled value="Dokumenty/Voxario Projects" /></div>
          {newErr && <div className="err">{newErr}</div>}
        </Modal>
      )}
      {dialog === "projectSettings" && (
        <Modal title="Nastavení projektu" onClose={() => setDialog(null)} footer={<button className="btn pri" onClick={() => setDialog(null)}>Zavřít</button>}>
          <div className="f"><label>Název projektu</label><input disabled value={projectName} /></div>
          <div className="f"><label>Složka projektu</label><input disabled value={`Dokumenty/Voxario Projects/${projectName}`} /></div>
          <div className="f"><label>Úvodní scéna</label><input disabled value="Scenes/Úvodní scéna.vscene" /></div>
          <p className="mute" style={{ fontSize: 12 }}>V plné verzi se nastavení ukládá do souboru .vproject. Některé změny se projeví po restartu Voxario Studia.</p>
        </Modal>
      )}
      {dialog === "controls" && (
        <Modal title="Ovládání Viewportu" onClose={() => setDialog(null)}>
          <ControlsList />
        </Modal>
      )}
      {dialog === "about" && (
        <Modal title="O Voxario Studiu" onClose={() => setDialog(null)} footer={<Link className="btn pri" to={SHOP_LINK}>Získat plnou verzi</Link>}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <img src={logo} alt="" width={56} height={56} style={{ borderRadius: 12 }} />
            <div>
              <b style={{ fontSize: 16 }}>Voxario Studio 1.0.0</b>
              <div className="mute">Modulární engine v C++20 · Vulkan, deferred PBR, připraveno pro DLSS</div>
            </div>
          </div>
          <p className="mute">Tohle je webové demo: ukazuje rozhraní a práci se scénou, vykresluje se přes WebGL v prohlížeči. Plná verze běží nativně (Windows / Linux), ukládá projekty, importuje .fbx, .obj, .stl, .bbmodel a .blend (přes nainstalovaný Blender) a vyžaduje grafiku s Vulkan 1.1+.</p>
        </Modal>
      )}
    </div>
  );
}

function ControlsList() {
  const rows: [string, string][] = [
    ["Pravé tlačítko / Alt + levé", "otáčení kamery"],
    ["Prostřední tlačítko / Shift + pravé", "posun"],
    ["Kolečko myši", "přiblížení"],
    ["Levé tlačítko", "výběr objektu"],
    ["Q W E R", "výběr / posun / rotace / měřítko"],
    ["Ctrl (při tažení)", "přichytávání"],
    ["F", "zaostřit na výběr"],
    ["Delete / Ctrl+D", "smazat / duplikovat"],
    ["Dotyk", "1 prst otáčení, 2 prsty posun a přiblížení"],
  ];
  return (
    <div className="stats" style={{ fontFamily: "inherit", fontSize: 12 }}>
      {rows.map(([k, v]) => (
        <span key={k} style={{ display: "contents" }}>
          <b style={{ whiteSpace: "nowrap" }}>{k}</b>
          <span>{v}</span>
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ editor */
type Panel = "hierarchy" | "inspector" | "assets" | "stats" | "env";

function Editor({
  projectName,
  template,
  file,
  consumed,
  onClose,
  openDialog,
}: {
  projectName: string;
  template: "empty" | "pbr" | null;
  file: File | null;
  consumed: () => void;
  onClose: () => void;
  openDialog: (d: "settings" | "controls" | "about" | "projectSettings" | null) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const engineRef = useRef<StudioEngine | null>(null);
  const [list, setList] = useState<SceneEntry[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [tf, setTf] = useState<TransformSnap | null>(null);
  const [mat, setMat] = useState<MaterialSnap>(null);
  const [env, setEnvState] = useState<EnvSettings>(DEFAULT_ENV);
  const [stats, setStats] = useState<Stats | null>(null);
  const [tool, setToolState] = useState<Tool>("translate");
  const [view, setView] = useState<ViewMode>("final");
  const [menu, setMenu] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showEnv, setShowEnv] = useState(false);
  const [bottomTab, setBottomTab] = useState<"assets" | "stats">("assets");
  const [mob, setMob] = useState<Panel>("hierarchy");
  const [panels, setPanels] = useState({ hierarchy: true, inspector: true, bottom: true });
  const [uiScale, setUiScale] = useState(1);
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const on = () => setNarrow(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const [renderScale, setRenderScale] = useState(1);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tree, setTree] = useState<Tree>(INITIAL_TREE);
  const [cwd, setCwd] = useState("Assets");
  const [assetSel, setAssetSel] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const modelInput = useRef<HTMLInputElement>(null);
  const eng = () => engineRef.current;

  // engine
  useEffect(() => {
    if (!host.current) return;
    const e = new StudioEngine(host.current);
    engineRef.current = e;
    e.onScene = (l) => setList(l);
    e.onSelect = (id) => {
      setSel(id);
      setShowEnv(false);
      setMat(id ? e.getMaterial(id) : null);
    };
    e.onTransform = setTf;
    e.onStats = setStats;
    return () => {
      e.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const e = eng();
    if (!e) return;
    if (template) {
      e.loadTemplate(template);
      setEnvState(DEFAULT_ENV);
      setView("final");
      e.setViewMode("final");
      setDirty(false);
    }
    if (file) {
      e.loadFile(file)
        .then(() => {
          setTree((t) => ({ ...t, "Assets/Models": [...t["Assets/Models"], { name: file.name, kind: "upload", file, user: true }] }));
          e.focus(null);
          toast.success(`Model ${file.name} vložen do scény.`);
        })
        .catch(() => toast.error("Model se nepodařilo načíst (podporované: .glb bez komprese Draco/KTX2)."));
    }
    if (template || file) consumed();
  }, [template, file, consumed]);

  const setTool = useCallback((t: Tool) => {
    setToolState(t);
    eng()?.setTool(t);
  }, []);

  const addObj = (t: Exclude<ObjType, "model">) => {
    eng()?.add(t);
    setDirty(true);
    setMenu(null);
  };

  const importFile = async (f: File) => {
    if (!/\.(glb|gltf)$/i.test(f.name)) {
      if (/\.(png|jpe?g|hdr|wav|ogg)$/i.test(f.name)) {
        setTree((t) => ({ ...t, [cwd]: [...(t[cwd] ?? []), { name: f.name, kind: "texture", user: true }] }));
        toast.success(`${f.name} zkopírován do ${cwd}.`);
        return;
      }
      toast.error(`Nepodporovaný formát souboru v demu: ${f.name}. Plná verze: .fbx .obj .stl .bbmodel .blend.`);
      return;
    }
    try {
      await eng()?.loadFile(f);
      setTree((t) => ({ ...t, "Assets/Models": [...t["Assets/Models"], { name: f.name, kind: "upload", file: f, user: true }] }));
      setDirty(true);
      toast.success(`Model ${f.name} se zkopíroval do projektu a vložil do scény.`);
    } catch {
      toast.error("Model se nepodařilo načíst (podporované: .glb bez komprese Draco/KTX2).");
    }
  };

  const save = useCallback(() => {
    setDirty(false);
    toast.success("Scéna uložena (v demu jen naoko – ukládání na disk má plná verze).");
  }, []);

  const del = useCallback(() => {
    if (sel) {
      eng()?.remove(sel);
      setDirty(true);
    }
  }, [sel]);
  const dup = useCallback(() => {
    if (sel) {
      eng()?.duplicate(sel);
      setDirty(true);
    }
  }, [sel]);

  // klávesy
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "Control") eng()?.setSnap(e.type === "keydown");
      if (e.type !== "keydown" || t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA") return;
      const k = e.key.toLowerCase();
      if (e.ctrlKey || e.metaKey) {
        if (k === "s") { e.preventDefault(); save(); }
        if (k === "d") { e.preventDefault(); dup(); }
        return;
      }
      if (k === "q") setTool("select");
      else if (k === "w") setTool("translate");
      else if (k === "e") setTool("rotate");
      else if (k === "r") setTool("scale");
      else if (k === "f") eng()?.focus(sel);
      else if (k === "delete" || k === "backspace") del();
      else if (k === "escape") { eng()?.select(null); setMenu(null); }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, [sel, save, dup, del, setTool]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [menu]);

  const updateEnv = (p: Partial<EnvSettings>) => {
    const next = { ...env, ...p };
    setEnvState(next);
    eng()?.setEnv(next);
    setDirty(true);
  };

  const changeView = (v: ViewMode) => {
    setView(v);
    eng()?.setViewMode(v);
  };

  const selEntry = list.find((x) => x.id === sel) ?? null;

  /* ---------------- menu */
  const menus: { id: string; label: string; items: ({ label: string; key?: string; on?: () => void; disabled?: boolean } | "-")[] }[] = [
    {
      id: "file",
      label: "Soubor",
      items: [
        { label: "Nový projekt…", on: () => { onClose(); toast.info("Nový projekt vytvoříš na úvodní obrazovce."); } },
        { label: "Otevřít projekt…", disabled: true },
        "-",
        { label: "Uložit scénu", key: "Ctrl+S", on: save },
        { label: "Nahrát model…", on: () => modelInput.current?.click() },
        "-",
        { label: "Nastavení projektu…", on: () => openDialog("projectSettings") },
        { label: "Zavřít projekt (úvodní obrazovka)", on: onClose },
      ],
    },
    {
      id: "edit",
      label: "Úpravy",
      items: [
        { label: "Duplikovat", key: "Ctrl+D", on: dup, disabled: !sel },
        { label: "Smazat", key: "Del", on: del, disabled: !sel },
        { label: "Položit na zem", on: () => sel && eng()?.dropToGround(sel), disabled: !sel },
        "-",
        { label: "Nastavení…", on: () => setSettingsOpen(true) },
      ],
    },
    {
      id: "add",
      label: "Přidat",
      items: [
        { label: "Krychle", on: () => addObj("cube") },
        { label: "Koule", on: () => addObj("sphere") },
        { label: "Válec", on: () => addObj("cylinder") },
        { label: "Rovina", on: () => addObj("plane") },
        "-",
        { label: "Model z disku (.glb)…", on: () => modelInput.current?.click() },
      ],
    },
    {
      id: "view",
      label: "Zobrazení",
      items: [
        { label: `${panels.hierarchy ? "✓ " : "   "}Hierarchie`, on: () => setPanels((p) => ({ ...p, hierarchy: !p.hierarchy })) },
        { label: `${panels.inspector ? "✓ " : "   "}Inspektor`, on: () => setPanels((p) => ({ ...p, inspector: !p.inspector })) },
        { label: `${panels.bottom ? "✓ " : "   "}Prohlížeč assetů / Statistiky`, on: () => setPanels((p) => ({ ...p, bottom: !p.bottom })) },
        { label: `${env.grid ? "✓ " : "   "}Mřížka`, on: () => updateEnv({ grid: !env.grid }) },
        { label: "Obnovit rozložení", on: () => setPanels({ hierarchy: true, inspector: true, bottom: true }) },
        "-",
        ...(Object.keys(VIEW_LABEL) as ViewMode[]).map((v) => ({ label: `${view === v ? "● " : "   "}${VIEW_LABEL[v]}`, on: () => changeView(v) })),
        "-",
        { label: "Zaostřit na výběr", key: "F", on: () => eng()?.focus(sel) },
      ],
    },
    {
      id: "help",
      label: "Nápověda",
      items: [
        { label: "Ovládání Viewportu", on: () => openDialog("controls") },
        { label: "O Voxario Studiu", on: () => openDialog("about") },
      ],
    },
  ];

  /* ---------------- panely */
  const hierarchyBody = (
    <>
        <div className={`row ${showEnv ? "sel" : ""}`} onClick={() => { eng()?.select(null); setShowEnv(true); setMob("inspector"); }}>
          <span>☀</span>
          <span className="nm">Prostředí scény</span>
        </div>
        <div className="mute" style={{ fontSize: 11, padding: "6px 6px 2px" }}>{projectName} · Úvodní scéna</div>
        {list.length === 0 && <p className="mute" style={{ padding: 6, fontSize: 12 }}>Scéna je prázdná. Přidej objekt nebo sem přetáhni model.</p>}
        {list.map((o) => (
          <div
            key={o.id}
            className={`row ${o.id === sel ? "sel" : ""}`}
            onClick={() => eng()?.select(o.id)}
            onDoubleClick={() => eng()?.focus(o.id)}
            style={{ opacity: o.visible ? 1 : 0.5 }}
          >
            <span style={{ width: 14, textAlign: "center", color: "#a48bff" }}>{TYPE_ICON[o.type]}</span>
            <span className="nm">{o.name}</span>
            <button
              className="eye"
              title="Zobrazit / skrýt"
              onClick={(e) => {
                e.stopPropagation();
                eng()?.setVisible(o.id, !o.visible);
              }}
            >
              {o.visible ? "👁" : "—"}
            </button>
          </div>
        ))}
    </>
  );

  const hierarchy = (
    <div className="pnl side" style={{ display: panels.hierarchy ? undefined : "none" }}>
      <div className="ph">
        Hierarchie
        <span style={{ marginLeft: "auto" }} />
        <div className={`m ${menu === "addh" ? "open" : ""}`} style={{ position: "relative" }}>
          <button className="tb" style={{ height: 20 }} onPointerDown={(e) => e.stopPropagation()} onClick={() => setMenu(menu === "addh" ? null : "addh")}>+ Přidat</button>
          {menu === "addh" && (
            <div className="dd" style={{ left: "auto", right: 0, zIndex: 20 }} onPointerDown={(e) => e.stopPropagation()}>
              {(["cube", "sphere", "cylinder", "plane"] as const).map((t) => (
                <button key={t} onClick={() => addObj(t)}>{{ cube: "Krychle", sphere: "Koule", cylinder: "Válec", plane: "Rovina" }[t]}</button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="pb">{hierarchyBody}</div>
    </div>
  );

  const envPanel = (
    <>
      <Section title="Prostředí scény">
        <Slider label="Směr slunce" value={env.sunAzimuth} min={0} max={360} step={1} onChange={(v) => updateEnv({ sunAzimuth: v })} fmt={(v) => `${v}°`} />
        <Slider label="Výška slunce" value={env.sunElevation} min={2} max={89} step={1} onChange={(v) => updateEnv({ sunElevation: v })} fmt={(v) => `${v}°`} />
        <Slider label="Síla slunce" value={env.sunIntensity} min={0} max={8} step={0.1} onChange={(v) => updateEnv({ sunIntensity: v })} />
        <Slider label="Okolní světlo" value={env.ambient} min={0} max={2} step={0.05} onChange={(v) => updateEnv({ ambient: v })} />
      </Section>
      <Section title="Stíny">
        <div className="f">
          <label>Stíny</label>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={env.shadows} onChange={(e) => updateEnv({ shadows: e.target.checked })} /> zapnuto
          </label>
        </div>
        <div className="f">
          <label>Mapa stínů</label>
          <select value={env.shadowRes} onChange={(e) => updateEnv({ shadowRes: Number(e.target.value) as EnvSettings["shadowRes"] })}>
            <option value={1024}>1024 (Výkon)</option>
            <option value={2048}>2048 (Vyvážené)</option>
            <option value={4096}>4096 (Kvalita)</option>
          </select>
        </div>
      </Section>
      <Section title="Vykreslování">
        <div className="f">
          <label>Zobrazení</label>
          <select value={view} onChange={(e) => changeView(e.target.value as ViewMode)}>
            {(Object.keys(VIEW_LABEL) as ViewMode[]).map((v) => <option key={v} value={v}>{VIEW_LABEL[v]}</option>)}
          </select>
        </div>
        <div className="f"><label>Globální osvětlení</label><span className="mute" style={{ fontSize: 12 }}>v plné verzi (Vulkan)</span></div>
        <div className="f"><label>DLSS</label><span className="mute" style={{ fontSize: 12 }}>v plné verzi, NVIDIA RTX</span></div>
      </Section>
    </>
  );

  const inspectorBody = (
    <>
        {showEnv ? (
          envPanel
        ) : selEntry && tf ? (
          <>
            <Section title="Objekt">
              <div className="f">
                <label>Název</label>
                <input key={selEntry.id + selEntry.name} defaultValue={selEntry.name} onBlur={(e) => { eng()?.rename(selEntry.id, e.target.value); setDirty(true); }} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
              </div>
              <div className="f">
                <label>Viditelný</label>
                <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="checkbox" checked={selEntry.visible} onChange={(e) => eng()?.setVisible(selEntry.id, e.target.checked)} /> ano
                </label>
              </div>
            </Section>
            <Section title="Transformace">
              <div className="f"><label>Pozice</label><Vec3 v={tf.position} onChange={(v) => { eng()?.setTransform(selEntry.id, { position: v }); setDirty(true); }} /></div>
              <div className="f"><label>Rotace (°)</label><Vec3 v={tf.rotation} step={5} onChange={(v) => { eng()?.setTransform(selEntry.id, { rotation: v }); setDirty(true); }} /></div>
              <div className="f"><label>Měřítko</label><Vec3 v={tf.scale} onChange={(v) => { eng()?.setTransform(selEntry.id, { scale: v }); setDirty(true); }} /></div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button className="btn" onClick={() => eng()?.dropToGround(selEntry.id)}>Položit na zem</button>
                <button className="btn" onClick={() => eng()?.focus(selEntry.id)}>Zaostřit</button>
                <button className="btn" onClick={dup}>Duplikovat</button>
                <button className="btn dan" onClick={del}>Smazat</button>
              </div>
            </Section>
            {mat ? (
              <Section title="Materiál" right={<span className="mute" style={{ fontWeight: 400 }}>PBR</span>}>
                <div className="f">
                  <label>Albedo</label>
                  <input type="color" value={mat.color} onChange={(e) => { const m = { ...mat, color: e.target.value }; setMat(m); eng()?.setMaterial(selEntry.id, { color: m.color }); }} />
                </div>
                <Slider label="Metalický" value={mat.metalness} min={0} max={1} step={0.01} onChange={(v) => { setMat({ ...mat, metalness: v }); eng()?.setMaterial(selEntry.id, { metalness: v }); }} fmt={(v) => v.toFixed(2)} />
                <Slider label="Drsnost" value={mat.roughness} min={0} max={1} step={0.01} onChange={(v) => { setMat({ ...mat, roughness: v }); eng()?.setMaterial(selEntry.id, { roughness: v }); }} fmt={(v) => v.toFixed(2)} />
                <Slider label="Emise" value={mat.emissive} min={0} max={4} step={0.05} onChange={(v) => { setMat({ ...mat, emissive: v }); eng()?.setMaterial(selEntry.id, { emissive: v }); }} fmt={(v) => v.toFixed(2)} />
                <div className="f">
                  <label>Předvolba</label>
                  <select
                    value=""
                    onChange={(e) => {
                      const p = PRESET_MATERIALS[e.target.value];
                      if (!p) return;
                      const m = { color: p.color, metalness: p.metalness, roughness: p.roughness, emissive: p.emissive ?? 0 };
                      setMat(m);
                      eng()?.setMaterial(selEntry.id, m);
                    }}
                  >
                    <option value="">Použít materiál…</option>
                    {Object.keys(PRESET_MATERIALS).map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
              </Section>
            ) : (
              <Section title="Model">
                <div className="mute" style={{ fontSize: 12 }}>Materiály: {eng()?.materialCount(selEntry.id) ?? 0} (z modelu). Úprava materiálů modelů je v plné verzi.</div>
                <button className="btn" onClick={() => toast.info("Znovu načíst model: v plné verzi se model načte znovu ze souboru v projektu.")}>Znovu načíst model</button>
              </Section>
            )}
          </>
        ) : (
          <p className="mute" style={{ padding: 6 }}>Vyber objekt v Hierarchii nebo na něj klikni ve Viewportu.</p>
        )}
    </>
  );

  const inspector = (
    <div className="pnl side" style={{ display: panels.inspector ? undefined : "none", borderRight: 0 }}>
      <div className="ph">Inspektor</div>
      <div className="pb">{inspectorBody}</div>
    </div>
  );

  const items = useMemo(() => {
    const all = tree[cwd] ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return Object.values(tree).flat().filter((a) => a.kind !== "folder" && a.name.toLowerCase().includes(q));
  }, [tree, cwd, search]);

  const openAsset = (a: Asset) => {
    if (a.kind === "folder") {
      setCwd(`${cwd}/${a.name}`);
      setSearch("");
      setAssetSel(null);
    } else if (a.kind === "model" && a.preset) {
      eng()?.addPreset(a.preset);
      setDirty(true);
    } else if (a.kind === "upload" && a.file) {
      void eng()?.loadFile(a.file).then(() => setDirty(true));
    } else if (a.kind === "material") {
      const key = a.name.replace(/\.vmat$/, "");
      const p = PRESET_MATERIALS[key];
      if (!sel || !mat) return toast.info("Nejdřív vyber krychli, kouli, válec nebo rovinu – materiál se na ni použije.");
      const m = { color: p.color, metalness: p.metalness, roughness: p.roughness, emissive: p.emissive ?? 0 };
      setMat(m);
      eng()?.setMaterial(sel, m);
      setDirty(true);
      toast.success(`Materiál ${key} použit.`);
    } else if (a.kind === "scene") {
      eng()?.loadTemplate("pbr");
      setEnvState(DEFAULT_ENV);
      toast.success("Načtena Úvodní scéna.");
    } else toast.info("Náhled textur je v plné verzi.");
  };

  const assets = (
    <div className="assets">
      <div className="crumbs">
        <button className="tb" disabled={cwd === "Assets"} title="Zpět (nadřazená složka)" onClick={() => setCwd(cwd.split("/").slice(0, -1).join("/") || "Assets")}>←</button>
        {cwd.split("/").map((part, i, arr) => (
          <button key={i} className="mute" onClick={() => setCwd(arr.slice(0, i + 1).join("/"))}>
            {part}
            {i < arr.length - 1 ? " /" : ""}
          </button>
        ))}
        <span style={{ marginLeft: "auto" }} />
        <button
          className="tb"
          onClick={() => {
            const base = "Nová složka";
            const names = new Set((tree[cwd] ?? []).map((a) => a.name));
            let n = base;
            for (let i = 2; names.has(n); i++) n = `${base} ${i}`;
            setTree((t) => ({ ...t, [cwd]: [...(t[cwd] ?? []), { name: n, kind: "folder", user: true }], [`${cwd}/${n}`]: [] }));
            setRenaming(n);
          }}
        >
          + Složka
        </button>
        <button className="tb" onClick={() => modelInput.current?.click()}>+ Přidat</button>
        <input placeholder="Hledat…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 120 }} />
      </div>
      <div className="grid" onClick={() => setAssetSel(null)}>
        {items.length === 0 && (
          <p className="mute" style={{ gridColumn: "1/-1", fontSize: 12 }}>
            {search ? "Hledání neodpovídá žádný asset." : "Složka je prázdná. Přetáhni sem soubory z počítače (.glb, .png...)."}
          </p>
        )}
        {items.map((a) => (
          <div
            key={a.name}
            className={`tile ${assetSel === a.name ? "sel" : ""}`}
            title="Dvojklikem otevřeš / vložíš do scény"
            onClick={(e) => { e.stopPropagation(); setAssetSel(a.name); }}
            onDoubleClick={() => openAsset(a)}
          >
            <div className="ic" style={a.kind === "material" ? { background: PRESET_MATERIALS[a.name.replace(/\.vmat$/, "")]?.color } : undefined}>
              {a.kind === "material" ? "" : ICON[a.kind]}
            </div>
            {renaming === a.name ? (
              <input
                autoFocus
                defaultValue={a.name}
                style={{ width: "100%", fontSize: 11 }}
                onClick={(e) => e.stopPropagation()}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  setRenaming(null);
                  if (!v || v === a.name || BAD_NAME.test(v)) return;
                  setTree((t) => {
                    const next = { ...t, [cwd]: t[cwd].map((x) => (x.name === a.name ? { ...x, name: v } : x)) };
                    if (a.kind === "folder") {
                      next[`${cwd}/${v}`] = t[`${cwd}/${a.name}`] ?? [];
                      delete next[`${cwd}/${a.name}`];
                    }
                    return next;
                  });
                }}
                onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              />
            ) : (
              <span>{a.name}</span>
            )}
          </div>
        ))}
      </div>
      {assetSel && (() => {
        const a = (tree[cwd] ?? []).find((x) => x.name === assetSel);
        if (!a) return null;
        return (
          <div className="crumbs" style={{ borderTop: "1px solid var(--line)", borderBottom: 0 }}>
            <span className="mute" style={{ fontSize: 12 }}>{a.name}</span>
            <span style={{ marginLeft: "auto" }} />
            <button className="tb" onClick={() => openAsset(a)}>Otevřít</button>
            <button className="tb" onClick={() => { void navigator.clipboard?.writeText(`${cwd}/${a.name}`); toast.success("Cesta zkopírována."); }}>Kopírovat cestu</button>
            {a.user && <button className="tb" onClick={() => setRenaming(a.name)}>Přejmenovat</button>}
            {a.user && <button className="tb" onClick={() => { setTree((t) => ({ ...t, [cwd]: t[cwd].filter((x) => x.name !== a.name) })); setAssetSel(null); }}>Smazat</button>}
          </div>
        );
      })()}
    </div>
  );

  const statsPanel = (
    <div style={{ display: "grid", gap: 10, padding: 4 }}>
      <div className="stats">
        <span>FPS</span><b>{stats?.fps ?? "–"}</b>
        <span>Snímek</span><b>{stats ? `${stats.ms} ms` : "–"}</b>
        <span>Trojúhelníky</span><b>{stats?.triangles.toLocaleString("cs-CZ") ?? "–"}</b>
        <span>Draw cally</span><b>{stats?.drawCalls ?? "–"}</b>
        <span>Objekty</span><b>{stats?.objects ?? "–"}</b>
        <span>Rozlišení</span><b>{stats ? `${stats.width}×${stats.height}` : "–"}</b>
        <span>Grafické API</span><b>WebGL 2 (demo) · plná verze Vulkan</b>
      </div>
      <div className="bar"><i style={{ width: `${Math.min(100, ((stats?.fps ?? 0) / 144) * 100)}%` }} /></div>
    </div>
  );

  const bottom = (
    <div className="pnl side" style={{ gridColumn: "1 / -1", display: panels.bottom ? undefined : "none", borderRight: 0 }}>
      <div className="ph" style={{ padding: 0 }}>
        <button className={`tab ${bottomTab === "assets" ? "on" : ""}`} onClick={() => setBottomTab("assets")}>Prohlížeč assetů</button>
        <button className={`tab ${bottomTab === "stats" ? "on" : ""}`} onClick={() => setBottomTab("stats")}>Statistiky enginu</button>
        <span className="mute" style={{ marginLeft: "auto", paddingRight: 8, fontWeight: 400 }}>{(tree[cwd] ?? []).length} položek | {cwd}</span>
      </div>
      <div className="pb" style={{ padding: 0 }}>{bottomTab === "assets" ? assets : statsPanel}</div>
    </div>
  );

  const mobilePanel = (
    <div className="pnl side mob" style={{ borderRight: 0 }}>
      <div className="mobtabs">
        {([
          ["hierarchy", "Hierarchie"],
          ["inspector", "Inspektor"],
          ["env", "Prostředí"],
          ["assets", "Assety"],
          ["stats", "Statistiky"],
        ] as [Panel, string][]).map(([k, l]) => (
          <button key={k} className={mob === k ? "on" : ""} onClick={() => setMob(k)}>{l}</button>
        ))}
      </div>
      <div className="pb" style={{ padding: mob === "assets" ? 0 : 6 }}>
        {mob === "hierarchy" && hierarchyBody}
        {mob === "inspector" && inspectorBody}
        {mob === "env" && envPanel}
        {mob === "assets" && assets}
        {mob === "stats" && statsPanel}
      </div>
    </div>
  );

  // na mobilu po výběru objektu přepnout na Inspektor
  useEffect(() => {
    if (sel) setMob((m) => (m === "hierarchy" ? "inspector" : m));
  }, [sel]);

  useEffect(() => {
    const root = host.current?.closest(".vsd") as HTMLElement | null;
    if (root) root.style.fontSize = `${Math.round(13 * uiScale)}px`;
  }, [uiScale]);
  const cols = `${panels.hierarchy ? "240px" : "0px"} 1fr ${panels.inspector ? "310px" : "0px"}`;

  return (
    <>
      <div className="menubar" onPointerDown={(e) => e.stopPropagation()}>
        <img src={logo} alt="" width={18} height={18} style={{ borderRadius: 4, marginRight: 4 }} />
        {menus.map((m) => (
          <div key={m.id} className={`m ${menu === m.id ? "open" : ""}`}>
            <button onClick={() => setMenu(menu === m.id ? null : m.id)} onMouseEnter={() => menu && menu !== "addh" && setMenu(m.id)}>{m.label}</button>
            {menu === m.id && (
              <div className="dd">
                {m.items.map((it, i) =>
                  it === "-" ? (
                    <hr key={i} />
                  ) : (
                    <button
                      key={i}
                      disabled={it.disabled}
                      onClick={() => {
                        setMenu(null);
                        it.on?.();
                      }}
                    >
                      <span style={{ whiteSpace: "pre" }}>{it.label}</span>
                      {it.key && <kbd>{it.key}</kbd>}
                    </button>
                  ),
                )}
              </div>
            )}
          </div>
        ))}
        <span className="title">{projectName}{dirty ? " *" : ""} — Voxario Studio</span>
      </div>
      <div className="toolbar">
        {TOOL_KEYS.map(([t, k, l]) => (
          <button key={t} className={`tb ${tool === t ? "on" : ""}`} onClick={() => setTool(t)} title={`${l} (${k})`}>
            <span className="k" style={{ color: "inherit", opacity: 0.7 }}>{k}</span> {l}
          </button>
        ))}
        <span className="sep" />
        <button className="tb" onClick={() => addObj("cube")}>◼ Krychle</button>
        <button className="tb" onClick={() => addObj("sphere")}>● Koule</button>
        <button className="tb" onClick={() => modelInput.current?.click()}>🧊 Nahrát model</button>
        <span className="sep" />
        <button className="tb" onClick={save}>💾 Uložit</button>
        <button className="tb" onClick={() => setSettingsOpen(true)}>⚙ Nastavení</button>
      </div>
      <input
        ref={modelInput}
        type="file"
        accept=".glb,.gltf,.png,.jpg,.jpeg"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void importFile(f);
        }}
      />
      <div className="main" style={{ ["--lw" as string]: panels.hierarchy ? "240px" : "0px", ["--rw" as string]: panels.inspector ? "310px" : "0px", ["--bh" as string]: panels.bottom ? "210px" : "0px", gridTemplateColumns: narrow ? undefined : cols }}>
        {!narrow && hierarchy}
        <div
          className="vp"
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            Array.from(e.dataTransfer.files).forEach((f) => void importFile(f));
          }}
        >
          <div className="host" ref={host} />
          <div className="ov">
            <select value={view} onChange={(e) => changeView(e.target.value as ViewMode)} aria-label="Režim zobrazení">
              {(Object.keys(VIEW_LABEL) as ViewMode[]).map((v) => <option key={v} value={v}>{VIEW_LABEL[v]}</option>)}
            </select>
            <span className="tb" style={{ background: "#1c1b23e6", pointerEvents: "none" }}>{stats ? `${stats.fps} FPS` : "…"}</span>
          </div>
          <div className="hint touch">1 prst: otáčení · 2 prsty: posun a přiblížení · ťuknutí: výběr objektu</div>
          <div className="hint mouse">Pravé tlačítko / Alt+levé: otáčení · Prostřední / Shift+pravé: posun · Kolečko: přiblížení · F: zaostřit na výběr · Q W E R: výběr / posun / rotace / měřítko (Ctrl = přichytávání)</div>
          {dragOver && <div className="drop">Sem přetáhni model (.glb) – zkopíruje se do projektu a vloží do scény</div>}
        </div>
        {!narrow && inspector}
        {!narrow && bottom}
        {narrow && mobilePanel}
      </div>

      {settingsOpen && (
        <Modal title="Nastavení" onClose={() => setSettingsOpen(false)} footer={<button className="btn pri" onClick={() => setSettingsOpen(false)}>Zavřít</button>}>
          <Section title="Rozhraní">
            <div className="f">
              <label>Velikost rozhraní</label>
              <select value={uiScale} onChange={(e) => setUiScale(Number(e.target.value))}>
                {[0.9, 1, 1.1, 1.25].map((s) => <option key={s} value={s}>{Math.round(s * 100)} %</option>)}
              </select>
            </div>
            <div className="f"><label>Jazyk</label><select disabled><option>Čeština</option></select></div>
          </Section>
          <Section title="Vykreslování">
            <div className="f"><label>Grafické API</label><select disabled><option>WebGL 2 (demo)</option><option>Vulkan (plná verze)</option></select></div>
            <div className="f">
              <label>Rozlišení vykreslování</label>
              <select value={renderScale} onChange={(e) => { const v = Number(e.target.value); setRenderScale(v); eng()?.setRenderScale(v); }}>
                <option value={0.5}>50 % (Výkon)</option>
                <option value={0.75}>75 % (Vyvážené)</option>
                <option value={1}>100 % (Kvalita)</option>
              </select>
            </div>
            <div className="f"><label>VSync</label><span className="mute" style={{ fontSize: 12 }}>řídí prohlížeč</span></div>
            <div className="f"><label>DLSS</label><span className="mute" style={{ fontSize: 12 }}>jen plná verze s NVIDIA RTX</span></div>
          </Section>
        </Modal>
      )}
    </>
  );
}

