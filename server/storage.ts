import { 
  type User, 
  type InsertUser,
  type CalendarEvent,
  type InsertCalendarEvent,
  type Task,
  type InsertTask,
  type TimeBlockNote,
  type InsertTimeBlockNote
} from "@shared/schema";
import { randomUUID } from "crypto";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Calendar Event operations
  getCalendarEvent(id: string): Promise<CalendarEvent | undefined>;
  getCalendarEventsByDateRange(startDate: string, endDate: string): Promise<CalendarEvent[]>;
  getCalendarEventsByDateAndHour(date: string, hour: number): Promise<CalendarEvent[]>;
  createCalendarEvent(event: InsertCalendarEvent): Promise<CalendarEvent>;
  updateCalendarEvent(id: string, event: Partial<InsertCalendarEvent>): Promise<CalendarEvent | undefined>;
  deleteCalendarEvent(id: string): Promise<boolean>;

  // Task operations
  getTask(id: string): Promise<Task | undefined>;
  getAllTasks(): Promise<Task[]>;
  getTasksByStatus(status: "todo" | "upcoming" | "later"): Promise<Task[]>;
  getScheduledTasks(date: string, hour?: number): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, task: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(id: string): Promise<boolean>;

  // Time Block Notes operations
  getTimeBlockNote(id: string): Promise<TimeBlockNote | undefined>;
  getTimeBlockNotesByDateAndHour(date: string, hour: number): Promise<TimeBlockNote[]>;
  getTimeBlockNotesByDateRange(startDate: string, endDate: string): Promise<TimeBlockNote[]>;
  createTimeBlockNote(note: InsertTimeBlockNote): Promise<TimeBlockNote>;
  updateTimeBlockNote(id: string, note: Partial<InsertTimeBlockNote>): Promise<TimeBlockNote | undefined>;
  deleteTimeBlockNote(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private calendarEvents: Map<string, CalendarEvent>;
  private tasks: Map<string, Task>;
  private timeBlockNotes: Map<string, TimeBlockNote>;

  constructor() {
    this.users = new Map();
    this.calendarEvents = new Map();
    this.tasks = new Map();
    this.timeBlockNotes = new Map();
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Calendar Event operations
  async getCalendarEvent(id: string): Promise<CalendarEvent | undefined> {
    return this.calendarEvents.get(id);
  }

  async getCalendarEventsByDateRange(startDate: string, endDate: string): Promise<CalendarEvent[]> {
    return Array.from(this.calendarEvents.values()).filter(
      (event) => event.date >= startDate && event.date <= endDate
    );
  }

  async getCalendarEventsByDateAndHour(date: string, hour: number): Promise<CalendarEvent[]> {
    return Array.from(this.calendarEvents.values()).filter(
      (event) => event.date === date && event.hour === hour
    );
  }

  async createCalendarEvent(insertEvent: InsertCalendarEvent): Promise<CalendarEvent> {
    const id = randomUUID();
    const event: CalendarEvent = { 
      ...insertEvent, 
      id,
      description: insertEvent.description ?? null,
      duration: insertEvent.duration ?? null
    };
    this.calendarEvents.set(id, event);
    return event;
  }

  async updateCalendarEvent(id: string, updateData: Partial<InsertCalendarEvent>): Promise<CalendarEvent | undefined> {
    const event = this.calendarEvents.get(id);
    if (!event) return undefined;
    
    const updatedEvent: CalendarEvent = {
      ...event,
      title: updateData.title ?? event.title,
      description: ('description' in updateData) ? (updateData.description ?? null) : event.description,
      date: updateData.date ?? event.date,
      hour: updateData.hour ?? event.hour,
      duration: ('duration' in updateData) ? (updateData.duration ?? null) : event.duration
    };
    this.calendarEvents.set(id, updatedEvent);
    return updatedEvent;
  }

  async deleteCalendarEvent(id: string): Promise<boolean> {
    return this.calendarEvents.delete(id);
  }

  // Task operations
  async getTask(id: string): Promise<Task | undefined> {
    return this.tasks.get(id);
  }

  async getAllTasks(): Promise<Task[]> {
    return Array.from(this.tasks.values());
  }

  async getTasksByStatus(status: "todo" | "upcoming" | "later"): Promise<Task[]> {
    return Array.from(this.tasks.values()).filter(task => task.status === status);
  }

  async getScheduledTasks(date: string, hour?: number): Promise<Task[]> {
    return Array.from(this.tasks.values()).filter(task => {
      if (task.scheduledDate !== date) return false;
      if (hour !== undefined && task.scheduledHour !== hour) return false;
      return true;
    });
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    const id = randomUUID();
    // Convert boolean to integer for storage compatibility
    const task: Task = { 
      ...insertTask, 
      id,
      description: insertTask.description ?? null,
      scheduledDate: insertTask.scheduledDate ?? null,
      scheduledHour: insertTask.scheduledHour ?? null,
      completed: insertTask.completed ? 1 : 0
    };
    this.tasks.set(id, task);
    return task;
  }

  async updateTask(id: string, updateData: Partial<InsertTask>): Promise<Task | undefined> {
    const task = this.tasks.get(id);
    if (!task) return undefined;
    
    // Convert boolean to integer for storage compatibility and handle explicit nulls
    const updatedTask: Task = { 
      ...task, 
      title: updateData.title ?? task.title,
      description: ('description' in updateData) ? (updateData.description ?? null) : task.description,
      priority: updateData.priority ?? task.priority,
      status: updateData.status ?? task.status,
      scheduledDate: ('scheduledDate' in updateData) ? (updateData.scheduledDate ?? null) : task.scheduledDate,
      scheduledHour: ('scheduledHour' in updateData) ? (updateData.scheduledHour ?? null) : task.scheduledHour,
      completed: updateData.completed !== undefined ? (updateData.completed ? 1 : 0) : task.completed
    };
    this.tasks.set(id, updatedTask);
    return updatedTask;
  }

  async deleteTask(id: string): Promise<boolean> {
    return this.tasks.delete(id);
  }

  // Time Block Notes operations
  async getTimeBlockNote(id: string): Promise<TimeBlockNote | undefined> {
    return this.timeBlockNotes.get(id);
  }

  async getTimeBlockNotesByDateAndHour(date: string, hour: number): Promise<TimeBlockNote[]> {
    return Array.from(this.timeBlockNotes.values()).filter(
      (note) => note.date === date && note.hour === hour
    );
  }

  async getTimeBlockNotesByDateRange(startDate: string, endDate: string): Promise<TimeBlockNote[]> {
    return Array.from(this.timeBlockNotes.values()).filter(
      (note) => note.date >= startDate && note.date <= endDate
    );
  }

  async createTimeBlockNote(insertNote: InsertTimeBlockNote): Promise<TimeBlockNote> {
    const id = randomUUID();
    const note: TimeBlockNote = { ...insertNote, id };
    this.timeBlockNotes.set(id, note);
    return note;
  }

  async updateTimeBlockNote(id: string, updateData: Partial<InsertTimeBlockNote>): Promise<TimeBlockNote | undefined> {
    const note = this.timeBlockNotes.get(id);
    if (!note) return undefined;
    
    const updatedNote: TimeBlockNote = {
      ...note,
      date: updateData.date ?? note.date,
      hour: updateData.hour ?? note.hour,
      content: updateData.content ?? note.content
    };
    this.timeBlockNotes.set(id, updatedNote);
    return updatedNote;
  }

  async deleteTimeBlockNote(id: string): Promise<boolean> {
    return this.timeBlockNotes.delete(id);
  }
}

export const storage = new MemStorage();
