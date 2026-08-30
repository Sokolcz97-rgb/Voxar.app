// Adapter: OpenAI Chat Completions style → Google Gemini generateContent
// Uses GOOGLE_GEMINI_API_KEY. Returns a fetch-like Response so call sites
// keep using data.choices[0].message.{content,tool_calls}.

type OpenAIMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: any;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
};

type ChatCompletionRequest = {
  model?: string;
  messages: OpenAIMessage[];
  tools?: any[];
  tool_choice?: any;
  response_format?: { type?: string };
};

// Map our model names to REST-compatible Gemini IDs.
// REST `generateContent` v současné době podporuje pouze 1.5 / 2.0 / 2.5 řadu.
// "Gemini 3" a "3.5" modely viditelné v AI Studiu jsou jen pro Live API.
function mapModel(m?: string): string {
  if (!m) return "gemini-3.5-flash";
  const id = m.replace(/^google\//, "");
  if (id.includes("pro")) return "gemini-3.5-flash"; // Pro není na free tieru
  if (id.includes("flash-lite")) return "gemini-3.5-flash-lite";
  if (id.includes("flash")) return "gemini-3.5-flash";
  return "gemini-3.5-flash";
}

function partsFromContent(content: any): any[] {
  if (content == null) return [{ text: "" }];
  if (typeof content === "string") return [{ text: content }];
  if (Array.isArray(content)) {
    return content.map((c: any) => {
      if (c?.type === "text") return { text: String(c.text ?? "") };
      if (c?.type === "image_url") {
        const url = typeof c.image_url === "string" ? c.image_url : c.image_url?.url;
        // Gemini supports file_data with fileUri for public URLs
        return { fileData: { fileUri: url, mimeType: "image/jpeg" } };
      }
      return { text: JSON.stringify(c) };
    });
  }
  return [{ text: String(content) }];
}

function convertMessages(messages: OpenAIMessage[]) {
  let systemInstruction: any = undefined;
  const systemTexts: string[] = [];
  const contents: any[] = [];

  // Buffer pending tool results so they get attached to the next user turn
  let pendingToolResponses: any[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      systemTexts.push(typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content));
      continue;
    }
    if (msg.role === "tool") {
      pendingToolResponses.push({
        functionResponse: {
          name: msg.name ?? "tool",
          response: (() => {
            try {
              const parsed = JSON.parse(typeof msg.content === "string" ? msg.content : "{}");
              return typeof parsed === "object" && parsed !== null ? parsed : { result: parsed };
            } catch {
              return { result: typeof msg.content === "string" ? msg.content : "" };
            }
          })(),
        },
      });
      continue;
    }
    if (msg.role === "assistant") {
      const parts: any[] = [];
      if (msg.content) parts.push(...partsFromContent(msg.content));
      if (msg.tool_calls?.length) {
        for (const tc of msg.tool_calls) {
          let args: any = {};
          try { args = JSON.parse(tc.function.arguments || "{}"); } catch { /* ignore */ }
          parts.push({ functionCall: { name: tc.function.name, args } });
        }
      }
      if (!parts.length) parts.push({ text: "" });
      contents.push({ role: "model", parts });
      continue;
    }
    // user
    const parts = partsFromContent(msg.content);
    if (pendingToolResponses.length) {
      contents.push({ role: "user", parts: pendingToolResponses });
      pendingToolResponses = [];
    }
    contents.push({ role: "user", parts });
  }

  // Flush remaining tool responses as a user turn
  if (pendingToolResponses.length) {
    contents.push({ role: "user", parts: pendingToolResponses });
  }

  if (systemTexts.length) {
    systemInstruction = { role: "system", parts: [{ text: systemTexts.join("\n\n") }] };
  }

  return { systemInstruction, contents };
}

function convertTools(tools?: any[]) {
  if (!tools?.length) return undefined;
  return [
    {
      functionDeclarations: tools
        .filter((t) => t?.type === "function" && t.function)
        .map((t) => ({
          name: t.function.name,
          description: t.function.description ?? "",
          parameters: t.function.parameters ?? { type: "object", properties: {} },
        })),
    },
  ];
}

export async function geminiChatCompletion(req: ChatCompletionRequest): Promise<Response> {
  const apiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "GOOGLE_GEMINI_API_KEY not set" }), { status: 500 });
  }

  const primary = mapModel(req.model);
  // Fallback chain pro free tier — pokud je primární model přetížený (503) nebo
  // dojde rate-limit (429), zkusíme postupně ostatní dostupné Flash modely.
  const fallbackChain = [
    primary,
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
  ].filter((m, i, arr) => arr.indexOf(m) === i);

  const { systemInstruction, contents } = convertMessages(req.messages);
  const tools = convertTools(req.tools);

  const body: any = { contents };
  if (systemInstruction) body.systemInstruction = systemInstruction;
  if (tools) body.tools = tools;
  if (req.response_format?.type === "json_object") {
    body.generationConfig = { responseMimeType: "application/json" };
  }

  let resp: Response | null = null;
  let lastDetail = "";
  let usedModel = primary;
  for (const m of fallbackChain) {
    usedModel = m;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
    resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (resp.ok) break;
    lastDetail = await resp.text();
    console.error(`[gemini] ${resp.status} for model ${m}: ${lastDetail.slice(0, 300)}`);
    // Fallback jen pro přetížení/limit, ne pro 4xx (špatný klíč/request)
    if (resp.status !== 503 && resp.status !== 429 && resp.status !== 500) break;
  }

  if (!resp || !resp.ok) {
    return new Response(
      JSON.stringify({
        error: `Gemini ${resp?.status ?? "error"}`,
        detail: lastDetail.slice(0, 500),
        model: usedModel,
      }),
      { status: resp?.status ?? 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const data = await resp.json();
  const cand = data?.candidates?.[0];
  const parts: any[] = cand?.content?.parts ?? [];
  let text = "";
  const toolCalls: any[] = [];
  for (const p of parts) {
    if (typeof p?.text === "string") text += p.text;
    if (p?.functionCall) {
      toolCalls.push({
        id: `call_${toolCalls.length}_${Date.now()}`,
        type: "function",
        function: {
          name: p.functionCall.name,
          arguments: JSON.stringify(p.functionCall.args ?? {}),
        },
      });
    }
  }

  const openaiShaped = {
    choices: [
      {
        message: {
          role: "assistant",
          content: text || null,
          ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
        },
        finish_reason: toolCalls.length ? "tool_calls" : "stop",
      },
    ],
    model: usedModel,
  };

  return new Response(JSON.stringify(openaiShaped), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
