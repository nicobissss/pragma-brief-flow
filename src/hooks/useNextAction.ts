import { differenceInDays } from "date-fns";

export type NextActionVariant = "primary" | "warning" | "success";

export type NextActionInput = {
  audience: "admin" | "client";
  briefDone: boolean;
  offering: { status: string | null; proposed_at?: string | null } | null;
  openTaskCount: number;
  nextTaskTitle?: string | null;
  hasKickoffTranscript?: boolean;
};

export type NextAction = {
  title: string;
  description: string;
  ctaLabel: string;
  ctaTab?: string;       // for tabbed admin view
  ctaHref?: string;      // for client side links
  variant: NextActionVariant;
  /** Days the offering has been in 'proposed' state — used for SLA badges. */
  proposalAgingDays?: number;
};

/**
 * Shared "next action" derivation used by both Admin OverviewTab and Client Dashboard.
 * Single source of truth for what the user should do next at any state of the project.
 */
export function deriveNextAction(input: NextActionInput): NextAction {
  const { audience, briefDone, offering, openTaskCount, nextTaskTitle, hasKickoffTranscript } = input;

  // Admin perspective ───────────────────────────────────────
  if (audience === "admin") {
    if (!briefDone) {
      return {
        title: "Completar el brief del cliente",
        description: !hasKickoffTranscript
          ? "Falta cargar la transcripción de la call."
          : "Analiza la transcripción para extraer la voz del cliente.",
        ctaLabel: "Ir a Kickoff",
        ctaTab: "kickoff",
        variant: "warning",
      };
    }
    if (!offering) {
      return {
        title: "Proponer oferta al cliente",
        description: "El brief está completo. Es hora de elegir la oferta adecuada.",
        ctaLabel: "Ver Recomendaciones",
        ctaTab: "oferta",
        variant: "primary",
      };
    }

    const proposalAgingDays = offering.proposed_at
      ? differenceInDays(new Date(), new Date(offering.proposed_at))
      : 0;

    if (offering.status === "proposed") {
      const aging = proposalAgingDays > 5;
      return {
        title: aging
          ? `⚠ Propuesta enviada hace ${proposalAgingDays} días`
          : "Esperando aceptación del cliente",
        description: aging
          ? "Sin respuesta. Hacer follow-up con el cliente."
          : "Cliente tiene la propuesta. Marca como aceptada cuando confirme.",
        ctaLabel: "Ver Oferta",
        ctaTab: "oferta",
        variant: aging ? "warning" : "primary",
        proposalAgingDays,
      };
    }
    if (offering.status === "accepted") {
      return {
        title: "Iniciar ejecución",
        description: "Cliente aceptó. Ejecuta el plan de acción.",
        ctaLabel: "Ver Plan de Acción",
        ctaTab: "plan",
        variant: "primary",
      };
    }
    if (offering.status === "active" && openTaskCount > 0) {
      return {
        title: `${openTaskCount} tarea${openTaskCount > 1 ? "s" : ""} pendiente${openTaskCount > 1 ? "s" : ""}`,
        description: nextTaskTitle ? `Próxima tarea: ${nextTaskTitle}` : "Hay tareas bloqueadas que requieren atención.",
        ctaLabel: "Ir a Plan de Acción",
        ctaTab: "plan",
        variant: "primary",
      };
    }
    return {
      title: "Campaña en marcha 🎉",
      description: "Monitoreo activo. Revisar resultados periódicamente.",
      ctaLabel: "Ver Assets",
      ctaTab: "assets",
      variant: "success",
    };
  }

  // Client perspective ──────────────────────────────────────
  if (!offering || offering.status === "proposed") {
    return {
      title: "Tu propuesta está lista",
      description: "Estamos esperando tu confirmación para empezar.",
      ctaLabel: "Ver propuesta",
      ctaHref: "/client/dashboard",
      variant: "primary",
    };
  }
  if (offering.status === "accepted" || (offering.status === "active" && openTaskCount > 0)) {
    return {
      title: openTaskCount > 0
        ? `Tienes ${openTaskCount} tarea${openTaskCount > 1 ? "s" : ""} pendiente${openTaskCount > 1 ? "s" : ""}`
        : "Iniciando tu campaña",
      description: nextTaskTitle || "Tu equipo PRAGMA está preparando todo.",
      ctaLabel: "Ver tareas",
      ctaHref: "/client/dashboard",
      variant: "primary",
    };
  }
  return {
    title: "Tu campaña está activa 🚀",
    description: "Monitoreamos los resultados. Te avisamos cuando haya algo para revisar.",
    ctaLabel: "Ver assets",
    ctaHref: "/client/dashboard",
    variant: "success",
  };
}
