import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sparkles, Loader2, Bot } from "lucide-react";

type Props = {
  assetId: string;
  clientId: string;
  /** Compact (default) shows only badge + small button. */
  compact?: boolean;
};

type Report = {
  overall_score: number;
  blocked: boolean;
  summary: string | null;
  created_at: string;
};

export function AssetQABadge({ assetId, clientId, compact = true }: Props) {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("asset_qa_reports")
      .select("overall_score, blocked, summary, created_at")
      .eq("asset_id", assetId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setReport((data as Report) || null);
    setLoading(false);
  };

  useEffect(() => {
    fetchReport();
  }, [assetId]);

  const runQa = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("qa-asset-review", {
        body: { asset_id: assetId, force: true },
      });
      if (error) {
        const ctx: any = (error as any).context;
        let parsed: any = null;
        try {
          if (ctx && typeof ctx.json === "function") parsed = await ctx.json();
          else if (ctx && typeof ctx.text === "function") {
            const t = await ctx.text();
            try { parsed = JSON.parse(t); } catch { parsed = { error: t }; }
          }
        } catch {}
        const msg = (parsed?.error as string) || (error as any).message || "";
        if (msg.includes("402") || msg.includes("payment") || msg.includes("credits")) {
          toast.error("Sin créditos en Lovable AI", {
            description: "Recarga el workspace para usar la IA.",
          });
        } else if (msg.includes("429") || msg.includes("Rate")) {
          toast.error("Demasiadas peticiones, reintenta en unos segundos.");
        } else {
          toast.error("Error al evaluar el asset", { description: msg });
        }
        return;
      }
      if (data?.skipped) {
        toast.info(`QA omitida: ${data.reason}`);
        return;
      }
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      toast.success(`QA completada — Score ${data?.overall_score ?? "?"}/100`);
      await fetchReport();
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <Badge variant="outline" className="text-[10px] gap-1 font-normal">
        <Loader2 className="w-3 h-3 animate-spin" /> QA
      </Badge>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      {report ? (
        <Badge
          variant="outline"
          title={report.summary || ""}
          className={`text-[10px] gap-1 ${
            report.blocked
              ? "border-destructive/50 text-destructive"
              : report.overall_score >= 80
              ? "border-emerald-300 text-emerald-700"
              : "border-amber-300 text-amber-700"
          }`}
        >
          <Bot className="w-3 h-3" />
          QA {report.overall_score}
          {report.blocked ? " · bloq" : ""}
        </Badge>
      ) : (
        <Badge
          variant="outline"
          className="text-[10px] gap-1 text-muted-foreground"
        >
          <Bot className="w-3 h-3" /> QA: —
        </Badge>
      )}
      <Button
        size="sm"
        variant="ghost"
        disabled={running}
        onClick={runQa}
        className="h-6 px-2 text-[10px]"
        title="Evaluar con IA ahora"
      >
        {running ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Sparkles className="w-3 h-3" />
        )}
        {!compact && <span className="ml-1">Evaluar</span>}
      </Button>
    </span>
  );
}
