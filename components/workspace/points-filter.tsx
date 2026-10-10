"use client";
import {
  emptyPointsFilter,
  type PointsFilter as Value,
} from "@/lib/points-filter";
import { X } from "lucide-react";
export default function PointsFilter({
  value,
  onChange,
}: {
  value: Value;
  onChange: (value: Value) => void;
}) {
  return (
    <div
      className="pointsfilter"
      role="group"
      aria-label="Filtrovať počet bodov"
    >
      <select
        aria-label="Porovnanie bodov"
        value={value.comparison}
        onChange={(e) =>
          onChange({
            ...value,
            comparison: e.target.value as Value["comparison"],
          })
        }
      >
        <option value="all">Všetky body</option>
        <option value="eq">= Rovná sa</option>
        <option value="lt">&lt; Menšie než</option>
        <option value="gt">&gt; Väčšie než</option>
      </select>
      {value.comparison !== "all" && (
        <>
          <input
            type="number"
            min="0"
            step="any"
            aria-label="Počet bodov pre filter"
            placeholder="0,00"
            value={value.value}
            onChange={(e) => onChange({ ...value, value: e.target.value })}
          />
          <button
            type="button"
            aria-label="Zrušiť filter bodov"
            title="Zrušiť filter bodov"
            onClick={() => onChange(emptyPointsFilter)}
          >
            <X size={13} />
          </button>
        </>
      )}
    </div>
  );
}
