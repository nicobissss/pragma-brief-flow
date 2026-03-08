import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CommentableSection } from "@/components/client/CommentableSection";
import { toast } from "sonner";
import { CheckCircle2, ExternalLink, Send, Loader2, ArrowLeft, Target, Users, MessageSquare, Calendar } from "lucide-react";

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

const typeLabels: Record<string, string> = {
  landing_page: "Landing Page",
  email_flow: "Email Flow",
  social_post: "Social Posts",
  blog_article: "Blog Articles",
};

const LANDING_PAGE_SECTIONS = ["Hero", "Benefits", "Social proof", "Offer/pricing", "Footer CTA"];

export default function ClientCampaignReview() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState<string | null>(null);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const [sectionComments, setSectionComments] = useState<Record<string, Record<string, string>>>({});
  const [generalComments, setGeneralComments] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: client } = await supabase
        .from("clients").select("id").eq("user_id", session.user.id).single();
      if (!client) { setLoading(false); return; }
      setClientId(client.id);

      // Fetch campaign
      const { data: campaignData } = await (supabase.from("campaigns" as any) as any)
        .select("*").eq("id", id!).single();
      if (campaignData) setCampaign(campaignData as Campaign);

      // Fetch assets for this campaign
      const { data: assetsData } = await (supabase.from("assets") as any)
        .select("*").eq("client_id", client.id).eq("campaign_id", id!).order("created_at");
      const assetList = (assetsData as Asset[]) || [];
      setAssets(assetList);

      // Pre-fill general comments
      const genMap: Record<string, string> = {};
      for (const a of assetList) {
        if (a.client_comment) genMap[a.id] = a.client_comment;
      }
      setGeneralComments(genMap);

      // Load existing section comments
      if (assetList.length > 0) {
        const assetIds = assetList.map((a) => a.id);
        const { data: comments } = await (supabase.from("asset_section_comments" as any) as any)
          .select("*").in("asset_id", assetIds).eq("client_id", client.id);
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
    fetchData();
  }, [id]);

  const updateSectionComment = (assetId: string, section: string, text: string) => {
    setSectionComments((prev) => {
      const assetComments = { ...(prev[assetId] || {}) };
      if (text.trim()) assetComments[section] = text;
      else delete assetComments[section];
      return { ...prev, [assetId]: assetComments };
    });
  };

  const approveAsset = async (asset: Asset) => {
    const { error } = await supabase.from("assets").update({ status: "approved" as any }).eq("id", asset.id);
    if (error) { toast.error(error.message); return; }
    setAssets((prev) => prev.map((a) => a.id === asset.id ? { ...a, status: "approved" } : a));
    toast.success(`${asset.asset_name} approved!`);
  };

  const submitFeedbackForAsset = async (asset: Asset) => {
    const sections = sectionComments[asset.id] || {};
    const sectionEntries = Object.entries(sections).filter(([_, t]) => t.trim());
    const gen = generalComments[asset.id]?.trim();
    if (sectionEntries.length === 0 && !gen) {
      toast.error("Add at least one comment before submitting.");
      return;
    }

    setSubmittingFeedback(true);
    try {
      // Delete old section comments for this asset
      await (supabase.from("asset_section_comments" as any) as any).delete().eq("asset_id", asset.id).eq("client_id", clientId!);

      // Insert new section comments
      if (sectionEntries.length > 0) {
        const rows = sectionEntries.map(([section, text]) => ({
          asset_id: asset.id, client_id: clientId!, section_name: section, comment_text: text.trim(), version_number: asset.version || 1,
        }));
        await (supabase.from("asset_section_comments" as any) as any).insert(rows);
      }

      // Update asset
      await supabase.from("assets").update({ status: "change_requested" as any, client_comment: gen || null }).eq("id", asset.id);

      // Create revision round
      const { data: existingRounds } = await supabase.from("revision_rounds")
        .select("round_number").eq("asset_id", asset.id).order("round_number", { ascending: false }).limit(1);
      const nextRound = (existingRounds?.[0]?.round_number || 0) + 1;
      const sectionTexts = sectionEntries.map(([s, t]) => `[${s}] ${t.trim()}`).join("\n");
      const fullComment = [sectionTexts, gen ? `[General] ${gen}` : ""].filter(Boolean).join("\n");
      await supabase.from("revision_rounds").insert({
        asset_id: asset.id, round_number: nextRound, requested_by: "client" as any, comment: fullComment || "Feedback submitted",
      });

      setAssets((prev) => prev.map((a) => a.id === asset.id ? { ...a, status: "change_requested", client_comment: gen || a.client_comment } : a));

      // Trigger correction prompt
      supabase.functions.invoke("generate-correction-prompt", { body: { asset_id: asset.id } }).catch(console.error);
      supabase.functions.invoke("send-notification", {
        body: { type: "client_feedback", client_id: clientId, asset_type: asset.asset_type, asset_name: asset.asset_name, comment: `${sectionEntries.length} section comment(s)` },
      }).catch(console.error);

      toast.success("Feedback submitted!");
    } catch (e: any) {
      toast.error(e.message || "Failed to submit");
    } finally {
      setSubmittingFeedback(false);
    }
  };

  if (loading) return <div className="text-muted-foreground p-8">Loading...</div>;
  if (!campaign) return <div className="text-muted-foreground p-8">Campaign not found.</div>;

  const allApproved = assets.length > 0 && assets.every((a) => a.status === "approved");
  const getSectionsForType = (type: string) => {
    if (type === "landing_page") return LANDING_PAGE_SECTIONS;
    if (type === "email_flow") return ["Subject line", "Preview text", "Body content", "CTA button"];
    if (type === "social_post") return ["Image", "Caption", "Hashtags"];
    return [];
  };

  return (
    <div>
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link to="/client/dashboard"><ArrowLeft className="w-4 h-4 mr-1" /> Back to dashboard</Link>
      </Button>

      {/* Campaign approved banner */}
      {allApproved && (
        <div className="mb-6 rounded-lg p-5 bg-gradient-to-r from-[hsl(142,71%,35%)] to-[hsl(152,60%,42%)] text-white">
          <p className="text-lg font-bold">✅ Campaign approved!</p>
          <p className="text-sm mt-1 text-white/90">PRAGMA will now activate these assets.</p>
        </div>
      )}

      {/* Campaign brief */}
      <div className="bg-card rounded-lg border border-border p-5 mb-6 space-y-3">
        <div className="flex items-start justify-between">
          <h1 className="text-xl font-bold text-foreground">{campaign.name}</h1>
          <Badge variant="outline" className="text-xs">{campaign.status}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Here is the strategy behind this campaign. Review the assets below and let us know what you think.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border">
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
        <div className="space-y-6">
          {assets.map((asset) => {
            const sections = getSectionsForType(asset.asset_type);
            return (
              <div key={asset.id} className="bg-card rounded-lg border border-border overflow-hidden">
                <div className="p-4 flex items-center justify-between border-b border-border">
                  <div className="flex items-center gap-3">
                    <h3 className="font-medium text-foreground">{asset.asset_name}</h3>
                    <span className="text-xs font-mono text-muted-foreground">v{asset.version || 1}</span>
                    <Badge variant="outline" className="text-[10px]">{typeLabels[asset.asset_type] || asset.asset_type}</Badge>
                  </div>
                  <StatusBadge status={asset.status} />
                </div>

                <div className="p-4 space-y-1">
                  {/* File preview */}
                  {asset.file_url && (
                    <div className="mb-4">
                      {asset.file_url.match(/\.(png|jpg|jpeg|webp|gif)$/i) ? (
                        <img src={asset.file_url} alt={asset.asset_name} className="w-full rounded-md border border-border" />
                      ) : (
                        <a href={asset.file_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1 text-sm">
                          <ExternalLink className="w-4 h-4" /> View file
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

                  {/* Commentable sections */}
                  {sections.map((section) => (
                    <CommentableSection
                      key={section}
                      name={section}
                      comment={sectionComments[asset.id]?.[section] || ""}
                      onComment={(t) => updateSectionComment(asset.id, section, t)}
                    >
                      <p className="text-sm text-muted-foreground italic">Review the {section.toLowerCase()} section</p>
                    </CommentableSection>
                  ))}

                  {/* Blog: split paragraphs */}
                  {asset.asset_type === "blog_article" && asset.content?.text && (() => {
                    const paragraphs = asset.content.text.split(/\n\n+/).filter((p: string) => p.trim());
                    return paragraphs.map((para: string, i: number) => {
                      const key = i === 0 ? "Title" : `Paragraph ${i}`;
                      return (
                        <CommentableSection key={key} name={key} comment={sectionComments[asset.id]?.[key] || ""} onComment={(t) => updateSectionComment(asset.id, key, t)}>
                          <p className={`text-sm ${i === 0 ? "font-semibold text-foreground text-lg" : "text-foreground whitespace-pre-wrap"}`}>{para}</p>
                        </CommentableSection>
                      );
                    });
                  })()}
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
                      <CheckCircle2 className="w-4 h-4" /> Approved
                    </div>
                  ) : (
                    <>
                      <Button size="sm" onClick={() => approveAsset(asset)} className="bg-status-approved hover:bg-status-approved/90 text-primary-foreground">
                        <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => submitFeedbackForAsset(asset)} disabled={submittingFeedback}>
                        {submittingFeedback ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                        Submit feedback
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
