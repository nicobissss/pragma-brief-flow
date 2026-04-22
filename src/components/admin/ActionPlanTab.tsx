import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus, ChevronDown, AlertTriangle, Clock, User, Link2, Loader2,
} from "lucide-react";

type Task = {
  id: string;
  client_offering_id: string;
  title: string;
  description: string | null;
  category: string;
  status: string | null;
  blocked_reason: string | null;
  assignee: string;
  estimated_hours: number | null;
  order_index: number | null;
  checklist: any;
  related_asset_id: string | null;
  due_date: string | null;
};

const CATEGORY_META: Record<string, { label: string; color: string; order: number }> = {
  setup: { label: "Setup", color: "bg-blue-500/10 text-blue-700 border-blue-500/30", order: 1 },
  content: { label: "Contenido", color: "bg-purple-500/10 text-purple-700 border-purple-500/30", order: 2 },
  integration: { label: "Integración", color: "bg-cyan-500/10 text-cyan-700 border-cyan-500/30", order: 3 },
  client_input: { label: "Input cliente", color: "bg-amber-500/10 text-amber-700 border-amber-500/30", order: 4 },
  review: { label: "Revisión", color: "bg-pink-500/10 text-pink-700 border-pink-500/30", order: 5 },
  launch: { label: "Lanzamiento", color: "bg-green-500/10 text-green-700 border-green-500/30", order: 6 },
  monitoring: { label: "Monitoreo", color: "bg-indigo-500/10 text-indigo-700 border-indigo-500/30", order: 7 },
};

const STATUS_OPTIONS = [
  { value: "todo", label: "Por hacer" },
  { value: "in_progress", label: "En progreso" },
  { value: "blocked", label: "Bloqueada" },
  { value: "done", label: "Completada" },
  { value: "skipped", label: "Saltada" },
];

export default function ActionPlanTab({ clientId }: { clientId: string }) {
  const [loading, setLoading] = useState(true);
  const [offeringId, setOfferingId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<"all" | "mine" | "blocked" | "pending" | "done">("all");
  const [sortBy, setSortBy] = useState<"order" | "category" | "status">("order");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    category: "setup",
    assignee: "admin",
    estimated_hours: "",
  });
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: existingArr } = await supabase
      .from("client_offerings")
      .select("id")
      .eq("client_id", clientId)
      .order("proposed_at", { ascending: false })
      .limit(1);
    const existing = existingArr?.[0] as any;

    if (!existing) {
      setOfferingId(null);
      setTasks([]);
      setLoading(false);
      return;
    }

    setOfferingId(existing.id);
    const { data: t } = await supabase
      .from("action_plan_tasks")
      .select("*")
      .eq("client_offering_id", existing.id)
      .order("order_index", { ascending: true });
    setTasks((t || []) as Task[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const updateTask = async (id: string, patch: Partial<Task>) => {
    // optimistic
    const prevTask = tasks.find((t) => t.id === id);
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    const payload: any = { ...patch };
    if (patch.status === "done") payload.completed_at = new Date().toISOString();
    const { error } = await supabase.from("action_plan_tasks").update(payload).eq("id", id);
    if (error) {
      toast.error(error.message);
      load();
      return;
    }
    // Notify admin if a CLIENT task was just marked done
    if (patch.status === "done" && prevTask && prevTask.assignee === "client" && prevTask.status !== "done") {
      try {
        const { data: c } = await supabase.from("clients").select("name").eq("id", clientId).maybeSingle();
        await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "client-task-completed",
            idempotencyKey: `task-done-${id}`,
            templateData: {
              clientName: c?.name,
              taskTitle: prevTask.title,
              adminUrl: `${window.location.origin}/admin/clients/${clientId}`,
            },
          },
        });
      } catch (e) { console.error("task-done email error:", e); }
    }
  };

  const toggleDone = (task: Task) => {
    const next = task.status === "done" ? "todo" : "done";
    updateTask(task.id, { status: next });
  };

  const handleCreate = async () => {
    if (!offeringId || !newTask.title.trim()) {
      toast.error("Título obligatorio");
      return;
    }
    setCreating(true);
    const { error } = await supabase.from("action_plan_tasks").insert({
      client_offering_id: offeringId,
      title: newTask.title.trim(),
      description: newTask.description.trim() || null,
      category: newTask.category,
      assignee: newTask.assignee,
      estimated_hours: newTask.estimated_hours ? parseFloat(newTask.estimated_hours) : null,
      order_index: tasks.length + 1,
      status: "todo",
    } as any);
    setCreating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Task creada");
    setShowAdd(false);
    setNewTask({ title: "", description: "", category: "setup", assignee: "admin", estimated_hours: "" });
    load();
  };

  const filtered = useMemo(() => {
    let out = [...tasks];
    if (filter === "mine") out = out.filter((t) => t.assignee === "admin");
    if (filter === "blocked") out = out.filter((t) => t.status === "blocked");
    if (filter === "pending") out = out.filter((t) => t.status !== "done" && t.status !== "skipped");
    if (filter === "done") out = out.filter((t) => t.status === "done");

    if (sortBy === "category") {
      out.sort((a, b) => (CATEGORY_META[a.category]?.order || 99) - (CATEGORY_META[b.category]?.order || 99));
    } else if (sortBy === "status") {
      const order: Record<string, number> = { blocked: 1, in_progress: 2, todo: 3, done: 4, skipped: 5 };
      out.sort((a, b) => (order[a.status || "todo"] || 99) - (order[b.status || "todo"] || 99));
    } else {
      out.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    }
    return out;
  }, [tasks, filter, sortBy]);

  const grouped = useMemo(() => {
    const groups: Record<string, Task[]> = {};
    for (const t of filtered) {
      if (!groups[t.category]) groups[t.category] = [];
      groups[t.category].push(t);
    }
    return Object.entries(groups).sort(([a], [b]) =>
      (CATEGORY_META[a]?.order || 99) - (CATEGORY_META[b]?.order || 99),
    );
  }, [filtered]);

  const totalDone = tasks.filter((t) => t.status === "done").length;
  const total = tasks.length;
  const pct = total > 0 ? Math.round((totalDone / total) * 100) : 0;

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!offeringId) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center space-y-2">
        <p className="text-sm font-medium text-foreground">No hay oferta activa</p>
        <p className="text-xs text-muted-foreground">
          Propón una oferta desde el tab "Oferta" para generar el plan de acción.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header / progress */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-3 shadow-sm">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Plan de Acción</h2>
            <p className="text-xs text-muted-foreground">
              {totalDone} de {total} tareas completadas
            </p>
          </div>
          <Button onClick={() => setShowAdd(true)} size="sm">
            <Plus className="w-4 h-4 mr-1" /> Agregar task
          </Button>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Progreso</span>
            <span className="text-xs font-semibold text-foreground">{pct}%</span>
          </div>
          <Progress value={pct} className="h-2" />
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1">
          {(["all", "mine", "blocked", "pending", "done"] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "ghost"}
              onClick={() => setFilter(f)}
              className="text-xs"
            >
              {f === "all" ? "Todos" : f === "mine" ? "Solo míos" : f === "blocked" ? "Bloqueados" : f === "pending" ? "Pendientes" : "Completados"}
            </Button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Ordenar:</span>
          <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="order">Orden</SelectItem>
              <SelectItem value="category">Categoría</SelectItem>
              <SelectItem value="status">Estado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tasks grouped */}
      {grouped.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-sm text-muted-foreground">No hay tareas con este filtro.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(([category, items]) => (
            <div key={category} className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={CATEGORY_META[category]?.color || ""}>
                  {CATEGORY_META[category]?.label || category}
                </Badge>
                <span className="text-xs text-muted-foreground">{items.length} tareas</span>
              </div>
              <div className="space-y-2">
                {items.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    expanded={expanded.has(task.id)}
                    onToggleExpand={() => {
                      const next = new Set(expanded);
                      if (next.has(task.id)) next.delete(task.id);
                      else next.add(task.id);
                      setExpanded(next);
                    }}
                    onToggleDone={() => toggleDone(task)}
                    onUpdate={(patch) => updateTask(task.id, patch)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva tarea</DialogTitle>
            <DialogDescription>Crea una tarea custom en el plan de acción.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Título *</label>
              <Input value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Descripción</label>
              <Textarea
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Categoría</label>
                <Select value={newTask.category} onValueChange={(v) => setNewTask({ ...newTask, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_META).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Asignado a</label>
                <Select value={newTask.assignee} onValueChange={(v) => setNewTask({ ...newTask, assignee: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="client">Cliente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Horas estimadas</label>
              <Input
                type="number"
                step="0.5"
                value={newTask.estimated_hours}
                onChange={(e) => setNewTask({ ...newTask, estimated_hours: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
              Crear tarea
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TaskRow({
  task, expanded, onToggleExpand, onToggleDone, onUpdate,
}: {
  task: Task;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleDone: () => void;
  onUpdate: (patch: Partial<Task>) => void;
}) {
  const isDone = task.status === "done";
  const isBlocked = task.status === "blocked";
  const checklist = Array.isArray(task.checklist) ? task.checklist : [];

  return (
    <Collapsible open={expanded} onOpenChange={onToggleExpand}>
      <div className={`bg-card border rounded-xl overflow-hidden ${isBlocked ? "border-destructive/40" : "border-border"}`}>
        <div className="flex items-start gap-3 p-3">
          <Checkbox
            checked={isDone}
            onCheckedChange={onToggleDone}
            className="mt-0.5"
          />
          <CollapsibleTrigger asChild>
            <button className="flex-1 text-left space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-sm font-medium ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>
                  {task.title}
                </span>
                {isBlocked && <AlertTriangle className="w-3.5 h-3.5 text-destructive" />}
              </div>
              <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <User className="w-3 h-3" /> {task.assignee}
                </span>
                {task.estimated_hours != null && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {task.estimated_hours}h
                  </span>
                )}
                {task.related_asset_id && (
                  <span className="inline-flex items-center gap-1">
                    <Link2 className="w-3 h-3" /> asset
                  </span>
                )}
              </div>
            </button>
          </CollapsibleTrigger>
          <Select value={task.status || "todo"} onValueChange={(v) => onUpdate({ status: v })}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <div className="px-3 pb-3 pt-0 pl-10 space-y-3 border-t border-border">
            {task.description && (
              <p className="text-sm text-muted-foreground pt-3">{task.description}</p>
            )}
            {isBlocked && (
              <div>
                <label className="text-xs font-medium text-destructive">Razón del bloqueo</label>
                <Textarea
                  value={task.blocked_reason || ""}
                  onChange={(e) => onUpdate({ blocked_reason: e.target.value })}
                  placeholder="¿Qué impide avanzar?"
                  rows={2}
                  className="mt-1"
                />
              </div>
            )}
            {checklist.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Checklist interna</p>
                <ul className="space-y-1">
                  {checklist.map((item: any, i: number) => (
                    <li key={i} className="text-xs text-foreground flex items-start gap-2">
                      <span>•</span>
                      <span>{typeof item === "string" ? item : item.label || JSON.stringify(item)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
