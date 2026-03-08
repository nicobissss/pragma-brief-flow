import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Building2, Calendar, ChevronDown, ExternalLink, Loader2 } from "lucide-react";
import { MARKETS } from "@/lib/briefing-data";

type Client = {
  id: string;
  name: string;
  company_name: string;
  email: string;
  vertical: string;
  sub_niche: string;
  market: string;
  prospect_id: string | null;
  created_at: string;
};

type ProposalData = {
  pricing?: {
    contract_type?: string;
    retainer?: string;
    commission?: string;
  };
  recommended_flow?: string;
  recommended_tools?: { name: string }[];
};

const VERTICAL_COLORS: Record<string, string> = {
  "Salud & Estética": "hsl(220, 63%, 22%)",
  "E-Learning": "hsl(152, 44%, 23%)",
  "Deporte Offline": "hsl(282, 54%, 36%)",
};

function InfoRow({ label, value }: { label: string; value: any }) {
  if (value === null || value === undefined || value === "") return null;
  const display = Array.isArray(value) ? value.join(", ") : String(value);
  return (
    <div className="flex justify-between py-2 border-b border-border last:border-0">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-foreground text-sm font-medium text-right max-w-[60%]">{display}</span>
    </div>
  );
}

export default function AdminClientDetail() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<Client | null>(null);
  const [proposal, setProposal] = useState<ProposalData | null>(null);
  const [briefingAnswers, setBriefingAnswers] = useState<Record<string, any>>({});
  const [brieferUrl, setBrieferUrl] = useState<string | null>(null);
  const [brieferStatus, setBrieferStatus] = useState<any>(null);
  const [brieferLoading, setBrieferLoading] = useState(false);
  const [answersOpen, setAnswersOpen] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      const { data: clientData } = await supabase
        .from("clients").select("*").eq("id", id!).single();
      if (!clientData) { setLoading(false); return; }
      setClient(clientData as Client);

      // Fetch briefer config
      const brieferRes = await (supabase.from("connected_tools" as any) as any)
        .select("config").eq("tool_name", "briefer").maybeSingle();
      const brieferConfig = brieferRes?.data?.config;
      if (brieferConfig?.url) setBrieferUrl(brieferConfig.url);

      if (clientData.prospect_id) {
        const [proposalRes, prospectRes] = await Promise.all([
          supabase.from("proposals").select("full_proposal_content").eq("prospect_id", clientData.prospect_id).maybeSingle(),
          supabase.from("prospects").select("briefing_answers").eq("id", clientData.prospect_id).single(),
        ]);

        const proposalData = proposalRes as any;
        const prospectData = prospectRes as any;
        const proposalRes = results[1] as any;
        const prospectRes = results[2] as any;
        if (proposalRes?.data?.full_proposal_content) {
          setProposal(proposalRes.data.full_proposal_content as ProposalData);
        }
        if (prospectRes?.data?.briefing_answers) {
          setBriefingAnswers(prospectRes.data.briefing_answers as Record<string, any>);
        }
      }

      setLoading(false);
    };
    fetchAll();
  }, [id]);

  // Fetch Briefer status if URL is configured
  useEffect(() => {
    if (!brieferUrl || !client) return;
    setBrieferLoading(true);
    const fetchBrieferStatus = async () => {
      try {
        const res = await fetch(`${brieferUrl}/functions/v1/client-status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ client_id: client.id }),
        });
        if (res.ok) {
          setBrieferStatus(await res.json());
        }
      } catch {
        // Briefer not reachable — that's fine
      } finally {
        setBrieferLoading(false);
      }
    };
    fetchBrieferStatus();
  }, [brieferUrl, client]);

  if (loading) return <div className="p-8 text-muted-foreground">Loading...</div>;
  if (!client) return <div className="p-8 text-muted-foreground">Client not found.</div>;

  const marketLabel = MARKETS.find((m) => m.value === client.market)?.label || client.market;
  const verticalColor = VERTICAL_COLORS[client.vertical] || "hsl(var(--primary))";
  const contractType = proposal?.pricing?.contract_type;
  const tools = proposal?.recommended_tools || [];

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Building2 className="w-6 h-6 text-muted-foreground" />
        <h1 className="text-2xl font-bold text-foreground">{client.company_name}</h1>
        <Badge style={{ backgroundColor: verticalColor }} className="text-white text-xs">{client.vertical}</Badge>
        <Badge variant="outline" className="text-xs">{marketLabel}</Badge>
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          Client since {new Date(client.created_at).toLocaleDateString()}
        </span>
        {contractType && <Badge variant="secondary" className="text-xs">{contractType}</Badge>}
      </div>

      <Tabs defaultValue="info">
        <TabsList className="sticky top-0 z-10 bg-background border-b border-border w-full justify-start rounded-none px-0 h-auto pb-0">
          <TabsTrigger value="info" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-foreground px-4 py-2.5">
            Client Info
          </TabsTrigger>
          <TabsTrigger value="briefer" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-foreground px-4 py-2.5">
            Briefer
          </TabsTrigger>
        </TabsList>

        {/* TAB 1 — Client Info */}
        <TabsContent value="info" className="mt-6 space-y-6">
          <div className="bg-card rounded-lg border border-border p-6">
            <h3 className="font-semibold text-foreground mb-4">Client Details</h3>
            <InfoRow label="Name" value={client.name} />
            <InfoRow label="Company" value={client.company_name} />
            <InfoRow label="Email" value={client.email} />
            <InfoRow label="Vertical" value={client.vertical} />
            <InfoRow label="Sub-niche" value={client.sub_niche} />
            <InfoRow label="Market" value={marketLabel} />
            <InfoRow label="Contract type" value={contractType} />
            <InfoRow label="Recommended flow" value={proposal?.recommended_flow} />
            <InfoRow label="Retainer" value={proposal?.pricing?.retainer} />
            <InfoRow label="Commission" value={proposal?.pricing?.commission} />
            <InfoRow label="Client since" value={new Date(client.created_at).toLocaleDateString()} />
          </div>

          {/* Activated tools */}
          {tools.length > 0 && (
            <div className="bg-card rounded-lg border border-border p-6">
              <h3 className="font-semibold text-foreground mb-3">Activated Tools</h3>
              <div className="flex flex-wrap gap-2">
                {tools.map((t: any, i: number) => (
                  <Badge key={i} variant="secondary" className="text-xs">{typeof t === "string" ? t : t.name || t.tool}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Briefing answers (collapsible) */}
          {Object.keys(briefingAnswers).length > 0 && (
            <Collapsible open={answersOpen} onOpenChange={setAnswersOpen}>
              <div className="bg-card rounded-lg border border-border p-6">
                <CollapsibleTrigger className="flex items-center justify-between w-full">
                  <h3 className="font-semibold text-foreground">Briefing Answers</h3>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${answersOpen ? "rotate-180" : ""}`} />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4">
                  {Object.entries(briefingAnswers)
                    .filter(([k]) => !k.startsWith("_"))
                    .map(([key, value]) => (
                      <InfoRow key={key} label={key.replace(/_/g, " ")} value={value} />
                    ))}
                </CollapsibleContent>
              </div>
            </Collapsible>
          )}
        </TabsContent>

        {/* TAB 2 — Briefer */}
        <TabsContent value="briefer" className="mt-6">
          {brieferUrl ? (
            <div className="bg-card rounded-lg border border-border p-8">
              <h3 className="font-semibold text-foreground mb-1">This client is managed in</h3>
              <p className="text-lg font-bold text-foreground mb-6">Briefer by PRAGMA</p>

              {brieferLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading status from Briefer...
                </div>
              ) : brieferStatus ? (
                <div className="space-y-3 mb-6">
                  <InfoRow label="Kickoff status" value={brieferStatus.kickoff_status || "—"} />
                  <InfoRow label="Campaigns" value={brieferStatus.campaign_count ?? "—"} />
                  <InfoRow label="Assets pending" value={brieferStatus.pending_assets ?? "—"} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mb-6">Could not fetch status from Briefer.</p>
              )}

              <Button onClick={() => window.open(`${brieferUrl}/admin/client/${client.id}`, "_blank")}>
                <ExternalLink className="w-4 h-4 mr-2" /> Open in Briefer
              </Button>
            </div>
          ) : (
            <div className="bg-card rounded-lg border border-border p-8 text-center">
              <p className="text-muted-foreground">
                Connect <strong>Briefer by PRAGMA</strong> in Settings to see client operational status.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
