import { reviewFollowUpAction } from "@/app/actions";
import { ConfirmButton } from "./ui/dialog";
import { ActionButton } from "./ui/forms";

export function FollowUpReview({ followUpId, canReview }: { followUpId: string; canReview: boolean }) {
  if (!canReview) return <span className="text-xs text-ink-subtle">Waiting for owner approval</span>;
  return (
    <div className="flex flex-wrap gap-2">
      <ActionButton
        action={reviewFollowUpAction.bind(null, followUpId, "APPROVED")}
        label="Approve"
        pendingLabel="Approving"
        className="btn-primary btn-sm"
      />
      <ConfirmButton
        action={reviewFollowUpAction.bind(null, followUpId, "REJECTED")}
        label="Reject"
        title="Reject this follow-up?"
        description="It will be marked rejected and kept in the project history. This can't be undone."
        confirmLabel="Reject follow-up"
      />
    </div>
  );
}
