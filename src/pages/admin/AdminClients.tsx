import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";

type Client = {
  id: string;
  name: string;
  company_name: string;
  email: string;
  vertical: string;
  market: string;
  status: string;
  created_at: string;
};

export default function AdminClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false });
      setClients((data as Client[]) || []);
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) return <div className="p-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-2xl font-bold text-foreground mb-6">Clients</h1>

      {clients.length === 0 ? (
        <div className="bg-card rounded-lg border border-border p-8 text-center">
          <p className="text-muted-foreground">No clients yet. Accept a prospect to create the first client.</p>
        </div>
      ) : (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left p-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Company</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Vertical</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Since</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer"
                  onClick={() => navigate(`/admin/client/${c.id}`)}
                >
                  <td className="p-3 font-medium text-foreground">{c.name}</td>
                  <td className="p-3 text-muted-foreground">{c.company_name}</td>
                  <td className="p-3 text-muted-foreground">{c.vertical}</td>
                  <td className="p-3"><StatusBadge status={c.status} /></td>
                  <td className="p-3 text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</td>
                  <td className="p-3">
                    <Button variant="ghost" size="sm">View</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
