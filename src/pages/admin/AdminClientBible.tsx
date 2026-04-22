import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Printer, AlertTriangle, Building2, FileText, MessageSquareQuote,
  Users, TrendingUp, Sparkles, ListChecks, Package, Image as ImageIcon, Layers
} from "lucide-react";

const FRESHNESS_DAYS = 60;

function isStale(dateStr: string | null | undefined): boolean {
  if (!dateStr) return true;
  const days = (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24);
  return days > FRESHNESS_DAYS;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

function Section({
  icon: Icon,
  title,
  updatedAt,
  empty,
  emptyMsg,
  children,
}: {
  icon: any;
  title: string;
  updatedAt?: string | null;
  empty?: boolean;
  emptyMsg?: string;
  children: React.ReactNode;
}) {
  const stale = updatedAt !== undefined && isStale(updatedAt);
  return (
    <section className="bg-card border border-border rounded-xl p-6 print:break-inside-avoid">
      <header className="flex items-center justify-between mb-4 pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-foreground">{title}</h2>
          {stale && (
            <Badge variant="secondary" className="text-xs gap-1 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-3 h-3" />Desactualizado
            </Badge>
          )}
        </div>
        {updatedAt !== undefined && (
          <span className="text-xs text-muted-foreground">Actualizado: {fmtDate(updatedAt)}</span>
        )}
      </header>
      {empty ? (
        <p className="text-sm text-muted-foreground italic">{emptyMsg || "Sin datos disponibles."}</p>
      ) : (
        children
      )}
    </section>
  );
}

function KV({ k, v }: { k: string; v: any }) {
  if (v === null || v === undefined || v === "") return null;
  return (
    <div className="grid grid-cols-[160px_1fr] gap-2 py-1 text-sm">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-foreground">{typeof v === "string" ? v : JSON.stringify(v)}</dd>
    </div>
  );
}

export default function AdminClientBible() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<any>(null);
  const [briefing, setBriefing] = useState<any>(null);
  const [kickoff, setKickoff] = useState<any>(null);
  const [voc, setVoc] = useState<any[]>([]);
  const [competitors, setCompetitors] = useState<any[]>([]);
  const [patterns, setPatterns] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [offerings, setOfferings] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [platforms, setPlatforms] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const [
        clientRes, briefRes, koRes, vocRes, compRes, patRes,
        rulesRes, offRes, taskRes, assetRes, platRes,
      ] = await Promise.all([
        supabase.from("clients").select("*").eq("id", id).maybeSingle(),
        supabase.from("briefing_submissions").select("*").eq("client_id", id).limit(1).maybeSingle(),
        supabase.from("kickoff_briefs").select("*").eq("client_id", id).limit(1).maybeSingle(),
        supabase.from("client_context_snapshots").select("*").eq("client_id", id).eq("snapshot_type", "voc").order("created_at", { ascending: false }),
        supabase.from("client_competitor_analyses").select("*").eq("client_id", id).order("created_at", { ascending: false }),
        supabase.from("client_winning_patterns").select("*").eq("client_id", id).order("created_at", { ascending: false }),
        supabase.from("pragma_rules").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("client_offerings").select("*, offering_templates(name, code, short_name, tier)").eq("client_id", id).order("created_at", { ascending: false }),
        supabase.from("action_plan_tasks").select("*, client_offerings!inner(client_id)").eq("client_offerings.client_id", id).order("order_index"),
        supabase.from("assets").select("id, asset_name, asset_title, asset_type, status, created_at").eq("client_id", id).order("created_at", { ascending: false }).limit(20),
        supabase.from("client_platforms").select("*, supported_platforms(name, category, icon)").eq("client_id", id),
      ]);

      setClient(clientRes.data);
      setBriefing(briefRes.data);
      setKickoff(koRes.data);
      setVoc(vocRes.data || []);
      setCompetitors(compRes.data || []);
      setPatterns(patRes.data || []);
      setRules(rulesRes.data || []);
      setOfferings(offRes.data || []);
      setTasks(taskRes.data || []);
      setAssets(assetRes.data || []);
      setPlatforms(platRes.data || []);
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-4 p-6 max-w-5xl mx-auto">
        <Skeleton className="h-12 w-1/2" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <p className="text-sm text-muted-foreground">Cliente no encontrado.</p>
        <Link to="/admin/clients" className="text-primary text-sm">← Volver</Link>
      </div>
    );
  }

  const briefingAnswers = briefing?.answers || {};
  const materials = (kickoff?.client_materials || {}) as any;
  const clientRules = (kickoff?.client_rules || []) as string[];
  const latestVoc = voc[0]?.context_data as any;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6 print:p-0 print:max-w-none">
      {/* Top bar — hidden on print */}
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" size="sm" asChild>
          <Link to={`/admin/client/${id}`}>
            <ArrowLeft className="w-4 h-4 mr-1" />Volver al cliente
          </Link>
        </Button>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="w-4 h-4 mr-1" />Imprimir / PDF
        </Button>
      </div>

      {/* Header */}
      <header className="border-b-2 border-border pb-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
          <Sparkles className="w-3 h-3" />Client Bible
        </div>
        <h1 className="text-3xl font-bold text-foreground mt-1">{client.company_name}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {client.vertical} / {client.sub_niche}{client.city ? ` · ${client.city}` : ""} · Mercado: {client.market?.toUpperCase()}
        </p>
      </header>

      {/* 1. Identity */}
      <Section icon={Building2} title="Identidad del cliente" updatedAt={client.created_at}>
        <dl className="divide-y divide-border">
          <KV k="Empresa" v={client.company_name} />
          <KV k="Contacto" v={client.name} />
          <KV k="Email" v={client.email} />
          <KV k="Vertical" v={`${client.vertical} / ${client.sub_niche}`} />
          <KV k="Ciudad" v={client.city} />
          <KV k="Mercado" v={client.market?.toUpperCase()} />
          <KV k="Website" v={client.website_url} />
          <KV k="Status" v={client.status} />
          <KV k="Pipeline" v={client.pipeline_status} />
        </dl>
      </Section>

      {/* 2. Briefing */}
      <Section
        icon={FileText}
        title="Respuestas del briefing"
        updatedAt={briefing?.created_at}
        empty={!briefing || Object.keys(briefingAnswers).length === 0}
        emptyMsg="El cliente aún no completó el briefing."
      >
        <dl className="divide-y divide-border">
          {Object.entries(briefingAnswers).map(([k, v]) => (
            <KV key={k} k={k} v={v as any} />
          ))}
        </dl>
      </Section>

      {/* 3. Kickoff */}
      <Section
        icon={MessageSquareQuote}
        title="Kickoff call"
        updatedAt={kickoff?.created_at}
        empty={!kickoff?.transcript_text}
        emptyMsg="Sin transcripción de kickoff."
      >
        <dl className="divide-y divide-border">
          <KV k="Calidad transcripción" v={kickoff?.transcript_quality} />
          <KV k="Tono preferido" v={kickoff?.preferred_tone} />
          <KV k="Voice reference" v={kickoff?.voice_reference} />
          <KV k="Score contexto" v={kickoff?.context_completeness_score ? `${kickoff.context_completeness_score}%` : null} />
        </dl>
        {kickoff?.transcript_text && (
          <details className="mt-3">
            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
              Ver transcripción completa ({kickoff.transcript_text.length} caracteres)
            </summary>
            <pre className="mt-2 text-xs bg-secondary/30 p-3 rounded whitespace-pre-wrap max-h-96 overflow-auto">
              {kickoff.transcript_text}
            </pre>
          </details>
        )}
      </Section>

      {/* 4. Voice of Customer */}
      <Section
        icon={MessageSquareQuote}
        title="Voice of Customer"
        updatedAt={voc[0]?.created_at}
        empty={voc.length === 0}
        emptyMsg="Aún no se ha extraído VoC. Lánzalo desde Kickoff → Discovery."
      >
        {latestVoc && (
          <div className="space-y-4 text-sm">
            {latestVoc.summary && <p className="text-foreground">{latestVoc.summary}</p>}
            {latestVoc.jtbd?.length > 0 && (
              <div>
                <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Jobs to be done</h4>
                <ul className="list-disc list-inside space-y-0.5">{latestVoc.jtbd.map((j: string, i: number) => <li key={i}>{j}</li>)}</ul>
              </div>
            )}
            {latestVoc.objections?.length > 0 && (
              <div>
                <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Objeciones</h4>
                <ul className="list-disc list-inside space-y-0.5">{latestVoc.objections.map((o: string, i: number) => <li key={i}>{o}</li>)}</ul>
              </div>
            )}
            {latestVoc.real_phrases?.length > 0 && (
              <div>
                <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Frases reales</h4>
                <div className="flex flex-wrap gap-2">
                  {latestVoc.real_phrases.map((p: string, i: number) => (
                    <Badge key={i} variant="secondary" className="text-xs font-normal whitespace-normal text-left">"{p}"</Badge>
                  ))}
                </div>
              </div>
            )}
            {latestVoc.emotional_drivers?.length > 0 && (
              <div>
                <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Drivers emocionales</h4>
                <p>{latestVoc.emotional_drivers.join(" · ")}</p>
              </div>
            )}
          </div>
        )}
      </Section>

      {/* 5. Competitors */}
      <Section
        icon={Users}
        title="Competidores locales"
        updatedAt={competitors[0]?.analyzed_at || competitors[0]?.created_at}
        empty={competitors.length === 0}
        emptyMsg="Sin análisis de competidores."
      >
        <div className="space-y-3">
          {competitors.filter((c) => c.status === "completed").map((c) => (
            <div key={c.id} className="border border-border rounded-lg p-3 bg-secondary/10">
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-medium text-sm">{c.competitor_name || c.competitor_url}</h4>
                <span className="text-xs text-muted-foreground">{fmtDate(c.analyzed_at)}</span>
              </div>
              {c.ai_summary && <p className="text-sm text-foreground mb-2">{c.ai_summary}</p>}
              {c.positioning_gaps?.length > 0 && (
                <div className="text-xs">
                  <span className="text-muted-foreground">Oportunidades: </span>
                  {c.positioning_gaps.join(" · ")}
                </div>
              )}
              {c.hooks?.length > 0 && (
                <div className="text-xs mt-1">
                  <span className="text-muted-foreground">Hooks observados: </span>
                  {c.hooks.slice(0, 3).join(" · ")}
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* 6. Winning patterns */}
      <Section
        icon={TrendingUp}
        title="Patrones ganadores"
        updatedAt={patterns[0]?.created_at}
        empty={patterns.length === 0}
        emptyMsg="Sin patrones extraídos. Carga assets performantes en Kickoff → Discovery."
      >
        <div className="space-y-3">
          {patterns.map((p) => {
            const ext = (p.extracted_patterns || {}) as any;
            return (
              <div key={p.id} className="border border-border rounded-lg p-3 bg-secondary/10">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-medium text-sm">{p.source_label || p.asset_type || "Asset"}</h4>
                  {p.performance_metric && <Badge variant="secondary" className="text-xs">{p.performance_metric}</Badge>}
                </div>
                {ext.replicable_formula && <p className="text-sm text-foreground">{ext.replicable_formula}</p>}
                {ext.hook_pattern && <p className="text-xs text-muted-foreground mt-1"><strong>Hook:</strong> {ext.hook_pattern}</p>}
              </div>
            );
          })}
        </div>
      </Section>

      {/* 7. Rules */}
      <Section
        icon={ListChecks}
        title="Reglas activas"
        empty={rules.length === 0 && clientRules.length === 0}
      >
        {clientRules.length > 0 && (
          <div className="mb-3">
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Reglas del cliente</h4>
            <ul className="list-disc list-inside text-sm space-y-0.5">
              {clientRules.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        )}
        {rules.length > 0 && (
          <div>
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Reglas Pragma globales</h4>
            <ul className="list-disc list-inside text-sm space-y-0.5">
              {rules.map((r) => <li key={r.id}><strong>{r.name}:</strong> {r.content}</li>)}
            </ul>
          </div>
        )}
      </Section>

      {/* 8. Materials */}
      <Section
        icon={ImageIcon}
        title="Materiales de marca"
        empty={!materials || Object.keys(materials).length === 0}
      >
        <dl className="divide-y divide-border">
          <KV k="Color primario" v={materials.primary_color} />
          <KV k="Color secundario" v={materials.secondary_color} />
          <KV k="Logo" v={materials.logo_url} />
          <KV k="Tags de marca" v={materials.brand_tags?.join(", ")} />
          <KV k="Web analizada" v={materials.website_context ? `${materials.website_context.length} chars` : null} />
          <KV k="Pricing PDF" v={materials.pricing_pdf_text ? `${materials.pricing_pdf_text.length} chars` : null} />
          <KV k="Fotos" v={materials.photos?.length ? `${materials.photos.length} archivo(s)` : null} />
        </dl>
      </Section>

      {/* 9. Platforms */}
      <Section
        icon={Layers}
        title="Plataformas conectadas"
        empty={platforms.length === 0}
      >
        <div className="grid grid-cols-2 gap-2 text-sm">
          {platforms.map((p) => (
            <div key={p.id} className="flex items-center justify-between border border-border rounded p-2">
              <span>{p.supported_platforms?.name}</span>
              <Badge variant={p.has_access ? "default" : "secondary"} className="text-xs">
                {p.has_access ? "Acceso ✓" : "Sin acceso"}
              </Badge>
            </div>
          ))}
        </div>
      </Section>

      {/* 10. Offerings & Action Plan */}
      <Section
        icon={Package}
        title="Servicios activos y action plan"
        empty={offerings.length === 0}
      >
        <div className="space-y-4">
          {offerings.map((o) => {
            const offTasks = tasks.filter((t) => t.client_offering_id === o.id);
            const completed = offTasks.filter((t) => t.status === "completed" || t.status === "done").length;
            return (
              <div key={o.id} className="border border-border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="font-medium text-sm">{o.custom_name || o.offering_templates?.name}</h4>
                    <p className="text-xs text-muted-foreground">Tier {o.offering_templates?.tier} · {o.status}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs">{completed}/{offTasks.length} tareas</Badge>
                </div>
                {offTasks.length > 0 && (
                  <ul className="text-xs space-y-0.5 mt-2">
                    {offTasks.slice(0, 5).map((t) => (
                      <li key={t.id} className="flex items-center gap-2">
                        <span className={t.status === "completed" || t.status === "done" ? "line-through text-muted-foreground" : ""}>
                          {t.title}
                        </span>
                      </li>
                    ))}
                    {offTasks.length > 5 && <li className="text-muted-foreground">... y {offTasks.length - 5} más</li>}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      {/* 11. Recent assets */}
      <Section
        icon={ImageIcon}
        title="Assets recientes"
        empty={assets.length === 0}
      >
        <ul className="text-sm space-y-1">
          {assets.map((a) => (
            <li key={a.id} className="flex items-center justify-between border-b border-border py-1">
              <span>{a.asset_title || a.asset_name} <span className="text-xs text-muted-foreground">({a.asset_type})</span></span>
              <Badge variant="secondary" className="text-xs">{a.status}</Badge>
            </li>
          ))}
        </ul>
      </Section>

      <footer className="text-center text-xs text-muted-foreground pt-6 border-t border-border print:mt-12">
        Pragma Marketers · Client Bible · Generado el {new Date().toLocaleString("es-ES")}
      </footer>
    </div>
  );
}
