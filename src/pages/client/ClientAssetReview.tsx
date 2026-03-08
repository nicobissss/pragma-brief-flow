import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SectionCommentBox } from "@/components/client/SectionCommentBox";
import { toast } from "sonner";
import { CheckCircle2, MessageSquare, ExternalLink, Send, Loader2 } from "lucide-react";
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

const LANDING_PAGE_SECTIONS = [
  "Hero (headline + subheadline + CTA)",
  "Benefits section",
  "Social proof section",
  "Offer/pricing section",
  "Footer CTA",
];

const EMAIL_SECTIONS = ["Subject line", "Body content", "CTA button"];

export default function ClientAssetReview() {
  const { type } = useParams<{ type: string }>();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState<string | null>(null);
  const [changeDialogAsset, setChangeDialogAsset] = useState<Asset | null>(null);
  const [changeComment, setChangeComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // Section comments: { [assetId]: { [sectionName]: commentText } }
  const [sectionComments, setSectionComments] = useState<Record<string, Record<string, string>>>({});

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
      setClientId(client.id);

      const { data } = await supabase
        .from("assets")
        .select("*")
        .eq("client_id", client.id)
        .eq("asset_type", type! as any)
        .order("created_at");

      const assetList = (data as Asset[]) || [];
      setAssets(assetList);

      // Load existing section comments
      if (assetList.length > 0) {
        const assetIds = assetList.map((a) => a.id);
        const { data: comments } = await supabase
          .from("asset_section_comments" as any)
          .select("*")
          .in("asset_id", assetIds)
          .eq("client_id", client.id);

        if (comments && Array.isArray(comments)) {
          const map: Record<string, Record<string, string>> = {};
          for (const c of comments as any[]) {
            if (!map[c.asset_id]) map[c.asset_id] = {};
            map[c.asset_id][c.section_name] = c.comment_text;
          }
          setSectionComments(map);
        }
      }

      setLoading(false);
    };
    fetchAssets();
  }, [type]);

  const updateSectionComment = useCallback((assetId: string, section: string, text: string) => {
    setSectionComments((prev) => ({
      ...prev,
      [assetId]: { ...(prev[assetId] || {}), [section]: text },
    }));
  }, []);

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
      const { error: assetErr } = await supabase
        .from("assets")
        .update({ status: "change_requested" as any, client_comment: changeComment })
        .eq("id", changeDialogAsset.id);
      if (assetErr) throw assetErr;

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

      if (clientId) {
        supabase.functions.invoke("send-notification", {
          body: {
            type: "client_feedback",
            client_id: clientId,
            asset_type: type,
            asset_name: changeDialogAsset.asset_name,
            comment: changeComment,
          },
        }).catch((e) => console.error("Notification error:", e));
      }

      setAssets((prev) =>
        prev.map((a) => a.id === changeDialogAsset.id ? { ...a, status: "change_requested", client_comment: changeComment } : a)
      );
      toast.success("Change request submitted! PRAGMA has been notified.");
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

  const submitAllFeedback = async () => {
    // Collect all non-empty section comments
    const allComments: { asset_id: string; section_name: string; comment_text: string; version_number: number }[] = [];
    for (const asset of assets) {
      const sections = sectionComments[asset.id];
      if (!sections) continue;
      for (const [section, text] of Object.entries(sections)) {
        if (text.trim()) {
          allComments.push({
            asset_id: asset.id,
            section_name: section,
            comment_text: text.trim(),
            version_number: asset.version || 1,
          });
        }
      }
    }

    if (allComments.length === 0) {
      toast.error("No comments to submit. Add section comments first.");
      return;
    }

    setSubmittingFeedback(true);
    try {
      // Delete existing comments for these assets, then insert new ones
      const assetIds = [...new Set(allComments.map((c) => c.asset_id))];
      for (const id of assetIds) {
        await (supabase.from("asset_section_comments" as any) as any).delete().eq("asset_id", id).eq("client_id", clientId!);
      }

      const rows = allComments.map((c) => ({ ...c, client_id: clientId! }));
      const { error } = await (supabase.from("asset_section_comments" as any) as any).insert(rows);
      if (error) throw error;

      // Set all commented assets to change_requested
      for (const id of assetIds) {
        await supabase.from("assets").update({ status: "change_requested" as any }).eq("id", id);
      }
      setAssets((prev) =>
        prev.map((a) => assetIds.includes(a.id) ? { ...a, status: "change_requested" } : a)
      );

      // Notify pragma
      if (clientId) {
        supabase.functions.invoke("send-notification", {
          body: {
            type: "client_feedback",
            client_id: clientId,
            asset_type: type,
            asset_name: assets.filter((a) => assetIds.includes(a.id)).map((a) => a.asset_name).join(", "),
            comment: `Section feedback submitted on ${allComments.length} section(s)`,
          },
        }).catch((e) => console.error("Notification error:", e));
      }

      toast.success(`Feedback submitted on ${allComments.length} section(s)! PRAGMA has been notified.`);
    } catch (e: any) {
      toast.error(e.message || "Failed to submit feedback");
    } finally {
      setSubmittingFeedback(false);
    }
  };

  if (loading) return <div className="text-muted-foreground">Loading...</div>;

  const label = typeLabels[type || ""] || type;
  const hasPending = assets.some((a) => a.status !== "approved");
  const hasAnyComments = Object.values(sectionComments).some((sections) =>
    Object.values(sections).some((t) => t.trim())
  );

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
                <span className="text-xs font-mono text-muted-foreground">v{asset.version || 1}</span>
              </div>
              <StatusBadge status={asset.status} />
            </div>

            {/* Asset content with section comments */}
            <div className="p-4 space-y-1">
              {/* ── Landing Page ── */}
              {type === "landing_page" && (
                <>
                  {/* Preview */}
                  {asset.file_url && (
                    <div className="mb-4">
                      {asset.file_url.match(/\.(png|jpg|jpeg|webp|gif)$/i) ? (
                        <img src={asset.file_url} alt={asset.asset_name} className="w-full rounded-md border border-border" />
                      ) : asset.file_url.match(/\.pdf$/i) ? (
                        <iframe src={asset.file_url} className="w-full h-[600px] rounded-md border border-border" />
                      ) : (
                        <a href={asset.file_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                          <ExternalLink className="w-4 h-4" /> View landing page
                        </a>
                      )}
                    </div>
                  )}
                  {asset.content?.url && (
                    <div className="mb-4">
                      <iframe src={asset.content.url} className="w-full h-[600px] rounded-md border border-border" />
                    </div>
                  )}

                  {/* Section comments for landing page */}
                  <div className="space-y-3 border-t border-border pt-4">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Section feedback</p>
                    {LANDING_PAGE_SECTIONS.map((section) => (
                      <div key={section} className="rounded-md bg-secondary/20 p-3">
                        <p className="text-sm font-medium text-foreground">{section}</p>
                        <SectionCommentBox
                          sectionName={section}
                          value={sectionComments[asset.id]?.[section] || ""}
                          onChange={(v) => updateSectionComment(asset.id, section, v)}
                        />
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* ── Email Flow ── */}
              {type === "email_flow" && (
                <div className="space-y-4">
                  {asset.content?.subject && (
                    <div className="rounded-md bg-secondary/20 p-3">
                      <p className="text-xs text-muted-foreground mb-1">Subject line</p>
                      <p className="font-semibold text-foreground">{asset.content.subject}</p>
                      <SectionCommentBox
                        sectionName="Subject line"
                        value={sectionComments[asset.id]?.["Subject line"] || ""}
                        onChange={(v) => updateSectionComment(asset.id, "Subject line", v)}
                      />
                    </div>
                  )}
                  {asset.content?.body && (
                    <div className="rounded-md bg-secondary/20 p-3">
                      <p className="text-xs text-muted-foreground mb-1">Body content</p>
                      <div className="text-sm text-foreground whitespace-pre-wrap">{asset.content.body}</div>
                      <SectionCommentBox
                        sectionName="Body content"
                        value={sectionComments[asset.id]?.["Body content"] || ""}
                        onChange={(v) => updateSectionComment(asset.id, "Body content", v)}
                      />
                    </div>
                  )}
                  <div className="rounded-md bg-secondary/20 p-3">
                    <p className="text-xs text-muted-foreground mb-1">CTA button</p>
                    <p className="text-sm text-foreground">{asset.content?.cta || "—"}</p>
                    <SectionCommentBox
                      sectionName="CTA button"
                      value={sectionComments[asset.id]?.["CTA button"] || ""}
                      onChange={(v) => updateSectionComment(asset.id, "CTA button", v)}
                    />
                  </div>
                  {/* General email comment */}
                  <SectionCommentBox
                    sectionName="General"
                    value={sectionComments[asset.id]?.["General"] || ""}
                    onChange={(v) => updateSectionComment(asset.id, "General", v)}
                  />
                </div>
              )}

              {/* ── Social Post ── */}
              {type === "social_post" && (
                <div>
                  {asset.file_url && (
                    <img src={asset.file_url} alt={asset.asset_name} className="w-full max-w-md rounded-md border border-border mb-3" />
                  )}
                  {asset.content?.caption && (
                    <p className="text-sm text-foreground mb-2">{asset.content.caption}</p>
                  )}
                  <SectionCommentBox
                    sectionName="This post"
                    value={sectionComments[asset.id]?.["This post"] || ""}
                    onChange={(v) => updateSectionComment(asset.id, "This post", v)}
                  />
                </div>
              )}

              {/* ── Blog Article ── */}
              {type === "blog_article" && (
                <div>
                  {asset.content?.text && (
                    <div className="text-sm text-foreground whitespace-pre-wrap max-h-[400px] overflow-y-auto bg-secondary/30 rounded-md p-4 mb-3">
                      {asset.content.text}
                    </div>
                  )}
                  {asset.file_url && (
                    <a href={asset.file_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1 text-sm mb-3">
                      <ExternalLink className="w-4 h-4" /> Download file
                    </a>
                  )}
                  <SectionCommentBox
                    sectionName="This article"
                    value={sectionComments[asset.id]?.["This article"] || ""}
                    onChange={(v) => updateSectionComment(asset.id, "This article", v)}
                  />
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

      {/* Submit all feedback button */}
      {assets.length > 0 && hasAnyComments && (
        <div className="mt-6 bg-card rounded-lg border border-border p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Ready to send your feedback?</p>
            <p className="text-xs text-muted-foreground">All section comments will be sent to PRAGMA and assets marked for changes.</p>
          </div>
          <Button onClick={submitAllFeedback} disabled={submittingFeedback} className="gap-2">
            {submittingFeedback ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Submit feedback
          </Button>
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
