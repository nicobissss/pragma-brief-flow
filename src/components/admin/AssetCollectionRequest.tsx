import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Loader2, Bell, Trash2, Paperclip, CheckCircle2, Clock } from "lucide-react";
import { format } from "date-fns";

type RequestItem = {
  label: string;
  type_hint: string;
  description: string;
  status: "pending" | "uploaded";
  file_url?: string;
  text_response?: string;
};

type AssetRequest = {
  id: string;
  client_id: string;
  requested_items: RequestItem[];
  status: string;
  pragma_notified: boolean;
  created_at: string;
  updated_at: string;
};

const DEFAULT_ITEMS: RequestItem[] = [
  { label: "Logo (PNG or SVG)", type_hint: "Images", description: "", status: "pending" },
  { label: "Brand photos or service photos", type_hint: "Images", description: "", status: "pending" },
  { label: "Existing promotional materials (PDF, images)", type_hint: "Any file", description: "", status: "pending" },
  { label: "Examples of communications you like", type_hint: "Any file", description: "", status: "pending" },
  { label: "Any other files you want to share with us", type_hint: "Any file", description: "", status: "pending" },
];

const TYPE_HINTS = ["Images", "PDF", "Text", "Any file"];

interface AssetCollectionRequestProps {
  clientId: string;
  clientName: string;
}

export function AssetCollectionRequest({ clientId, clientName }: AssetCollectionRequestProps) {
  const [request, setRequest] = useState<AssetRequest | null>(null);
  const [items, setItems] = useState<(RequestItem & { checked: boolean })[]>(
    DEFAULT_ITEMS.map((i) => ({ ...i, checked: true }))
  );
  const [loaded, setLoaded] = useState(false);
  const [sending, setSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await (supabase.from("client_asset_requests" as any) as any)
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        const req = data[0] as AssetRequest;
        setRequest(req);
        setItems(req.requested_items.map((i: RequestItem) => ({ ...i, checked: true })));
      }
      setLoaded(true);
    };
    fetch();
  }, [clientId]);

  if (!loaded) return null;

  const checkedItems = items.filter((i) => i.checked);
  const uploadedCount = request?.requested_items.filter((i: RequestItem) => i.status === "uploaded").length || 0;
  const totalItems = request?.requested_items.length || 0;

  const updateItem = (index: number, field: string, value: any) => {
    setItems((prev) => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const addItem = () => {
    setItems((prev) => [...prev, { label: "", type_hint: "Any file", description: "", status: "pending" as const, checked: true }]);
  };

  const sendRequest = async () => {
    setSending(true);
    try {
      const requestedItems = checkedItems.map(({ checked, ...rest }) => rest);

      if (request) {
        // Update existing
        await (supabase.from("client_asset_requests" as any) as any)
          .update({
            requested_items: requestedItems,
            status: "pending",
            updated_at: new Date().toISOString(),
          })
          .eq("id", request.id);
      } else {
        // Create new
        const { data, error } = await (supabase.from("client_asset_requests" as any) as any)
          .insert({
            client_id: clientId,
            requested_items: requestedItems,
            status: "pending",
          })
          .select()
          .single();
        if (error) throw error;
        setRequest(data as AssetRequest);
      }

      // Send notification email
      const { data: notifData, error: notifError } = await supabase.functions.invoke("send-notification", {
        body: {
          type: "asset_collection_request",
          client_id: clientId,
          requested_items: requestedItems.map((i: RequestItem) => ({
            label: i.label,
            description: i.description,
          })),
        },
      });

      if (notifError || notifData?.error) {
        toast.error(`Request saved but email failed: ${notifData?.error || notifError?.message}`);
      } else {
        toast.success(`Asset request sent to ${clientName}!`);
      }

      // Log activity
      await supabase.from("activity_log").insert({
        entity_type: "client",
        entity_id: clientId,
        entity_name: clientName,
        action: `Asset collection request sent to ${clientName}`,
      });

      setShowConfirm(false);
      // Refresh
      const { data: refreshed } = await (supabase.from("client_asset_requests" as any) as any)
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(1);
      if (refreshed?.[0]) setRequest(refreshed[0] as AssetRequest);
    } catch (e: any) {
      toast.error(e.message || "Failed to send request");
    } finally {
      setSending(false);
    }
  };

  const statusBadge = () => {
    if (!request) return null;
    if (request.status === "complete") {
      return (
        <Badge className="bg-[hsl(142,71%,35%)]/15 text-[hsl(142,71%,35%)] border-[hsl(142,71%,35%)]/30">
          <CheckCircle2 className="w-3 h-3 mr-1" /> Complete
        </Badge>
      );
    }
    if (request.status === "partial") {
      return (
        <Badge variant="outline" className="text-[hsl(var(--status-pending-review))]">
          📎 Partial — {uploadedCount} of {totalItems} uploaded
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-muted-foreground">
        <Clock className="w-3 h-3 mr-1" /> Waiting for client
      </Badge>
    );
  };

  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          📎 Request assets from client
        </h3>
        {statusBadge()}
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Ask the client to upload files and information you need before generating prompts.
      </p>

      {request && (
        <p className="text-xs text-muted-foreground mb-4">
          Last requested: {format(new Date(request.updated_at || request.created_at), "dd MMM yyyy 'at' HH:mm")}
        </p>
      )}

      {/* Items list */}
      <div className="space-y-3 mb-4">
        {items.map((item, index) => (
          <div key={index} className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex items-start gap-3">
              <Checkbox
                checked={item.checked}
                onCheckedChange={(c) => updateItem(index, "checked", !!c)}
                className="mt-1"
              />
              <div className="flex-1 min-w-0 space-y-2">
                <Input
                  value={item.label}
                  onChange={(e) => updateItem(index, "label", e.target.value)}
                  placeholder="Item label"
                  className="h-8 text-sm"
                />
                <div className="flex items-center gap-2">
                  <Select value={item.type_hint} onValueChange={(v) => updateItem(index, "type_hint", v)}>
                    <SelectTrigger className="h-7 w-28 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPE_HINTS.map((h) => (
                        <SelectItem key={h} value={h} className="text-xs">{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={item.description}
                    onChange={(e) => updateItem(index, "description", e.target.value)}
                    placeholder="Add instructions for the client (optional)"
                    className="h-7 text-xs flex-1"
                  />
                </div>
                {item.status === "uploaded" && (
                  <Badge className="bg-[hsl(142,71%,35%)]/15 text-[hsl(142,71%,35%)] text-[10px]">
                    ✅ Uploaded by client
                  </Badge>
                )}
              </div>
              <button onClick={() => removeItem(index)} className="mt-1 text-muted-foreground hover:text-foreground">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={addItem}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Add custom request
        </Button>
        <Button
          size="sm"
          disabled={checkedItems.length === 0 || checkedItems.some((i) => !i.label.trim())}
          onClick={() => setShowConfirm(true)}
          className="bg-[hsl(348,80%,52%)] hover:bg-[hsl(348,80%,46%)] text-white"
        >
          <Bell className="w-3.5 h-3.5 mr-1" /> Send request to client
        </Button>
      </div>

      {/* Confirmation modal */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send asset request to {clientName}?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              They will receive an email and see a new section in their portal to upload:
            </p>
            <div className="space-y-1.5">
              {checkedItems.map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <Paperclip className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-foreground">{item.label}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
              <Button
                disabled={sending}
                onClick={sendRequest}
                className="bg-[hsl(348,80%,52%)] hover:bg-[hsl(348,80%,46%)] text-white"
              >
                {sending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Send request
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
