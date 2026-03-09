import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Copy, Loader2, Pencil, Upload, CheckCircle2, FileText, Mail, Image, BookOpen } from "lucide-react";
import { format } from "date-fns";

type SectionComment = {
  section_name: string;
  comment_text: string;
};

type AssetWithFeedback = {
  id: string;
  asset_name: string;
  asset_type: string;
  version: number;
  client_comment: string | null;
  correction_prompt: string | null;
  status: string;
  created_at: string;
};

interface CorrectionPromptPanelProps {
  clientId: string;
  assets: AssetWithFeedback[];
  onUploadNewVersion: (assetId: string, assetType: string, summary: string) => void;
}

const typeIcons: Record<string, React.ReactNode> = {
  landing_page: <FileText className="w-4 h-4" />,
  email_flow: <Mail className="w-4 h-4" />,
  social_post: <Image className="w-4 h-4" />,
  blog_article: <BookOpen className="w-4 h-4" />,
};

const typeLabels: Record<string, string> = {
  landing_page: "Landing Page",
  email_flow: "Email Flow",
  social_post: "Social Post",
  blog_article: "Blog Article",
};

export function CorrectionPromptPanel({ clientId, assets, onUploadNewVersion }: CorrectionPromptPanelProps) {
  const changeRequested = assets.filter((a) => a.status === "change_requested");
  const [sectionComments, setSectionComments] = useState<Record<string, SectionComment[]>>({});
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (changeRequested.length === 0) return;

    const fetchComments = async () => {
      const ids = changeRequested.map((a) => a.id);
      const { data } = await supabase
        .from("asset_section_comments" as any)
        .select("asset_id, section_name, comment_text")
        .in("asset_id", ids);

      const grouped: Record<string, SectionComment[]> = {};
      for (const c of (data || []) as any[]) {
        if (!grouped[c.asset_id]) grouped[c.asset_id] = [];
        grouped[c.asset_id].push({ section_name: c.section_name, comment_text: c.comment_text });
      }
      setSectionComments(grouped);

      // Init prompts from existing correction_prompt
      const promptMap: Record<string, string> = {};
      for (const a of changeRequested) {
        if (a.correction_prompt) promptMap[a.id] = a.correction_prompt;
      }
      setPrompts(promptMap);
      setLoaded(true);
    };
    fetchComments();
  }, [changeRequested.length]);

  if (changeRequested.length === 0 || !loaded) return null;

  const generatePrompt = async (assetId: string) => {
    setGenerating((prev) => ({ ...prev, [assetId]: true }));
    try {
      const { data, error } = await supabase.functions.invoke("generate-correction-prompt", {
        body: { asset_id: assetId },
      });
      if (error) throw error;
      if (data?.correction_prompt) {
        setPrompts((prev) => ({ ...prev, [assetId]: data.correction_prompt }));
        toast.success("Correction prompt generated!");
      } else {
        throw new Error(data?.error || "No prompt returned");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to generate correction prompt");
    } finally {
      setGenerating((prev) => ({ ...prev, [assetId]: false }));
    }
  };

  const copyPrompt = (assetId: string) => {
    if (prompts[assetId]) {
      navigator.clipboard.writeText(prompts[assetId]);
      toast.success("Prompt copied to clipboard!");
    }
  };

  const saveEditedPrompt = async (assetId: string) => {
    await supabase.from("assets").update({ correction_prompt: prompts[assetId] } as any).eq("id", assetId);
    setEditing((prev) => ({ ...prev, [assetId]: false }));
    toast.success("Prompt saved!");
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-foreground text-lg flex items-center gap-2">
          🔧 Correction Prompts
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Ready-to-use prompts based on client feedback. Copy and paste into the relevant tool to generate the corrected version.
        </p>
      </div>

      {changeRequested.map((asset) => {
        const comments = sectionComments[asset.id] || [];
        const prompt = prompts[asset.id];
        const isGenerating = generating[asset.id];
        const isEditing = editing[asset.id];

        // Workflow steps
        const hasClientFeedback = true;
        const hasPrompt = !!prompt;
        const isApproved = asset.status === "approved";

        return (
          <div key={asset.id} className="bg-card rounded-lg border border-border overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center gap-3">
              <span className="text-muted-foreground">{typeIcons[asset.asset_type]}</span>
              <span className="font-medium text-foreground">{asset.asset_name}</span>
              <Badge variant="outline" className="text-[10px]">Based on v{asset.version} feedback</Badge>
            </div>

            <div className="p-4 space-y-4">
              {/* Client feedback summary */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">What the client wants changed:</p>
                <div className="space-y-1.5">
                  {(() => {
                    // Deduplicate: if a section comment with "general" exists matching client_comment, skip client_comment
                    const generalComment = comments.find(
                      (c) => c.section_name.toLowerCase() === "general" && c.comment_text === asset.client_comment
                    );
                    const nonGeneralComments = comments.filter(
                      (c) => !(c.section_name.toLowerCase() === "general" && c.comment_text === asset.client_comment)
                    );

                    return (
                      <>
                        {/* Show client_comment as General (only if not already in section comments) */}
                        {asset.client_comment && (
                          <div className="flex items-start gap-2 text-sm">
                            <Badge variant="secondary" className="text-[10px] shrink-0 mt-0.5">General</Badge>
                            <span className="text-foreground">"{asset.client_comment}"</span>
                          </div>
                        )}
                        {/* Show remaining non-duplicate section comments */}
                        {nonGeneralComments.map((c, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm">
                            <Badge variant="outline" className="text-[10px] shrink-0 mt-0.5">{c.section_name}</Badge>
                            <span className="text-foreground">"{c.comment_text}"</span>
                          </div>
                        ))}
                        {nonGeneralComments.length === 0 && !asset.client_comment && (
                          <p className="text-sm text-muted-foreground italic">No specific comments found</p>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Correction prompt */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Correction prompt:</p>
                {prompt ? (
                  <>
                    <Textarea
                      value={prompt}
                      readOnly={!isEditing}
                      onChange={(e) => setPrompts((prev) => ({ ...prev, [asset.id]: e.target.value }))}
                      className={`min-h-[200px] text-sm font-mono ${!isEditing ? "bg-secondary/30 cursor-default" : ""}`}
                    />
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="outline" onClick={() => copyPrompt(asset.id)}>
                        <Copy className="w-3.5 h-3.5 mr-1" /> Copy prompt
                      </Button>
                      {isEditing ? (
                        <Button size="sm" onClick={() => saveEditedPrompt(asset.id)}>
                          Save changes
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setEditing((prev) => ({ ...prev, [asset.id]: true }))}>
                          <Pencil className="w-3.5 h-3.5 mr-1" /> Edit prompt
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const summary = comments.map((c) => `${c.section_name}: ${c.comment_text}`).join("; ");
                          onUploadNewVersion(asset.id, asset.asset_type, summary);
                        }}
                      >
                        <Upload className="w-3.5 h-3.5 mr-1" /> Mark as done — upload new version
                      </Button>
                    </div>
                  </>
                ) : (
                  <Button onClick={() => generatePrompt(asset.id)} disabled={isGenerating}>
                    {isGenerating ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Generating...</>
                    ) : (
                      "Generate correction prompt"
                    )}
                  </Button>
                )}
              </div>

              {/* Workflow indicator */}
              <div className="border-t border-border pt-3">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  <span className={hasClientFeedback ? "text-foreground" : "text-muted-foreground"}>
                    {hasClientFeedback ? "✅" : "⬜"} Client feedback received
                  </span>
                  <span className={hasPrompt ? "text-foreground" : "text-muted-foreground"}>
                    {hasPrompt ? "✅" : "⬜"} Correction prompt generated
                  </span>
                  <span className="text-muted-foreground">
                    ⬜ New version uploaded
                  </span>
                  <span className="text-muted-foreground">
                    ⬜ Client approved
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
