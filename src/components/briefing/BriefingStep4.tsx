import { BriefingData, MARKETS } from "@/lib/briefing-data";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

type Props = {
  data: BriefingData;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
};

function SummarySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-foreground text-sm uppercase tracking-wide">{title}</h3>
      <div className="bg-secondary rounded-lg p-4 space-y-1">{children}</div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string | undefined }) {
  if (!value) return null;
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-medium text-right max-w-[60%]">{value}</span>
    </div>
  );
}

export function BriefingStep4({ data, onBack, onSubmit, submitting }: Props) {
  const marketLabel = MARKETS.find((m) => m.value === data.market)?.label || data.market;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Review your briefing</h2>
        <p className="text-muted-foreground text-sm mt-1">Please review your answers before submitting.</p>
      </div>

      <SummarySection title="About your business">
        <SummaryRow label="Full name" value={data.name} />
        <SummaryRow label="Company" value={data.company_name} />
        <SummaryRow label="Email" value={data.email} />
        <SummaryRow label="Phone" value={data.phone} />
        <SummaryRow label="Market" value={marketLabel} />
        <SummaryRow label="Vertical" value={data.vertical} />
        <SummaryRow label="Sub-niche" value={data.sub_niche} />
      </SummarySection>

      <SummarySection title="Your current situation">
        <SummaryRow label="Years in operation" value={data.years_in_operation} />
        <SummaryRow label="Monthly new clients" value={data.monthly_new_clients} />
        <SummaryRow label="Client sources" value={data.client_sources.join(", ")} />
        <SummaryRow label="Runs paid ads" value={data.runs_paid_ads} />
        {data.runs_paid_ads === "Yes" && <SummaryRow label="Ad platforms" value={data.ad_platforms.join(", ")} />}
        <SummaryRow label="Monthly budget" value={data.monthly_budget} />
        <SummaryRow label="Email list" value={data.has_email_list} />
        {data.has_email_list === "Yes" && <SummaryRow label="List size" value={data.email_list_size} />}
        <SummaryRow label="Has website" value={data.has_website} />
        {data.has_website === "Yes" && <SummaryRow label="Website URL" value={data.website_url} />}
        <SummaryRow label="Uses CRM" value={data.uses_crm} />
        {data.uses_crm === "Yes" && <SummaryRow label="CRM system" value={data.crm_name} />}
      </SummarySection>

      <SummarySection title="Your goals">
        <SummaryRow label="Main goal" value={data.main_goal} />
        <SummaryRow label="Average ticket" value={`${data.average_ticket} ${data.ticket_currency}`} />
        <SummaryRow label="Biggest challenge" value={data.biggest_challenge} />
        <SummaryRow label="Differentiator" value={data.differentiator} />
        {data.additional_info && <SummaryRow label="Additional info" value={data.additional_info} />}
      </SummarySection>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack} disabled={submitting}>Back</Button>
        <Button onClick={onSubmit} disabled={submitting} size="lg">
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Sending...
            </>
          ) : (
            "Send my briefing"
          )}
        </Button>
      </div>
    </div>
  );
}
