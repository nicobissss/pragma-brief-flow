import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Copy, Upload, CheckCircle2 } from "lucide-react";
import AssetUploadZone from "@/components/kickoff/AssetUploadZone";
import ClientMaterials, { type ClientMaterialsData } from "@/components/kickoff/ClientMaterials";

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

function generateQuestions(vertical: string, subNiche: string): Record<string, string[]> {
  const base: Record<string, string[]> = {
    "Business & Offer Details": [
      "Describe your main service/product in one sentence.",
      "What's your unique selling proposition vs competitors?",
      "What's your average ticket / price point?",
      "Do you offer packages or individual services?",
      `What makes ${subNiche} your focus area?`,
    ],
    "Current Assets": [
      "Do you have existing brand guidelines (logo, colors, fonts)?",
      "Do you have professional photos of your team/space/products?",
      "Do you have any existing copy (website text, brochures)?",
      "Do you have existing email templates or sequences?",
      "What's your current website URL (if any)?",
    ],
    "Technical Setup": [
      "Do you have domain access for landing pages?",
      "What CRM or booking system do you currently use?",
      "Do you have a checkout or payment system?",
      "Do you have a WhatsApp Business number?",
      "Do you have Google Business Profile set up?",
    ],
    "Goals & KPIs": [
      "What's your primary goal for the first 3 months?",
      "How many new clients/sales do you want per month?",
      "What's your target revenue increase?",
      "What metrics are most important to you?",
      "Any seasonal peaks or events to plan around?",
    ],
    "Communication Preferences": [
      "What language/tone should we use in marketing materials?",
      "Who will be the main point of contact for approvals?",
      "How quickly can you review and approve assets?",
      "Do you prefer formal or casual communication?",
      "Any words or phrases you want us to always use or avoid?",
    ],
  };

  // Add vertical-specific questions
  if (vertical.toLowerCase().includes("salud") || vertical.toLowerCase().includes("estética")) {
    base["Business & Offer Details"].push("What certifications or licenses do your practitioners hold?");
    base["Business & Offer Details"].push("Do you offer before/after consultations?");
  } else if (vertical.toLowerCase().includes("learning") || vertical.toLowerCase().includes("curso")) {
    base["Business & Offer Details"].push("What format are your courses (live, recorded, hybrid)?");
    base["Business & Offer Details"].push("Do you offer certifications or diplomas?");
  } else if (vertical.toLowerCase().includes("deporte") || vertical.toLowerCase().includes("sport")) {
    base["Business & Offer Details"].push("What sports/activities do you offer?");
    base["Business & Offer Details"].push("Do you have membership plans or pay-per-session?");
  }

  return base;
}

export default function AdminClientKickoff() {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [kickoff, setKickoff] = useState<KickoffBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkedQuestions, setCheckedQuestions] = useState<Set<string>>(new Set());
  const [transcriptText, setTranscriptText] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [materials, setMaterials] = useState<ClientMaterialsData>({});

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
        }
      }

      setLoading(false);
    };
    fetchData();
  }, [id]);

  const questions = useMemo(
    () => client ? generateQuestions(client.vertical, client.sub_niche) : {},
    [client]
  );

  const copyAllQuestions = () => {
    const text = Object.entries(questions)
      .map(([cat, qs]) => `## ${cat}\n${qs.map((q, i) => `${i + 1}. ${q}`).join("\n")}`)
      .join("\n\n");
    navigator.clipboard.writeText(text);
    toast.success("Questions copied to clipboard!");
  };

  const toggleQuestion = (q: string) => {
    setCheckedQuestions((prev) => {
      const next = new Set(prev);
      next.has(q) ? next.delete(q) : next.add(q);
      return next;
    });
  };

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
            suggested_questions: questions,
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

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !client) return;

    const maxSize = 100 * 1024 * 1024; // 100MB
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
            suggested_questions: questions,
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

      {/* SECTION 1: Suggested Questions */}
      <div className="bg-card rounded-lg border border-border p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">Kickoff Questions</h3>
          <Button variant="outline" size="sm" onClick={copyAllQuestions}>
            <Copy className="w-4 h-4 mr-2" />
            Copy all
          </Button>
        </div>

        <div className="space-y-6">
          {Object.entries(questions).map(([category, qs]) => (
            <div key={category}>
              <h4 className="text-sm font-semibold text-foreground mb-2">{category}</h4>
              <div className="space-y-2">
                {qs.map((q) => (
                  <label
                    key={q}
                    className="flex items-start gap-3 p-2 rounded-md hover:bg-secondary/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={checkedQuestions.has(q)}
                      onCheckedChange={() => toggleQuestion(q)}
                      className="mt-0.5"
                    />
                    <span className={`text-sm ${checkedQuestions.has(q) ? "text-muted-foreground line-through" : "text-foreground"}`}>
                      {q}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

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
      </div>

      {/* SECTION 2.5: Client Materials */}
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
              suggested_questions: questions,
              client_materials: m,
            } as any).select().single();
            if (data) setKickoff(data as KickoffBrief);
          }
        }}
      />

      {/* SECTION 3: Asset Upload Zones */}
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
