import { BriefingData, MAIN_GOALS } from "@/lib/briefing-data";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

type Props = {
  data: BriefingData;
  update: (d: Partial<BriefingData>) => void;
  onNext: () => void;
  onBack: () => void;
};

export function BriefingStep3({ data, update, onNext, onBack }: Props) {
  const canProceed = data.main_goal && data.average_ticket && data.biggest_challenge && data.differentiator;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Your goals</h2>
        <p className="text-muted-foreground text-sm mt-1">What are you looking to achieve?</p>
      </div>

      <div className="space-y-4">
        <div>
          <Label>What is your main goal right now? *</Label>
          <Select value={data.main_goal} onValueChange={(v) => update({ main_goal: v })}>
            <SelectTrigger><SelectValue placeholder="Select your main goal" /></SelectTrigger>
            <SelectContent>
              {MAIN_GOALS.map((g) => (
                <SelectItem key={g} value={g}>{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Average ticket / monthly fee per client *</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              min={0}
              value={data.average_ticket}
              onChange={(e) => update({ average_ticket: e.target.value })}
              placeholder="e.g. 150"
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

        <div>
          <Label>Biggest challenge getting new clients? * <span className="text-muted-foreground">(max 300 chars)</span></Label>
          <Textarea
            value={data.biggest_challenge}
            onChange={(e) => update({ biggest_challenge: e.target.value.slice(0, 300) })}
            placeholder="Tell us about your biggest challenge..."
            maxLength={300}
          />
          <span className="text-xs text-muted-foreground">{data.biggest_challenge.length}/300</span>
        </div>

        <div>
          <Label>What makes you different from competitors? * <span className="text-muted-foreground">(max 300 chars)</span></Label>
          <Textarea
            value={data.differentiator}
            onChange={(e) => update({ differentiator: e.target.value.slice(0, 300) })}
            placeholder="Your unique value proposition..."
            maxLength={300}
          />
          <span className="text-xs text-muted-foreground">{data.differentiator.length}/300</span>
        </div>

        <div>
          <Label>Anything else you want us to know? <span className="text-muted-foreground">(optional)</span></Label>
          <Textarea
            value={data.additional_info}
            onChange={(e) => update({ additional_info: e.target.value })}
            placeholder="Any additional context..."
          />
        </div>
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button onClick={onNext} disabled={!canProceed}>Review & Submit</Button>
      </div>
    </div>
  );
}
