import { BriefingData, CLIENT_SOURCES, AD_PLATFORMS, BUDGET_RANGES, EMAIL_LIST_SIZES } from "@/lib/briefing-data";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { DynamicQuestion } from "@/pages/Briefing";

type Props = {
  data: BriefingData;
  update: (d: Partial<BriefingData>) => void;
  onNext: () => void;
  onBack: () => void;
  questions?: DynamicQuestion[];
};

export function BriefingStep2({ data, update, onNext, onBack, questions = [] }: Props) {
  const label = (fieldKey: string, fallback: string) => {
    const q = questions.find((q) => q.field_key === fieldKey);
    return q ? q.question_text : fallback;
  };

  const placeholder = (fieldKey: string, fallback: string) => {
    const q = questions.find((q) => q.field_key === fieldKey);
    return q?.placeholder || fallback;
  };

  const isActive = (fieldKey: string) => questions.length === 0 || questions.some((q) => q.field_key === fieldKey);

  const getOptions = (fieldKey: string, fallback: readonly string[]) => {
    const q = questions.find((q) => q.field_key === fieldKey);
    return (q?.options && Array.isArray(q.options) ? q.options : fallback) as string[];
  };

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
        {isActive("years_in_operation") && (
          <div>
            <Label>{label("years_in_operation", "Years in operation")} *</Label>
            <Input type="number" min={0} value={data.years_in_operation} onChange={(e) => update({ years_in_operation: e.target.value })} placeholder={placeholder("years_in_operation", "e.g. 5")} />
          </div>
        )}
        {isActive("monthly_new_clients") && (
          <div>
            <Label>{label("monthly_new_clients", "How many new clients/students do you get per month?")} *</Label>
            <Input type="number" min={0} value={data.monthly_new_clients} onChange={(e) => update({ monthly_new_clients: e.target.value })} placeholder={placeholder("monthly_new_clients", "e.g. 20")} />
          </div>
        )}

        {isActive("client_sources") && (
          <div>
            <Label className="mb-2 block">{label("client_sources", "How do most new clients find you today?")} *</Label>
            <div className="grid grid-cols-2 gap-2">
              {getOptions("client_sources", CLIENT_SOURCES).map((src) => (
                <label key={src} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={data.client_sources.includes(src)} onCheckedChange={() => toggleSource(src)} />
                  {src}
                </label>
              ))}
            </div>
          </div>
        )}

        {isActive("runs_paid_ads") && (
          <div>
            <Label>{label("runs_paid_ads", "Do you currently run paid ads?")} *</Label>
            <Select value={data.runs_paid_ads} onValueChange={(v) => update({ runs_paid_ads: v, ad_platforms: v === "No" ? [] : data.ad_platforms })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Yes">Yes</SelectItem>
                <SelectItem value="No">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {data.runs_paid_ads === "Yes" && isActive("ad_platforms") && (
          <div>
            <Label className="mb-2 block">{label("ad_platforms", "Which platforms?")}</Label>
            <div className="flex flex-wrap gap-2">
              {getOptions("ad_platforms", AD_PLATFORMS).map((p) => (
                <label key={p} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={data.ad_platforms.includes(p)} onCheckedChange={() => togglePlatform(p)} />
                  {p}
                </label>
              ))}
            </div>
          </div>
        )}

        {isActive("monthly_budget") && (
          <div>
            <Label>{label("monthly_budget", "Monthly budget available for digital marketing (ads included)?")} *</Label>
            <Select value={data.monthly_budget} onValueChange={(v) => update({ monthly_budget: v })}>
              <SelectTrigger><SelectValue placeholder={placeholder("monthly_budget", "Select budget range")} /></SelectTrigger>
              <SelectContent>
                {getOptions("monthly_budget", BUDGET_RANGES).map((b) => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {isActive("has_email_list") && (
          <div>
            <Label>{label("has_email_list", "Do you have an active email list?")} *</Label>
            <Select value={data.has_email_list} onValueChange={(v) => update({ has_email_list: v })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Yes">Yes</SelectItem>
                <SelectItem value="No">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {data.has_email_list === "Yes" && isActive("email_list_size") && (
          <div>
            <Label>{label("email_list_size", "Approx. email list size")}</Label>
            <Select value={data.email_list_size} onValueChange={(v) => update({ email_list_size: v })}>
              <SelectTrigger><SelectValue placeholder={placeholder("email_list_size", "Select size")} /></SelectTrigger>
              <SelectContent>
                {getOptions("email_list_size", EMAIL_LIST_SIZES).map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {isActive("has_website") && (
          <div>
            <Label>{label("has_website", "Do you have a website?")} *</Label>
            <Select value={data.has_website} onValueChange={(v) => update({ has_website: v })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Yes">Yes</SelectItem>
                <SelectItem value="No">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {data.has_website === "Yes" && isActive("website_url") && (
          <div>
            <Label>{label("website_url", "Website URL")}</Label>
            <Input value={data.website_url} onChange={(e) => update({ website_url: e.target.value })} placeholder={placeholder("website_url", "https://www.example.com")} />
          </div>
        )}

        {isActive("uses_crm") && (
          <div>
            <Label>{label("uses_crm", "Do you use a CRM or booking system?")} *</Label>
            <Select value={data.uses_crm} onValueChange={(v) => update({ uses_crm: v })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Yes">Yes</SelectItem>
                <SelectItem value="No">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {data.uses_crm === "Yes" && isActive("crm_name") && (
          <div>
            <Label>{label("crm_name", "Which CRM/booking system?")}</Label>
            <Input value={data.crm_name} onChange={(e) => update({ crm_name: e.target.value })} placeholder={placeholder("crm_name", "e.g. HubSpot, Calendly...")} />
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
