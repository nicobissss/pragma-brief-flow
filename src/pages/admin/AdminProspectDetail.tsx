import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { ProposalView, type ProposalData } from "@/components/proposal/ProposalView";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
const MARKETS = [
  { value: "es", label: "España" },
  { value: "it", label: "Italia" },
  { value: "ar", label: "Argentina" },
] as const;
import { toast } from "sonner";
import { Loader2, Archive, ChevronLeft } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import SalesCallCard from "@/components/prospect/SalesCallCard";
import ProspectInfoTable from "@/components/admin/ProspectInfoTable";
import ProspectInternalNotes from "@/components/admin/ProspectInternalNotes";

type Prospect = {
  id: string;
  name: string;
  company_name: string;
  email: string;
  phone: string | null;
  vertical: string;
  sub_niche: string;
  market: string;
  status: string;
  briefing_answers: Record<string, any>;
  created_at: string;
  call_status: string;
  call_scheduled_at: string | null;
  call_notes: string | null;
  follow_up_date: string | null;
};



export default function AdminProspectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [prospect, setProspect] = useState<Prospect | null>(null);
  const [loading, setLoading] = useState(true);
  const [proposal, setProposal] = useState<any>(null);
  const [proposalDate, setProposalDate] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loadingProposal, setLoadingProposal] = useState(true);

  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const [prospectRes, proposalRes] = await Promise.all([
        supabase.from("prospects").select("*").eq("id", id!).single(),
        supabase.from("proposals").select("*").eq("prospect_id", id!).maybeSingle(),
      ]);
      setProspect(prospectRes.data as Prospect | null);
      if (proposalRes.data?.full_proposal_content) {
        setProposal(proposalRes.data.full_proposal_content);
        setProposalDate(proposalRes.data.created_at);
      }
      setLoading(false);
      setLoadingProposal(false);
    };
    fetchData();
  }, [id]);

  const generateProposal = async () => {
    if (!prospect) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-proposal", {
        body: { prospect_id: prospect.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setProposal(data.proposal);
      setProposalDate(new Date().toISOString());
      toast.success("Proposal generated successfully!");
    } catch (e: any) {
      toast.error(e.message || "Failed to generate proposal");
    } finally {
      setGenerating(false);
    }
  };

  const updateStatus = async (status: "new" | "proposal_ready" | "call_scheduled" | "accepted" | "rejected" | "archived") => {
    if (!prospect) return;
    const { error } = await supabase.from("prospects").update({ status }).eq("id", prospect.id);
    if (error) { toast.error(error.message); return; }
    setProspect({ ...prospect, status });
    return true;
  };

  const handleMarkReady = async () => {
    const ok = await updateStatus("proposal_ready");
    if (ok) toast.success("Proposal marked as ready");
  };

  const handleAccept = async () => {
    if (!prospect) return;
    setAccepting(true);
    try {
      const { data, error } = await supabase.functions.invoke("accept-prospect", {
        body: { prospect_id: prospect.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setProspect({ ...prospect, status: "accepted" });
      try {
        await supabase.from("events").insert({
          event_type: "prospect.accepted",
          entity_type: "prospect",
          entity_id: prospect.id,
          payload: { name: prospect.name, vertical: prospect.vertical, market: prospect.market },
        } as any);
      } catch (_) {}
      toast.success(
        `Client account created successfully.\nEmail: ${prospect.email}\nPassword: Pragma2026!\nThey will be prompted to change it on first login.`,
        { duration: 10000 }
      );
      setAcceptDialogOpen(false);
      if (data?.client_id) navigate(`/admin/client/${data.client_id}`);
    } catch (e: any) {
      toast.error(e.message || "Failed to accept prospect");
    } finally {
      setAccepting(false);
    }
  };

  const handleReject = async () => {
    if (!prospect) return;
    setRejecting(true);
    try {
      const { error } = await supabase.from("prospects").update({
        status: "rejected" as any,
        briefing_answers: {
          ...prospect.briefing_answers,
          _rejection_reason: rejectReason || undefined,
        },
      }).eq("id", prospect.id);
      if (error) throw error;
      setProspect({ ...prospect, status: "rejected" });
      toast.success("Prospect rejected");
      setRejectDialogOpen(false);
      setRejectReason("");
    } catch (e: any) {
      toast.error(e.message || "Failed to reject prospect");
    } finally {
      setRejecting(false);
    }
  };

  const handleArchive = async () => {
    if (!prospect) return;
    const { error } = await supabase.from("prospects").update({ status: "archived" as any }).eq("id", prospect.id);
    if (error) { toast.error(error.message); return; }
    try {
      await supabase.from("events").insert({
        event_type: "prospect.archived",
        entity_type: "prospect",
        entity_id: prospect.id,
        payload: { name: prospect.name },
      } as any);
    } catch (_) {}
    toast.success("Prospect archived");
    navigate("/admin/prospects");
  };

  const handleSaveProposal = async (updatedData: ProposalData) => {
    if (!prospect) return;
    const { error } = await supabase
      .from("proposals")
      .update({ full_proposal_content: updatedData as any })
      .eq("prospect_id", prospect.id);
    if (error) {
      toast.error("Failed to save proposal changes");
      return;
    }
    setProposal(updatedData);
    toast.success("Proposal changes saved");
  };

  const handleCallUpdate = (fields: Record<string, any>) => {
    if (!prospect) return;
    setProspect({ ...prospect, ...fields });
  };

  if (loading) return (
    <div className="p-8 max-w-4xl space-y-4">
      <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
      <div className="h-4 w-64 animate-pulse rounded bg-muted" />
      {[1,2,3].map(i => <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />)}
    </div>
  );
  if (!prospect) return (
    <div className="p-8 max-w-4xl">
      <div className="bg-card rounded-lg border border-border p-8 text-center space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Prospect not found</h2>
        <p className="text-sm text-muted-foreground">This prospect may have been deleted or you don't have access.</p>
        <Button variant="outline" onClick={() => navigate("/admin/prospects")}>Back to Prospects</Button>
      </div>
    </div>
  );

  const answers = prospect.briefing_answers || {};
  const marketLabel = MARKETS.find((m) => m.value === prospect.market)?.label || prospect.market;

  return (
    <div className="p-8 max-w-4xl">
      <Button variant="ghost" size="sm" onClick={() => navigate("/admin/prospects")} className="mb-4">
        <ChevronLeft className="w-4 h-4 mr-1" /> Volver a prospects
      </Button>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{prospect.name}</h1>
          <p className="text-muted-foreground">{prospect.company_name} · {prospect.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={prospect.status} />
          {prospect.status !== "archived" && (
            <Button variant="outline" size="sm" onClick={() => setArchiveDialogOpen(true)}>
              <Archive className="w-4 h-4 mr-1" /> Archivar
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="briefing">
        <TabsList>
          <TabsTrigger value="briefing">Briefing</TabsTrigger>
          <TabsTrigger value="proposal">{proposal ? "View Proposal" : "Proposal"}</TabsTrigger>
        </TabsList>

        <TabsContent value="briefing" className="mt-6 space-y-6">
          {/* Pre-cualificación card */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Pre-cualificación
            </h3>
            <div className="space-y-2">
              {([
                ["País", prospect.market === "es" ? "España" : prospect.market === "it" ? "Italia" : "Argentina"],
                ["Sector", prospect.vertical],
                ["Especialización", prospect.sub_niche],
                ["Ticket medio", answers.average_ticket
                  ? `${answers.average_ticket} ${answers.ticket_currency || "EUR"}`
                  : null],
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
          </div>

          <ProspectInfoTable
            prospect={prospect}
            marketLabel={marketLabel}
            onUpdated={(p) => setProspect(p as Prospect)}
          />

          <ProspectInternalNotes
            prospectId={prospect.id}
            briefingAnswers={prospect.briefing_answers || {}}
            onUpdated={(answers) => setProspect({ ...prospect, briefing_answers: answers })}
          />
        </TabsContent>

        <TabsContent value="proposal" className="mt-6 space-y-6">
          {!proposal && !generating && !loadingProposal && (
            <div className="bg-card rounded-lg border border-border p-8 text-center">
              <p className="text-muted-foreground mb-4">No proposal generated yet. Click below to analyze the briefing and generate a full proposal.</p>
              <Button onClick={generateProposal} size="lg">Generate Proposal</Button>
            </div>
          )}

          {generating && (
            <div className="bg-card rounded-lg border border-border p-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
              <p className="text-foreground font-medium">Analyzing briefing and generating proposal...</p>
              <p className="text-muted-foreground text-sm mt-1">This may take 20–30 seconds</p>
            </div>
          )}

          {proposal && !generating && (
            <>
              {proposalDate && (
                <p className="text-muted-foreground text-sm">
                  Last generated: {new Date(proposalDate).toLocaleString()}
                </p>
              )}
              <ProposalView data={proposal} editable={true} onSave={handleSaveProposal} />

              <SalesCallCard
                prospectId={prospect.id}
                callStatus={prospect.call_status as any}
                callScheduledAt={prospect.call_scheduled_at}
                callNotes={prospect.call_notes}
                followUpDate={prospect.follow_up_date}
                onUpdate={handleCallUpdate}
              />

              <div className="flex flex-wrap gap-3 pt-4 border-t border-border">
                <Button onClick={generateProposal} variant="outline">Regenerate</Button>
                <Button onClick={handleMarkReady} disabled={prospect.status === "proposal_ready"}>
                  Mark as Ready
                </Button>
                <Button
                  onClick={() => setAcceptDialogOpen(true)}
                  variant="outline"
                  className="border-[hsl(142,71%,35%)] text-[hsl(142,71%,35%)] hover:bg-[hsl(142,71%,35%)]/10"
                  disabled={prospect.status === "accepted"}
                >
                  Prospect Accepted
                </Button>
                <Button
                  onClick={() => setRejectDialogOpen(true)}
                  variant="destructive"
                  disabled={prospect.status === "rejected"}
                >
                  Prospect Rejected
                </Button>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Accept CTA at the bottom */}
      {prospect.status !== "accepted" && prospect.status !== "archived" && (
        <div className="mt-8 pt-6 border-t border-border">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">¿Listo para aceptar este prospect?</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Se creará su cuenta de cliente y recibirá el email de bienvenida.
              </p>
            </div>
            <Button
              onClick={() => setAcceptDialogOpen(true)}
              disabled={accepting}
              className="bg-green-600 hover:bg-green-700 text-white rounded-full px-6"
            >
              {accepting ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" />Procesando...</>
              ) : (
                "Aceptar prospect →"
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Archive confirmation */}
      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Archivar prospect?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{prospect.name}</strong> será archivado. Podrás verlo activando "Mostrar archivados" en la lista.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive}>Archivar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Accept confirmation dialog */}
      <Dialog open={acceptDialogOpen} onOpenChange={setAcceptDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Accept prospect?</DialogTitle>
            <DialogDescription>
              This will create a client account for <strong>{prospect.name}</strong> at{" "}
              <strong>{prospect.email}</strong>. An invite email with login credentials will be sent automatically.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAcceptDialogOpen(false)} disabled={accepting}>
              Cancel
            </Button>
            <Button onClick={handleAccept} disabled={accepting}>
              {accepting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog with optional reason */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject prospect?</DialogTitle>
            <DialogDescription>
              Optionally provide a reason for rejecting <strong>{prospect.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for rejection (optional)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="min-h-[80px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectDialogOpen(false); setRejectReason(""); }} disabled={rejecting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={rejecting}>
              {rejecting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
