import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb, MessageSquare, AlertTriangle, HelpCircle, Mic, Map, Sparkles } from "lucide-react";

export type ProposalSummary = {
  recommended_offering_code?: string;
  recommended_offering_name?: string;
  top_reasons?: string[];
  price_pitch_script?: string;
  qualifying_questions?: string[];
  red_flags?: string[];
};

export type ProposalFull = {
  opening_line?: string;
  customer_journey?: Array<{
    step_number: number;
    channel: string;
    what_happens: string;
    example: string;
    goal: string;
  }>;
  conversation_guide?: string[];
  objections?: Array<{ objection: string; response: string }>;
  copy_sparks?: {
    headlines?: string[];
    email_subjects?: string[];
    whatsapp?: string;
  };
};

export type ProposalDocument = {
  summary?: ProposalSummary;
  full?: ProposalFull;
};

export function ProposalSummaryView({ data }: { data: ProposalDocument }) {
  const summary = data?.summary || {};
  const full = data?.full || {};

  return (
    <div className="space-y-6">
      {/* Recommended offering */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Oferta recomendada
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold">{summary.recommended_offering_name || "—"}</span>
            {summary.recommended_offering_code && (
              <Badge variant="outline" className="font-mono text-xs">
                {summary.recommended_offering_code}
              </Badge>
            )}
          </div>
          {summary.top_reasons && summary.top_reasons.length > 0 && (
            <ul className="list-disc pl-5 space-y-1 text-sm">
              {summary.top_reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Pitch precio */}
      {summary.price_pitch_script && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5 text-primary" />
              Script de precio para la call
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-line italic">"{summary.price_pitch_script}"</p>
          </CardContent>
        </Card>
      )}

      {/* Qualifying questions */}
      {summary.qualifying_questions && summary.qualifying_questions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              Preguntas de cualificación
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal pl-5 space-y-1 text-sm">
              {summary.qualifying_questions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* Red flags */}
      {summary.red_flags && summary.red_flags.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Red flags
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              {summary.red_flags.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Opening line */}
      {full.opening_line && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Apertura de call
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm italic">"{full.opening_line}"</p>
          </CardContent>
        </Card>
      )}

      {/* Customer journey */}
      {full.customer_journey && full.customer_journey.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Map className="h-5 w-5 text-primary" />
              Customer journey
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {full.customer_journey.map((step) => (
              <div key={step.step_number} className="border-l-2 border-primary/30 pl-3">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="secondary">{step.step_number}</Badge>
                  <span className="text-sm font-medium">{step.channel}</span>
                </div>
                <p className="text-sm"><strong>Qué pasa:</strong> {step.what_happens}</p>
                {step.example && <p className="text-sm text-muted-foreground"><strong>Ejemplo:</strong> {step.example}</p>}
                {step.goal && <p className="text-sm text-muted-foreground"><strong>Meta:</strong> {step.goal}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Conversation guide */}
      {full.conversation_guide && full.conversation_guide.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              Guía de conversación
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal pl-5 space-y-1 text-sm">
              {full.conversation_guide.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* Objections */}
      {full.objections && full.objections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-primary" />
              Objeciones probables
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {full.objections.map((o, i) => (
              <div key={i} className="border rounded-md p-3">
                <p className="text-sm font-medium mb-1">❓ {o.objection}</p>
                <p className="text-sm text-muted-foreground">→ {o.response}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Copy sparks */}
      {full.copy_sparks && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              Copy sparks
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {full.copy_sparks.headlines && full.copy_sparks.headlines.length > 0 && (
              <div>
                <p className="font-medium mb-1">Headlines</p>
                <ul className="list-disc pl-5 space-y-1">
                  {full.copy_sparks.headlines.map((h, i) => <li key={i}>{h}</li>)}
                </ul>
              </div>
            )}
            {full.copy_sparks.email_subjects && full.copy_sparks.email_subjects.length > 0 && (
              <div>
                <p className="font-medium mb-1">Email subjects</p>
                <ul className="list-disc pl-5 space-y-1">
                  {full.copy_sparks.email_subjects.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}
            {full.copy_sparks.whatsapp && (
              <div>
                <p className="font-medium mb-1">WhatsApp</p>
                <p className="italic">"{full.copy_sparks.whatsapp}"</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
