import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { ProposalView, type ProposalData } from "@/components/proposal/ProposalView";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { MARKETS } from "@/lib/briefing-data";
import { toast } from "sonner";
import { Loader2, Archive } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import SalesCallCard from "@/components/prospect/SalesCallCard";

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

      // Show Briefer result from edge function
      if (data?.briefer_sent) {
        toast.success("✅ Client created in Briefer", { duration: 5000 });
      } else if (data?.briefer_error) {
        toast.error("⚠️ Briefer not connected. Add client manually in Briefer.", { duration: 8000 });
      }

      toast.success(
        `Client account created successfully.\nEmail: ${prospect.email}\nPassword: Pragma2026!`,
        { duration: 10000 }
      );
      setAcceptDialogOpen(false);

      if (data?.client_id) {
        navigate(`/admin/client/${data.client_id}`);
      }
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
    const ok = await updateStatus("archived");
    if (ok) toast.success("Prospect archived");
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

  if (loading) return <div className="p-8 text-muted-foreground">Loading...</div>;
  if (!prospect) return <div className="p-8 text-muted-foreground">Prospect not found.</div>;

  const answers = prospect.briefing_answers || {};
  const marketLabel = MARKETS.find((m) => m.value === prospect.market)?.label || prospect.market;

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{prospect.name}</h1>
          <p className="text-muted-foreground">{prospect.company_name} · {prospect.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={prospect.status} />
          {prospect.status !== "archived" && (
            <Button variant="ghost" size="icon" onClick={handleArchive} title="Archive">
              <Archive className="w-4 h-4 text-muted-foreground" />
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="briefing">
        <TabsList>
          <TabsTrigger value="briefing">Briefing</TabsTrigger>
          <TabsTrigger value="proposal">{proposal ? "View Proposal" : "Proposal"}</TabsTrigger>
          <TabsTrigger value="sales">Sales Call</TabsTrigger>
        </TabsList>

        <TabsContent value="briefing" className="mt-6 space-y-6">
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
        </TabsContent>

        <TabsContent value="proposal" className="mt-6 space-y-6">
          {!proposal && !generating && !loadingProposal && (
            <div className="bg-card rounded-lg border border-border p-8 text-center">
              <p className="text-muted-foreground mb-4">No proposal generated yet.</p>
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
              <div className="flex flex-wrap gap-3 pt-4 border-t border-border">
                <Button onClick={generateProposal} variant="outline">Regenerate</Button>
                <Button onClick={handleMarkReady} disabled={prospect.status === "proposal_ready"}>
                  Mark as Ready
                </Button>
                <Button
                  onClick={() => setAcceptDialogOpen(true)}
                  variant="outline"
                  className="border-status-accepted text-status-accepted hover:bg-status-accepted/10"
                  disabled={prospect.status === "accepted"}
                >
                  Prospect Accepted
                </Button>
                <Button
                  onClick={() => setRejectDialogOpen(true)}
                  variant="outline"
                  className="border-status-rejected text-status-rejected hover:bg-status-rejected/10"
                  disabled={prospect.status === "rejected"}
                >
                  Prospect Rejected
                </Button>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="sales" className="mt-6">
          <SalesCallCard
            prospectId={prospect.id}
            callStatus={prospect.call_status as any}
            callScheduledAt={prospect.call_scheduled_at}
            callNotes={prospect.call_notes}
            followUpDate={prospect.follow_up_date}
            onUpdate={handleCallUpdate}
          />
        </TabsContent>
      </Tabs>

      {/* Accept dialog */}
      <Dialog open={acceptDialogOpen} onOpenChange={setAcceptDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Accept prospect?</DialogTitle>
            <DialogDescription>
              This will create a client account for <strong>{prospect.name}</strong> at{" "}
              <strong>{prospect.email}</strong> and send data to Briefer if configured.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAcceptDialogOpen(false)} disabled={accepting}>Cancel</Button>
            <Button onClick={handleAccept} disabled={accepting}>
              {accepting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
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
            <Button variant="outline" onClick={() => { setRejectDialogOpen(false); setRejectReason(""); }} disabled={rejecting}>Cancel</Button>
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
