import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CommentableSection } from "@/components/client/CommentableSection";
import { toast } from "sonner";
import { CheckCircle2, ExternalLink, Send, Loader2 } from "lucide-react";

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

const LANDING_PAGE_SECTIONS = ["Hero", "Benefits", "Social proof", "Offer/pricing", "Footer CTA"];
const EMAIL_SECTIONS = ["Subject line", "Preview text", "Body content", "CTA button"];

export default function ClientAssetReview() {
  const { type } = useParams<{ type: string }>();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState<string | null>(null);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // { [assetId]: { [sectionName]: commentText } }
  const [sectionComments, setSectionComments] = useState<Record<string, Record<string, string>>>({});
  // { [assetId]: generalComment }
  const [generalComments, setGeneralComments] = useState<Record<string, string>>({});

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

      // Pre-fill general comments from existing client_comment
      const genMap: Record<string, string> = {};
      for (const a of assetList) {
        if (a.client_comment) genMap[a.id] = a.client_comment;
      }
      setGeneralComments(genMap);

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
    setSectionComments((prev) => {
      const assetComments = { ...(prev[assetId] || {}) };
      if (text.trim()) {
        assetComments[section] = text;
      } else {
        delete assetComments[section];
      }
      return { ...prev, [assetId]: assetComments };
    });
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

  const approveAll = async () => {
    const pending = assets.filter((a) => a.status !== "approved");
    for (const asset of pending) {
      await supabase.from("assets").update({ status: "approved" as any }).eq("id", asset.id);
    }
    setAssets((prev) => prev.map((a) => ({ ...a, status: "approved" })));
    toast.success("All items approved!");
  };

  const submitAllFeedback = async () => {
    const allSectionComments: { asset_id: string; section_name: string; comment_text: string; version_number: number }[] = [];
    const affectedAssetIds = new Set<string>();

    for (const asset of assets) {
      const sections = sectionComments[asset.id];
      if (sections) {
        for (const [section, text] of Object.entries(sections)) {
          if (text.trim()) {
            allSectionComments.push({
              asset_id: asset.id,
              section_name: section,
              comment_text: text.trim(),
              version_number: asset.version || 1,
            });
            affectedAssetIds.add(asset.id);
          }
        }
      }
      const gen = generalComments[asset.id]?.trim();
      if (gen) affectedAssetIds.add(asset.id);
    }

    if (affectedAssetIds.size === 0) {
      toast.error("Add at least one comment before submitting.");
      return;
    }

    setSubmittingFeedback(true);
    try {
      // Save section comments: delete old, insert new
      const assetIds = [...affectedAssetIds];
      for (const id of assetIds) {
        await (supabase.from("asset_section_comments" as any) as any).delete().eq("asset_id", id).eq("client_id", clientId!);
      }

      if (allSectionComments.length > 0) {
        const rows = allSectionComments.map((c) => ({ ...c, client_id: clientId! }));
        const { error } = await (supabase.from("asset_section_comments" as any) as any).insert(rows);
        if (error) throw error;
      }

      // Update each affected asset
      for (const id of assetIds) {
        const gen = generalComments[id]?.trim() || null;
        await supabase.from("assets").update({
          status: "change_requested" as any,
          client_comment: gen,
        }).eq("id", id);
      }

      // Create revision rounds
      for (const id of assetIds) {
        const { data: existingRounds } = await supabase
          .from("revision_rounds")
          .select("round_number")
          .eq("asset_id", id)
          .order("round_number", { ascending: false })
          .limit(1);
        const nextRound = (existingRounds?.[0]?.round_number || 0) + 1;

        const sectionTexts = Object.entries(sectionComments[id] || {})
          .filter(([_, t]) => t.trim())
          .map(([s, t]) => `[${s}] ${t.trim()}`)
          .join("\n");
        const gen = generalComments[id]?.trim();
        const fullComment = [sectionTexts, gen ? `[General] ${gen}` : ""].filter(Boolean).join("\n");

        await supabase.from("revision_rounds").insert({
          asset_id: id,
          round_number: nextRound,
          requested_by: "client" as any,
          comment: fullComment || "Feedback submitted",
        });
      }

      setAssets((prev) =>
        prev.map((a) => assetIds.includes(a.id) ? { ...a, status: "change_requested", client_comment: generalComments[a.id]?.trim() || a.client_comment } : a)
      );

      // Notify pragma
      if (clientId) {
        supabase.functions.invoke("send-notification", {
          body: {
            type: "client_feedback",
            client_id: clientId,
            asset_type: type,
            asset_name: assets.filter((a) => assetIds.includes(a.id)).map((a) => a.asset_name).join(", "),
            comment: `${allSectionComments.length} section comment(s) submitted`,
          },
        }).catch((e) => console.error("Notification error:", e));
      }

      toast.success(`Feedback submitted! PRAGMA has been notified.`);
    } catch (e: any) {
      toast.error(e.message || "Failed to submit feedback");
    } finally {
      setSubmittingFeedback(false);
    }
  };

  if (loading) return <div className="text-muted-foreground p-8">Loading...</div>;

  const label = typeLabels[type || ""] || type;
  const hasPending = assets.some((a) => a.status !== "approved");

  const totalCommentCount = Object.values(sectionComments).reduce(
    (sum, sections) => sum + Object.values(sections).filter((t) => t.trim()).length, 0
  ) + Object.values(generalComments).filter((t) => t.trim()).length;

  // Blog paragraph splitter
  const splitParagraphs = (text: string) =>
    text.split(/\n\n+/).filter((p) => p.trim());

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

      <p className="text-sm text-muted-foreground mb-6">
        Hover over any section and click 💬 to leave feedback. You can approve without commenting.
      </p>

      <div className="space-y-6">
        {assets.map((asset, idx) => (
          <div key={asset.id} className="bg-card rounded-lg border border-border overflow-hidden">
            {/* Header */}
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

            {/* Content with commentable sections */}
            <div className="p-4 space-y-1">
              {/* ── Landing Page ── */}
              {type === "landing_page" && (
                <div className="space-y-1">
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
                      <a href={asset.content.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1 text-sm">
                        <ExternalLink className="w-4 h-4" /> {asset.content.url}
                      </a>
                    </div>
                  )}

                  {LANDING_PAGE_SECTIONS.map((section) => (
                    <CommentableSection
                      key={section}
                      name={section}
                      comment={sectionComments[asset.id]?.[section] || ""}
                      onComment={(t) => updateSectionComment(asset.id, section, t)}
                    >
                      <p className="text-sm text-muted-foreground italic">
                        Review the {section.toLowerCase()} section above
                      </p>
                    </CommentableSection>
                  ))}
                </div>
              )}

              {/* ── Email Flow ── */}
              {type === "email_flow" && (
                <div className="space-y-1">
                  <CommentableSection
                    name="Subject line"
                    comment={sectionComments[asset.id]?.["Subject line"] || ""}
                    onComment={(t) => updateSectionComment(asset.id, "Subject line", t)}
                  >
                    <p className="font-semibold text-foreground">{asset.content?.subject || "—"}</p>
                  </CommentableSection>

                  <CommentableSection
                    name="Preview text"
                    comment={sectionComments[asset.id]?.["Preview text"] || ""}
                    onComment={(t) => updateSectionComment(asset.id, "Preview text", t)}
                  >
                    <p className="text-sm text-muted-foreground">{asset.content?.preview_text || "—"}</p>
                  </CommentableSection>

                  <CommentableSection
                    name="Body content"
                    comment={sectionComments[asset.id]?.["Body content"] || ""}
                    onComment={(t) => updateSectionComment(asset.id, "Body content", t)}
                  >
                    {asset.content?.body ? (
                      <div className="text-sm text-foreground whitespace-pre-wrap">{asset.content.body}</div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No body content</p>
                    )}
                  </CommentableSection>

                  <CommentableSection
                    name="CTA button"
                    comment={sectionComments[asset.id]?.["CTA button"] || ""}
                    onComment={(t) => updateSectionComment(asset.id, "CTA button", t)}
                  >
                    <p className="text-sm text-foreground">{asset.content?.cta || "—"}</p>
                  </CommentableSection>
                </div>
              )}

              {/* ── Social Post ── */}
              {type === "social_post" && (
                <div className="space-y-1">
                  {asset.file_url && (
                    <CommentableSection
                      name="Image"
                      comment={sectionComments[asset.id]?.["Image"] || ""}
                      onComment={(t) => updateSectionComment(asset.id, "Image", t)}
                    >
                      <img src={asset.file_url} alt={asset.asset_name} className="w-full max-w-md rounded-md border border-border" />
                    </CommentableSection>
                  )}
                  <CommentableSection
                    name="Caption"
                    comment={sectionComments[asset.id]?.["Caption"] || ""}
                    onComment={(t) => updateSectionComment(asset.id, "Caption", t)}
                  >
                    <p className="text-sm text-foreground">{asset.content?.caption || "—"}</p>
                  </CommentableSection>
                  <CommentableSection
                    name="Hashtags"
                    comment={sectionComments[asset.id]?.["Hashtags"] || ""}
                    onComment={(t) => updateSectionComment(asset.id, "Hashtags", t)}
                  >
                    <p className="text-sm text-muted-foreground">{asset.content?.hashtags || "—"}</p>
                  </CommentableSection>
                </div>
              )}

              {/* ── Blog Article ── */}
              {type === "blog_article" && (
                <div className="space-y-1">
                  {asset.content?.text ? (
                    <>
                      {/* Title = first line */}
                      {(() => {
                        const paragraphs = splitParagraphs(asset.content.text);
                        const title = paragraphs[0] || "";
                        const body = paragraphs.slice(1);
                        return (
                          <>
                            <CommentableSection
                              name="Title"
                              comment={sectionComments[asset.id]?.["Title"] || ""}
                              onComment={(t) => updateSectionComment(asset.id, "Title", t)}
                            >
                              <p className="font-semibold text-foreground text-lg">{title}</p>
                            </CommentableSection>
                            {body.map((para, i) => {
                              const sectionKey = `Paragraph ${i + 1}`;
                              return (
                                <CommentableSection
                                  key={i}
                                  name={sectionKey}
                                  comment={sectionComments[asset.id]?.[sectionKey] || ""}
                                  onComment={(t) => updateSectionComment(asset.id, sectionKey, t)}
                                >
                                  <p className="text-sm text-foreground whitespace-pre-wrap">{para}</p>
                                </CommentableSection>
                              );
                            })}
                          </>
                        );
                      })()}
                    </>
                  ) : asset.file_url ? (
                    <a href={asset.file_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1 text-sm">
                      <ExternalLink className="w-4 h-4" /> Download file
                    </a>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No content available</p>
                  )}
                </div>
              )}

              {/* Notes from pragma */}
              {asset.content?.notes && (
                <p className="text-sm text-muted-foreground mt-3 italic">Note from PRAGMA: {asset.content.notes}</p>
              )}
            </div>

            {/* General comment */}
            <div className="px-4 pb-4">
              <Textarea
                placeholder="General comments (optional)"
                value={generalComments[asset.id] || ""}
                onChange={(e) => setGeneralComments((prev) => ({ ...prev, [asset.id]: e.target.value }))}
                className="min-h-[60px] text-sm"
              />
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-border flex gap-3">
              {asset.status === "approved" ? (
                <div className="flex items-center gap-2 text-sm text-status-approved">
                  <CheckCircle2 className="w-4 h-4" />
                  Approved
                </div>
              ) : (
                <Button size="sm" onClick={() => approveAsset(asset)} className="bg-status-approved hover:bg-status-approved/90 text-primary-foreground">
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  Approve
                </Button>
              )}
            </div>

            {/* Existing comment display */}
            {asset.status === "change_requested" && asset.client_comment && (
              <div className="px-4 pb-4">
                <div className="bg-[hsl(45,100%,90%)]/50 border border-[hsl(45,100%,72%)] rounded-md p-3 text-sm">
                  <span className="font-medium text-foreground">Your previous feedback:</span>
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

      {/* Submit feedback */}
      {assets.length > 0 && assets.some((a) => a.status !== "approved") && (
        <div className="mt-6 bg-card rounded-lg border border-border p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">
              {totalCommentCount > 0
                ? `${totalCommentCount} comment${totalCommentCount > 1 ? "s" : ""} ready to send`
                : "No comments yet — you can still approve above"}
            </p>
            <p className="text-xs text-muted-foreground">Section comments and general feedback will be sent to PRAGMA.</p>
          </div>
          <Button
            onClick={submitAllFeedback}
            disabled={submittingFeedback || totalCommentCount === 0}
            className="gap-2"
          >
            {submittingFeedback ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Submit feedback
          </Button>
        </div>
      )}
    </div>
  );
}
