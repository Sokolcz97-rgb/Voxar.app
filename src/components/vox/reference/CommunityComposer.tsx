import { useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import { AtSign, BarChart3, Bot, Gift, Loader2, Paperclip, Plus, Send, Smile, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { openVoxUtility } from "@/lib/voxCommunityBridge";
import type { UploadedAttachment } from "@/lib/uploadAttachment";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { VoxMember } from "../MemberList";

interface Props {
  members?: VoxMember[];
  sending?: boolean;
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
  members = [],
  sending = false,
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

  const [picker, setPicker] = useState<"gif" | "poll" | "emoji" | "mention" | null>(null);
  const [gifUrl, setGifUrl] = useState("");
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [memberQuery, setMemberQuery] = useState("");
  const [pickerError, setPickerError] = useState("");
  const insertGif = () => { setPickerError(""); setPicker("gif"); };
  const createPoll = () => { setPickerError(""); setPicker("poll"); };
  const saveGif = () => {
    try {
      const url = new URL(gifUrl.trim());
      if (url.protocol !== "https:" || !/\.gif$/i.test(url.pathname)) throw new Error();
      setPending(current => [...current, { url: url.href, name: "GIF", mime: "image/gif", size: 0, kind: "image" }]);
      setGifUrl(""); setPicker(null);
    } catch { setPickerError("Vlož přímý HTTPS odkaz na soubor .gif, nebo GIF nahraj jako přílohu."); }
  };
  const savePoll = () => {
    const clean = options.map(o => o.trim()).filter(Boolean);
    if (!question.trim() || clean.length < 2 || new Set(clean).size !== clean.length) {
      setPickerError("Vyplň otázku a alespoň dvě různé odpovědi."); return;
    }
    appendInput(`📊 ANKETA: ${question.trim()}\n${clean.map((o, i) => `${["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣"][i]} ${o}`).join("\n")}`);
    setPicker(null); setQuestion(""); setOptions(["", ""]);
  };

  const canSend = !!input.trim() || pending.length > 0;

  return (
    <footer className="sv-composer sv-composer-v3 sv-composer-v17 sv-composer-v19">
      <span className="sv-composer-corner sv-composer-corner-tl" aria-hidden="true" />
      <span className="sv-composer-corner sv-composer-corner-tr" aria-hidden="true" />
      <span className="sv-composer-corner sv-composer-corner-bl" aria-hidden="true" />
      <span className="sv-composer-corner sv-composer-corner-br" aria-hidden="true" />
      <span className="sv-composer-edge sv-composer-edge-left" aria-hidden="true" />
      <span className="sv-composer-edge sv-composer-edge-right" aria-hidden="true" />

      {pending.length > 0 && (
        <div className="sv-composer-pending">
          {pending.map((attachment, index) => (
            <div key={`${attachment.url}-${index}`} className="sv-composer-pending-item">
              {attachment.kind === "image" && <img src={attachment.url} alt="" />}
              <span>{attachment.name}</span>
              <button type="button" title="Odebrat přílohu" onClick={() => setPending((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                <X />
              </button>
            </div>
          ))}
        </div>
      )}

      <input ref={fileRef} type="file" multiple hidden onChange={(event) => void onPickFiles(event.target.files)} />

      <div className="sv-composer-row">
        <button
          type="button"
          className="sv-composer-attach sv-composer-plus"
          disabled={uploading || sending}
          title="Přidat obsah"
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? <Loader2 className="animate-spin" /> : <Plus />}
        </button>

        <div className="sv-composer-input-wrap">
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                if (!sending && !uploading) void onSend();
              }
            }}
            placeholder={hasKey ? `Napsat šifrovanou zprávu do #${channelName}...` : `Napsat zprávu do #${channelName}...`}
            className="sv-composer-textarea resize-none"
            rows={1}
          />

          <div className="sv-composer-inline-actions">
            <button type="button" title="Dárky, boosty a rámečky" onClick={() => openVoxUtility("store")}>
              <Gift />
            </button>
            <button type="button" className="sv-composer-gif" title="Vložit GIF" onClick={insertGif}>GIF</button>
            <button type="button" title="Emoji" onClick={() => setPicker("emoji")}><Smile /></button>
          </div>
        </div>

        <button type="button" className="sv-composer-send" disabled={!canSend || uploading || sending} title="Odeslat zprávu" onClick={() => void onSend()}>
          {sending ? <Loader2 className="animate-spin" /> : <Send />}
        </button>
      </div>

      <div className="sv-composer-toolbar">
        <button type="button" onClick={() => setPicker("mention")}><AtSign />Zmínka</button>
        <button type="button" onClick={() => fileRef.current?.click()}><Paperclip />Připojit soubor</button>
        <button type="button" onClick={createPoll}><BarChart3 />Vytvořit anketu</button>
        <button type="button" className="ai" onClick={() => window.dispatchEvent(new CustomEvent("vox:open-ai"))}>
          <Bot />AI asistent
        </button>
        <span className="sv-composer-enter-hint">{hasKey ? "E2E · " : ""}ENTER pro odeslání</span>
      </div>
      <Dialog open={picker !== null} onOpenChange={open => { if (!open) setPicker(null); }}>
        <DialogContent className="bg-slate-950 border-cyan-800 text-slate-100">
          <DialogHeader><DialogTitle>{picker === "gif" ? "Vložit GIF" : picker === "poll" ? "Vytvořit anketu" : picker === "mention" ? "Zmínit člena" : "Vybrat emoji"}</DialogTitle>
            <DialogDescription>{picker === "poll" ? "Členové hlasují kliknutím na odpovědi. Mohou vybrat více možností." : "Vybraný obsah se vloží do rozepsané zprávy."}</DialogDescription>
          </DialogHeader>
          {picker === "gif" && <><Input aria-label="HTTPS odkaz na GIF" value={gifUrl} onChange={e => setGifUrl(e.target.value)} placeholder="https://…/animace.gif" /><Button onClick={saveGif}>Přiložit GIF</Button><Button variant="outline" onClick={() => { setPicker(null); fileRef.current?.click(); }}>Nahrát GIF ze zařízení</Button></>}
          {picker === "poll" && <><Input aria-label="Otázka ankety" maxLength={240} placeholder="Na co se chceš zeptat?" value={question} onChange={e => setQuestion(e.target.value)} />{options.map((option, index) => <Input key={index} aria-label={`Odpověď ${index + 1}`} maxLength={120} placeholder={`Odpověď ${index + 1}`} value={option} onChange={e => setOptions(current => current.map((o,i) => i === index ? e.target.value : o))} />)}{options.length < 8 && <Button variant="outline" onClick={() => setOptions(o => [...o, ""])}>Přidat odpověď</Button>}<Button onClick={savePoll}>Vložit anketu do zprávy</Button></>}
          {picker === "emoji" && <div className="grid grid-cols-6 gap-2">{["🙂","😀","😂","❤️","👍","👎","🔥","🎮","🚀","🎉","👋","💙","😍","🤔","😎","😢","✅","💪"].map(emoji => <Button variant="outline" className="text-2xl h-12" key={emoji} aria-label={emoji} onClick={() => { appendInput(emoji); setPicker(null); }}>{emoji}</Button>)}</div>}
          {picker === "mention" && <><Input aria-label="Hledat člena" placeholder="Hledat člena…" value={memberQuery} onChange={e => setMemberQuery(e.target.value)} /><div className="max-h-72 overflow-y-auto space-y-1">{members.filter(m => (m.nickname || m.display_name || m.user_id).toLocaleLowerCase().includes(memberQuery.toLocaleLowerCase())).map(m => <Button key={m.user_id} variant="ghost" className="w-full justify-start" onClick={() => { appendInput(`@${m.nickname || m.display_name || m.user_id}`); setPicker(null); }}>@{m.nickname || m.display_name || m.user_id}</Button>)}{members.length === 0 && <p>V komunitě nejsou dostupní členové.</p>}</div></>}
          {pickerError && <p role="alert" className="text-amber-300 text-sm">{pickerError}</p>}
        </DialogContent>
      </Dialog>
    </footer>
  );
}
