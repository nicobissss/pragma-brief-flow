import { useEffect, useState, useRef } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Loader2, Copy, Upload, CheckCircle2, Sparkles, RefreshCw,
  ChevronDown, ChevronUp, Building2, Calendar, Globe, X, Plus, Share2,
} from "lucide-react";
import { format } from "date-fns";
import AssetUploadZone from "@/components/kickoff/AssetUploadZone";
import KickoffQuestionsManager from "@/components/kickoff/KickoffQuestionsManager";
import { AssetFeedbackPanel } from "@/components/admin/AssetFeedbackPanel";
import { AssetCollectionRequest } from "@/components/admin/AssetCollectionRequest";
import { CorrectionPromptPanel } from "@/components/admin/CorrectionPromptPanel";
import { CampaignManager } from "@/components/admin/CampaignManager";
import ClientMaterials, { type ClientMaterialsData } from "@/components/kickoff/ClientMaterials";
import { ProposalView, type ProposalData } from "@/components/proposal/ProposalView";
import SalesCallCard from "@/components/prospect/SalesCallCard";
const MARKETS = [
  { value: "es", label: "España" },
  { value: "it", label: "Italia" },
  { value: "ar", label: "Argentina" },
] as const;

// ─── Types ───────────────────────────────────────────────
type Client = {
  id: string;
  name: string;
  company_name: string;
  email: string;
  vertical: string;
  sub_niche: string;
  market: string;
  prospect_id: string | null;
  created_at: string;
  status: string;
  pipeline_status: string | null;
  max_revision_rounds: number | null;
  project_plan: any;
  project_plan_shared: boolean | null;
};

type Prospect = {
  id: string;
  name: string;
  company_name: string;
  email: string;
  phone: string | null;
  vertical: string;
  sub_niche: string;
  market: string;
  status: string;
  briefing_answers: Record<string, any>;
  created_at: string;
  call_status: string;
  call_scheduled_at: string | null;
  call_notes: string | null;
  follow_up_date: string | null;
};

type KickoffBrief = {
  id: string;
  client_id: string;
  suggested_questions: any;
  transcript_text: string | null;
  transcript_status: string | null;
  transcript_quality: string | null;
  audio_file_url: string | null;
  generated_prompts: any;
  pragma_approved: boolean | null;
  client_rules: any;
  client_materials: any;
  context_completeness_score: number | null;
  suggested_services: any;
  suggested_services_approved: boolean | null;
  voice_reference: string | null;
  preferred_tone: string | null;
};

type ToolGeneration = {
  id: string;
  client_id: string | null;
  tool_name: string;
  prompt: any;
  status: string | null;
  sent_at: string | null;
  created_at: string | null;
};

type AssetRow = {
  id: string;
  asset_name: string;
  asset_title: string | null;
  asset_type: string;
  status: string;
  file_url: string | null;
  content: any;
  version: number;
  client_comment: string | null;
  correction_prompt: string | null;
  created_at: string;
  strategic_note: string | null;
  strategic_note_approved: boolean | null;
  assigned_to: string | null;
  due_date: string | null;
  incorporated: boolean | null;
};

type ClientNote = {
  id: string;
  note: string;
  author: string | null;
  created_at: string;
};

// ─── Helpers ─────────────────────────────────────────────
const VERTICAL_COLORS: Record<string, string> = {
  "Salud & Estética": "hsl(220, 63%, 22%)",
  "E-Learning": "hsl(152, 44%, 23%)",
  "Deporte Offline": "hsl(282, 54%, 36%)",
};

function InfoRow({ label, value }: { label: string; value: any }) {
  if (value === null || value === undefined || value === "") return null;
  const display = Array.isArray(value) ? value.join(", ") : String(value);
  return (
    <div className="flex justify-between py-2 border-b border-border last:border-0">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-foreground text-sm font-medium text-right max-w-[60%]">{display}</span>
    </div>
  );
}

function ContextLine({ label, included }: { label: string; included: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span>{included ? "✅" : "⚪"}</span>
      <span className={included ? "text-foreground" : "text-muted-foreground"}>
        {label}{!included && " (not provided)"}
      </span>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────
export default function AdminClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<Client | null>(null);
  const [prospect, setProspect] = useState<Prospect | null>(null);
  const [proposal, setProposal] = useState<ProposalData | null>(null);
  const [kickoff, setKickoff] = useState<KickoffBrief | null>(null);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [toolGenerations, setToolGenerations] = useState<ToolGeneration[]>([]);
  const [analyzingTranscript, setAnalyzingTranscript] = useState(false);

  // Notes state (FEAT-04)
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [noteAuthor, setNoteAuthor] = useState("Nicolò");

  // Client rules (FEAT-09)
  const [newRule, setNewRule] = useState("");

  // Kickoff state
  const [transcriptText, setTranscriptText] = useState("");
  const [transcriptQuality, setTranscriptQuality] = useState("not_set");
  const [saving, setSaving] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [materials, setMaterials] = useState<ClientMaterialsData>({});
  const [generating, setGenerating] = useState(false);
  const [generatedPrompts, setGeneratedPrompts] = useState<string | null>(null);
  const [contextSources, setContextSources] = useState<any>(null);
  const [showContextSources, setShowContextSources] = useState(false);
  const promptsRef = useRef<HTMLDivElement>(null);

  const [defaultTab, setDefaultTab] = useState<string>("prospect");

  useEffect(() => {
    const fetchAll = async () => {
      const { data: clientData } = await supabase
        .from("clients").select("*").eq("id", id!).single();
      if (!clientData) { setLoading(false); return; }
      setClient(clientData as unknown as Client);

      const kickoffPromise = supabase.from("kickoff_briefs").select("*").eq("client_id", id!).maybeSingle();
      const assetsPromise = supabase.from("assets").select("id, asset_name, asset_title, asset_type, status, file_url, content, version, client_comment, correction_prompt, created_at, campaign_id, strategic_note, strategic_note_approved, assigned_to, due_date, incorporated").eq("client_id", id!);
      const campaignsPromise = (supabase.from("campaigns" as any) as any).select("*").eq("client_id", id!).order("created_at", { ascending: false });
      const notesPromise = supabase.from("client_notes").select("*").eq("client_id", id!).order("created_at", { ascending: false });

      let prospectPromise: any = null;
      let proposalPromise: any = null;

      if (clientData.prospect_id) {
        prospectPromise = supabase.from("prospects").select("*").eq("id", clientData.prospect_id).single();
        proposalPromise = supabase.from("proposals").select("full_proposal_content").eq("prospect_id", clientData.prospect_id).maybeSingle();
      }

      const [kickoffRes, assetsRes, campaignsRes, notesRes] = await Promise.all([kickoffPromise, assetsPromise, campaignsPromise, notesPromise]);
      const kickoffData = kickoffRes.data;
      const assetsData = (assetsRes.data || []) as AssetRow[];
      setCampaigns((campaignsRes.data || []) as any[]);
      setNotes((notesRes.data || []) as ClientNote[]);

      if (kickoffData) {
        setKickoff(kickoffData as unknown as KickoffBrief);
        setTranscriptText(kickoffData.transcript_text || "");
        setTranscriptQuality((kickoffData as any).transcript_quality || "not_set");
        setMaterials((kickoffData as any).client_materials || {});
        const gp = kickoffData.generated_prompts as any;
        if (gp?.raw_text) {
          setGeneratedPrompts(gp.raw_text);
          if (gp.context_sources) setContextSources(gp.context_sources);
        }
      }

      setAssets(assetsData);

      if (prospectPromise && proposalPromise) {
        const [prospectRes, proposalRes] = await Promise.all([prospectPromise, proposalPromise]);
        if (prospectRes.data) setProspect(prospectRes.data as unknown as Prospect);
        if (proposalRes.data?.full_proposal_content) {
          setProposal(proposalRes.data.full_proposal_content as unknown as ProposalData);
        }
      }

      const hasChangeRequested = assetsData.some((a: any) => a.status === "change_requested");
      if (hasChangeRequested) setDefaultTab("assets");

      setLoading(false);
    };
    fetchAll();
  }, [id]);

  const saveTranscript = async () => {
    if (!client) return;
    setSaving(true);
    try {
      if (kickoff) {
        await supabase.from("kickoff_briefs")
          .update({ transcript_text: transcriptText, transcript_quality: transcriptQuality, transcript_status: "ready" as any })
          .eq("id", kickoff.id);
      } else {
        const { data } = await supabase.from("kickoff_briefs")
          .insert({ client_id: client.id, transcript_text: transcriptText, transcript_quality: transcriptQuality, transcript_status: "ready" as any } as any)
          .select().single();
        if (data) setKickoff(data as unknown as KickoffBrief);
      }
      toast.success("Transcript saved!");
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleGeneratePrompts = async () => {
    if (!client) return;
    setGenerating(true);
    try {
      if (transcriptText.trim().length >= 50 && !kickoff) {
        await saveTranscript();
      } else if (kickoff && transcriptText !== (kickoff.transcript_text || "")) {
        await supabase.from("kickoff_briefs")
          .update({ transcript_text: transcriptText, transcript_status: "ready" as any })
          .eq("id", kickoff.id);
      }
      const { data, error } = await supabase.functions.invoke("generate-kickoff-prompts", {
        body: { client_id: client.id },
      });
      if (error) throw error;
      if (data?.prompts) {
        setGeneratedPrompts(data.prompts);
        if (data.context_sources) setContextSources(data.context_sources);
        toast.success("Prompts generated successfully!");
        setTimeout(() => promptsRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      } else {
        throw new Error(data?.error || "No prompts returned");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to generate prompts");
    } finally {
      setGenerating(false);
    }
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !client) return;
    if (file.size > 100 * 1024 * 1024) { toast.error("File too large. Maximum 100MB."); return; }
    setUploadingAudio(true);
    try {
      const filePath = `kickoff/${client.id}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage.from("kb-documents").upload(filePath, file);
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from("kb-documents").getPublicUrl(filePath);
      if (kickoff) {
        await supabase.from("kickoff_briefs")
          .update({ audio_file_url: urlData.publicUrl, transcript_status: "pending" as any })
          .eq("id", kickoff.id);
      } else {
        const { data } = await supabase.from("kickoff_briefs")
          .insert({ client_id: client.id, audio_file_url: urlData.publicUrl, transcript_status: "pending" as any } as any)
          .select().single();
        if (data) setKickoff(data as unknown as KickoffBrief);
      }
      toast.success("Audio uploaded! Transcription will be processed.");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploadingAudio(false);
    }
  };

  const handleCallUpdate = (fields: Record<string, any>) => {
    if (!prospect) return;
    setProspect({ ...prospect, ...fields });
  };

  // FEAT-03: Status updates
  const updateClientStatus = async (status: string) => {
    if (!client) return;
    const { error } = await supabase.from("clients").update({ status } as any).eq("id", client.id);
    if (error) { toast.error(error.message); return; }
    setClient({ ...client, status });
    toast.success(`Estado: ${status}`);
  };

  const updatePipelineStatus = async (pipeline_status: string) => {
    if (!client) return;
    const { error } = await supabase.from("clients").update({ pipeline_status } as any).eq("id", client.id);
    if (error) { toast.error(error.message); return; }
    setClient({ ...client, pipeline_status });
    toast.success(`Pipeline: ${pipeline_status}`);
  };

  // FEAT-04: Save note
  const handleSaveNote = async () => {
    if (!client || !newNote.trim()) return;
    const { data, error } = await supabase.from("client_notes").insert({
      client_id: client.id,
      note: newNote.trim(),
      author: noteAuthor,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    setNotes([data as ClientNote, ...notes]);
    setNewNote("");
    toast.success("Nota guardada");
  };

  // FEAT-09: Client rules
  const clientRules: string[] = Array.isArray(kickoff?.client_rules) ? kickoff.client_rules : [];
  const handleAddRule = async () => {
    if (!kickoff || !newRule.trim()) return;
    const updated = [...clientRules, newRule.trim()];
    await supabase.from("kickoff_briefs").update({ client_rules: updated } as any).eq("id", kickoff.id);
    setKickoff({ ...kickoff, client_rules: updated });
    setNewRule("");
    toast.success("Regla añadida");
  };
  const handleRemoveRule = async (idx: number) => {
    if (!kickoff) return;
    const updated = clientRules.filter((_, i) => i !== idx);
    await supabase.from("kickoff_briefs").update({ client_rules: updated } as any).eq("id", kickoff.id);
    setKickoff({ ...kickoff, client_rules: updated });
  };

  // FEAT-10: Revision counter
  const revisionCount = assets.reduce((sum, a) => sum + (a.version - 1), 0);
  const maxRevisions = client?.max_revision_rounds ?? 3;
  const updateMaxRevisions = async (val: number) => {
    if (!client) return;
    await supabase.from("clients").update({ max_revision_rounds: val } as any).eq("id", client.id);
    setClient({ ...client, max_revision_rounds: val });
  };

  // FEAT-05: Context completeness
  const briefingAnswers = prospect?.briefing_answers || {};
  const computeCompleteness = () => {
    const checks = [
      !!kickoff?.transcript_text,
      transcriptQuality === "good",
      Object.keys(briefingAnswers).length > 0,
      !!(materials as any)?.primary_color,
      !!(materials as any)?.website_context,
      !!(materials as any)?.pricing_pdf_text,
      ((materials as any)?.photos?.length > 0),
      ((materials as any)?.social_posts?.length > 0),
    ];
    const score = checks.filter(Boolean).length;
    return Math.min(100, score * 13);
  };
  const completenessPct = computeCompleteness();

  // FEAT-07: Strategic note approve
  const handleApproveStrategicNote = async (assetId: string) => {
    await supabase.from("assets").update({ strategic_note_approved: true } as any).eq("id", assetId);
    setAssets(assets.map(a => a.id === assetId ? { ...a, strategic_note_approved: true } : a));
    const asset = assets.find(a => a.id === assetId);
    try {
      await supabase.from("events").insert({
        event_type: "asset.uploaded",
        entity_type: "asset",
        entity_id: assetId,
        payload: { asset_title: asset?.asset_title, client_id: client?.id, client_name: client?.name },
      } as any);
    } catch (_) {}
    toast.success("Nota estratégica aprobada");
  };

  // FEAT-11: Share project plan
  const handleSharePlan = async () => {
    if (!client) return;
    await supabase.from("clients").update({ project_plan_shared: true } as any).eq("id", client.id);
    setClient({ ...client, project_plan_shared: true });
    toast.success("Plan compartido con el cliente");
  };

  // ─── Badge counts ──────────────────────────────────────
  const kickoffBadge = !kickoff?.transcript_text;
  const changeRequestedCount = assets.filter((a) => a.status === "change_requested").length;

  if (loading) return (
    <div className="p-8 max-w-5xl space-y-4">
      <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
      <div className="h-4 w-64 animate-pulse rounded bg-muted" />
      {[1,2,3].map(i => <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />)}
    </div>
  );
  if (!client) return (
    <div className="p-8 max-w-5xl">
      <div className="bg-card rounded-lg border border-border p-8 text-center space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Client not found</h2>
        <p className="text-sm text-muted-foreground">This client may have been deleted or you don't have access.</p>
        <Button variant="outline" onClick={() => navigate("/admin/clients")}>Back to Clients</Button>
      </div>
    </div>
  );

  const marketLabel = MARKETS.find((m) => m.value === client.market)?.label || client.market;
  const verticalColor = VERTICAL_COLORS[client.vertical] || "hsl(var(--primary))";
  const answers = prospect?.briefing_answers || {};
  const contractType = proposal?.pricing?.contract_type;

  const getAssetStatus = (type: string) => {
    const matching = assets.filter((a) => a.asset_type === type);
    if (matching.length === 0) return "none";
    if (matching.some((a) => a.status === "change_requested")) return "change_requested";
    if (matching.some((a) => a.status === "pending_review")) return "pending_review";
    if (matching.every((a) => a.status === "approved")) return "approved";
    return "pending_review";
  };

  const assetStatusIcon = (status: string) => {
    switch (status) {
      case "approved": return "✅";
      case "pending_review": return "⏳";
      case "change_requested": return "💬";
      default: return "—";
    }
  };

  return (
    <div className="p-8 max-w-5xl">
      <Button variant="ghost" size="sm" onClick={() => navigate("/admin/clients")} className="mb-4">
        <ChevronDown className="w-4 h-4 mr-1 rotate-90" /> Volver a clientes
      </Button>
      {/* ─── Header ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <Building2 className="w-6 h-6 text-muted-foreground" />
        <h1 className="text-2xl font-bold text-foreground">{client.company_name}</h1>
        <Badge style={{ backgroundColor: verticalColor }} className="text-white text-xs">
          {client.vertical}
        </Badge>
        <Badge variant="outline" className="text-xs">{marketLabel}</Badge>
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          Client since {new Date(client.created_at).toLocaleDateString()}
        </span>
        {contractType && (
          <Badge variant="secondary" className="text-xs">{contractType}</Badge>
        )}
      </div>

      {/* FEAT-03: Status + Pipeline selects */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Select value={client.status} onValueChange={updateClientStatus}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">🟢 Activo</SelectItem>
            <SelectItem value="paused">🟡 Pausado</SelectItem>
            <SelectItem value="churned">🔴 Churned</SelectItem>
          </SelectContent>
        </Select>
        <Select value={client.pipeline_status || "kickoff"} onValueChange={updatePipelineStatus}>
          <SelectTrigger className="w-[200px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="kickoff">Kickoff</SelectItem>
            <SelectItem value="materials">Recogiendo materiales</SelectItem>
            <SelectItem value="production">En producción</SelectItem>
            <SelectItem value="review">En revisión</SelectItem>
            <SelectItem value="completed">Completado</SelectItem>
          </SelectContent>
        </Select>

        {/* FEAT-10: Revision counter */}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-muted-foreground">Revisiones:</span>
          <Badge variant={revisionCount >= maxRevisions ? "destructive" : revisionCount >= maxRevisions - 1 ? "secondary" : "outline"} className="text-xs">
            {revisionCount} / {maxRevisions}
          </Badge>
          <Input
            type="number"
            min={1}
            max={20}
            value={maxRevisions}
            onChange={(e) => updateMaxRevisions(parseInt(e.target.value) || 3)}
            className="w-14 h-7 text-xs text-center"
          />
        </div>
      </div>

      {/* ─── Tabs ───────────────────────────────────────── */}
      <Tabs defaultValue={defaultTab}>
        <TabsList className="sticky top-0 z-10 bg-background border-b border-border w-full justify-start rounded-none px-0 h-auto pb-0">
          <TabsTrigger value="prospect" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[hsl(348,80%,52%)] data-[state=active]:text-foreground px-4 py-2.5">
            Prospect Info
          </TabsTrigger>
          <TabsTrigger value="kickoff" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[hsl(348,80%,52%)] data-[state=active]:text-foreground px-4 py-2.5 relative">
            Kickoff
            {kickoffBadge && <span className="ml-1.5 w-2 h-2 rounded-full bg-accent inline-block" />}
          </TabsTrigger>
          <TabsTrigger value="prompts" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[hsl(348,80%,52%)] data-[state=active]:text-foreground px-4 py-2.5">
            Prompts
          </TabsTrigger>
          <TabsTrigger value="assets" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[hsl(348,80%,52%)] data-[state=active]:text-foreground px-4 py-2.5 relative">
            Assets
            {changeRequestedCount > 0 && (
              <Badge variant="destructive" className="ml-1.5 text-[10px] px-1.5 py-0 h-4 min-w-4">
                {changeRequestedCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* TAB 1 — Prospect Info */}
        <TabsContent value="prospect" className="mt-6 space-y-6">
          {prospect ? (
            <>
              <Collapsible>
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <CollapsibleTrigger className="w-full flex items-center justify-between p-5 hover:bg-secondary/30 transition-colors">
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Ver pre-cualificación
                    </h3>
                    <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-5 pb-5 space-y-2">
                      {([
                        ["País", client.market === "es" ? "España" : client.market === "it" ? "Italia" : "Argentina"],
                        ["Sector", client.vertical],
                        ["Especialización", client.sub_niche],
                        ["Ticket medio", answers.average_ticket
                          ? `${answers.average_ticket} ${answers.ticket_currency || "EUR"}`
                          : null],
                      ] as [string, string | null][]).filter(([, v]) => v).map(([label, value]) => (
                        <div key={label} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-medium">{value}</span>
                        </div>
                      ))}
                      {answers.description && (
                        <div className="pt-2 border-t border-border text-sm space-y-1">
                          <span className="text-muted-foreground text-xs uppercase tracking-wide">Descripción</span>
                          <p>{answers.description}</p>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>

              <div className="bg-card rounded-lg border border-border p-6">
                <h3 className="font-semibold text-foreground mb-4">About the Business</h3>
                <InfoRow label="Full name" value={prospect.name} />
                <InfoRow label="Company" value={prospect.company_name} />
                <InfoRow label="Email" value={prospect.email} />
                <InfoRow label="Phone" value={prospect.phone} />
                <InfoRow label="Market" value={marketLabel} />
                <InfoRow label="Vertical" value={prospect.vertical} />
                <InfoRow label="Sub-niche" value={prospect.sub_niche} />
              </div>

              <div className="bg-card rounded-lg border border-border p-6">
                <h3 className="font-semibold text-foreground mb-4">Current Situation</h3>
                <InfoRow label="Years in operation" value={answers.years_in_operation} />
                <InfoRow label="Monthly new clients" value={answers.monthly_new_clients} />
                <InfoRow label="Client sources" value={answers.client_sources} />
                <InfoRow label="Runs paid ads" value={answers.runs_paid_ads} />
                <InfoRow label="Ad platforms" value={answers.ad_platforms} />
                <InfoRow label="Monthly budget" value={answers.monthly_budget} />
                <InfoRow label="Has email list" value={answers.has_email_list} />
                <InfoRow label="Email list size" value={answers.email_list_size} />
                <InfoRow label="Has website" value={answers.has_website} />
                <InfoRow label="Website URL" value={answers.website_url} />
                <InfoRow label="Uses CRM" value={answers.uses_crm} />
                <InfoRow label="CRM system" value={answers.crm_name} />
              </div>

              <div className="bg-card rounded-lg border border-border p-6">
                <h3 className="font-semibold text-foreground mb-4">Goals</h3>
                <InfoRow label="Main goal" value={answers.main_goal} />
                <InfoRow label="Average ticket" value={answers.average_ticket ? `${answers.average_ticket} ${answers.ticket_currency || "EUR"}` : undefined} />
                <InfoRow label="Biggest challenge" value={answers.biggest_challenge} />
                <InfoRow label="Differentiator" value={answers.differentiator} />
                <InfoRow label="Additional info" value={answers.additional_info} />
              </div>

              {proposal && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-foreground text-lg">Generated Proposal</h3>
                  <ProposalView data={proposal} editable={false} />
                </div>
              )}

              {prospect && (
                <SalesCallCard
                  prospectId={prospect.id}
                  callStatus={prospect.call_status as any}
                  callScheduledAt={prospect.call_scheduled_at}
                  callNotes={prospect.call_notes}
                  followUpDate={prospect.follow_up_date}
                  onUpdate={handleCallUpdate}
                />
              )}
            </>
          ) : (
            <div className="bg-card rounded-lg border border-border p-8 text-center text-muted-foreground">
              No prospect data linked to this client.
            </div>
          )}

          {/* FEAT-04: Internal notes */}
          <div className="bg-card rounded-lg border border-border p-6 space-y-4">
            <h3 className="font-semibold text-foreground">Notas internas</h3>
            <p className="text-xs text-muted-foreground">Solo visibles para el equipo PRAGMA — nunca para el cliente.</p>
            <div className="flex gap-2">
              <Textarea
                placeholder="Escribe una nota..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="min-h-[60px] flex-1"
              />
              <div className="flex flex-col gap-2">
                <Select value={noteAuthor} onValueChange={setNoteAuthor}>
                  <SelectTrigger className="w-[120px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Nicolò">Nicolò</SelectItem>
                    <SelectItem value="Karla">Karla</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={handleSaveNote} disabled={!newNote.trim()}>Guardar</Button>
              </div>
            </div>
            {notes.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {notes.map((n) => (
                  <div key={n.id} className="p-3 rounded-md bg-secondary/30 text-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-foreground">{n.author || "—"}</span>
                      <span className="text-xs text-muted-foreground">{format(new Date(n.created_at!), "dd MMM yyyy HH:mm")}</span>
                    </div>
                    <p className="text-muted-foreground">{n.note}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* FEAT-11: Project plan */}
          <div className="bg-card rounded-lg border border-border p-6 space-y-3">
            <h3 className="font-semibold text-foreground">Plan del proyecto</h3>
            {!client.project_plan ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-2">No hay plan generado aún.</p>
                <Button variant="outline" size="sm" disabled>
                  <Sparkles className="w-4 h-4 mr-1" /> Generar plan del proyecto
                </Button>
              </div>
            ) : client.project_plan_shared ? (
              <div className="space-y-2">
                <Badge className="badge-accepted text-xs">✅ Plan compartido</Badge>
                <pre className="text-xs bg-secondary/30 p-3 rounded-md whitespace-pre-wrap">{JSON.stringify(client.project_plan, null, 2)}</pre>
              </div>
            ) : (
              <div className="space-y-2">
                <pre className="text-xs bg-secondary/30 p-3 rounded-md whitespace-pre-wrap">{JSON.stringify(client.project_plan, null, 2)}</pre>
                <Button size="sm" onClick={handleSharePlan}>
                  <Share2 className="w-4 h-4 mr-1" /> Compartir con cliente
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        {/* TAB 2 — Kickoff */}
        <TabsContent value="kickoff" className="mt-6 space-y-6">
          {client && (
            <KickoffQuestionsManager
              clientId={client.id}
              clientName={client.name}
              vertical={client.vertical}
              subNiche={client.sub_niche}
            />
          )}

          {/* FEAT-05: Completeness score */}
          <div className="bg-card rounded-lg border border-border p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Contexto para Claude: {completenessPct}%</h3>
              {completenessPct < 60 && <span className="text-xs text-[hsl(var(--status-pending-review))]">⚠️ Añade más contexto</span>}
              {completenessPct >= 80 && <span className="text-xs text-[hsl(142,71%,35%)]">✅ Listo para generar</span>}
            </div>
            <Progress value={completenessPct} className="h-1.5" />
          </div>

          {/* Transcript */}
          <div className="bg-card rounded-lg border border-border p-6">
            <h3 className="font-semibold text-foreground mb-4">Kickoff Transcript</h3>

            {/* FEAT-05: Transcript quality */}
            <div className="mb-4">
              <label className="text-sm font-medium text-foreground block mb-1.5">Calidad de la transcripción</label>
              <Select value={transcriptQuality} onValueChange={setTranscriptQuality}>
                <SelectTrigger className="w-[280px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_set">Sin evaluar</SelectItem>
                  <SelectItem value="good">✅ Buena</SelectItem>
                  <SelectItem value="medium">🟡 Media</SelectItem>
                  <SelectItem value="poor">🔴 Pobre — los prompts pueden ser menos precisos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Tabs defaultValue="text">
              <TabsList>
                <TabsTrigger value="text">Paste Text</TabsTrigger>
                <TabsTrigger value="audio">Upload Audio/Video</TabsTrigger>
              </TabsList>
              <TabsContent value="text" className="mt-4">
                <Textarea
                  placeholder="Paste the call transcript here..."
                  value={transcriptText}
                  onChange={(e) => setTranscriptText(e.target.value)}
                  className="min-h-[200px]"
                />
                {transcriptText.trim() && (
                  <Button onClick={saveTranscript} disabled={saving} className="mt-3">
                    {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Save Transcript
                  </Button>
                )}
              </TabsContent>
              <TabsContent value="audio" className="mt-4">
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                  <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-3">Upload .mp3, .mp4, .m4a, .wav, or .webm (max 100MB)</p>
                  <Input type="file" accept=".mp3,.mp4,.m4a,.wav,.webm" onChange={handleAudioUpload} disabled={uploadingAudio} className="max-w-xs mx-auto" />
                  {uploadingAudio && (
                    <div className="flex items-center justify-center gap-2 mt-3">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground">Uploading...</span>
                    </div>
                  )}
                  {kickoff?.audio_file_url && (
                    <div className="flex items-center justify-center gap-2 mt-3 text-sm text-muted-foreground">
                      <CheckCircle2 className="w-4 h-4 text-[hsl(142,71%,35%)]" />
                      Audio file uploaded
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <ClientMaterials
            clientId={client.id}
            kickoffId={kickoff?.id || null}
            materials={materials}
            onMaterialsChange={setMaterials}
            onSave={async (m) => {
              if (kickoff) {
                await supabase.from("kickoff_briefs").update({ client_materials: m } as any).eq("id", kickoff.id);
              } else {
                const { data } = await supabase.from("kickoff_briefs").insert({
                  client_id: client.id, client_materials: m,
                } as any).select().single();
                if (data) setKickoff(data as unknown as KickoffBrief);
              }
            }}
          />

          <AssetCollectionRequest clientId={client.id} clientName={client.name} />

          {/* FEAT-09: Client rules */}
          <Collapsible>
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <CollapsibleTrigger className="w-full flex items-center justify-between p-5 hover:bg-secondary/30 transition-colors">
                <h3 className="font-semibold text-foreground text-sm">Reglas del cliente ({clientRules.length})</h3>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-5 pb-5 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {clientRules.map((rule, i) => (
                      <Badge key={i} variant="secondary" className="text-xs gap-1">
                        {rule}
                        <button onClick={() => handleRemoveRule(i)} className="ml-1 hover:text-destructive">
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                    {clientRules.length === 0 && <p className="text-xs text-muted-foreground">Sin reglas definidas</p>}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Añadir regla..."
                      value={newRule}
                      onChange={(e) => setNewRule(e.target.value)}
                      className="flex-1"
                      onKeyDown={(e) => e.key === "Enter" && handleAddRule()}
                    />
                    <Button size="sm" onClick={handleAddRule} disabled={!newRule.trim()}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        </TabsContent>

        {/* TAB 3 — Prompts */}
        <TabsContent value="prompts" className="mt-6 space-y-6">
          <div className="bg-card rounded-lg border border-border p-6">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Generated Prompts
            </h3>

            <div className="mb-4">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-block">
                      <Button
                        onClick={handleGeneratePrompts}
                        disabled={generating || transcriptText.trim().length < 50}
                        className={transcriptText.trim().length >= 50 && !generating
                          ? "bg-[hsl(142,71%,35%)] hover:bg-[hsl(142,71%,30%)] text-white"
                          : ""}
                      >
                        {generating ? (
                          <><Loader2 className="w-4 h-4 animate-spin mr-2" />Claude is analyzing...</>
                        ) : generatedPrompts ? (
                          <><RefreshCw className="w-4 h-4 mr-2" />Regenerate Prompts</>
                        ) : (
                          <><Sparkles className="w-4 h-4 mr-2" />Generate Prompts</>
                        )}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {transcriptText.trim().length < 50 && (
                    <TooltipContent>
                      <p>Paste a transcript in the Kickoff tab first (min 50 characters)</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>

              {contextSources && (
                <div className="mt-3">
                  <button
                    onClick={() => setShowContextSources(!showContextSources)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showContextSources ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    Context used for generation
                  </button>
                  {showContextSources && (
                    <div className="mt-2 p-3 rounded-md bg-secondary/50 text-xs space-y-1">
                      <ContextLine label="Transcript" included={contextSources.transcript} />
                      <ContextLine label="Briefing answers" included={contextSources.briefing_answers} />
                      <ContextLine label="Proposal" included={contextSources.proposal} />
                      <ContextLine label="Brand colors" included={contextSources.brand_colors} />
                      <ContextLine label="Brand personality" included={contextSources.brand_tags} />
                      <ContextLine label="Website analysis" included={contextSources.website_context} />
                      <ContextLine label="Pricing PDF" included={contextSources.pricing_pdf} />
                      <ContextLine label={`Photos${contextSources.photos?.count ? ` (${contextSources.photos.count} assets)` : ""}`} included={contextSources.photos?.included} />
                      <ContextLine label="Existing emails" included={contextSources.emails} />
                      <ContextLine label={`Social posts${contextSources.social_posts?.count ? ` (${contextSources.social_posts.count} posts)` : ""}`} included={contextSources.social_posts?.included} />
                    </div>
                  )}
                </div>
              )}
            </div>

            {generatedPrompts && (
              <div ref={promptsRef}>
                <div className="flex justify-end mb-2">
                  <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(generatedPrompts); toast.success("Copied!"); }}>
                    <Copy className="w-4 h-4 mr-2" />Copy all
                  </Button>
                </div>
                <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap bg-secondary/20 rounded-lg p-4 border border-border">
                  {generatedPrompts}
                </div>
              </div>
            )}

            {!generatedPrompts && !generating && (
              <p className="text-sm text-muted-foreground">No prompts generated yet. Add a transcript in the Kickoff tab and click Generate.</p>
            )}
          </div>
        </TabsContent>

        {/* TAB 4 — Assets */}
        <TabsContent value="assets" className="mt-6 space-y-6">
          <div className="bg-card rounded-lg border border-border p-6">
            <h3 className="font-semibold text-foreground mb-4">Asset Status</h3>
            <div className="grid grid-cols-4 gap-3">
              {(["landing_page", "email_flow", "social_post", "blog_article"] as const).map((type) => {
                const status = getAssetStatus(type);
                const labels: Record<string, string> = { landing_page: "LP", email_flow: "Email", social_post: "Social", blog_article: "Blog" };
                return (
                  <div key={type} className="flex items-center gap-2 p-2 rounded-md bg-secondary/30 border border-border">
                    <span>{assetStatusIcon(status)}</span>
                    <span className="text-sm text-foreground font-medium">{labels[type]}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* FEAT-07: Strategic notes per asset */}
          {assets.filter(a => a.strategic_note || a.strategic_note_approved !== null).length > 0 && (
            <div className="bg-card rounded-lg border border-border p-6 space-y-3">
              <h3 className="font-semibold text-foreground text-sm">Notas estratégicas</h3>
              {assets.map((asset) => {
                if (!asset.strategic_note && !asset.strategic_note_approved) return null;
                return (
                  <div key={asset.id} className="p-3 rounded-md bg-secondary/20 border border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{asset.asset_name}</span>
                      {asset.strategic_note_approved && <Badge className="badge-accepted text-xs">✅ Aprobada</Badge>}
                    </div>
                    {asset.strategic_note && (
                      <p className="text-sm text-muted-foreground">{asset.strategic_note}</p>
                    )}
                    {asset.strategic_note && !asset.strategic_note_approved && (
                      <Button size="sm" variant="outline" onClick={() => handleApproveStrategicNote(asset.id)}>
                        Aprobar nota →
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <CampaignManager
            clientId={client.id}
            campaigns={campaigns}
            assets={assets.map((a: any) => ({ ...a, campaign_id: a.campaign_id || null }))}
            onCampaignCreated={(c) => setCampaigns((prev) => [c, ...prev])}
            onCampaignUpdated={(c) => setCampaigns((prev) => prev.map((p) => p.id === c.id ? c : p))}
            onAssetsChanged={async () => {
              const { data } = await supabase.from("assets").select("id, asset_name, asset_title, asset_type, status, file_url, content, version, client_comment, correction_prompt, created_at, campaign_id, strategic_note, strategic_note_approved, assigned_to, due_date, incorporated").eq("client_id", client.id);
              setAssets((data || []) as AssetRow[]);
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
