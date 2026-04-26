import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Loader2, Plus, Trash2, Save, Webhook } from "lucide-react";
import { toast } from "sonner";

interface SubTool {
  id: string;
  key: string;
  label: string;
  description: string | null;
  webhook_url: string | null;
  secret_name: string | null;
  channels: string[];
  is_active: boolean;
}

const EMPTY: Omit<SubTool, "id"> = {
  key: "",
  label: "",
  description: "",
  webhook_url: "",
  secret_name: "",
  channels: [],
  is_active: true,
};

export default function SubToolRegistryTab() {
  const [tools, setTools] = useState<SubTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [draft, setDraft] = useState<typeof EMPTY | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase.from("sub_tool_registry" as any) as any)
      .select("*")
      .order("label");
    if (error) toast.error(error.message);
    setTools(((data as any[]) || []).map((r) => ({ ...r, channels: r.channels || [] })));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const updateField = (id: string, patch: Partial<SubTool>) => {
    setTools((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const save = async (tool: SubTool) => {
    setSaving(tool.id);
    const { error } = await (supabase.from("sub_tool_registry" as any) as any)
      .update({
        key: tool.key,
        label: tool.label,
        description: tool.description,
        webhook_url: tool.webhook_url,
        secret_name: tool.secret_name,
        channels: tool.channels,
        is_active: tool.is_active,
      })
      .eq("id", tool.id);
    setSaving(null);
    if (error) return toast.error(error.message);
    toast.success("Saved");
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this sub-tool?")) return;
    const { error } = await (supabase.from("sub_tool_registry" as any) as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    setTools((prev) => prev.filter((t) => t.id !== id));
  };

  const create = async () => {
    if (!draft) return;
    if (!draft.key.trim() || !draft.label.trim()) {
      toast.error("Key and label are required");
      return;
    }
    const { data, error } = await (supabase.from("sub_tool_registry" as any) as any)
      .insert({ ...draft })
      .select()
      .single();
    if (error) return toast.error(error.message);
    setTools((prev) => [...prev, { ...(data as any), channels: (data as any).channels || [] }]);
    setDraft(null);
    toast.success("Sub-tool created");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Webhook className="w-4 h-4" /> Sub-Tools (Webhooks)
          </h3>
          <p className="text-sm text-muted-foreground">
            Catálogo de tools externos (Make.com, Forge, Slotty…) que reciben los touchpoints del flow.
          </p>
        </div>
        {!draft && (
          <Button size="sm" onClick={() => setDraft({ ...EMPTY })}>
            <Plus className="w-4 h-4 mr-1" /> New sub-tool
          </Button>
        )}
      </div>

      {draft && (
        <Card className="p-4 space-y-3 border-dashed">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Key (slug)</Label>
              <Input
                value={draft.key}
                onChange={(e) => setDraft({ ...draft, key: e.target.value })}
                placeholder="ig_post_publisher"
              />
            </div>
            <div>
              <Label>Label</Label>
              <Input
                value={draft.label}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                placeholder="IG Post Publisher"
              />
            </div>
          </div>
          <div>
            <Label>Webhook URL</Label>
            <Input
              value={draft.webhook_url || ""}
              onChange={(e) => setDraft({ ...draft, webhook_url: e.target.value })}
              placeholder="https://hook.make.com/..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Secret name (optional)</Label>
              <Input
                value={draft.secret_name || ""}
                onChange={(e) => setDraft({ ...draft, secret_name: e.target.value })}
                placeholder="MAKE_WEBHOOK_SECRET"
              />
            </div>
            <div>
              <Label>Channels (comma separated)</Label>
              <Input
                value={(draft.channels || []).join(", ")}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    channels: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                  })
                }
                placeholder="ig_post, social_post"
              />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={draft.description || ""}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="What this tool does and when to use it"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={create}>
              <Save className="w-4 h-4 mr-1" /> Create
            </Button>
          </div>
        </Card>
      )}

      {tools.length === 0 && !draft && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No sub-tools yet. Add one to start dispatching flow nodes to external automations.
        </Card>
      )}

      <div className="space-y-3">
        {tools.map((tool) => (
          <Card key={tool.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 grid grid-cols-2 gap-3">
                <div>
                  <Label>Key</Label>
                  <Input value={tool.key} onChange={(e) => updateField(tool.id, { key: e.target.value })} />
                </div>
                <div>
                  <Label>Label</Label>
                  <Input value={tool.label} onChange={(e) => updateField(tool.id, { label: e.target.value })} />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch
                  checked={tool.is_active}
                  onCheckedChange={(v) => updateField(tool.id, { is_active: v })}
                />
                <Label className="text-xs">{tool.is_active ? "Active" : "Disabled"}</Label>
              </div>
            </div>
            <div>
              <Label>Webhook URL</Label>
              <Input
                value={tool.webhook_url || ""}
                onChange={(e) => updateField(tool.id, { webhook_url: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Secret name</Label>
                <Input
                  value={tool.secret_name || ""}
                  onChange={(e) => updateField(tool.id, { secret_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Channels</Label>
                <Input
                  value={(tool.channels || []).join(", ")}
                  onChange={(e) =>
                    updateField(tool.id, {
                      channels: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                    })
                  }
                />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={tool.description || ""}
                onChange={(e) => updateField(tool.id, { description: e.target.value })}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => remove(tool.id)}>
                <Trash2 className="w-4 h-4 mr-1" /> Delete
              </Button>
              <Button size="sm" onClick={() => save(tool)} disabled={saving === tool.id}>
                {saving === tool.id ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <Save className="w-4 h-4 mr-1" />
                )}
                Save
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
