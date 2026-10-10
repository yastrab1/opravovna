"use client";
import { categoryLabel } from "@/lib/preferences";
import { X } from "lucide-react";
import VersionSummary from "./merge-preview";
export default function MergeDialog({
  mergeDialog,
  setMergeOpen,
  error,
  mergeConflicts,
  setMergeConflicts,
  busy,
  resolveMerge,
}: {
  mergeDialog: any;
  setMergeOpen: any;
  error: string;
  mergeConflicts: any[];
  setMergeConflicts: React.Dispatch<React.SetStateAction<any[]>>;
  busy: string;
  resolveMerge: any;
}) {
  return (
    <dialog
      ref={mergeDialog}
      className="merge-dialog"
      aria-labelledby="merge-title"
      onCancel={() => setMergeOpen(false)}
    >
      <div className="shareheading">
        <h2 id="merge-title">Vyberte verzie riešení</h2>
        <button
          aria-label="Zavrieť konflikty"
          onClick={() => setMergeOpen(false)}
        >
          <X size={18} />
        </button>
      </div>
      <p className="muted">
        Prvá verzia je uložená v projekte, druhá pochádza z nahraného archívu.
        Bezkonfliktné riešenia sú už zlúčené.
      </p>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <div className="merge-actions">
        <button
          onClick={() =>
            setMergeConflicts((old) =>
              old.map((x) => ({ ...x, choice: "first" })),
            )
          }
        >
          Všade prvá
        </button>
        <button
          onClick={() =>
            setMergeConflicts((old) =>
              old.map((x) => ({ ...x, choice: "second" })),
            )
          }
        >
          Všade druhá
        </button>
        <span>
          {mergeConflicts.filter((x) => x.choice).length} /{" "}
          {mergeConflicts.length} vybraných
        </span>
      </div>
      <div className="conflicts">
        {mergeConflicts.map((c) => (
          <section className="conflict" key={c.id}>
            <h3>
              {c.metadata.name}{" "}
              <small>
                {categoryLabel(c.metadata.rocnik)} · #{c.metadata.submissionId}
              </small>
            </h3>
            <div className="conflict-versions">
              {(["first", "second"] as const).map((version) => (
                <label
                  key={version}
                  className={c.choice === version ? "picked" : ""}
                >
                  <span className="version-heading">
                    <input
                      type="radio"
                      name={"merge-" + c.id}
                      value={version}
                      checked={c.choice === version}
                      onChange={() =>
                        setMergeConflicts((old) =>
                          old.map((x) =>
                            x.id === c.id ? { ...x, choice: version } : x,
                          ),
                        )
                      }
                    />
                    {version === "first"
                      ? "Prvá: v projekte"
                      : "Druhá: importovaná"}
                  </span>
                  <VersionSummary
                    state={c[version]}
                    project={c.projectId}
                    id={c.id}
                    pdf={version === "second" ? c.incomingPdf : undefined}
                  />
                </label>
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className="merge-bottom">
        <button onClick={() => setMergeOpen(false)}>Rozhodnúť neskôr</button>
        <button
          className="primary"
          disabled={!!busy || mergeConflicts.some((x) => !x.choice)}
          onClick={resolveMerge}
        >
          Potvrdiť zlúčenie
        </button>
      </div>
    </dialog>
  );
}
