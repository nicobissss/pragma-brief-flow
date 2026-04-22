import { useEffect, useState } from "react";
import Joyride, { type Step, type CallBackProps, STATUS } from "react-joyride";

const TOUR_KEY = "pragma_admin_tour_v1";

const STEPS: Step[] = [
  {
    target: "body",
    placement: "center",
    title: "👋 Bienvenido a PRAGMA Briefer",
    content: "Te muestro 3 puntos clave para empezar. Tarda 20 segundos.",
    disableBeacon: true,
  },
  {
    target: '[data-tour="prospects"]',
    title: "1. Tus prospects",
    content: "Aquí gestionas el embudo: nuevos leads, calls programadas, propuestas listas.",
  },
  {
    target: '[data-tour="clients"]',
    title: "2. Tus clientes",
    content: "Una vez aceptan la propuesta, los gestionas desde aquí — kickoff, oferta, plan de acción.",
  },
  {
    target: '[data-tour="settings"]',
    title: "3. Catálogo y reglas",
    content: "En Settings encuentras el catálogo de offerings, reglas, flujos y base de conocimiento.",
  },
];

export function AdminOnboardingTour() {
  const [run, setRun] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(TOUR_KEY)) {
      // Slight delay so layout mounts
      const t = setTimeout(() => setRun(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  const handleCallback = (data: CallBackProps) => {
    const finished: string[] = [STATUS.FINISHED, STATUS.SKIPPED];
    if (finished.includes(data.status)) {
      localStorage.setItem(TOUR_KEY, "1");
      setRun(false);
    }
  };

  return (
    <Joyride
      steps={STEPS}
      run={run}
      continuous
      showSkipButton
      showProgress
      callback={handleCallback}
      locale={{ back: "Atrás", close: "Cerrar", last: "Listo", next: "Siguiente", skip: "Saltar" }}
      styles={{
        options: {
          primaryColor: "hsl(var(--primary))",
          zIndex: 10000,
          arrowColor: "hsl(var(--card))",
          backgroundColor: "hsl(var(--card))",
          textColor: "hsl(var(--foreground))",
        },
      }}
    />
  );
}
