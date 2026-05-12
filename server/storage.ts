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
    
    // Add dummy data for testing and demonstration
    this.initializeDummyData();
  }

  private initializeDummyData() {
    const today = new Date();
    const currentWeekStart = new Date(today);
    currentWeekStart.setDate(today.getDate() - today.getDay() + 1); // Monday of current week
    
    // Helper to format dates as YYYY-MM-DD
    const formatDate = (date: Date) => {
      return date.toISOString().split('T')[0];
    };

    // Get dates for current week
    const monday = formatDate(currentWeekStart);
    const tuesday = formatDate(new Date(currentWeekStart.getTime() + 24 * 60 * 60 * 1000));
    const wednesday = formatDate(new Date(currentWeekStart.getTime() + 2 * 24 * 60 * 60 * 1000));
    const thursday = formatDate(new Date(currentWeekStart.getTime() + 3 * 24 * 60 * 60 * 1000));
    const friday = formatDate(new Date(currentWeekStart.getTime() + 4 * 24 * 60 * 60 * 1000));

    // Previous week dates (7 days before current week)
    const prevWeekOffset = -7 * 24 * 60 * 60 * 1000;
    const prevSun = formatDate(new Date(currentWeekStart.getTime() + prevWeekOffset - 24 * 60 * 60 * 1000));
    const prevMon = formatDate(new Date(currentWeekStart.getTime() + prevWeekOffset));
    const prevTue = formatDate(new Date(currentWeekStart.getTime() + prevWeekOffset + 24 * 60 * 60 * 1000));
    const prevWed = formatDate(new Date(currentWeekStart.getTime() + prevWeekOffset + 2 * 24 * 60 * 60 * 1000));
    const prevThu = formatDate(new Date(currentWeekStart.getTime() + prevWeekOffset + 3 * 24 * 60 * 60 * 1000));
    const prevFri = formatDate(new Date(currentWeekStart.getTime() + prevWeekOffset + 4 * 24 * 60 * 60 * 1000));
    const prevSat = formatDate(new Date(currentWeekStart.getTime() + prevWeekOffset + 5 * 24 * 60 * 60 * 1000));

    // Next week dates (7 days after current week)
    const nextWeekOffset = 7 * 24 * 60 * 60 * 1000;
    const nextMon = formatDate(new Date(currentWeekStart.getTime() + nextWeekOffset));
    const nextTue = formatDate(new Date(currentWeekStart.getTime() + nextWeekOffset + 24 * 60 * 60 * 1000));
    const nextWed = formatDate(new Date(currentWeekStart.getTime() + nextWeekOffset + 2 * 24 * 60 * 60 * 1000));
    const nextThu = formatDate(new Date(currentWeekStart.getTime() + nextWeekOffset + 3 * 24 * 60 * 60 * 1000));
    const nextFri = formatDate(new Date(currentWeekStart.getTime() + nextWeekOffset + 4 * 24 * 60 * 60 * 1000));

    // Add scheduled tasks (appear in calendar time blocks)
    const scheduledTasks: Array<Task> = [
      // Current week
      { id: "task-1", title: "task name", description: null, priority: "medium", status: "todo", color: "blue", scheduledDate: monday, scheduledHour: 7, completed: 0 },
      { id: "task-2", title: "task name", description: null, priority: "medium", status: "todo", color: "green", scheduledDate: monday, scheduledHour: 8, completed: 0 },
      { id: "task-3", title: "task name", description: null, priority: "medium", status: "todo", color: "purple", scheduledDate: tuesday, scheduledHour: 7, completed: 0 },
      { id: "task-4", title: "task name", description: null, priority: "medium", status: "todo", color: "orange", scheduledDate: tuesday, scheduledHour: 8, completed: 0 },
      { id: "task-5", title: "task name", description: "I really ought to do something but I am already in my paj...", priority: "medium", status: "todo", color: "blue", scheduledDate: wednesday, scheduledHour: 8, completed: 0 },
      { id: "task-6", title: "task name", description: null, priority: "medium", status: "todo", color: "green", scheduledDate: wednesday, scheduledHour: 9, completed: 0 },
      { id: "task-7", title: "task name", description: null, priority: "medium", status: "todo", color: "purple", scheduledDate: wednesday, scheduledHour: 13, completed: 0 },
      { id: "task-8", title: "task name", description: null, priority: "medium", status: "todo", color: "orange", scheduledDate: thursday, scheduledHour: 7, completed: 0 },
      { id: "task-9", title: "task name", description: null, priority: "medium", status: "todo", color: "blue", scheduledDate: thursday, scheduledHour: 8, completed: 0 },
      { id: "task-10", title: "task name", description: null, priority: "medium", status: "todo", color: "green", scheduledDate: friday, scheduledHour: 7, completed: 0 },
      { id: "task-11", title: "task name", description: null, priority: "medium", status: "todo", color: "purple", scheduledDate: friday, scheduledHour: 8, completed: 0 },
      // Previous week
      { id: "prev-task-1", title: "team standup", description: null, priority: "high", status: "todo", color: "blue", scheduledDate: prevMon, scheduledHour: 9, completed: 1 },
      { id: "prev-task-2", title: "review designs", description: null, priority: "medium", status: "todo", color: "orange", scheduledDate: prevMon, scheduledHour: 11, completed: 1 },
      { id: "prev-task-3", title: "client call", description: null, priority: "high", status: "todo", color: "red", scheduledDate: prevTue, scheduledHour: 10, completed: 1 },
      { id: "prev-task-4", title: "write report", description: null, priority: "medium", status: "todo", color: "green", scheduledDate: prevTue, scheduledHour: 14, completed: 1 },
      { id: "prev-task-5", title: "workshop prep", description: null, priority: "medium", status: "todo", color: "purple", scheduledDate: prevWed, scheduledHour: 8, completed: 1 },
      { id: "prev-task-6", title: "code review", description: null, priority: "low", status: "todo", color: "blue", scheduledDate: prevWed, scheduledHour: 13, completed: 1 },
      { id: "prev-task-7", title: "lunch with team", description: null, priority: "low", status: "todo", color: "orange", scheduledDate: prevThu, scheduledHour: 12, completed: 1 },
      { id: "prev-task-8", title: "sprint planning", description: null, priority: "high", status: "todo", color: "green", scheduledDate: prevThu, scheduledHour: 15, completed: 1 },
      { id: "prev-task-9", title: "weekly wrap-up", description: null, priority: "medium", status: "todo", color: "purple", scheduledDate: prevFri, scheduledHour: 9, completed: 1 },
      { id: "prev-task-10", title: "send newsletter", description: null, priority: "low", status: "todo", color: "red", scheduledDate: prevFri, scheduledHour: 16, completed: 1 },
      // Next week
      { id: "next-task-1", title: "project kickoff", description: null, priority: "high", status: "upcoming", color: "blue", scheduledDate: nextMon, scheduledHour: 9, completed: 0 },
      { id: "next-task-2", title: "budget review", description: null, priority: "medium", status: "upcoming", color: "green", scheduledDate: nextMon, scheduledHour: 14, completed: 0 },
      { id: "next-task-3", title: "design sync", description: null, priority: "medium", status: "upcoming", color: "purple", scheduledDate: nextTue, scheduledHour: 10, completed: 0 },
      { id: "next-task-4", title: "user interviews", description: null, priority: "high", status: "upcoming", color: "orange", scheduledDate: nextTue, scheduledHour: 13, completed: 0 },
      { id: "next-task-5", title: "content draft", description: null, priority: "low", status: "upcoming", color: "green", scheduledDate: nextWed, scheduledHour: 8, completed: 0 },
      { id: "next-task-6", title: "stakeholder update", description: null, priority: "high", status: "upcoming", color: "red", scheduledDate: nextWed, scheduledHour: 11, completed: 0 },
      { id: "next-task-7", title: "testing session", description: null, priority: "medium", status: "upcoming", color: "blue", scheduledDate: nextThu, scheduledHour: 9, completed: 0 },
      { id: "next-task-8", title: "vendor meeting", description: null, priority: "medium", status: "upcoming", color: "orange", scheduledDate: nextThu, scheduledHour: 15, completed: 0 },
      { id: "next-task-9", title: "retrospective", description: null, priority: "low", status: "upcoming", color: "purple", scheduledDate: nextFri, scheduledHour: 10, completed: 0 },
      { id: "next-task-10", title: "release prep", description: null, priority: "high", status: "upcoming", color: "green", scheduledDate: nextFri, scheduledHour: 14, completed: 0 }
    ];

    // Add unscheduled tasks for sidebar (no scheduledDate/scheduledHour)
    const unscheduledTasks: Array<Task> = [
      { id: "sidebar-task-1", title: "Name of the task", description: "Did everything just taste purple for a se...", priority: "high", status: "todo", color: "green", scheduledDate: null, scheduledHour: null, completed: 0 },
      { id: "sidebar-task-2", title: "Another important task", description: null, priority: "medium", status: "todo", color: "orange", scheduledDate: null, scheduledHour: null, completed: 0 },
      { id: "sidebar-task-3", title: "Task with timing", description: "Did everything just taste purple for a se...", priority: "low", status: "todo", color: "purple", scheduledDate: null, scheduledHour: null, completed: 0 },
      { id: "sidebar-task-4", title: "Task with timing", description: "App talks, trirays", priority: "low", status: "todo", color: "purple", scheduledDate: null, scheduledHour: null, completed: 0 },
      { id: "sidebar-task-5", title: "Name of the task", description: "Did everything just taste purple for a se...", priority: "high", status: "upcoming", color: "green", scheduledDate: null, scheduledHour: null, completed: 0 },
      { id: "sidebar-task-6", title: "Task with timing", description: "App talks, trirays", priority: "low", status: "upcoming", color: "purple", scheduledDate: null, scheduledHour: null, completed: 0 },
      { id: "sidebar-task-7", title: "Name of the task", description: "Did everything just taste purple for a se...", priority: "high", status: "later", color: "green", scheduledDate: null, scheduledHour: null, completed: 0 },
      { id: "sidebar-task-8", title: "Task with timing", description: "App talks, trirays", priority: "low", status: "later", color: "purple", scheduledDate: null, scheduledHour: null, completed: 0 }
    ];

    // Add all tasks to storage
    [...scheduledTasks, ...unscheduledTasks].forEach(task => {
      this.tasks.set(task.id, task);
    });

    // Add some time block notes
    const notes: Array<TimeBlockNote> = [
      // Current week
      { id: "note-1", date: monday, hour: 6, content: "I really ought to do somet..." },
      { id: "note-2", date: tuesday, hour: 6, content: "I really ought to do somet..." },
      { id: "note-3", date: wednesday, hour: 6, content: "I really ought to do something but I am already in my paj..." },
      { id: "note-4", date: wednesday, hour: 12, content: "I really ought to do something but I am already in my paj..." },
      { id: "note-5", date: wednesday, hour: 14, content: "I really ought to do something but I am already in my paj..." },
      { id: "note-6", date: wednesday, hour: 15, content: "I really ought to do something but I am already in my paj..." },
      { id: "note-7", date: thursday, hour: 6, content: "I really ought to do somet..." },
      { id: "note-8", date: friday, hour: 6, content: "I really ought to do somet..." },
      // Previous week
      { id: "prev-note-1", date: prevMon, hour: 8, content: "Morning check-in with the east coast team before..." },
      { id: "prev-note-2", date: prevTue, hour: 9, content: "Remember to send the Q1 summary before the client call." },
      { id: "prev-note-3", date: prevWed, hour: 7, content: "Early start — workshop materials need to be printed." },
      { id: "prev-note-4", date: prevWed, hour: 14, content: "Block off this time, no meetings." },
      { id: "prev-note-5", date: prevFri, hour: 8, content: "Wrap up loose ends before the weekend." },
      // Next week
      { id: "next-note-1", date: nextMon, hour: 8, content: "Set intentions for the week — what's the #1 priority?" },
      { id: "next-note-2", date: nextWed, hour: 7, content: "Blocked for deep work, no interruptions." },
      { id: "next-note-3", date: nextWed, hour: 13, content: "Post-lunch walk, then back to stakeholder deck." },
      { id: "next-note-4", date: nextFri, hour: 9, content: "Retro notes — what went well, what to improve." }
    ];

    notes.forEach(note => {
      this.timeBlockNotes.set(note.id, note);
    });

    // Add some calendar events including multi-hour ones for proper continuation indicator testing
    const events: Array<CalendarEvent> = [
      // Current week
      { id: "event-2", title: "Another longer task", description: null, date: monday, hour: 6, duration: 1 },
      { id: "event-3", title: "Another longer task", description: null, date: tuesday, hour: 9, duration: 1 },
      { id: "event-4", title: "Order the supplies", description: "Multi-hour event for testing continuation indicators", date: wednesday, hour: 9, duration: 3 },
      { id: "event-5", title: "Prep for Friday", description: "Another multi-hour event", date: wednesday, hour: 12, duration: 2 },
      // Previous week
      { id: "prev-event-1", title: "All-hands meeting", description: null, date: prevMon, hour: 10, duration: 2 },
      { id: "prev-event-2", title: "Design review", description: null, date: prevTue, hour: 13, duration: 1 },
      { id: "prev-event-3", title: "Workshop", description: "Team workshop on Q2 planning", date: prevWed, hour: 9, duration: 3 },
      { id: "prev-event-4", title: "1:1 with manager", description: null, date: prevThu, hour: 11, duration: 1 },
      { id: "prev-event-5", title: "Friday demo", description: null, date: prevFri, hour: 14, duration: 2 },
      // Next week
      { id: "next-event-1", title: "Kickoff session", description: "New project kickoff", date: nextMon, hour: 10, duration: 2 },
      { id: "next-event-2", title: "User research", description: null, date: nextTue, hour: 14, duration: 2 },
      { id: "next-event-3", title: "Strategy workshop", description: "Q3 strategy planning", date: nextWed, hour: 9, duration: 3 },
      { id: "next-event-4", title: "Vendor sync", description: null, date: nextThu, hour: 14, duration: 1 },
      { id: "next-event-5", title: "Release review", description: "Go/no-go for next release", date: nextFri, hour: 15, duration: 1 }
    ];

    events.forEach(event => {
      this.calendarEvents.set(event.id, event);
    });
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
      color: insertTask.color ?? "blue",
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
      color: ('color' in updateData) ? (updateData.color ?? null) : task.color,
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
