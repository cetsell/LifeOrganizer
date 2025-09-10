import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertCalendarEventSchema,
  insertTaskSchema,
  insertTimeBlockNoteSchema 
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Calendar Events API
  app.get("/api/calendar-events/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const event = await storage.getCalendarEvent(id);
      
      if (!event) {
        return res.status(404).json({ error: "Calendar event not found" });
      }
      res.json(event);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch calendar event" });
    }
  });

  app.get("/api/calendar-events", async (req, res) => {
    try {
      const { startDate, endDate, date, hour } = req.query;
      
      // Validate date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (date && !dateRegex.test(date as string)) {
        return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
      }
      if (startDate && !dateRegex.test(startDate as string)) {
        return res.status(400).json({ error: "Invalid startDate format. Use YYYY-MM-DD" });
      }
      if (endDate && !dateRegex.test(endDate as string)) {
        return res.status(400).json({ error: "Invalid endDate format. Use YYYY-MM-DD" });
      }
      
      // Validate hour range
      if (hour !== undefined) {
        const hourNum = parseInt(hour as string);
        if (isNaN(hourNum) || hourNum < 0 || hourNum > 23) {
          return res.status(400).json({ error: "Hour must be between 0 and 23" });
        }
      }
      
      if (date && hour !== undefined) {
        // Get events for specific date and hour
        const events = await storage.getCalendarEventsByDateAndHour(
          date as string, 
          parseInt(hour as string)
        );
        res.json(events);
      } else if (date) {
        // Get events for entire day
        const events = await storage.getCalendarEventsByDateRange(
          date as string,
          date as string
        );
        res.json(events);
      } else if (startDate && endDate) {
        // Get events in date range
        const events = await storage.getCalendarEventsByDateRange(
          startDate as string,
          endDate as string
        );
        res.json(events);
      } else {
        res.status(400).json({ error: "Missing required query parameters: date, or startDate+endDate" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch calendar events" });
    }
  });

  app.post("/api/calendar-events", async (req, res) => {
    try {
      const validatedData = insertCalendarEventSchema.parse(req.body);
      const event = await storage.createCalendarEvent(validatedData);
      res.status(201).json(event);
    } catch (error) {
      res.status(400).json({ error: "Invalid calendar event data" });
    }
  });

  app.put("/api/calendar-events/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertCalendarEventSchema.partial().parse(req.body);
      const event = await storage.updateCalendarEvent(id, validatedData);
      
      if (!event) {
        return res.status(404).json({ error: "Calendar event not found" });
      }
      res.json(event);
    } catch (error) {
      res.status(400).json({ error: "Invalid calendar event data" });
    }
  });

  app.delete("/api/calendar-events/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteCalendarEvent(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Calendar event not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete calendar event" });
    }
  });

  // Tasks API
  app.get("/api/tasks/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const task = await storage.getTask(id);
      
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.json(task);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch task" });
    }
  });

  app.get("/api/tasks", async (req, res) => {
    try {
      const { status, date, hour } = req.query;
      
      // Validate status
      if (status && !['todo', 'upcoming', 'later'].includes(status as string)) {
        return res.status(400).json({ error: "Invalid status. Must be 'todo', 'upcoming', or 'later'" });
      }
      
      // Validate date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (date && !dateRegex.test(date as string)) {
        return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
      }
      
      // Validate hour range
      if (hour !== undefined) {
        const hourNum = parseInt(hour as string);
        if (isNaN(hourNum) || hourNum < 0 || hourNum > 23) {
          return res.status(400).json({ error: "Hour must be between 0 and 23" });
        }
      }
      
      if (status) {
        // Get tasks by status for sidebar sections
        const tasks = await storage.getTasksByStatus(status as "todo" | "upcoming" | "later");
        res.json(tasks);
      } else if (date) {
        // Get scheduled tasks for specific date/hour
        const tasks = await storage.getScheduledTasks(
          date as string,
          hour ? parseInt(hour as string) : undefined
        );
        res.json(tasks);
      } else {
        // Get all tasks
        const tasks = await storage.getAllTasks();
        res.json(tasks);
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  app.post("/api/tasks", async (req, res) => {
    try {
      const validatedData = insertTaskSchema.parse(req.body);
      const task = await storage.createTask(validatedData);
      res.status(201).json(task);
    } catch (error) {
      res.status(400).json({ error: "Invalid task data" });
    }
  });

  app.put("/api/tasks/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertTaskSchema.partial().parse(req.body);
      const task = await storage.updateTask(id, validatedData);
      
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.json(task);
    } catch (error) {
      res.status(400).json({ error: "Invalid task data" });
    }
  });

  app.delete("/api/tasks/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteTask(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete task" });
    }
  });

  // Time Block Notes API
  app.get("/api/time-block-notes/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const note = await storage.getTimeBlockNote(id);
      
      if (!note) {
        return res.status(404).json({ error: "Time block note not found" });
      }
      res.json(note);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch time block note" });
    }
  });

  app.get("/api/time-block-notes", async (req, res) => {
    try {
      const { startDate, endDate, date, hour } = req.query;
      
      // Validate date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (date && !dateRegex.test(date as string)) {
        return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
      }
      if (startDate && !dateRegex.test(startDate as string)) {
        return res.status(400).json({ error: "Invalid startDate format. Use YYYY-MM-DD" });
      }
      if (endDate && !dateRegex.test(endDate as string)) {
        return res.status(400).json({ error: "Invalid endDate format. Use YYYY-MM-DD" });
      }
      
      // Validate hour range
      if (hour !== undefined) {
        const hourNum = parseInt(hour as string);
        if (isNaN(hourNum) || hourNum < 0 || hourNum > 23) {
          return res.status(400).json({ error: "Hour must be between 0 and 23" });
        }
      }
      
      if (date && hour !== undefined) {
        // Get notes for specific time block
        const notes = await storage.getTimeBlockNotesByDateAndHour(
          date as string,
          parseInt(hour as string)
        );
        res.json(notes);
      } else if (date) {
        // Get notes for entire day
        const notes = await storage.getTimeBlockNotesByDateRange(
          date as string,
          date as string
        );
        res.json(notes);
      } else if (startDate && endDate) {
        // Get notes in date range
        const notes = await storage.getTimeBlockNotesByDateRange(
          startDate as string,
          endDate as string
        );
        res.json(notes);
      } else {
        res.status(400).json({ error: "Missing required query parameters: date, or startDate+endDate" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch time block notes" });
    }
  });

  app.post("/api/time-block-notes", async (req, res) => {
    try {
      const validatedData = insertTimeBlockNoteSchema.parse(req.body);
      const note = await storage.createTimeBlockNote(validatedData);
      res.status(201).json(note);
    } catch (error) {
      res.status(400).json({ error: "Invalid time block note data" });
    }
  });

  app.put("/api/time-block-notes/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertTimeBlockNoteSchema.partial().parse(req.body);
      const note = await storage.updateTimeBlockNote(id, validatedData);
      
      if (!note) {
        return res.status(404).json({ error: "Time block note not found" });
      }
      res.json(note);
    } catch (error) {
      res.status(400).json({ error: "Invalid time block note data" });
    }
  });

  app.delete("/api/time-block-notes/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteTimeBlockNote(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Time block note not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete time block note" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
