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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Plus, Clock, CheckSquare, FileText, Edit2, Save, X, Trash2, List, Calendar as CalendarIcon, Move } from "lucide-react";
import { Task, CalendarEvent, TimeBlockNote, insertTaskSchema, insertTimeBlockNoteSchema, insertCalendarEventSchema } from "@shared/schema";
import { apiRequest, queryClient as globalQueryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

// Utility functions for date handling
const getWeekStart = (date: Date) => startOfWeek(date, { weekStartsOn: 1 }); // Monday start
const formatDate = (date: Date) => format(date, "yyyy-MM-dd");
const formatTime = (hour: number) => format(new Date().setHours(hour, 0, 0, 0), "HH:mm");

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Drag and drop item types
const ItemTypes = {
  TASK: 'task',
};

// Form schemas for add operations
const addTaskFormSchema = insertTaskSchema.extend({
  scheduledDate: z.string().min(1, "Date is required"),
  scheduledHour: z.number().min(0).max(23),
});

const addNoteFormSchema = insertTimeBlockNoteSchema.extend({
  content: z.string().min(1, "Note content is required").max(1000, "Note content is too long"),
});

const addEventFormSchema = insertCalendarEventSchema.extend({
  title: z.string().min(1, "Event title is required").max(200, "Title is too long"),
  duration: z.number().min(1, "Duration must be at least 1 hour").max(6, "Duration cannot exceed 6 hours"),
});

// Form schemas for edit operations  
const editTaskFormSchema = addTaskFormSchema.extend({
  id: z.string(),
});

const editNoteFormSchema = addNoteFormSchema.extend({
  id: z.string(),
});

const editEventFormSchema = addEventFormSchema.extend({
  id: z.string(),
});

interface TimeBlockDetailsProps {
  date: string;
  hour: number;
  events: CalendarEvent[];
  tasks: Task[];
  notes: TimeBlockNote[];
  isExpanded: boolean;
  onToggle: () => void;
}

function TimeBlockDetails({ date, hour, events, tasks, notes, isExpanded, onToggle }: TimeBlockDetailsProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [addType, setAddType] = useState<"task" | "note" | "event">("task");
  const [editingItem, setEditingItem] = useState<{type: "task" | "note" | "event", id: string} | null>(null);
  const { toast } = useToast();
  
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

  const queryClient = useQueryClient();

  // Handle dropped tasks
  const scheduleTaskMutation = useMutation({
    mutationFn: async ({ id, ...updateData }: { id: string } & any) => {
      const response = await apiRequest("PUT", `/api/tasks/${id}`, updateData);
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
  
  // Form instances for adding items
  const addTaskForm = useForm<z.infer<typeof addTaskFormSchema>>({
    resolver: zodResolver(addTaskFormSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
      status: "todo",
      scheduledDate: date,
      scheduledHour: hour,
      completed: false,
    },
  });

  const addNoteForm = useForm<z.infer<typeof addNoteFormSchema>>({
    resolver: zodResolver(addNoteFormSchema),
    defaultValues: {
      date,
      hour,
      content: "",
    },
  });

  const addEventForm = useForm<z.infer<typeof addEventFormSchema>>({
    resolver: zodResolver(addEventFormSchema),
    defaultValues: {
      title: "",
      description: "",
      date,
      hour,
      duration: 1,
    },
  });

  const dateObj = parseISO(date);
  const hourString = formatTime(hour);

  // Mutations for creating items
  const createTaskMutation = useMutation({
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
      resetAddForm();
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

  const createNoteMutation = useMutation({
    mutationFn: async (noteData: any) => {
      const response = await apiRequest("POST", "/api/time-block-notes", noteData);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create note");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-block-notes"] });
      resetAddForm();
      toast({
        title: "Success",
        description: "Note created successfully",
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

  const createEventMutation = useMutation({
    mutationFn: async (eventData: any) => {
      const response = await apiRequest("POST", "/api/calendar-events", eventData);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create event");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar-events"] });
      resetAddForm();
      toast({
        title: "Success",
        description: "Event created successfully",
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

  const resetAddForm = () => {
    setShowAddForm(false);
    // Reset forms while preserving date/hour defaults
    addTaskForm.reset({
      title: "",
      description: "",
      priority: "medium",
      status: "todo",
      scheduledDate: date,
      scheduledHour: hour,
      completed: false,
    });
    addNoteForm.reset({
      date,
      hour,
      content: "",
    });
    addEventForm.reset({
      title: "",
      description: "",
      date,
      hour,
      duration: 1,
    });
  };

  const handleAddTask = (values: z.infer<typeof addTaskFormSchema>) => {
    createTaskMutation.mutate(values);
  };

  const handleAddNote = (values: z.infer<typeof addNoteFormSchema>) => {
    createNoteMutation.mutate(values);
  };

  const handleAddEvent = (values: z.infer<typeof addEventFormSchema>) => {
    createEventMutation.mutate(values);
  };
  
  return (
    <div ref={drop}>
      <Collapsible open={isExpanded} onOpenChange={() => onToggle()}>
        <CollapsibleTrigger asChild>
          <div className={`w-full text-left focus:outline-none focus:ring-2 focus:ring-primary/50 rounded transition-colors ${
            isOver ? "bg-primary/10 dark:bg-primary/5 border-primary/50" : ""
          }`} data-testid={`trigger-timeblock-${date}-${hour}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground dark:text-muted-foreground">
                {format(dateObj, "EEE")} {hourString}
              </span>
              {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </div>
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="mt-2" data-testid={`expanded-timeblock-${date}-${hour}`}>
          <div className={`space-y-3 p-3 border rounded-md shadow-sm transition-colors ${
            isOver 
              ? "bg-primary/5 dark:bg-primary/10 border-primary/30 dark:border-primary/50" 
              : "bg-background dark:bg-background border-border dark:border-border"
          }`}>
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm text-foreground dark:text-foreground">
                {format(dateObj, "EEEE, MMM d, yyyy")} at {hourString}
              </h4>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => setShowAddForm(!showAddForm)}
                data-testid="button-add-content"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            </div>

          {/* Add Form */}
          {showAddForm && (
            <div className="space-y-3 p-3 border border-border dark:border-border rounded-md bg-muted/30 dark:bg-muted/20" data-testid="add-form">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Add:</span>
                <Select value={addType} onValueChange={(value: "task" | "note" | "event") => setAddType(value)}>
                  <SelectTrigger className="w-32" data-testid="select-add-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="task">Task</SelectItem>
                    <SelectItem value="note">Note</SelectItem>
                    <SelectItem value="event">Event</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {addType === "task" && (
                <Form {...addTaskForm}>
                  <form id={`add-task-form-${date}-${hour}`} onSubmit={addTaskForm.handleSubmit(handleAddTask)} className="space-y-4">
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
                  </form>
                </Form>
              )}

              {addType === "note" && (
                <Form {...addNoteForm}>
                  <form id={`add-note-form-${date}-${hour}`} onSubmit={addNoteForm.handleSubmit(handleAddNote)} className="space-y-4">
                    <FormField
                      control={addNoteForm.control}
                      name="content"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Note Content</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Write your note..." rows={3} {...field} data-testid="input-note-content" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </form>
                </Form>
              )}

              {addType === "event" && (
                <Form {...addEventForm}>
                  <form id={`add-event-form-${date}-${hour}`} onSubmit={addEventForm.handleSubmit(handleAddEvent)} className="space-y-4">
                    <FormField
                      control={addEventForm.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Event Title</FormLabel>
                          <FormControl>
                            <Input placeholder="Event title..." {...field} data-testid="input-event-title" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={addEventForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description (optional)</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Description (optional)..." rows={2} {...field} value={field.value || ""} data-testid="input-event-description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={addEventForm.control}
                      name="duration"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Duration</FormLabel>
                          <Select onValueChange={(value) => field.onChange(parseInt(value))} defaultValue={field.value?.toString()}>
                            <FormControl>
                              <SelectTrigger className="w-32" data-testid="select-event-duration">
                                <SelectValue placeholder="Select duration" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {[1, 2, 3, 4, 5, 6].map(hours => (
                                <SelectItem key={hours} value={hours.toString()}>{hours} hour{hours > 1 ? "s" : ""}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </form>
                </Form>
              )}

              <div className="flex gap-2">
                {addType === "task" && (
                  <Button
                    size="sm"
                    type="submit"
                    form={`add-task-form-${date}-${hour}`}
                    disabled={createTaskMutation.isPending || !addTaskForm.formState.isValid}
                    data-testid="button-save-item"
                  >
                    <Save className="h-3 w-3 mr-1" />
                    Save Task
                  </Button>
                )}
                {addType === "note" && (
                  <Button
                    size="sm"
                    type="submit"
                    form={`add-note-form-${date}-${hour}`}
                    disabled={createNoteMutation.isPending || !addNoteForm.formState.isValid}
                    data-testid="button-save-item"
                  >
                    <Save className="h-3 w-3 mr-1" />
                    Save Note
                  </Button>
                )}
                {addType === "event" && (
                  <Button
                    size="sm"
                    type="submit"
                    form={`add-event-form-${date}-${hour}`}
                    disabled={createEventMutation.isPending || !addEventForm.formState.isValid}
                    data-testid="button-save-item"
                  >
                    <Save className="h-3 w-3 mr-1" />
                    Save Event
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={resetAddForm}
                  data-testid="button-cancel-add"
                >
                  <X className="h-3 w-3 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Display existing items */}
          <div className="space-y-4">
            {/* Events */}
            {events.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <h5 className="text-sm font-medium text-foreground dark:text-foreground">Events</h5>
                </div>
                {events.map(event => (
                  <div key={event.id} className="p-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded">
                    <div className="font-medium text-sm">{event.title}</div>
                    {event.description && <div className="text-xs text-muted-foreground mt-1">{event.description}</div>}
                    <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">{event.duration} hour{event.duration !== 1 ? 's' : ''}</div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Tasks */}
            {tasks.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <h5 className="text-sm font-medium text-foreground dark:text-foreground">Tasks</h5>
                </div>
                {tasks.map(task => (
                  <div key={task.id} className="p-2 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded">
                    <div className="font-medium text-sm">{task.title}</div>
                    {task.description && <div className="text-xs text-muted-foreground mt-1">{task.description}</div>}
                    <div className="flex gap-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        task.priority === "high" ? "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200" :
                        task.priority === "medium" ? "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200" :
                        "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                      }`}>
                        {task.priority}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                        {task.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Notes */}
            {notes.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  <h5 className="text-sm font-medium text-foreground dark:text-foreground">Notes</h5>
                </div>
                {notes.map(note => (
                  <div key={note.id} className="p-2 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded">
                    <div className="text-sm text-purple-900 dark:text-purple-100 whitespace-pre-wrap">{note.content}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

interface WeekViewProps {
  weekStart: Date;
  currentDate: Date;
  isCurrentWeek: boolean;
  onTimeBlockClick: (date: string, hour: number) => void;
  expandedBlock: {date: string, hour: number} | null;
  onToggleExpanded: (date: string, hour: number) => void;
}

function WeekView({ weekStart, currentDate, isCurrentWeek, onTimeBlockClick, expandedBlock, onToggleExpanded }: WeekViewProps) {
  const weekEnd = addDays(weekStart, 6);
  const startDate = formatDate(weekStart);
  const endDate = formatDate(weekEnd);

  // Fetch data for the week
  const { data: events = [] } = useQuery<CalendarEvent[]>({
    queryKey: ["/api/calendar-events", startDate, endDate],
    queryFn: () => fetch(`/api/calendar-events?startDate=${startDate}&endDate=${endDate}`).then(res => res.json())
  });

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
    const dayEvents = events.filter(event => event.date === date && event.hour === hour);
    const dayTasks = tasks.filter(task => task.scheduledDate === date && task.scheduledHour === hour);
    const dayNotes = notes.filter(note => note.date === date && note.hour === hour);
    return { events: dayEvents, tasks: dayTasks, notes: dayNotes };
  };

  if (isCurrentWeek) {
    return (
      <Card className="w-full bg-background dark:bg-background" data-testid="current-week">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-center text-foreground dark:text-foreground">
            {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-8 border-b border-border dark:border-border">
            <div className="p-2 text-xs font-medium text-muted-foreground dark:text-muted-foreground border-r border-border dark:border-border">
              Time
            </div>
            {DAYS_OF_WEEK.map((day, index) => {
              const date = addDays(weekStart, index);
              const isToday = isSameDay(date, currentDate);
              return (
                <div 
                  key={day}
                  className={`p-2 text-xs font-medium text-center border-r border-border dark:border-border last:border-r-0 ${
                    isToday ? "bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary" : "text-muted-foreground dark:text-muted-foreground"
                  }`}
                  data-testid={`day-header-${day.toLowerCase()}`}
                >
                  {day}<br />
                  <span className="text-xs">{format(date, "d")}</span>
                </div>
              );
            })}
          </div>
          
          {/* Hour rows */}
          {HOURS.map(hour => (
            <div key={hour} className="grid grid-cols-8 border-b border-border/50 dark:border-border/50 min-h-12">
              <div className="p-1 text-xs text-muted-foreground dark:text-muted-foreground border-r border-border dark:border-border flex items-center justify-center">
                {formatTime(hour)}
              </div>
              {DAYS_OF_WEEK.map((day, dayIndex) => {
                const date = addDays(weekStart, dayIndex);
                const dateStr = formatDate(date);
                const isToday = isSameDay(date, currentDate);
                const isCurrentHour = hour === new Date().getHours() && isToday;
                const { events: dayEvents, tasks: dayTasks, notes: dayNotes } = getItemsForTimeBlock(dateStr, hour);
                const hasContent = dayEvents.length > 0 || dayTasks.length > 0 || dayNotes.length > 0;
                const isExpanded = expandedBlock?.date === dateStr && expandedBlock?.hour === hour;
                
                return (
                  <div 
                    key={`${dateStr}-${hour}`}
                    className={`border-r border-border/50 dark:border-border/50 last:border-r-0 p-1 ${
                      isCurrentHour ? "bg-primary/5 dark:bg-primary/10" : ""
                    } ${hasContent ? "bg-accent/20 dark:bg-accent/10" : ""}`}
                    data-testid={`time-cell-${dateStr}-${hour}`}
                  >
                    <TimeBlockDetails
                      date={dateStr}
                      hour={hour}
                      events={dayEvents}
                      tasks={dayTasks}
                      notes={dayNotes}
                      isExpanded={isExpanded}
                      onToggle={() => onToggleExpanded(dateStr, hour)}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }
  
  // Condensed view for non-current weeks
  return (
    <Card className="w-full bg-muted/50 dark:bg-muted/30" data-testid="condensed-week">
      <CardContent className="p-2">
        <h3 className="text-xs font-medium text-center text-muted-foreground dark:text-muted-foreground mb-2">
          {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
        </h3>
        <div className="grid grid-cols-7 gap-1">
          {DAYS_OF_WEEK.map((day, index) => {
            const date = addDays(weekStart, index);
            const dateStr = formatDate(date);
            const dayEvents = events.filter(event => event.date === dateStr);
            const dayTasks = tasks.filter(task => task.scheduledDate === dateStr);
            const dayNotes = notes.filter(note => note.date === dateStr);
            const hasContent = dayEvents.length > 0 || dayTasks.length > 0 || dayNotes.length > 0;
            
            return (
              <div 
                key={day}
                className={`p-1 min-h-8 text-xs rounded border border-border/20 dark:border-border/20 ${
                  hasContent ? "bg-primary/20 dark:bg-primary/10" : "bg-background/50 dark:bg-background/30"
                }`}
                data-testid={`condensed-day-${day.toLowerCase()}`}
              >
                <div className="text-center font-medium text-muted-foreground dark:text-muted-foreground">
                  {format(date, "d")}
                </div>
                {hasContent && (
                  <div className="text-center mt-1">
                    <div className="w-2 h-2 bg-primary dark:bg-primary rounded-full mx-auto" />
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
}

function DraggableTask({ task, bgColor, borderColor }: DraggableTaskProps) {
  const [{ isDragging }, drag] = useDrag({
    type: ItemTypes.TASK,
    item: { id: task.id, task },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  return (
    <div
      ref={drag}
      className={`p-2 rounded border cursor-move transition-opacity ${bgColor} ${borderColor} ${
        isDragging ? "opacity-50" : ""
      }`}
      data-testid={`draggable-task-${task.id}`}
    >
      <div className="flex items-center gap-2">
        <Move className="h-3 w-3 text-muted-foreground" />
        <div className="flex-1">
          <div className="font-medium text-sm text-foreground dark:text-foreground">{task.title}</div>
          {task.description && (
            <div className="text-xs text-muted-foreground dark:text-muted-foreground mt-1">{task.description}</div>
          )}
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              task.priority === "high" ? "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200" :
              task.priority === "medium" ? "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200" :
              "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
            }`}>
              {task.priority}
            </span>
          </div>
        </div>
      </div>
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
  const [isExpanded, setIsExpanded] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const { toast } = useToast();
  
  const queryClient = useQueryClient();

  // Form for creating new tasks
  const addTaskForm = useForm<z.infer<typeof insertTaskSchema>>({
    resolver: zodResolver(insertTaskSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
      status: status,
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

  const handleAddTask = (values: z.infer<typeof insertTaskSchema>) => {
    sidebarCreateTaskMutation.mutate(values);
  };

  return (
    <div className="mb-6" data-testid={`task-section-${status}`}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-2 hover:bg-muted/50 dark:hover:bg-muted/30 rounded cursor-pointer" data-testid={`section-header-${status}`}>
            <div className="flex items-center gap-2">
              {icon}
              <h3 className="font-medium text-foreground dark:text-foreground">{title}</h3>
              <span className="text-xs text-muted-foreground dark:text-muted-foreground bg-muted dark:bg-muted px-2 py-1 rounded-full">
                {tasks.length}
              </span>
            </div>
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="mt-2">
          <div className="space-y-2">
            {tasks.map(task => (
              <DraggableTask 
                key={task.id}
                task={task}
                bgColor={bgColor}
                borderColor={borderColor}
              />
            ))}
            
            {tasks.length === 0 && !showAddForm && (
              <div className="text-xs text-muted-foreground dark:text-muted-foreground italic p-2">
                No {title.toLowerCase()} tasks
              </div>
            )}
            
            {/* Add Task Button */}
            <div className="pt-2">
              {!showAddForm ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowAddForm(true)}
                  data-testid={`button-add-${status}-task`}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add {title} Task
                </Button>
              ) : (
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
                              <Input placeholder="Task title..." {...field} data-testid={`input-${status}-task-title`} />
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
                              <Textarea placeholder="Description (optional)..." rows={2} {...field} value={field.value || ""} data-testid={`input-${status}-task-description`} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={addTaskForm.control}
                        name="priority"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Priority</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid={`select-${status}-task-priority`}>
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
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          type="submit"
                          disabled={sidebarCreateTaskMutation.isPending || !addTaskForm.formState.isValid}
                          data-testid={`save-${status}-task`}
                        >
                          <Save className="h-3 w-3 mr-1" />
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowAddForm(false)}
                          data-testid={`cancel-${status}-task`}
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
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function TaskSidebar() {
  const { toast } = useToast();

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
      <div className="w-80 bg-background dark:bg-background border-l border-border dark:border-border p-4">
        <div className="text-center text-muted-foreground">Loading tasks...</div>
      </div>
    );
  }

  return (
    <div className="w-80 bg-background dark:bg-background border-l border-border dark:border-border p-4" data-testid="task-sidebar">
      <div className="flex items-center gap-2 mb-4">
        <List className="h-5 w-5" />
        <h2 className="text-lg font-semibold text-foreground dark:text-foreground">Tasks</h2>
      </div>

      {/* To-Do Section */}
      <TaskSidebarSection 
        title="To-Do"
        status="todo"
        tasks={todoTasks}
        icon={<CheckSquare className="h-4 w-4 text-red-600 dark:text-red-400" />}
        bgColor="bg-red-50 dark:bg-red-950/30"
        borderColor="border-red-200 dark:border-red-800"
      />

      {/* Upcoming Section */}
      <TaskSidebarSection 
        title="Upcoming"
        status="upcoming"
        tasks={upcomingTasks}
        icon={<CalendarIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
        bgColor="bg-blue-50 dark:bg-blue-950/30"
        borderColor="border-blue-200 dark:border-blue-800"
      />

      {/* Later Section */}
      <TaskSidebarSection 
        title="Later"
        status="later"
        tasks={laterTasks}
        icon={<Clock className="h-4 w-4 text-gray-600 dark:text-gray-400" />}
        bgColor="bg-gray-50 dark:bg-gray-950/30"
        borderColor="border-gray-200 dark:border-gray-800"
      />
    </div>
  );
}

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTimeBlock, setSelectedTimeBlock] = useState<{date: string, hour: number} | null>(null);
  const [expandedBlock, setExpandedBlock] = useState<{date: string, hour: number} | null>(null);

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
    setSelectedTimeBlock({ date, hour });
  };

  const handleToggleExpanded = (date: string, hour: number) => {
    if (expandedBlock && expandedBlock.date === date && expandedBlock.hour === hour) {
      setExpandedBlock(null);
    } else {
      setExpandedBlock({ date, hour });
    }
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="min-h-screen bg-background dark:bg-background p-4" data-testid="calendar-page">
        <div className="max-w-full mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-foreground dark:text-foreground" data-testid="page-title">
                Time Block Calendar
              </h1>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={goToToday}
                data-testid="button-today"
              >
                Today
              </Button>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateWeek("prev")}
                data-testid="button-prev-week"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous Week
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateWeek("next")}
                data-testid="button-next-week"
              >
                Next Week
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex gap-6">
            {/* Main Calendar Area */}
            <div className="flex-1 space-y-4">
              {/* Previous Week */}
              <WeekView 
                weekStart={previousWeekStart}
                currentDate={currentDate}
                isCurrentWeek={false}
                onTimeBlockClick={handleTimeBlockClick}
                expandedBlock={expandedBlock}
                onToggleExpanded={handleToggleExpanded}
              />
              
              {/* Current Week */}
              <WeekView 
                weekStart={currentWeekStart}
                currentDate={currentDate}
                isCurrentWeek={true}
                onTimeBlockClick={handleTimeBlockClick}
                expandedBlock={expandedBlock}
                onToggleExpanded={handleToggleExpanded}
              />
              
              {/* Next Week */}
              <WeekView 
                weekStart={nextWeekStart}
                currentDate={currentDate}
                isCurrentWeek={false}
                onTimeBlockClick={handleTimeBlockClick}
                expandedBlock={expandedBlock}
                onToggleExpanded={handleToggleExpanded}
              />

              {/* Selected time block info */}
              {selectedTimeBlock && (
                <div className="mt-4 p-4 bg-accent/20 dark:bg-accent/10 rounded-lg" data-testid="selected-time-block">
                  <p className="text-sm text-muted-foreground dark:text-muted-foreground">
                    Selected: {format(parseISO(selectedTimeBlock.date), "EEEE, MMM d, yyyy")} at {formatTime(selectedTimeBlock.hour)}
                  </p>
                </div>
              )}
            </div>

            {/* Task Sidebar */}
            <TaskSidebar />
          </div>
        </div>
      </div>
    </DndProvider>
  );
}