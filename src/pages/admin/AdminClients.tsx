import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { differenceInDays } from "date-fns";
import TestModeBadge from "@/components/admin/TestModeBadge";

type Client = {
  id: string;
  name: string;
  company_name: string;
  email: string;
  vertical: string;
  market: string;
  status: string;
  pipeline_status: string | null;
  created_at: string;
  is_test?: boolean | null;
};

type AssetRow = {
  id: string;
  client_id: string;
  status: string;
  created_at: string;
};

function getHealthIndicator(assets: AssetRow[]): { emoji: string; label: string } {
  if (assets.length === 0) return { emoji: "⚪", label: "No assets" };
  const latestDate = assets.reduce((max, a) => a.created_at > max ? a.created_at : max, assets[0].created_at);
  const daysSince = differenceInDays(new Date(), new Date(latestDate));
  const hasPendingFeedback = assets.some(a => a.status === "change_requested");
  if (hasPendingFeedback || daysSince > 7) return { emoji: "🔴", label: "Needs attention" };
  if (daysSince > 3) return { emoji: "🟡", label: "Waiting" };
  return { emoji: "🟢", label: "On track" };
}

export default function AdminClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const [clientsRes, assetsRes] = await Promise.all([
        supabase.from("clients").select("*").order("created_at", { ascending: false }),
        supabase.from("assets").select("id, client_id, status, created_at"),
      ]);
      setClients((clientsRes.data as Client[]) || []);
      setAssets((assetsRes.data as AssetRow[]) || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const filtered = clients
    .filter(c => showArchived ? c.status === "archived" : c.status !== "archived")
    .filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.company_name.toLowerCase().includes(search.toLowerCase())
    );

  if (loading) return (
    <div className="p-8 max-w-5xl space-y-4">
      <div className="h-8 w-32 animate-pulse rounded-md bg-muted" />
      {[1,2,3].map(i => <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />)}
    </div>
  );

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-2xl font-bold text-foreground mb-6">Clients</h1>

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <Input
          placeholder="Search by name or company..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Button
          variant={showArchived ? "default" : "outline"}
          size="sm"
          onClick={() => setShowArchived(!showArchived)}
        >
          {showArchived ? "Ver activos" : "Ver archivados"}
        </Button>
        {search && (
          <Button variant="ghost" size="sm" onClick={() => setSearch("")}>Limpiar filtros</Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card rounded-lg border border-border p-8 text-center space-y-2">
          <p className="text-2xl">🏢</p>
          <h3 className="text-base font-semibold text-foreground">
            {clients.length === 0 ? "No active clients" : "No hay clientes que coincidan."}
          </h3>
          <p className="text-sm text-muted-foreground">
            {clients.length === 0
              ? "Accept a prospect to create your first client."
              : "Try a different search term."}
          </p>
          {search && (
            <Button variant="outline" size="sm" onClick={() => setSearch("")}>Limpiar filtros</Button>
          )}
        </div>
      ) : (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-secondary/50">Health</th>
                <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-secondary/50">Name</th>
                <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-secondary/50">Company</th>
                <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-secondary/50">Vertical</th>
                <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-secondary/50">Status</th>
                <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-secondary/50">Since</th>
                <th className="p-3 bg-secondary/50"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const clientAssets = assets.filter(a => a.client_id === c.id);
                const health = getHealthIndicator(clientAssets);
                return (
                  <tr
                    key={c.id}
                    className="border-b border-border last:border-0 hover:bg-secondary/30 cursor-pointer transition-colors"
                    onClick={() => navigate(`/admin/client/${c.id}`)}
                  >
                    <td className="p-3 text-center" title={health.label}>
                      <span className="text-base">{health.emoji}</span>
                    </td>
                    <td className="p-3 font-medium text-foreground">
                      <span className="inline-flex items-center gap-2">{c.name}{c.is_test && <TestModeBadge />}</span>
                    </td>
                    <td className="p-3 text-muted-foreground">{c.company_name}</td>
                    <td className="p-3 text-muted-foreground">{c.vertical}</td>
                    <td className="p-3"><StatusBadge status={c.status} /></td>
                    <td className="p-3 text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</td>
                    <td className="p-3">
                      <Button variant="ghost" size="sm">View</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
