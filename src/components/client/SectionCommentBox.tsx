import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Check } from "lucide-react";

interface SectionCommentBoxProps {
  sectionName: string;
  value: string;
  onChange: (value: string) => void;
  savedAt?: string;
}

export function SectionCommentBox({ sectionName, value, onChange, savedAt }: SectionCommentBoxProps) {
  const [open, setOpen] = useState(!!value);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-2"
      >
        <span>💬</span>
        <span>Comment on {sectionName.toLowerCase()}</span>
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span>💬</span>
        <span className="font-medium">{sectionName}</span>
      </div>
      <Textarea
        placeholder={`Your feedback on the ${sectionName.toLowerCase()}...`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[60px] text-sm"
      />
      {!value.trim() && (
        <button
          onClick={() => setOpen(false)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      )}
    </div>
  );
}
