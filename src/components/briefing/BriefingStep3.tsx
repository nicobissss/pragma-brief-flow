import { BriefingData, MAIN_GOALS } from "@/lib/briefing-data";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { DynamicQuestion } from "@/pages/Briefing";

type Props = {
  data: BriefingData;
  update: (d: Partial<BriefingData>) => void;
  onNext: () => void;
  onBack: () => void;
  questions?: DynamicQuestion[];
};

export function BriefingStep3({ data, update, onNext, onBack, questions = [] }: Props) {
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

  const canProceed = data.main_goal && data.average_ticket && data.biggest_challenge && data.differentiator;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Your goals</h2>
        <p className="text-muted-foreground text-sm mt-1">What are you looking to achieve?</p>
      </div>

      <div className="space-y-4">
        {isActive("main_goal") && (
          <div>
            <Label>{label("main_goal", "What is your main goal right now?")} *</Label>
            <Select value={data.main_goal} onValueChange={(v) => update({ main_goal: v })}>
              <SelectTrigger><SelectValue placeholder={placeholder("main_goal", "Select your main goal")} /></SelectTrigger>
              <SelectContent>
                {getOptions("main_goal", MAIN_GOALS).map((g) => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {isActive("average_ticket") && (
          <div>
            <Label>{label("average_ticket", "Average ticket / monthly fee per client")} *</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                min={0}
                value={data.average_ticket}
                onChange={(e) => update({ average_ticket: e.target.value })}
                placeholder={placeholder("average_ticket", "e.g. 150")}
                className="flex-1"
              />
              <Select value={data.ticket_currency} onValueChange={(v) => update({ ticket_currency: v })}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {isActive("biggest_challenge") && (
          <div>
            <Label>{label("biggest_challenge", "Biggest challenge getting new clients?")} * <span className="text-muted-foreground">(max 300 chars)</span></Label>
            <Textarea
              value={data.biggest_challenge}
              onChange={(e) => update({ biggest_challenge: e.target.value.slice(0, 300) })}
              placeholder={placeholder("biggest_challenge", "Tell us about your biggest challenge...")}
              maxLength={300}
            />
            <span className="text-xs text-muted-foreground">{data.biggest_challenge.length}/300</span>
          </div>
        )}

        {isActive("differentiator") && (
          <div>
            <Label>{label("differentiator", "What makes you different from competitors?")} * <span className="text-muted-foreground">(max 300 chars)</span></Label>
            <Textarea
              value={data.differentiator}
              onChange={(e) => update({ differentiator: e.target.value.slice(0, 300) })}
              placeholder={placeholder("differentiator", "Your unique value proposition...")}
              maxLength={300}
            />
            <span className="text-xs text-muted-foreground">{data.differentiator.length}/300</span>
          </div>
        )}

        {isActive("additional_info") && (
          <div>
            <Label>{label("additional_info", "Anything else you want us to know?")} <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea
              value={data.additional_info}
              onChange={(e) => update({ additional_info: e.target.value })}
              placeholder={placeholder("additional_info", "Any additional context...")}
            />
          </div>
        )}
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button onClick={onNext} disabled={!canProceed}>Review & Submit</Button>
      </div>
    </div>
  );
}
