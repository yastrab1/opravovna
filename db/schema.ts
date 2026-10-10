import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  owner: text("owner").notNull(),
  title: text("title").notNull(),
  folder: text("folder").notNull().default(""),
  created: integer("created").notNull(),
  archive: text("archive"),
  legacy: text("legacy").notNull().default("{}"),
  share: text("share"),
});
export const members = sqliteTable("members", {
  id: text("id").primaryKey(),
  project: text("project").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull(),
});
export const documents = sqliteTable("documents", {
  id: text("id").primaryKey(),
  project: text("project").notNull(),
  path: text("path").notNull(),
  metadata: text("metadata").notNull(),
  original: text("original").notNull(),
  graded: text("graded"),
  state: text("state").notNull().default("{}"),
  revision: integer("revision").notNull().default(0),
  updated: integer("updated").notNull(),
});
export const uploads = sqliteTable("uploads", {
  id: text("id").primaryKey(),
  project: text("project").notNull(),
  user: text("user").notNull(),
  key: text("key").notNull(),
  multipart: text("multipart").notNull(),
  parts: text("parts").notNull().default("[]"),
});

export const projectPresence = sqliteTable(
  "project_presence",
  {
    project: text("project").notNull(),
    user: text("user").notNull(),
    session: text("session").notNull(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    image: text("image").notNull(),
    updated: integer("updated").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.project, table.user, table.session] }),
    index("presence_updated_idx").on(table.updated),
  ],
);
