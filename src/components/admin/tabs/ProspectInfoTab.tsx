import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { ProposalView, type ProposalData } from "@/components/proposal/ProposalView";

function InfoRow({ label, value }: { label: string; value: any }) {
  if (value === null || value === undefined || value === "") return null;
  const display = Array.isArray(value) ? value.join(", ") : String(value);
  return (
    <div className="flex justify-between py-2 border-b border-border last:border-0">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-foreground text-sm font-medium text-right max-w-[60%]">{display}</span>
    </div>
  );
}

type Props = {
  client: any;
  prospect: any | null;
  proposal: ProposalData | null;
  marketLabel: string;
  notes: any[];
  newNote: string;
  setNewNote: (v: string) => void;
  noteAuthor: string;
  setNoteAuthor: (v: string) => void;
  onSaveNote: () => void;
  /** @deprecated kept for compatibility; no longer used */
  onCallUpdate?: (fields: Record<string, any>) => void;
  /** @deprecated kept for compatibility; no longer used */
  onSharePlan?: () => void;
};

export default function ProspectInfoTab({
  client, prospect, proposal, marketLabel,
  notes, newNote, setNewNote, noteAuthor, setNoteAuthor, onSaveNote,
}: Props) {
  const answers = prospect?.briefing_answers || {};
  return (
    <div className="space-y-6">
      {prospect ? (
        <>
          <Collapsible>
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <CollapsibleTrigger className="w-full flex items-center justify-between p-5 hover:bg-secondary/30 transition-colors">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Ver pre-cualificación</h3>
                <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-5 pb-5 space-y-2">
                  {([
                    ["País", client.market === "es" ? "España" : client.market === "it" ? "Italia" : "Argentina"],
                    ["Sector", client.vertical],
                    ["Especialización", client.sub_niche],
                    ["Ticket medio", answers.average_ticket ? `${answers.average_ticket} ${answers.ticket_currency || "EUR"}` : null],
                  ] as [string, string | null][]).filter(([, v]) => v).map(([label, value]) => (
                    <div key={label} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium">{value}</span>
                    </div>
                  ))}
                  {answers.description && (
                    <div className="pt-2 border-t border-border text-sm space-y-1">
                      <span className="text-muted-foreground text-xs uppercase tracking-wide">Descripción</span>
                      <p>{answers.description}</p>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>

          <div className="bg-card rounded-lg border border-border p-6">
            <h3 className="font-semibold text-foreground mb-4">About the Business</h3>
            <InfoRow label="Full name" value={prospect.name} />
            <InfoRow label="Company" value={prospect.company_name} />
            <InfoRow label="Email" value={prospect.email} />
            <InfoRow label="Phone" value={prospect.phone} />
            <InfoRow label="Market" value={marketLabel} />
            <InfoRow label="Vertical" value={prospect.vertical} />
            <InfoRow label="Sub-niche" value={prospect.sub_niche} />
          </div>

          <div className="bg-card rounded-lg border border-border p-6">
            <h3 className="font-semibold text-foreground mb-4">Current Situation</h3>
            <InfoRow label="Years in operation" value={answers.years_in_operation} />
            <InfoRow label="Monthly new clients" value={answers.monthly_new_clients} />
            <InfoRow label="Client sources" value={answers.client_sources} />
            <InfoRow label="Runs paid ads" value={answers.runs_paid_ads} />
            <InfoRow label="Ad platforms" value={answers.ad_platforms} />
            <InfoRow label="Monthly budget" value={answers.monthly_budget} />
            <InfoRow label="Has email list" value={answers.has_email_list} />
            <InfoRow label="Email list size" value={answers.email_list_size} />
            <InfoRow label="Has website" value={answers.has_website} />
            <InfoRow label="Website URL" value={answers.website_url} />
            <InfoRow label="Uses CRM" value={answers.uses_crm} />
            <InfoRow label="CRM system" value={answers.crm_name} />
          </div>

          <div className="bg-card rounded-lg border border-border p-6">
            <h3 className="font-semibold text-foreground mb-4">Goals</h3>
            <InfoRow label="Main goal" value={answers.main_goal} />
            <InfoRow label="Average ticket" value={answers.average_ticket ? `${answers.average_ticket} ${answers.ticket_currency || "EUR"}` : undefined} />
            <InfoRow label="Biggest challenge" value={answers.biggest_challenge} />
            <InfoRow label="Differentiator" value={answers.differentiator} />
            <InfoRow label="Additional info" value={answers.additional_info} />
          </div>

          {proposal && (
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground text-lg">Generated Proposal</h3>
              <ProposalView data={proposal} editable={false} />
            </div>
          )}
        </>
      ) : (
        <div className="bg-card rounded-lg border border-border p-8 text-center text-muted-foreground">
          No prospect data linked to this client.
        </div>
      )}

      <div className="bg-card rounded-lg border border-border p-6 space-y-4">
        <h3 className="font-semibold text-foreground">Notas internas</h3>
        <p className="text-xs text-muted-foreground">Solo visibles para el equipo PRAGMA — nunca para el cliente.</p>
        <div className="flex gap-2">
          <Textarea placeholder="Escribe una nota..." value={newNote} onChange={(e) => setNewNote(e.target.value)} className="min-h-[60px] flex-1" />
          <div className="flex flex-col gap-2">
            <Select value={noteAuthor} onValueChange={setNoteAuthor}>
              <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Nicolò">Nicolò</SelectItem>
                <SelectItem value="Karla">Karla</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={onSaveNote} disabled={!newNote.trim()}>Guardar</Button>
          </div>
        </div>
        {notes.length > 0 && (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {notes.map((n) => (
              <div key={n.id} className="p-3 rounded-md bg-secondary/30 text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-foreground">{n.author || "—"}</span>
                  <span className="text-xs text-muted-foreground">{format(new Date(n.created_at!), "dd MMM yyyy HH:mm")}</span>
                </div>
                <p className="text-muted-foreground">{n.note}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
