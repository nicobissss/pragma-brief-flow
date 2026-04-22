import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  FileText, Image as ImageIcon, Mail, PenTool, ChevronDown,
  CheckCircle2, AlertCircle, Sparkles, Paperclip,
} from "lucide-react";
import { format } from "date-fns";
import { ProgressIndicator } from "@/components/shared/ProgressIndicator";
import { EmptyState } from "@/components/shared/EmptyState";
import { OfferingDetails } from "@/components/shared/OfferingDetails";

const typeIcons: Record<string, any> = {
  landing_page: FileText, email_flow: Mail, social_post: ImageIcon, blog_article: PenTool,
};
const typeLabels: Record<string, string> = {
  landing_page: "Landing Page", email_flow: "Email Flow", social_post: "Social Posts", blog_article: "Blog Articles",
};

const briefingFields = {
  "Sobre tu negocio": [
    { key: "name", label: "Nombre", source: "prospect" },
    { key: "company_name", label: "Empresa", source: "prospect" },
    { key: "email", label: "Email", source: "prospect" },
    { key: "phone", label: "Teléfono", source: "prospect" },
    { key: "vertical", label: "Vertical", source: "prospect" },
    { key: "sub_niche", label: "Especialización", source: "prospect" },
  ],
  "Tu situación actual": [
    { key: "years_in_operation", label: "Años de operación" },
    { key: "monthly_new_clients", label: "Nuevos clientes/mes" },
    { key: "client_sources", label: "Fuentes de clientes" },
    { key: "runs_paid_ads", label: "Hace ads pagados" },
    { key: "ad_platforms", label: "Plataformas de ads" },
    { key: "has_email_list", label: "Tiene lista email" },
    { key: "has_website", label: "Tiene website" },
    { key: "website_url", label: "Website URL" },
    { key: "uses_crm", label: "Usa CRM" },
  ],
  "Tus objetivos": [
    { key: "main_goal", label: "Objetivo principal" },
    { key: "biggest_challenge", label: "Reto principal" },
    { key: "differentiator", label: "Diferenciador" },
  ],
};

type AssetItem = {
  id: string; asset_name: string; asset_type: string; status: string;
  version: number; created_at: string; campaign_id: string | null;
};

type ClientTask = {
  id: string; title: string; description: string | null;
  category: string; status: string | null; blocked_reason: string | null;
};

function BriefingRow({ label, value }: { label: string; value: any }) {
  const isEmpty = value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
  const display = isEmpty ? null : Array.isArray(value) ? value.join(", ") : String(value);
  return (
    <div className="py-3 border-b border-border last:border-0">
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      {isEmpty ? <p className="text-sm text-muted-foreground italic">—</p> : <p className="text-sm text-foreground">{display}</p>}
    </div>
  );
}

export default function ClientDashboard() {
  const [clientName, setClientName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [allAssets, setAllAssets] = useState<AssetItem[]>([]);
  const [briefingAnswers, setBriefingAnswers] = useState<Record<string, any> | null>(null);
  const [prospectData, setProspectData] = useState<Record<string, any> | null>(null);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [clientTasksList, setClientTasksList] = useState<ClientTask[]>([]);
  const [activeOffering, setActiveOffering] = useState<any | null>(null);
  const [offeringTpl, setOfferingTpl] = useState<any | null>(null);
  const [offeringTasks, setOfferingTasks] = useState<{ status: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: client } = await supabase
        .from("clients")
        .select("id, name, company_name, prospect_id")
        .eq("user_id", session.user.id)
        .limit(1)
        .maybeSingle();

      if (!client) { setLoading(false); return; }
      setClientName(client.name);
      setCompanyName(client.company_name);

      const [assetsRes, prospectRes, requestsRes, offeringRes] = await Promise.all([
        supabase.from("assets").select("id, asset_name, asset_type, status, version, created_at, campaign_id").eq("client_id", client.id).order("created_at"),
        client.prospect_id
          ? supabase.from("prospects").select("name, company_name, email, phone, vertical, sub_niche, market, briefing_answers").eq("id", client.prospect_id).single()
          : Promise.resolve({ data: null }),
        (supabase.from("client_asset_requests" as any) as any)
          .select("requested_items, status")
          .eq("client_id", client.id)
          .in("status", ["pending", "partial"])
          .limit(1),
        supabase
          .from("client_offerings")
          .select("*")
          .eq("client_id", client.id)
          .order("proposed_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (assetsRes.data) setAllAssets(assetsRes.data as AssetItem[]);

      if (prospectRes.data) {
        setProspectData(prospectRes.data);
        setBriefingAnswers((prospectRes.data as any).briefing_answers || {});
      }

      if (requestsRes.data && requestsRes.data.length > 0) {
        const pending = (requestsRes.data[0].requested_items as any[]).filter((i: any) => i.status === "pending").length;
        setPendingRequestCount(pending);
      }

      if (offeringRes.data) {
        setActiveOffering(offeringRes.data);
        const [{ data: tpl }, { data: t }] = await Promise.all([
          supabase.from("offering_templates").select("*").eq("id", offeringRes.data.offering_template_id).maybeSingle(),
          supabase.from("action_plan_tasks").select("status").eq("client_offering_id", offeringRes.data.id),
        ]);
        if (tpl) setOfferingTpl(tpl);
        if (t) setOfferingTasks(t as any[]);
      }

      // Pending client tasks (across all offerings)
      const { data: offerings } = await supabase
        .from("client_offerings").select("id").eq("client_id", client.id);
      const offeringIds = (offerings || []).map((o: any) => o.id);
      if (offeringIds.length > 0) {
        const { data: ctasks } = await supabase
          .from("action_plan_tasks")
          .select("id, title, description, category, status, blocked_reason")
          .in("client_offering_id", offeringIds)
          .eq("assignee", "client")
          .neq("status", "done")
          .order("order_index");
        setClientTasksList((ctasks || []) as ClientTask[]);
      }

      setLoading(false);
    };
    load();
  }, []);

  if (loading) return (
    <div className="space-y-4">
      <div className="h-10 w-64 animate-pulse rounded-md bg-muted" />
      <div className="h-4 w-80 animate-pulse rounded bg-muted" />
      {[1,2,3].map(i => <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />)}
    </div>
  );

  // Combined client tasks (action_plan_tasks + materials request + pending review assets)
  type TaskCard = { id: string; title: string; description?: string; cta: string; link: string; priority: "high" | "normal" };
  const taskCards: TaskCard[] = [];
  if (pendingRequestCount > 0) {
    taskCards.push({
      id: "materials",
      title: `Subir ${pendingRequestCount} archivo${pendingRequestCount > 1 ? "s" : ""}`,
      description: "Tu equipo PRAGMA necesita estos materiales para avanzar.",
      cta: "Subir ahora",
      link: "/client/collect",
      priority: "high",
    });
  }
  const pendingReviewAssets = allAssets.filter(a => a.status === "pending_review");
  if (pendingReviewAssets.length > 0) {
    taskCards.push({
      id: "review",
      title: `Revisar ${pendingReviewAssets.length} asset${pendingReviewAssets.length > 1 ? "s" : ""}`,
      description: "Tenemos contenido listo para tu aprobación.",
      cta: "Revisar ahora",
      link: "/client/dashboard",
      priority: "high",
    });
  }
  clientTasksList.forEach((t) => {
    taskCards.push({
      id: t.id,
      title: t.title,
      description: t.description || undefined,
      cta: t.category === "client_input" ? "Subir / Enviar" : t.category === "review" ? "Revisar" : "Marcar hecho",
      link: t.category === "client_input" ? "/client/collect" : "/client/dashboard",
      priority: t.status === "blocked" ? "high" : "normal",
    });
  });

  const totalAssets = allAssets.length;
  const approvedCount = allAssets.filter((a) => a.status === "approved").length;
  const tasksDone = offeringTasks.filter((t) => t.status === "done").length;
  const tasksTotal = offeringTasks.length;
  const offeringName = activeOffering ? (activeOffering.custom_name || offeringTpl?.name || "Tu campaña") : null;

  // Status label (no money)
  const campaignStatus = (() => {
    if (!activeOffering) return { label: "Campaña en preparación", tone: "warning" as const };
    switch (activeOffering.status) {
      case "active": return { label: "🚀 Campaña activa", tone: "success" as const };
      case "completed": return { label: "✅ Campaña completada", tone: "success" as const };
      case "accepted": return { label: "Iniciando ejecución…", tone: "primary" as const };
      case "proposed": return { label: "Propuesta lista — esperando confirmación", tone: "warning" as const };
      default: return { label: "Campaña en preparación", tone: "warning" as const };
    }
  })();

  const statusToneClass =
    campaignStatus.tone === "success" ? "bg-[hsl(142,71%,35%)]/10 text-[hsl(142,71%,35%)] border-[hsl(142,71%,35%)]/30" :
    campaignStatus.tone === "warning" ? "bg-amber-500/10 text-amber-700 border-amber-500/30" :
    "bg-primary/10 text-primary border-primary/30";

  const visibleAssets = allAssets.filter((a) => ["pending_review", "approved", "deployed"].includes(a.status));
  const assetsByType = new Map<string, AssetItem[]>();
  visibleAssets.forEach((a) => {
    const arr = assetsByType.get(a.asset_type) || [];
    arr.push(a);
    assetsByType.set(a.asset_type, arr);
  });

  return (
    <div className="space-y-8">
      {/* SECTION A — Hero */}
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">Hola</p>
        <h1 className="text-3xl font-bold text-foreground">{clientName || "Bienvenido"}</h1>
        <p className="text-sm text-muted-foreground">{companyName}</p>
        <div className="pt-2">
          <Badge variant="outline" className={`text-sm py-1.5 px-3 ${statusToneClass}`}>
            {campaignStatus.label}
          </Badge>
        </div>
      </header>

      {/* SECTION B — Qué necesitamos de ti */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Qué necesitamos de ti</h2>
        </div>
        {taskCards.length === 0 ? (
          <div className="bg-[hsl(142,71%,35%)]/5 border border-[hsl(142,71%,35%)]/30 rounded-2xl p-5 flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-[hsl(142,71%,35%)] shrink-0" />
            <div>
              <p className="text-sm font-semibold text-foreground">Todo en orden</p>
              <p className="text-xs text-muted-foreground">Te avisamos en cuanto necesitemos algo de tu parte.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {taskCards.slice(0, 6).map((t) => (
              <div
                key={t.id}
                className={`bg-card border rounded-2xl p-4 flex flex-col gap-2 hover:shadow-md transition-shadow ${
                  t.priority === "high" ? "border-amber-500/40" : "border-border"
                }`}
              >
                <div className="flex items-start gap-2">
                  {t.priority === "high" && <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground leading-snug">{t.title}</p>
                    {t.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</p>}
                  </div>
                </div>
                <Button asChild size="sm" className="self-start mt-auto">
                  <Link to={t.link}>{t.cta} →</Link>
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* SECTION C — Tu campaña en números */}
      {activeOffering && offeringTpl && (
        <section className="bg-card rounded-2xl border border-border p-6 space-y-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tu plan</p>
              <h2 className="text-xl font-semibold text-foreground mt-0.5">{offeringName}</h2>
            </div>
            <Badge variant="outline" className={statusToneClass}>{campaignStatus.label}</Badge>
          </div>

          {/* Bullet description + steps — NO PRICING */}
          <OfferingDetails offering={offeringTpl} audience="client" />

          {/* Progress */}
          {tasksTotal > 0 && (
            <ProgressIndicator
              value={tasksDone / tasksTotal}
              label="Progreso del plan"
              sublabel={`${tasksDone}/${tasksTotal} pasos`}
              tone="success"
            />
          )}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Assets aprobados</p>
              <p className="text-2xl font-bold text-foreground mt-1">{approvedCount}<span className="text-sm font-normal text-muted-foreground"> / {totalAssets}</span></p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pasos completados</p>
              <p className="text-2xl font-bold text-foreground mt-1">{tasksDone}<span className="text-sm font-normal text-muted-foreground"> / {tasksTotal}</span></p>
            </div>
          </div>
        </section>
      )}

      {/* SECTION D — Tus assets */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Tus assets</h2>
        {visibleAssets.length === 0 ? (
          <EmptyState
            icon={<FileText />}
            title="Aún no hay assets disponibles"
            description="En cuanto generemos contenido, lo verás aquí listo para revisión."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Array.from(assetsByType.entries()).map(([type, list]) => {
              const Icon = typeIcons[type] || FileText;
              const pending = list.filter((a) => a.status === "pending_review").length;
              const approved = list.filter((a) => a.status === "approved").length;
              return (
                <div key={type} className="bg-card border border-border rounded-2xl p-4 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-secondary"><Icon className="w-5 h-5 text-foreground" /></div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-foreground">{typeLabels[type] || type}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {approved}/{list.length} aprobados
                        {pending > 0 && ` · ${pending} por revisar`}
                      </p>
                    </div>
                  </div>
                  {pending > 0 ? (
                    <Button asChild size="sm">
                      <Link to={`/client/assets/${type}`}>Revisar</Link>
                    </Button>
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-[hsl(142,71%,35%)] shrink-0 mt-1" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* SECTION E — Briefing (collapsed by default) */}
      <section>
        <Tabs defaultValue="brief">
          <TabsList>
            <TabsTrigger value="brief">Mi briefing completo</TabsTrigger>
            <TabsTrigger value="collect" className="relative">
              <Paperclip className="w-3.5 h-3.5 mr-1" /> Archivos solicitados
              {pendingRequestCount > 0 && (
                <Badge variant="destructive" className="ml-1.5 text-[10px] px-1.5 py-0 h-4 min-w-4">
                  {pendingRequestCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="brief" className="mt-4 space-y-3">
            {briefingAnswers ? (
              Object.entries(briefingFields).map(([section, fields]) => (
                <Collapsible key={section}>
                  <div className="bg-card rounded-xl border border-border overflow-hidden">
                    <CollapsibleTrigger className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors">
                      <h3 className="font-semibold text-foreground text-sm">{section}</h3>
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-4 pb-4">
                        {fields.map((f) => {
                          const val = (f as any).source === "prospect"
                            ? prospectData?.[f.key]
                            : briefingAnswers[f.key];
                          return <BriefingRow key={f.key} label={f.label} value={val} />;
                        })}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))
            ) : (
              <EmptyState icon={<FileText />} title="Briefing no disponible" description="Tu información de briefing aparecerá aquí." />
            )}
          </TabsContent>
          <TabsContent value="collect" className="mt-4">
            <div className="bg-card rounded-xl border border-border p-5">
              <p className="text-sm text-muted-foreground">
                Ve a la <Link to="/client/collect" className="text-primary underline">página de subida</Link> para enviar los archivos solicitados.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}
