import { Badge } from "@/components/ui/badge";

const statusColors: Record<string, string> = {
  new: "bg-status-new",
  proposal_ready: "bg-status-proposal-ready",
  call_scheduled: "bg-status-call-scheduled",
  accepted: "bg-status-accepted",
  rejected: "bg-status-rejected",
  archived: "bg-muted",
  active: "bg-status-accepted",
  paused: "bg-status-change-requested",
  churned: "bg-status-rejected",
  pending_review: "bg-status-pending-review",
  change_requested: "bg-status-change-requested",
  approved: "bg-status-approved",
};

const statusLabels: Record<string, string> = {
  new: "New",
  proposal_ready: "Proposal Ready",
  call_scheduled: "Call Scheduled",
  accepted: "Accepted",
  rejected: "Rejected",
  archived: "Archived",
  active: "Active",
  paused: "Paused",
  churned: "Churned",
  pending_review: "Pending Review",
  change_requested: "Changes Requested",
  approved: "Approved",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge className={`${statusColors[status] || "bg-muted"} text-primary-foreground border-0 font-medium text-xs`}>
      {statusLabels[status] || status}
    </Badge>
  );
}
