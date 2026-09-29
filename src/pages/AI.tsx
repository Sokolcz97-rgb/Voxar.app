import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { findQuickHelp, generateSecurePassword, sha256 } from "@/lib/quickHelp";
import {
  Braces,
  CheckCircle2,
  Clipboard,
  FileText,
  Hash,
  HelpCircle,
  KeyRound,
  Search,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

const copyText = async (value: string) => {
  await navigator.clipboard.writeText(value);
  toast({ title: "Zkopírováno" });
};

const VoxarioTools = () => {
  const [helpQuery, setHelpQuery] = useState("");
  const helpResults = useMemo(() => findQuickHelp(helpQuery, 8), [helpQuery]);

  const [text, setText] = useState("");
  const words = useMemo(() => (text.trim() ? text.trim().split(/\s+/).length : 0), [text]);

  const [jsonInput, setJsonInput] = useState("");
  const [jsonOutput, setJsonOutput] = useState("");
  const [jsonError, setJsonError] = useState("");

  const [passwordLength, setPasswordLength] = useState(20);
  const [password, setPassword] = useState(() => generateSecurePassword(20));

  const [hashInput, setHashInput] = useState("");
  const [hashOutput, setHashOutput] = useState("");

  const formatJson = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      setJsonOutput(JSON.stringify(parsed, null, 2));
      setJsonError("");
    } catch (error) {
      setJsonOutput("");
      setJsonError(error instanceof Error ? error.message : "Neplatný JSON");
    }
  };

  const makeHash = async () => setHashOutput(await sha256(hashInput));

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <div className="fixed inset-0 -z-10 neon-grid opacity-20" />
      <Navbar />

      <main className="container py-6 sm:py-8">
        <section className="web-panel web-panel-accent p-5 sm:p-7">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 shrink-0 web-panel flex items-center justify-center">
              <Wrench className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-primary">Dočasný režim bez AI</div>
              <h1 className="font-display font-black text-2xl sm:text-3xl mt-1 web-title-metal">Voxario Tools</h1>
              <p className="mt-2 text-sm text-muted-foreground max-w-3xl">
                Generativní AI je dočasně odpojené. Tyto nástroje běží přímo v prohlížeči a nespotřebovávají žádné AI kredity ani tokeny.
              </p>
            </div>
          </div>
        </section>

        <div className="grid xl:grid-cols-2 gap-4 mt-4">
          <section className="web-panel p-5">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              <h2 className="font-display font-bold">Rychlá pomoc</h2>
            </div>
            <div className="relative mt-4">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={helpQuery}
                onChange={(event) => setHelpQuery(event.target.value)}
                placeholder="např. ticket, server, profil, instalátor…"
                className="w-full h-11 pl-9 pr-3 bg-background/50 border border-border/70 text-sm outline-none focus:border-primary/60"
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-2 mt-3">
              {helpResults.map((item) => (
                <Link key={item.href} to={item.href} className="border border-border/60 hover:border-primary/50 p-3 bg-background/30 transition-colors">
                  <div className="text-sm font-medium">{item.title}</div>
                  <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.description}</div>
                </Link>
              ))}
            </div>
          </section>

          <section className="web-panel p-5">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <h2 className="font-display font-bold">Textové nástroje</h2>
            </div>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={8}
              placeholder="Vlož text…"
              className="w-full mt-4 p-3 bg-background/50 border border-border/70 text-sm outline-none focus:border-primary/60 resize-y"
            />
            <div className="flex flex-wrap gap-2 mt-3 text-xs text-muted-foreground">
              <span>{text.length} znaků</span><span>·</span><span>{words} slov</span>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <Button variant="outline" onClick={() => setText(text.toLocaleUpperCase("cs-CZ"))}>VELKÁ</Button>
              <Button variant="outline" onClick={() => setText(text.toLocaleLowerCase("cs-CZ"))}>malá</Button>
              <Button variant="outline" onClick={() => setText(text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim())}>Vyčistit</Button>
              <Button variant="outline" onClick={() => void copyText(text)} disabled={!text}>
                <Clipboard className="h-4 w-4 mr-1.5" /> Kopírovat
              </Button>
            </div>
          </section>

          <section className="web-panel p-5">
            <div className="flex items-center gap-2">
              <Braces className="h-5 w-5 text-primary" />
              <h2 className="font-display font-bold">JSON kontrola</h2>
            </div>
            <textarea
              value={jsonInput}
              onChange={(event) => setJsonInput(event.target.value)}
              rows={6}
              placeholder={'{"example": true}'}
              className="w-full mt-4 p-3 font-mono bg-background/50 border border-border/70 text-sm outline-none focus:border-primary/60 resize-y"
            />
            <div className="flex gap-2 mt-3">
              <Button onClick={formatJson}>Ověřit a formátovat</Button>
              {jsonOutput && <Button variant="outline" onClick={() => void copyText(jsonOutput)}>Kopírovat</Button>}
            </div>
            {jsonError && <p className="mt-3 text-xs text-destructive">{jsonError}</p>}
            {jsonOutput && (
              <pre className="mt-3 max-h-64 overflow-auto border border-border/60 bg-background/40 p-3 text-xs whitespace-pre-wrap">{jsonOutput}</pre>
            )}
          </section>

          <section className="web-panel p-5">
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              <h2 className="font-display font-bold">Generátor hesla</h2>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Generování probíhá lokálně přes Web Crypto. Heslo se nikam neposílá.</p>
            <div className="flex items-center gap-3 mt-4">
              <input
                type="number"
                min={12}
                max={64}
                value={passwordLength}
                onChange={(event) => setPasswordLength(Math.max(12, Math.min(64, Number(event.target.value) || 20)))}
                className="w-24 h-10 px-3 bg-background/50 border border-border/70 text-sm"
              />
              <Button onClick={() => setPassword(generateSecurePassword(passwordLength))}>Vygenerovat</Button>
            </div>
            <div className="mt-3 flex items-center gap-2 border border-border/60 bg-background/40 p-3">
              <code className="flex-1 break-all text-sm">{password}</code>
              <button onClick={() => void copyText(password)} className="p-2 text-muted-foreground hover:text-primary" aria-label="Kopírovat heslo">
                <Clipboard className="h-4 w-4" />
              </button>
            </div>
          </section>

          <section className="web-panel p-5 xl:col-span-2">
            <div className="flex items-center gap-2">
              <Hash className="h-5 w-5 text-primary" />
              <h2 className="font-display font-bold">SHA-256</h2>
            </div>
            <div className="grid lg:grid-cols-[1fr_auto] gap-2 mt-4">
              <input
                value={hashInput}
                onChange={(event) => setHashInput(event.target.value)}
                placeholder="Text pro výpočet SHA-256"
                className="h-11 px-3 bg-background/50 border border-border/70 text-sm outline-none focus:border-primary/60"
              />
              <Button onClick={() => void makeHash()} disabled={!hashInput}>Spočítat hash</Button>
            </div>
            {hashOutput && (
              <div className="mt-3 flex items-center gap-2 border border-border/60 bg-background/40 p-3">
                <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                <code className="flex-1 break-all text-xs">{hashOutput}</code>
                <button onClick={() => void copyText(hashOutput)} className="p-2 text-muted-foreground hover:text-primary" aria-label="Kopírovat hash">
                  <Clipboard className="h-4 w-4" />
                </button>
              </div>
            )}
          </section>
        </div>

        <div className="mt-4 web-panel p-4 flex items-start gap-3 text-sm text-muted-foreground">
          <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <p>
            Tento režim nepoužívá Gemini, OpenAI ani jiný generativní model. AI můžeme později znovu zapnout, až bude dostupný limit nebo vlastní engine.
          </p>
        </div>
      </main>
    </div>
  );
};

export default VoxarioTools;
