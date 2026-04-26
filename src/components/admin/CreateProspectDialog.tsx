import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Loader2, FlaskConical } from "lucide-react";
import { generateFakeProspect } from "@/lib/test-fixtures";
import { isTestModeAvailable } from "@/lib/test-mode";

const VERTICALS: Record<string, string[]> = {
  "Salud & Estética": ["Clínica dental", "Medicina estética", "Fisioterapia", "Psicología", "Nutrición", "Dermatología"],
  "E-Learning": ["Cursos online", "Coaching", "Mentoría grupal", "Academia digital", "Formación corporativa"],
  "Deporte Offline": ["Gimnasio", "CrossFit", "Yoga / Pilates", "Artes marciales", "Entrenamiento personal", "Centro deportivo"],
};

interface Props {
  onCreated: () => void;
}

export default function CreateProspectDialog({ onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isTest, setIsTest] = useState(false);
  const testAvailable = isTestModeAvailable();
  const [form, setForm] = useState({
    name: "",
    company_name: "",
    email: "",
    market: "",
    vertical: "",
    sub_niche: "",
    average_ticket: "",
    ticket_currency: "EUR",
    description: "",
    call_date: "",
  });

  const subNiches = form.vertical ? VERTICALS[form.vertical] || [] : [];

  const resetForm = () => {
    setForm({
      name: "", company_name: "", email: "", market: "", vertical: "",
      sub_niche: "", average_ticket: "", ticket_currency: "EUR", description: "", call_date: "",
    });
    setIsTest(false);
  };

  const fillFakeData = () => {
    const fake = generateFakeProspect({ emailOverride: form.email || undefined });
    setForm(fake);
    setIsTest(true);
    toast.success("🧪 TEST – Form riempito con dati fake. Cambia l'email per ricevere le notifiche.");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.company_name || !form.email || !form.market || !form.vertical || !form.sub_niche) {
      toast.error("Completa los campos obligatorios");
      return;
    }
    setLoading(true);
    try {
      const { data: inserted, error } = await supabase.from("prospects").insert({
        name: form.name,
        company_name: form.company_name,
        email: form.email,
        market: form.market as "es" | "it" | "ar",
        vertical: form.vertical,
        sub_niche: form.sub_niche,
        status: "new",
        call_date: form.call_date || null,
        call_status: form.call_date ? "scheduled" : "not_scheduled",
        briefing_answers: {
          average_ticket: form.average_ticket,
          ticket_currency: form.ticket_currency,
          description: form.description,
          source: "manual",
        },
      } as any).select("id").single();
      if (error) throw error;

      await supabase.from("events").insert({
        event_type: "prospect.created",
        entity_type: "prospect",
        payload: { name: form.name, vertical: form.vertical, source: "manual" },
      });

      // Branded admin notification
      try {
        await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "new-prospect-received",
            idempotencyKey: `new-prospect-${inserted?.id}`,
            templateData: {
              prospectName: form.name,
              companyName: form.company_name,
              vertical: form.vertical,
              subNiche: form.sub_niche,
              market: form.market,
              adminUrl: `${window.location.origin}/admin/prospects/${inserted?.id || ""}`,
            },
          },
        });
      } catch (e) { console.error("new-prospect email error:", e); }

      toast.success("Prospect creado");
      resetForm();
      setOpen(false);
      onCreated();
    } catch (err: any) {
      toast.error(err.message || "Error al crear prospect");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" /> Nuevo prospect
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear prospect manualmente</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Nombre *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Juan García" required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Empresa *</Label>
              <Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} placeholder="Clínica Ejemplo" required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Email *</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="juan@ejemplo.com" required />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">País *</Label>
            <Select value={form.market} onValueChange={(v) => setForm({ ...form, market: v })}>
              <SelectTrigger><SelectValue placeholder="Seleccionar país" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="es">🇪🇸 España</SelectItem>
                <SelectItem value="it">🇮🇹 Italia</SelectItem>
                <SelectItem value="ar">🇦🇷 Argentina</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Sector *</Label>
              <Select value={form.vertical} onValueChange={(v) => setForm({ ...form, vertical: v, sub_niche: "" })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {Object.keys(VERTICALS).map((v) => (
                    <SelectItem key={v} value={v}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Especialización *</Label>
              <Select value={form.sub_niche} onValueChange={(v) => setForm({ ...form, sub_niche: v })} disabled={!form.vertical}>
                <SelectTrigger><SelectValue placeholder={form.vertical ? "Seleccionar" : "Elige sector primero"} /></SelectTrigger>
                <SelectContent>
                  {subNiches.map((sn) => (
                    <SelectItem key={sn} value={sn}>{sn}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-sm">Ticket medio</Label>
              <Input type="number" value={form.average_ticket} onChange={(e) => setForm({ ...form, average_ticket: e.target.value })} placeholder="150" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Moneda</Label>
              <Select value={form.ticket_currency} onValueChange={(v) => setForm({ ...form, ticket_currency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Descripción</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value.slice(0, 300) })}
              placeholder="Breve descripción del negocio..."
              rows={3}
            />
            <span className="text-xs text-muted-foreground">{form.description.length}/300</span>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Fecha y hora de la call</Label>
            <Input type="datetime-local" value={form.call_date} onChange={(e) => setForm({ ...form, call_date: e.target.value })} />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Crear prospect"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}