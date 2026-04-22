import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, Upload, CheckCircle2, ChevronDown, X, Plus } from "lucide-react";
import KickoffQuestionsManager from "@/components/kickoff/KickoffQuestionsManager";
import ClientMaterials, { type ClientMaterialsData } from "@/components/kickoff/ClientMaterials";
import ClientPlatformsPanel from "@/components/admin/ClientPlatformsPanel";
import { AssetCollectionRequest } from "@/components/admin/AssetCollectionRequest";
import { ContextScorePanel } from "@/components/admin/ContextScorePanel";
import DiscoveryPanel from "@/components/admin/DiscoveryPanel";

type Props = {
  client: any;
  kickoff: any | null;
  materials: ClientMaterialsData;
  setMaterials: (m: ClientMaterialsData) => void;
  onMaterialsSave: (m: ClientMaterialsData) => Promise<void>;
  transcriptText: string;
  setTranscriptText: (v: string) => void;
  transcriptQuality: string;
  setTranscriptQuality: (v: string) => void;
  saving: boolean;
  onSaveTranscript: () => void;
  uploadingAudio: boolean;
  onAudioUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  briefingAnswers: Record<string, any>;
  proposal: any;
  briefSaved: boolean;
  campaignBriefSet: boolean;
  newRule: string;
  setNewRule: (v: string) => void;
  clientRules: string[];
  onAddRule: () => void;
  onRemoveRule: (idx: number) => void;
};

export default function KickoffTab({
  client, kickoff, materials, setMaterials, onMaterialsSave,
  transcriptText, setTranscriptText, transcriptQuality, setTranscriptQuality,
  saving, onSaveTranscript, uploadingAudio, onAudioUpload,
  briefingAnswers, proposal, briefSaved, campaignBriefSet,
  newRule, setNewRule, clientRules, onAddRule, onRemoveRule,
}: Props) {
  return (
    <div className="space-y-6">
      <KickoffQuestionsManager
        clientId={client.id}
        clientName={client.name}
        vertical={client.vertical}
        subNiche={client.sub_niche}
      />

      <ContextScorePanel
        transcript_text={kickoff?.transcript_text}
        transcript_quality={(kickoff as any)?.transcript_quality}
        voice_reference={kickoff?.voice_reference}
        client_rules={kickoff?.client_rules as string[] | null}
        preferred_tone={kickoff?.preferred_tone}
        materials={materials as any}
        briefing_answers={briefingAnswers}
        has_proposal={!!proposal}
        has_campaign_brief={briefSaved || campaignBriefSet}
        language="es"
      />

      <div className="bg-card rounded-lg border border-border p-6">
        <h3 className="font-semibold text-foreground mb-4">Kickoff Transcript</h3>
        <div className="mb-4">
          <label className="text-sm font-medium text-foreground block mb-1.5">Calidad de la transcripción</label>
          <Select value={transcriptQuality} onValueChange={setTranscriptQuality}>
            <SelectTrigger className="w-[280px]"><SelectValue /></SelectTrigger>
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
            <Textarea placeholder="Paste the call transcript here..." value={transcriptText} onChange={(e) => setTranscriptText(e.target.value)} className="min-h-[200px]" />
            {transcriptText.trim() && (
              <Button onClick={onSaveTranscript} disabled={saving} className="mt-3">
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Save Transcript
              </Button>
            )}
          </TabsContent>
          <TabsContent value="audio" className="mt-4">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-3">Upload .mp3, .mp4, .m4a, .wav, or .webm (max 100MB)</p>
              <Input type="file" accept=".mp3,.mp4,.m4a,.wav,.webm" onChange={onAudioUpload} disabled={uploadingAudio} className="max-w-xs mx-auto" />
              {uploadingAudio && (
                <div className="flex items-center justify-center gap-2 mt-3">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Uploading...</span>
                </div>
              )}
              {kickoff?.audio_file_url && (
                <div className="flex items-center justify-center gap-2 mt-3 text-sm text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-[hsl(142,71%,35%)]" />Audio file uploaded
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
        onSave={onMaterialsSave}
      />

      <ClientPlatformsPanel clientId={client.id} />

      <AssetCollectionRequest clientId={client.id} clientName={client.name} />

      <DiscoveryPanel clientId={client.id} />

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
                    <button onClick={() => onRemoveRule(i)} className="ml-1 hover:text-destructive"><X className="w-3 h-3" /></button>
                  </Badge>
                ))}
                {clientRules.length === 0 && <p className="text-xs text-muted-foreground">Sin reglas definidas</p>}
              </div>
              <div className="flex gap-2">
                <Input placeholder="Añadir regla..." value={newRule} onChange={(e) => setNewRule(e.target.value)} className="flex-1" onKeyDown={(e) => e.key === "Enter" && onAddRule()} />
                <Button size="sm" onClick={onAddRule} disabled={!newRule.trim()}><Plus className="w-4 h-4" /></Button>
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
}
