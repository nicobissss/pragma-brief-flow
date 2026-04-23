import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ChevronDown, Building2, Calendar, Sparkles } from "lucide-react";

import OfferingRecommendationTab from "@/components/admin/OfferingRecommendationTab";
import ActionPlanTab from "@/components/admin/ActionPlanTab";
import OverviewTab from "@/components/admin/tabs/OverviewTab";
import ProspectInfoTab from "@/components/admin/tabs/ProspectInfoTab";
import KickoffTab from "@/components/admin/tabs/KickoffTab";
import PromptsTab from "@/components/admin/tabs/PromptsTab";
import AssetsTab from "@/components/admin/tabs/AssetsTab";

import { type ProposalData } from "@/components/proposal/ProposalView";
import { type ClientMaterialsData } from "@/components/kickoff/ClientMaterials";
import { useContextScore } from "@/components/admin/ContextScorePanel";

const MARKETS = [
  { value: "es", label: "España" },
  { value: "it", label: "Italia" },
  { value: "ar", label: "Argentina" },
] as const;

const VERTICAL_COLORS: Record<string, string> = {
  "Salud & Estética": "hsl(220, 63%, 22%)",
  "E-Learning": "hsl(152, 44%, 23%)",
  "Deporte Offline": "hsl(282, 54%, 36%)",
};

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

export default function AdminClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<Client | null>(null);
  const [prospect, setProspect] = useState<any | null>(null);
  const [proposal, setProposal] = useState<ProposalData | null>(null);
  const [kickoff, setKickoff] = useState<any | null>(null);
  const [assets, setAssets] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [toolGenerations, setToolGenerations] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [hasOffering, setHasOffering] = useState(false);

  const [newNote, setNewNote] = useState("");
  const [noteAuthor, setNoteAuthor] = useState("Nicolò");
  const [newRule, setNewRule] = useState("");

  const [transcriptText, setTranscriptText] = useState("");
  const [transcriptQuality, setTranscriptQuality] = useState("not_set");
  const [saving, setSaving] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [materials, setMaterials] = useState<ClientMaterialsData>({});
  const [generating, setGenerating] = useState(false);
  const [generatedPrompts, setGeneratedPrompts] = useState<string | null>(null);
  const [analyzingTranscript, setAnalyzingTranscript] = useState(false);
  const [campaignBrief, setCampaignBrief] = useState<any>({
    campaign_objective: "",
    target_moment: "",
    main_hook: "",
    seasonal_context: "",
  });
  const [briefSaved, setBriefSaved] = useState(false);
  const [generatingBrief, setGeneratingBrief] = useState(false);
  const promptsRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<string>("overview");

  useEffect(() => {
    const fetchAll = async () => {
      const { data: clientData } = await supabase.from("clients").select("*").eq("id", id!).single();
      if (!clientData) { setLoading(false); return; }
      setClient(clientData as unknown as Client);

      const [kickoffRes, assetsRes, campaignsRes, notesRes, toolGensRes, offeringRes] = await Promise.all([
        supabase.from("kickoff_briefs").select("*").eq("client_id", id!).maybeSingle(),
        supabase.from("assets").select("id, asset_name, asset_title, asset_type, status, file_url, content, version, client_comment, correction_prompt, created_at, campaign_id, strategic_note, strategic_note_approved, assigned_to, due_date, incorporated, production_status").eq("client_id", id!),
        (supabase.from("campaigns" as any) as any).select("*").eq("client_id", id!).order("created_at", { ascending: false }),
        supabase.from("client_notes").select("*").eq("client_id", id!).order("created_at", { ascending: false }),
        supabase.from("tool_generations").select("*").eq("client_id", id!).order("created_at", { ascending: false }),
        supabase.from("client_offerings").select("id").eq("client_id", id!).limit(1),
      ]);

      setCampaigns((campaignsRes.data || []) as any[]);
      setNotes((notesRes.data || []) as any[]);
      setToolGenerations((toolGensRes.data || []) as any[]);
      setHasOffering(!!(offeringRes.data && offeringRes.data.length > 0));

      const kickoffData = kickoffRes.data;
      if (kickoffData) {
        setKickoff(kickoffData);
        setTranscriptText(kickoffData.transcript_text || "");
        setTranscriptQuality((kickoffData as any).transcript_quality || "not_set");
        setMaterials((kickoffData as any).client_materials || {});
        const gp = kickoffData.generated_prompts as any;
        if (gp?.raw_text) setGeneratedPrompts(gp.raw_text);
      }

      const assetsData = (assetsRes.data || []) as any[];
      setAssets(assetsData);

      if (clientData.prospect_id) {
        const [prospectRes, proposalRes] = await Promise.all([
          supabase.from("prospects").select("*").eq("id", clientData.prospect_id).single(),
          supabase.from("proposals").select("full_proposal_content").eq("prospect_id", clientData.prospect_id).maybeSingle(),
        ]);
        if (prospectRes.data) setProspect(prospectRes.data);
        if (proposalRes.data?.full_proposal_content) setProposal(proposalRes.data.full_proposal_content as unknown as ProposalData);
      }

      // Default landing tab logic
      if (assetsData.some((a: any) => a.status === "change_requested")) {
        setActiveTab("assets");
      }

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
        if (data) setKickoff(data);
      }
      toast.success("Transcript saved!");
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const autoGenerateBrief = async () => {
    if (!client) return;
    setGeneratingBrief(true);
    try {
      const context = `
Client: ${client.name} (${client.company_name})
Vertical: ${client.vertical} / ${client.sub_niche}
Market: ${client.market}
Briefing answers: ${JSON.stringify(prospect?.briefing_answers || {})}
Voice reference: ${kickoff?.voice_reference || "not available"}
Client rules: ${JSON.stringify(kickoff?.client_rules || [])}
Preferred tone: ${kickoff?.preferred_tone || "not set"}
Transcript excerpt: ${kickoff?.transcript_text?.slice(0, 2000) || "not available"}
      `.trim();
      const response = await supabase.functions.invoke("claude-proxy", {
        body: {
          prompt: `Based on this client context, generate a campaign brief with 4 fields.
Return ONLY valid JSON with these exact keys:
{"campaign_objective":"...","target_moment":"...","main_hook":"...","seasonal_context":""}
Write in client's market language. Be specific.
CLIENT CONTEXT:
${context}`
        }
      });
      if (response.data?.text) {
        const cleaned = response.data.text.replace(/^```json?\s*/i, "").replace(/```\s*$/, "").trim();
        const generated = JSON.parse(cleaned);
        setCampaignBrief(generated);
        toast.success("Brief generato — rivedi e modifica prima di salvare");
      }
    } catch (e) {
      console.error(e);
      toast.error("Errore nella generazione — compila manualmente");
    } finally {
      setGeneratingBrief(false);
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
        if (data.structured) {
          setGeneratedPrompts(JSON.stringify(data.prompts, null, 2));
          const { data: tg } = await supabase.from("tool_generations").select("*").eq("client_id", client.id).order("created_at", { ascending: false });
          setToolGenerations((tg || []) as any[]);
          const { data: kb } = await supabase.from("kickoff_briefs").select("*").eq("client_id", client.id).maybeSingle();
          if (kb) setKickoff(kb);
        } else {
          setGeneratedPrompts(data.prompts);
        }
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

  const handleAnalyzeTranscript = async () => {
    if (!client) return;
    setAnalyzingTranscript(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-kickoff-transcript", {
        body: { client_id: client.id },
      });
      if (error) throw error;
      if (data?.ok) {
        toast.success("Transcripción analizada");
        const { data: kb } = await supabase.from("kickoff_briefs").select("*").eq("client_id", client.id).maybeSingle();
        if (kb) setKickoff(kb);
      }
    } catch (e: any) {
      toast.error(e.message || "Error analyzing transcript");
    } finally {
      setAnalyzingTranscript(false);
    }
  };

  const handleSendToSlotty = async (gen: any) => {
    if (!client) return;
    const prompt = gen.prompt;
    const { data: matData } = await supabase.from("kickoff_briefs").select("client_materials").eq("client_id", client.id).maybeSingle();
    const cm = (matData?.client_materials || {}) as any;
    const brandAssets = {
      brand_name: client.company_name,
      primary_color: cm.primary_color || null,
      logo_url: cm.logo_url || null,
      photos: (cm.photos || []).map((p: any) => p.url).filter(Boolean),
    };
    const { error } = await supabase.from("slotty_workspace_requests").insert({
      client_id: client.id, client_name: client.name, client_email: client.email,
      workspace_config: prompt.workspace_config || prompt, brand_assets: brandAssets, status: "pending",
    } as any);
    if (error) { toast.error("Error al enviar a Slotty"); return; }
    await supabase.from("tool_generations").update({ status: "sent", sent_at: new Date().toISOString() } as any).eq("id", gen.id);
    setToolGenerations(toolGenerations.map(t => t.id === gen.id ? { ...t, status: "sent", sent_at: new Date().toISOString() } : t));
    toast.success("Solicitud enviada a Slotty");
  };

  const handleMarkSent = async (genId: string) => {
    await supabase.from("tool_generations").update({ status: "sent", sent_at: new Date().toISOString() } as any).eq("id", genId);
    setToolGenerations(toolGenerations.map(t => t.id === genId ? { ...t, status: "sent", sent_at: new Date().toISOString() } : t));
    toast.success("Marcado como enviado");
  };

  const handleApproveAllGens = async () => {
    const ids = toolGenerations.filter(t => t.status === "prompt_ready").map(t => t.id);
    if (ids.length === 0) return;
    for (const gid of ids) {
      await supabase.from("tool_generations").update({ status: "sent", sent_at: new Date().toISOString() } as any).eq("id", gid);
    }
    setToolGenerations(toolGenerations.map(t => ids.includes(t.id) ? { ...t, status: "sent", sent_at: new Date().toISOString() } : t));
    toast.success(`${ids.length} prompts marcados como enviados`);
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
        if (data) setKickoff(data);
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

  const handleSaveNote = async () => {
    if (!client || !newNote.trim()) return;
    const { data, error } = await supabase.from("client_notes").insert({
      client_id: client.id, note: newNote.trim(), author: noteAuthor,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    setNotes([data as any, ...notes]);
    setNewNote("");
    toast.success("Nota guardada");
  };

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

  const revisionCount = assets.reduce((sum, a) => sum + (a.version - 1), 0);
  const maxRevisions = client?.max_revision_rounds ?? 3;
  const updateMaxRevisions = async (val: number) => {
    if (!client) return;
    await supabase.from("clients").update({ max_revision_rounds: val } as any).eq("id", client.id);
    setClient({ ...client, max_revision_rounds: val });
  };

  const briefingAnswers = prospect?.briefing_answers || {};
  const contextScore = useContextScore({
    transcript_text: kickoff?.transcript_text,
    transcript_quality: (kickoff as any)?.transcript_quality,
    voice_reference: kickoff?.voice_reference,
    client_rules: kickoff?.client_rules as string[] | null,
    preferred_tone: kickoff?.preferred_tone,
    materials: materials as any,
    briefing_answers: briefingAnswers,
    has_proposal: !!proposal,
    has_campaign_brief: briefSaved || !!(campaignBrief.campaign_objective && campaignBrief.target_moment),
  });
  const completenessPct = contextScore.percentage;

  const handleApproveStrategicNote = async (assetId: string) => {
    await supabase.from("assets").update({ strategic_note_approved: true } as any).eq("id", assetId);
    setAssets(assets.map(a => a.id === assetId ? { ...a, strategic_note_approved: true } : a));
    toast.success("Nota estratégica aprobada");
  };

  const handleSharePlan = async () => {
    if (!client) return;
    await supabase.from("clients").update({ project_plan_shared: true } as any).eq("id", client.id);
    setClient({ ...client, project_plan_shared: true });
    toast.success("Plan compartido con el cliente");
  };

  const handleMaterialsSave = async (m: ClientMaterialsData) => {
    if (!client) return;
    if (kickoff) {
      await supabase.from("kickoff_briefs").update({ client_materials: m } as any).eq("id", kickoff.id);
    } else {
      const { data } = await supabase.from("kickoff_briefs").insert({
        client_id: client.id, client_materials: m,
      } as any).select().single();
      if (data) setKickoff(data);
    }
  };

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
        <Button variant="outline" onClick={() => navigate("/admin/clients")}>Back to Clients</Button>
      </div>
    </div>
  );

  const marketLabel = MARKETS.find((m) => m.value === client.market)?.label || client.market;
  const verticalColor = VERTICAL_COLORS[client.vertical] || "hsl(var(--primary))";
  const contractType = proposal?.pricing?.contract_type;

  return (
    <div className="p-8 max-w-5xl">
      <Button variant="ghost" size="sm" onClick={() => navigate("/admin/clients")} className="mb-4">
        <ChevronDown className="w-4 h-4 mr-1 rotate-90" /> Volver a clientes
      </Button>

      {/* Header */}
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
        {contractType && <Badge variant="secondary" className="text-xs">{contractType}</Badge>}
      </div>

      {/* Status & pipeline */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Select value={client.status} onValueChange={updateClientStatus}>
          <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">🟢 Activo</SelectItem>
            <SelectItem value="paused">🟡 Pausado</SelectItem>
            <SelectItem value="churned">🔴 Churned</SelectItem>
          </SelectContent>
        </Select>
        <Select value={client.pipeline_status || "kickoff"} onValueChange={updatePipelineStatus}>
          <SelectTrigger className="w-[200px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="kickoff">Kickoff</SelectItem>
            <SelectItem value="materiales">Recogiendo materiales</SelectItem>
            <SelectItem value="producción">En producción</SelectItem>
            <SelectItem value="revisión">En revisión</SelectItem>
            <SelectItem value="completado">Completado</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 ml-auto">
          <Button variant="outline" size="sm" onClick={() => navigate(`/admin/client/${client.id}/bible`)} className="h-7 text-xs">
            <Sparkles className="w-3 h-3 mr-1" />Client Bible
          </Button>
          <span className="text-xs text-muted-foreground">Revisiones:</span>
          <Badge variant={revisionCount >= maxRevisions ? "destructive" : revisionCount >= maxRevisions - 1 ? "secondary" : "outline"} className="text-xs">
            {revisionCount} / {maxRevisions}
          </Badge>
          <Input
            type="number" min={1} max={20} value={maxRevisions}
            onChange={(e) => updateMaxRevisions(parseInt(e.target.value) || 3)}
            className="w-14 h-7 text-xs text-center"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="sticky top-0 z-10 bg-background border-b border-border w-full justify-start rounded-none px-0 h-auto pb-0 overflow-x-auto">
          <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[hsl(348,80%,52%)] data-[state=active]:text-foreground px-4 py-2.5">
            Overview
          </TabsTrigger>
          <TabsTrigger value="prospect" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[hsl(348,80%,52%)] data-[state=active]:text-foreground px-4 py-2.5">
            Prospect Info
          </TabsTrigger>
          <TabsTrigger value="kickoff" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[hsl(348,80%,52%)] data-[state=active]:text-foreground px-4 py-2.5 relative">
            Kickoff
            {kickoffBadge && <span className="ml-1.5 w-2 h-2 rounded-full bg-accent inline-block" />}
          </TabsTrigger>
          <TabsTrigger value="oferta" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[hsl(348,80%,52%)] data-[state=active]:text-foreground px-4 py-2.5 relative">
            Oferta
            {!hasOffering && (
              <Badge variant="outline" className="ml-1.5 text-[9px] px-1.5 py-0 h-4 bg-amber-500/10 text-amber-700 border-amber-500/30">
                Por proponer
              </Badge>
            )}
          </TabsTrigger>
          {hasOffering && (
            <TabsTrigger value="plan" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[hsl(348,80%,52%)] data-[state=active]:text-foreground px-4 py-2.5">
              Plan de Acción
            </TabsTrigger>
          )}
          <TabsTrigger value="assets" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[hsl(348,80%,52%)] data-[state=active]:text-foreground px-4 py-2.5 relative">
            Campañas
            {changeRequestedCount > 0 && (
              <Badge variant="destructive" className="ml-1.5 text-[10px] px-1.5 py-0 h-4 min-w-4">
                {changeRequestedCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <OverviewTab
            client={client}
            kickoff={kickoff}
            hasOffering={hasOffering}
            contextScorePct={completenessPct}
            assets={assets}
            onNavigateTab={setActiveTab}
          />
        </TabsContent>

        <TabsContent value="prospect" className="mt-6">
          <ProspectInfoTab
            client={client}
            prospect={prospect}
            proposal={proposal}
            marketLabel={marketLabel}
            notes={notes}
            newNote={newNote}
            setNewNote={setNewNote}
            noteAuthor={noteAuthor}
            setNoteAuthor={setNoteAuthor}
            onSaveNote={handleSaveNote}
            onCallUpdate={handleCallUpdate}
            onSharePlan={handleSharePlan}
          />
        </TabsContent>

        <TabsContent value="kickoff" className="mt-6">
          <KickoffTab
            client={client}
            kickoff={kickoff}
            materials={materials}
            setMaterials={setMaterials}
            onMaterialsSave={handleMaterialsSave}
            transcriptText={transcriptText}
            setTranscriptText={setTranscriptText}
            transcriptQuality={transcriptQuality}
            setTranscriptQuality={setTranscriptQuality}
            saving={saving}
            onSaveTranscript={saveTranscript}
            uploadingAudio={uploadingAudio}
            onAudioUpload={handleAudioUpload}
            briefingAnswers={briefingAnswers}
            proposal={proposal}
            briefSaved={briefSaved}
            campaignBriefSet={!!(campaignBrief.campaign_objective && campaignBrief.target_moment)}
            newRule={newRule}
            setNewRule={setNewRule}
            clientRules={clientRules}
            onAddRule={handleAddRule}
            onRemoveRule={handleRemoveRule}
          />
        </TabsContent>

        <TabsContent value="oferta" className="mt-6">
          <OfferingRecommendationTab clientId={client.id} />
        </TabsContent>

        <TabsContent value="plan" className="mt-6">
          <ActionPlanTab clientId={client.id} />
        </TabsContent>

        <TabsContent value="assets" className="mt-6">
          <AssetsTab
            client={client}
            assets={assets}
            setAssets={setAssets}
            campaigns={campaigns}
            setCampaigns={setCampaigns}
            onApproveStrategicNote={handleApproveStrategicNote}
            promptsTabContent={
              <PromptsTab
                client={client}
                kickoff={kickoff}
                setKickoff={setKickoff}
                campaignBrief={campaignBrief}
                setCampaignBrief={setCampaignBrief}
                briefSaved={briefSaved}
                setBriefSaved={setBriefSaved}
                generatingBrief={generatingBrief}
                onAutoGenerateBrief={autoGenerateBrief}
                generating={generating}
                generatedPrompts={generatedPrompts}
                onGeneratePrompts={handleGeneratePrompts}
                analyzingTranscript={analyzingTranscript}
                onAnalyzeTranscript={handleAnalyzeTranscript}
                toolGenerations={toolGenerations}
                setToolGenerations={setToolGenerations}
                onSendToSlotty={handleSendToSlotty}
                onMarkSent={handleMarkSent}
                onApproveAllGens={handleApproveAllGens}
                contextScore={contextScore}
                completenessPct={completenessPct}
                materials={materials}
                promptsRef={promptsRef}
              />
            }
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
