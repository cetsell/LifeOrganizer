import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfWeek, addWeeks, addDays, isSameDay, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Plus, Clock, CheckSquare, FileText, Edit2, Save, X, Trash2 } from "lucide-react";
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

function TimeBlockDetails({ date, hour, events, tasks, notes, isExpanded, onToggle }: TimeBlockDetailsProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [addType, setAddType] = useState<"task" | "note" | "event">("task");
  const [editingItem, setEditingItem] = useState<{type: "task" | "note" | "event", id: string} | null>(null);
  const { toast } = useToast();
  
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

  // Form instances for editing items
  const editTaskForm = useForm<z.infer<typeof editTaskFormSchema>>({
    resolver: zodResolver(editTaskFormSchema),
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

  const editNoteForm = useForm<z.infer<typeof editNoteFormSchema>>({
    resolver: zodResolver(editNoteFormSchema),
    defaultValues: {
      date,
      hour,
      content: "",
    },
  });

  const editEventForm = useForm<z.infer<typeof editEventFormSchema>>({
    resolver: zodResolver(editEventFormSchema),
    defaultValues: {
      title: "",
      description: "",
      date,
      hour,
      duration: 1,
    },
  });
  
  const queryClient = useQueryClient();
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

  // Edit/Update mutations
  const updateTaskMutation = useMutation({
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
      setEditingItem(null);
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

  const updateNoteMutation = useMutation({
    mutationFn: async ({ id, ...updateData }: { id: string } & any) => {
      const response = await apiRequest("PUT", `/api/time-block-notes/${id}`, updateData);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update note");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-block-notes"] });
      setEditingItem(null);
      toast({
        title: "Success",
        description: "Note updated successfully",
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

  const updateEventMutation = useMutation({
    mutationFn: async ({ id, ...updateData }: { id: string } & any) => {
      const response = await apiRequest("PUT", `/api/calendar-events/${id}`, updateData);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update event");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar-events"] });
      setEditingItem(null);
      toast({
        title: "Success",
        description: "Event updated successfully",
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

  // Delete mutations
  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/tasks/${id}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete task");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({
        title: "Success",
        description: "Task deleted successfully",
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

  const deleteNoteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/time-block-notes/${id}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete note");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-block-notes"] });
      toast({
        title: "Success",
        description: "Note deleted successfully",
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

  const deleteEventMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/calendar-events/${id}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete event");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar-events"] });
      toast({
        title: "Success",
        description: "Event deleted successfully",
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

  const handleEditTask = (values: z.infer<typeof editTaskFormSchema>) => {
    updateTaskMutation.mutate(values);
  };

  const handleEditNote = (values: z.infer<typeof editNoteFormSchema>) => {
    updateNoteMutation.mutate(values);
  };

  const handleEditEvent = (values: z.infer<typeof editEventFormSchema>) => {
    updateEventMutation.mutate(values);
  };
  
  return (
    <Collapsible open={isExpanded} onOpenChange={() => onToggle()}>
      <CollapsibleTrigger asChild>
        <div className="w-full text-left focus:outline-none focus:ring-2 focus:ring-primary/50 rounded" data-testid={`trigger-timeblock-${date}-${hour}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground dark:text-muted-foreground">
              {format(dateObj, "EEE")} {hourString}
            </span>
            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </div>
        </div>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="mt-2" data-testid={`expanded-timeblock-${date}-${hour}`}>
        <div className="space-y-3 p-3 bg-background dark:bg-background border border-border dark:border-border rounded-md shadow-sm">
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

          {/* Calendar Events Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <h5 className="text-sm font-medium text-foreground dark:text-foreground">Events</h5>
            </div>
            {events.length > 0 ? (
              <div className="space-y-2">
                {events.map(event => (
                  <div 
                    key={event.id}
                    className="p-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded"
                    data-testid={`expanded-event-${event.id}`}
                  >
                    {editingItem?.type === "event" && editingItem?.id === event.id ? (
                      <Form {...editEventForm}>
                        <form id={`edit-event-form-${event.id}`} onSubmit={editEventForm.handleSubmit(handleEditEvent)} className="space-y-4">
                          <FormField
                            control={editEventForm.control}
                            name="title"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Event Title</FormLabel>
                                <FormControl>
                                  <Input placeholder="Event title..." {...field} data-testid={`edit-event-title-${event.id}`} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={editEventForm.control}
                            name="description"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Description (optional)</FormLabel>
                                <FormControl>
                                  <Textarea placeholder="Description (optional)..." rows={2} {...field} value={field.value || ""} data-testid={`edit-event-description-${event.id}`} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={editEventForm.control}
                            name="duration"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Duration</FormLabel>
                                <Select onValueChange={(value) => field.onChange(parseInt(value))} defaultValue={field.value?.toString()}>
                                  <FormControl>
                                    <SelectTrigger className="w-32" data-testid={`edit-event-duration-${event.id}`}>
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
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              type="submit"
                              disabled={updateEventMutation.isPending || !editEventForm.formState.isValid}
                              data-testid={`save-event-${event.id}`}
                            >
                              <Save className="h-3 w-3 mr-1" />
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingItem(null)}
                              data-testid={`cancel-edit-event-${event.id}`}
                            >
                              <X className="h-3 w-3 mr-1" />
                              Cancel
                            </Button>
                          </div>
                        </form>
                      </Form>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-blue-900 dark:text-blue-100">{event.title}</div>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingItem({type: "event", id: event.id});
                                editEventForm.reset({
                                  id: event.id,
                                  title: event.title,
                                  description: event.description || "",
                                  date: date,
                                  hour: hour,
                                  duration: event.duration || 1
                                });
                              }}
                              data-testid={`edit-event-${event.id}`}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteEventMutation.mutate(event.id)}
                              disabled={deleteEventMutation.isPending}
                              data-testid={`delete-event-${event.id}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        {event.description && (
                          <div className="text-sm text-blue-700 dark:text-blue-200 mt-1">{event.description}</div>
                        )}
                        {event.duration && event.duration > 1 && (
                          <div className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                            Duration: {event.duration} hour{event.duration > 1 ? "s" : ""}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground dark:text-muted-foreground italic">No events scheduled</div>
            )}
          </div>

          {/* Tasks Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-green-600 dark:text-green-400" />
              <h5 className="text-sm font-medium text-foreground dark:text-foreground">Tasks</h5>
            </div>
            {tasks.length > 0 ? (
              <div className="space-y-2">
                {tasks.map(task => (
                  <div 
                    key={task.id}
                    className={`p-2 border rounded ${
                      task.completed ? 
                        "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800" : 
                        "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800"
                    }`}
                    data-testid={`expanded-task-${task.id}`}
                  >
                    {editingItem?.type === "task" && editingItem?.id === task.id ? (
                      <Form {...editTaskForm}>
                        <form id={`edit-task-form-${task.id}`} onSubmit={editTaskForm.handleSubmit(handleEditTask)} className="space-y-4">
                          <FormField
                            control={editTaskForm.control}
                            name="title"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Task Title</FormLabel>
                                <FormControl>
                                  <Input placeholder="Task title..." {...field} data-testid={`edit-task-title-${task.id}`} />
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
                                  <Textarea placeholder="Description (optional)..." rows={2} {...field} value={field.value || ""} data-testid={`edit-task-description-${task.id}`} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={editTaskForm.control}
                            name="priority"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Priority</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid={`edit-task-priority-${task.id}`}>
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
                            control={editTaskForm.control}
                            name="completed"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    data-testid={`edit-task-completed-${task.id}`}
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel>Completed</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              type="submit"
                              disabled={updateTaskMutation.isPending || !editTaskForm.formState.isValid}
                              data-testid={`save-task-${task.id}`}
                            >
                              <Save className="h-3 w-3 mr-1" />
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingItem(null)}
                              data-testid={`cancel-edit-task-${task.id}`}
                            >
                              <X className="h-3 w-3 mr-1" />
                              Cancel
                            </Button>
                          </div>
                        </form>
                      </Form>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between">
                          <div className={`font-medium ${
                            task.completed ? 
                              "text-green-900 dark:text-green-100 line-through" : 
                              "text-orange-900 dark:text-orange-100"
                          }`}>
                            {task.title}
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingItem({type: "task", id: task.id});
                                editTaskForm.reset({
                                  id: task.id,
                                  title: task.title,
                                  description: task.description || "",
                                  priority: task.priority as "low" | "medium" | "high",
                                  status: task.status as "todo" | "upcoming" | "later",
                                  scheduledDate: date,
                                  scheduledHour: hour,
                                  completed: task.completed === 1
                                });
                              }}
                              data-testid={`edit-task-${task.id}`}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteTaskMutation.mutate(task.id)}
                              disabled={deleteTaskMutation.isPending}
                              data-testid={`delete-task-${task.id}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        {task.description && (
                          <div className={`text-sm mt-1 ${
                            task.completed ? 
                              "text-green-700 dark:text-green-200" : 
                              "text-orange-700 dark:text-orange-200"
                          }`}>
                            {task.description}
                          </div>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          <span className={`text-xs px-2 py-1 rounded ${
                            task.priority === "high" ? "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200" :
                            task.priority === "medium" ? "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200" :
                            "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                          }`}>
                            {task.priority}
                          </span>
                          <span className={`text-xs ${
                            task.completed ? 
                              "text-green-600 dark:text-green-300" : 
                              "text-orange-600 dark:text-orange-300"
                          }`}>
                            {task.completed ? "Completed" : "Pending"}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground dark:text-muted-foreground italic">No tasks scheduled</div>
            )}
          </div>

          {/* Notes Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <h5 className="text-sm font-medium text-foreground dark:text-foreground">Notes</h5>
            </div>
            {notes.length > 0 ? (
              <div className="space-y-2">
                {notes.map(note => (
                  <div 
                    key={note.id}
                    className="p-2 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded"
                    data-testid={`expanded-note-${note.id}`}
                  >
                    {editingItem?.type === "note" && editingItem?.id === note.id ? (
                      <Form {...editNoteForm}>
                        <form id={`edit-note-form-${note.id}`} onSubmit={editNoteForm.handleSubmit(handleEditNote)} className="space-y-4">
                          <FormField
                            control={editNoteForm.control}
                            name="content"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Note Content</FormLabel>
                                <FormControl>
                                  <Textarea placeholder="Write your note..." rows={3} {...field} data-testid={`edit-note-content-${note.id}`} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              type="submit"
                              disabled={updateNoteMutation.isPending || !editNoteForm.formState.isValid}
                              data-testid={`save-note-${note.id}`}
                            >
                              <Save className="h-3 w-3 mr-1" />
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingItem(null)}
                              data-testid={`cancel-edit-note-${note.id}`}
                            >
                              <X className="h-3 w-3 mr-1" />
                              Cancel
                            </Button>
                          </div>
                        </form>
                      </Form>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-purple-900 dark:text-purple-100 whitespace-pre-wrap flex-1">
                            {note.content}
                          </div>
                          <div className="flex gap-1 ml-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingItem({type: "note", id: note.id});
                                editNoteForm.reset({
                                  id: note.id,
                                  date: date,
                                  hour: hour,
                                  content: note.content
                                });
                              }}
                              data-testid={`edit-note-${note.id}`}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteNoteMutation.mutate(note.id)}
                              disabled={deleteNoteMutation.isPending}
                              data-testid={`delete-note-${note.id}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground dark:text-muted-foreground italic">No notes for this time block</div>
            )}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
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

interface TimeBlockDetailsProps {
  date: string;
  hour: number;
  events: CalendarEvent[];
  tasks: Task[];
  notes: TimeBlockNote[];
  isExpanded: boolean;
  onToggle: () => void;
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
                    isToday ? "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary" : "text-muted-foreground dark:text-muted-foreground"
                  }`}
                  data-testid={`day-header-${day.toLowerCase()}`}
                >
                  <div>{day}</div>
                  <div className="font-normal">{format(date, "d")}</div>
                </div>
              );
            })}
          </div>
          
          <div className="max-h-96 overflow-y-auto">
            {HOURS.map(hour => (
              <div key={hour} className="grid grid-cols-8 border-b border-border/50 dark:border-border/50 hover:bg-muted/30 dark:hover:bg-muted/30">
                <div className="p-2 text-xs text-muted-foreground dark:text-muted-foreground border-r border-border dark:border-border font-mono">
                  {formatTime(hour)}
                </div>
                {DAYS_OF_WEEK.map((day, dayIndex) => {
                  const date = formatDate(addDays(weekStart, dayIndex));
                  const { events: hourEvents, tasks: hourTasks, notes: hourNotes } = getItemsForTimeBlock(date, hour);
                  const hasContent = hourEvents.length > 0 || hourTasks.length > 0 || hourNotes.length > 0;
                  const isExpanded = expandedBlock?.date === date && expandedBlock?.hour === hour;
                  
                  return (
                    <div 
                      key={`${day}-${hour}`}
                      className={`border-r border-border/30 dark:border-border/30 last:border-r-0 ${
                        hasContent ? "bg-blue-50/50 dark:bg-blue-950/20" : ""
                      } ${isExpanded ? "bg-accent/20 dark:bg-accent/10" : ""}`}
                      data-testid={`time-block-${date}-${hour}`}
                    >
                      <div className="p-1">
                        <TimeBlockDetails
                          date={date}
                          hour={hour}
                          events={hourEvents}
                          tasks={hourTasks}
                          notes={hourNotes}
                          isExpanded={isExpanded}
                          onToggle={() => onToggleExpanded(date, hour)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Condensed view for previous/next weeks
  return (
    <Card className="w-full bg-muted/20 dark:bg-muted/10" data-testid={`condensed-week`}>
      <CardHeader className="py-1 px-2">
        <CardTitle className="text-xs font-medium text-center text-muted-foreground dark:text-muted-foreground">
          {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d")}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-1">
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
    <div className="min-h-screen bg-background dark:bg-background p-4" data-testid="calendar-page">
      <div className="max-w-7xl mx-auto">
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

        <div className="grid grid-cols-1 gap-4">
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
        </div>

        {/* Selected time block info */}
        {selectedTimeBlock && (
          <div className="mt-4 p-4 bg-accent/20 dark:bg-accent/10 rounded-lg" data-testid="selected-time-block">
            <p className="text-sm text-muted-foreground dark:text-muted-foreground">
              Selected: {format(parseISO(selectedTimeBlock.date), "EEEE, MMM d, yyyy")} at {formatTime(selectedTimeBlock.hour)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}