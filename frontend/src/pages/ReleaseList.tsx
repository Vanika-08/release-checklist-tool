import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@apollo/client";
import { CREATE_RELEASE, GET_RELEASES, GET_STEPS, PAGE_SIZE } from "../graphql/operations";
import type { ReleaseDetail, ReleaseSummary, StepDef } from "../types";
import { errorMessage, formatDate, relativeDue } from "../format";
import { StatusBadge } from "../components/StatusBadge";
import { StepTrack } from "../components/StepTrack";
import { Modal } from "../components/Modal";
import { ReleaseForm, type ReleaseFormValues } from "../components/ReleaseForm";
import { ConfirmDelete } from "../components/ConfirmDelete";
import { Empty, ErrorState, Loading } from "../components/States";
import { useToast } from "../components/Toast";

export function ReleaseList() {
  const toast = useToast();
  const steps = useQuery<{ steps: StepDef[] }>(GET_STEPS);
  const { data, loading, error, refetch, fetchMore } = useQuery<{ releases: ReleaseSummary[]; releaseCount: number }>(
    GET_RELEASES,
    { variables: { limit: PAGE_SIZE, offset: 0 }, notifyOnNetworkStatusChange: true },
  );
  const [loadingMore, setLoadingMore] = useState(false);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<ReleaseSummary | null>(null);

  const [create, createState] = useMutation<{ createRelease: ReleaseDetail }>(CREATE_RELEASE, {
    // Insert into the cached list instead of refetching the whole list.
    update(cache, { data: res }) {
      if (!res) return;
      cache.updateQuery<{ releases: ReleaseSummary[]; releaseCount: number }>(
        { query: GET_RELEASES, variables: { limit: PAGE_SIZE, offset: 0 } },
        (prev) =>
          prev && {
            releases: [res.createRelease, ...prev.releases].sort((a, b) => b.date.localeCompare(a.date)),
            releaseCount: prev.releaseCount + 1,
          },
      );
    },
  });

  async function handleCreate(v: ReleaseFormValues) {
    try {
      await create({
        variables: {
          input: {
            name: v.name.trim(),
            date: new Date(v.date).toISOString(),
            additionalInfo: v.additionalInfo.trim() || null,
          },
        },
      });
      toast("success", `Created ${v.name.trim()}`);
      setCreating(false);
    } catch (e) {
      toast("error", errorMessage(e));
    }
  }

  const releases = data?.releases ?? [];
  const total = data?.releaseCount ?? 0;

  async function loadMore() {
    setLoadingMore(true);
    try {
      await fetchMore({ variables: { limit: PAGE_SIZE, offset: releases.length } });
    } catch (e) {
      toast("error", errorMessage(e));
    } finally {
      setLoadingMore(false);
    }
  }
  const stepDefs = steps.data?.steps ?? [];

  return (
    <main className="page">
      <div className="page__head">
        <div>
          <h1>Releases</h1>
          {data && <p className="muted">{total} release{total === 1 ? "" : "s"}</p>}
        </div>
        <button className="btn btn--primary" onClick={() => setCreating(true)}>New release</button>
      </div>

      {loading && !data && <Loading />}
      {error && !data && <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />}
      {data && releases.length === 0 && (
        <Empty title="No releases yet">
          <p className="muted">Create a release to get its 8-step checklist.</p>
          <button className="btn btn--primary" onClick={() => setCreating(true)}>New release</button>
        </Empty>
      )}

      {releases.length > 0 && (
        <div className="rlist" role="table" aria-label="Releases">
          <div className="rlist__head" role="row">
            <span role="columnheader">Release</span>
            <span role="columnheader">Due</span>
            <span role="columnheader">Status</span>
            <span role="columnheader">Progress</span>
            <span role="columnheader"><span className="sr-only">Actions</span></span>
          </div>
          {releases.map((r) => (
            <div className="rlist__row" role="row" key={r.id}>
              <span role="cell" className="rlist__namecell"><Link to={`/releases/${r.id}`} className="rlist__name">{r.name}</Link></span>
              <span role="cell" className="rlist__due">
                {formatDate(r.date)}
                <span className="muted small">{relativeDue(r.date)}</span>
              </span>
              <span role="cell"><StatusBadge status={r.status} /></span>
              <span role="cell" className="rlist__progress">
                {stepDefs.length > 0 && <StepTrack steps={stepDefs} completed={r.completedSteps} />}
                <span className="num">{r.completedCount}/{r.totalSteps}</span>
              </span>
              <span role="cell" className="rlist__actions">
                <Link to={`/releases/${r.id}`} className="btn btn--sm">Open</Link>
                <button className="btn btn--sm btn--ghost-danger" onClick={() => setToDelete(r)} aria-label={`Delete ${r.name}`}>
                  Delete
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {releases.length > 0 && releases.length < total && (
        <div className="more">
          <button className="btn" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Loading…" : `Load more (${total - releases.length} left)`}
          </button>
        </div>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="New release">
        {creating && (
          <ReleaseForm
            initial={{ name: "", date: "", additionalInfo: "" }}
            submitLabel="Create release"
            busyLabel="Creating…"
            busy={createState.loading}
            onSubmit={handleCreate}
            onCancel={() => setCreating(false)}
          />
        )}
      </Modal>
      <ConfirmDelete release={toDelete} onClose={() => setToDelete(null)} />
    </main>
  );
}
