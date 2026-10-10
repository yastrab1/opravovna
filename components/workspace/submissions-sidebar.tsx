"use client";
import PointsFilter from "./points-filter";
import { emptyPointsFilter } from "@/lib/points-filter";
import Thumbnail from "@/app/thumbnail";
import { categoryLabel } from "@/lib/preferences";
import { tagName } from "@/lib/tags";
import { Check, Search, Upload } from "lucide-react";
export default function SubmissionsSidebar({
  project,
  readonly,
  busy,
  importZip,
  query,
  setQuery,
  projectPreferences,
  setProjectPreferences,
  filter,
  setFilter,
  allTags,
  tagFilter,
  setTagFilter,
  categories,
  categoryOptions,
  setCategories,
  documents,
  active,
  switchDoc,
}: {
  project: any;
  readonly: boolean;
  busy: string;
  importZip: any;
  query: string;
  setQuery: any;
  projectPreferences: any;
  setProjectPreferences: any;
  filter: string;
  setFilter: any;
  allTags: string[];
  tagFilter: string;
  setTagFilter: any;
  categories: string[];
  categoryOptions: string[];
  setCategories: (values: string[]) => void;
  documents: any[];
  active: any;
  switchDoc: any;
}) {
  return (
    <aside className="submissions">
      <div className="listheading">
        <h2>
          Riešenia <span>{project.documents.length}</span>
        </h2>
        {!readonly && (
          <label
            className={"iconbutton " + (busy ? "disabled" : "")}
            title="Importovať ZIP"
          >
            <Upload size={17} />
            <input
              type="file"
              accept=".zip"
              aria-label="Importovať ZIP"
              hidden
              disabled={!!busy}
              onChange={(e) => {
                if (e.target.files?.[0]) importZip(e.target.files[0]);
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>
      <div className="search">
        <Search size={16} />
        <input
          aria-label="Hľadať riešenie"
          placeholder="Meno, ID alebo ročník…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="filters">
        <select
          aria-label="Zoradiť riešenia"
          value={projectPreferences.sort}
          onChange={(e) =>
            setProjectPreferences({ sort: e.target.value as "name" | "graded" })
          }
        >
          <option value="name">Abecedne</option>
          <option value="graded">Opravené najprv</option>
        </select>
        <select
          aria-label="Filtrovať hodnotenie"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">Všetky riešenia</option>
          <option value="ungraded">Bez hodnotenia</option>
          <option value="graded">Ohodnotené</option>
        </select>
        {allTags.length > 0 && (
          <select
            aria-label="Filtrovať štítok"
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
          >
            <option value="">Všetky štítky</option>
            {allTags.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        )}
      </div>
      <PointsFilter
        value={projectPreferences.points ?? emptyPointsFilter}
        onChange={(points) => setProjectPreferences({ points })}
      />
      <details className="categoryfilter">
        <summary>
          Kategórie {categories.length ? `(${categories.length})` : "(všetky)"}
        </summary>
        <div>
          {categoryOptions.map((c) => (
            <label key={c}>
              <input
                type="checkbox"
                checked={categories.includes(c)}
                onChange={(e) =>
                  setCategories(
                    e.target.checked
                      ? [...categories, c]
                      : categories.filter((x) => x !== c),
                  )
                }
              />{" "}
              {categoryLabel(c)}
            </label>
          ))}
          {categories.length > 0 && (
            <button onClick={() => setCategories([])}>Zobraziť všetky</button>
          )}
        </div>
      </details>
      <div className="documentlist">
        {documents.map((d: any) => (
          <button
            disabled={!!busy}
            key={d.id}
            className={"documentrow " + (active === d.id ? "selected" : "")}
            onClick={() => switchDoc(d.id)}
          >
            <Thumbnail project={project.id} id={d.id} version={d.fileVersion} />
            <span>
              <strong>{d.metadata.name}</strong>
              <small>
                {categoryLabel(d.metadata.rocnik)} · #{d.metadata.submissionId}
              </small>
              {d.state.tags.length > 0 && (
                <span className="documenttags">
                  {d.state.tags.map((t: any, i: number) => (
                    <span className="tagchip" key={i} title={tagName(t)}>
                      {tagName(t)}
                    </span>
                  ))}
                </span>
              )}
            </span>
            <span
              className={
                "scorebadge " +
                (d.state.scoring?.points != null ? "scored" : "")
              }
            >
              {d.state.scoring?.points ?? "–"}
            </span>
          </button>
        ))}
        {!documents.length && (
          <p className="listempty">
            {project.documents.length
              ? "Žiadne riešenie nevyhovuje filtru."
              : "Nahrajte ZIP archív pomocou tlačidla vyššie."}
          </p>
        )}
      </div>
      <div className="listfooter">
        <span>
          <Check size={14} />
          {
            project.documents.filter(
              (d: any) => d.state.scoring?.points != null,
            ).length
          }{" "}
          / {project.documents.length} ohodnotených
        </span>
      </div>
    </aside>
  );
}
