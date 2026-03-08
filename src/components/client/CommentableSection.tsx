import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StickyNote, X } from "lucide-react";

interface CommentableSection {
  name: string;
  children: React.ReactNode;
}

interface CommentableSectionProps extends CommentableSection {
  comment: string;
  onComment: (text: string) => void;
}

export function CommentableSection({ name, children, comment, onComment }: CommentableSectionProps) {
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment);
  const popoverRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLDivElement>(null);

  const hasComment = comment.trim().length > 0;

  useEffect(() => { setDraft(comment); }, [comment]);

  const openEditor = () => {
    setDraft(comment);
    setEditing(true);
  };

  const save = () => {
    onComment(draft.trim());
    setEditing(false);
  };

  const cancel = () => {
    setDraft(comment);
    setEditing(false);
  };

  // Close on click outside
  useEffect(() => {
    if (!editing) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
          sectionRef.current && !sectionRef.current.contains(e.target as Node)) {
        cancel();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [editing]);

  return (
    <div
      ref={sectionRef}
      className="relative group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Section content with highlight effect */}
      <div
        className={`rounded-lg p-3 transition-all duration-150 border-2 ${
          editing
            ? "border-primary/40 bg-primary/5"
            : hovered
              ? "border-[hsl(210,100%,56%)]/20 bg-[hsl(210,100%,56%)]/5"
              : hasComment
                ? "border-[hsl(45,100%,60%)]/30 bg-[hsl(45,100%,60%)]/5"
                : "border-transparent"
        }`}
      >
        {/* Section label */}
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{name}</span>
          <div className="flex items-center gap-1">
            {/* Sticky note indicator for existing comment */}
            {hasComment && !editing && (
              <button
                onClick={openEditor}
                className="relative group/sticky"
                title={comment}
              >
                <StickyNote className="w-4 h-4 text-[hsl(45,100%,45%)] fill-[hsl(45,100%,85%)]" />
                {/* Tooltip */}
                <div className="absolute right-0 top-6 z-50 hidden group-hover/sticky:block w-64 p-2 rounded-md bg-card border border-border shadow-lg text-xs text-foreground whitespace-pre-wrap">
                  {comment}
                </div>
              </button>
            )}
            {/* Comment trigger icon */}
            {(hovered || editing) && !hasComment && (
              <button
                onClick={openEditor}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-secondary"
              >
                <span>💬</span>
              </button>
            )}
          </div>
        </div>

        {/* Actual content */}
        <div>{children}</div>
      </div>

      {/* Comment popover */}
      {editing && (
        <div
          ref={popoverRef}
          className="mt-2 p-3 rounded-lg border border-border bg-card shadow-lg space-y-2 animate-in fade-in-0 slide-in-from-top-1 duration-150"
        >
          <p className="text-xs font-medium text-muted-foreground">💬 Comment on "{name}"</p>
          <Textarea
            placeholder="What would you like to change?"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="min-h-[70px] text-sm"
            autoFocus
          />
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={save} disabled={!draft.trim() && !hasComment}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={cancel}>Cancel</Button>
            {hasComment && (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive ml-auto"
                onClick={() => { onComment(""); setEditing(false); }}
              >
                <X className="w-3 h-3 mr-1" /> Remove
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
