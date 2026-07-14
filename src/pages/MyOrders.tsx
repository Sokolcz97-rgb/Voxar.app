import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { SEO } from "@/components/SEO";
import { PageHero } from "@/components/PageHero";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Loader2, Package, Plus } from "lucide-react";

type OrderStatus = "paid" | "done" | "processing" | "cancelled" | "paused";
const STATUS_LABEL: Record<OrderStatus, string> = {
  paid: "Zaplaceno",
  done: "Vyřízeno",
  processing: "Zpracovává se",
  cancelled: "Zrušeno",
  paused: "Pozastaveno",
};
const STATUS_VARIANT: Record<OrderStatus, "default" | "secondary" | "destructive" | "outline"> = {
  paid: "default", done: "default", processing: "secondary", cancelled: "destructive", paused: "outline",
};

type Row = {
  id: string;
  title: string;
  description: string | null;
  product_size: string | null;
  product_url: string | null;
  phone: string | null;
  notify_preference: string | null;
  status: OrderStatus;
  price: number | null;
  currency: string;
  created_at: string;
};

export default function MyOrders() {
  const { user, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("orders")
        .select("id,title,description,product_size,product_url,phone,notify_preference,status,price,currency,created_at")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false });
      setRows((data ?? []) as Row[]);
      setLoading(false);
    })();
  }, [user]);

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <SEO title="Moje zakázky" description="Přehled vašich zakázek." />
      <Navbar />
      <main className="container py-10 max-w-3xl animate-fade-in">
        <PageHero eyebrow="Účet" title="Moje zakázky" description="Přehled vámi vytvořených zakázek." icon={Package} />

        <div className="flex justify-end mb-4">
          <Button asChild><Link to="/objednat"><Plus className="w-4 h-4 mr-2" />Nová zakázka</Link></Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
        ) : rows.length === 0 ? (
          <Card className="glass border-border"><CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">Zatím žádné zakázky.</p>
            <Button asChild><Link to="/objednat">Vytvořit první zakázku</Link></Button>
          </CardContent></Card>
        ) : (
          <div className="space-y-3">
            {rows.map((o) => (
              <Card key={o.id} className="glass border-border">
                <CardContent className="pt-6 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{o.title}</h3>
                    <Badge variant={STATUS_VARIANT[o.status]}>{STATUS_LABEL[o.status]}</Badge>
                    {o.product_size && <Badge variant="outline">Velikost {o.product_size}</Badge>}
                  </div>
                  {o.description && <p className="text-sm text-muted-foreground line-clamp-3">{o.description}</p>}
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                    <span>🕒 {new Date(o.created_at).toLocaleString("cs-CZ")}</span>
                    {o.price != null && <span>💰 {o.price} {o.currency}</span>}
                    {o.notify_preference && <span>📣 {o.notify_preference === "email" ? "E-mail" : "Telefon"}</span>}
                    {o.phone && <span>📞 {o.phone}</span>}
                  </div>
                  {o.product_url && (
                    <a href={o.product_url} target="_blank" rel="noopener noreferrer"
                       className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                      <ExternalLink className="w-3 h-3" /> Model
                    </a>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
