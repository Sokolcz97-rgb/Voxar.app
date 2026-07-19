import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { SEO } from "@/components/SEO";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { CheckCircle2, ClipboardList, Loader2, Star } from "lucide-react";

type Field = {
  id: string; position: number; type: string; label: string;
  description: string | null; required: boolean; options: string[];
};

export default function PublicForm() {
  const { slug } = useParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<any>(null);
  const [fields, setFields] = useState<Field[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: f } = await supabase.from("forms")
        .select("id,title,description,cover_emoji,is_published,allow_anonymous,success_message")
        .eq("slug", slug!).maybeSingle();
      if (!f || !f.is_published) { setLoading(false); return; }
      setForm(f);
      const { data: fs } = await supabase.from("form_fields").select("*").eq("form_id", f.id).order("position");
      setFields(((fs ?? []) as any[]).map((x) => ({ ...x, options: Array.isArray(x.options) ? x.options : [] })));
      setLoading(false);
    })();
  }, [slug]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    for (const f of fields) {
      if (f.required) {
        const v = answers[f.id];
        const empty = v == null || v === "" || (Array.isArray(v) && v.length === 0);
        if (empty) { toast({ title: `Vyplňte: ${f.label}`, variant: "destructive" }); return; }
      }
    }
    if (!form.allow_anonymous && !user) {
      toast({ title: "Vyžadováno přihlášení", description: "Autor formuláře vyžaduje přihlášení.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("form_responses").insert({
      form_id: form.id,
      respondent_id: user?.id ?? null,
      answers,
    });
    setSubmitting(false);
    if (error) { toast({ title: "Odeslání selhalo", description: error.message, variant: "destructive" }); return; }
    setDone(true);
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (!form) {
    return (
      <div className="min-h-screen relative">
        <div className="fixed inset-0 -z-10 gradient-hero" />
        <Navbar />
        <main className="container py-16 max-w-xl text-center animate-fade-in">
          <Card className="glass border-border"><CardContent className="py-12">
            <ClipboardList className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <h1 className="text-xl font-semibold mb-2">Formulář nenalezen</h1>
            <p className="text-sm text-muted-foreground mb-4">Odkaz je neplatný nebo byl formulář odebrán.</p>
            <Button asChild><Link to="/">Zpět na úvod</Link></Button>
          </CardContent></Card>
        </main>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen relative">
        <div className="fixed inset-0 -z-10 gradient-hero" />
        <SEO title={`${form.title} — odesláno`} />
        <Navbar />
        <main className="container py-16 max-w-xl text-center animate-fade-in">
          <Card className="glass border-border"><CardContent className="py-12">
            <CheckCircle2 className="w-14 h-14 mx-auto text-primary mb-3" />
            <h1 className="text-2xl font-semibold mb-2">{form.success_message || "Děkujeme za odeslání!"}</h1>
            <p className="text-sm text-muted-foreground mb-4">Vaše odpověď byla zaznamenána.</p>
            <Button asChild variant="outline"><Link to="/">Zpět na úvod</Link></Button>
          </CardContent></Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <SEO title={form.title} description={form.description ?? undefined} />
      <Navbar />
      <main className="container py-10 max-w-2xl animate-fade-in">
        <Card className="glass border-border mb-4">
          <CardContent className="pt-6">
            <div className="text-3xl mb-2">{form.cover_emoji || "📝"}</div>
            <h1 className="text-2xl font-bold">{form.title}</h1>
            {form.description && <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{form.description}</p>}
          </CardContent>
        </Card>
        <form onSubmit={submit} className="space-y-3">
          {fields.map((f) => (
            <Card key={f.id} className="glass border-border">
              <CardContent className="pt-6 space-y-2">
                <Label className="text-base">{f.label}{f.required && <span className="text-destructive"> *</span>}</Label>
                {f.description && <p className="text-xs text-muted-foreground">{f.description}</p>}
                <FieldInput field={f} value={answers[f.id]} onChange={(v) => setAnswers({ ...answers, [f.id]: v })} />
              </CardContent>
            </Card>
          ))}
          {fields.length === 0 && (
            <Card className="glass border-border"><CardContent className="py-8 text-center text-sm text-muted-foreground">Formulář zatím nemá žádná pole.</CardContent></Card>
          )}
          <Button type="submit" disabled={submitting || fields.length === 0} className="w-full">
            {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Odeslat
          </Button>
          {!user && !form.allow_anonymous && (
            <p className="text-xs text-center text-muted-foreground">Pro odeslání se přihlaste.</p>
          )}
        </form>
      </main>
    </div>
  );
}

function FieldInput({ field, value, onChange }: { field: Field; value: any; onChange: (v: any) => void }) {
  switch (field.type) {
    case "textarea":
      return <Textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} rows={4} />;
    case "email":
      return <Input type="email" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
    case "number":
      return <Input type="number" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
    case "date":
      return <Input type="date" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
    case "radio":
      return (
        <RadioGroup value={value ?? ""} onValueChange={onChange}>
          {field.options.map((o, i) => (
            <div key={i} className="flex items-center space-x-2">
              <RadioGroupItem value={o} id={`${field.id}-${i}`} />
              <Label htmlFor={`${field.id}-${i}`} className="cursor-pointer">{o}</Label>
            </div>
          ))}
        </RadioGroup>
      );
    case "checkbox": {
      const arr: string[] = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-2">
          {field.options.map((o, i) => (
            <div key={i} className="flex items-center space-x-2">
              <Checkbox id={`${field.id}-${i}`} checked={arr.includes(o)} onCheckedChange={(c) => {
                if (c) onChange([...arr, o]); else onChange(arr.filter((x) => x !== o));
              }} />
              <Label htmlFor={`${field.id}-${i}`} className="cursor-pointer">{o}</Label>
            </div>
          ))}
        </div>
      );
    }
    case "select":
      return (
        <Select value={value ?? ""} onValueChange={onChange}>
          <SelectTrigger><SelectValue placeholder="Vyberte…" /></SelectTrigger>
          <SelectContent>
            {field.options.map((o, i) => <SelectItem key={i} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    case "rating":
      return (
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => onChange(n)}
              className="p-1 hover:scale-110 transition-transform">
              <Star className={`w-6 h-6 ${(value ?? 0) >= n ? "fill-primary text-primary" : "text-muted-foreground"}`} />
            </button>
          ))}
        </div>
      );
    default:
      return <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
  }
}
