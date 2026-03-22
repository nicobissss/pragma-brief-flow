import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", authData.user.id);

      const role = roles?.[0]?.role
        || (authData.user.user_metadata as any)?.role
        || (authData.user.app_metadata as any)?.role;
      if (role === "pragma_admin") {
        navigate("/admin/dashboard");
      } else if (role === "client") {
        navigate("/client/dashboard");
      } else {
        toast.error("No role assigned. Contact PRAGMA.");
        await supabase.auth.signOut();
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { toast.error("Introduce tu email"); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });
      if (error) throw error;
      toast.success("Enlace enviado. Revisa tu email.");
      setResetMode(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground text-xl font-bold shadow-sm">
            P
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">PRAGMA</h1>
          <p className="text-muted-foreground text-sm">Marketing Automation Agency</p>
        </div>

        <div className="bg-card rounded-2xl border border-border p-8 shadow-sm">
          {resetMode ? (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="reset-email" className="text-sm font-medium">Email</Label>
                <Input id="reset-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="tu@email.com" />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enviar enlace →"}
              </Button>
              <button type="button" onClick={() => setResetMode(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors w-full text-center">
                ← Volver al login
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="tu@email.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium">Contraseña</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Entrar →"}
              </Button>
              <button type="button" onClick={() => setResetMode(true)} className="text-sm text-muted-foreground hover:text-foreground transition-colors w-full text-center">
                ¿Olvidaste tu contraseña?
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
