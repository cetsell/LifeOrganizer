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
  events: CalendarEvent[];
  notes: TimeBlockNote[];
  isCurrentHour?: boolean;
}

function TimeSlot({ date, hour, tasks, events, notes, isCurrentHour }: TimeSlotProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
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

  return (
    <div 
      ref={drop}
      className={`h-full w-full p-1 transition-colors ${
        isCurrentHour ? "bg-blue-50 dark:bg-blue-950/20" : ""
      } ${
        isOver ? "bg-primary/10 dark:bg-primary/5" : ""
      }`}
      data-testid={`time-slot-${date}-${hour}`}
    >
      {/* Display tasks as colored blocks */}
      {tasks.map(task => (
        <TaskBlock key={task.id} task={task} />
      ))}
      
      {/* Display events */}
      {events.map(event => (
        <div 
          key={event.id} 
          className="px-2 py-1 mb-1 rounded text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-700"
          data-testid={`event-block-${event.id}`}
        >
          <div className="font-medium truncate">{event.title}</div>
          {event.duration > 1 && (
            <div className="text-xs opacity-75">{event.duration}h</div>
          )}
        </div>
      ))}
      
      {/* Display notes */}
      {notes.map(note => (
        <div 
          key={note.id} 
          className="px-2 py-1 mb-1 rounded text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 border border-purple-200 dark:border-purple-700"
          data-testid={`note-block-${note.id}`}
        >
          <div className="text-xs opacity-75">Note</div>
        </div>
      ))}
    </div>
  );
}

interface WeekViewProps {
  weekStart: Date;
  currentDate: Date;
  isCurrentWeek: boolean;
  onTimeBlockClick?: (date: string, hour: number) => void;
}

function WeekView({ weekStart, currentDate, isCurrentWeek, onTimeBlockClick }: WeekViewProps) {
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
      <Card className="w-full bg-white dark:bg-gray-900 shadow-md" data-testid="current-week">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-center text-gray-900 dark:text-gray-100">
            {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Header with days */}
          <div className="grid grid-cols-8 border-b border-gray-200 dark:border-gray-700">
            <div className="p-3 text-sm font-medium text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700">
              Time
            </div>
            {DAYS_OF_WEEK.map((day, index) => {
              const date = addDays(weekStart, index);
              const isToday = isSameDay(date, currentDate);
              return (
                <div 
                  key={day}
                  className={`p-3 text-sm font-medium text-center border-r border-gray-200 dark:border-gray-700 last:border-r-0 ${
                    isToday ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" : "text-gray-600 dark:text-gray-300"
                  }`}
                  data-testid={`day-header-${day.toLowerCase()}`}
                >
                  {day}<br />
                  <span className="text-xs font-normal">{format(date, "M/d")}</span>
                </div>
              );
            })}
          </div>
          
          {/* Hour rows */}
          {HOURS.map(hour => (
            <div key={hour} className="grid grid-cols-8 border-b border-gray-100 dark:border-gray-800 min-h-16">
              <div className="p-2 text-xs text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700 flex items-start justify-center pt-2">
                {formatTime(hour)}
              </div>
              {DAYS_OF_WEEK.map((day, dayIndex) => {
                const date = addDays(weekStart, dayIndex);
                const dateStr = formatDate(date);
                const isToday = isSameDay(date, currentDate);
                const isCurrentHour = hour === new Date().getHours() && isToday;
                const { events: dayEvents, tasks: dayTasks, notes: dayNotes } = getItemsForTimeBlock(dateStr, hour);
                
                return (
                  <div 
                    key={`${dateStr}-${hour}`}
                    className={`border-r border-gray-100 dark:border-gray-800 last:border-r-0 ${
                      isCurrentHour ? "bg-blue-50 dark:bg-blue-950/20" : ""
                    }`}
                    data-testid={`time-cell-${dateStr}-${hour}`}
                  >
                    <TimeSlot
                      date={dateStr}
                      hour={hour}
                      tasks={dayTasks}
                      events={dayEvents}
                      notes={dayNotes}
                      isCurrentHour={isCurrentHour}
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

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4" data-testid="calendar-page">
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
              />
              
              {/* Current Week */}
              <WeekView 
                weekStart={currentWeekStart}
                currentDate={currentDate}
                isCurrentWeek={true}
              />
              
              {/* Next Week */}
              <WeekView 
                weekStart={nextWeekStart}
                currentDate={currentDate}
                isCurrentWeek={false}
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