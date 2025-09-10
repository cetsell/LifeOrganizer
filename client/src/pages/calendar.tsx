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
const formatTime = (hour: number) => {
  const date = new Date().setHours(hour, 0, 0, 0);
  return format(date, "h:mm a");
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS_OF_WEEK = ["MON", "TUES", "WEDS", "THURS", "FRI", "SAT", "SUN"];

// Drag and drop item types
const ItemTypes = {
  TASK: 'task',
};

// Component for rendering events that span multiple hours
interface SpanningEventProps {
  event: CalendarEvent;
  isCurrentHour?: boolean;
}

function SpanningEvent({ event, isCurrentHour }: SpanningEventProps) {
  const duration = event.duration || 1;
  const startHour = event.hour;
  
  return (
    <div 
      className="mx-1 px-2 py-1 rounded text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-700 z-10 flex flex-col justify-start"
      style={{
        gridRow: `${startHour + 1} / span ${duration}`,
        gridColumn: 1,
      }}
      data-testid={`spanning-event-${event.id}`}
    >
      <div className="font-medium truncate">{event.title}</div>
      {duration > 1 && (
        <div className="text-xs opacity-75">{duration}h</div>
      )}
    </div>
  );
}

interface TaskBlockProps {
  task: Task;
}

function TaskBlock({ task }: TaskBlockProps) {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border-red-200 dark:border-red-700";
      case "medium":
        return "bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-700";
      case "low":
        return "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700";
      default:
        return "bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700";
    }
  };

  return (
    <div 
      className={`px-2 py-1 mb-1 rounded text-xs border ${getPriorityColor(task.priority)}`}
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
  isCurrentHour?: boolean;
  isExpanded?: boolean;
  onTimeSlotClick?: (date: string, hour: number) => void;
}

function TimeSlot({ date, hour, tasks, notes, isCurrentHour, isExpanded, onTimeSlotClick }: TimeSlotProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Forms for adding content
  const noteForm = useForm<z.infer<typeof insertTimeBlockNoteSchema>>({
    resolver: zodResolver(insertTimeBlockNoteSchema),
    defaultValues: {
      date,
      hour,
      content: "",
    },
  });
  
  const taskForm = useForm<z.infer<typeof insertTaskSchema>>({
    resolver: zodResolver(insertTaskSchema),
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
  
  // Mutations for creating content
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
      noteForm.reset({ date, hour, content: "" });
      toast({ title: "Success", description: "Note created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });
  
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
      taskForm.reset({ 
        title: "", description: "", priority: "medium", status: "todo",
        scheduledDate: date, scheduledHour: hour, completed: false 
      });
      toast({ title: "Success", description: "Task created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
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
      eventForm.reset({ title: "", description: "", date, hour, duration: 1 });
      toast({ title: "Success", description: "Event created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });
  
  const handleCreateNote = (values: z.infer<typeof insertTimeBlockNoteSchema>) => {
    createNoteMutation.mutate(values);
  };
  
  const handleCreateTask = (values: z.infer<typeof insertTaskSchema>) => {
    createTaskMutation.mutate(values);
  };
  
  const handleCreateEvent = (values: z.infer<typeof insertCalendarEventSchema>) => {
    createEventMutation.mutate(values);
  };
  
  const handleTimeSlotClick = (e: React.MouseEvent) => {
    // Prevent click when dragging
    if (e.defaultPrevented) return;
    e.stopPropagation();
    onTimeSlotClick?.(date, hour);
  };

  return (
    <>
      <div 
        ref={drop}
        className={`h-full w-full p-1 transition-colors cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
          isCurrentHour ? "bg-blue-50 dark:bg-blue-950/20" : ""
        } ${
          isOver ? "bg-primary/10 dark:bg-primary/5" : ""
        } ${
          isExpanded ? "bg-primary/20 dark:bg-primary/10 border-l-2 border-primary" : ""
        }`}
        data-testid={`time-slot-${date}-${hour}`}
        onClick={handleTimeSlotClick}
      >
        {/* Display tasks as colored blocks */}
        {tasks.map(task => (
          <TaskBlock key={task.id} task={task} />
        ))}
        
        {/* Display notes */}
        {notes.map(note => (
          <div 
            key={note.id} 
            className="px-2 py-1 mb-1 rounded text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 border border-purple-200 dark:border-purple-700"
            data-testid={`note-block-${note.id}`}
          >
            <div className="text-xs opacity-75">Note: {note.content.substring(0, 20)}{note.content.length > 20 ? '...' : ''}</div>
          </div>
        ))}
        
        {/* Click indicator when empty */}
        {tasks.length === 0 && notes.length === 0 && (
          <div className="flex items-center justify-center h-full opacity-0 hover:opacity-50 transition-opacity">
            <Plus className="h-3 w-3 text-gray-400" />
          </div>
        )}
      </div>
      
      {/* Expandable Forms Section */}
      {isExpanded && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => onTimeSlotClick?.(date, hour)}>
            <div 
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-4 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto" 
              onClick={(e) => e.stopPropagation()}
              data-testid={`expanded-forms-${date}-${hour}`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-900 dark:text-gray-100">
                  {formatTime(hour)} on {format(new Date(date), "MMM d, yyyy")}
                </h3>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onTimeSlotClick?.(date, hour)}
                  data-testid="button-close-expanded"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="space-y-6">
                {/* Note Form */}
                <div className="space-y-3">
                  <h4 className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    <FileText className="h-4 w-4" />
                    Add Note
                  </h4>
                  <Form {...noteForm}>
                    <form onSubmit={noteForm.handleSubmit(handleCreateNote)} className="space-y-3">
                      <FormField
                        control={noteForm.control}
                        name="content"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Textarea placeholder="Add a note for this time slot..." rows={2} {...field} data-testid="input-note-content" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button
                        size="sm"
                        type="submit"
                        disabled={createNoteMutation.isPending || !noteForm.formState.isValid}
                        data-testid="button-create-note"
                      >
                        <Save className="h-3 w-3 mr-1" />
                        {createNoteMutation.isPending ? 'Saving...' : 'Add Note'}
                      </Button>
                    </form>
                  </Form>
                </div>
                
                {/* Task Form */}
                <div className="space-y-3">
                  <h4 className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    <CheckSquare className="h-4 w-4" />
                    Add Task
                  </h4>
                  <Form {...taskForm}>
                    <form onSubmit={taskForm.handleSubmit(handleCreateTask)} className="space-y-3">
                      <FormField
                        control={taskForm.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input placeholder="Task title..." {...field} data-testid="input-task-title-expanded" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={taskForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Textarea placeholder="Description (optional)..." rows={2} {...field} value={field.value || ""} data-testid="input-task-description-expanded" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={taskForm.control}
                        name="priority"
                        render={({ field }) => (
                          <FormItem>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-task-priority-expanded">
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
                      <Button
                        size="sm"
                        type="submit"
                        disabled={createTaskMutation.isPending || !taskForm.formState.isValid}
                        data-testid="button-create-task"
                      >
                        <Save className="h-3 w-3 mr-1" />
                        {createTaskMutation.isPending ? 'Creating...' : 'Add Task'}
                      </Button>
                    </form>
                  </Form>
                </div>
                
                {/* Event Form */}
                <div className="space-y-3">
                  <h4 className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    <CalendarIcon className="h-4 w-4" />
                    Add Event
                  </h4>
                  <Form {...eventForm}>
                    <form onSubmit={eventForm.handleSubmit(handleCreateEvent)} className="space-y-3">
                      <FormField
                        control={eventForm.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input placeholder="Event title..." {...field} data-testid="input-event-title" />
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
                            <FormControl>
                              <Textarea placeholder="Description (optional)..." rows={2} {...field} value={field.value || ""} data-testid="input-event-description" />
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
                      <Button
                        size="sm"
                        type="submit"
                        disabled={createEventMutation.isPending || !eventForm.formState.isValid}
                        data-testid="button-create-event"
                      >
                        <Save className="h-3 w-3 mr-1" />
                        {createEventMutation.isPending ? 'Creating...' : 'Add Event'}
                      </Button>
                    </form>
                  </Form>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
}

interface WeekViewProps {
  weekStart: Date;
  currentDate: Date;
  isCurrentWeek: boolean;
  onTimeBlockClick?: (date: string, hour: number) => void;
  expandedTimeSlot?: { date: string; hour: number } | null;
}

function WeekView({ weekStart, currentDate, isCurrentWeek, onTimeBlockClick, expandedTimeSlot }: WeekViewProps) {
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
    const dayTasks = tasks.filter(task => task.scheduledDate === date && task.scheduledHour === hour);
    const dayNotes = notes.filter(note => note.date === date && note.hour === hour);
    return { tasks: dayTasks, notes: dayNotes };
  };

  const getEventsForDay = (date: string) => {
    return events.filter(event => event.date === date);
  };

  if (isCurrentWeek) {
    return (
      <Card className="w-full bg-white dark:bg-gray-900 shadow-sm border border-gray-200 dark:border-gray-700" data-testid="current-week">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-center text-gray-900 dark:text-gray-100">
            {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Header with days */}
          <div className="grid grid-cols-8 border-b border-gray-200 dark:border-gray-700">
            <div className="p-3 text-sm font-medium text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              Time
            </div>
            {DAYS_OF_WEEK.map((day, index) => {
              const date = addDays(weekStart, index);
              const isToday = isSameDay(date, currentDate);
              return (
                <div 
                  key={day}
                  className={`p-3 text-sm font-medium text-center border-r border-gray-200 dark:border-gray-700 last:border-r-0 bg-gray-50 dark:bg-gray-800 ${
                    isToday ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" : "text-gray-600 dark:text-gray-300"
                  }`}
                  data-testid={`day-header-${day.toLowerCase()}`}
                >
                  {day} {format(date, "M/d")}
                </div>
              );
            })}
          </div>
          
          {/* Calendar Grid */}
          <div className="grid grid-cols-8">
            {/* Time column */}
            <div className="border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
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
            {DAYS_OF_WEEK.map((day, dayIndex) => {
              const date = addDays(weekStart, dayIndex);
              const dateStr = formatDate(date);
              const isToday = isSameDay(date, currentDate);
              const dayEvents = getEventsForDay(dateStr);
              
              return (
                <div 
                  key={`${dateStr}`}
                  className="relative border-r border-gray-100 dark:border-gray-800 last:border-r-0"
                  style={{
                    display: 'grid',
                    gridTemplateRows: 'repeat(24, 3rem)',
                    gridTemplateColumns: '1fr'
                  }}
                  data-testid={`day-column-${dateStr}`}
                >
                  {/* Render spanning events */}
                  {dayEvents.map(event => (
                    <SpanningEvent key={event.id} event={event} />
                  ))}
                  
                  {/* Render time slots for tasks and notes */}
                  {HOURS.map(hour => {
                    const isCurrentHour = hour === new Date().getHours() && isToday;
                    const { tasks: dayTasks, notes: dayNotes } = getItemsForTimeBlock(dateStr, hour);
                    
                    return (
                      <div 
                        key={`${dateStr}-${hour}`}
                        className={`border-b border-gray-100 dark:border-gray-800 ${
                          isCurrentHour ? "bg-blue-50 dark:bg-blue-950/20" : ""
                        }`}
                        style={{ gridRow: hour + 1 }}
                        data-testid={`time-cell-${dateStr}-${hour}`}
                      >
                        <TimeSlot
                          date={dateStr}
                          hour={hour}
                          tasks={dayTasks}
                          notes={dayNotes}
                          isCurrentHour={isCurrentHour}
                          isExpanded={expandedTimeSlot?.date === dateStr && expandedTimeSlot?.hour === hour}
                          onTimeSlotClick={onTimeBlockClick}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // Condensed view for non-current weeks
  return (
    <Card className="w-full bg-gray-50 dark:bg-gray-800/30 shadow-sm" data-testid="condensed-week">
      <CardContent className="p-3">
        <h3 className="text-sm font-medium text-center text-gray-600 dark:text-gray-400 mb-3">
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
                className={`p-2 min-h-10 text-xs rounded border ${
                  hasContent 
                    ? "bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700" 
                    : "bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600"
                }`}
                data-testid={`condensed-day-${day.toLowerCase()}`}
              >
                <div className="text-center font-medium text-gray-700 dark:text-gray-300">
                  {format(date, "d")}
                </div>
                {hasContent && (
                  <div className="text-center mt-1">
                    <div className="w-1.5 h-1.5 bg-blue-500 dark:bg-blue-400 rounded-full mx-auto" />
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

  const getPriorityDotColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-500";
      case "medium":
        return "bg-orange-500";
      case "low":
        return "bg-green-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div
      ref={drag}
      className={`p-2 rounded cursor-move transition-opacity hover:bg-gray-50 dark:hover:bg-gray-800 ${
        isDragging ? "opacity-50" : ""
      }`}
      data-testid={`draggable-task-${task.id}`}
    >
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${getPriorityDotColor(task.priority)}`} />
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
              <h3 className="font-medium text-gray-900 dark:text-gray-100">{title}</h3>
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
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function TaskSidebar() {
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
      <div className="w-80 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 p-4">
        <div className="text-center text-gray-500 dark:text-gray-400">Loading tasks...</div>
      </div>
    );
  }

  return (
    <div className="w-80 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 p-4" data-testid="task-sidebar">
      {/* Date Header */}
      <div className="mb-6">
        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">{format(currentDate, "MMMM d, yyyy")}</h2>
      </div>

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
    </div>
  );
}

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [expandedTimeSlot, setExpandedTimeSlot] = useState<{ date: string; hour: number } | null>(null);

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

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4" data-testid="calendar-page">
        <div className="max-w-full mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100" data-testid="page-title">
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
                expandedTimeSlot={null}
              />
              
              {/* Current Week */}
              <WeekView 
                weekStart={currentWeekStart}
                currentDate={currentDate}
                isCurrentWeek={true}
                onTimeBlockClick={handleTimeBlockClick}
                expandedTimeSlot={expandedTimeSlot}
              />
              
              {/* Next Week */}
              <WeekView 
                weekStart={nextWeekStart}
                currentDate={currentDate}
                isCurrentWeek={false}
                expandedTimeSlot={null}
              />
            </div>

            {/* Task Sidebar */}
            <TaskSidebar />
          </div>
        </div>
      </div>
    </DndProvider>
  );
}