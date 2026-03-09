import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Loader2, Copy, Upload, CheckCircle2, Sparkles, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import AssetUploadZone from "@/components/kickoff/AssetUploadZone";
import ClientMaterials, { type ClientMaterialsData } from "@/components/kickoff/ClientMaterials";
import KickoffQuestionsManager from "@/components/kickoff/KickoffQuestionsManager";

type Client = {
  id: string;
  name: string;
  company_name: string;
  email: string;
  vertical: string;
  sub_niche: string;
  market: string;
  prospect_id: string | null;
};

type KickoffBrief = {
  id: string;
  client_id: string;
  suggested_questions: any;
  transcript_text: string | null;
  transcript_status: string | null;
  audio_file_url: string | null;
  generated_prompts: any;
  pragma_approved: boolean | null;
};

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

export default function AdminClientKickoff() {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [kickoff, setKickoff] = useState<KickoffBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [transcriptText, setTranscriptText] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [materials, setMaterials] = useState<ClientMaterialsData>({});
  const [generating, setGenerating] = useState(false);
  const [generatedPrompts, setGeneratedPrompts] = useState<string | null>(null);
  const [contextSources, setContextSources] = useState<any>(null);
  const [showContextSources, setShowContextSources] = useState(false);
  const promptsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      const { data: clientData } = await supabase
        .from("clients")
        .select("*")
        .eq("id", id!)
        .single();

      setClient(clientData as Client | null);

      if (clientData) {
        const { data: kickoffData } = await supabase
          .from("kickoff_briefs")
          .select("*")
          .eq("client_id", id!)
          .maybeSingle();

        if (kickoffData) {
          setKickoff(kickoffData as KickoffBrief);
          setTranscriptText(kickoffData.transcript_text || "");
          setMaterials((kickoffData as any).client_materials || {});
          const gp = kickoffData.generated_prompts as any;
          if (gp?.raw_text) {
            setGeneratedPrompts(gp.raw_text);
            if (gp.context_sources) setContextSources(gp.context_sources);
          }
        }
      }

      setLoading(false);
    };
    fetchData();
  }, [id]);

  const saveTranscript = async () => {
    if (!client) return;
    setSaving(true);
    try {
      if (kickoff) {
        await supabase
          .from("kickoff_briefs")
          .update({ transcript_text: transcriptText, transcript_status: "ready" as any })
          .eq("id", kickoff.id);
      } else {
        const { data } = await supabase
          .from("kickoff_briefs")
          .insert({
            client_id: client.id,
            transcript_text: transcriptText,
            transcript_status: "ready" as any,
          })
          .select()
          .single();
        if (data) setKickoff(data as KickoffBrief);
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
        await supabase
          .from("kickoff_briefs")
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

    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("File too large. Maximum 100MB.");
      return;
    }

    setUploadingAudio(true);
    try {
      const filePath = `kickoff/${client.id}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from("kb-documents")
        .upload(filePath, file);

      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from("kb-documents")
        .getPublicUrl(filePath);

      if (kickoff) {
        await supabase
          .from("kickoff_briefs")
          .update({ audio_file_url: urlData.publicUrl, transcript_status: "pending" as any })
          .eq("id", kickoff.id);
      } else {
        const { data } = await supabase
          .from("kickoff_briefs")
          .insert({
            client_id: client.id,
            audio_file_url: urlData.publicUrl,
            transcript_status: "pending" as any,
          })
          .select()
          .single();
        if (data) setKickoff(data as KickoffBrief);
      }
      toast.success("Audio uploaded! Transcription will be processed.");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploadingAudio(false);
    }
  };

  if (loading) return <div className="p-8 text-muted-foreground">Loading...</div>;
  if (!client) return <div className="p-8 text-muted-foreground">Client not found.</div>;

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Kickoff — {client.company_name}</h1>
        <p className="text-muted-foreground">{client.name} · {client.email}</p>
      </div>

      {/* SECTION 1: Kickoff Questions (new editable component) */}
      <KickoffQuestionsManager
        clientId={client.id}
        clientName={client.name}
        vertical={client.vertical}
        subNiche={client.sub_niche}
      />

      {/* SECTION 2: Upload Transcript */}
      <div className="bg-card rounded-lg border border-border p-6 mb-6">
        <h3 className="font-semibold text-foreground mb-4">Kickoff Transcript</h3>

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
              <p className="text-sm text-muted-foreground mb-3">
                Upload .mp3, .mp4, .m4a, .wav, or .webm (max 100MB)
              </p>
              <Input
                type="file"
                accept=".mp3,.mp4,.m4a,.wav,.webm"
                onChange={handleAudioUpload}
                disabled={uploadingAudio}
                className="max-w-xs mx-auto"
              />
              {uploadingAudio && (
                <div className="flex items-center justify-center gap-2 mt-3">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Uploading...</span>
                </div>
              )}
              {kickoff?.audio_file_url && (
                <div className="flex items-center justify-center gap-2 mt-3 text-sm text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-status-accepted" />
                  Audio file uploaded
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Generate Prompts Button */}
        <div className="mt-6 pt-4 border-t border-border">
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
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Claude is analyzing the transcript...
                      </>
                    ) : generatedPrompts ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Regenerate Prompts
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate Prompts
                      </>
                    )}
                  </Button>
                </span>
              </TooltipTrigger>
              {transcriptText.trim().length < 50 && (
                <TooltipContent>
                  <p>Paste a transcript to continue (min 50 characters)</p>
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
                  <ContextLine
                    label={`Photos${contextSources.photos?.count ? ` (${contextSources.photos.count} assets)` : ""}`}
                    included={contextSources.photos?.included}
                  />
                  <ContextLine label="Existing emails" included={contextSources.emails} />
                  <ContextLine
                    label={`Social posts${contextSources.social_posts?.count ? ` (${contextSources.social_posts.count} posts)` : ""}`}
                    included={contextSources.social_posts?.included}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {generatedPrompts && (
        <div ref={promptsRef} className="bg-card rounded-lg border border-border p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Generated Prompts
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(generatedPrompts);
                toast.success("Prompts copied to clipboard!");
              }}
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy all
            </Button>
          </div>
          <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap">
            {generatedPrompts}
          </div>
        </div>
      )}

      {/* Client Materials */}
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
              client_id: client.id,
              client_materials: m,
            } as any).select().single();
            if (data) setKickoff(data as KickoffBrief);
          }
        }}
      />

      {/* Asset Upload Zones */}
      <div className="space-y-4">
        <h3 className="font-semibold text-foreground text-lg">Client Assets</h3>
        <div className="grid gap-4 lg:grid-cols-2">
          <AssetUploadZone clientId={client.id} assetType="landing_page" />
          <AssetUploadZone clientId={client.id} assetType="email_flow" />
          <AssetUploadZone clientId={client.id} assetType="social_post" />
          <AssetUploadZone clientId={client.id} assetType="blog_article" />
        </div>
      </div>
    </div>
  );
}
