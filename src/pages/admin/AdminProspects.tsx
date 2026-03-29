import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { X, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import CreateProspectDialog from "@/components/admin/CreateProspectDialog";

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
  const [marketFilter, setMarketFilter] = useState("all");
  const [callStatusFilter, setCallStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const navigate = useNavigate();

  const loadProspects = useCallback(async () => {
    setLoading(true);
    let query = supabase.from("prospects").select("*").order("created_at", { ascending: false });
    if (statusFilter !== "all") query = query.eq("status", statusFilter as any);
    if (verticalFilter !== "all") query = query.eq("vertical", verticalFilter);
    if (marketFilter !== "all") query = query.eq("market", marketFilter as any);
    if (!showArchived) query = query.not("status", "eq", "archived");

    const { data } = await query;
    setProspects((data || []) as Prospect[]);
    setLoading(false);
  }, [statusFilter, verticalFilter, marketFilter, showArchived]);

  useEffect(() => { loadProspects(); }, [loadProspects]);

  const unarchive = async (prospectId: string) => {
    await supabase.from("prospects").update({ status: "new" as any }).eq("id", prospectId);
    toast.success("Prospect ripristinato");
    loadProspects();
  };

  const hasActiveFilters = statusFilter !== "all" || verticalFilter !== "all" || marketFilter !== "all" || callStatusFilter !== "all" || search !== "" || sortBy !== "newest";

  const clearFilters = () => {
    setStatusFilter("all");
    setVerticalFilter("all");
    setMarketFilter("all");
    setCallStatusFilter("all");
    setSortBy("newest");
    setSearch("");
  };

  let filtered = prospects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.company_name.toLowerCase().includes(search.toLowerCase())
  );

  // Call status filter (client-side)
  if (callStatusFilter !== "all") {
    if (callStatusFilter === "not_scheduled") {
      filtered = filtered.filter(p => p.call_status === "not_scheduled");
    } else if (callStatusFilter === "scheduled") {
      filtered = filtered.filter(p => p.call_status === "scheduled");
    } else if (callStatusFilter === "completed") {
      filtered = filtered.filter(p => ["done_positive", "done_negative", "no_show"].includes(p.call_status));
    }
  }

  // Sort
  if (sortBy === "oldest") {
    filtered = [...filtered].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  } else if (sortBy === "name_az") {
    filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Prospects</h1>
        <CreateProspectDialog onCreated={loadProspects} />
      </div>

      <div className="flex flex-wrap gap-3 mb-6 items-center">
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
        <Select value={marketFilter} onValueChange={setMarketFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="País" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All markets</SelectItem>
            <SelectItem value="es">🇪🇸 España</SelectItem>
            <SelectItem value="it">🇮🇹 Italia</SelectItem>
            <SelectItem value="ar">🇦🇷 Argentina</SelectItem>
          </SelectContent>
        </Select>
        <Select value={callStatusFilter} onValueChange={setCallStatusFilter}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="Call status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All call status</SelectItem>
            <SelectItem value="not_scheduled">No programada</SelectItem>
            <SelectItem value="scheduled">Programada</SelectItem>
            <SelectItem value="completed">Completada</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Sort" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Más reciente</SelectItem>
            <SelectItem value="oldest">Más antiguo</SelectItem>
            <SelectItem value="name_az">Nombre A-Z</SelectItem>
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
            <X className="w-3 h-3" /> Limpiar filtros
          </Button>
        )}
        <div className="flex items-center gap-2 ml-auto">
          <Switch id="show-archived" checked={showArchived} onCheckedChange={setShowArchived} />
          <Label htmlFor="show-archived" className="text-sm text-muted-foreground cursor-pointer">Mostrar archivados</Label>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />)}
        </div>
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
                {showArchived && <TableHead className="w-10"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={showArchived ? 9 : 8} className="text-center py-8">
                    <div className="space-y-2">
                      <p className="text-2xl">👥</p>
                      <p className="text-foreground font-medium">No hay prospects que coincidan.</p>
                      <p className="text-sm text-muted-foreground">Try adjusting your filters.</p>
                      {hasActiveFilters && (
                        <Button variant="outline" size="sm" onClick={clearFilters}>Limpiar filtros</Button>
                      )}
                    </div>
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
                    {showArchived && (
                      <TableCell>
                        {p.status === "archived" && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={(e) => { e.stopPropagation(); unarchive(p.id); }}
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Ripristinare</TooltipContent>
                          </Tooltip>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
