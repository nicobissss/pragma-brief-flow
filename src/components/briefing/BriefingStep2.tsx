import { BriefingData, CLIENT_SOURCES, AD_PLATFORMS, BUDGET_RANGES, EMAIL_LIST_SIZES } from "@/lib/briefing-data";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

type Props = {
  data: BriefingData;
  update: (d: Partial<BriefingData>) => void;
  onNext: () => void;
  onBack: () => void;
};

export function BriefingStep2({ data, update, onNext, onBack }: Props) {
  const toggleSource = (src: string) => {
    const sources = data.client_sources.includes(src)
      ? data.client_sources.filter((s) => s !== src)
      : [...data.client_sources, src];
    update({ client_sources: sources });
  };

  const togglePlatform = (p: string) => {
    const platforms = data.ad_platforms.includes(p)
      ? data.ad_platforms.filter((x) => x !== p)
      : [...data.ad_platforms, p];
    update({ ad_platforms: platforms });
  };

  const canProceed = data.years_in_operation && data.monthly_new_clients && data.client_sources.length > 0 && data.runs_paid_ads && data.monthly_budget && data.has_email_list && data.has_website && data.uses_crm;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Your current situation</h2>
        <p className="text-muted-foreground text-sm mt-1">Help us understand where you are today.</p>
      </div>

      <div className="space-y-4">
        <div>
          <Label>Years in operation *</Label>
          <Input type="number" min={0} value={data.years_in_operation} onChange={(e) => update({ years_in_operation: e.target.value })} placeholder="e.g. 5" />
        </div>
        <div>
          <Label>How many new clients/students do you get per month? *</Label>
          <Input type="number" min={0} value={data.monthly_new_clients} onChange={(e) => update({ monthly_new_clients: e.target.value })} placeholder="e.g. 20" />
        </div>

        <div>
          <Label className="mb-2 block">How do most new clients find you today? *</Label>
          <div className="grid grid-cols-2 gap-2">
            {CLIENT_SOURCES.map((src) => (
              <label key={src} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={data.client_sources.includes(src)} onCheckedChange={() => toggleSource(src)} />
                {src}
              </label>
            ))}
          </div>
        </div>

        <div>
          <Label>Do you currently run paid ads? *</Label>
          <Select value={data.runs_paid_ads} onValueChange={(v) => update({ runs_paid_ads: v, ad_platforms: v === "No" ? [] : data.ad_platforms })}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Yes">Yes</SelectItem>
              <SelectItem value="No">No</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {data.runs_paid_ads === "Yes" && (
          <div>
            <Label className="mb-2 block">Which platforms?</Label>
            <div className="flex flex-wrap gap-2">
              {AD_PLATFORMS.map((p) => (
                <label key={p} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={data.ad_platforms.includes(p)} onCheckedChange={() => togglePlatform(p)} />
                  {p}
                </label>
              ))}
            </div>
          </div>
        )}

        <div>
          <Label>Monthly budget available for digital marketing (ads included)? *</Label>
          <Select value={data.monthly_budget} onValueChange={(v) => update({ monthly_budget: v })}>
            <SelectTrigger><SelectValue placeholder="Select budget range" /></SelectTrigger>
            <SelectContent>
              {BUDGET_RANGES.map((b) => (
                <SelectItem key={b} value={b}>{b}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Do you have an active email list? *</Label>
          <Select value={data.has_email_list} onValueChange={(v) => update({ has_email_list: v })}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Yes">Yes</SelectItem>
              <SelectItem value="No">No</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {data.has_email_list === "Yes" && (
          <div>
            <Label>Approx. email list size</Label>
            <Select value={data.email_list_size} onValueChange={(v) => update({ email_list_size: v })}>
              <SelectTrigger><SelectValue placeholder="Select size" /></SelectTrigger>
              <SelectContent>
                {EMAIL_LIST_SIZES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div>
          <Label>Do you have a website? *</Label>
          <Select value={data.has_website} onValueChange={(v) => update({ has_website: v })}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Yes">Yes</SelectItem>
              <SelectItem value="No">No</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {data.has_website === "Yes" && (
          <div>
            <Label>Website URL</Label>
            <Input value={data.website_url} onChange={(e) => update({ website_url: e.target.value })} placeholder="https://www.example.com" />
          </div>
        )}

        <div>
          <Label>Do you use a CRM or booking system? *</Label>
          <Select value={data.uses_crm} onValueChange={(v) => update({ uses_crm: v })}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Yes">Yes</SelectItem>
              <SelectItem value="No">No</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {data.uses_crm === "Yes" && (
          <div>
            <Label>Which CRM/booking system?</Label>
            <Input value={data.crm_name} onChange={(e) => update({ crm_name: e.target.value })} placeholder="e.g. HubSpot, Calendly..." />
          </div>
        )}
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button onClick={onNext} disabled={!canProceed}>Next</Button>
      </div>
    </div>
  );
}
