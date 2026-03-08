import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, GripVertical, Loader2, X } from "lucide-react";

type BriefingQuestion = {
  id: string;
  step: number;
  vertical: string;
  field_key: string;
  question_text: string;
  question_type: string;
  options: string[] | null;
  placeholder: string | null;
  is_required: boolean;
  is_active: boolean;
  order_index: number;
  created_at: string;
};

const TABS = [
  { key: "all", label: "All steps" },
  { key: "step1", label: "Step 1" },
  { key: "step2", label: "Step 2" },
  { key: "step3", label: "Step 3" },
  { key: "step3_salud", label: "Step 3 — Salud" },
  { key: "step3_elearning", label: "Step 3 — E-Learning" },
  { key: "step3_deporte", label: "Step 3 — Deporte" },
];

const TYPE_BADGES: Record<string, string> = {
  text: "bg-primary/10 text-primary",
  select: "bg-[hsl(var(--status-proposal-ready))]/10 text-[hsl(var(--status-proposal-ready))]",
  multiselect: "bg-[hsl(var(--status-call-scheduled))]/10 text-[hsl(var(--status-call-scheduled))]",
  number: "bg-[hsl(var(--status-approved))]/10 text-[hsl(var(--status-approved))]",
  url: "bg-[hsl(var(--status-pending-review))]/10 text-[hsl(var(--status-pending-review))]",
  boolean: "bg-[hsl(var(--status-change-requested))]/10 text-[hsl(var(--status-change-requested))]",
};

function filterQuestions(questions: BriefingQuestion[], tabKey: string): BriefingQuestion[] {
  switch (tabKey) {
    case "all": return questions;
    case "step1": return questions.filter((q) => q.step === 1);
    case "step2": return questions.filter((q) => q.step === 2);
    case "step3": return questions.filter((q) => q.step === 3 && q.vertical === "all");
    case "step3_salud": return questions.filter((q) => q.step === 3 && q.vertical === "salud");
    case "step3_elearning": return questions.filter((q) => q.step === 3 && q.vertical === "elearning");
    case "step3_deporte": return questions.filter((q) => q.step === 3 && q.vertical === "deporte");
    default: return questions;
  }
}

// ─── Options Editor ─────────────────────────────────────
function OptionsEditor({ options, onChange }: { options: string[]; onChange: (o: string[]) => void }) {
  const [newOpt, setNewOpt] = useState("");

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Options</p>
      <div className="space-y-1">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={opt}
              onChange={(e) => {
                const next = [...options];
                next[i] = e.target.value;
                onChange(next);
              }}
              className="h-8 text-sm"
            />
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => onChange(options.filter((_, j) => j !== i))}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="New option..."
          value={newOpt}
          onChange={(e) => setNewOpt(e.target.value)}
          className="h-8 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter" && newOpt.trim()) {
              onChange([...options, newOpt.trim()]);
              setNewOpt("");
            }
          }}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={!newOpt.trim()}
          onClick={() => { onChange([...options, newOpt.trim()]); setNewOpt(""); }}
        >
          Add
        </Button>
      </div>
    </div>
  );
}

// ─── Question Edit Modal ────────────────────────────────
function QuestionModal({
  open,
  question,
  onClose,
  onSave,
}: {
  open: boolean;
  question: Partial<BriefingQuestion> | null;
  onClose: () => void;
  onSave: (q: Partial<BriefingQuestion>) => void;
}) {
  const [form, setForm] = useState<Partial<BriefingQuestion>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (question) setForm({ ...question });
  }, [question]);

  const isNew = !question?.id;
  const showOptions = form.question_type === "select" || form.question_type === "multiselect";

  const handleSave = async () => {
    if (!form.question_text?.trim() || !form.field_key?.trim()) {
      toast.error("Question text and field key are required");
      return;
    }
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? "Add question" : "Edit question"}</DialogTitle>
          <DialogDescription>
            {isNew ? "Create a new briefing question." : "Edit the question details."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">Question text *</label>
            <Textarea
              value={form.question_text || ""}
              onChange={(e) => setForm((f) => ({ ...f, question_text: e.target.value }))}
              className="mt-1 min-h-[60px]"
              placeholder="e.g. What is your main goal?"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Field key *</label>
            <Input
              value={form.field_key || ""}
              onChange={(e) => setForm((f) => ({ ...f, field_key: e.target.value }))}
              className="mt-1"
              placeholder="e.g. main_goal"
            />
            <p className="text-[10px] text-muted-foreground mt-0.5">Maps to the answer key in briefing data</p>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Placeholder</label>
            <Input
              value={form.placeholder || ""}
              onChange={(e) => setForm((f) => ({ ...f, placeholder: e.target.value }))}
              className="mt-1"
              placeholder="Placeholder text shown in the input"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground">Question type</label>
              <Select
                value={form.question_type || "text"}
                onValueChange={(v) => setForm((f) => ({ ...f, question_type: v }))}
              >
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="select">Select</SelectItem>
                  <SelectItem value="multiselect">Multiselect</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="url">URL</SelectItem>
                  <SelectItem value="boolean">Boolean (Yes/No)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Step</label>
              <Select
                value={String(form.step || 1)}
                onValueChange={(v) => setForm((f) => ({ ...f, step: parseInt(v) }))}
              >
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Step 1</SelectItem>
                  <SelectItem value="2">Step 2</SelectItem>
                  <SelectItem value="3">Step 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Vertical</label>
            <Select
              value={form.vertical || "all"}
              onValueChange={(v) => setForm((f) => ({ ...f, vertical: v }))}
            >
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All verticals</SelectItem>
                <SelectItem value="salud">Salud & Estética</SelectItem>
                <SelectItem value="elearning">E-Learning</SelectItem>
                <SelectItem value="deporte">Deporte Offline</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {showOptions && (
            <OptionsEditor
              options={Array.isArray(form.options) ? form.options : []}
              onChange={(opts) => setForm((f) => ({ ...f, options: opts }))}
            />
          )}

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_required ?? false}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_required: v }))}
              />
              <span className="text-sm text-foreground">Required</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_active ?? true}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
              />
              <span className="text-sm text-foreground">Active</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
            {isNew ? "Add question" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ─────────────────────────────────────
export function BriefingQuestionsManager() {
  const [questions, setQuestions] = useState<BriefingQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [editingQuestion, setEditingQuestion] = useState<Partial<BriefingQuestion> | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BriefingQuestion | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const fetchQuestions = async () => {
    const { data } = await (supabase.from("briefing_questions" as any) as any)
      .select("*")
      .order("step")
      .order("order_index");
    setQuestions((data || []) as BriefingQuestion[]);
    setLoading(false);
  };

  useEffect(() => { fetchQuestions(); }, []);

  const toggleActive = async (q: BriefingQuestion) => {
    await (supabase.from("briefing_questions" as any) as any)
      .update({ is_active: !q.is_active })
      .eq("id", q.id);
    setQuestions((prev) => prev.map((x) => x.id === q.id ? { ...x, is_active: !x.is_active } : x));
  };

  const handleSave = async (form: Partial<BriefingQuestion>) => {
    try {
      const payload = {
        step: form.step,
        vertical: form.vertical || "all",
        field_key: form.field_key,
        question_text: form.question_text,
        question_type: form.question_type || "text",
        options: form.options && (form.question_type === "select" || form.question_type === "multiselect")
          ? form.options
          : null,
        placeholder: form.placeholder || null,
        is_required: form.is_required ?? false,
        is_active: form.is_active ?? true,
        order_index: form.order_index ?? 0,
      };

      if (form.id) {
        const { error } = await (supabase.from("briefing_questions" as any) as any)
          .update(payload).eq("id", form.id);
        if (error) throw error;
        toast.success("Question updated!");
      } else {
        // Set order_index to last in step
        const filtered = filterQuestions(questions, activeTab);
        payload.order_index = filtered.length > 0
          ? Math.max(...filtered.map((q) => q.order_index)) + 1
          : 1;
        const { error } = await (supabase.from("briefing_questions" as any) as any)
          .insert(payload);
        if (error) throw error;
        toast.success("Question added!");
      }
      setShowModal(false);
      setEditingQuestion(null);
      fetchQuestions();
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await (supabase.from("briefing_questions" as any) as any)
      .delete().eq("id", deleteTarget.id);
    if (error) { toast.error(error.message); return; }
    setQuestions((prev) => prev.filter((q) => q.id !== deleteTarget.id));
    setDeleteTarget(null);
    toast.success("Question deleted!");
  };

  const openEdit = (q: BriefingQuestion) => {
    setEditingQuestion(q);
    setShowModal(true);
  };

  const openAdd = () => {
    const defaults: Partial<BriefingQuestion> = {
      step: activeTab.startsWith("step") ? parseInt(activeTab.replace("step", "").replace("_salud", "3").replace("_elearning", "3").replace("_deporte", "3")) || 1 : 1,
      vertical: activeTab.includes("salud") ? "salud" : activeTab.includes("elearning") ? "elearning" : activeTab.includes("deporte") ? "deporte" : "all",
      question_type: "text",
      is_active: true,
      is_required: false,
    };
    setEditingQuestion(defaults);
    setShowModal(true);
  };

  // Drag & drop reorder
  const handleDragStart = (id: string) => setDraggedId(id);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = async (targetId: string) => {
    if (!draggedId || draggedId === targetId) { setDraggedId(null); return; }
    const filtered = filterQuestions(questions, activeTab);
    const dragIdx = filtered.findIndex((q) => q.id === draggedId);
    const dropIdx = filtered.findIndex((q) => q.id === targetId);
    if (dragIdx === -1 || dropIdx === -1) { setDraggedId(null); return; }

    const reordered = [...filtered];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(dropIdx, 0, moved);

    // Update order_index for all items in this group
    const updates = reordered.map((q, i) => ({ id: q.id, order_index: i + 1 }));
    setQuestions((prev) => {
      const otherQuestions = prev.filter((q) => !reordered.some((r) => r.id === q.id));
      return [...otherQuestions, ...reordered.map((q, i) => ({ ...q, order_index: i + 1 }))].sort((a, b) => a.step - b.step || a.order_index - b.order_index);
    });

    // Persist
    for (const u of updates) {
      await (supabase.from("briefing_questions" as any) as any).update({ order_index: u.order_index }).eq("id", u.id);
    }
    setDraggedId(null);
  };

  const filtered = filterQuestions(questions, activeTab);

  if (loading) return <div className="text-muted-foreground">Loading questions...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Briefing Questions</h2>
          <p className="text-sm text-muted-foreground">
            Edit the questions shown to prospects in the public briefing form. Changes take effect immediately.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key} className="text-xs">
              {t.label}
              <Badge variant="secondary" className="ml-1 text-[10px] px-1">
                {filterQuestions(questions, t.key).length}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map((t) => (
          <TabsContent key={t.key} value={t.key} className="mt-4">
            <div className="space-y-2">
              {filterQuestions(questions, t.key).sort((a, b) => a.order_index - b.order_index).map((q) => (
                <div
                  key={q.id}
                  draggable
                  onDragStart={() => handleDragStart(q.id)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(q.id)}
                  className={`bg-card rounded-lg border border-border p-3 flex items-start gap-3 transition-all ${
                    draggedId === q.id ? "opacity-50" : ""
                  } ${!q.is_active ? "opacity-60" : ""}`}
                >
                  {/* Drag handle */}
                  <div className="cursor-grab active:cursor-grabbing mt-1 text-muted-foreground hover:text-foreground">
                    <GripVertical className="w-4 h-4" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{q.question_text}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className={`text-[10px] ${TYPE_BADGES[q.question_type] || ""}`}>
                        {q.question_type}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground font-mono">{q.field_key}</span>
                      {q.is_required && (
                        <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30">
                          required
                        </Badge>
                      )}
                      {q.vertical !== "all" && (
                        <Badge variant="outline" className="text-[10px]">{q.vertical}</Badge>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={q.is_active}
                      onCheckedChange={() => toggleActive(q)}
                    />
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(q)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(q)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}

              {filtered.length === 0 && (
                <p className="text-sm text-muted-foreground p-4 text-center">No questions in this category.</p>
              )}
            </div>

            <Button variant="outline" size="sm" className="mt-4" onClick={openAdd}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add question
            </Button>
          </TabsContent>
        ))}
      </Tabs>

      {/* Edit/Add modal */}
      <QuestionModal
        open={showModal}
        question={editingQuestion}
        onClose={() => { setShowModal(false); setEditingQuestion(null); }}
        onSave={handleSave}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete question?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove "{deleteTarget?.question_text}" from the briefing form.
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
