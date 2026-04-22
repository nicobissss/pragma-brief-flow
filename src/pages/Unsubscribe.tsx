import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type State =
  | { status: "loading" }
  | { status: "valid" }
  | { status: "already" }
  | { status: "invalid"; message: string }
  | { status: "submitting" }
  | { status: "done" }
  | { status: "error"; message: string };

const UnsubscribePage = () => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    document.title = "Cancelar suscripción · Pragma Marketers";
    if (!token) {
      setState({ status: "invalid", message: "Falta el token en el enlace." });
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(
            token,
          )}`,
          { headers: { apikey: SUPABASE_ANON_KEY } },
        );
        const data = await res.json();
        if (data.valid) setState({ status: "valid" });
        else if (data.reason === "already_unsubscribed")
          setState({ status: "already" });
        else
          setState({
            status: "invalid",
            message: data.error ?? "Token inválido o caducado.",
          });
      } catch (err) {
        setState({
          status: "invalid",
          message: "No pudimos validar el enlace. Intenta de nuevo.",
        });
      }
    })();
  }, [token]);

  const confirmUnsubscribe = async () => {
    if (!token) return;
    setState({ status: "submitting" });
    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ token }),
        },
      );
      const data = await res.json();
      if (data.success || data.reason === "already_unsubscribed")
        setState({ status: "done" });
      else
        setState({
          status: "error",
          message: data.error ?? "No pudimos completar la baja.",
        });
    } catch {
      setState({ status: "error", message: "Error de red. Intenta de nuevo." });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">Cancelar suscripción</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {state.status === "loading" && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Validando enlace…
            </div>
          )}

          {state.status === "valid" && (
            <>
              <p className="text-sm text-foreground">
                ¿Quieres dejar de recibir emails de Pragma Marketers? Puedes
                confirmar abajo.
              </p>
              <Button onClick={confirmUnsubscribe} className="w-full">
                Confirmar cancelación
              </Button>
            </>
          )}

          {state.status === "submitting" && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Procesando…
            </div>
          )}

          {(state.status === "done" || state.status === "already") && (
            <div className="flex items-start gap-3 text-sm">
              <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <p className="text-foreground">
                {state.status === "already"
                  ? "Ya estabas dado de baja. No recibirás más emails."
                  : "Listo. Has sido dado de baja correctamente."}
              </p>
            </div>
          )}

          {(state.status === "invalid" || state.status === "error") && (
            <div className="flex items-start gap-3 text-sm">
              <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <p className="text-foreground">{state.message}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UnsubscribePage;
