import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const calendarEvents = pgTable("calendar_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  date: varchar("date").notNull(), // YYYY-MM-DD format
  hour: integer("hour").notNull(), // 0-23
  duration: integer("duration").default(1), // hours
});

export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  priority: varchar("priority").notNull().default("medium"), // low, medium, high
  status: varchar("status").notNull().default("todo"), // todo, upcoming, later
  scheduledDate: varchar("scheduled_date"), // YYYY-MM-DD format (null if unscheduled)
  scheduledHour: integer("scheduled_hour"), // 0-23 (null if unscheduled)
  completed: integer("completed").default(0), // 0 or 1 (boolean)
});

export const timeBlockNotes = pgTable("time_block_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: varchar("date").notNull(), // YYYY-MM-DD format
  hour: integer("hour").notNull(), // 0-23
  content: text("content").notNull(),
});

// Enums for better type safety
export const TaskPriority = z.enum(["low", "medium", "high"]);
export const TaskStatus = z.enum(["todo", "upcoming", "later"]);

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertCalendarEventSchema = createInsertSchema(calendarEvents).omit({
  id: true,
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
}).extend({
  priority: TaskPriority,
  status: TaskStatus,
  completed: z.boolean().default(false),
});

export const insertTimeBlockNoteSchema = createInsertSchema(timeBlockNotes).omit({
  id: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type InsertCalendarEvent = z.infer<typeof insertCalendarEventSchema>;

export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;

export type TimeBlockNote = typeof timeBlockNotes.$inferSelect;
export type InsertTimeBlockNote = z.infer<typeof insertTimeBlockNoteSchema>;
