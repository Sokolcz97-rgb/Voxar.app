export type BrowserChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type BrowserModelProgress = {
  text: string;
  progress?: number;
};

type BrowserModelManifest = {
  schemaVersion: number;
  runtime: "webllm";
  channel: string;
  displayName: string;
  modelId: string;
  ownModel: boolean;
};

const WEBLLM_MODULE_URL = "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.84/+esm";
const DEFAULT_MODEL_ID = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";
const MANIFEST_URL = "/ai/voxario-model-manifest.json";

let engine: any = null;
let enginePromise: Promise<any> | null = null;
let loadedModelId: string | null = null;
let manifestPromise: Promise<BrowserModelManifest> | null = null;

export function supportsVoxarioBrowserAI(): boolean {
  return typeof window !== "undefined" && typeof navigator !== "undefined" && "gpu" in navigator;
}

export async function getVoxarioBrowserManifest(): Promise<BrowserModelManifest> {
  if (!manifestPromise) {
    manifestPromise = fetch(MANIFEST_URL, { cache: "no-cache" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Model manifest returned ${response.status}`);
        return (await response.json()) as BrowserModelManifest;
      })
      .catch(() => ({
        schemaVersion: 1,
        runtime: "webllm",
        channel: "bootstrap",
        displayName: "Voxario Local Bootstrap",
        modelId: DEFAULT_MODEL_ID,
        ownModel: false,
      }));
  }

  return manifestPromise;
}

async function ensureEngine(onProgress?: (progress: BrowserModelProgress) => void) {
  if (!supportsVoxarioBrowserAI()) {
    throw new Error("WebGPU není v tomto prohlížeči dostupné.");
  }

  const manifest = await getVoxarioBrowserManifest();
  if (engine && loadedModelId === manifest.modelId) return engine;

  if (!enginePromise) {
    enginePromise = (async () => {
      onProgress?.({ text: "Načítám Voxario Local runtime…", progress: 0 });
      const webllm = await import(/* @vite-ignore */ WEBLLM_MODULE_URL);
      const created = await webllm.CreateMLCEngine(manifest.modelId, {
        initProgressCallback: (report: { text?: string; progress?: number }) => {
          onProgress?.({
            text: report.text || "Načítám lokální AI model…",
            progress: report.progress,
          });
        },
      });
      engine = created;
      loadedModelId = manifest.modelId;
      return created;
    })().catch((error) => {
      enginePromise = null;
      engine = null;
      loadedModelId = null;
      throw error;
    });
  }

  return enginePromise;
}

export async function generateWithVoxarioBrowserAI(
  messages: BrowserChatMessage[],
  onProgress?: (progress: BrowserModelProgress) => void,
): Promise<string> {
  const runtime = await ensureEngine(onProgress);
  onProgress?.({ text: "Voxario Local přemýšlí…", progress: 1 });

  const response = await runtime.chat.completions.create({
    messages: [
      {
        role: "system",
        content:
          "Jsi Voxario AI. Odpovídej ve stejném jazyce jako uživatel, buď praktický a přesný. Pokud nemáš dost informací, řekni to místo vymýšlení faktů.",
      },
      ...messages,
    ],
    temperature: 0.35,
    top_p: 0.9,
    max_tokens: 768,
    stream: false,
  });

  const text = response?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Lokální model nevrátil odpověď.");
  }
  return text.trim();
}

export async function interruptVoxarioBrowserAI(): Promise<void> {
  try {
    await engine?.interruptGenerate?.();
  } catch {
    // Best-effort cancellation. The UI can still stop waiting for the response.
  }
}

export async function getVoxarioBrowserModelLabel(): Promise<string> {
  const manifest = await getVoxarioBrowserManifest();
  return manifest.displayName;
}
