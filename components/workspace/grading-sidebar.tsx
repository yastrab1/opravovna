"use client";
import { categoryLabel } from "@/lib/preferences";
import { tagName } from "@/lib/tags";
import { Check, Plus, ShieldCheck, Tag, X } from "lucide-react";
import { useEffect, useState } from "react";
export default function GradingSidebar({
  doc,
  readonly,
  busy,
  applyGrade,
  editor,
  projectTags,
  toggleTag,
  tag,
  setTag,
  changed,
}: {
  doc: any;
  readonly: boolean;
  busy: string;
  applyGrade: any;
  editor: any;
  projectTags: any[];
  toggleTag: any;
  tag: string;
  setTag: any;
  changed: any;
}) {
  return (
    <aside className="grading">
      <div className="eyebrow">HODNOTENIE</div>
      <h2>{doc.metadata.name}</h2>
      <dl>
        <div>
          <dt>Ročník / kód</dt>
          <dd>{categoryLabel(doc.metadata.rocnik)}</dd>
        </div>
        <div>
          <dt>Príklad</dt>
          <dd>{doc.metadata.problem}</dd>
        </div>
        <div>
          <dt>ID riešenia</dt>
          <dd>{doc.metadata.submissionId}</dd>
        </div>
      </dl>
      <div className="gradesection">
        <h3>Body</h3>
        <ScoreInput
          key={doc.id}
          points={doc.state.scoring?.points}
          disabled={readonly || !!busy}
          onApply={applyGrade}
        />
        {doc.state.scoring?.points != null && (
          <>
            <span className="gradedlabel">
              <Check size={14} /> {doc.state.scoring.points} bodov
            </span>
            {!readonly && (
              <button
                className="removegrade"
                disabled={!!busy}
                onClick={() => editor.current?.removeScore()}
              >
                Zrušiť hodnotenie
              </button>
            )}
          </>
        )}
      </div>
      <div className="gradesection">
        <h3>
          <Tag size={15} /> Štítky
        </h3>
        <div className="tags">
          {doc.state.tags.map((t: any, i: number) => (
            <span key={i}>
              {typeof t === "object" ? t.name : t}
              {!readonly && (
                <button
                  aria-label="Odobrať štítok"
                  onClick={() =>
                    changed({
                      ...doc.state,
                      tags: doc.state.tags.filter(
                        (_: any, j: number) => i !== j,
                      ),
                    })
                  }
                >
                  <X size={12} />
                </button>
              )}
            </span>
          ))}
        </div>
        {!readonly && (
          <>
            {projectTags.length > 0 && (
              <div className="projecttagpicker">
                <span className="muted">Štítky projektu</span>
                <div className="tagchoices">
                  {projectTags.map((t) => (
                    <button
                      type="button"
                      key={tagName(t)}
                      aria-pressed={doc.state.tags.some(
                        (v: any) => tagName(v) === tagName(t),
                      )}
                      onClick={() => toggleTag(t)}
                      disabled={!!busy}
                    >
                      {doc.state.tags.some(
                        (v: any) => tagName(v) === tagName(t),
                      ) ? (
                        <Check size={12} />
                      ) : (
                        <Plus size={12} />
                      )}{" "}
                      {tagName(t)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <form
              className="tagform"
              onSubmit={(e) => {
                e.preventDefault();
                const name = tag.trim();
                if (
                  name &&
                  !doc.state.tags.some((t: any) => tagName(t) === name)
                )
                  toggleTag(
                    projectTags.find((t) => tagName(t) === name) ?? name,
                  );
                setTag("");
              }}
            >
              <input
                aria-label="Nový štítok projektu"
                placeholder="Nový štítok projektu…"
                value={tag}
                maxLength={60}
                onChange={(e) => setTag(e.target.value)}
                disabled={!!busy}
              />
              <button
                aria-label="Vytvoriť a priradiť štítok"
                disabled={!!busy || !tag.trim()}
              >
                <Plus size={16} />
              </button>
            </form>
          </>
        )}
      </div>
      <div className="gradingfoot">
        <ShieldCheck size={17} />
        <p>
          {readonly
            ? "Máte prístup iba na čítanie."
            : "Zmeny sa ukladajú automaticky. Ostatným sa zobrazia do 5 sekúnd."}
        </p>
      </div>
    </aside>
  );
}
function ScoreInput({
  points,
  disabled,
  onApply,
}: {
  points?: number;
  disabled: boolean;
  onApply: (n: number) => void;
}) {
  const [draft, setDraft] = useState(points == null ? "" : String(points));
  useEffect(() => setDraft(points == null ? "" : String(points)), [points]);
  return (
    <form
      className="scoreform"
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number(draft.replace(",", "."));
        if (draft.trim() && Number.isFinite(n) && n >= 0) onApply(n);
      }}
    >
      <label htmlFor="score-input" className="sr-only">
        Počet bodov
      </label>
      <input
        id="score-input"
        aria-label="Počet bodov"
        type="number"
        min="0"
        step="any"
        placeholder="0,00"
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
      />
      <span>bodov</span>
      <button
        disabled={disabled || !draft.trim()}
        className="primary"
        type="submit"
      >
        Vložiť pečiatku
      </button>
    </form>
  );
}
