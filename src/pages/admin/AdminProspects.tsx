import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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

  useEffect(() => {
    const fetch = async () => {
      let query = supabase.from("prospects").select("*").order("created_at", { ascending: false });
      if (statusFilter !== "all") query = query.eq("status", statusFilter as any);
      if (verticalFilter !== "all") query = query.eq("vertical", verticalFilter);

      const { data } = await query;
      setProspects((data || []) as Prospect[]);
      setLoading(false);
    };
    fetch();
  }, [statusFilter, verticalFilter]);

  const filtered = prospects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.company_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-foreground mb-6">Prospects</h1>

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
    </div>
  );
}
