"use client";
import { parsePoints, type InvalidScore } from "@/lib/import/prepare-scores";
import { useEffect, useRef, useState } from "react";

export default function ImportScoreDialog({
  issues,
  finish,
}: {
  issues: InvalidScore[];
  finish: (scores: Record<string, number> | null) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="merge-dialog"
      aria-labelledby="import-score-title"
      onCancel={(event) => {
        event.preventDefault();
        finish(null);
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const corrected: Record<string, number> = {};
          for (const issue of issues) {
            const points = parsePoints(values[issue.path]);
            if (points == null) return;
            corrected[issue.path] = points;
          }
          finish(corrected);
        }}
      >
        <h2 id="import-score-title">Opravte body v importe</h2>
        <p>
          Niektoré hodnotenia nie sú platné. Zadajte nezáporné číslo; povolené
          sú aj desatinné body a hodnoty nad 5.
        </p>
        <div className="import-score-list">
          {issues.map((issue, index) => (
            <label key={issue.path} className="import-score-row">
              <span>
                <strong>{issue.name}</strong>
                <small>{issue.path}</small>
                <small>Pôvodné body: {String(issue.original)}</small>
              </span>
              <input
                autoFocus={index === 0}
                aria-label={`Nové body: ${issue.name}`}
                type="number"
                min="0"
                step="any"
                required
                value={values[issue.path] ?? ""}
                onChange={(event) =>
                  setValues({ ...values, [issue.path]: event.target.value })
                }
              />
            </label>
          ))}
        </div>
        <div className="shareactions">
          <button type="button" onClick={() => finish(null)}>
            Zrušiť import
          </button>
          <button type="submit" className="primary">
            Opraviť body a pokračovať
          </button>
        </div>
      </form>
    </dialog>
  );
}
