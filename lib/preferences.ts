import { readPointsFilter, type PointsFilter } from "./points-filter";
export const fonts = [
  "Ubuntu",
  "Open Sans",
  "Gloria Hallelujah",
  "Arial",
  "Georgia",
  "Courier New",
];
export const toolNames = {
  text: "Text",
  draw: "Kreslenie",
  highlight: "Zvýrazňovač",
  arrow: "Šípka",
  rect: "Obdĺžnik",
  circle: "Elipsa",
  stamp: "Pečiatka",
};
export type ToolKey = keyof typeof toolNames;
export type ToolStyle = {
  color: string;
  font: string;
  fontSize: number;
  width: number;
  bold: boolean;
  italic: boolean;
};
export type ProjectPreferences = {
  categories: string[];
  sort: "name" | "category" | "points";
  gradedFirst: boolean;
  taggedOnly: boolean;
  points?: PointsFilter;
  query: string;
  filter: "all" | "graded" | "ungraded";
  tagFilter: string;
};
export function defaultProjectPreferences(): ProjectPreferences {
  return {
    categories: [],
    sort: "name",
    gradedFirst: false,
    taggedOnly: false,
    query: "",
    filter: "all",
    tagFilter: "",
  };
}
export type Preferences = {
  tools: Record<ToolKey, ToolStyle>;
  projects: Record<string, ProjectPreferences>;
};
export function categoryLabel(code: string) {
  const value = String(code).replace(/^c/i, "").toLowerCase();
  return (
    (
      { p: "prima", s: "sekunda", t: "tercia", k: "kvarta" } as Record<
        string,
        string
      >
    )[value] ?? value
  );
}
export function compareCategories(a: string, b: string) {
  const order = (s: string) => {
    const c = String(s).replace(/^c/i, "").toLowerCase();
    return (
      ({ p: 101, s: 102, t: 103, k: 104 } as Record<string, number>)[c] ??
      (Number(c) || 100)
    );
  };
  return (
    order(a) - order(b) ||
    categoryLabel(a).localeCompare(categoryLabel(b), "sk", { numeric: true })
  );
}
export function defaultStyle(tool: ToolKey): ToolStyle {
  return {
    color: tool === "highlight" ? "#ffe066" : "#cc2e80",
    font: tool === "stamp" ? "Gloria Hallelujah" : "Ubuntu",
    fontSize: tool === "stamp" ? 40 : 20,
    width: 3,
    bold: false,
    italic: false,
  };
}
export function readPreferences(raw: any): Preferences {
  const tools = {} as Preferences["tools"];
  for (const key of Object.keys(toolNames) as ToolKey[]) {
    const base = defaultStyle(key),
      v = raw?.tools?.[key] ?? {};
    tools[key] = {
      color: /^#[\da-f]{6}$/i.test(v.color) ? v.color : base.color,
      font: fonts.includes(v.font) ? v.font : base.font,
      fontSize: Number.isFinite(v.fontSize)
        ? Math.max(8, Math.min(120, v.fontSize))
        : base.fontSize,
      width: [1, 2, 3, 5, 8].includes(v.width) ? v.width : base.width,
      bold: v.bold === true,
      italic: v.italic === true,
    };
  }
  const projects: Preferences["projects"] = {};
  for (const [id, value] of Object.entries(raw?.projects ?? {})) {
    const v = value as any;
    projects[id] = {
      categories: Array.isArray(v?.categories)
        ? v.categories.filter((x: any) => typeof x === "string")
        : [],
      sort: ["category", "points"].includes(v?.sort) ? v.sort : "name",
      gradedFirst: v?.gradedFirst === true || v?.sort === "graded",
      taggedOnly: v?.taggedOnly === true,
      points: readPointsFilter(v?.points),
      query: typeof v?.query === "string" ? v.query : "",
      filter: ["graded", "ungraded"].includes(v?.filter) ? v.filter : "all",
      tagFilter: typeof v?.tagFilter === "string" ? v.tagFilter : "",
    };
  }
  return { tools, projects };
}
