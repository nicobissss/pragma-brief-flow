import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Plus, Trash2, GripVertical, Copy, Sparkles, Loader2,
  ChevronDown, ChevronRight, CheckCircle2,
} from "lucide-react";

type KickoffQuestion = {
  id: string;
  client_id: string;
  category: string;
  question_text: string;
  is_checked: boolean;
  order_index: number;
  created_at: string;
};

const DEFAULT_CATEGORIES = [
  "Business & offer details",
  "Current assets",
  "Technical setup",
  "Goals & KPIs",
  "Communication preferences",
];

function generateDefaultQuestions(
  vertical: string,
  subNiche: string,
  clientId: string
): Omit<KickoffQuestion, "id" | "created_at">[] {
  const base: Record<string, string[]> = {
    "Business & offer details": [
      "Describe your main service/product in one sentence.",
      "What's your unique selling proposition vs competitors?",
      "What's your average ticket / price point?",
      "Do you offer packages or individual services?",
      `What makes ${subNiche} your focus area?`,
    ],
    "Current assets": [
      "Do you have existing brand guidelines (logo, colors, fonts)?",
      "Do you have professional photos of your team/space/products?",
      "Do you have any existing copy (website text, brochures)?",
      "Do you have existing email templates or sequences?",
      "What's your current website URL (if any)?",
    ],
    "Technical setup": [
      "Do you have domain access for landing pages?",
      "What CRM or booking system do you currently use?",
      "Do you have a checkout or payment system?",
      "Do you have a WhatsApp Business number?",
      "Do you have Google Business Profile set up?",
    ],
    "Goals & KPIs": [
      "What's your primary goal for the first 3 months?",
      "How many new clients/sales do you want per month?",
      "What's your target revenue increase?",
      "What metrics are most important to you?",
      "Any seasonal peaks or events to plan around?",
    ],
    "Communication preferences": [
      "What language/tone should we use in marketing materials?",
      "Who will be the main point of contact for approvals?",
      "How quickly can you review and approve assets?",
      "Do you prefer formal or casual communication?",
      "Any words or phrases you want us to always use or avoid?",
    ],
  };

  if (vertical.toLowerCase().includes("salud") || vertical.toLowerCase().includes("estética")) {
    base["Business & offer details"].push("What certifications or licenses do your practitioners hold?");
    base["Business & offer details"].push("Do you offer before/after consultations?");
  } else if (vertical.toLowerCase().includes("learning") || vertical.toLowerCase().includes("curso")) {
    base["Business & offer details"].push("What format are your courses (live, recorded, hybrid)?");
    base["Business & offer details"].push("Do you offer certifications or diplomas?");
  } else if (vertical.toLowerCase().includes("deporte") || vertical.toLowerCase().includes("sport")) {
    base["Business & offer details"].push("What sports/activities do you offer?");
    base["Business & offer details"].push("Do you have membership plans or pay-per-session?");
  }

  const items: Omit<KickoffQuestion, "id" | "created_at">[] = [];
  let idx = 0;
  for (const [cat, qs] of Object.entries(base)) {
    for (const q of qs) {
      items.push({
        client_id: clientId,
        category: cat,
        question_text: q,
        is_checked: false,
        order_index: idx++,
      });
    }
  }
  return items;
}

interface Props {
  clientId: string;
  clientName: string;
  vertical: string;
  subNiche: string;
}

export default function KickoffQuestionsManager({ clientId, clientName, vertical, subNiche }: Props) {
  const [questions, setQuestions] = useState<KickoffQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<KickoffQuestion | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateConfirm, setRegenerateConfirm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const editRef = useRef<HTMLInputElement>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const fetchQuestions = useCallback(async () => {
    const { data } = await (supabase.from("kickoff_questions" as any) as any)
      .select("*")
      .eq("client_id", clientId)
      .order("order_index");
    const items = (data || []) as KickoffQuestion[];
    setQuestions(items);
    setLoading(false);

    // If no questions exist, seed defaults
    if (items.length === 0) {
      const defaults = generateDefaultQuestions(vertical, subNiche, clientId);
      const { data: inserted } = await (supabase.from("kickoff_questions" as any) as any)
        .insert(defaults)
        .select("*");
      if (inserted) setQuestions(inserted as KickoffQuestion[]);
    }
  }, [clientId, vertical, subNiche]);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  // Group by category
  const grouped = questions.reduce<Record<string, KickoffQuestion[]>>((acc, q) => {
    (acc[q.category] = acc[q.category] || []).push(q);
    return acc;
  }, {});

  // Sort categories: default order first, then custom
  const categoryOrder = Object.keys(grouped).sort((a, b) => {
    const ai = DEFAULT_CATEGORIES.indexOf(a);
    const bi = DEFAULT_CATEGORIES.indexOf(b);
    if (ai >= 0 && bi >= 0) return ai - bi;
    if (ai >= 0) return -1;
    if (bi >= 0) return 1;
    return a.localeCompare(b);
  });

  const totalQ = questions.length;
  const checkedQ = questions.filter((q) => q.is_checked).length;
  const progressPct = totalQ > 0 ? (checkedQ / totalQ) * 100 : 0;
  const allDone = totalQ > 0 && checkedQ === totalQ;

  const toggleCollapse = (cat: string) => {
    setCollapsedCats((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const toggleChecked = async (q: KickoffQuestion) => {
    const newVal = !q.is_checked;
    setQuestions((prev) => prev.map((x) => x.id === q.id ? { ...x, is_checked: newVal } : x));
    await (supabase.from("kickoff_questions" as any) as any)
      .update({ is_checked: newVal })
      .eq("id", q.id);
  };

  const startEdit = (q: KickoffQuestion) => {
    setEditingId(q.id);
    setEditText(q.question_text);
    setTimeout(() => editRef.current?.focus(), 50);
  };

  const saveEdit = async (id: string) => {
    if (!editText.trim()) return;
    setQuestions((prev) => prev.map((q) => q.id === id ? { ...q, question_text: editText.trim() } : q));
    setEditingId(null);
    await (supabase.from("kickoff_questions" as any) as any)
      .update({ question_text: editText.trim() })
      .eq("id", id);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setQuestions((prev) => prev.filter((q) => q.id !== deleteTarget.id));
    await (supabase.from("kickoff_questions" as any) as any)
      .delete().eq("id", deleteTarget.id);
    setDeleteTarget(null);
    toast.success("Question removed");
  };

  const addQuestion = async (category: string) => {
    const catQuestions = grouped[category] || [];
    const maxOrder = catQuestions.length > 0 ? Math.max(...catQuestions.map((q) => q.order_index)) : 0;
    const newQ = {
      client_id: clientId,
      category,
      question_text: "",
      is_checked: false,
      order_index: maxOrder + 1,
    };
    const { data } = await (supabase.from("kickoff_questions" as any) as any)
      .insert(newQ).select("*").single();
    if (data) {
      const q = data as KickoffQuestion;
      setQuestions((prev) => [...prev, q]);
      setEditingId(q.id);
      setEditText("");
      setTimeout(() => editRef.current?.focus(), 50);
    }
  };

  const addCategory = async () => {
    if (!newCategoryName.trim()) return;
    setShowNewCategory(false);
    const catName = newCategoryName.trim();
    setNewCategoryName("");
    // Add one empty question to the new category
    const newQ = {
      client_id: clientId,
      category: catName,
      question_text: "",
      is_checked: false,
      order_index: 0,
    };
    const { data } = await (supabase.from("kickoff_questions" as any) as any)
      .insert(newQ).select("*").single();
    if (data) {
      const q = data as KickoffQuestion;
      setQuestions((prev) => [...prev, q]);
      setEditingId(q.id);
      setEditText("");
      setTimeout(() => editRef.current?.focus(), 50);
    }
  };

  const copyAllQuestions = () => {
    const lines = [`KICKOFF QUESTIONS — ${clientName}`, ""];
    for (const cat of categoryOrder) {
      lines.push(`${cat}:`);
      for (const q of grouped[cat].sort((a, b) => a.order_index - b.order_index)) {
        if (q.question_text.trim()) {
          lines.push(`• ${q.question_text}`);
        }
      }
      lines.push("");
    }
    navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Questions copied to clipboard!");
  };

  const handleRegenerate = async () => {
    setRegenerateConfirm(false);
    setRegenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-kickoff-prompts", {
        body: { client_id: clientId, regenerate_questions: true },
      });
      if (error) throw error;

      // AI returns categories with questions - merge with manual ones
      const aiQuestions: { category: string; questions: string[] }[] = data?.kickoff_questions || [];

      if (aiQuestions.length === 0) {
        // Fallback: regenerate defaults
        const defaults = generateDefaultQuestions(vertical, subNiche, clientId);
        // Delete AI-generated, keep manually added (those not in defaults text)
        const manualQuestions = questions.filter((q) =>
          !generateDefaultQuestions(vertical, subNiche, clientId)
            .some((d) => d.question_text === q.question_text)
        );
        
        await (supabase.from("kickoff_questions" as any) as any)
          .delete().eq("client_id", clientId);

        const toInsert = [
          ...defaults,
          ...manualQuestions.map((q) => ({
            client_id: clientId,
            category: q.category,
            question_text: q.question_text,
            is_checked: q.is_checked,
            order_index: q.order_index + defaults.length,
          })),
        ];
        const { data: inserted } = await (supabase.from("kickoff_questions" as any) as any)
          .insert(toInsert).select("*");
        if (inserted) setQuestions(inserted as KickoffQuestion[]);
      } else {
        // Merge: keep manually-added questions, replace AI-generated ones
        const manualQuestions = questions.filter((q) => q.question_text.trim() !== "" &&
          !questions.some((orig) => orig.id === q.id && generateDefaultQuestions(vertical, subNiche, clientId)
            .some((d) => d.question_text === orig.question_text))
        );

        await (supabase.from("kickoff_questions" as any) as any)
          .delete().eq("client_id", clientId);

        let idx = 0;
        const toInsert: Omit<KickoffQuestion, "id" | "created_at">[] = [];
        for (const group of aiQuestions) {
          for (const qt of group.questions) {
            toInsert.push({
              client_id: clientId,
              category: group.category,
              question_text: qt,
              is_checked: false,
              order_index: idx++,
            });
          }
        }
        // Re-add manual ones
        for (const mq of manualQuestions) {
          if (!toInsert.some((t) => t.question_text === mq.question_text)) {
            toInsert.push({
              client_id: clientId,
              category: mq.category,
              question_text: mq.question_text,
              is_checked: mq.is_checked,
              order_index: idx++,
            });
          }
        }

        const { data: inserted } = await (supabase.from("kickoff_questions" as any) as any)
          .insert(toInsert).select("*");
        if (inserted) setQuestions(inserted as KickoffQuestion[]);
      }

      toast.success("Questions regenerated!");
    } catch (e: any) {
      toast.error(e.message || "Failed to regenerate");
    } finally {
      setRegenerating(false);
    }
  };

  // Drag-drop within category
  const handleDragStart = (id: string) => setDraggedId(id);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = async (targetId: string, category: string) => {
    if (!draggedId || draggedId === targetId) { setDraggedId(null); return; }
    const catQ = (grouped[category] || []).sort((a, b) => a.order_index - b.order_index);
    const dragIdx = catQ.findIndex((q) => q.id === draggedId);
    const dropIdx = catQ.findIndex((q) => q.id === targetId);
    if (dragIdx === -1 || dropIdx === -1) { setDraggedId(null); return; }

    const reordered = [...catQ];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(dropIdx, 0, moved);

    const updates = reordered.map((q, i) => ({ id: q.id, order_index: i }));
    setQuestions((prev) => {
      const others = prev.filter((q) => q.category !== category);
      return [...others, ...reordered.map((q, i) => ({ ...q, order_index: i }))]
        .sort((a, b) => a.order_index - b.order_index);
    });

    for (const u of updates) {
      await (supabase.from("kickoff_questions" as any) as any)
        .update({ order_index: u.order_index }).eq("id", u.id);
    }
    setDraggedId(null);
  };

  if (loading) return <div className="text-muted-foreground text-sm">Loading questions...</div>;

  return (
    <div className="bg-card rounded-lg border border-border p-6 mb-6">
      <div className="mb-4">
        <h3 className="font-semibold text-foreground text-base">Kickoff call questions</h3>
        <p className="text-sm text-muted-foreground">
          Customize these questions for this specific client before the call.
        </p>
      </div>

      {/* Top actions */}
      <div className="flex items-center gap-2 mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setRegenerateConfirm(true)}
          disabled={regenerating}
        >
          {regenerating ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> Regenerating...</>
          ) : (
            <><Sparkles className="w-3.5 h-3.5 mr-1" /> Regenerate with AI</>
          )}
        </Button>
        <Button variant="outline" size="sm" onClick={copyAllQuestions}>
          <Copy className="w-3.5 h-3.5 mr-1" /> Copy all questions
        </Button>
      </div>

      {/* Question groups */}
      <div className="space-y-3">
        {categoryOrder.map((cat) => {
          const catQuestions = grouped[cat].sort((a, b) => a.order_index - b.order_index);
          const isOpen = !collapsedCats.has(cat);
          const catChecked = catQuestions.filter((q) => q.is_checked).length;

          return (
            <Collapsible key={cat} open={isOpen} onOpenChange={() => toggleCollapse(cat)}>
              <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-1.5 px-2 rounded-md hover:bg-secondary/50 transition-colors">
                {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                <span className="text-sm font-medium text-foreground">{cat}</span>
                <Badge variant="secondary" className="text-[10px] ml-auto">
                  {catChecked}/{catQuestions.length}
                </Badge>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-1 ml-2 space-y-1">
                {catQuestions.map((q) => (
                  <div
                    key={q.id}
                    draggable
                    onDragStart={() => handleDragStart(q.id)}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(q.id, cat)}
                    className={`flex items-center gap-2 p-2 rounded-md border border-transparent hover:border-border transition-all group ${
                      draggedId === q.id ? "opacity-50" : ""
                    }`}
                  >
                    <Checkbox
                      checked={q.is_checked}
                      onCheckedChange={() => toggleChecked(q)}
                      className="shrink-0"
                    />
                    <div className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0">
                      <GripVertical className="w-3.5 h-3.5" />
                    </div>
                    {editingId === q.id ? (
                      <Input
                        ref={editRef}
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onBlur={() => saveEdit(q.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit(q.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        className="h-7 text-sm flex-1"
                        placeholder="Type your question..."
                      />
                    ) : (
                      <span
                        onClick={() => startEdit(q)}
                        className={`text-sm flex-1 cursor-text ${
                          q.is_checked ? "text-muted-foreground line-through" : "text-foreground"
                        } ${!q.question_text.trim() ? "italic text-muted-foreground" : ""}`}
                      >
                        {q.question_text.trim() || "Click to edit..."}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive shrink-0"
                      onClick={() => {
                        if (q.is_checked) {
                          setDeleteTarget(q);
                        } else {
                          setQuestions((prev) => prev.filter((x) => x.id !== q.id));
                          (supabase.from("kickoff_questions" as any) as any)
                            .delete().eq("id", q.id);
                        }
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground hover:text-foreground ml-6"
                  onClick={() => addQuestion(cat)}
                >
                  <Plus className="w-3 h-3 mr-1" /> Add question
                </Button>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>

      {/* Add custom category */}
      <div className="mt-3">
        {showNewCategory ? (
          <div className="flex items-center gap-2">
            <Input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Category name..."
              className="h-8 text-sm max-w-xs"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") addCategory();
                if (e.key === "Escape") setShowNewCategory(false);
              }}
            />
            <Button size="sm" variant="outline" onClick={addCategory} disabled={!newCategoryName.trim()}>
              Add
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowNewCategory(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => setShowNewCategory(true)}
          >
            <Plus className="w-3 h-3 mr-1" /> Add custom category
          </Button>
        )}
      </div>

      {/* Progress */}
      <div className="mt-5 pt-4 border-t border-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">
            {checkedQ} of {totalQ} questions asked
          </span>
          <span className="text-xs text-muted-foreground">
            {Math.round(progressPct)}%
          </span>
        </div>
        <Progress value={progressPct} className="h-2" />
        {allDone && (
          <div className="mt-3 flex items-center gap-2 text-sm font-medium text-[hsl(var(--status-approved))]">
            <CheckCircle2 className="w-4 h-4" />
            All questions covered — ready to upload transcript
          </div>
        )}
      </div>

      {/* Regenerate confirmation */}
      <AlertDialog open={regenerateConfirm} onOpenChange={setRegenerateConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate questions with AI?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace all current questions with AI-generated ones based on the client's vertical, sub-niche, and briefing answers. Manually added questions will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRegenerate}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation for checked questions */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete question?</AlertDialogTitle>
            <AlertDialogDescription>
              This question has already been marked as asked. Are you sure you want to remove it?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
