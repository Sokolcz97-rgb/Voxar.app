import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRef, useState } from "react";
import { CommunityComposer } from "./CommunityComposer";
import type { UploadedAttachment } from "@/lib/uploadAttachment";

afterEach(cleanup);
function Harness({sending = false, onSend = vi.fn()}) {
  const [input, setInput] = useState("Rozepsaná zpráva");
  const [pending, setPending] = useState<UploadedAttachment[]>([]);
  return <CommunityComposer channelName="obecné" hasKey={false} input={input} setInput={setInput} pending={pending} setPending={setPending} uploading={false} sending={sending} fileRef={createRef<HTMLInputElement>()} onPickFiles={() => {}} onSend={onSend} />;
}
describe("community composer", () => {
  it("blocks duplicate submissions while sending, including Enter", () => {
    const onSend = vi.fn(); render(<Harness sending onSend={onSend} />);
    expect(screen.getByTitle("Odeslat zprávu")).toBeDisabled();
    fireEvent.keyDown(screen.getByRole("textbox"), {key: "Enter"});
    expect(onSend).not.toHaveBeenCalled();
  });
  it("inserts a chosen emoji into the existing draft", () => {
    render(<Harness />); fireEvent.click(screen.getByTitle("Emoji"));
    fireEvent.click(screen.getByRole("button", {name: "🎮"}));
    expect(screen.getByRole("textbox")).toHaveValue("Rozepsaná zpráva 🎮");
  });
  it("rejects non-HTTPS GIF URLs without discarding the draft", () => {
    render(<Harness />); fireEvent.click(screen.getByTitle("Vložit GIF"));
    fireEvent.change(screen.getByLabelText("HTTPS odkaz na GIF"), {target: {value: "javascript:alert(1)"}});
    fireEvent.click(screen.getByRole("button", {name: "Přiložit GIF"}));
    expect(screen.getByRole("alert")).toHaveTextContent("HTTPS");
  });
  it("validates poll options before inserting a vote-ready poll", () => {
    render(<Harness />); fireEvent.click(screen.getByRole("button", {name: "Vytvořit anketu"}));
    fireEvent.click(screen.getByRole("button", {name: "Vložit anketu do zprávy"}));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Otázka ankety"), {target: {value: "Kdy hrajeme?"}});
    fireEvent.change(screen.getByLabelText("Odpověď 1"), {target: {value: "Dnes"}});
    fireEvent.change(screen.getByLabelText("Odpověď 2"), {target: {value: "Zítra"}});
    fireEvent.click(screen.getByRole("button", {name: "Vložit anketu do zprávy"}));
    expect(screen.getByRole("textbox")).toHaveValue("Rozepsaná zpráva 📊 ANKETA: Kdy hrajeme?\n1️⃣ Dnes\n2️⃣ Zítra");
  });
});
