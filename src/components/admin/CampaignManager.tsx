import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { uploadClientAsset } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import {
  Plus, Loader2, Sparkles, Target, Users, MessageSquare, Calendar,
  Pencil, ChevronDown, ChevronUp, Upload, FileText, Mail, Image, PenTool,
  X, Eye, ExternalLink, Wrench, Bell, AlertTriangle, Wand2,
  Download, Trash2, Archive, ArchiveRestore, Star, MoreVertical, Copy, Check, RefreshCw, Bot,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AssetFeedbackPanel } from "@/components/admin/AssetFeedbackPanel";
import { CorrectionPromptPanel } from "@/components/admin/CorrectionPromptPanel";
import { AssetVisualPreview } from "@/components/admin/AssetVisualPreview";
import { AssetQABadge } from "@/components/admin/AssetQABadge";

// ─── Types ──────────────────────────────────────────────
type Campaign = {
  id: string;
  name: string;
  description: string;
  objective: string;
  target_audience: string;
  key_message: string;
  timeline: string;
  status: string;
  created_at: string;
  updated_at: string;
  last_notified_at: string | null;
};

type AssetRow = {
  id: string;
  asset_name: string;
  asset_type: string;
  status: string;
  file_url: string | null;
  content: any;
  version: number;
  client_comment: string | null;
  correction_prompt: string | null;
  created_at: string;
  campaign_id: string | null;
  production_status?: string | null;
};

interface CampaignManagerProps {
  clientId: string;
  campaigns: Campaign[];
  assets: AssetRow[];
  promptsTabContent?: React.ReactNode;
  onCampaignCreated: (c: Campaign) => void;
  onCampaignUpdated: (c: Campaign) => void;
  onAssetsChanged?: () => void;
}

// ─── Helpers ────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-[hsl(var(--status-approved))]/10 text-[hsl(var(--status-approved))] border-[hsl(var(--status-approved))]/30",
  completed: "bg-primary/10 text-primary border-primary/30",
};

const ASSET_TYPE_ICONS: Record<string, any> = {
  landing_page: FileText,
  email_flow: Mail,
  social_post: Image,
  blog_article: PenTool,
};

const ASSET_TYPE_LABELS: Record<string, string> = {
  landing_page: "LP",
  email_flow: "Email",
  social_post: "Social",
  blog_article: "Blog",
};

const ASSET_TYPE_FULL: Record<string, string> = {
  landing_page: "Landing Page",
  email_flow: "Email Flow",
  social_post: "Social Posts",
  blog_article: "Blog Article",
};

function assetStatusIcon(status: string) {
  switch (status) {
    case "approved": return "✅";
    case "pending_review": return "⏳";
    case "change_requested": return "💬";
    default: return "⚪";
  }
}

function assetStatusLabel(status: string) {
  switch (status) {
    case "approved": return "Approved";
    case "pending_review": return "Pending review";
    case "change_requested": return "Changes requested";
    default: return "Not notified";
  }
}

function computeCampaignStatus(campaignAssets: AssetRow[]): string {
  if (campaignAssets.length === 0) return "draft";
  if (campaignAssets.every((a) => a.status === "approved")) return "completed";
  return "active";
}

// ─── Asset Status Summary Row ───────────────────────────
function AssetTypeSummary({ assets }: { assets: AssetRow[] }) {
  const types = ["landing_page", "email_flow", "social_post", "blog_article"] as const;
  const present = types.filter((t) => assets.some((a) => a.asset_type === t));
  if (present.length === 0) return <span className="text-xs text-muted-foreground">No assets</span>;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {present.map((t) => {
        const typeAssets = assets.filter((a) => a.asset_type === t);
        const allApproved = typeAssets.every((a) => a.status === "approved");
        const hasChangeReq = typeAssets.some((a) => a.status === "change_requested");
        const hasPending = typeAssets.some((a) => a.status === "pending_review");
        const icon = allApproved ? "✅" : hasChangeReq ? "💬" : hasPending ? "⏳" : "⚪";
        return (
          <span key={t} className="text-xs text-muted-foreground">
            {ASSET_TYPE_LABELS[t]} {icon}
          </span>
        );
      })}
    </div>
  );
}

// ─── Markdown export helper ─────────────────────────────
function assetToMarkdown(asset: { asset_name: string; asset_type: string; content: any; version: number }): string {
  const c = asset.content || {};
  const title = `# ${asset.asset_name} (v${asset.version || 1})`;
  const lines: string[] = [title, ""];

  if (asset.asset_type === "landing_page") {
    if (c.meta) {
      lines.push(`> **SEO title:** ${c.meta.seo_title || ""}`);
      lines.push(`> **SEO description:** ${c.meta.seo_description || ""}`, "");
    }
    if (c.hero) {
      lines.push(`## Hero`, `### ${c.hero.headline || ""}`, c.hero.subheadline || "", "");
      if (c.hero.cta_primary) lines.push(`**CTA:** ${c.hero.cta_primary}`, "");
      if (Array.isArray(c.hero.trust_badges)) lines.push(...c.hero.trust_badges.map((b: string) => `- ${b}`), "");
    }
    if (c.problem_section) {
      lines.push(`## ${c.problem_section.title || "Problem"}`, "");
      (c.problem_section.pain_points || []).forEach((p: string) => lines.push(`- ${p}`));
      lines.push("");
    }
    if (c.solution_section) {
      lines.push(`## ${c.solution_section.title || "Solution"}`, c.solution_section.description || "", "");
      (c.solution_section.benefits || []).forEach((b: any) => {
        lines.push(`### ${b.title}`, b.description || "", "");
      });
    }
    if (c.social_proof) {
      lines.push(`## ${c.social_proof.title || "Social proof"}`, "");
      (c.social_proof.testimonials || []).forEach((t: any) => {
        lines.push(`> "${t.quote}"`, `> — **${t.author}**, ${t.detail}`, "");
      });
    }
    if (c.offer_section) {
      lines.push(`## ${c.offer_section.title || "Offer"}`, c.offer_section.description || "", "");
      (c.offer_section.bullets || []).forEach((b: string) => lines.push(`- ${b}`));
      if (c.offer_section.cta) lines.push("", `**CTA:** ${c.offer_section.cta}`);
      if (c.offer_section.urgency) lines.push(`_${c.offer_section.urgency}_`, "");
    }
    if (Array.isArray(c.faq) && c.faq.length) {
      lines.push(`## FAQ`, "");
      c.faq.forEach((f: any) => lines.push(`**${f.q}**`, "", f.a, ""));
    }
    if (c.final_cta) {
      lines.push(`## ${c.final_cta.headline || "Final CTA"}`, `**Button:** ${c.final_cta.button || ""}`, c.final_cta.reassurance || "");
    }
  } else if (asset.asset_type === "email_flow") {
    if (c.flow_name) lines.push(`**Flow:** ${c.flow_name}`);
    if (c.flow_objective) lines.push(`**Objective:** ${c.flow_objective}`);
    if (c.target_segment) lines.push(`**Segment:** ${c.target_segment}`);
    lines.push("");
    (c.emails || []).forEach((e: any, i: number) => {
      lines.push(`---`, "", `## Email ${i + 1} — Day ${e.day_offset ?? "?"}`, "");
      lines.push(`**Subject:** ${e.subject || ""}`);
      lines.push(`**Preview:** ${e.preview_text || ""}`, "");
      lines.push(e.body_markdown || e.body || "", "");
      lines.push(`**CTA:** ${e.cta_text || e.cta || ""}`);
      if (e.cta_purpose) lines.push(`_Purpose:_ ${e.cta_purpose}`);
      lines.push("");
    });
    if (c.success_metric) lines.push(`---`, "", `**Success metric:** ${c.success_metric}`);
  } else if (asset.asset_type === "social_post") {
    if (c.platform) lines.push(`**Platform:** ${c.platform} · **Format:** ${c.format || ""}`, "");
    if (c.hook) lines.push(`## Hook`, c.hook, "");
    if (c.caption) lines.push(`## Caption`, c.caption, "");
    if (Array.isArray(c.hashtags)) lines.push(`## Hashtags`, c.hashtags.map((h: string) => `#${h.replace(/^#/, "")}`).join(" "), "");
    if (c.cta) lines.push(`**CTA:** ${c.cta}`, "");
    if (c.visual_brief) lines.push(`## Visual brief`, c.visual_brief, "");
    if (Array.isArray(c.carousel_slides)) {
      lines.push(`## Carousel slides`, "");
      c.carousel_slides.forEach((s: any) => lines.push(`### Slide ${s.slide_number}: ${s.headline}`, s.body, ""));
    }
  } else if (asset.asset_type === "blog_article") {
    if (c.seo_title) lines.push(`> **SEO title:** ${c.seo_title}`);
    if (c.seo_description) lines.push(`> **SEO description:** ${c.seo_description}`);
    if (c.slug) lines.push(`> **Slug:** /${c.slug}`);
    if (c.target_keyword) lines.push(`> **Keyword:** ${c.target_keyword}`, "");
    if (c.h1) lines.push(`# ${c.h1}`, "");
    if (c.intro) lines.push(c.intro, "");
    (c.sections || []).forEach((s: any) => {
      lines.push(`## ${s.h2 || s.heading || ""}`, "", s.body_markdown || s.body || "", "");
    });
    if (c.conclusion) lines.push(`## Conclusion`, c.conclusion, "");
  } else {
    lines.push("```json", JSON.stringify(c, null, 2), "```");
  }
  return lines.join("\n");
}

function downloadMarkdown(asset: { asset_name: string; asset_type: string; content: any; version: number }) {
  const md = assetToMarkdown(asset);
  const safeName = asset.asset_name.replace(/[^a-z0-9-_]+/gi, "_").slice(0, 60);
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeName}_v${asset.version || 1}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── AI Feedback Box (per asset) ────────────────────────
function AiFeedbackBox({
  asset,
  regenerating,
  onRegenerate,
  onSavedPrompt,
}: {
  asset: any;
  regenerating: boolean;
  onRegenerate: () => Promise<void> | void;
  onSavedPrompt?: () => void;
}) {
  const [prompt, setPrompt] = useState<string>(asset.correction_prompt || "");
  const [saving, setSaving] = useState(false);
  const [requestingQa, setRequestingQa] = useState(false);

  const savePrompt = async () => {
    setSaving(true);
    try {
      const { error } = await (supabase.from("assets") as any)
        .update({ correction_prompt: prompt || null })
        .eq("id", asset.id);
      if (error) throw error;
      toast.success("Indicaciones guardadas.");
      onSavedPrompt?.();
    } catch (e: any) {
      toast.error(e.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const saveAndRegenerate = async () => {
    await savePrompt();
    await onRegenerate();
  };

  const requestAiFeedback = async () => {
    setRequestingQa(true);
    try {
      const { data, error } = await supabase.functions.invoke("qa-asset-review", {
        body: { asset_id: asset.id, force: true },
      });
      if (error) {
        const ctx: any = (error as any).context;
        let parsed: any = null;
        try {
          if (ctx && typeof ctx.json === "function") parsed = await ctx.json();
          else if (ctx && typeof ctx.text === "function") {
            const t = await ctx.text();
            try { parsed = JSON.parse(t); } catch { parsed = { error: t }; }
          }
        } catch {}
        const msg = (parsed?.error as string) || (error as any).message || "";
        if (msg.includes("402") || msg.includes("payment") || msg.includes("credits")) {
          toast.error("Sin créditos en Lovable AI", {
            description: "Recarga el workspace para usar la IA.",
            action: { label: "Recargar", onClick: () => window.open("https://lovable.dev/settings/workspace", "_blank") },
          });
        } else if (msg.includes("429") || msg.includes("Rate")) {
          toast.error("Demasiadas peticiones, reintenta en unos segundos.");
        } else {
          toast.error("Error al pedir feedback", { description: msg });
        }
        return;
      }
      if (data?.error === "PAYMENT_REQUIRED") {
        toast.error("Sin créditos en Lovable AI", {
          description: "Recarga el workspace para usar la IA.",
          action: { label: "Recargar", onClick: () => window.open("https://lovable.dev/settings/workspace", "_blank") },
        });
        return;
      }
      if (data?.error === "RATE_LIMITED") {
        toast.error("Demasiadas peticiones, reintenta en unos segundos.");
        return;
      }
      if (data?.skipped) {
        toast.info(`QA omitida: ${data.reason || data.error || ""}`);
        return;
      }
      const r = data?.report;
      if (!r) {
        toast.error("La IA no devolvió un reporte.");
        return;
      }
      const lines: string[] = [];
      lines.push(`Feedback IA (Score ${r.overall_score ?? "?"}/100${r.blocked ? " · BLOQUEADO" : ""})`);
      if (r.summary) lines.push(r.summary);
      if (Array.isArray(r.warnings) && r.warnings.length) {
        lines.push("");
        lines.push("Avisos:");
        r.warnings.forEach((w: any) => lines.push(`- ${typeof w === "string" ? w : w?.message || JSON.stringify(w)}`));
      }
      if (Array.isArray(r.rules_violated) && r.rules_violated.length) {
        lines.push("");
        lines.push("Reglas incumplidas:");
        r.rules_violated.forEach((w: any) => lines.push(`- ${typeof w === "string" ? w : w?.rule || JSON.stringify(w)}`));
      }
      if (Array.isArray(r.recommendations) && r.recommendations.length) {
        lines.push("");
        lines.push("Recomendaciones:");
        r.recommendations.forEach((w: any) => lines.push(`- ${typeof w === "string" ? w : w?.text || JSON.stringify(w)}`));
      }
      const block = lines.join("\n");
      setPrompt((prev) => (prev?.trim() ? `${prev.trim()}\n\n${block}` : block));
      toast.success("Feedback IA añadido. Edítalo y pulsa 'Generar nueva versión'.");
    } finally {
      setRequestingQa(false);
    }
  };

  return (
    <div className="mt-6 rounded-lg border border-border bg-secondary/30 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <h4 className="text-sm font-semibold">Indicaciones para la IA</h4>
      </div>
      <p className="text-xs text-muted-foreground">
        Escribe qué quieres cambiar en este asset (tono, secciones, CTA, longitud...). La IA usará estas instrucciones para generar la siguiente versión.
      </p>
      {asset.client_comment && (
        <div className="rounded-md bg-background border border-border p-2 text-xs">
          <span className="font-medium text-muted-foreground">Comentario del cliente: </span>
          <span>{asset.client_comment}</span>
        </div>
      )}
      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Ej: haz el hero más directo, acorta el body del segundo email, sustituye la CTA por 'Reserva ahora'..."
        className="min-h-[100px] bg-background"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={requestAiFeedback}
          disabled={requestingQa || saving || regenerating}
          title="Pide a la IA QA que evalúe este asset y pega sus observaciones aquí."
        >
          {requestingQa ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Bot className="w-3.5 h-3.5 mr-1.5" />}
          Pedir feedback IA
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={savePrompt} disabled={saving || regenerating} title="Solo guarda el texto. No regenera el asset.">
            {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
            Guardar indicaciones
          </Button>
          <Button size="sm" onClick={saveAndRegenerate} disabled={saving || regenerating} title="Guarda y crea una nueva versión del asset usando estas indicaciones.">
            {regenerating ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
            Generar nueva versión
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Generated Content Viewer ───────────────────────────
function AssetContentView({ assetType, content, fileUrl }: { assetType: string; content: any; fileUrl: string | null }) {
  if (!content || Object.keys(content).length === 0) {
    return <p className="text-sm text-muted-foreground italic">No generated content yet.</p>;
  }

  // ── Landing page ──
  if (assetType === "landing_page") {
    return (
      <div className="space-y-4 text-sm">
        {content.meta && (
          <section className="p-3 rounded-md bg-muted/40 border border-border text-xs text-muted-foreground">
            <div><span className="font-medium text-foreground">SEO title:</span> {content.meta.seo_title}</div>
            <div><span className="font-medium text-foreground">SEO description:</span> {content.meta.seo_description}</div>
          </section>
        )}
        {content.hero && (
          <section className="p-4 rounded-lg bg-secondary/30 border border-border">
            <h3 className="font-semibold text-foreground mb-2">Hero</h3>
            {content.hero.headline && <p className="text-lg font-bold text-foreground">{content.hero.headline}</p>}
            {content.hero.subheadline && <p className="text-muted-foreground mt-1">{content.hero.subheadline}</p>}
            {content.hero.cta_primary && <Badge className="mt-2">{content.hero.cta_primary}</Badge>}
            {Array.isArray(content.hero.trust_badges) && content.hero.trust_badges.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1">
                {content.hero.trust_badges.map((b: string, i: number) => (
                  <li key={i}><Badge variant="outline" className="text-[10px]">{b}</Badge></li>
                ))}
              </ul>
            )}
          </section>
        )}
        {content.problem_section && (
          <section className="p-4 rounded-lg bg-secondary/30 border border-border">
            <h3 className="font-semibold text-foreground mb-2">{content.problem_section.title || "Problem"}</h3>
            <ul className="list-disc pl-5 space-y-1 text-foreground">
              {(content.problem_section.pain_points || []).map((p: string, i: number) => <li key={i}>{p}</li>)}
            </ul>
          </section>
        )}
        {content.solution_section && (
          <section className="p-4 rounded-lg bg-secondary/30 border border-border">
            <h3 className="font-semibold text-foreground mb-2">{content.solution_section.title || "Solution"}</h3>
            {content.solution_section.description && <p className="text-foreground mb-3">{content.solution_section.description}</p>}
            <div className="grid gap-2">
              {(content.solution_section.benefits || []).map((b: any, i: number) => (
                <div key={i} className="p-2.5 rounded bg-background border border-border">
                  <p className="font-medium text-foreground">{b.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{b.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}
        {content.social_proof && (
          <section className="p-4 rounded-lg bg-secondary/30 border border-border">
            <h3 className="font-semibold text-foreground mb-2">{content.social_proof.title || "Social proof"}</h3>
            <div className="space-y-2">
              {(content.social_proof.testimonials || []).map((t: any, i: number) => (
                <blockquote key={i} className="border-l-2 border-primary/40 pl-3 py-1">
                  <p className="text-foreground italic">"{t.quote}"</p>
                  <p className="text-xs text-muted-foreground mt-1">— {t.author}, {t.detail}</p>
                </blockquote>
              ))}
            </div>
          </section>
        )}
        {content.offer_section && (
          <section className="p-4 rounded-lg bg-secondary/30 border border-border">
            <h3 className="font-semibold text-foreground mb-2">{content.offer_section.title || "Offer"}</h3>
            {content.offer_section.description && <p className="text-foreground mb-2">{content.offer_section.description}</p>}
            <ul className="list-disc pl-5 space-y-1 text-foreground">
              {(content.offer_section.bullets || []).map((b: string, i: number) => <li key={i}>{b}</li>)}
            </ul>
            {content.offer_section.cta && <Badge className="mt-2">{content.offer_section.cta}</Badge>}
            {content.offer_section.urgency && <p className="text-xs text-muted-foreground mt-2 italic">{content.offer_section.urgency}</p>}
          </section>
        )}
        {Array.isArray(content.faq) && content.faq.length > 0 && (
          <section className="p-4 rounded-lg bg-secondary/30 border border-border">
            <h3 className="font-semibold text-foreground mb-2">FAQ</h3>
            <div className="space-y-3">
              {content.faq.map((f: any, i: number) => (
                <div key={i}>
                  <p className="font-medium text-foreground">{f.q || f.question}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{f.a || f.answer}</p>
                </div>
              ))}
            </div>
          </section>
        )}
        {content.final_cta && (
          <section className="p-4 rounded-lg bg-primary/10 border border-primary/30">
            <h3 className="font-semibold text-foreground mb-1">{content.final_cta.headline || "Final CTA"}</h3>
            {content.final_cta.button && <Badge className="mt-1">{content.final_cta.button}</Badge>}
            {content.final_cta.reassurance && <p className="text-xs text-muted-foreground mt-2">{content.final_cta.reassurance}</p>}
          </section>
        )}
      </div>
    );
  }

  // ── Email flow ──
  if (assetType === "email_flow") {
    const emails = Array.isArray(content.emails) ? content.emails : (content.subject ? [content] : []);
    return (
      <div className="space-y-4 text-sm">
        {(content.flow_name || content.flow_objective || content.target_segment) && (
          <section className="p-3 rounded-md bg-muted/40 border border-border text-xs space-y-0.5">
            {content.flow_name && <div><span className="font-medium text-foreground">Flow:</span> {content.flow_name}</div>}
            {content.flow_objective && <div><span className="font-medium text-foreground">Objective:</span> {content.flow_objective}</div>}
            {content.target_segment && <div><span className="font-medium text-foreground">Segment:</span> {content.target_segment}</div>}
          </section>
        )}
        {emails.map((email: any, i: number) => (
          <section key={i} className="rounded-lg border border-border overflow-hidden">
            <div className="p-3 bg-secondary/40 border-b border-border">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="text-[10px]">Email {i + 1}</Badge>
                {typeof email.day_offset === "number" && (
                  <Badge variant="outline" className="text-[10px]">Day {email.day_offset}</Badge>
                )}
              </div>
              {email.subject && <p className="font-semibold text-foreground">{email.subject}</p>}
              {email.preview_text && <p className="text-xs text-muted-foreground italic mt-0.5">{email.preview_text}</p>}
            </div>
            <div className="p-4 bg-background space-y-3">
              {(email.body_markdown || email.body) && (
                <div className="text-foreground whitespace-pre-wrap leading-relaxed">
                  {email.body_markdown || email.body}
                </div>
              )}
              {(email.cta_text || email.cta) && (
                <div className="pt-2 border-t border-border">
                  <Badge className="mr-2">{email.cta_text || email.cta}</Badge>
                  {email.cta_purpose && <span className="text-xs text-muted-foreground italic">{email.cta_purpose}</span>}
                </div>
              )}
            </div>
          </section>
        ))}
        {content.success_metric && (
          <section className="p-3 rounded-md bg-primary/5 border border-primary/20 text-xs">
            <span className="font-medium text-foreground">Success metric:</span> {content.success_metric}
          </section>
        )}
      </div>
    );
  }

  // ── Social post ──
  if (assetType === "social_post") {
    return (
      <div className="space-y-3 text-sm">
        {(content.platform || content.format) && (
          <div className="flex gap-2">
            {content.platform && <Badge variant="outline" className="text-xs">{content.platform}</Badge>}
            {content.format && <Badge variant="outline" className="text-xs">{content.format}</Badge>}
          </div>
        )}
        {content.hook && (
          <section className="p-4 rounded-lg bg-secondary/30 border border-border">
            <h3 className="font-semibold text-foreground mb-1">Hook</h3>
            <p className="text-foreground whitespace-pre-wrap text-base">{content.hook}</p>
          </section>
        )}
        {content.caption && (
          <section className="p-4 rounded-lg bg-secondary/30 border border-border">
            <h3 className="font-semibold text-foreground mb-1">Caption</h3>
            <p className="text-foreground whitespace-pre-wrap leading-relaxed">{content.caption}</p>
          </section>
        )}
        {Array.isArray(content.hashtags) && content.hashtags.length > 0 && (
          <section className="p-4 rounded-lg bg-secondary/30 border border-border">
            <h3 className="font-semibold text-foreground mb-1">Hashtags</h3>
            <p className="text-primary text-sm">{content.hashtags.map((h: string) => `#${h.replace(/^#/, "")}`).join(" ")}</p>
          </section>
        )}
        {content.cta && (
          <section className="p-3 rounded-md bg-primary/10 border border-primary/30 text-sm">
            <span className="font-medium">CTA:</span> {content.cta}
          </section>
        )}
        {content.visual_brief && (
          <section className="p-4 rounded-lg bg-secondary/30 border border-border">
            <h3 className="font-semibold text-foreground mb-1">Visual brief</h3>
            <p className="text-foreground whitespace-pre-wrap">{content.visual_brief}</p>
          </section>
        )}
        {Array.isArray(content.carousel_slides) && content.carousel_slides.length > 0 && (
          <section className="p-4 rounded-lg bg-secondary/30 border border-border">
            <h3 className="font-semibold text-foreground mb-2">Carousel slides</h3>
            <div className="space-y-2">
              {content.carousel_slides.map((s: any) => (
                <div key={s.slide_number} className="p-3 rounded bg-background border border-border">
                  <p className="text-xs text-muted-foreground">Slide {s.slide_number}</p>
                  <p className="font-medium text-foreground">{s.headline}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{s.body}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  // ── Blog article ──
  if (assetType === "blog_article") {
    return (
      <article className="text-foreground space-y-3 text-sm">
        {(content.seo_title || content.seo_description || content.target_keyword) && (
          <section className="p-3 rounded-md bg-muted/40 border border-border text-xs space-y-0.5">
            {content.seo_title && <div><span className="font-medium">SEO title:</span> {content.seo_title}</div>}
            {content.seo_description && <div><span className="font-medium">SEO description:</span> {content.seo_description}</div>}
            {content.slug && <div><span className="font-medium">Slug:</span> /{content.slug}</div>}
            {content.target_keyword && <div><span className="font-medium">Keyword:</span> {content.target_keyword}</div>}
          </section>
        )}
        {content.h1 && <h1 className="text-2xl font-bold">{content.h1}</h1>}
        {content.intro && <p className="text-muted-foreground italic leading-relaxed">{content.intro}</p>}
        {Array.isArray(content.sections) && content.sections.map((s: any, i: number) => (
          <section key={i}>
            {(s.h2 || s.heading) && <h2 className="text-lg font-semibold mt-4">{s.h2 || s.heading}</h2>}
            {(s.body_markdown || s.body) && <p className="whitespace-pre-wrap leading-relaxed mt-1">{s.body_markdown || s.body}</p>}
          </section>
        ))}
        {content.conclusion && (
          <section>
            <h2 className="text-lg font-semibold mt-4">Conclusion</h2>
            <p className="whitespace-pre-wrap leading-relaxed mt-1">{content.conclusion}</p>
          </section>
        )}
      </article>
    );
  }

  // Fallback: raw JSON
  return (
    <div className="space-y-2">
      {fileUrl && (
        <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
          <ExternalLink className="w-3.5 h-3.5" /> Open file
        </a>
      )}
      <pre className="text-xs bg-secondary/30 p-3 rounded-md border border-border overflow-x-auto whitespace-pre-wrap">
        {JSON.stringify(content, null, 2)}
      </pre>
    </div>
  );
}

// ─── Campaign Card (Asset inside) ───────────────────────
function AssetCard({
  asset,
  campaigns,
  clientId,
  onAssignCampaign,
  onChanged,
}: {
  asset: AssetRow;
  campaigns: Campaign[];
  clientId: string;
  onAssignCampaign?: (assetId: string, campaignId: string) => void;
  onChanged?: () => void;
}) {
  const Icon = ASSET_TYPE_ICONS[asset.asset_type] || FileText;
  const isImage = asset.file_url?.match(/\.(png|jpg|jpeg|webp|gif)$/i);
  const [regenerating, setRegenerating] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(asset.asset_name);
  const [savingName, setSavingName] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  const hasContent = asset.content && Object.keys(asset.content).length > 0;
  const isArchived = asset.production_status === "archived";
  const isSelected = asset.production_status === "selected_for_client";

  const statusBadgeClass =
    asset.status === "approved"
      ? "bg-[hsl(var(--status-approved))]/15 text-[hsl(var(--status-approved))] border-[hsl(var(--status-approved))]/30"
      : asset.status === "change_requested"
        ? "bg-[hsl(var(--status-change-requested))]/15 text-[hsl(var(--status-change-requested))] border-[hsl(var(--status-change-requested))]/30"
        : asset.status === "pending_review"
          ? "bg-[hsl(var(--status-pending-review))]/15 text-[hsl(var(--status-pending-review))] border-[hsl(var(--status-pending-review))]/30"
          : "bg-muted text-muted-foreground";

  const regenerateWithForge = async () => {
    setRegenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-asset-internal", {
        body: {
          client_id: clientId,
          campaign_id: asset.campaign_id,
          asset_id: asset.id,
          asset_type: asset.asset_type,
          notes: asset.client_comment || asset.correction_prompt || null,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Nuova versione generata.");
      onChanged?.();
    } catch (e: any) {
      toast.error(e.message || "Generazione fallita");
    } finally {
      setRegenerating(false);
    }
  };

  const handleRename = async () => {
    const newName = renameValue.trim();
    if (!newName || newName === asset.asset_name) { setRenameOpen(false); return; }
    setSavingName(true);
    try {
      const { error } = await (supabase.from("assets") as any)
        .update({ asset_name: newName })
        .eq("id", asset.id);
      if (error) throw error;
      toast.success("Nome aggiornato.");
      setRenameOpen(false);
      onChanged?.();
    } catch (e: any) {
      toast.error(e.message || "Errore rinomina");
    } finally {
      setSavingName(false);
    }
  };

  const toggleArchive = async () => {
    try {
      const newStatus = isArchived ? "not_started" : "archived";
      const { error } = await (supabase.from("assets") as any)
        .update({ production_status: newStatus })
        .eq("id", asset.id);
      if (error) throw error;
      toast.success(isArchived ? "Asset ripristinato." : "Asset archiviato.");
      onChanged?.();
    } catch (e: any) {
      toast.error(e.message || "Errore");
    }
  };

  const toggleSelectedForClient = async () => {
    try {
      const newStatus = isSelected ? "not_started" : "selected_for_client";
      const { error } = await (supabase.from("assets") as any)
        .update({ production_status: newStatus })
        .eq("id", asset.id);
      if (error) throw error;
      toast.success(isSelected ? "Rimosso dalla selezione cliente." : "Selezionato per il cliente.");
      onChanged?.();
    } catch (e: any) {
      toast.error(e.message || "Errore");
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase.from("assets").delete().eq("id", asset.id);
      if (error) throw error;
      toast.success("Asset eliminato.");
      setDeleteOpen(false);
      onChanged?.();
    } catch (e: any) {
      toast.error(e.message || "Errore eliminazione");
    } finally {
      setDeleting(false);
    }
  };

  const handleDownload = () => {
    if (!hasContent) { toast.error("Nessun contenuto da scaricare."); return; }
    downloadMarkdown(asset);
    toast.success("Markdown scaricato.");
  };

  const handleCopy = async () => {
    if (!hasContent) return;
    try {
      await navigator.clipboard.writeText(assetToMarkdown(asset));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copia fallita");
    }
  };

  return (
    <div className={`rounded-lg border overflow-hidden transition ${
      isArchived ? "border-dashed border-border bg-muted/20 opacity-60" :
      isSelected ? "border-primary/40 bg-primary/5" :
      "border-border bg-secondary/10"
    }`}>
      <div className="p-3 flex items-center gap-3">
        {/* Thumbnail */}
        {isImage && asset.file_url ? (
          <img src={asset.file_url} alt={asset.asset_name} className="w-10 h-10 rounded object-cover border border-border shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded bg-secondary flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {isSelected && <Star className="w-3.5 h-3.5 text-primary fill-primary shrink-0" />}
            <span className="text-sm font-medium text-foreground truncate">{asset.asset_name}</span>
            <Badge variant="outline" className="text-[10px] shrink-0">v{asset.version || 1}</Badge>
            {isArchived && <Badge variant="outline" className="text-[10px] shrink-0">Archiviato</Badge>}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <Badge variant="outline" className={`text-[10px] ${statusBadgeClass}`}>
              {assetStatusIcon(asset.status)} {assetStatusLabel(asset.status)}
            </Badge>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Caricato {formatDistanceToNow(new Date(asset.created_at), { addSuffix: true })}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {hasContent && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Apri contenuto"
              onClick={() => setViewOpen(true)}
            >
              <Eye className="w-3.5 h-3.5" />
            </Button>
          )}
          {asset.file_url && !hasContent && (
            <a href={asset.file_url} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Apri file">
                <Eye className="w-3.5 h-3.5" />
              </Button>
            </a>
          )}
          {asset.content?.url && (
            <a href={asset.content.url} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Apri URL">
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            </a>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Rigenera"
            onClick={regenerateWithForge}
            disabled={regenerating}
          >
            {regenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Azioni">
                <MoreVertical className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {hasContent && (
                <>
                  <DropdownMenuItem onClick={handleDownload}>
                    <Download className="w-3.5 h-3.5 mr-2" /> Scarica .md
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleCopy}>
                    {copied ? <Check className="w-3.5 h-3.5 mr-2" /> : <Copy className="w-3.5 h-3.5 mr-2" />}
                    {copied ? "Copiato!" : "Copia testo"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={() => { setRenameValue(asset.asset_name); setRenameOpen(true); }}>
                <Pencil className="w-3.5 h-3.5 mr-2" /> Rinomina
              </DropdownMenuItem>
              <DropdownMenuItem onClick={toggleSelectedForClient}>
                <Star className={`w-3.5 h-3.5 mr-2 ${isSelected ? "fill-primary text-primary" : ""}`} />
                {isSelected ? "Rimuovi selezione" : "Seleziona per cliente"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={toggleArchive}>
                {isArchived ? (
                  <><ArchiveRestore className="w-3.5 h-3.5 mr-2" /> Ripristina</>
                ) : (
                  <><Archive className="w-3.5 h-3.5 mr-2" /> Archivia</>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setDeleteOpen(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5 mr-2" /> Elimina
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Generated content viewer */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon className="w-4 h-4" />
              {asset.asset_name}
              <Badge variant="outline" className="text-[10px]">v{asset.version || 1}</Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2 pb-3 border-b border-border">
            <Button size="sm" variant="outline" onClick={handleDownload} disabled={!hasContent}>
              <Download className="w-3.5 h-3.5 mr-1.5" /> Scarica .md
            </Button>
            <Button size="sm" variant="outline" onClick={handleCopy} disabled={!hasContent}>
              {copied ? <Check className="w-3.5 h-3.5 mr-1.5" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
              {copied ? "Copiato" : "Copia testo"}
            </Button>
          </div>
          <Tabs defaultValue="preview" className="w-full">
            <TabsList className="grid grid-cols-2 w-fit mx-auto mb-4">
              <TabsTrigger value="preview">
                <Eye className="w-3.5 h-3.5 mr-1.5" /> Vista previa
              </TabsTrigger>
              <TabsTrigger value="text">
                <FileText className="w-3.5 h-3.5 mr-1.5" /> Texto / Secciones
              </TabsTrigger>
            </TabsList>
            <TabsContent value="preview">
              <AssetVisualPreview assetType={asset.asset_type} content={asset.content} fileUrl={asset.file_url} />
            </TabsContent>
            <TabsContent value="text">
              <AssetContentView assetType={asset.asset_type} content={asset.content} fileUrl={asset.file_url} />
            </TabsContent>
          </Tabs>

          {/* Feedback all'AI — sempre visibile */}
          <AiFeedbackBox
            asset={asset}
            regenerating={regenerating}
            onRegenerate={regenerateWithForge}
            onSavedPrompt={onChanged}
          />
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rinomina asset</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="Es: Email 1 — Welcome"
              onKeyDown={(e) => { if (e.key === "Enter") handleRename(); }}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRenameOpen(false)}>Annulla</Button>
              <Button onClick={handleRename} disabled={savingName || !renameValue.trim()}>
                {savingName && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                Salva
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare questo asset?</AlertDialogTitle>
            <AlertDialogDescription>
              "{asset.asset_name}" verrà eliminato definitivamente. Questa azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Client feedback */}
      {asset.status === "change_requested" && asset.client_comment && (
        <div className="mx-3 mb-3 p-2.5 rounded-md bg-[hsl(var(--status-change-requested))]/10 border border-[hsl(var(--status-change-requested))]/30">
          <p className="text-xs font-medium text-foreground mb-0.5">💬 Client feedback:</p>
          <p className="text-xs text-muted-foreground">{asset.client_comment}</p>
          {asset.correction_prompt && (
            <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
              <Wrench className="w-3 h-3" /> Correction prompt available
            </p>
          )}
        </div>
      )}

      {/* Assign to campaign (for uncategorized) */}
      {onAssignCampaign && campaigns.length > 0 && (
        <div className="px-3 pb-3">
          <Select onValueChange={(v) => onAssignCampaign(asset.id, v)}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder="Assign to campaign..." />
            </SelectTrigger>
            <SelectContent>
              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

// ─── Add Asset Drawer ───────────────────────────────────
function AddAssetDrawer({
  open,
  onClose,
  clientId,
  campaignId,
  campaignName,
  onAssetSaved,
}: {
  open: boolean;
  onClose: () => void;
  clientId: string;
  campaignId: string;
  campaignName: string;
  onAssetSaved: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [assetType, setAssetType] = useState<string>("");
  const [assetName, setAssetName] = useState("");
  const [notes, setNotes] = useState("");
  const [url, setUrl] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const reset = () => {
    setStep(1); setAssetType(""); setAssetName(""); setNotes(""); setUrl(""); setPasteText(""); setFiles([]);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles(Array.from(e.target.files));
  };

  const typeConfig: Record<string, { accept: string; multiple: boolean; maxFiles: number; hasUrl: boolean; hasText: boolean }> = {
    landing_page: { accept: ".png,.jpg,.jpeg,.webp,.pdf", multiple: false, maxFiles: 1, hasUrl: true, hasText: false },
    email_flow: { accept: ".png,.jpg,.jpeg,.webp,.pdf,.txt", multiple: true, maxFiles: 5, hasUrl: false, hasText: false },
    social_post: { accept: ".png,.jpg,.jpeg,.webp", multiple: true, maxFiles: 20, hasUrl: false, hasText: false },
    blog_article: { accept: ".pdf,.txt,.md", multiple: true, maxFiles: 10, hasUrl: false, hasText: true },
  };

  const cfg = typeConfig[assetType] || { accept: "", multiple: false, maxFiles: 1, hasUrl: false, hasText: false };
  const hasContent = files.length > 0 || url.trim() || pasteText.trim();

  const deriveName = () => {
    if (assetName.trim()) return assetName.trim();
    if (url.trim()) {
      try { return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, ""); } catch { return url.slice(0, 40); }
    }
    if (files.length === 1) return files[0].name.replace(/\.[^/.]+$/, "");
    return ASSET_TYPE_FULL[assetType] || "Asset";
  };

  const saveAsset = async () => {
    setUploading(true);
    try {
      // URL-based
      if (assetType === "landing_page" && url.trim()) {
        const { error } = await supabase.from("assets").insert({
          client_id: clientId,
          asset_type: assetType,
          asset_name: deriveName(),
          content: { url: url.trim(), notes: notes.trim() || undefined },
          campaign_id: campaignId,
        } as any);
        if (error) throw error;
      }
      // Text-based blog
      else if (assetType === "blog_article" && pasteText.trim() && files.length === 0) {
        const { error } = await supabase.from("assets").insert({
          client_id: clientId,
          asset_type: assetType,
          asset_name: deriveName(),
          content: { text: pasteText.trim(), notes: notes.trim() || undefined },
          campaign_id: campaignId,
        } as any);
        if (error) throw error;
      }
      // File uploads
      else {
        for (const file of files) {
          const filePath = `${clientId}/${assetType}/${Date.now()}_${file.name}`;
          const signedUrl = await uploadClientAsset(filePath, file);

          const name = files.length === 1 ? deriveName() : file.name.replace(/\.[^/.]+$/, "");
          const { error } = await supabase.from("assets").insert({
            client_id: clientId,
            asset_type: assetType,
            asset_name: name,
            file_url: signedUrl,
            content: { notes: notes.trim() || undefined },
            campaign_id: campaignId,
          } as any);
          if (error) throw error;
        }
      }

      toast.success("Asset saved!");
      onAssetSaved();
      handleClose();
    } catch (e: any) {
      toast.error(e.message || "Failed to save asset");
    } finally {
      setUploading(false);
    }
  };

  const typeButtons = [
    { type: "landing_page", icon: FileText, label: "Landing Page", emoji: "🖥️" },
    { type: "email_flow", icon: Mail, label: "Email Flow", emoji: "📧" },
    { type: "social_post", icon: Image, label: "Social Posts", emoji: "📱" },
    { type: "blog_article", icon: PenTool, label: "Blog Article", emoji: "📝" },
  ];

  return (
    <Sheet open={open} onOpenChange={(o) => !o && handleClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Add asset — {campaignName}</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Step 1: Type */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Choose asset type</p>
              <div className="grid grid-cols-2 gap-3">
                {typeButtons.map((tb) => (
                  <button
                    key={tb.type}
                    onClick={() => { setAssetType(tb.type); setStep(2); }}
                    className="flex flex-col items-center gap-2 p-5 rounded-lg border-2 border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-center"
                  >
                    <span className="text-2xl">{tb.emoji}</span>
                    <span className="text-sm font-medium text-foreground">{tb.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Upload */}
          {step === 2 && (
            <div className="space-y-4">
              <Button variant="ghost" size="sm" onClick={() => { setStep(1); setFiles([]); setUrl(""); setPasteText(""); }}>
                ← Back
              </Button>

              <p className="text-sm font-medium text-foreground">{ASSET_TYPE_FULL[assetType]} — Upload</p>

              {/* Landing page: tabs for file vs URL */}
              {assetType === "landing_page" && (
                <Tabs defaultValue="file">
                  <TabsList className="w-full">
                    <TabsTrigger value="file" className="flex-1">Upload file</TabsTrigger>
                    <TabsTrigger value="url" className="flex-1">Paste URL</TabsTrigger>
                  </TabsList>
                  <TabsContent value="file" className="mt-3">
                    <Input type="file" accept={cfg.accept} onChange={handleFileChange} />
                  </TabsContent>
                  <TabsContent value="url" className="mt-3">
                    <Input placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} />
                  </TabsContent>
                </Tabs>
              )}

              {/* Email / Social: file upload */}
              {(assetType === "email_flow" || assetType === "social_post") && (
                <div>
                  <Input type="file" accept={cfg.accept} multiple={cfg.multiple} onChange={handleFileChange} />
                  <p className="text-xs text-muted-foreground mt-1">Up to {cfg.maxFiles} files</p>
                </div>
              )}

              {/* Blog: file or paste */}
              {assetType === "blog_article" && (
                <Tabs defaultValue="file">
                  <TabsList className="w-full">
                    <TabsTrigger value="file" className="flex-1">Upload file</TabsTrigger>
                    <TabsTrigger value="paste" className="flex-1">Paste text</TabsTrigger>
                  </TabsList>
                  <TabsContent value="file" className="mt-3">
                    <Input type="file" accept={cfg.accept} multiple onChange={handleFileChange} />
                  </TabsContent>
                  <TabsContent value="paste" className="mt-3">
                    <Textarea
                      placeholder="Paste article text..."
                      value={pasteText}
                      onChange={(e) => setPasteText(e.target.value)}
                      className="min-h-[120px]"
                    />
                  </TabsContent>
                </Tabs>
              )}

              {/* File preview */}
              {files.length > 0 && (
                <div className="space-y-1">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm p-2 rounded bg-secondary/30">
                      <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-foreground truncate flex-1">{f.name}</span>
                      <span className="text-xs text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</span>
                      <button onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}>
                        <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <Input
                placeholder="Asset name (auto-generated if empty)"
                value={assetName}
                onChange={(e) => setAssetName(e.target.value)}
              />

              <Textarea
                placeholder="Notes for client (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[60px]"
              />

              <Button onClick={() => setStep(3)} disabled={!hasContent} className="w-full">
                Continue to confirmation
              </Button>
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === 3 && (
            <div className="space-y-4">
              <Button variant="ghost" size="sm" onClick={() => setStep(2)}>← Back</Button>

              <div className="bg-secondary/30 rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium text-foreground">Summary</p>
                <p className="text-xs text-muted-foreground">Adding <strong>{ASSET_TYPE_FULL[assetType]}</strong> to <strong>{campaignName}</strong></p>
                <p className="text-xs text-muted-foreground">Asset name: <strong>{deriveName()}</strong></p>
                {files.length > 0 && <p className="text-xs text-muted-foreground">Files: {files.length}</p>}
                {url.trim() && <p className="text-xs text-muted-foreground">URL: {url}</p>}
              </div>

              <div className="space-y-2">
                <Button onClick={() => saveAsset()} disabled={uploading} className="w-full">
                  {uploading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Save asset
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── New Version Drawer ─────────────────────────────────
function NewVersionDrawer({
  open,
  onClose,
  clientId,
  asset,
  campaignId,
  summary,
  onVersionUploaded,
}: {
  open: boolean;
  onClose: () => void;
  clientId: string;
  asset: AssetRow;
  campaignId: string;
  summary: string;
  onVersionUploaded: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [url, setUrl] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [changeNotes, setChangeNotes] = useState(`Updated based on client feedback: ${asset.client_comment || summary}`);
  const [uploading, setUploading] = useState(false);

  const typeConfig: Record<string, { accept: string; multiple: boolean; hasUrl: boolean; hasText: boolean }> = {
    landing_page: { accept: ".png,.jpg,.jpeg,.webp,.pdf", multiple: false, hasUrl: true, hasText: false },
    email_flow: { accept: ".png,.jpg,.jpeg,.webp,.pdf,.txt", multiple: true, hasUrl: false, hasText: false },
    social_post: { accept: ".png,.jpg,.jpeg,.webp", multiple: true, hasUrl: false, hasText: false },
    blog_article: { accept: ".pdf,.txt,.md", multiple: true, hasUrl: false, hasText: true },
  };

  const cfg = typeConfig[asset.asset_type] || { accept: "", multiple: false, hasUrl: false, hasText: false };
  const hasContent = files.length > 0 || url.trim() || pasteText.trim();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles(Array.from(e.target.files));
  };

  const handleClose = () => {
    setFiles([]); setUrl(""); setPasteText(""); setChangeNotes("");
    onClose();
  };

  const uploadNewVersion = async () => {
    setUploading(true);
    try {
      const newVersion = (asset.version || 1) + 1;
      let fileUrl = asset.file_url;
      let content = asset.content;

      if (asset.asset_type === "landing_page" && url.trim()) {
        content = { url: url.trim(), notes: changeNotes.trim() || undefined };
        fileUrl = null;
      } else if (asset.asset_type === "blog_article" && pasteText.trim() && files.length === 0) {
        content = { text: pasteText.trim(), notes: changeNotes.trim() || undefined };
        fileUrl = null;
      } else if (files.length > 0) {
        const file = files[0];
        const filePath = `${clientId}/${asset.asset_type}/${Date.now()}_${file.name}`;
        fileUrl = await uploadClientAsset(filePath, file);
        content = { notes: changeNotes.trim() || undefined };
      }

      const { error } = await supabase.from("assets").update({
        version: newVersion,
        status: "pending_review" as any,
        file_url: fileUrl,
        content,
        client_comment: null,
        correction_prompt: null,
      } as any).eq("id", asset.id);
      if (error) throw error;

      // Log activity
      await supabase.from("activity_log").insert({
        entity_type: "asset",
        entity_id: asset.id,
        entity_name: asset.asset_name,
        action: `new version v${newVersion} uploaded`,
      });

      toast.success(`Version v${newVersion} uploaded!`);
      onVersionUploaded();
      handleClose();
    } catch (e: any) {
      toast.error(e.message || "Failed to upload new version");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && handleClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Upload New Version</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {/* Asset info */}
          <div className="bg-secondary/30 rounded-lg p-4">
            <p className="text-sm font-medium text-foreground">
              New version for: {asset.asset_name} <Badge variant="outline" className="text-[10px] ml-1">currently v{asset.version}</Badge>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {ASSET_TYPE_FULL[asset.asset_type]} — Status will be set to "Pending review"
            </p>
          </div>

          {/* Upload area */}
          {asset.asset_type === "landing_page" ? (
            <Tabs defaultValue="file">
              <TabsList className="w-full">
                <TabsTrigger value="file" className="flex-1">Upload file</TabsTrigger>
                <TabsTrigger value="url" className="flex-1">Paste URL</TabsTrigger>
              </TabsList>
              <TabsContent value="file" className="mt-3">
                <Input type="file" accept={cfg.accept} onChange={handleFileChange} />
              </TabsContent>
              <TabsContent value="url" className="mt-3">
                <Input placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} />
              </TabsContent>
            </Tabs>
          ) : asset.asset_type === "blog_article" ? (
            <Tabs defaultValue="file">
              <TabsList className="w-full">
                <TabsTrigger value="file" className="flex-1">Upload file</TabsTrigger>
                <TabsTrigger value="paste" className="flex-1">Paste text</TabsTrigger>
              </TabsList>
              <TabsContent value="file" className="mt-3">
                <Input type="file" accept={cfg.accept} multiple={cfg.multiple} onChange={handleFileChange} />
              </TabsContent>
              <TabsContent value="paste" className="mt-3">
                <Textarea placeholder="Paste article text..." value={pasteText} onChange={(e) => setPasteText(e.target.value)} className="min-h-[120px]" />
              </TabsContent>
            </Tabs>
          ) : (
            <div>
              <p className="text-sm font-medium text-foreground mb-2">Upload new file(s)</p>
              <Input type="file" accept={cfg.accept} multiple={cfg.multiple} onChange={handleFileChange} />
            </div>
          )}

          {/* File preview */}
          {files.length > 0 && (
            <div className="space-y-1">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-sm p-2 rounded bg-secondary/30">
                  <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-foreground truncate flex-1">{f.name}</span>
                  <span className="text-xs text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</span>
                  <button onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}>
                    <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* What changed */}
          <div>
            <label className="text-sm font-medium text-foreground">What changed?</label>
            <Textarea
              value={changeNotes}
              onChange={(e) => setChangeNotes(e.target.value)}
              className="mt-1 min-h-[80px]"
              placeholder="Describe what was updated..."
            />
          </div>

          {/* Action buttons */}
          <div className="space-y-2">
            <Button onClick={() => uploadNewVersion()} disabled={uploading || !hasContent} className="w-full">
              {uploading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              <Upload className="w-4 h-4 mr-2" /> Upload new version
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Main CampaignManager Component ─────────────────────
export function CampaignManager({ clientId, campaigns, assets, promptsTabContent, onCampaignCreated, onCampaignUpdated, onAssetsChanged }: CampaignManagerProps) {
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [addAssetDrawer, setAddAssetDrawer] = useState<{ campaignId: string; campaignName: string } | null>(null);
  const [newVersionDrawer, setNewVersionDrawer] = useState<{ asset: AssetRow; campaignId: string; summary: string } | null>(null);
  const [notifyConfirm, setNotifyConfirm] = useState<{ campaign: Campaign; assets: AssetRow[] } | null>(null);
  const [notifying, setNotifying] = useState(false);
  const [aiBusyCampaignId, setAiBusyCampaignId] = useState<string | null>(null);
  const [briefReasoning, setBriefReasoning] = useState<Record<string, any>>({});
  const [briefFeedback, setBriefFeedback] = useState<string>("");
  const [campaignMaterials, setCampaignMaterials] = useState<Record<string, any[]>>({});
  const [loadingMaterials, setLoadingMaterials] = useState<string | null>(null);
  const [autoSelectingMaterials, setAutoSelectingMaterials] = useState<string | null>(null);
  const [allClientMaterials, setAllClientMaterials] = useState<Array<{ ref: string; type: string; label: string; url?: string }>>([]);

  // Realtime: refresh assets when new ones arrive for any campaign
  useEffect(() => {
    const channel = supabase
      .channel(`assets-client-${clientId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "assets", filter: `client_id=eq.${clientId}` },
        () => onAssetsChanged?.(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId, onAssetsChanged]);

  // Load client materials (flat list) once
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("kickoff_briefs")
        .select("client_materials")
        .eq("client_id", clientId)
        .maybeSingle();
      const cm: any = data?.client_materials || {};
      const flat: Array<{ ref: string; type: string; label: string; url?: string }> = [];
      if (cm.logo_url) flat.push({ ref: "logo", type: "logo", label: "Logo de marca", url: cm.logo_url });
      if (cm.primary_color) flat.push({ ref: "primary_color", type: "color", label: `Color primario: ${cm.primary_color}` });
      if (cm.secondary_color) flat.push({ ref: "secondary_color", type: "color", label: `Color secundario: ${cm.secondary_color}` });
      if (Array.isArray(cm.brand_tags) && cm.brand_tags.length) flat.push({ ref: "brand_tags", type: "brand", label: `Tags: ${cm.brand_tags.join(", ")}` });
      (cm.photos || []).forEach((p: any, i: number) => flat.push({ ref: `photo_${i}`, type: "photo", label: p.description || `Foto ${i + 1}`, url: p.url }));
      if (cm.website_url) flat.push({ ref: "website_url", type: "link", label: "Sitio web", url: cm.website_url });
      if (cm.website_context) flat.push({ ref: "website_context", type: "text", label: "Texto del sitio web" });
      if (cm.pricing_pdf_url) flat.push({ ref: "pricing_pdf", type: "document", label: "PDF precios", url: cm.pricing_pdf_url });
      if (cm.pricing_pdf_text) flat.push({ ref: "pricing_text", type: "text", label: "Precios extraídos" });
      (cm.email_files || []).forEach((e: any, i: number) => flat.push({ ref: `email_${i}`, type: "email_example", label: e.name || `Email ${i + 1}`, url: e.url }));
      if (cm.email_text) flat.push({ ref: "email_text", type: "text", label: "Email/copy ejemplo" });
      (cm.social_posts || []).forEach((s: any, i: number) => flat.push({ ref: `social_${i}`, type: "social_post", label: s.caption?.slice(0, 80) || `Post ${i + 1}`, url: s.url }));
      setAllClientMaterials(flat);
    })();
  }, [clientId]);

  const loadCampaignMaterials = async (campaignId: string) => {
    setLoadingMaterials(campaignId);
    try {
      const { data } = await supabase.from("campaign_materials").select("*").eq("campaign_id", campaignId);
      setCampaignMaterials((prev) => ({ ...prev, [campaignId]: (data || []) as any[] }));
    } finally {
      setLoadingMaterials(null);
    }
  };

  const upsertCampaignMaterial = async (campaignId: string, mat: { ref: string; type: string; label: string; url?: string }, patch: { selected?: boolean; usage_hint?: string }) => {
    const existing = (campaignMaterials[campaignId] || []).find((m) => m.material_ref === mat.ref);
    const payload: any = {
      campaign_id: campaignId,
      material_ref: mat.ref,
      material_type: mat.type,
      material_label: mat.label,
      material_url: mat.url || null,
      selected: patch.selected ?? existing?.selected ?? true,
      usage_hint: patch.usage_hint ?? existing?.usage_hint ?? null,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await (supabase.from("campaign_materials") as any)
      .upsert(payload, { onConflict: "campaign_id,material_ref" })
      .select()
      .single();
    if (error) { toast.error("Error guardando material"); return; }
    setCampaignMaterials((prev) => {
      const list = prev[campaignId] || [];
      const idx = list.findIndex((m) => m.material_ref === mat.ref);
      const next = idx >= 0 ? list.map((m, i) => i === idx ? data : m) : [...list, data];
      return { ...prev, [campaignId]: next };
    });
  };

  const autoSelectMaterials = async (campaignId: string) => {
    setAutoSelectingMaterials(campaignId);
    try {
      const { data, error } = await supabase.functions.invoke("select-campaign-materials", {
        body: { campaign_id: campaignId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`IA seleccionó ${(data as any)?.applied || 0} materiales para esta campaña`);
      await loadCampaignMaterials(campaignId);
    } catch (e: any) {
      toast.error(e.message || "Falló la selección automática");
    } finally {
      setAutoSelectingMaterials(null);
    }
  };

  const triggerGenerationForCampaign = async (campaign: Campaign) => {
    setAiBusyCampaignId(campaign.id);
    try {
      const { data, error } = await supabase.functions.invoke("generate-asset-internal", {
        body: {
          client_id: clientId,
          campaign_id: campaign.id,
          notes: campaign.objective || campaign.key_message || null,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const count = (data as any)?.assets_created ?? (data as any)?.count ?? null;
      toast.success(count ? `${count} assets generados en esta campaña — recargando...` : "Assets generados — recargando...");
      onAssetsChanged?.();
    } catch (e: any) {
      toast.error(e.message || "Generación fallida");
    } finally {
      setAiBusyCampaignId(null);
    }
  };

  // Form state
  const [name, setName] = useState("");
  const [status, setStatus] = useState<string>("draft");
  const [objective, setObjective] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [keyMessage, setKeyMessage] = useState("");
  const [timeline, setTimeline] = useState("");

  const uncategorizedAssets = assets.filter((a) => !a.campaign_id);
  const getCampaignAssets = (id: string) => assets.filter((a) => a.campaign_id === id);

  const resetForm = () => {
    setName(""); setStatus("draft"); setObjective(""); setTargetAudience(""); setKeyMessage(""); setTimeline("");
    setBriefReasoning({}); setBriefFeedback("");
  };

  const generateBrief = async (opts?: { campaignId?: string; feedback?: string }) => {
    if (!name.trim()) { toast.error("Enter a campaign name first"); return; }
    setGenerating(true);
    try {
      const body: any = { client_id: clientId, campaign_name: name };
      if (opts?.feedback) {
        body.feedback = opts.feedback;
        body.current_brief = { objective, target_audience: targetAudience, key_message: keyMessage, timeline };
      }
      const { data, error } = await supabase.functions.invoke("generate-campaign-brief", { body });
      if (error) throw error;
      if (data?.objective) setObjective(data.objective);
      if (data?.target_audience) setTargetAudience(data.target_audience);
      if (data?.key_message) setKeyMessage(data.key_message);
      if (data?.timeline) setTimeline(data.timeline);
      const reasoningKey = opts?.campaignId || "__new__";
      if (data?.reasoning) {
        setBriefReasoning((prev) => ({ ...prev, [reasoningKey]: data.reasoning }));
      }
      setBriefFeedback("");
      toast.success(opts?.feedback ? "Brief regenerado con tu feedback" : "Campaign brief generated!");
    } catch (e: any) {
      toast.error(e.message || "Failed to generate brief");
    } finally {
      setGenerating(false);
    }
  };

  const saveCampaign = async () => {
    if (!name.trim()) { toast.error("Campaign name is required"); return; }
    setCreating(true);
    try {
      const { data, error } = await (supabase.from("campaigns" as any) as any)
        .insert({
          client_id: clientId, name: name.trim(), status,
          objective: objective.trim(), target_audience: targetAudience.trim(),
          key_message: keyMessage.trim(), timeline: timeline.trim(),
        })
        .select().single();
      if (error) throw error;
      onCampaignCreated(data as Campaign);
      setShowCreate(false);
      resetForm();
      toast.success("Campaign created!");
    } catch (e: any) {
      toast.error(e.message || "Failed to create campaign");
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (c: Campaign) => {
    setName(c.name); setStatus(c.status); setObjective(c.objective);
    setTargetAudience(c.target_audience); setKeyMessage(c.key_message); setTimeline(c.timeline);
    setEditing(true);
  };

  const updateCampaign = async (campaign: Campaign) => {
    try {
      const { data, error } = await (supabase.from("campaigns" as any) as any)
        .update({
          name: name.trim() || campaign.name, status,
          objective: objective.trim(), target_audience: targetAudience.trim(),
          key_message: keyMessage.trim(), timeline: timeline.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaign.id).select().single();
      if (error) throw error;
      onCampaignUpdated(data as Campaign);
      setEditing(false);
      toast.success("Campaign updated!");
    } catch (e: any) {
      toast.error(e.message || "Failed to update");
    }
  };

  const assignAssetToCampaign = async (assetId: string, campaignId: string) => {
    const { error } = await supabase.from("assets").update({ campaign_id: campaignId } as any).eq("id", assetId);
    if (error) { toast.error("Failed to assign"); return; }
    toast.success("Asset assigned to campaign!");
    onAssetsChanged?.();
  };

  // Auto-update campaign status
  useEffect(() => {
    for (const campaign of campaigns) {
      const cAssets = getCampaignAssets(campaign.id);
      const computed = computeCampaignStatus(cAssets);
      if (computed !== campaign.status) {
        (supabase.from("campaigns" as any) as any)
          .update({ status: computed, updated_at: new Date().toISOString() })
          .eq("id", campaign.id)
          .then(() => onCampaignUpdated({ ...campaign, status: computed }));
      }
    }
  }, [assets]);

  const toggleCampaign = (id: string) => {
    if (expandedCampaignId === id) {
      setExpandedCampaignId(null);
      setEditing(false);
    } else {
      setExpandedCampaignId(id);
      setEditing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground text-lg">Campaigns</h3>
        <Button size="sm" onClick={() => { resetForm(); setShowCreate(true); }}>
          <Plus className="w-4 h-4 mr-1" /> New Campaign
        </Button>
      </div>

      {campaigns.length === 0 && uncategorizedAssets.length === 0 && (
        <div className="bg-card rounded-lg border border-border p-8 text-center text-muted-foreground">
          No campaigns yet. Create one to organize your assets.
        </div>
      )}

      {/* Campaign cards (vertical stack) */}
      <div className="space-y-3">
        {campaigns.map((campaign) => {
          const cAssets = getCampaignAssets(campaign.id);
          const isExpanded = expandedCampaignId === campaign.id;
          const changeRequestedAssets = cAssets.filter((a) => a.status === "change_requested");
          const lastUpdated = campaign.updated_at || campaign.created_at;

          return (
            <div key={campaign.id} className="bg-card rounded-lg border border-border overflow-hidden">
              {/* Collapsed header */}
              <button
                className="w-full p-4 flex items-center justify-between text-left hover:bg-secondary/30 transition-colors"
                onClick={() => toggleCampaign(campaign.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-foreground text-sm">{campaign.name}</span>
                    <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[campaign.status] || ""}`}>
                      {campaign.status}
                    </Badge>
                  </div>
                  <AssetTypeSummary assets={cAssets} />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Last updated: {formatDistanceToNow(new Date(lastUpdated), { addSuffix: true })}
                  </p>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="border-t border-border">
                  <Tabs defaultValue="contexto" className="w-full">
                    <TabsList className="w-full justify-start rounded-none border-b border-border bg-secondary/20 px-4 h-auto">
                      <TabsTrigger value="contexto" className="data-[state=active]:bg-background">Contexto</TabsTrigger>
                      {promptsTabContent && (
                        <TabsTrigger value="prompts" className="data-[state=active]:bg-background">Prompts AI</TabsTrigger>
                      )}
                      <TabsTrigger value="assets" className="data-[state=active]:bg-background">
                        Assets ({cAssets.length})
                      </TabsTrigger>
                      <TabsTrigger
                        value="materiales"
                        className="data-[state=active]:bg-background"
                        onClick={() => {
                          if (!campaignMaterials[campaign.id]) loadCampaignMaterials(campaign.id);
                        }}
                      >
                        Materiales ({(campaignMaterials[campaign.id] || []).filter((m) => m.selected).length})
                      </TabsTrigger>
                    </TabsList>

                    {/* CONTEXTO */}
                    <TabsContent value="contexto" className="m-0 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Campaign Brief</p>
                        <div className="flex gap-2">
                          {!editing && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => startEdit(campaign)}>
                                <Pencil className="w-3.5 h-3.5 mr-1" /> Edit brief
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => {
                                setName(campaign.name);
                                generateBrief();
                              }} disabled={generating}>
                                {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
                                Generate with AI
                              </Button>
                            </>
                          )}
                        </div>
                      </div>

                      {editing ? (
                        <div className="space-y-3">
                          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Campaign name" />
                          <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="draft">Draft</SelectItem>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                            </SelectContent>
                          </Select>
                          <Textarea value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="Objective" className="min-h-[50px]" />
                          <Textarea value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} placeholder="Target audience" className="min-h-[50px]" />
                          <Textarea value={keyMessage} onChange={(e) => setKeyMessage(e.target.value)} placeholder="Key message" className="min-h-[50px]" />
                          <Input value={timeline} onChange={(e) => setTimeline(e.target.value)} placeholder="Timeline" />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => updateCampaign(campaign)}>Save</Button>
                            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          {campaign.objective && (
                            <div>
                              <p className="text-xs text-muted-foreground flex items-center gap-1"><Target className="w-3 h-3" /> Objective</p>
                              <p className="text-sm text-foreground mt-0.5">{campaign.objective}</p>
                            </div>
                          )}
                          {campaign.target_audience && (
                            <div>
                              <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" /> Target audience</p>
                              <p className="text-sm text-foreground mt-0.5">{campaign.target_audience}</p>
                            </div>
                          )}
                          {campaign.key_message && (
                            <div>
                              <p className="text-xs text-muted-foreground flex items-center gap-1"><MessageSquare className="w-3 h-3" /> Key message</p>
                              <p className="text-sm text-foreground mt-0.5">{campaign.key_message}</p>
                            </div>
                          )}
                          {campaign.timeline && (
                            <div>
                              <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> Timeline</p>
                              <p className="text-sm text-foreground mt-0.5">{campaign.timeline}</p>
                            </div>
                          )}
                          {!campaign.objective && !campaign.target_audience && !campaign.key_message && !campaign.timeline && (
                            <p className="text-sm text-muted-foreground italic col-span-2">No brief set. Click "Edit brief" or "Generate with AI".</p>
                          )}
                        </div>
                      )}
                    </TabsContent>

                    {/* PROMPTS */}
                    {promptsTabContent && (
                      <TabsContent value="prompts" className="m-0 p-4">
                        <div className="rounded-md border border-dashed border-border bg-secondary/10 p-3 mb-4">
                          <p className="text-xs text-muted-foreground">
                            Los prompts AI usan el contexto de esta campaña, la oferta seleccionada y el kickoff. Edítalos antes de generar assets.
                          </p>
                        </div>
                        {promptsTabContent}
                      </TabsContent>
                    )}

                    {/* ASSETS */}
                    <TabsContent value="assets" className="m-0">
                      <div className="p-4 border-b border-border">
                        {cAssets.length === 0 ? (
                          <p className="text-sm text-muted-foreground italic">No assets yet.</p>
                        ) : (
                          <div className="space-y-2">
                            {cAssets.map((asset) => (
                              <AssetCard key={asset.id} asset={asset} campaigns={campaigns} clientId={clientId} onChanged={onAssetsChanged} />
                            ))}
                          </div>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setAddAssetDrawer({ campaignId: campaign.id, campaignName: campaign.name })}
                          >
                            <Plus className="w-3.5 h-3.5 mr-1" /> Add asset to this campaign
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => triggerGenerationForCampaign(campaign)}
                            disabled={aiBusyCampaignId === campaign.id}
                          >
                            {aiBusyCampaignId === campaign.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                            ) : (
                              <Wand2 className="w-3.5 h-3.5 mr-1" />
                            )}
                            Generar assets con IA
                          </Button>
                        </div>
                      </div>

                      {changeRequestedAssets.length > 0 && (
                        <div className="p-4 border-b border-border">
                          <CorrectionPromptPanel
                            clientId={clientId}
                            assets={changeRequestedAssets}
                            onUploadNewVersion={(assetId, assetType, summary) => {
                              const asset = cAssets.find((a) => a.id === assetId);
                              if (asset) {
                                setNewVersionDrawer({ asset, campaignId: campaign.id, summary });
                              }
                            }}
                          />
                        </div>
                      )}

                      <div className="p-4">
                        {(() => {
                          const types = ["landing_page", "email_flow", "social_post", "blog_article"] as const;
                          const uploadedTypes = types.filter((t) => cAssets.some((a) => a.asset_type === t));
                          const missingTypes = types.filter((t) => !cAssets.some((a) => a.asset_type === t));
                          const hasAnyAsset = cAssets.length > 0;
                          const lastNotified = (campaign as any).last_notified_at;
                          const hasNewSinceNotify = lastNotified && cAssets.some(
                            (a) => new Date(a.created_at) > new Date(lastNotified)
                          );

                          return (
                            <div className="rounded-lg border border-border bg-secondary/20 p-4 space-y-3">
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Campaign assets status</p>
                              <div className="flex flex-wrap gap-x-4 gap-y-1">
                                {types.map((t) => {
                                  const uploaded = cAssets.some((a) => a.asset_type === t);
                                  return (
                                    <span key={t} className={`text-xs ${uploaded ? "text-foreground" : "text-muted-foreground"}`}>
                                      {ASSET_TYPE_FULL[t]} {uploaded ? "✅ uploaded" : "⚪ missing"}
                                    </span>
                                  );
                                })}
                              </div>

                              {missingTypes.length > 0 && hasAnyAsset && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3 text-[hsl(var(--status-pending-review))]" />
                                  {missingTypes.map((t) => ASSET_TYPE_FULL[t]).join(" and ")} not uploaded yet. You can still notify client with available assets.
                                </p>
                              )}

                              {lastNotified && !hasNewSinceNotify && (
                                <p className="text-xs text-muted-foreground">
                                  Client notified on {format(new Date(lastNotified), "dd MMM yyyy")} at {format(new Date(lastNotified), "HH:mm")}
                                </p>
                              )}

                              {lastNotified && hasNewSinceNotify && (
                                <p className="text-xs text-[hsl(var(--status-pending-review))] flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" /> New assets added since last notification.
                                </p>
                              )}

                              {hasAnyAsset && (
                                <Button
                                  size="sm"
                                  onClick={() => setNotifyConfirm({ campaign, assets: cAssets })}
                                >
                                  <Bell className="w-3.5 h-3.5 mr-1" />
                                  {lastNotified && hasNewSinceNotify ? "Notify client again" : "Notify client about this campaign"}
                                </Button>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </TabsContent>

                    {/* MATERIALES */}
                    <TabsContent value="materiales" className="m-0 p-4 space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Materiales del cliente</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Selecciona qué materiales (logo, fotos, textos, ejemplos) quieres que la IA use para generar los assets de esta campaña. Puedes añadir una nota de uso para cada uno.
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => autoSelectMaterials(campaign.id)}
                          disabled={autoSelectingMaterials === campaign.id || allClientMaterials.length === 0}
                        >
                          {autoSelectingMaterials === campaign.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5 mr-1" />
                          )}
                          Selección automática IA
                        </Button>
                      </div>

                      {loadingMaterials === campaign.id && (
                        <p className="text-xs text-muted-foreground italic">Cargando materiales…</p>
                      )}

                      {allClientMaterials.length === 0 && (
                        <div className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                          El cliente todavía no ha subido materiales. Pídeselos desde la pestaña "Materiales" del cliente.
                        </div>
                      )}

                      {allClientMaterials.length > 0 && (
                        <div className="grid gap-2">
                          {allClientMaterials.map((mat) => {
                            const saved = (campaignMaterials[campaign.id] || []).find((m) => m.material_ref === mat.ref);
                            const selected = saved?.selected ?? false;
                            const hint = saved?.usage_hint ?? "";
                            return (
                              <div
                                key={mat.ref}
                                className={`p-3 rounded-md border transition ${selected ? "border-primary/40 bg-primary/5" : "border-border bg-secondary/10"}`}
                              >
                                <div className="flex items-start gap-3">
                                  <Checkbox
                                    checked={selected}
                                    onCheckedChange={(v) => upsertCampaignMaterial(campaign.id, mat, { selected: !!v })}
                                    className="mt-0.5"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="text-[10px] shrink-0">{mat.type}</Badge>
                                      <span className="text-sm font-medium text-foreground truncate">{mat.label}</span>
                                      {mat.url && (
                                        <a href={mat.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary shrink-0">
                                          <ExternalLink className="w-3 h-3" />
                                        </a>
                                      )}
                                    </div>
                                    {selected && (
                                      <Textarea
                                        defaultValue={hint}
                                        placeholder="Cómo usarlo (ej: 'esta foto va en el hero de la landing')…"
                                        className="mt-2 min-h-[50px] text-xs"
                                        onBlur={(e) => {
                                          if (e.target.value !== hint) {
                                            upsertCampaignMaterial(campaign.id, mat, { selected: true, usage_hint: e.target.value });
                                          }
                                        }}
                                      />
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Uncategorized assets */}
      {uncategorizedAssets.length > 0 && (
        <div className="bg-card rounded-lg border border-dashed border-border overflow-hidden">
          <button
            className="w-full p-4 flex items-center justify-between text-left hover:bg-secondary/30 transition-colors"
            onClick={() => toggleCampaign("uncategorized")}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[hsl(var(--status-pending-review))]" />
              <span className="text-sm font-medium text-foreground">Uncategorized assets ({uncategorizedAssets.length})</span>
            </div>
            {expandedCampaignId === "uncategorized" ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
          {expandedCampaignId === "uncategorized" && (
            <div className="p-4 border-t border-border space-y-2">
              {uncategorizedAssets.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  campaigns={campaigns}
                  clientId={clientId}
                  onAssignCampaign={assignAssetToCampaign}
                  onChanged={onAssetsChanged}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create campaign dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Campaign name *</label>
              <Input placeholder='e.g. "Captación Enero"' value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Status</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-foreground">Campaign Brief</p>
                <Button size="sm" variant="outline" onClick={() => generateBrief()} disabled={generating || !name.trim()}>
                  {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
                  Generate with AI
                </Button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground">Objective</label>
                  <Textarea placeholder="What is this campaign trying to achieve?" value={objective} onChange={(e) => setObjective(e.target.value)} className="mt-1 min-h-[60px]" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Target audience</label>
                  <Textarea placeholder="Who is this campaign for?" value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} className="mt-1 min-h-[60px]" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Key message</label>
                  <Textarea placeholder="What is the main message?" value={keyMessage} onChange={(e) => setKeyMessage(e.target.value)} className="mt-1 min-h-[60px]" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Timeline</label>
                  <Input placeholder="When does this campaign run?" value={timeline} onChange={(e) => setTimeline(e.target.value)} className="mt-1" />
                </div>
              </div>

              {briefReasoning["__new__"] && (
                <details className="mt-3 rounded-md border border-border bg-secondary/30 p-3 text-xs">
                  <summary className="cursor-pointer font-medium text-foreground">¿Por qué estas sugerencias?</summary>
                  <div className="mt-2 space-y-2 text-muted-foreground">
                    {Object.entries(briefReasoning["__new__"] as Record<string, string>).map(([k, v]) => (
                      <div key={k}><strong className="text-foreground capitalize">{k.replace(/_/g, " ")}:</strong> {v}</div>
                    ))}
                  </div>
                </details>
              )}

              <div className="mt-3 space-y-2">
                <label className="text-xs text-muted-foreground">Pídele un cambio a la IA (opcional)</label>
                <Textarea
                  placeholder='Ej: "más enfocado en pacientes recurrentes, no nuevos"'
                  value={briefFeedback}
                  onChange={(e) => setBriefFeedback(e.target.value)}
                  className="min-h-[50px] text-sm"
                />
                <Button size="sm" variant="outline" onClick={() => generateBrief({ feedback: briefFeedback })} disabled={generating || !briefFeedback.trim()} className="w-full">
                  {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
                  Regenerar con feedback
                </Button>
              </div>
            </div>
            <Button onClick={saveCampaign} disabled={creating || !name.trim()} className="w-full">
              {creating && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Save campaign
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add asset drawer */}
      {addAssetDrawer && (
        <AddAssetDrawer
          open={!!addAssetDrawer}
          onClose={() => setAddAssetDrawer(null)}
          clientId={clientId}
          campaignId={addAssetDrawer.campaignId}
          campaignName={addAssetDrawer.campaignName}
          onAssetSaved={() => onAssetsChanged?.()}
        />
      )}

      {/* New version drawer */}
      {newVersionDrawer && (
        <NewVersionDrawer
          open={!!newVersionDrawer}
          onClose={() => setNewVersionDrawer(null)}
          clientId={clientId}
          asset={newVersionDrawer.asset}
          campaignId={newVersionDrawer.campaignId}
          summary={newVersionDrawer.summary}
          onVersionUploaded={() => onAssetsChanged?.()}
        />
      )}

      {/* Notify confirmation modal */}
      <Dialog open={!!notifyConfirm} onOpenChange={(o) => !o && setNotifyConfirm(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send campaign review to client?</DialogTitle>
          </DialogHeader>
          {notifyConfirm && (() => {
            const types = ["landing_page", "email_flow", "social_post", "blog_article"] as const;
            const includedAssets = notifyConfirm.assets;

            return (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-3">Assets included in this notification:</p>
                  <div className="space-y-1.5">
                    {types.map((t) => {
                      const typeAssets = includedAssets.filter((a) => a.asset_type === t);
                      if (typeAssets.length > 0) {
                        return typeAssets.map((a) => (
                          <div key={a.id} className="flex items-center gap-2 text-sm">
                            <span>✅</span>
                            <span className="text-foreground">{ASSET_TYPE_FULL[t]} — {a.asset_name}</span>
                          </div>
                        ));
                      }
                      return (
                        <div key={t} className="flex items-center gap-2 text-sm">
                          <span>⚪</span>
                          <span className="text-muted-foreground">{ASSET_TYPE_FULL[t]} — not included (not uploaded)</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  The client will be asked to review only the uploaded assets.
                </p>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setNotifyConfirm(null)}>Cancel</Button>
                  <Button
                    disabled={notifying}
                    onClick={async () => {
                      setNotifying(true);
                      try {
                        // Set all uploaded assets to pending_review
                        for (const a of includedAssets) {
                          if (a.status !== "pending_review") {
                            await supabase.from("assets").update({ status: "pending_review" } as any).eq("id", a.id);
                          }
                        }

                        // Send notification
                        const { data, error } = await supabase.functions.invoke("send-notification", {
                          body: {
                            type: "campaign_ready",
                            client_id: clientId,
                            campaign_name: notifyConfirm.campaign.name,
                            asset_ids: includedAssets.map((a) => a.id),
                          },
                        });
                        if (error) throw error;
                        if (data?.error) throw new Error(data.error);

                        // Update last_notified_at
                        const now = new Date().toISOString();
                        await (supabase.from("campaigns" as any) as any)
                          .update({ last_notified_at: now, updated_at: now })
                          .eq("id", notifyConfirm.campaign.id);

                        onCampaignUpdated({ ...notifyConfirm.campaign, last_notified_at: now, updated_at: now } as Campaign);

                        // Log activity
                        await supabase.from("activity_log").insert({
                          entity_type: "campaign",
                          entity_id: notifyConfirm.campaign.id,
                          entity_name: notifyConfirm.campaign.name,
                          action: `Campaign '${notifyConfirm.campaign.name}' sent to client for review — ${includedAssets.length} assets included`,
                        });

                        toast.success(`Client notified about ${notifyConfirm.campaign.name}`);
                        onAssetsChanged?.();
                        setNotifyConfirm(null);
                      } catch (e: any) {
                        toast.error(`Failed to notify: ${e.message || "Unknown error"}`);
                      } finally {
                        setNotifying(false);
                      }
                    }}
                  >
                    {notifying && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    <Bell className="w-4 h-4 mr-2" /> Send notification
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
