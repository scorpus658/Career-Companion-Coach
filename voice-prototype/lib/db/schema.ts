import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import type { CandidateBrief } from "@/lib/brief";

export const briefSource = pgEnum("brief_source", ["seed", "call_out"]);

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  linkedinUrl: text("linkedin_url").notNull().unique(),
  mindcaseData: jsonb("mindcase_data"),
  mindcasePulledAt: timestamp("mindcase_pulled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const cvs = pgTable("cvs", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  fileUrl: text("file_url").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  byteSize: integer("byte_size").notNull(),
  extractedText: text("extracted_text").notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const briefs = pgTable("briefs", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  brief: jsonb("brief").$type<CandidateBrief>().notNull(),
  source: briefSource("source").notNull(),
  callId: uuid("call_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const calls = pgTable("calls", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  briefInId: uuid("brief_in_id").references(() => briefs.id),
  briefOutId: uuid("brief_out_id").references(() => briefs.id),
  transcript: text("transcript"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});
