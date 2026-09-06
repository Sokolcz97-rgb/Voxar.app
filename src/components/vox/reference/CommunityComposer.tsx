import type { Dispatch, RefObject, SetStateAction } from "react";
import { AtSign, BarChart3, Bot, Gift, Loader2, Paperclip, Plus, Send, Smile, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import type { UploadedAttachment } from "@/lib/uploadAttachment";

interface Props {
  channelName: string;
  hasKey: boolean;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  pending: UploadedAttachment[];
  setPending: Dispatch<SetStateAction<UploadedAttachment[]>>;
  uploading: boolean;
  fileRef: RefObject<HTMLInputElement>;
  onPickFiles: (files: FileList | null) => void | Promise<void>;
  onSend: () => void | Promise<void>;
}

export function CommunityComposer({
  channelName,
  hasKey,
  input,
  setInput,
  pending,
  setPending,
  uploading,
  fileRef,
  onPickFiles,
  onSend,
}: Props) {
  const appendInput = (value: string) => {
    setInput((current) => {
      if (!current) return value;
      if (/\s$/.test(current)) return `${current}${value}`;
      return `${current} ${value}`;
    });
  };

  const canSend = !!input.trim() || pending.length > 0;

  return (
    <footer className="sv-composer sv-composer-v3 sv-composer-v17">
      <span className="sv-composer-corner sv-composer-corner-tl" aria-hidden="true" />
      <span className="sv-composer-corner sv-composer-corner-tr" aria-hidden="true" />
      <span className="sv-composer-corner sv-composer-corner-bl" aria-hidden="true" />
      <span className="sv-composer-corner sv-composer-corner-br" aria-hidden="true" />

      {pending.length > 0 && (
        <div className="sv-composer-pending">
          {pending.map((attachment, index) => (
            <div key={`${attachment.url}-${index}`} className="sv-composer-pending-item">
              {attachment.kind === "image" && <img src={attachment.url} alt="" />}
              <span>{attachment.name}</span>
              <button
                type="button"
                title="Odebrat přílohu"
                onClick={() => setPending((current) => current.filter((_, itemIndex) => itemIndex !== index))}
              >
                <X />
              </button>
            </div>
          ))}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        multiple
        hidden
        onChange={(event) => void onPickFiles(event.target.files)}
      />

      <div className="sv-composer-row">
        <button
          type="button"
          className="sv-composer-attach sv-composer-plus"
          disabled={uploading}
          title="Přidat obsah"
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? <Loader2 className="animate-spin" /> : <Plus />}
        </button>

        <div className="sv-composer-input-wrap">
          <span className="sv-composer-channel-chip" aria-hidden="true"># {channelName}</span>
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void onSend();
              }
            }}
            placeholder={hasKey
              ? `Napsat šifrovanou zprávu do #${channelName}...`
              : `Napsat zprávu do #${channelName}...`}
            className="sv-composer-textarea resize-none"
            rows={1}
          />

          <div className="sv-composer-inline-actions">
            <button
              type="button"
              title="Dárek"
              onClick={() => toast({ title: "Dárky", description: "Dárky a boosty připravujeme." })}
            >
              <Gift />
            </button>
            <button
              type="button"
              className="sv-composer-gif"
              title="GIF"
              onClick={() => toast({ title: "GIF", description: "GIF vyhledávání připravujeme." })}
            >
              GIF
            </button>
            <button type="button" title="Emoji" onClick={() => appendInput("🙂")}>
              <Smile />
            </button>
          </div>
        </div>

        <button
          type="button"
          className="sv-composer-send"
          disabled={!canSend}
          title="Odeslat zprávu"
          onClick={() => void onSend()}
        >
          <Send />
        </button>
      </div>

      <div className="sv-composer-toolbar">
        <button type="button" onClick={() => appendInput("@")}><AtSign />Zmínka</button>
        <button type="button" onClick={() => fileRef.current?.click()}><Paperclip />Připojit soubor</button>
        <button type="button" onClick={() => appendInput("📊 Anketa:")}><BarChart3 />Vytvořit anketu</button>
        <button
          type="button"
          className="ai"
          onClick={() => window.dispatchEvent(new CustomEvent("vox:open-ai"))}
        >
          <Bot />AI asistent
        </button>
        <span>{hasKey ? "E2E · " : ""}ENTER pro odeslání</span>
      </div>
    </footer>
  );
}
