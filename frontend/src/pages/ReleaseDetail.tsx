import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@apollo/client";
import { GET_RELEASE, TOGGLE_STEP, UPDATE_ADDITIONAL_INFO, UPDATE_RELEASE } from "../graphql/operations";
import type { ReleaseDetail as TRelease } from "../types";
import { errorMessage, formatDate, relativeDue, toLocalInput } from "../format";
import { StatusBadge } from "../components/StatusBadge";
import { StepTrack } from "../components/StepTrack";
import { Modal } from "../components/Modal";
import { ReleaseForm, type ReleaseFormValues } from "../components/ReleaseForm";
import { ConfirmDelete } from "../components/ConfirmDelete";
import { Empty, ErrorState, Loading } from "../components/States";
import { useToast } from "../components/Toast";

export function ReleaseDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data, loading, error, refetch } = useQuery<{ release: TRelease | null }>(GET_RELEASE, { variables: { id } });
  const [pendingStep, setPendingStep] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [infoDraft, setInfoDraft] = useState<string | null>(null);

  const [toggle] = useMutation(TOGGLE_STEP);
  const [updateRelease, updateState] = useMutation(UPDATE_RELEASE);
  const [updateInfo, infoState] = useMutation(UPDATE_ADDITIONAL_INFO);

  if (loading && !data) return <main className="page"><Loading label="Loading release" /></main>;
  if (error && !data) return <main className="page"><ErrorState message={errorMessage(error)} onRetry={() => refetch()} /></main>;
  const r = data?.release;
  if (!r)
    return (
      <main className="page">
        <Empty title="Release not found">
          <p className="muted">It may have been deleted.</p>
          <Link to="/" className="btn">Back to releases</Link>
        </Empty>
      </main>
    );

  // No optimistic update: status is computed by the server, so we show the
  // server's answer rather than re-implementing the rule in the browser.
  async function onToggle(stepId: string, completed: boolean) {
    setPendingStep(stepId);
    try {
      await toggle({ variables: { releaseId: r!.id, stepId, completed } });
    } catch (e) {
      toast("error", errorMessage(e));
    } finally {
      setPendingStep(null);
    }
  }

  async function onEdit(v: ReleaseFormValues) {
    try {
      await updateRelease({ variables: { id: r!.id, input: { name: v.name.trim(), date: new Date(v.date).toISOString() } } });
      toast("success", "Release updated");
      setEditing(false);
    } catch (e) {
      toast("error", errorMessage(e));
    }
  }

  async function saveInfo() {
    try {
      await updateInfo({ variables: { id: r!.id, additionalInfo: infoDraft?.trim() ? infoDraft : null } });
      toast("success", "Additional information saved");
      setInfoDraft(null);
    } catch (e) {
      toast("error", errorMessage(e));
    }
  }

  return (
    <main className="page">
      <Link to="/" className="backlink">All releases</Link>

      <header className="detail__head">
        <div className="detail__title">
          <h1>{r.name}</h1>
          <StatusBadge status={r.status} />
        </div>
        <p className="muted">Due {formatDate(r.date)} ({relativeDue(r.date)})</p>
        <div className="detail__progress">
          <StepTrack steps={r.steps} completed={r.completedSteps} size="lg" />
          <span className="num"><strong>{r.completedCount}</strong> of {r.totalSteps} steps done</span>
        </div>
      </header>

      <div className="detail__grid">
        <section aria-labelledby="checklist-h" className="panel">
          <h2 id="checklist-h" className="panel__title">Checklist</h2>
          <ol className="checklist">
            {r.steps.map((s) => (
              <li key={s.id} className={s.completed ? "check is-done" : "check"}>
                <label className="check__label">
                  <input
                    type="checkbox"
                    checked={s.completed}
                    disabled={pendingStep === s.id}
                    onChange={(e) => onToggle(s.id, e.target.checked)}
                  />
                  <span className="check__num num">{s.order}</span>
                  <span className="check__text">
                    <span className="check__name">{s.name}</span>
                    <span className="check__desc">{s.description}</span>
                  </span>
                </label>
              </li>
            ))}
          </ol>
        </section>

        <aside className="side">
          <section className="panel" aria-labelledby="info-h">
            <div className="panel__row">
              <h2 id="info-h" className="panel__title">Additional information</h2>
              {infoDraft === null && (
                <button className="btn btn--sm" onClick={() => setInfoDraft(r.additionalInfo ?? "")}>
                  {r.additionalInfo ? "Edit" : "Add"}
                </button>
              )}
            </div>
            {infoDraft === null ? (
              r.additionalInfo ? <p className="info">{r.additionalInfo}</p> : <p className="muted">Nothing noted yet.</p>
            ) : (
              <>
                <textarea
                  className="info-edit"
                  rows={6}
                  autoFocus
                  value={infoDraft}
                  onChange={(e) => setInfoDraft(e.target.value)}
                  placeholder="Rollback plan, dependencies, owners…"
                  maxLength={5000}
                />
                <div className="panel__actions">
                  <button className="btn" onClick={() => setInfoDraft(null)} disabled={infoState.loading}>Cancel</button>
                  <button className="btn btn--primary" onClick={saveInfo} disabled={infoState.loading}>
                    {infoState.loading ? "Saving…" : "Save"}
                  </button>
                </div>
              </>
            )}
          </section>

          <section className="panel" aria-labelledby="meta-h">
            <h2 id="meta-h" className="panel__title">Details</h2>
            <dl className="meta">
              <dt>Due</dt><dd>{formatDate(r.date)}</dd>
              <dt>Created</dt><dd>{formatDate(r.createdAt)}</dd>
              <dt>Updated</dt><dd>{formatDate(r.updatedAt)}</dd>
            </dl>
            <div className="panel__actions">
              <button className="btn" onClick={() => setEditing(true)}>Edit name or date</button>
              <button className="btn btn--ghost-danger" onClick={() => setDeleting(true)}>Delete release</button>
            </div>
          </section>
        </aside>
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title="Edit release">
        {editing && (
          <ReleaseForm
            initial={{ name: r.name, date: toLocalInput(r.date), additionalInfo: "" }}
            showInfo={false}
            submitLabel="Save changes"
            busyLabel="Saving…"
            busy={updateState.loading}
            onSubmit={onEdit}
            onCancel={() => setEditing(false)}
          />
        )}
      </Modal>
      <ConfirmDelete
        release={deleting ? r : null}
        onClose={() => setDeleting(false)}
        onDeleted={() => navigate("/")}
      />
    </main>
  );
}
