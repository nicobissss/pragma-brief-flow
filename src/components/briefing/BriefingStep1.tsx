import { BriefingData, VERTICALS, SUB_NICHES, MARKETS } from "@/lib/briefing-data";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { DynamicQuestion } from "@/pages/Briefing";

type Props = {
  data: BriefingData;
  update: (d: Partial<BriefingData>) => void;
  onNext: () => void;
  questions?: DynamicQuestion[];
};

export function BriefingStep1({ data, update, onNext, questions = [] }: Props) {
  const canProceed = data.name && data.company_name && data.email && data.market && data.vertical && data.sub_niche;

  const label = (fieldKey: string, fallback: string) => {
    const q = questions.find((q) => q.field_key === fieldKey);
    return q ? q.question_text : fallback;
  };

  const placeholder = (fieldKey: string, fallback: string) => {
    const q = questions.find((q) => q.field_key === fieldKey);
    return q?.placeholder || fallback;
  };

  const isActive = (fieldKey: string) => questions.length === 0 || questions.some((q) => q.field_key === fieldKey);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">About your business</h2>
        <p className="text-muted-foreground text-sm mt-1">Tell us about you and your company.</p>
      </div>

      <div className="space-y-4">
        {isActive("name") && (
          <div>
            <Label htmlFor="name">{label("name", "Full name")} *</Label>
            <Input id="name" value={data.name} onChange={(e) => update({ name: e.target.value })} placeholder={placeholder("name", "Your full name")} />
          </div>
        )}
        {isActive("company_name") && (
          <div>
            <Label htmlFor="company">{label("company_name", "Company name")} *</Label>
            <Input id="company" value={data.company_name} onChange={(e) => update({ company_name: e.target.value })} placeholder={placeholder("company_name", "Company name")} />
          </div>
        )}
        {isActive("email") && (
          <div>
            <Label htmlFor="email">{label("email", "Email")} *</Label>
            <Input id="email" type="email" value={data.email} onChange={(e) => update({ email: e.target.value })} placeholder={placeholder("email", "your@email.com")} />
          </div>
        )}
        {isActive("phone") && (
          <div>
            <Label htmlFor="phone">{label("phone", "Phone")} (optional)</Label>
            <Input id="phone" value={data.phone} onChange={(e) => update({ phone: e.target.value })} placeholder={placeholder("phone", "+34 600 000 000")} />
          </div>
        )}

        {isActive("market") && (
          <div>
            <Label>{label("market", "Market")} *</Label>
            <Select value={data.market} onValueChange={(v) => update({ market: v })}>
              <SelectTrigger><SelectValue placeholder={placeholder("market", "Select market")} /></SelectTrigger>
              <SelectContent>
                {MARKETS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {isActive("vertical") && (
          <div>
            <Label>{label("vertical", "Vertical")} *</Label>
            <Select value={data.vertical} onValueChange={(v) => update({ vertical: v, sub_niche: "" })}>
              <SelectTrigger><SelectValue placeholder={placeholder("vertical", "Select vertical")} /></SelectTrigger>
              <SelectContent>
                {VERTICALS.map((v) => (
                  <SelectItem key={v} value={v}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {data.vertical && isActive("sub_niche") && (
          <div>
            <Label>{label("sub_niche", "Sub-niche")} *</Label>
            <Select value={data.sub_niche} onValueChange={(v) => update({ sub_niche: v })}>
              <SelectTrigger><SelectValue placeholder={placeholder("sub_niche", "Select sub-niche")} /></SelectTrigger>
              <SelectContent>
                {(SUB_NICHES[data.vertical] || []).map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="flex justify-end pt-4">
        <Button onClick={onNext} disabled={!canProceed} size="lg">
          Next
        </Button>
      </div>
    </div>
  );
}
