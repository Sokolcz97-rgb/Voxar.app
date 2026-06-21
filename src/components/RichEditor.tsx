import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import TextStyle from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { uploadAttachment, MAX_ATTACHMENT_BYTES } from "@/lib/uploadAttachment";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, Quote, Code, Link as LinkIcon, Unlink,
  Image as ImageIcon, Paperclip, Loader2, Heading2, Heading3, Palette,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: number;
  /** When true, image/file uploads are disabled (e.g. user not logged in). */
  disableUploads?: boolean;
  /** Hide the built-in upload toolbar buttons (use external Attach button via ref instead). */
  hideUploadButtons?: boolean;
  /** Hide the entire formatting toolbar (compact chat mode). */
  hideToolbar?: boolean;
  /** Called when the user presses Enter (without Shift). Return true to indicate handled. */
  onEnterSubmit?: () => void;
}

export interface RichEditorHandle {
  openFilePicker: (accept?: string) => void;
  isUploading: () => boolean;
  clear: () => void;
  focus: () => void;
}

const PRESET_COLORS = [
  "#ffffff", "#9ca3af", "#fca5a5", "#f87171", "#ef4444",
  "#fb923c", "#fbbf24", "#facc15", "#a3e635", "#4ade80",
  "#22d3ee", "#60a5fa", "#818cf8", "#a78bfa", "#e879f9",
  "#f472b6",
];

// ---------- Color helpers ----------
function clamp(n: number, min = 0, max = 255) { return Math.max(min, Math.min(max, n)); }

function rgbToHex(r: number, g: number, b: number) {
  const h = (n: number) => clamp(Math.round(n)).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`.toLowerCase();
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function parseAnyColor(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  // hex with or without #
  const hex = hexToRgb(s.startsWith("#") ? s : `#${s}`);
  if (hex) return rgbToHex(hex.r, hex.g, hex.b);
  // rgb()/rgba()
  const m = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (m) return rgbToHex(+m[1], +m[2], +m[3]);
  return null;
}

function ToolbarBtn({
  onClick, active, disabled, title, children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={cn(
        "icon-3d h-9 w-9 inline-flex items-center justify-center rounded-md text-sm",
        "text-muted-foreground hover:text-foreground",
        active && "is-active",
        disabled && "opacity-40 cursor-not-allowed"
      )}
    >
      {children}
    </button>
  );
}

function ColorPicker({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const current = (editor.getAttributes("textStyle").color as string | undefined) ?? null;

  // Local controlled inputs (initialized from current color when opening)
  const initialHex = current && parseAnyColor(current) ? parseAnyColor(current)! : "#ffffff";
  const initialRgb = hexToRgb(initialHex)!;
  const [hexInput, setHexInput] = useState(initialHex);
  const [r, setR] = useState(initialRgb.r);
  const [g, setG] = useState(initialRgb.g);
  const [b, setB] = useState(initialRgb.b);

  const apply = (color: string) => {
    editor.chain().focus().setColor(color).run();
  };

  const onHexChange = (val: string) => {
    setHexInput(val);
    const parsed = parseAnyColor(val);
    if (parsed) {
      const rgb = hexToRgb(parsed)!;
      setR(rgb.r); setG(rgb.g); setB(rgb.b);
      apply(parsed);
    }
  };

  const onRgbChange = (nr: number, ng: number, nb: number) => {
    const cr = clamp(nr), cg = clamp(ng), cb = clamp(nb);
    setR(cr); setG(cg); setB(cb);
    const hex = rgbToHex(cr, cg, cb);
    setHexInput(hex);
    apply(hex);
  };

  return (
    <div className="relative">
      <ToolbarBtn onClick={() => setOpen((o) => !o)} title="Barva textu" active={!!current}>
        <span className="relative inline-flex">
          <Palette className="h-4 w-4" />
          {current && (
            <span
              className="absolute -bottom-1 left-0 right-0 h-[3px] rounded-sm"
              style={{ background: current }}
            />
          )}
        </span>
      </ToolbarBtn>
      {open && (
        <div
          className="absolute z-50 mt-1 left-0 p-3 rounded-lg border border-border bg-card/95 backdrop-blur shadow-lg w-[240px]"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="grid grid-cols-8 gap-1.5 mb-3">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => apply(c)}
                className="h-5 w-5 rounded border border-border/50 hover:scale-110 transition-transform"
                style={{ background: c }}
                aria-label={`Barva ${c}`}
              />
            ))}
          </div>

          {/* Native color picker (true RGB triangle/square) */}
          <div className="flex items-center gap-2 mb-2">
            <input
              type="color"
              value={parseAnyColor(hexInput) ?? "#ffffff"}
              onChange={(e) => onHexChange(e.target.value)}
              className="h-8 w-10 rounded border border-border bg-transparent cursor-pointer"
              aria-label="Vybrat barvu"
            />
            <input
              type="text"
              value={hexInput}
              onChange={(e) => onHexChange(e.target.value)}
              placeholder="#RRGGBB"
              className="flex-1 h-8 px-2 rounded border border-border bg-background text-xs font-mono"
              aria-label="HEX"
            />
          </div>

          <div className="grid grid-cols-3 gap-1.5 mb-2">
            {([
              ["R", r, (v: number) => onRgbChange(v, g, b)],
              ["G", g, (v: number) => onRgbChange(r, v, b)],
              ["B", b, (v: number) => onRgbChange(r, g, v)],
            ] as const).map(([label, val, set]) => (
              <label key={label} className="flex flex-col items-center text-[10px] text-muted-foreground">
                <span>{label}</span>
                <input
                  type="number"
                  min={0}
                  max={255}
                  value={val}
                  onChange={(e) => set(clamp(parseInt(e.target.value || "0", 10)))}
                  className="w-full h-7 px-1 rounded border border-border bg-background text-xs text-foreground text-center"
                />
              </label>
            ))}
          </div>

          <div className="flex justify-between gap-2">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { editor.chain().focus().unsetColor().run(); }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Bez barvy
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setOpen(false)}
              className="text-xs text-primary hover:underline"
            >
              Hotovo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export const RichEditor = forwardRef<RichEditorHandle, Props>(function RichEditor({
  value, onChange, placeholder, className, minHeight = 140, disableUploads, hideUploadButtons, hideToolbar, onEnterSubmit,
}, ref) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline,
      TextStyle,
      Color,
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: "nofollow noopener", target: "_blank" } }),
      Image.configure({ inline: false, HTMLAttributes: { class: "rounded-lg border border-border max-h-[480px]" } }),
      Placeholder.configure({ placeholder: placeholder ?? t("editor.placeholder") }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-invert prose-sm max-w-none focus:outline-none px-4 py-3",
          "prose-headings:font-display prose-a:text-primary",
          "prose-img:my-2 prose-pre:bg-secondary/60 prose-pre:border prose-pre:border-border",
          "min-h-[var(--rich-min)]"
        ),
        style: `--rich-min:${minHeight}px`,
      },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []);
        if (files.length > 0 && !disableUploads && user) {
          event.preventDefault();
          handleFiles(files);
          return true;
        }
        return false;
      },
      handleDrop: (_view, event) => {
        const files = Array.from((event as DragEvent).dataTransfer?.files ?? []);
        if (files.length > 0 && !disableUploads && user) {
          event.preventDefault();
          handleFiles(files);
          return true;
        }
        return false;
      },
      handleKeyDown: (_view, event) => {
        if (event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.metaKey && onEnterSubmit) {
          event.preventDefault();
          onEnterSubmit();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      onChange(ed.isEmpty ? "" : html);
    },
  });

  const insertAttachment = useCallback((att: { url: string; name: string; mime: string; kind: "image" | "video" | "file" }) => {
    if (!editor) return;
    if (att.kind === "image") {
      editor.chain().focus().setImage({ src: att.url, alt: att.name }).run();
    } else if (att.kind === "video") {
      editor.chain().focus().insertContent(
        `<video controls src="${att.url}" class="rounded-lg border border-border max-h-[480px]" preload="metadata"></video>`
      ).run();
    } else {
      const safeName = att.name.replace(/[<>"']/g, "");
      editor.chain().focus().insertContent(
        `<p><a href="${att.url}" target="_blank" rel="noopener nofollow" data-attachment="true" data-name="${safeName}" data-mime="${att.mime}">📎 ${safeName}</a></p>`
      ).run();
    }
  }, [editor]);

  const handleFiles = useCallback(async (files: File[]) => {
    if (!user) return;
    setUploading(true);
    for (const f of files) {
      try {
        if (f.size > MAX_ATTACHMENT_BYTES) {
          toast({ title: t("editor.tooLarge"), description: f.name, variant: "destructive" });
          continue;
        }
        const att = await uploadAttachment(f, user.id);
        insertAttachment(att);
      } catch (err: any) {
        toast({ title: t("editor.uploadFailed"), description: err?.message ?? String(err), variant: "destructive" });
      }
    }
    setUploading(false);
  }, [user, t, insertAttachment]);

  const onPickFiles = (accept: string) => {
    if (!fileInputRef.current) return;
    fileInputRef.current.accept = accept;
    fileInputRef.current.click();
  };

  useImperativeHandle(ref, () => ({
    openFilePicker: (accept = "image/*,video/*,application/pdf,application/zip,text/plain") => onPickFiles(accept),
    isUploading: () => uploading,
    clear: () => { editor?.commands.clearContent(true); },
    focus: () => { editor?.commands.focus("end"); },
  }), [uploading, editor]);

  const setLink = () => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt(t("editor.linkPrompt"), prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  if (!editor) return null;

  return (
    <div className={cn("rounded-md border border-border bg-background/40", className)}>
      {!hideToolbar && (
      <div className="relative flex flex-wrap items-center gap-0.5 border-b border-border bg-secondary/30 p-1 rounded-t-md">
        <ToolbarBtn title={t("editor.bold")} onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")}>
          <Bold className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn title={t("editor.italic")} onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")}>
          <Italic className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn title={t("editor.underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")}>
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn title={t("editor.strike")} onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")}>
          <Strikethrough className="h-4 w-4" />
        </ToolbarBtn>

        <div className="w-px h-5 bg-border mx-1" />

        <ColorPicker editor={editor} />

        <div className="w-px h-5 bg-border mx-1" />

        <ToolbarBtn title="H2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })}>
          <Heading2 className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn title="H3" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })}>
          <Heading3 className="h-4 w-4" />
        </ToolbarBtn>

        <ToolbarBtn title={t("editor.bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")}>
          <List className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn title={t("editor.orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")}>
          <ListOrdered className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn title={t("editor.quote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")}>
          <Quote className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn title={t("editor.code")} onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive("codeBlock")}>
          <Code className="h-4 w-4" />
        </ToolbarBtn>

        <div className="w-px h-5 bg-border mx-1" />

        <ToolbarBtn title={t("editor.link")} onClick={setLink} active={editor.isActive("link")}>
          <LinkIcon className="h-4 w-4" />
        </ToolbarBtn>
        {editor.isActive("link") && (
          <ToolbarBtn title={t("editor.unlink")} onClick={() => editor.chain().focus().unsetLink().run()}>
            <Unlink className="h-4 w-4" />
          </ToolbarBtn>
        )}

        {!disableUploads && user && !hideUploadButtons && (
          <>
            <div className="w-px h-5 bg-border mx-1" />
            <ToolbarBtn
              title={t("editor.image")}
              onClick={() => onPickFiles("image/*")}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
            </ToolbarBtn>
            <ToolbarBtn
              title={t("editor.file")}
              onClick={() => onPickFiles("image/*,video/*,application/pdf,application/zip,text/plain")}
              disabled={uploading}
            >
              <Paperclip className="h-4 w-4" />
            </ToolbarBtn>
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (files.length) handleFiles(files);
          }}
        />
      </div>
      )}

      {hideToolbar && (
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (files.length) handleFiles(files);
          }}
        />
      )}

      <EditorContent editor={editor} />
    </div>
  );
});
