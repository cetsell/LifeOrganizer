import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfWeek, addWeeks, addDays, isSameDay, parseISO } from "date-fns";
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useDrag, useDrop } from 'react-dnd';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Plus, Clock, X, List, Calendar as CalendarIcon, Move, Save, CheckSquare, PanelRightOpen, PanelRightClose } from "lucide-react";
import { Task, CalendarEvent, TimeBlockNote, insertCalendarEventSchema, insertTaskSchema } from "@shared/schema";
import { apiRequest, queryClient as globalQueryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

// Utility functions for date handling
const getWeekStart = (date: Date) => startOfWeek(date, { weekStartsOn: 0 }); // Sunday start
const formatDate = (date: Date) => format(date, "yyyy-MM-dd");
const formatTime = (hour: number) => {
  const date = new Date().setHours(hour, 0, 0, 0);
  return format(date, "h:mm a");
};

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6am to 10pm
const DAYS_OF_WEEK = ["SUN", "MON", "TUES", "WEDS", "THURS", "FRI", "SAT"];

// Drag and drop item types
const ItemTypes = {
  TASK: 'task',
};

// Component for rendering event continuation indicators
interface EventContinuationProps {
  event: CalendarEvent;
}

function EventContinuation({ event }: EventContinuationProps) {
  return (
    <div 
      className="inline-flex px-1.5 pt-0.5 pb-0 text-xs rounded truncate bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-700"
      data-testid={`event-continuation-${event.id}`}
      style={{ maxWidth: '100%', minWidth: '20px', height: '16px' }}
    >
    </div>
  );
}

interface TaskBlockProps {
  task: Task;
}

function TaskBlock({ task }: TaskBlockProps) {
  const getTaskColor = (color: string | null) => {
    switch (color) {
      case "blue":
        return "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700";
      case "green":
        return "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700";
      case "purple":
        return "bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 border-purple-200 dark:border-purple-700";
      case "orange":
        return "bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-700";
      case "red":
        return "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border-red-200 dark:border-red-700";
      default:
        return "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700";
    }
  };

  return (
    <div 
      className={`px-2 py-1 mb-1 rounded text-xs border ${getTaskColor(task.color)}`}
      data-testid={`task-block-${task.id}`}
    >
      <div className="font-medium truncate">{task.title}</div>
    </div>
  );
}

interface TimeSlotProps {
  date: string;
  hour: number;
  tasks: Task[];
  notes: TimeBlockNote[];
  events: CalendarEvent[];
  continuationEvents: CalendarEvent[];
  isCurrentHour?: boolean;
  isExpanded?: boolean;
  isDayExpanded?: boolean;
  onTimeSlotClick?: (date: string, hour: number) => void;
}

function TimeSlot({ date, hour, tasks, notes, events, continuationEvents, isCurrentHour, isExpanded, isDayExpanded, onTimeSlotClick }: TimeSlotProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [noteContent, setNoteContent] = useState("");
  const [showEventModal, setShowEventModal] = useState(false);
  
  // Get existing note content for this time slot
  useEffect(() => {
    const existingNote = notes.find(note => note.date === date && note.hour === hour);
    setNoteContent(existingNote?.content || "");
  }, [notes, date, hour]);
  
  // Form for creating events via modal
  const eventForm = useForm<z.infer<typeof insertCalendarEventSchema>>({
    resolver: zodResolver(insertCalendarEventSchema),
    defaultValues: {
      title: "",
      description: "",
      date,
      hour,
      duration: 1,
    },
  });
  
  // Set up drop target for tasks
  const [{ isOver }, drop] = useDrop({
    accept: ItemTypes.TASK,
    drop: (item: { id: string, task: Task }) => {
      handleTaskDrop(item.task);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  // Handle dropped tasks
  const scheduleTaskMutation = useMutation({
    mutationFn: async ({ id, title, description, priority, status, completed, scheduledDate, scheduledHour }: { 
      id: string; 
      title: string; 
      description?: string | null; 
      priority: string; 
      status: string; 
      completed: boolean; 
      scheduledDate: string; 
      scheduledHour: number; 
    }) => {
      // Ensure clean, serializable data only
      const cleanData = {
        title: String(title),
        description: description || null,
        priority: String(priority),
        status: String(status),
        completed: Boolean(completed),
        scheduledDate: String(scheduledDate),
        scheduledHour: Number(scheduledHour)
      };
      const response = await apiRequest("PUT", `/api/tasks/${id}`, cleanData);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update task");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({
        title: "Success",
        description: "Task scheduled successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleTaskDrop = (droppedTask: Task) => {
    scheduleTaskMutation.mutate({
      id: droppedTask.id,
      title: droppedTask.title,
      description: droppedTask.description,
      priority: droppedTask.priority,
      status: droppedTask.status,
      completed: droppedTask.completed === 1 ? true : false,
      scheduledDate: date,
      scheduledHour: hour,
    });
  };
  
  // Mutations for saving note content and creating events
  const saveNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      const existingNote = notes.find(note => note.date === date && note.hour === hour);
      
      if (existingNote) {
        // Update existing note with clean data
        const response = await apiRequest("PUT", `/api/time-block-notes/${existingNote.id}`, {
          content: String(content)
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to update note");
        }
        return response.json();
      } else {
        // Create new note with clean data
        const response = await apiRequest("POST", "/api/time-block-notes", {
          date: String(date),
          hour: Number(hour),
          content: String(content)
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to create note");
        }
        return response.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-block-notes"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });
  
  const createEventMutation = useMutation({
    mutationFn: async (eventData: z.infer<typeof insertCalendarEventSchema>) => {
      // Ensure we only send clean, serializable data
      const cleanData = {
        title: eventData.title,
        description: eventData.description || null,
        date: eventData.date,
        hour: eventData.hour,
        duration: eventData.duration || 1
      };
      const response = await apiRequest("POST", "/api/calendar-events", cleanData);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create event");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar-events"] });
      eventForm.reset({ title: "", description: "", date, hour, duration: 1 });
      toast({ title: "Success", description: "Event created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });
  
  const handleNoteBlur = () => {
    const existingNote = notes.find(note => note.date === date && note.hour === hour);
    const existingContent = existingNote?.content || "";
    
    if (noteContent !== existingContent) {
      saveNoteMutation.mutate(noteContent);
    }
  };
  
  const handleCreateEvent = (values: z.infer<typeof insertCalendarEventSchema>) => {
    createEventMutation.mutate(values);
    setShowEventModal(false);
  };
  
  const handleTimeSlotClick = (e: React.MouseEvent) => {
    // Prevent click when dragging
    if (e.defaultPrevented) return;
    e.stopPropagation();
    onTimeSlotClick?.(date, hour);
  };

  // Render collapsed content (single line with truncation)
  const renderCollapsedContent = () => {
    const allItems = [...tasks, ...notes, ...events];
    const totalItems = allItems.length + continuationEvents.length;
    
    if (totalItems === 0) {
      return (
        <div className="flex items-center justify-center h-full opacity-0 hover:opacity-50 transition-opacity">
          <Plus className="h-3 w-3 text-gray-400" />
        </div>
      );
    }

    const visibleItems = allItems.slice(0, 2); // Show max 2 items
    const remainingCount = allItems.length - visibleItems.length;

    return (
      <div className="flex flex-wrap gap-1 overflow-hidden min-h-[1rem] w-full">
        {visibleItems.map((item, index) => {
          if ('priority' in item) {
            // Task
            const task = item as Task;
            return (
              <div 
                key={`task-${task.id}`}
                className={`inline-flex px-1.5 pt-0.5 pb-0 text-xs rounded truncate ${getTaskColor(task.color)}`}
                style={{ maxWidth: '100%' }}
              >
                {task.title}
              </div>
            );
          } else if ('content' in item) {
            // Note
            const note = item as TimeBlockNote;
            return (
              <div 
                key={`note-${note.id}`}
                className="inline-flex px-1.5 pt-0.5 pb-0 text-xs rounded truncate bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200"
                style={{ maxWidth: '100%' }}
              >
                {note.content}
              </div>
            );
          } else {
            // Event
            const event = item as CalendarEvent;
            return (
              <div 
                key={`event-${event.id}`}
                className="inline-flex px-1.5 pt-0.5 pb-0 text-xs rounded truncate bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                style={{ maxWidth: '100%' }}
              >
                {event.title}
              </div>
            );
          }
        })}
        {/* Render continuation indicators inline with other items */}
        {continuationEvents.map(event => (
          <EventContinuation key={`continuation-${event.id}`} event={event} />
        ))}
        {remainingCount > 0 && (
          <div className="inline-flex px-1.5 pt-0.5 pb-0 text-xs rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
            +{remainingCount}
          </div>
        )}
      </div>
    );
  };

  const getTaskColor = (color: string | null) => {
    switch (color) {
      case "blue":
        return "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200";
      case "green":
        return "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200";
      case "purple":
        return "bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200";
      case "orange":
        return "bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200";
      case "red":
        return "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200";
      default:
        return "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200";
    }
  };

  return (
    <div 
      ref={drop}
      className={`w-full relative overflow-hidden transition-colors cursor-pointer hover:bg-orange-50/30 dark:hover:bg-gray-800/50 ${
        isCurrentHour ? "bg-blue-50 dark:bg-blue-950/20" : ""
      } ${
        isOver ? "bg-primary/10 dark:bg-primary/5" : ""
      } ${
        isExpanded ? "bg-primary/20 dark:bg-primary/10 border-l-2 border-primary" : ""
      } ${isExpanded ? "h-auto min-h-[180px]" : "h-12"}`}
      data-testid={`time-slot-${date}-${hour}`}
      onClick={handleTimeSlotClick}
    >
      {isExpanded ? (
        <div 
          className={`p-3 h-full flex flex-col overflow-hidden ${
            isDayExpanded 
              ? "absolute left-0 right-0 top-0 z-50 border border-gray-200 dark:border-gray-700 shadow-lg" 
              : ""
          }`}
          style={isDayExpanded ? { backgroundColor: '#FFF8E9' } : undefined}
          data-testid={`expanded-notes-${date}-${hour}`}
        >
          {/* Time Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {formatTime(hour)} {format(new Date(date), "M/d/yy")}
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                setShowEventModal(true);
              }}
              data-testid="button-add-event"
              className="h-7 px-2 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              event
            </Button>
          </div>
          
          {/* Show existing tasks, notes, events in expanded view */}
          {(tasks.length > 0 || notes.length > 0 || events.length > 0 || continuationEvents.length > 0) && (
            <div className="mb-3 space-y-1">
              {tasks.map(task => (
                <div 
                  key={`task-${task.id}`}
                  className={`px-2 py-1 text-xs rounded ${getTaskColor(task.color)}`}
                >
                  {task.title}
                </div>
              ))}
              {events.map(event => (
                <div 
                  key={`event-${event.id}`}
                  className="px-2 py-1 text-xs rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                >
                  {event.title} {(event.duration || 1) > 1 && `(${event.duration || 1}h)`}
                </div>
              ))}
              {continuationEvents.map(event => (
                <div 
                  key={`continuation-expanded-${event.id}`}
                  className="px-2 py-1 text-xs rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border-l-2 border-blue-500"
                >
                  {event.title} (continues from {event.hour}:00)
                </div>
              ))}
              {notes.filter(note => note.id !== notes.find(n => n.date === date && n.hour === hour)?.id).map(note => (
                <div 
                  key={`note-${note.id}`}
                  className="px-2 py-1 text-xs rounded bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200"
                >
                  {note.content}
                </div>
              ))}
            </div>
          )}
          
          {/* Natural Text Area */}
          <textarea
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            onBlur={handleNoteBlur}
            onClick={(e) => e.stopPropagation()}
            placeholder=""
            className="flex-1 w-full resize-none border-0 bg-transparent text-gray-900 dark:text-gray-100 text-sm leading-relaxed focus:ring-0 focus:outline-none p-0"
            data-testid="textarea-notes"
            autoFocus
          />
        </div>
      ) : (
        <div className="p-1 h-full relative overflow-hidden">
          <div className="w-full h-full overflow-hidden">
            {renderCollapsedContent()}
          </div>
        </div>
      )}
      
      {/* Event Creation Modal */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" data-testid="event-modal-backdrop">
          <div className="rounded-lg shadow-xl w-96 max-w-[90vw] p-6" style={{ backgroundColor: '#FFF8E9' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Add Event</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowEventModal(false)}
                data-testid="button-close-event-modal"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <Form {...eventForm}>
              <form onSubmit={eventForm.handleSubmit(handleCreateEvent)} className="space-y-4">
                <FormField
                  control={eventForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Event Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter event title..." {...field} data-testid="input-event-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={eventForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Enter description..." {...field} value={field.value || ""} data-testid="input-event-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={eventForm.control}
                  name="duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duration (hours)</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" max="12" {...field} value={field.value || 1} onChange={(e) => field.onChange(parseInt(e.target.value) || 1)} data-testid="input-event-duration" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setShowEventModal(false)} data-testid="button-cancel-event">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createEventMutation.isPending} data-testid="button-save-event">
                    {createEventMutation.isPending ? 'Creating...' : 'Create Event'}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </div>
      )}
    </div>
  );
}

interface WeekViewProps {
  weekStart: Date;
  currentDate: Date;
  isCurrentWeek: boolean;
  onTimeBlockClick?: (date: string, hour: number) => void;
  expandedTimeSlot?: { date: string; hour: number } | null;
  setExpandedTimeSlot?: (value: { date: string; hour: number } | null) => void;
  onDayClick?: (date: Date) => void;
  currentWeekStart?: Date;
}

function WeekView({ weekStart, currentDate, isCurrentWeek, onTimeBlockClick, expandedTimeSlot, setExpandedTimeSlot, onDayClick, currentWeekStart }: WeekViewProps) {
  const weekEnd = addDays(weekStart, 6);
  const startDate = formatDate(weekStart);
  const endDate = formatDate(weekEnd);
  
  // Calculate expanded day index
  const expandedDayIndex = expandedTimeSlot ? 
    DAYS_OF_WEEK.findIndex((_, index) => {
      const date = addDays(weekStart, index);
      return formatDate(date) === expandedTimeSlot.date;
    }) : -1;
  
  // Determine which days to hide based on expansion
  const getHiddenDays = () => {
    if (expandedDayIndex === -1) return new Set(); // No expansion, show all days
    
    if (expandedDayIndex >= 1 && expandedDayIndex <= 5) {
      // Weekday expansion (Mon-Fri): Hide both weekend days
      return new Set([0, 6]); // Hide SUN and SAT
    } else if (expandedDayIndex === 0) {
      // Sunday expansion: Hide Saturday
      return new Set([6]); // Hide SAT
    } else if (expandedDayIndex === 6) {
      // Saturday expansion: Hide Sunday
      return new Set([0]); // Hide SUN
    }
    return new Set();
  };
  
  const hiddenDays = getHiddenDays();
  const visibleDayIndices = DAYS_OF_WEEK.map((_, index) => index).filter(index => !hiddenDays.has(index));
  
  // Generate dynamic grid template columns for visible days only
  const generateGridColumns = () => {
    const timeColumn = '64px';
    const dayColumns = visibleDayIndices.map(index => {
      if (index === expandedDayIndex) {
        return 'minmax(0, 2.2fr)';
      }
      return 'minmax(0, 1fr)';
    });
    return [timeColumn, ...dayColumns].join(' ');
  };

  // Fetch data for the week
  const { data: events = [] } = useQuery<CalendarEvent[]>({
    queryKey: ["/api/calendar-events", startDate, endDate],
    queryFn: () => fetch(`/api/calendar-events?startDate=${startDate}&endDate=${endDate}`).then(res => res.json())
  });
  
  // Helper to get events that should show continuation indicators at a specific time
  const getContinuationEvents = (date: string, hour: number) => {
    return events.filter(event => {
      const eventDuration = event.duration || 1;
      const eventStartHour = event.hour;
      const eventEndHour = eventStartHour + eventDuration;
      
      return (
        event.date === date &&
        hour > eventStartHour && 
        hour < eventEndHour
      );
    });
  };

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/tasks", startDate, endDate],
    queryFn: () => fetch(`/api/tasks`).then(res => res.json()).then((allTasks: Task[]) => 
      allTasks.filter(task => task.scheduledDate && task.scheduledDate >= startDate && task.scheduledDate <= endDate)
    )
  });

  const { data: notes = [] } = useQuery<TimeBlockNote[]>({
    queryKey: ["/api/time-block-notes", startDate, endDate],
    queryFn: () => fetch(`/api/time-block-notes?startDate=${startDate}&endDate=${endDate}`).then(res => res.json())
  });

  const getItemsForTimeBlock = (date: string, hour: number) => {
    const dayTasks = tasks.filter(task => task.scheduledDate === date && task.scheduledHour === hour);
    const dayNotes = notes.filter(note => note.date === date && note.hour === hour);
    return { tasks: dayTasks, notes: dayNotes };
  };

  const getEventsForDay = (date: string) => {
    return events.filter(event => event.date === date);
  };

  if (isCurrentWeek) {
    return (
      <Card className="w-full shadow-sm border border-gray-200 dark:border-gray-700" style={{ backgroundColor: '#FFF8E9' }} data-testid="current-week">
        <CardContent className="p-0">
          {/* Header with days */}
          <div 
            className="grid border-b border-gray-200 dark:border-gray-700 transition-all duration-300 ease-in-out"
            style={{ gridTemplateColumns: generateGridColumns() }}
          >
            <div className="p-3 text-sm font-medium text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700" style={{ backgroundColor: '#FFF8E9' }}>
              Time
            </div>
            {visibleDayIndices.map((index) => {
              const day = DAYS_OF_WEEK[index];
              const date = addDays(weekStart, index);
              const dateStr = formatDate(date);
              const isToday = isSameDay(date, currentDate);
              const isDayExpanded = expandedTimeSlot?.date === dateStr;
              
              const handleDayHeaderClick = () => {
                // Clear any time slot expansion and expand this day
                setExpandedTimeSlot?.(null);
                // Set a temporary expanded slot to trigger day-wide expansion
                setTimeout(() => {
                  setExpandedTimeSlot?.({ date: dateStr, hour: 12 }); // Use noon as default
                }, 50);
              };
              
              return (
                <div 
                  key={day}
                  className={`p-3 text-sm font-medium text-center border-r border-gray-200 dark:border-gray-700 last:border-r-0 cursor-pointer transition-all ${
                    isDayExpanded ? "bg-primary/10 dark:bg-primary/20 text-primary" : 
                    isToday ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30" : 
                    "text-gray-600 dark:text-gray-300 hover:bg-orange-50/40 dark:hover:bg-gray-700"
                  }`}
                  style={{ backgroundColor: isDayExpanded || isToday ? undefined : '#FFF8E9' }}
                  onClick={handleDayHeaderClick}
                  data-testid={`day-header-${day.toLowerCase()}`}
                >
                  {day} {format(date, "M/d")}
                </div>
              );
            })}
          </div>
          
          {/* Calendar Grid */}
          <div 
            className="grid transition-all duration-300 ease-in-out"
            style={{ gridTemplateColumns: generateGridColumns() }}
          >
            {/* Time column */}
            <div className="border-r border-gray-200 dark:border-gray-700" style={{ backgroundColor: '#FFF8E9' }}>
              {HOURS.map(hour => (
                <div 
                  key={hour} 
                  className="h-12 p-2 text-xs text-gray-500 dark:text-gray-400 flex items-start justify-center pt-2 border-b border-gray-100 dark:border-gray-800"
                >
                  {formatTime(hour)}
                </div>
              ))}
            </div>
            
            {/* Day columns with CSS Grid */}
            {visibleDayIndices.map((dayIndex) => {
              const day = DAYS_OF_WEEK[dayIndex];
              const date = addDays(weekStart, dayIndex);
              const dateStr = formatDate(date);
              const isToday = isSameDay(date, currentDate);
              const dayEvents = getEventsForDay(dateStr);
              const isDayExpanded = expandedTimeSlot?.date === dateStr;
              
              return (
                <div 
                  key={`${dateStr}`}
                  className={`relative border-r border-gray-100 dark:border-gray-800 last:border-r-0 overflow-hidden transition-all ${
                    isDayExpanded ? "shadow-lg rounded-sm" : ""
                  }`}
                  style={{
                    display: 'grid',
                    gridTemplateRows: `repeat(${HOURS.length}, minmax(3rem, auto))`,
                    gridTemplateColumns: '1fr',
                    backgroundColor: isDayExpanded ? '#FFFBF5' : 'transparent'
                  }}
                  data-testid={`day-column-${dateStr}`}
                >
                  {/* No more spanning events - multi-hour events now handled in TimeSlot */}
                  
                  {/* Render time slots for tasks and notes */}
                  {HOURS.map((hour, hourIndex) => {
                    const isCurrentHour = hour === new Date().getHours() && isToday;
                    const { tasks: dayTasks, notes: dayNotes } = getItemsForTimeBlock(dateStr, hour);
                    
                    return (
                      <div 
                        key={`${dateStr}-${hour}`}
                        className={`border-b border-gray-100 dark:border-gray-800 ${
                          isCurrentHour ? "bg-blue-50 dark:bg-blue-950/20" : ""
                        }`}
                        style={{ gridRow: hourIndex + 1 }}
                        data-testid={`time-cell-${dateStr}-${hour}`}
                      >
                        <TimeSlot
                          date={dateStr}
                          hour={hour}
                          tasks={dayTasks}
                          notes={dayNotes}
                          events={events.filter(event => event.date === dateStr && event.hour === hour)}
                          continuationEvents={getContinuationEvents(dateStr, hour)}
                          isCurrentHour={isCurrentHour}
                          isExpanded={expandedTimeSlot?.date === dateStr && expandedTimeSlot?.hour === hour}
                          isDayExpanded={expandedTimeSlot?.date === dateStr}
                          onTimeSlotClick={onTimeBlockClick}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })}
            
            {/* Sidebar overlay removed - now using fixed right sidebar */}
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // Condensed view for non-current weeks
  const getTaskDotColor = (color: string | null) => {
    switch (color) {
      case "blue":
        return "bg-blue-500";
      case "green":
        return "bg-green-500";
      case "purple":
        return "bg-purple-500";
      case "orange":
        return "bg-orange-500";
      case "red":
        return "bg-red-500";
      default:
        return "bg-blue-500";
    }
  };
  
  const isPreviousWeek = currentWeekStart ? weekStart < currentWeekStart : weekStart < new Date();
  
  const handleWeekTitleClick = () => {
    if (onDayClick) {
      // Navigate to the first day of this week
      onDayClick(weekStart);
    }
  };
  
  return (
    <Card className="w-full shadow-sm" style={{ backgroundColor: '#FFF8E9' }} data-testid="condensed-week">
      <CardContent className="p-3">
        <button 
          onClick={handleWeekTitleClick}
          className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 mb-2 transition-colors cursor-pointer"
          data-testid={`button-navigate-${isPreviousWeek ? 'prev' : 'next'}-week`}
        >
          {isPreviousWeek ? "Previous week" : "Next week"}
        </button>
        <div className="grid grid-cols-7 gap-1">
          {DAYS_OF_WEEK.map((day, index) => {
            const date = addDays(weekStart, index);
            const dateStr = formatDate(date);
            const dayEvents = events.filter(event => event.date === dateStr);
            const dayTasks = tasks.filter(task => task.scheduledDate === dateStr);
            const dayNotes = notes.filter(note => note.date === dateStr);
            const allItems = [...dayTasks, ...dayNotes, ...dayEvents];
            const hasContent = allItems.length > 0;
            
            const handleDayClick = () => {
              if (onDayClick) {
                onDayClick(date);
              }
            };
            
            return (
              <div 
                key={day}
                className={`p-1.5 min-h-14 text-xs rounded border cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] ${
                  hasContent 
                    ? "border-gray-300 dark:border-gray-600 hover:bg-orange-50/50 dark:hover:bg-gray-600/20" 
                    : "border-gray-200 dark:border-gray-600 hover:bg-orange-50/30 dark:hover:bg-gray-600/20"
                }`}
                style={{ backgroundColor: '#FFF8E9' }}
                onClick={handleDayClick}
                data-testid={`condensed-day-${day.toLowerCase()}`}
              >
                <div className="text-center font-medium text-gray-700 dark:text-gray-300 mb-1 text-[0.65rem]">
                  {day.slice(0, 3)} {format(date, "M/d")}
                </div>
                {hasContent && (
                  <div className="space-y-1">
                    {dayTasks.slice(0, 2).map((task, idx) => (
                      <div 
                        key={`task-${idx}`}
                        className={`px-2 py-0.5 rounded-full text-[0.6rem] truncate ${
                          task.color === 'blue' ? 'bg-blue-200 dark:bg-blue-700 text-blue-900 dark:text-blue-100' :
                          task.color === 'green' ? 'bg-green-200 dark:bg-green-700 text-green-900 dark:text-green-100' :
                          task.color === 'purple' ? 'bg-purple-200 dark:bg-purple-700 text-purple-900 dark:text-purple-100' :
                          task.color === 'orange' ? 'bg-orange-200 dark:bg-orange-700 text-orange-900 dark:text-orange-100' :
                          task.color === 'red' ? 'bg-red-200 dark:bg-red-700 text-red-900 dark:text-red-100' :
                          'bg-blue-200 dark:bg-blue-700 text-blue-900 dark:text-blue-100'
                        }`}
                      >
                        {task.title}
                      </div>
                    ))}
                    {dayNotes.slice(0, 2).map((note, idx) => (
                      <div 
                        key={`note-${idx}`}
                        className="px-2 py-0.5 rounded-full text-[0.6rem] truncate bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-gray-100"
                      >
                        {note.content.substring(0, 20)}
                      </div>
                    ))}
                    {dayEvents.slice(0, 2).map((event, idx) => (
                      <div 
                        key={`event-${idx}`}
                        className="px-2 py-0.5 rounded-full text-[0.6rem] truncate bg-indigo-200 dark:bg-indigo-700 text-indigo-900 dark:text-indigo-100"
                      >
                        {event.title}
                      </div>
                    ))}
                    {allItems.length > 6 && (
                      <div className="text-center text-gray-500 dark:text-gray-400 text-[0.6rem] pt-0.5">
                        +{allItems.length - 6}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

interface DraggableTaskProps {
  task: Task;
  bgColor: string;
  borderColor: string;
  onTaskClick?: (task: Task) => void;
}

function DraggableTask({ task, bgColor, borderColor, onTaskClick }: DraggableTaskProps) {
  const [{ isDragging }, drag] = useDrag({
    type: ItemTypes.TASK,
    item: { id: task.id, task },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });
  
  const handleClick = (e: React.MouseEvent) => {
    // Only handle click if not dragging and onTaskClick is provided
    if (!isDragging && onTaskClick) {
      e.stopPropagation();
      onTaskClick(task);
    }
  };

  const getTaskDotColor = (color: string | null) => {
    switch (color) {
      case "blue":
        return "bg-blue-500";
      case "green":
        return "bg-green-500";
      case "purple":
        return "bg-purple-500";
      case "orange":
        return "bg-orange-500";
      case "red":
        return "bg-red-500";
      default:
        return "bg-blue-500";
    }
  };

  return (
    <div
      ref={drag}
      className={`p-2 rounded cursor-pointer transition-opacity bg-white/40 dark:bg-gray-800/40 shadow-sm hover:bg-white/60 dark:hover:bg-gray-700/60 ${
        isDragging ? "opacity-50" : ""
      }`}
      onClick={handleClick}
      data-testid={`draggable-task-${task.id}`}
    >
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${getTaskDotColor(task.color)}`} />
        <span className="text-sm text-gray-900 dark:text-gray-100 flex-1">{task.title}</span>
        <Move className="h-3 w-3 text-gray-400" />
      </div>
      {task.description && (
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-4">
          {task.description.length > 50 ? task.description.substring(0, 50) + "..." : task.description}
        </div>
      )}
    </div>
  );
}

interface TaskSidebarSectionProps {
  title: string;
  status: "todo" | "upcoming" | "later";
  tasks: Task[];
  icon: React.ReactNode;
  bgColor: string;
  borderColor: string;
}

function TaskSidebarSection({ title, status, tasks, icon, bgColor, borderColor }: TaskSidebarSectionProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const { toast } = useToast();
  
  const queryClient = useQueryClient();
  
  // Set up drop target for tasks from other lists
  const [{ isOver }, drop] = useDrop({
    accept: ItemTypes.TASK,
    drop: (item: { id: string, task: Task }) => {
      // Only update if the task is moving to a different status
      if (item.task.status !== status) {
        updateTaskMutation.mutate({ 
          id: item.id, 
          taskData: { 
            ...item.task,
            status: status,
            scheduledDate: null, // Unschedule when moving to sidebar
            scheduledHour: null
          }
        });
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  // Form for creating new tasks
  const addTaskForm = useForm<z.infer<typeof insertTaskSchema>>({
    resolver: zodResolver(insertTaskSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
      status: status,
      color: "blue",
      scheduledDate: null,
      scheduledHour: null,
      completed: false,
    },
  });

  // Form for editing existing tasks
  const editTaskForm = useForm<z.infer<typeof insertTaskSchema>>({  
    resolver: zodResolver(insertTaskSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
      status: status,
      color: "blue",
      scheduledDate: null,
      scheduledHour: null,
      completed: false,
    },
  });
  
  // Create task mutation
  const sidebarCreateTaskMutation = useMutation({
    mutationFn: async (taskData: any) => {
      const response = await apiRequest("POST", "/api/tasks", taskData);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create task");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setShowAddForm(false);
      addTaskForm.reset({
        title: "",
        description: "",
        priority: "medium",
        status: status,
        color: "blue",
        scheduledDate: null,
        scheduledHour: null,
        completed: false,
      });
      toast({
        title: "Success",
        description: "Task created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, taskData }: { id: string; taskData: any }) => {
      const response = await apiRequest("PATCH", `/api/tasks/${id}`, taskData);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update task");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setEditingTask(null);
      toast({
        title: "Success",
        description: "Task updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleAddTask = (values: z.infer<typeof insertTaskSchema>) => {
    sidebarCreateTaskMutation.mutate(values);
  };
  
  const handleEditTask = (values: z.infer<typeof insertTaskSchema>) => {
    if (editingTask) {
      updateTaskMutation.mutate({ id: editingTask.id, taskData: values });
    }
  };
  
  const handleTaskClick = (task: Task) => {
    setEditingTask(task);
    editTaskForm.reset({
      title: task.title,
      description: task.description || "",
      priority: task.priority as "low" | "medium" | "high",
      status: task.status as "todo" | "upcoming" | "later",
      color: task.color || "blue",
      scheduledDate: task.scheduledDate,
      scheduledHour: task.scheduledHour,
      completed: !!task.completed,
    });
  };

  return (
    <div 
      ref={drop}
      className={`mb-6 p-3 rounded border-2 border-dashed transition-colors ${
        isOver 
          ? "border-blue-400 bg-blue-50 dark:bg-blue-950/30" 
          : "border-transparent"
      }`} 
      data-testid={`task-section-${status}`}
    >
      {/* Header with inline Add Task button */}
      <div className="flex items-center justify-between mb-3" data-testid={`section-header-${status}`}>
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-medium text-gray-900 dark:text-gray-100">{title}</h3>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowAddForm(true)}
          data-testid={`button-add-${status}-task`}
          className="h-7 text-xs"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Task
        </Button>
      </div>
      
      {/* Task List */}
      <div className="space-y-2">
        {/* Task list - always visible, no collapsing */}
        {tasks.map(task => (
          <DraggableTask 
            key={task.id}
            task={task}
            bgColor={bgColor}
            borderColor={borderColor}
            onTaskClick={handleTaskClick}
          />
        ))}
        
        {tasks.length === 0 && !showAddForm && (
          <div className="text-xs text-muted-foreground dark:text-muted-foreground italic p-2">
            No {title.toLowerCase()} tasks
          </div>
        )}
      </div>
      
      {/* Add Task Form */}
      {showAddForm && (
                <div className="space-y-3 p-3 border border-border dark:border-border rounded bg-muted/30 dark:bg-muted/20">
                  <Form {...addTaskForm}>
                    <form onSubmit={addTaskForm.handleSubmit(handleAddTask)} className="space-y-3">
                      <FormField
                        control={addTaskForm.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Task Title</FormLabel>
                            <FormControl>
                              <Input placeholder="Task title..." {...field} data-testid="input-task-title" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={addTaskForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description (optional)</FormLabel>
                            <FormControl>
                              <Textarea placeholder="Description (optional)..." rows={2} {...field} value={field.value || ""} data-testid="input-task-description" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <FormField
                          control={addTaskForm.control}
                          name="priority"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Priority</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-task-priority">
                                    <SelectValue placeholder="Select priority" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="low">Low Priority</SelectItem>
                                  <SelectItem value="medium">Medium Priority</SelectItem>
                                  <SelectItem value="high">High Priority</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={addTaskForm.control}
                          name="color"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Color</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value || "blue"}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-task-color">
                                    <SelectValue placeholder="Select color" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="blue">Blue</SelectItem>
                                  <SelectItem value="green">Green</SelectItem>
                                  <SelectItem value="purple">Purple</SelectItem>
                                  <SelectItem value="orange">Orange</SelectItem>
                                  <SelectItem value="red">Red</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          type="submit"
                          disabled={sidebarCreateTaskMutation.isPending || !addTaskForm.formState.isValid}
                          data-testid="button-save-task"
                        >
                          <Save className="h-3 w-3 mr-1" />
                          Save Task
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowAddForm(false)}
                          data-testid="button-cancel-add"
                        >
                          <X className="h-3 w-3 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </Form>
                </div>
              )}
      
      {/* Edit Task Form */}
      {editingTask && (
        <div className="space-y-3 p-3 border border-border dark:border-border rounded bg-blue-50 dark:bg-blue-950/30 mb-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900 dark:text-gray-100">Edit Task</h4>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditingTask(null)}
              data-testid="button-close-edit"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          <Form {...editTaskForm}>
            <form onSubmit={editTaskForm.handleSubmit(handleEditTask)} className="space-y-3">
              <FormField
                control={editTaskForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Task Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Task title..." {...field} data-testid="input-edit-task-title" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editTaskForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Description (optional)..." rows={2} {...field} value={field.value || ""} data-testid="input-edit-task-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={editTaskForm.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-task-priority">
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editTaskForm.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Color</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value || "blue"}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-task-color">
                            <SelectValue placeholder="Select color" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="blue">Blue</SelectItem>
                          <SelectItem value="green">Green</SelectItem>
                          <SelectItem value="purple">Purple</SelectItem>
                          <SelectItem value="orange">Orange</SelectItem>
                          <SelectItem value="red">Red</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  type="submit"
                  disabled={updateTaskMutation.isPending || !editTaskForm.formState.isValid}
                  data-testid="button-update-task"
                >
                  <Save className="h-3 w-3 mr-1" />
                  Update Task
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditingTask(null)}
                  data-testid="button-cancel-edit"
                >
                  <X className="h-3 w-3 mr-1" />
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </div>
      )}
    </div>
  );
}

function TaskSidebarContent() {
  const { toast } = useToast();
  const currentDate = new Date();

  // Fetch all tasks to categorize by status and scheduling
  const { data: allTasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
    queryFn: () => fetch("/api/tasks").then(res => res.json())
  });

  // Filter unscheduled tasks by status
  const todoTasks = allTasks.filter(task => 
    task.status === "todo" && !task.scheduledDate && !task.scheduledHour
  );
  const upcomingTasks = allTasks.filter(task => 
    task.status === "upcoming" && !task.scheduledDate && !task.scheduledHour
  );
  const laterTasks = allTasks.filter(task => 
    task.status === "later" && !task.scheduledDate && !task.scheduledHour
  );

  if (isLoading) {
    return (
      <div className="text-center text-gray-500 dark:text-gray-400">Loading tasks...</div>
    );
  }

  return (
    <>
      {/* To-Do Section */}
      <TaskSidebarSection 
        title={`TO-DO (${todoTasks.length})`}
        status="todo"
        tasks={todoTasks}
        icon={<CheckSquare className="h-4 w-4 text-red-600 dark:text-red-400" />}
        bgColor="bg-red-50 dark:bg-red-950/30"
        borderColor="border-red-200 dark:border-red-800"
      />

      {/* Upcoming Section */}
      <TaskSidebarSection 
        title={`UPCOMING (${upcomingTasks.length})`}
        status="upcoming"
        tasks={upcomingTasks}
        icon={<CalendarIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
        bgColor="bg-blue-50 dark:bg-blue-950/30"
        borderColor="border-blue-200 dark:border-blue-800"
      />

      {/* Later Section */}
      <TaskSidebarSection 
        title={`LATER (${laterTasks.length})`}
        status="later"
        tasks={laterTasks}
        icon={<Clock className="h-4 w-4 text-gray-600 dark:text-gray-400" />}
        bgColor="bg-gray-50 dark:bg-gray-950/30"
        borderColor="border-gray-200 dark:border-gray-800"
      />
    </>
  );
}

function TaskSidebar() {
  const currentDate = new Date();

  return (
    <div className="w-80 backdrop-blur-md border-l border-gray-200 dark:border-gray-700 p-4" style={{ backgroundColor: 'rgba(255, 207, 151, 0.3)' }} data-testid="task-sidebar">
      <TaskSidebarContent />
    </div>
  );
}

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [expandedTimeSlot, setExpandedTimeSlot] = useState<{ date: string; hour: number } | null>(null);
  
  // Sidebar toggle state with localStorage persistence and responsive behavior
  const isMobile = useIsMobile();
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    // Default to closed on mobile, open on desktop
    const defaultValue = !isMobile;
    try {
      const stored = localStorage.getItem('calendar.sidebar');
      return stored !== null ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  // Persist sidebar state to localStorage and handle mobile responsiveness
  useEffect(() => {
    // On mobile, default to closed unless user explicitly opened it
    if (isMobile && !localStorage.getItem('calendar.sidebar')) {
      setIsSidebarOpen(false);
    }
    
    try {
      localStorage.setItem('calendar.sidebar', JSON.stringify(isSidebarOpen));
    } catch {
      // Ignore localStorage errors
    }
  }, [isSidebarOpen, isMobile]);

  const toggleSidebar = () => {
    setIsSidebarOpen((prev: boolean) => !prev);
  };

  const currentWeekStart = getWeekStart(currentDate);
  const previousWeekStart = addWeeks(currentWeekStart, -1);
  const nextWeekStart = addWeeks(currentWeekStart, 1);

  const navigateWeek = (direction: "prev" | "next") => {
    const newDate = addWeeks(currentDate, direction === "next" ? 1 : -1);
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };
  
  const handleTimeBlockClick = (date: string, hour: number) => {
    // Toggle expanded state - close if already expanded, open if not
    if (expandedTimeSlot?.date === date && expandedTimeSlot?.hour === hour) {
      setExpandedTimeSlot(null);
    } else {
      setExpandedTimeSlot({ date, hour });
    }
  };
  
  const handleDayClick = (date: Date) => {
    // Navigate to the week containing this date
    setCurrentDate(date);
    // Clear any expanded time slots when navigating to a different week
    setExpandedTimeSlot(null);
  };

  // Sidebar content component for reuse
  const sidebarContent = (
    <div className="p-4 h-full overflow-y-auto">
      {/* Date Display */}
      <div className="mb-6">
        <button 
          onClick={goToToday}
          className="text-xl font-semibold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
          data-testid="button-jump-to-today"
        >
          {format(currentDate, "MMMM d, yyyy")}
        </button>
      </div>
      
      {/* Task Sidebar Content */}
      <TaskSidebarContent />
    </div>
  );

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="min-h-screen bg-background relative" data-testid="calendar-page">
        {/* Floating Button Group in Top-Right */}
        <div className="fixed top-4 right-4 z-50 flex gap-2">
          {/* Today Button - Shows when sidebar is closed */}
          {!isSidebarOpen && (
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
              data-testid="button-today-floating"
              className="shadow-lg"
              style={{ backgroundColor: '#FFF8E9' }}
            >
              {format(new Date(), "MMM d")}
            </Button>
          )}
          
          {/* Sidebar Toggle Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={toggleSidebar}
            data-testid="button-toggle-sidebar"
            aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
            aria-expanded={isSidebarOpen}
            className="shadow-lg"
            style={{ backgroundColor: '#FFF8E9' }}
          >
            {isSidebarOpen ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <PanelRightOpen className="h-4 w-4" />
            )}
            <span className="sr-only">
              {isSidebarOpen ? "Close sidebar" : "Open sidebar"}
            </span>
          </Button>
        </div>

        {/* Main Content Area */}
        <div className="flex min-h-screen">
          {/* Main Calendar Area */}
          <main className={`${isSidebarOpen && !isMobile ? 'flex-1 min-w-0 mr-80' : 'w-full'} p-4`}>
            {/* Previous Week - Sticky at top */}
            <div className="sticky top-0 z-10 mb-4 pt-4">
              <WeekView 
                weekStart={previousWeekStart}
                currentDate={currentDate}
                isCurrentWeek={false}
                expandedTimeSlot={null}
                onDayClick={handleDayClick}
                currentWeekStart={currentWeekStart}
              />
            </div>
            
            <div className="w-full space-y-4">
              {/* Current Week */}
              <WeekView 
                weekStart={currentWeekStart}
                currentDate={currentDate}
                isCurrentWeek={true}
                onTimeBlockClick={handleTimeBlockClick}
                expandedTimeSlot={expandedTimeSlot}
                setExpandedTimeSlot={setExpandedTimeSlot}
                currentWeekStart={currentWeekStart}
              />
            </div>
            
            {/* Next Week - Sticky at bottom */}
            <div className="sticky bottom-0 mt-4 pb-4 z-10">
              <WeekView 
                weekStart={nextWeekStart}
                currentDate={currentDate}
                isCurrentWeek={false}
                expandedTimeSlot={null}
                onDayClick={handleDayClick}
                currentWeekStart={currentWeekStart}
              />
            </div>
          </main>
          
          {/* Desktop Sidebar - Fixed Position */}
          {!isMobile && isSidebarOpen && (
            <aside 
              className="fixed right-0 top-0 h-screen w-80 backdrop-blur-md border-l border-gray-200 dark:border-gray-700 transform transition-transform duration-300 ease-in-out translate-x-0"
              style={{ backgroundColor: 'rgba(255, 207, 151, 0.3)' }}
              data-testid="desktop-sidebar"
            >
              {sidebarContent}
            </aside>
          )}
        </div>

        {/* Mobile Sheet Sidebar */}
        {isMobile && (
          <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
            <SheetContent side="right" className="w-80 p-0" data-testid="mobile-sidebar">
              <SheetHeader className="p-4 pb-0">
                <SheetTitle>Calendar Sidebar</SheetTitle>
              </SheetHeader>
              {sidebarContent}
            </SheetContent>
          </Sheet>
        )}
      </div>
    </DndProvider>
  );
}