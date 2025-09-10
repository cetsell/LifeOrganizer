import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfWeek, addWeeks, addDays, isSameDay, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Plus, Clock, CheckSquare, FileText } from "lucide-react";
import { Task, CalendarEvent, TimeBlockNote } from "@shared/schema";

// Utility functions for date handling
const getWeekStart = (date: Date) => startOfWeek(date, { weekStartsOn: 1 }); // Monday start
const formatDate = (date: Date) => format(date, "yyyy-MM-dd");
const formatTime = (hour: number) => format(new Date().setHours(hour, 0, 0, 0), "HH:mm");

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function TimeBlockDetails({ date, hour, events, tasks, notes, isExpanded, onToggle }: TimeBlockDetailsProps) {
  const dateObj = parseISO(date);
  const hourString = formatTime(hour);
  
  return (
    <Collapsible open={isExpanded} onOpenChange={() => onToggle()}>
      <CollapsibleTrigger asChild>
        <div className="w-full text-left focus:outline-none focus:ring-2 focus:ring-primary/50 rounded">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground dark:text-muted-foreground">
              {format(dateObj, "EEE")} {hourString}
            </span>
            {(events.length > 0 || tasks.length > 0 || notes.length > 0) && (
              isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
            )}
          </div>
        </div>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="mt-2" data-testid={`expanded-timeblock-${date}-${hour}`}>
        <div className="space-y-3 p-3 bg-background dark:bg-background border border-border dark:border-border rounded-md shadow-sm">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm text-foreground dark:text-foreground">
              {format(dateObj, "EEEE, MMM d, yyyy")} at {hourString}
            </h4>
            <Button size="sm" variant="outline" data-testid="button-add-content">
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          </div>

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
                    <div className="font-medium text-blue-900 dark:text-blue-100">{event.title}</div>
                    {event.description && (
                      <div className="text-sm text-blue-700 dark:text-blue-200 mt-1">{event.description}</div>
                    )}
                    {event.duration && event.duration > 1 && (
                      <div className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                        Duration: {event.duration} hour{event.duration > 1 ? "s" : ""}
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
                    <div className={`font-medium ${
                      task.completed ? 
                        "text-green-900 dark:text-green-100 line-through" : 
                        "text-orange-900 dark:text-orange-100"
                    }`}>
                      {task.title}
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
                    <div className="text-sm text-purple-900 dark:text-purple-100 whitespace-pre-wrap">
                      {note.content}
                    </div>
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
                      {hasContent ? (
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
                      ) : (
                        <div 
                          className="p-1 min-h-12 cursor-pointer hover:bg-accent/30 dark:hover:bg-accent/30"
                          onClick={() => onTimeBlockClick(date, hour)}
                        >
                          {/* Empty time block */}
                        </div>
                      )}
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