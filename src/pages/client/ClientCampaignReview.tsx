import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AssetPreview } from "@/components/client/AssetPreview";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  CheckCircle2, Send, Loader2, ArrowLeft, Target, Users,
  MessageSquare, Calendar, FileText, Mail, Image, PenTool,
  ChevronDown, ChevronUp, Clock, RotateCcw, CheckCheck,
} from "lucide-react";

type Asset = {
  id: string;
  asset_name: string;
  asset_type: string;
  status: string;
  file_url: string | null;
  content: any;
  version: number;
  client_comment: string | null;
  created_at: string;
};

type Campaign = {
  id: string;
  name: string;
  objective: string;
  target_audience: string;
  key_message: string;
  timeline: string;
  status: string;
};

const typeIcons: Record<string, any> = {
  landing_page: FileText,
  email_flow: Mail,
  social_post: Image,
  blog_article: PenTool,
};

function AssetStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "pending_review":
      return (
        <Badge className="bg-[hsl(var(--status-pending-review))]/15 text-[hsl(var(--status-pending-review))] border-[hsl(var(--status-pending-review))]/30 gap-1">
          <Clock className="w-3 h-3" /> Pending your review
        </Badge>
      );
    case "approved":
      return (
        <Badge className="bg-[hsl(var(--status-approved))]/15 text-[hsl(var(--status-approved))] border-[hsl(var(--status-approved))]/30 gap-1">
          <CheckCircle2 className="w-3 h-3" /> Approved
        </Badge>
      );
    case "change_requested":
      return (
        <Badge className="bg-[hsl(var(--status-change-requested))]/15 text-[hsl(var(--status-change-requested))] border-[hsl(var(--status-change-requested))]/30 gap-1">
          <RotateCcw className="w-3 h-3" /> New version ready
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="gap-1">
          <CheckCheck className="w-3 h-3" /> Feedback submitted
        </Badge>
      );
  }
}

export default function ClientCampaignReview() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState<string | null>(null);
  const [expandedAsset, setExpandedAsset] = useState<string | null>(null);
  const [feedbackTexts, setFeedbackTexts] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    type: "approve" | "feedback";
    asset: Asset;
  } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: client } = await supabase
        .from("clients").select("id").eq("user_id", session.user.id).limit(1).maybeSingle();
      if (!client) { setLoading(false); return; }
      setClientId(client.id);

      const { data: campaignData } = await supabase.from("campaigns")
        .select("*").eq("id", id!).single();
      if (campaignData) setCampaign(campaignData as unknown as Campaign);

      const { data: assetsData } = await supabase.from("assets")
        .select("*").eq("client_id", client.id).eq("campaign_id", id!).order("created_at");
      const assetList = (assetsData as unknown as Asset[]) || [];
      setAssets(assetList);
      setLoading(false);
    };
    fetchData();
  }, [id]);

  const [showCelebration, setShowCelebration] = useState(false);

  const approveAsset = async (asset: Asset) => {
    setSubmitting(true);
    try {
      const { error } = await supabase.from("assets")
        .update({ status: "approved" as any }).eq("id", asset.id);
      if (error) throw error;
      setAssets((prev) => prev.map((a) => a.id === asset.id ? { ...a, status: "approved" } : a));
      setExpandedAsset(null);
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 3000);
      toast.success(`${asset.asset_name} approved!`);

      try {
        await supabase.from("events").insert({
          event_type: "asset.approved",
          entity_type: "asset",
          entity_id: asset.id,
          payload: { client_id: clientId, asset_title: asset.asset_name },
        } as any);
      } catch (_) {}

      supabase.functions.invoke("send-notification", {
        body: { type: "client_feedback", client_id: clientId, asset_type: asset.asset_type, asset_name: asset.asset_name, comment: "Asset approved" },
      }).catch(console.error);
    } catch (e: any) {
      toast.error(e.message || "Failed to approve");
    } finally {
      setSubmitting(false);
      setConfirmDialog(null);
    }
  };

  const submitFeedback = async (asset: Asset) => {
    const text = feedbackTexts[asset.id]?.trim() || "";
    if (text.length < 20) {
      toast.error("Please write at least 20 characters of feedback.");
      return;
    }

    setSubmitting(true);
    try {
      const { error: updateError } = await supabase.from("assets").update({
        status: "change_requested" as any,
        client_comment: text,
      }).eq("id", asset.id);
      if (updateError) throw updateError;

      // Save to asset_section_comments for admin visibility
      await supabase.from("asset_section_comments").insert({
        asset_id: asset.id,
        client_id: clientId!,
        section_name: "general",
        comment_text: text,
        version_number: asset.version || 1,
      });

      const { data: existingRounds } = await supabase.from("revision_rounds")
        .select("round_number").eq("asset_id", asset.id)
        .order("round_number", { ascending: false }).limit(1);
      const nextRound = (existingRounds?.[0]?.round_number || 0) + 1;

      await supabase.from("revision_rounds").insert({
        asset_id: asset.id,
        round_number: nextRound,
        requested_by: "client" as any,
        comment: text,
      });

      setAssets((prev) => prev.map((a) =>
        a.id === asset.id ? { ...a, status: "change_requested", client_comment: text } : a
      ));
      setExpandedAsset(null);

      supabase.functions.invoke("generate-correction-prompt", { body: { asset_id: asset.id } }).catch(console.error);
      supabase.functions.invoke("send-notification", {
        body: { type: "client_feedback", client_id: clientId, asset_type: asset.asset_type, asset_name: asset.asset_name, comment: text },
      }).catch(console.error);

      toast.success("Feedback submitted!");
    } catch (e: any) {
      toast.error(e.message || "Failed to submit");
    } finally {
      setSubmitting(false);
      setConfirmDialog(null);
    }
  };

  const handleConfirm = () => {
    if (!confirmDialog) return;
    if (confirmDialog.type === "approve") approveAsset(confirmDialog.asset);
    else submitFeedback(confirmDialog.asset);
  };

  if (loading) return <div className="text-muted-foreground p-8">Loading...</div>;
  if (!campaign) return <div className="text-muted-foreground p-8">Campaign not found.</div>;

  const reviewedCount = assets.filter((a) => a.status === "approved").length;
  const allDone = assets.length > 0 && reviewedCount === assets.length;
  const progressPct = assets.length > 0 ? (reviewedCount / assets.length) * 100 : 0;

  return (
    <div className="pb-24 md:pb-8">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link to="/client/dashboard"><ArrowLeft className="w-4 h-4 mr-1" /> Back to dashboard</Link>
      </Button>

      {/* Campaign header */}
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-xl font-bold text-foreground">{campaign.name}</h1>
        <Badge variant="outline" className="text-xs">{campaign.status}</Badge>
      </div>

      {/* Progress summary — sticky on desktop */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border -mx-4 px-4 py-3 mb-4 md:-mx-6 md:px-6">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-medium text-foreground">
            {reviewedCount} of {assets.length} assets reviewed
          </span>
          <span className="text-xs text-muted-foreground">{Math.round(progressPct)}%</span>
        </div>
        <Progress value={progressPct} className="h-2" />
        {allDone && (
          <div className="mt-3 rounded-lg p-3 bg-[hsl(var(--status-approved))]/10 border border-[hsl(var(--status-approved))]/30">
            <p className="text-sm font-medium text-[hsl(var(--status-approved))] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> All done! PRAGMA has been notified.
            </p>
          </div>
        )}
      </div>

      {/* Campaign brief */}
      <p className="text-sm text-muted-foreground mb-3">Here is the strategy behind this campaign.</p>
      <div className="bg-card rounded-lg border border-border p-5 mb-6 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        </div>
      </div>

      {/* Assets */}
      <h2 className="text-lg font-semibold text-foreground mb-4">Campaign Assets</h2>
      {assets.length === 0 ? (
        <div className="bg-card rounded-lg border border-border p-8 text-center text-muted-foreground">
          No assets in this campaign yet. We'll notify you when they're ready.
        </div>
      ) : (
        <div className="space-y-3">
          {assets.map((asset) => {
            const Icon = typeIcons[asset.asset_type] || FileText;
            const isExpanded = expandedAsset === asset.id;
            const feedbackText = feedbackTexts[asset.id] || "";
            const canSubmitFeedback = feedbackText.trim().length >= 20;
            const isApproved = asset.status === "approved";
            const canReview = asset.status === "pending_review" || asset.status === "change_requested";

            return (
              <div key={asset.id} className="bg-card rounded-lg border border-border overflow-hidden">
                {/* Collapsed header */}
                <button
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-secondary/30 transition-colors"
                  onClick={() => setExpandedAsset(isExpanded ? null : asset.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-secondary">
                      <Icon className="w-4 h-4 text-foreground" />
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground text-sm">{asset.asset_name}</h3>
                      <span className="text-xs font-mono text-muted-foreground">v{asset.version || 1}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <AssetStatusBadge status={asset.status} />
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-border">
                    {/* Asset preview */}
                    <div className="p-4">
                      <AssetPreview
                        assetType={asset.asset_type}
                        assetName={asset.asset_name}
                        fileUrl={asset.file_url}
                        content={asset.content}
                      />
                    </div>

                    {/* Feedback area — show for pending_review and change_requested */}
                    {canReview && (
                      <div className="p-4 border-t border-border space-y-4">
                        {/* Previous feedback */}
                        {asset.client_comment && (
                          <div className="bg-muted/50 rounded-md p-3">
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              Your previous feedback (v{Math.max(1, (asset.version || 1) - 1)}):
                            </p>
                            <p className="text-sm text-muted-foreground italic">{asset.client_comment}</p>
                          </div>
                        )}

                        <div>
                          <label className="text-sm font-medium text-foreground mb-1.5 block">Your feedback:</label>
                          <Textarea
                            placeholder="What would you like to change? (optional for approval, min 20 chars for feedback)"
                            value={feedbackText}
                            onChange={(e) => setFeedbackTexts((prev) => ({ ...prev, [asset.id]: e.target.value }))}
                            className="min-h-[80px] text-sm"
                          />
                          {feedbackText.trim().length > 0 && feedbackText.trim().length < 20 && (
                            <p className="text-xs text-destructive mt-1">
                              {20 - feedbackText.trim().length} more characters needed
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <Button
                            size="sm"
                            onClick={() => setConfirmDialog({ type: "approve", asset })}
                            disabled={submitting}
                            className="bg-[hsl(var(--status-approved))] hover:bg-[hsl(var(--status-approved))]/90 text-primary-foreground"
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setConfirmDialog({ type: "feedback", asset })}
                            disabled={submitting || !canSubmitFeedback}
                          >
                            <Send className="w-4 h-4 mr-1" /> Submit feedback
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Approved — show read-only feedback if any */}
                    {isApproved && asset.client_comment && (
                      <div className="p-4 border-t border-border">
                        <div className="bg-muted/50 rounded-md p-3">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Your feedback:</p>
                          <p className="text-sm text-muted-foreground italic">{asset.client_comment}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Mobile sticky bottom progress */}
      <div className="fixed bottom-0 left-0 right-0 md:hidden bg-card border-t border-border p-3 z-20">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-foreground">{reviewedCount}/{assets.length} reviewed</span>
          {allDone && <span className="text-xs text-[hsl(var(--status-approved))] font-medium">✅ All done!</span>}
        </div>
        <Progress value={progressPct} className="h-1.5" />
      </div>

      {/* Confirmation dialog */}
      <AlertDialog open={!!confirmDialog} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog?.type === "approve"
                ? `Confirm approval of ${confirmDialog?.asset.asset_name}?`
                : `Submit feedback for ${confirmDialog?.asset.asset_name}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog?.type === "approve"
                ? "This asset will be marked as approved and PRAGMA will proceed with activation."
                : "PRAGMA will be notified and will upload a revised version."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              {confirmDialog?.type === "approve" ? "Approve" : "Submit"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
