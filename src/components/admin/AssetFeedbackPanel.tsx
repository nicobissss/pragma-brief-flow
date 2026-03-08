import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { MessageSquare } from "lucide-react";
import { format } from "date-fns";

type SectionComment = {
  id: string;
  section_name: string;
  comment_text: string;
  version_number: number;
  created_at: string;
};

type RevisionRound = {
  id: string;
  round_number: number;
  comment: string | null;
  requested_by: string;
  created_at: string;
};

interface AssetFeedbackPanelProps {
  assetId: string;
  clientComment: string | null;
  status: string;
  version: number;
}

export function AssetFeedbackPanel({ assetId, clientComment, status, version }: AssetFeedbackPanelProps) {
  const [sectionComments, setSectionComments] = useState<SectionComment[]>([]);
  const [revisionRounds, setRevisionRounds] = useState<RevisionRound[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const [commentsRes, roundsRes] = await Promise.all([
        (supabase.from("asset_section_comments" as any) as any).select("*").eq("asset_id", assetId).order("created_at", { ascending: true }),
        supabase.from("revision_rounds").select("*").eq("asset_id", assetId).order("round_number", { ascending: true }),
      ]);
      setSectionComments((commentsRes.data || []) as SectionComment[]);
      setRevisionRounds((roundsRes.data || []) as RevisionRound[]);
      setLoaded(true);
    };
    fetch();
  }, [assetId]);

  if (!loaded) return null;

  const hasAnyFeedback = clientComment || sectionComments.length > 0;
  if (!hasAnyFeedback && status !== "change_requested") return null;

  // Group section comments by version
  const commentsByVersion = sectionComments.reduce((acc, c) => {
    const v = c.version_number;
    if (!acc[v]) acc[v] = [];
    acc[v].push(c);
    return acc;
  }, {} as Record<number, SectionComment[]>);

  return (
    <div className="space-y-4">
      {/* Change requested banner */}
      {status === "change_requested" && (
        <div className="bg-[hsl(45,100%,90%)] border border-[hsl(45,100%,72%)] rounded-lg p-3 flex items-center gap-2">
          <span className="text-base">💬</span>
          <span className="text-sm font-medium text-foreground">Client has requested changes</span>
        </div>
      )}

      {/* Overall comment */}
      {clientComment && (
        <div className="bg-card rounded-lg border border-border p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Overall comment</p>
          <p className="text-sm text-foreground">{clientComment}</p>
        </div>
      )}

      {/* Section-specific comments */}
      {sectionComments.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Section-specific comments</p>
          <div className="space-y-3">
            {sectionComments.map((c) => (
              <div key={c.id} className="flex items-start gap-3 p-3 rounded-md bg-secondary/30">
                <Badge variant="outline" className="text-[10px] shrink-0 mt-0.5">{c.section_name}</Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">"{c.comment_text}"</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Submitted {format(new Date(c.created_at), "dd MMM yyyy 'at' HH:mm")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Version history timeline */}
      {revisionRounds.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Version history</p>
          <div className="space-y-0 relative">
            <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />
            {revisionRounds.map((round) => {
              const versionComments = commentsByVersion[round.round_number] || [];
              return (
                <div key={round.id} className="relative pl-8 pb-4 last:pb-0">
                  <div className="absolute left-1.5 top-1.5 w-3 h-3 rounded-full border-2 border-border bg-card" />
                  <div className="text-sm">
                    <span className="font-mono text-xs text-muted-foreground">v{round.round_number}</span>
                    <span className="text-muted-foreground mx-1">—</span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(round.created_at), "dd MMM")}
                    </span>
                    {round.requested_by === "client" && (
                      <span className="ml-2 text-xs text-status-change-requested">
                        <MessageSquare className="w-3 h-3 inline mr-0.5" />
                        Client feedback
                      </span>
                    )}
                  </div>
                  {round.comment && (
                    <p className="text-xs text-muted-foreground mt-1 ml-1">Overall: "{round.comment}"</p>
                  )}
                  {versionComments.map((vc) => (
                    <p key={vc.id} className="text-xs text-muted-foreground mt-0.5 ml-1">
                      {vc.section_name}: "{vc.comment_text}"
                    </p>
                  ))}
                </div>
              );
            })}
            {/* Current version */}
            <div className="relative pl-8">
              <div className={`absolute left-1.5 top-1.5 w-3 h-3 rounded-full border-2 ${status === "approved" ? "border-status-approved bg-status-approved" : "border-primary bg-primary"}`} />
              <div className="text-sm">
                <span className="font-mono text-xs text-muted-foreground">v{version}</span>
                <span className="text-muted-foreground mx-1">—</span>
                <span className="text-xs text-muted-foreground">current</span>
                {status === "approved" && <span className="ml-2 text-xs">✅ Approved</span>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
