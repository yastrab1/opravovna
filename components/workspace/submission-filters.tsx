"use client";
import { useEffect, useRef } from "react";
import { SlidersHorizontal, ChevronDown } from "lucide-react";
import { categoryLabel, type ProjectPreferences } from "@/lib/preferences";
import { emptyPointsFilter } from "@/lib/points-filter";
import PointsFilter from "./points-filter";
export default function SubmissionFilters({
  value,
  onChange,
  tags,
  categories,
}: {
  value: ProjectPreferences;
  onChange: (patch: Partial<ProjectPreferences>) => void;
  tags: string[];
  categories: string[];
}) {
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (!details.current?.contains(e.target as Node))
        details.current?.removeAttribute("open");
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && details.current?.open) {
        details.current.open = false;
        details.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  const count =
    Number(value.filter !== "all") +
    Number(!!value.tagFilter || value.taggedOnly) +
    Number(value.categories.length > 0) +
    Number(
      value.points?.comparison !== undefined &&
        value.points.comparison !== "all" &&
        !!value.points.value,
    );
  return (
    <details ref={details} className="submission-filters">
      <summary>
        <SlidersHorizontal size={15} /> Zoradiť a filtrovať{" "}
        {count > 0 && <span className="filter-count">{count}</span>}
        <ChevronDown size={14} />
      </summary>
      <div className="filter-menu">
        <label>
          Zoradiť
          <select
            aria-label="Zoradiť riešenia"
            value={value.sort}
            onChange={(e) =>
              onChange({ sort: e.target.value as ProjectPreferences["sort"] })
            }
          >
            <option value="name">Abecedne</option>
            <option value="category">Podľa kategórie</option>
            <option value="points">Podľa bodov (od najnižších)</option>
          </select>
        </label>
        <label className="filter-check">
          <input
            type="checkbox"
            checked={value.gradedFirst}
            onChange={(e) => onChange({ gradedFirst: e.target.checked })}
          />
          Opravené najprv
        </label>
        <label>
          Hodnotenie
          <select
            aria-label="Filtrovať hodnotenie"
            value={value.filter}
            onChange={(e) =>
              onChange({
                filter: e.target.value as ProjectPreferences["filter"],
              })
            }
          >
            <option value="all">Všetky riešenia</option>
            <option value="ungraded">Bez hodnotenia</option>
            <option value="graded">Ohodnotené</option>
          </select>
        </label>
        <label>
          Štítky
          <select
            aria-label="Filtrovať štítok"
            value={
              value.taggedOnly
                ? "any"
                : value.tagFilter
                  ? `tag:${value.tagFilter}`
                  : "all"
            }
            onChange={(e) =>
              onChange({
                taggedOnly: e.target.value === "any",
                tagFilter: e.target.value.startsWith("tag:")
                  ? e.target.value.slice(4)
                  : "",
              })
            }
          >
            <option value="all">Všetky riešenia</option>
            <option value="any">Ľubovoľný tag</option>
            {tags.map((t) => (
              <option key={t} value={`tag:${t}`}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <div>
          <span className="filter-label">Počet bodov</span>
          <PointsFilter
            value={value.points ?? emptyPointsFilter}
            onChange={(points) => onChange({ points })}
          />
        </div>
        <fieldset>
          <legend>Kategórie</legend>
          <div className="filter-categories">
            {categories.map((c) => (
              <label className="filter-check" key={c}>
                <input
                  type="checkbox"
                  checked={value.categories.includes(c)}
                  onChange={(e) =>
                    onChange({
                      categories: e.target.checked
                        ? [...value.categories, c]
                        : value.categories.filter((x) => x !== c),
                    })
                  }
                />
                {categoryLabel(c)}
              </label>
            ))}
          </div>
          {value.categories.length > 0 && (
            <button onClick={() => onChange({ categories: [] })}>
              Všetky kategórie
            </button>
          )}
        </fieldset>
      </div>
    </details>
  );
}
