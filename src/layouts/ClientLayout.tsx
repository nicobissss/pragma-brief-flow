import { useEffect, useState } from "react";
import { useNavigate, Outlet, Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { FileText, LogOut, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ClientLayout() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/login"); return; }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);

      if (roles?.some((r) => r.role === "client")) {
        setAuthorized(true);
        const { data: client } = await supabase
          .from("clients")
          .select("company_name")
          .eq("user_id", session.user.id)
          .single();
        if (client) setCompanyName(client.company_name);
      } else {
        navigate("/login");
      }
      setLoading(false);
    };
    check();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") navigate("/login");
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;
  if (!authorized) return null;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav for mobile-first */}
      <header className="border-b border-border bg-card px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">PRAGMA</h1>
          {companyName && <p className="text-xs text-muted-foreground">{companyName}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/client/dashboard"
            className={`p-2 rounded-md ${location.pathname === "/client/dashboard" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            <LayoutDashboard className="w-5 h-5" />
          </Link>
          <Link
            to="/client/assets"
            className={`p-2 rounded-md ${location.pathname === "/client/assets" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            <FileText className="w-5 h-5" />
          </Link>
          <Button variant="ghost" size="icon" onClick={handleLogout}>
            <LogOut className="w-5 h-5 text-muted-foreground" />
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
