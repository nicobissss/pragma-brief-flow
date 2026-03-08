import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { MARKETS } from "@/lib/briefing-data";
import { toast } from "sonner";

type Prospect = {
  id: string;
  name: string;
  company_name: string;
  email: string;
  phone: string | null;
  vertical: string;
  sub_niche: string;
  market: string;
  status: string;
  briefing_answers: Record<string, any>;
  created_at: string;
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

export default function AdminProspectDetail() {
  const { id } = useParams<{ id: string }>();
  const [prospect, setProspect] = useState<Prospect | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("prospects").select("*").eq("id", id!).single();
      setProspect(data as Prospect | null);
      setLoading(false);
    };
    fetch();
  }, [id]);

  const updateStatus = async (status: string) => {
    if (!prospect) return;
    const { error } = await supabase.from("prospects").update({ status }).eq("id", prospect.id);
    if (error) { toast.error(error.message); return; }
    setProspect({ ...prospect, status });
    toast.success(`Status updated to ${status}`);
  };

  if (loading) return <div className="p-8 text-muted-foreground">Loading...</div>;
  if (!prospect) return <div className="p-8 text-muted-foreground">Prospect not found.</div>;

  const answers = prospect.briefing_answers || {};
  const marketLabel = MARKETS.find((m) => m.value === prospect.market)?.label || prospect.market;

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{prospect.name}</h1>
          <p className="text-muted-foreground">{prospect.company_name} · {prospect.email}</p>
        </div>
        <StatusBadge status={prospect.status} />
      </div>

      <Tabs defaultValue="briefing">
        <TabsList>
          <TabsTrigger value="briefing">Briefing</TabsTrigger>
          <TabsTrigger value="proposal">Proposal</TabsTrigger>
        </TabsList>

        <TabsContent value="briefing" className="mt-6 space-y-6">
          <div className="bg-card rounded-lg border border-border p-6">
            <h3 className="font-semibold text-foreground mb-4">About the Business</h3>
            <InfoRow label="Full name" value={prospect.name} />
            <InfoRow label="Company" value={prospect.company_name} />
            <InfoRow label="Email" value={prospect.email} />
            <InfoRow label="Phone" value={prospect.phone} />
            <InfoRow label="Market" value={marketLabel} />
            <InfoRow label="Vertical" value={prospect.vertical} />
            <InfoRow label="Sub-niche" value={prospect.sub_niche} />
          </div>

          <div className="bg-card rounded-lg border border-border p-6">
            <h3 className="font-semibold text-foreground mb-4">Current Situation</h3>
            <InfoRow label="Years in operation" value={answers.years_in_operation} />
            <InfoRow label="Monthly new clients" value={answers.monthly_new_clients} />
            <InfoRow label="Client sources" value={answers.client_sources} />
            <InfoRow label="Runs paid ads" value={answers.runs_paid_ads} />
            <InfoRow label="Ad platforms" value={answers.ad_platforms} />
            <InfoRow label="Monthly budget" value={answers.monthly_budget} />
            <InfoRow label="Has email list" value={answers.has_email_list} />
            <InfoRow label="Email list size" value={answers.email_list_size} />
            <InfoRow label="Has website" value={answers.has_website} />
            <InfoRow label="Website URL" value={answers.website_url} />
            <InfoRow label="Uses CRM" value={answers.uses_crm} />
            <InfoRow label="CRM system" value={answers.crm_name} />
          </div>

          <div className="bg-card rounded-lg border border-border p-6">
            <h3 className="font-semibold text-foreground mb-4">Goals</h3>
            <InfoRow label="Main goal" value={answers.main_goal} />
            <InfoRow label="Average ticket" value={answers.average_ticket ? `${answers.average_ticket} ${answers.ticket_currency || "EUR"}` : undefined} />
            <InfoRow label="Biggest challenge" value={answers.biggest_challenge} />
            <InfoRow label="Differentiator" value={answers.differentiator} />
            <InfoRow label="Additional info" value={answers.additional_info} />
          </div>
        </TabsContent>

        <TabsContent value="proposal" className="mt-6">
          <div className="bg-card rounded-lg border border-border p-6 text-center">
            <p className="text-muted-foreground mb-4">Proposal generation will be available when AI edge functions are configured.</p>
            <Button disabled>Generate Proposal</Button>
          </div>

          <div className="flex gap-3 mt-6">
            <Button onClick={() => updateStatus("proposal_ready")} disabled={prospect.status === "proposal_ready"}>
              Mark as Ready
            </Button>
            <Button onClick={() => updateStatus("accepted")} variant="outline" className="border-status-accepted text-status-accepted">
              Prospect Accepted
            </Button>
            <Button onClick={() => updateStatus("rejected")} variant="outline" className="border-status-rejected text-status-rejected">
              Prospect Rejected
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
