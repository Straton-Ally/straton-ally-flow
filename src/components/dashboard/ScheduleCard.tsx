import { CalendarDays, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface ScheduleEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  type: 'meeting' | 'event';
  platform: string;
  attendees: string[];
}

interface ScheduleCardProps {
  events: ScheduleEvent[];
  totalCount: number;
}

export function ScheduleCard({ events, totalCount }: ScheduleCardProps) {
  return (
    <div className="card-elevated p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-sm">Schedule ({totalCount})</h3>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>

      <Tabs defaultValue="all" className="w-full flex-1 flex flex-col">
        <TabsList className="w-full h-8 mb-3 bg-muted/50 p-1">
          <TabsTrigger value="all" className="flex-1 text-xs h-6">All</TabsTrigger>
          <TabsTrigger value="meetings" className="flex-1 text-xs h-6">Meetings</TabsTrigger>
          <TabsTrigger value="events" className="flex-1 text-xs h-6">Events</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-1.5 mt-0 flex-1 overflow-auto">
          {events.map((event) => (
            <EventItem key={event.id} event={event} />
          ))}
        </TabsContent>
        
        <TabsContent value="meetings" className="space-y-1.5 mt-0 flex-1 overflow-auto">
          {events.filter(e => e.type === 'meeting').map((event) => (
            <EventItem key={event.id} event={event} />
          ))}
        </TabsContent>
        
        <TabsContent value="events" className="space-y-1.5 mt-0 flex-1 overflow-auto">
          {events.filter(e => e.type === 'event').map((event) => (
            <EventItem key={event.id} event={event} />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EventItem({ event }: { event: ScheduleEvent }) {
  return (
    <div className="surface-tile">
      <h4 className="font-medium text-xs line-clamp-1">{event.title}</h4>
      <p className="text-[11px] text-muted-foreground mt-1">
        {event.date} • {event.time}
      </p>
      
      <div className="flex items-center justify-between mt-1.5">
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-muted-foreground">{event.platform}</span>
          <ArrowRight className="h-2 w-2 text-muted-foreground" />
        </div>
        
        <div className="flex -space-x-1">
          {event.attendees.slice(0, 3).map((attendee, i) => (
            <Avatar key={i} className="h-4 w-4 border border-card">
              <AvatarFallback className="text-[7px] bg-muted">
                {attendee.charAt(0)}
              </AvatarFallback>
            </Avatar>
          ))}
        </div>
      </div>
    </div>
  );
}
