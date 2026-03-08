import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Loader2, Sparkles, Target, Users, MessageSquare, Calendar, Pencil, Eye } from "lucide-react";
import AssetUploadZone from "@/components/kickoff/AssetUploadZone";
import { AssetFeedbackPanel } from "@/components/admin/AssetFeedbackPanel";
import { CorrectionPromptPanel } from "@/components/admin/CorrectionPromptPanel";

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
};

interface CampaignManagerProps {
  clientId: string;
  campaigns: Campaign[];
  assets: AssetRow[];
  onCampaignCreated: (c: Campaign) => void;
  onCampaignUpdated: (c: Campaign) => void;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-[hsl(142,71%,35%)]/10 text-[hsl(142,71%,35%)] border-[hsl(142,71%,35%)]/30",
  completed: "bg-primary/10 text-primary border-primary/30",
};

export function CampaignManager({ clientId, campaigns, assets, onCampaignCreated, onCampaignUpdated }: CampaignManagerProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [status, setStatus] = useState<string>("draft");
  const [objective, setObjective] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [keyMessage, setKeyMessage] = useState("");
  const [timeline, setTimeline] = useState("");

  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId);
  const uncategorizedAssets = assets.filter((a) => !a.campaign_id);

  const getCampaignAssets = (campaignId: string) => assets.filter((a) => a.campaign_id === campaignId);

  const resetForm = () => {
    setName(""); setStatus("draft"); setObjective(""); setTargetAudience(""); setKeyMessage(""); setTimeline("");
  };

  const generateBrief = async () => {
    if (!name.trim()) { toast.error("Enter a campaign name first"); return; }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-campaign-brief", {
        body: { client_id: clientId, campaign_name: name },
      });
      if (error) throw error;
      if (data?.objective) setObjective(data.objective);
      if (data?.target_audience) setTargetAudience(data.target_audience);
      if (data?.key_message) setKeyMessage(data.key_message);
      if (data?.timeline) setTimeline(data.timeline);
      toast.success("Campaign brief generated!");
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
          client_id: clientId,
          name: name.trim(),
          status,
          objective: objective.trim(),
          target_audience: targetAudience.trim(),
          key_message: keyMessage.trim(),
          timeline: timeline.trim(),
        })
        .select()
        .single();
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

  const updateCampaign = async () => {
    if (!selectedCampaign) return;
    try {
      const { data, error } = await (supabase.from("campaigns" as any) as any)
        .update({
          name: name.trim() || selectedCampaign.name,
          status,
          objective: objective.trim(),
          target_audience: targetAudience.trim(),
          key_message: keyMessage.trim(),
          timeline: timeline.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedCampaign.id)
        .select()
        .single();
      if (error) throw error;
      onCampaignUpdated(data as Campaign);
      setEditing(false);
      toast.success("Campaign updated!");
    } catch (e: any) {
      toast.error(e.message || "Failed to update");
    }
  };

  const startEdit = (c: Campaign) => {
    setName(c.name); setStatus(c.status); setObjective(c.objective);
    setTargetAudience(c.target_audience); setKeyMessage(c.key_message); setTimeline(c.timeline);
    setEditing(true);
  };

  // ── Campaign list view ──
  if (!selectedCampaignId) {
    return (
      <div className="space-y-4">
        {/* Campaign cards */}
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

        <div className="grid gap-3 sm:grid-cols-2">
          {campaigns.map((c) => {
            const cAssets = getCampaignAssets(c.id);
            const pendingCount = cAssets.filter((a) => a.status !== "approved").length;
            return (
              <div key={c.id} className="bg-card rounded-lg border border-border p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <h4 className="font-semibold text-foreground">{c.name}</h4>
                  <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[c.status] || ""}`}>
                    {c.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {cAssets.length} asset{cAssets.length !== 1 ? "s" : ""}
                  {pendingCount > 0 && ` | ${pendingCount} pending review`}
                </p>
                <Button size="sm" variant="outline" onClick={() => setSelectedCampaignId(c.id)}>
                  <Eye className="w-3.5 h-3.5 mr-1" /> View campaign
                </Button>
              </div>
            );
          })}

          {/* Uncategorized */}
          {uncategorizedAssets.length > 0 && (
            <div className="bg-card rounded-lg border border-dashed border-border p-4 space-y-3">
              <h4 className="font-semibold text-muted-foreground">Uncategorized</h4>
              <p className="text-xs text-muted-foreground">
                {uncategorizedAssets.length} asset{uncategorizedAssets.length !== 1 ? "s" : ""} not assigned to a campaign
              </p>
              <Button size="sm" variant="ghost" onClick={() => setSelectedCampaignId("uncategorized")}>
                <Eye className="w-3.5 h-3.5 mr-1" /> View assets
              </Button>
            </div>
          )}
        </div>

        {/* Create dialog */}
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
                  <Button size="sm" variant="outline" onClick={generateBrief} disabled={generating || !name.trim()}>
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
              </div>

              <Button onClick={saveCampaign} disabled={creating || !name.trim()} className="w-full">
                {creating && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Save campaign
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── Campaign detail view ──
  const isUncategorized = selectedCampaignId === "uncategorized";
  const campaignAssets = isUncategorized ? uncategorizedAssets : getCampaignAssets(selectedCampaignId);
  const changeRequestedAssets = campaignAssets.filter((a) => a.status === "change_requested");

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => { setSelectedCampaignId(null); setEditing(false); }}>
        ← Back to campaigns
      </Button>

      {isUncategorized ? (
        <div className="bg-card rounded-lg border border-dashed border-border p-5">
          <h3 className="font-semibold text-foreground text-lg">Uncategorized Assets</h3>
          <p className="text-sm text-muted-foreground mt-1">These assets are not assigned to any campaign.</p>
        </div>
      ) : selectedCampaign && (
        <div className="bg-card rounded-lg border border-border p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-foreground text-lg">{selectedCampaign.name}</h3>
              <Badge variant="outline" className={`text-[10px] mt-1 ${STATUS_COLORS[selectedCampaign.status] || ""}`}>
                {selectedCampaign.status}
              </Badge>
            </div>
            {!editing && (
              <Button size="sm" variant="outline" onClick={() => startEdit(selectedCampaign)}>
                <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
              </Button>
            )}
          </div>

          {editing ? (
            <div className="space-y-3 border-t border-border pt-3">
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
                <Button size="sm" onClick={updateCampaign}>Save changes</Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 border-t border-border pt-3">
              {selectedCampaign.objective && (
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Target className="w-3 h-3" /> Objective</p>
                  <p className="text-sm text-foreground mt-0.5">{selectedCampaign.objective}</p>
                </div>
              )}
              {selectedCampaign.target_audience && (
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" /> Target audience</p>
                  <p className="text-sm text-foreground mt-0.5">{selectedCampaign.target_audience}</p>
                </div>
              )}
              {selectedCampaign.key_message && (
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><MessageSquare className="w-3 h-3" /> Key message</p>
                  <p className="text-sm text-foreground mt-0.5">{selectedCampaign.key_message}</p>
                </div>
              )}
              {selectedCampaign.timeline && (
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> Timeline</p>
                  <p className="text-sm text-foreground mt-0.5">{selectedCampaign.timeline}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Client feedback on campaign assets */}
      {campaignAssets.filter((a) => a.status === "change_requested" || a.client_comment).length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-foreground">Client Feedback</h3>
          {campaignAssets
            .filter((a) => a.status === "change_requested" || a.client_comment)
            .map((asset) => (
              <div key={asset.id} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{asset.asset_name}</span>
                  <span className="text-xs font-mono text-muted-foreground">v{asset.version || 1}</span>
                </div>
                <AssetFeedbackPanel assetId={asset.id} clientComment={asset.client_comment} status={asset.status} version={asset.version || 1} />
              </div>
            ))}
        </div>
      )}

      {/* Correction prompts */}
      {changeRequestedAssets.length > 0 && (
        <CorrectionPromptPanel
          clientId={clientId}
          assets={changeRequestedAssets}
          onUploadNewVersion={(_, assetType, summary) => {
            toast.info(`Upload a new version. Changes: ${summary}`);
          }}
        />
      )}

      {/* Upload zones */}
      <div>
        <h3 className="font-semibold text-foreground mb-3">Upload & Manage Assets</h3>
        <div className="grid gap-4 lg:grid-cols-2">
          <AssetUploadZone clientId={clientId} assetType="landing_page" campaignId={isUncategorized ? undefined : selectedCampaignId} onAssetSaved={() => {}} />
          <AssetUploadZone clientId={clientId} assetType="email_flow" campaignId={isUncategorized ? undefined : selectedCampaignId} onAssetSaved={() => {}} />
          <AssetUploadZone clientId={clientId} assetType="social_post" campaignId={isUncategorized ? undefined : selectedCampaignId} onAssetSaved={() => {}} />
          <AssetUploadZone clientId={clientId} assetType="blog_article" campaignId={isUncategorized ? undefined : selectedCampaignId} onAssetSaved={() => {}} />
        </div>
      </div>
    </div>
  );
}
