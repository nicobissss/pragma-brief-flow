import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  X, Eye, ExternalLink, Wrench, Bell, AlertTriangle,
} from "lucide-react";
import { AssetFeedbackPanel } from "@/components/admin/AssetFeedbackPanel";
import { CorrectionPromptPanel } from "@/components/admin/CorrectionPromptPanel";

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
};

interface CampaignManagerProps {
  clientId: string;
  campaigns: Campaign[];
  assets: AssetRow[];
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

// ─── Campaign Card (Asset inside) ───────────────────────
function AssetCard({
  asset,
  campaigns,
  clientId,
  onAssignCampaign,
}: {
  asset: AssetRow;
  campaigns: Campaign[];
  clientId: string;
  onAssignCampaign?: (assetId: string, campaignId: string) => void;
}) {
  const Icon = ASSET_TYPE_ICONS[asset.asset_type] || FileText;
  const isImage = asset.file_url?.match(/\.(png|jpg|jpeg|webp|gif)$/i);
  const statusBadgeClass =
    asset.status === "approved"
      ? "bg-[hsl(var(--status-approved))]/15 text-[hsl(var(--status-approved))] border-[hsl(var(--status-approved))]/30"
      : asset.status === "change_requested"
        ? "bg-[hsl(var(--status-change-requested))]/15 text-[hsl(var(--status-change-requested))] border-[hsl(var(--status-change-requested))]/30"
        : asset.status === "pending_review"
          ? "bg-[hsl(var(--status-pending-review))]/15 text-[hsl(var(--status-pending-review))] border-[hsl(var(--status-pending-review))]/30"
          : "bg-muted text-muted-foreground";

  return (
    <div className="rounded-lg border border-border bg-secondary/10 overflow-hidden">
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
            <span className="text-sm font-medium text-foreground truncate">{asset.asset_name}</span>
            <Badge variant="outline" className="text-[10px] shrink-0">v{asset.version || 1}</Badge>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="outline" className={`text-[10px] ${statusBadgeClass}`}>
              {assetStatusIcon(asset.status)} {assetStatusLabel(asset.status)}
            </Badge>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Uploaded {formatDistanceToNow(new Date(asset.created_at), { addSuffix: true })}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {asset.file_url && (
            <a href={asset.file_url} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <Eye className="w-3.5 h-3.5" />
              </Button>
            </a>
          )}
          {asset.content?.url && (
            <a href={asset.content.url} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            </a>
          )}
        </div>
      </div>

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
          const { error: uploadErr } = await supabase.storage.from("client-assets").upload(filePath, file);
          if (uploadErr) throw uploadErr;
          const { data: urlData } = supabase.storage.from("client-assets").getPublicUrl(filePath);

          const name = files.length === 1 ? deriveName() : file.name.replace(/\.[^/.]+$/, "");
          const { error } = await supabase.from("assets").insert({
            client_id: clientId,
            asset_type: assetType,
            asset_name: name,
            file_url: urlData.publicUrl,
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
        const { error: uploadErr } = await supabase.storage.from("client-assets").upload(filePath, file);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from("client-assets").getPublicUrl(filePath);
        fileUrl = urlData.publicUrl;
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
            <Button onClick={() => uploadNewVersion(false)} disabled={uploading || !hasContent} variant="outline" className="w-full">
              {uploading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              <Upload className="w-4 h-4 mr-2" /> Upload new version
            </Button>
            <Button onClick={() => uploadNewVersion(true)} disabled={uploading || !hasContent} className="w-full">
              {uploading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              <Bell className="w-4 h-4 mr-2" /> Upload and notify client
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Main CampaignManager Component ─────────────────────
export function CampaignManager({ clientId, campaigns, assets, onCampaignCreated, onCampaignUpdated, onAssetsChanged }: CampaignManagerProps) {
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [addAssetDrawer, setAddAssetDrawer] = useState<{ campaignId: string; campaignName: string } | null>(null);
  const [newVersionDrawer, setNewVersionDrawer] = useState<{ asset: AssetRow; campaignId: string; summary: string } | null>(null);

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
                  {/* Campaign brief */}
                  <div className="p-4 border-b border-border">
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
                  </div>

                  {/* Assets */}
                  <div className="p-4 border-b border-border">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                      Assets ({cAssets.length})
                    </p>
                    {cAssets.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">No assets yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {cAssets.map((asset) => (
                          <AssetCard key={asset.id} asset={asset} campaigns={campaigns} clientId={clientId} />
                        ))}
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3"
                      onClick={() => setAddAssetDrawer({ campaignId: campaign.id, campaignName: campaign.name })}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add asset to this campaign
                    </Button>
                  </div>

                  {/* Client feedback & correction prompts */}
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

                  {/* Notify client */}
                  <div className="p-4 flex items-center gap-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          const { data, error } = await supabase.functions.invoke("send-notification", {
                            body: { type: "campaign_ready", client_id: clientId, campaign_name: campaign.name },
                          });
                          if (error) throw error;
                          if (data?.error) throw new Error(data.error);
                          toast.success("Client notified about this campaign!");
                        } catch (e: any) {
                          toast.error(`Failed to notify: ${e.message || "Unknown error"}`);
                        }
                      }}
                    >
                      <Bell className="w-3.5 h-3.5 mr-1" /> Notify client about this campaign
                    </Button>
                  </div>
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
    </div>
  );
}
