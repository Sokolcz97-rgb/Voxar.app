import { useMemo } from "react";

type Embed = {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  author?: { name?: string; icon_url?: string; url?: string };
  footer?: { text?: string; icon_url?: string };
  thumbnail?: { url?: string };
  image?: { url?: string };
  fields?: { name: string; value: string; inline?: boolean }[];
  timestamp?: string;
};

interface Props {
  username?: string;
  avatarUrl?: string;
  content?: string;
  embed?: Embed | null;
  /** Render markdown-ish content (bold/italic/code/links/headings/lists). */
  markdown?: boolean;
}

/** Minimal, dependency-free markdown → HTML for Discord-ish text. */
function renderMarkdown(src: string) {
  let s = escapeHtml(src);
  // code blocks ```...```
  s = s.replace(/```([\s\S]*?)```/g, (_, c) => `<pre class="bg-black/40 border border-border rounded p-2 text-xs overflow-auto"><code>${c}</code></pre>`);
  // inline code
  s = s.replace(/`([^`]+)`/g, '<code class="bg-black/40 px-1 rounded text-[0.85em]">$1</code>');
  // headings ###/##/#
  s = s.replace(/^### (.+)$/gm, '<div class="font-bold text-[1rem] mt-1">$1</div>');
  s = s.replace(/^## (.+)$/gm, '<div class="font-bold text-[1.1rem] mt-1">$1</div>');
  s = s.replace(/^# (.+)$/gm, '<div class="font-bold text-[1.25rem] mt-1">$1</div>');
  // bold **x**
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // italics *x* or _x_
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  s = s.replace(/(^|[^_])_([^_\n]+)_/g, "$1<em>$2</em>");
  // strikethrough ~~x~~
  s = s.replace(/~~([^~]+)~~/g, "<s>$1</s>");
  // links [text](url)
  s = s.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-[#00aff4] hover:underline">$1</a>');
  // bare urls
  s = s.replace(/(^|\s)(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noopener" class="text-[#00aff4] hover:underline">$2</a>');
  // bullet lists
  s = s.replace(/^- (.+)$/gm, '<div class="pl-3">• $1</div>');
  // line breaks
  s = s.replace(/\n/g, "<br/>");
  return s;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function colorToHex(n?: number) {
  if (!n && n !== 0) return "#5865F2";
  return "#" + n.toString(16).padStart(6, "0");
}

export function DiscordMessagePreview({
  username = "NEONHUB Bot",
  avatarUrl,
  content,
  embed,
  markdown = true,
}: Props) {
  const contentHtml = useMemo(
    () => (content ? (markdown ? renderMarkdown(content) : escapeHtml(content).replace(/\n/g, "<br/>")) : ""),
    [content, markdown]
  );
  const descHtml = useMemo(
    () => (embed?.description ? renderMarkdown(embed.description) : ""),
    [embed?.description]
  );
  const titleHtml = useMemo(
    () => (embed?.title ? renderMarkdown(embed.title) : ""),
    [embed?.title]
  );
  const authorInitial = (username[0] || "?").toUpperCase();
  const ts = useMemo(() => {
    const d = embed?.timestamp ? new Date(embed.timestamp) : new Date();
    return d.toLocaleString();
  }, [embed?.timestamp]);

  return (
    <div className="rounded-lg border border-border bg-[#313338] text-[#dbdee1] p-4 font-sans text-[15px] leading-[1.4]">
      <div className="flex gap-3">
        <div className="shrink-0">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <div className="h-10 w-10 rounded-full bg-[#5865F2] grid place-items-center text-white font-bold">
              {authorInitial}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-white">{username}</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#5865F2] text-white font-semibold tracking-wide">
              APP
            </span>
            <span className="text-xs text-[#949ba4]">dnes v {new Date().toLocaleTimeString()}</span>
          </div>

          {contentHtml && (
            <div
              className="mt-0.5 whitespace-pre-wrap break-words text-[#dbdee1]"
              dangerouslySetInnerHTML={{ __html: contentHtml }}
            />
          )}

          {embed && (embed.title || embed.description || embed.image || embed.fields?.length || embed.author || embed.footer) && (
            <div
              className="mt-2 grid grid-cols-[4px_1fr] rounded overflow-hidden bg-[#2b2d31] max-w-[520px]"
            >
              <div style={{ background: colorToHex(embed.color) }} />
              <div className="p-3 space-y-2">
                {embed.author?.name && (
                  <div className="flex items-center gap-2 text-sm">
                    {embed.author.icon_url && (
                      <img src={embed.author.icon_url} alt="" className="h-5 w-5 rounded-full" />
                    )}
                    <span className="font-semibold text-white">{embed.author.name}</span>
                  </div>
                )}
                {titleHtml && (
                  <div
                    className="font-semibold text-white text-[15px]"
                    dangerouslySetInnerHTML={{ __html: titleHtml }}
                  />
                )}
                {descHtml && (
                  <div
                    className="text-[14px] text-[#dbdee1] whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{ __html: descHtml }}
                  />
                )}
                {embed.fields && embed.fields.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {embed.fields.map((f, i) => (
                      <div
                        key={i}
                        className={f.inline ? "col-span-1" : "col-span-3"}
                      >
                        <div className="font-semibold text-white text-[13px]">{f.name}</div>
                        <div
                          className="text-[13px] text-[#dbdee1] whitespace-pre-wrap"
                          dangerouslySetInnerHTML={{ __html: renderMarkdown(f.value || "") }}
                        />
                      </div>
                    ))}
                  </div>
                )}
                {embed.image?.url && (
                  <img src={embed.image.url} alt="" className="rounded max-h-72 mt-1" />
                )}
                {(embed.footer?.text || embed.timestamp) && (
                  <div className="flex items-center gap-2 text-[12px] text-[#949ba4] pt-1">
                    {embed.footer?.icon_url && (
                      <img src={embed.footer.icon_url} alt="" className="h-4 w-4 rounded-full" />
                    )}
                    <span>
                      {embed.footer?.text}
                      {embed.footer?.text && embed.timestamp ? " • " : ""}
                      {embed.timestamp ? ts : ""}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
