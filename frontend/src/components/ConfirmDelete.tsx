import { useMutation } from "@apollo/client";
import { DELETE_RELEASE } from "../graphql/operations";
import { errorMessage } from "../format";
import { Modal } from "./Modal";
import { useToast } from "./Toast";

export function ConfirmDelete({
  release,
  onClose,
  onDeleted,
}: {
  release: { id: string; name: string } | null;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const toast = useToast();
  const [remove, { loading }] = useMutation(DELETE_RELEASE, {
    update(cache, { data }) {
      if (!data) return;
      cache.evict({ id: cache.identify({ __typename: "Release", id: data.deleteRelease }) });
      cache.modify({ fields: { releaseCount: (n: number) => Math.max(0, n - 1) } });
      cache.gc();
    },
  });

  async function confirm() {
    if (!release) return;
    try {
      await remove({ variables: { id: release.id } });
      toast("success", `Deleted ${release.name}`);
      onClose();
      onDeleted?.();
    } catch (e) {
      toast("error", errorMessage(e));
    }
  }

  return (
    <Modal open={!!release} onClose={onClose} title="Delete this release?">
      <p className="muted">
        <strong>{release?.name}</strong> and its checklist progress will be removed. This can't be undone.
      </p>
      <div className="modal__actions">
        <button className="btn" onClick={onClose} disabled={loading}>Keep release</button>
        <button className="btn btn--danger" onClick={confirm} disabled={loading}>
          {loading ? "Deleting…" : "Delete release"}
        </button>
      </div>
    </Modal>
  );
}
