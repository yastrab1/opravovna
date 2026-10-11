"use client";
import { categoryLabel } from "@/lib/preferences";
import ProjectTags from "./project-tags";
import { Check, ChevronRight, ShieldCheck } from "lucide-react";
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
  nextDocument,
  openNext,
  deleteProjectTag,
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
  nextDocument: any;
  openNext: () => Promise<void>;
  deleteProjectTag: any;
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
      <button
        type="button"
        className="nextsolution"
        onClick={openNext}
        disabled={!!busy || !nextDocument}
        title={
          nextDocument
            ? `Otvoriť: ${nextDocument.metadata.name}`
            : "Žiadne ďalšie neohodnotené riešenie vo vybraných kategóriách a filtroch"
        }
      >
        Ďalšie neohodnotené <ChevronRight size={16} />
      </button>
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
      <ProjectTags
        {...{
          doc,
          readonly,
          busy,
          projectTags,
          toggleTag,
          tag,
          setTag,
          changed,
          deleteProjectTag,
        }}
      />
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
