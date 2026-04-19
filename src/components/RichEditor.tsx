import { useCallback, useRef, useState } from "react";
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
import { Button } from "@/components/ui/button";
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
}

const COLORS = [
  "#ffffff", "#9ca3af", "#fca5a5", "#f87171", "#ef4444",
  "#fb923c", "#fbbf24", "#facc15", "#a3e635", "#4ade80",
  "#22d3ee", "#60a5fa", "#818cf8", "#a78bfa", "#e879f9",
  "#f472b6",
];

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
        "h-8 w-8 inline-flex items-center justify-center rounded-md text-sm transition-colors",
        "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
        active && "bg-primary/15 text-primary",
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
          className="absolute z-50 mt-1 left-0 p-2 rounded-lg border border-border bg-card/95 backdrop-blur shadow-lg"
          onMouseLeave={() => setOpen(false)}
        >
          <div className="grid grid-cols-8 gap-1.5 w-[200px]">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { editor.chain().focus().setColor(c).run(); setOpen(false); }}
                className="h-5 w-5 rounded border border-border/50 hover:scale-110 transition-transform"
                style={{ background: c }}
                aria-label={`Barva ${c}`}
              />
            ))}
          </div>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { editor.chain().focus().unsetColor().run(); setOpen(false); }}
            className="mt-2 w-full text-xs text-muted-foreground hover:text-foreground"
          >
            Bez barvy
          </button>
        </div>
      )}
    </div>
  );
}

export function RichEditor({
  value, onChange, placeholder, className, minHeight = 140, disableUploads,
}: Props) {
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
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      // TipTap returns "<p></p>" for empty editor — normalize to ""
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
    <div className={cn("rounded-md border border-border bg-background/40 overflow-hidden", className)}>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-secondary/30 p-1">
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

        {!disableUploads && user && (
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

      <EditorContent editor={editor} />
    </div>
  );
}
