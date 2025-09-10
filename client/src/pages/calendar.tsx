import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfWeek, addWeeks, addDays, isSameDay, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Task, CalendarEvent, TimeBlockNote } from "@shared/schema";

// Utility functions for date handling
const getWeekStart = (date: Date) => startOfWeek(date, { weekStartsOn: 1 }); // Monday start
const formatDate = (date: Date) => format(date, "yyyy-MM-dd");
const formatTime = (hour: number) => format(new Date().setHours(hour, 0, 0, 0), "HH:mm");

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface WeekViewProps {
  weekStart: Date;
  currentDate: Date;
  isCurrentWeek: boolean;
  onTimeBlockClick: (date: string, hour: number) => void;
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
                  
                  return (
                    <div 
                      key={`${day}-${hour}`}
                      className={`p-1 min-h-12 border-r border-border/30 dark:border-border/30 last:border-r-0 cursor-pointer hover:bg-accent/30 dark:hover:bg-accent/30 ${
                        hasContent ? "bg-blue-50/50 dark:bg-blue-950/20" : ""
                      }`}
                      onClick={() => onTimeBlockClick(date, hour)}
                      data-testid={`time-block-${date}-${hour}`}
                    >
                      <div className="space-y-1">
                        {hourEvents.map(event => (
                          <div 
                            key={event.id} 
                            className="text-xs p-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded truncate"
                            data-testid={`event-${event.id}`}
                          >
                            {event.title}
                          </div>
                        ))}
                        {hourTasks.map(task => (
                          <div 
                            key={task.id} 
                            className="text-xs p-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded truncate"
                            data-testid={`task-${task.id}`}
                          >
                            {task.title}
                          </div>
                        ))}
                        {hourNotes.length > 0 && (
                          <div className="text-xs p-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded truncate" data-testid={`notes-indicator`}>
                            📝 {hourNotes.length} note{hourNotes.length > 1 ? "s" : ""}
                          </div>
                        )}
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
          />
          
          {/* Current Week */}
          <WeekView 
            weekStart={currentWeekStart}
            currentDate={currentDate}
            isCurrentWeek={true}
            onTimeBlockClick={handleTimeBlockClick}
          />
          
          {/* Next Week */}
          <WeekView 
            weekStart={nextWeekStart}
            currentDate={currentDate}
            isCurrentWeek={false}
            onTimeBlockClick={handleTimeBlockClick}
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