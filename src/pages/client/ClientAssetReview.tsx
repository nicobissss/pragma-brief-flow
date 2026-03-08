import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CheckCircle2, MessageSquare, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

const typeLabels: Record<string, string> = {
  landing_page: "Landing Page",
  email_flow: "Email Flow",
  social_post: "Social Posts",
  blog_article: "Blog Articles",
};

export default function ClientAssetReview() {
  const { type } = useParams<{ type: string }>();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [changeDialogAsset, setChangeDialogAsset] = useState<Asset | null>(null);
  const [changeComment, setChangeComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [generalComment, setGeneralComment] = useState("");

  useEffect(() => {
    const fetchAssets = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: client } = await supabase
        .from("clients")
        .select("id")
        .eq("user_id", session.user.id)
        .single();

      if (!client) { setLoading(false); return; }

      const { data } = await supabase
        .from("assets")
        .select("*")
        .eq("client_id", client.id)
        .eq("asset_type", type!)
        .order("created_at");

      setAssets((data as Asset[]) || []);
      setLoading(false);
    };
    fetchAssets();
  }, [type]);

  const approveAsset = async (asset: Asset) => {
    const { error } = await supabase
      .from("assets")
      .update({ status: "approved" as any })
      .eq("id", asset.id);
    if (error) { toast.error(error.message); return; }
    setAssets((prev) => prev.map((a) => a.id === asset.id ? { ...a, status: "approved" } : a));
    toast.success(`${asset.asset_name} approved!`);
  };

  const requestChanges = async () => {
    if (!changeDialogAsset || !changeComment.trim()) {
      toast.error("Please describe what you'd like to change.");
      return;
    }
    setSubmitting(true);
    try {
      // Update asset status
      const { error: assetErr } = await supabase
        .from("assets")
        .update({ status: "change_requested" as any, client_comment: changeComment })
        .eq("id", changeDialogAsset.id);
      if (assetErr) throw assetErr;

      // Create revision round
      const { data: existingRounds } = await supabase
        .from("revision_rounds")
        .select("round_number")
        .eq("asset_id", changeDialogAsset.id)
        .order("round_number", { ascending: false })
        .limit(1);

      const nextRound = (existingRounds?.[0]?.round_number || 0) + 1;

      await supabase.from("revision_rounds").insert({
        asset_id: changeDialogAsset.id,
        round_number: nextRound,
        requested_by: "client" as any,
        comment: changeComment,
      });

      setAssets((prev) =>
        prev.map((a) => a.id === changeDialogAsset.id ? { ...a, status: "change_requested", client_comment: changeComment } : a)
      );
      toast.success("Change request submitted!");
      setChangeDialogAsset(null);
      setChangeComment("");
    } catch (e: any) {
      toast.error(e.message || "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  const approveAll = async () => {
    const pending = assets.filter((a) => a.status !== "approved");
    for (const asset of pending) {
      await supabase.from("assets").update({ status: "approved" as any }).eq("id", asset.id);
    }
    setAssets((prev) => prev.map((a) => ({ ...a, status: "approved" })));
    toast.success("All items approved!");
  };

  if (loading) return <div className="text-muted-foreground">Loading...</div>;

  const label = typeLabels[type || ""] || type;
  const hasPending = assets.some((a) => a.status !== "approved");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">{label}</h1>
        {hasPending && assets.length > 1 && (
          <Button onClick={approveAll} className="gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Approve All
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {assets.map((asset, idx) => (
          <div key={asset.id} className="bg-card rounded-lg border border-border overflow-hidden">
            {/* Asset header */}
            <div className="p-4 flex items-center justify-between border-b border-border">
              <div className="flex items-center gap-3">
                {assets.length > 1 && (
                  <span className="text-sm font-medium text-muted-foreground">#{idx + 1}</span>
                )}
                <h3 className="font-medium text-foreground">{asset.asset_name}</h3>
              </div>
              <StatusBadge status={asset.status} />
            </div>

            {/* Asset content */}
            <div className="p-4">
              {/* Landing page: iframe or image */}
              {type === "landing_page" && asset.file_url && (
                <div>
                  {asset.file_url.match(/\.(png|jpg|jpeg|webp|gif)$/i) ? (
                    <img src={asset.file_url} alt={asset.asset_name} className="w-full rounded-md border border-border" />
                  ) : asset.file_url.match(/\.pdf$/i) ? (
                    <iframe src={asset.file_url} className="w-full h-[600px] rounded-md border border-border" />
                  ) : (
                    <div className="flex items-center gap-2">
                      <a href={asset.file_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                        <ExternalLink className="w-4 h-4" />
                        View landing page
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Landing page URL from content */}
              {type === "landing_page" && asset.content?.url && (
                <iframe src={asset.content.url} className="w-full h-[600px] rounded-md border border-border" />
              )}

              {/* Email flow */}
              {type === "email_flow" && asset.content && (
                <div className="space-y-3">
                  {asset.content.subject && (
                    <p className="font-semibold text-foreground">{asset.content.subject}</p>
                  )}
                  {asset.content.body && (
                    <div className="text-sm text-foreground whitespace-pre-wrap bg-secondary/30 rounded-md p-4">
                      {asset.content.body}
                    </div>
                  )}
                </div>
              )}

              {/* Social post */}
              {type === "social_post" && (
                <div>
                  {asset.file_url && (
                    <img src={asset.file_url} alt={asset.asset_name} className="w-full max-w-md rounded-md border border-border mb-3" />
                  )}
                  {asset.content?.caption && (
                    <p className="text-sm text-foreground">{asset.content.caption}</p>
                  )}
                </div>
              )}

              {/* Blog article */}
              {type === "blog_article" && (
                <div>
                  {asset.content?.text && (
                    <div className="text-sm text-foreground whitespace-pre-wrap max-h-[400px] overflow-y-auto bg-secondary/30 rounded-md p-4">
                      {asset.content.text}
                    </div>
                  )}
                  {asset.file_url && (
                    <a href={asset.file_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1 mt-2 text-sm">
                      <ExternalLink className="w-4 h-4" />
                      Download file
                    </a>
                  )}
                </div>
              )}

              {/* Notes from pragma */}
              {asset.content?.notes && (
                <p className="text-sm text-muted-foreground mt-3 italic">Note: {asset.content.notes}</p>
              )}
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-border flex gap-3">
              {asset.status === "approved" ? (
                <div className="flex items-center gap-2 text-sm text-status-approved">
                  <CheckCircle2 className="w-4 h-4" />
                  Approved
                </div>
              ) : (
                <>
                  <Button size="sm" onClick={() => approveAsset(asset)} className="bg-status-approved hover:bg-status-approved/90 text-primary-foreground">
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-status-change-requested text-status-change-requested hover:bg-status-change-requested/10"
                    onClick={() => setChangeDialogAsset(asset)}
                  >
                    <MessageSquare className="w-4 h-4 mr-1" />
                    Request Changes
                  </Button>
                </>
              )}
            </div>

            {/* Show existing comment */}
            {asset.client_comment && (
              <div className="px-4 pb-4">
                <div className="bg-status-change-requested/10 rounded-md p-3 text-sm">
                  <span className="font-medium text-foreground">Your comment:</span>
                  <p className="text-muted-foreground mt-1">{asset.client_comment}</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {assets.length === 0 && (
        <div className="bg-card rounded-lg border border-border p-8 text-center">
          <p className="text-muted-foreground">No {label?.toLowerCase()} assets to review yet.</p>
        </div>
      )}

      {/* General comment */}
      {assets.length > 0 && (
        <div className="mt-6 bg-card rounded-lg border border-border p-4">
          <h3 className="text-sm font-medium text-foreground mb-2">General comment</h3>
          <Textarea
            placeholder="Add a general comment about these assets..."
            value={generalComment}
            onChange={(e) => setGeneralComment(e.target.value)}
            className="min-h-[80px]"
          />
        </div>
      )}

      {/* Request Changes Dialog */}
      <Dialog open={!!changeDialogAsset} onOpenChange={(open) => { if (!open) { setChangeDialogAsset(null); setChangeComment(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Changes</DialogTitle>
            <DialogDescription>
              Describe what you'd like to change for <strong>{changeDialogAsset?.asset_name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Describe what you'd like to change..."
            value={changeComment}
            onChange={(e) => setChangeComment(e.target.value)}
            className="min-h-[120px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setChangeDialogAsset(null); setChangeComment(""); }}>
              Cancel
            </Button>
            <Button onClick={requestChanges} disabled={submitting || !changeComment.trim()}>
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
