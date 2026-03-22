const statusClasses: Record<string, string> = {
  new: "badge-new",
  proposal_ready: "badge-new",
  call_scheduled: "badge-new",
  accepted: "badge-accepted",
  active: "badge-accepted",
  approved: "badge-accepted",
  rejected: "badge-rejected",
  churned: "badge-rejected",
  archived: "badge-paused",
  paused: "badge-paused",
  pending_review: "badge-pending",
  change_requested: "badge-paused",
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
    <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium ${statusClasses[status] || "badge-pending"}`}>
      {statusLabels[status] || status}
    </span>
  );
}
