import { integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const game = sqliteTable("game", {
  id: integer("id").primaryKey(),
  quarter: integer("quarter").notNull().default(0),
  status: text("status").notNull().default("lobby"),
  eventKey: text("event_key").notNull().default("steady"),
  deadlineAt: integer("deadline_at").notNull().default(0),
  updatedAt: integer("updated_at").notNull().default(0),
});

export const teams = sqliteTable("teams", {
  id: text("id").primaryKey(), name: text("name").notNull(), joinCode: text("join_code").notNull(),
  specialization: text("specialization").notNull(), segment: text("segment").notNull(), price: real("price").notNull().default(49),
  cash: real("cash").notNull().default(100000), debt: real("debt").notNull().default(0), customers: integer("customers").notNull().default(40),
  revenue: real("revenue").notNull().default(0), valuation: real("valuation").notNull().default(500000),
  marketing: real("marketing").notNull().default(45), product: real("product").notNull().default(45), research: real("research").notNull().default(35),
  operations: real("operations").notNull().default(50), reputation: real("reputation").notNull().default(45), socialImpact: real("social_impact").notNull().default(0),
  riskScore: real("risk_score").notNull().default(0), status: text("status").notNull().default("active"),
  submitted: integer("submitted", { mode: "boolean" }).notNull().default(false), lastChange: real("last_change").notNull().default(0), createdAt: integer("created_at").notNull().default(0),
}, (table) => [uniqueIndex("teams_name_unique").on(table.name), uniqueIndex("teams_code_unique").on(table.joinCode)]);

export const submissions = sqliteTable("submissions", {
  id: integer("id").primaryKey({ autoIncrement: true }), teamId: text("team_id").notNull(), quarter: integer("quarter").notNull(),
  payload: text("payload").notNull(), createdAt: integer("created_at").notNull(),
}, (table) => [uniqueIndex("submission_team_quarter").on(table.teamId, table.quarter)]);

export const announcements = sqliteTable("announcements", {
  id: integer("id").primaryKey({ autoIncrement: true }), text: text("text").notNull(), createdAt: integer("created_at").notNull(),
});

export const snapshots = sqliteTable("snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  quarter: integer("quarter").notNull().unique(),
  payload: text("payload").notNull(),
  createdAt: integer("created_at").notNull(),
});
