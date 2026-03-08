import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, Phone } from "lucide-react";

type CallStatus = "not_scheduled" | "scheduled" | "done_positive" | "done_negative" | "no_show";

const STATUS_OPTIONS: { value: CallStatus; label: string; icon: string }[] = [
  { value: "not_scheduled", label: "Not scheduled", icon: "⬜" },
  { value: "scheduled", label: "Scheduled", icon: "📅" },
  { value: "done_positive", label: "Done - Positive", icon: "✅" },
  { value: "done_negative", label: "Done - Negative", icon: "❌" },
  { value: "no_show", label: "No show", icon: "👻" },
];

interface Props {
  prospectId: string;
  callStatus: CallStatus;
  callScheduledAt: string | null;
  callNotes: string | null;
  followUpDate: string | null;
  onUpdate: (fields: Record<string, any>) => void;
}

export default function SalesCallCard({
  prospectId,
  callStatus,
  callScheduledAt,
  callNotes,
  followUpDate,
  onUpdate,
}: Props) {
  const [status, setStatus] = useState<CallStatus>(callStatus);
  const [scheduledAt, setScheduledAt] = useState<string>(callScheduledAt || "");
  const [notes, setNotes] = useState(callNotes || "");
  const [followUp, setFollowUp] = useState<Date | undefined>(
    followUpDate ? new Date(followUpDate) : undefined
  );
  const [saving, setSaving] = useState(false);

  const save = async (fields: Record<string, any>) => {
    setSaving(true);
    const { error } = await supabase
      .from("prospects")
      .update(fields as any)
      .eq("id", prospectId);
    setSaving(false);
    if (error) {
      toast.error("Failed to save");
      return;
    }
    onUpdate(fields);
  };

  const handleStatusChange = async (newStatus: CallStatus) => {
    setStatus(newStatus);
    await save({ call_status: newStatus });
  };

  const handleScheduleSave = async () => {
    if (!scheduledAt) return;
    await save({ call_scheduled_at: scheduledAt });
  };

  const handleFollowUpChange = async (date: Date | undefined) => {
    setFollowUp(date);
    await save({ follow_up_date: date ? format(date, "yyyy-MM-dd") : null });
  };

  const handleNotesBlur = async () => {
    await save({ call_notes: notes || null });
  };

  const showSchedule = status === "scheduled";
  const showFollowUp = status === "no_show" || status === "done_negative";

  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
        <Phone className="w-5 h-5 text-primary" />
        Sales Call
      </h3>

      {/* ROW 1: Status pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleStatusChange(opt.value)}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
              status === opt.value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-secondary/50 text-muted-foreground border-border hover:bg-secondary"
            )}
          >
            {opt.icon} {opt.label}
          </button>
        ))}
      </div>

      {/* ROW 2: Schedule date/time */}
      {showSchedule && (
        <div className="mb-4 p-3 rounded-lg bg-secondary/30 border border-border">
          <label className="text-xs text-muted-foreground mb-2 block">Call scheduled for</label>
          <div className="flex gap-2 items-center">
            <Input
              type="datetime-local"
              value={scheduledAt ? scheduledAt.slice(0, 16) : ""}
              onChange={(e) => setScheduledAt(e.target.value ? new Date(e.target.value).toISOString() : "")}
              className="max-w-xs"
            />
            <Button size="sm" onClick={handleScheduleSave} disabled={!scheduledAt || saving}>
              Save
            </Button>
          </div>
        </div>
      )}

      {/* ROW 3: Follow up date */}
      {showFollowUp && (
        <div className="mb-4 p-3 rounded-lg bg-secondary/30 border border-border">
          <label className="text-xs text-muted-foreground mb-2 block">Follow up on</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[240px] justify-start text-left font-normal",
                  !followUp && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {followUp ? format(followUp, "PPP") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={followUp}
                onSelect={handleFollowUpChange}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* ROW 4: Notes */}
      <div>
        <label className="text-xs text-muted-foreground mb-2 block">Call notes (internal only)</label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleNotesBlur}
          placeholder="What was discussed, objections raised, next steps agreed..."
          className="min-h-[80px]"
        />
      </div>
    </div>
  );
}
