import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { VERTICALS, SUB_NICHES, MARKETS, BUDGET_RANGES } from "@/lib/briefing-data";

type Prospect = {
  id: string;
  created_at: string;
  name: string;
  company_name: string;
  email: string;
  vertical: string;
  sub_niche: string;
  market: string;
  status: string;
  call_status: string;
  call_scheduled_at: string | null;
};

function CallStatusIcon({ status, scheduledAt }: { status: string; scheduledAt: string | null }) {
  switch (status) {
    case "scheduled":
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-sm cursor-default">
              📅 {scheduledAt ? format(new Date(scheduledAt), "dd/MM") : ""}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {scheduledAt ? format(new Date(scheduledAt), "PPp") : "Scheduled"}
          </TooltipContent>
        </Tooltip>
      );
    case "done_positive":
      return <span className="text-sm" title="Done - Positive">✅</span>;
    case "done_negative":
      return <span className="text-sm" title="Done - Negative">❌</span>;
    case "no_show":
      return <span className="text-sm" title="No show">👻</span>;
    default:
      return <span className="text-muted-foreground">—</span>;
  }
}

export default function AdminProspects() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [verticalFilter, setVerticalFilter] = useState("all");
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    company_name: "",
    email: "",
    phone: "",
    market: "",
    vertical: "",
    sub_niche: "",
    monthly_budget: "",
    notes: "",
  });

  const fetchProspects = async () => {
    let query = supabase.from("prospects").select("*").order("created_at", { ascending: false });
    if (statusFilter !== "all") query = query.eq("status", statusFilter as any);
    if (verticalFilter !== "all") query = query.eq("vertical", verticalFilter);
    const { data } = await query;
    setProspects((data || []) as Prospect[]);
    setLoading(false);
  };

  useEffect(() => { fetchProspects(); }, [statusFilter, verticalFilter]);

  const filtered = prospects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.company_name.toLowerCase().includes(search.toLowerCase())
  );

  const subNiches = form.vertical ? (SUB_NICHES[form.vertical] || []) : [];

  const handleSave = async () => {
    if (!form.name.trim() || !form.company_name.trim() || !form.email.trim()) {
      toast.error("Name, company, and email are required");
      return;
    }
    if (!form.market) { toast.error("Select a market"); return; }
    if (!form.vertical) { toast.error("Select a vertical"); return; }
    if (!form.sub_niche) { toast.error("Select a sub-niche"); return; }

    setSaving(true);
    const { error } = await supabase.from("prospects").insert({
      name: form.name.trim(),
      company_name: form.company_name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || null,
      market: form.market as any,
      vertical: form.vertical,
      sub_niche: form.sub_niche,
      status: "new" as any,
      briefing_answers: {
        monthly_budget: form.monthly_budget || undefined,
        additional_info: form.notes || undefined,
        _source: "manual_crm",
      },
    });
    setSaving(false);

    if (error) { toast.error(error.message); return; }
    toast.success("Prospect created");
    setDrawerOpen(false);
    setForm({ name: "", company_name: "", email: "", phone: "", market: "", vertical: "", sub_niche: "", monthly_budget: "", notes: "" });
    fetchProspects();
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Prospects</h1>
        <Button onClick={() => setDrawerOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> New prospect
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <Input
          placeholder="Search by name or company..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="proposal_ready">Proposal Ready</SelectItem>
            <SelectItem value="call_scheduled">Call Scheduled</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Select value={verticalFilter} onValueChange={setVerticalFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Vertical" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All verticals</SelectItem>
            <SelectItem value="Salud & Estética">Salud & Estética</SelectItem>
            <SelectItem value="E-Learning">E-Learning</SelectItem>
            <SelectItem value="Deporte Offline">Deporte Offline</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Vertical</TableHead>
                <TableHead>Sub-niche</TableHead>
                <TableHead>Market</TableHead>
                <TableHead>Call</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No prospects found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((p) => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer hover:bg-secondary/50"
                    onClick={() => navigate(`/admin/prospect/${p.id}`)}
                  >
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.company_name}</TableCell>
                    <TableCell>{p.vertical}</TableCell>
                    <TableCell>{p.sub_niche}</TableCell>
                    <TableCell className="uppercase">{p.market}</TableCell>
                    <TableCell>
                      <CallStatusIcon status={p.call_status} scheduledAt={p.call_scheduled_at} />
                    </TableCell>
                    <TableCell><StatusBadge status={p.status} /></TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(p.created_at), "dd MMM yyyy")}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* New Prospect Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>New Prospect</SheetTitle>
            <SheetDescription>Add a prospect manually to the CRM pipeline.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div>
              <Label>Full name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="John Doe" />
            </div>
            <div>
              <Label>Company name *</Label>
              <Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} placeholder="Acme Corp" />
            </div>
            <div>
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="john@acme.com" />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+34 600 000 000" />
            </div>
            <div>
              <Label>Market *</Label>
              <Select value={form.market} onValueChange={(v) => setForm({ ...form, market: v })}>
                <SelectTrigger><SelectValue placeholder="Select market" /></SelectTrigger>
                <SelectContent>
                  {MARKETS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Vertical *</Label>
              <Select value={form.vertical} onValueChange={(v) => setForm({ ...form, vertical: v, sub_niche: "" })}>
                <SelectTrigger><SelectValue placeholder="Select vertical" /></SelectTrigger>
                <SelectContent>
                  {VERTICALS.map((v) => (
                    <SelectItem key={v} value={v}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sub-niche *</Label>
              <Select value={form.sub_niche} onValueChange={(v) => setForm({ ...form, sub_niche: v })} disabled={!form.vertical}>
                <SelectTrigger><SelectValue placeholder={form.vertical ? "Select sub-niche" : "Select vertical first"} /></SelectTrigger>
                <SelectContent>
                  {subNiches.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Monthly budget</Label>
              <Select value={form.monthly_budget} onValueChange={(v) => setForm({ ...form, monthly_budget: v })}>
                <SelectTrigger><SelectValue placeholder="Select range" /></SelectTrigger>
                <SelectContent>
                  {BUDGET_RANGES.map((b) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Any additional context..." rows={3} />
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Save prospect
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
