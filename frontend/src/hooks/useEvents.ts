import { useState, useEffect } from 'react';

export type Category = 
  | 'ALLE ANZEIGEN'
  | 'Schnupperkurs'
  | 'Grundkurs'
  | 'Höhenflugschulung (A-Schein)'
  | 'Groundhandlingkurs'
  | 'Reisen'
  | 'Performance Training'
  | 'Refresherkurs'
  | 'Unbeschr. LF-Schein (B-Schein)'
  | 'Windenschulung'
  | 'Thermik- und Streckenseminar'
  | 'Sonstiges'
  | 'Rettungsgerätetraining';

// Exact hex values from old Matukio's own $categoryColors dictionary
// (components/com_matukio/views/brcalendar/tmpl/default.php) - this is only
// the fallback used when an event has no per-event calendarBgColor of its
// own, same as in the old system.
export const categoryColors: Record<Category, { bg: string, text: string }> = {
  'ALLE ANZEIGEN': { bg: '#d1d5db', text: '#374151' }, // gray-300 (not part of old's dict - UI-only "show all" filter chip)
  'Schnupperkurs': { bg: '#80C533', text: '#ffffff' },
  'Grundkurs': { bg: '#008000', text: '#ffffff' },
  'Höhenflugschulung (A-Schein)': { bg: '#FFCD00', text: '#000000' },
  'Groundhandlingkurs': { bg: '#3274B7', text: '#ffffff' },
  'Reisen': { bg: '#429CBF', text: '#ffffff' },
  'Performance Training': { bg: '#D24F25', text: '#ffffff' },
  'Refresherkurs': { bg: '#4F0C9B', text: '#ffffff' },
  'Unbeschr. LF-Schein (B-Schein)': { bg: '#E58E26', text: '#ffffff' },
  'Windenschulung': { bg: '#FFF000', text: '#000000' },
  'Thermik- und Streckenseminar': { bg: '#34963B', text: '#ffffff' },
  'Sonstiges': { bg: '#C4C5CA', text: '#374151' },
  'Rettungsgerätetraining': { bg: '#59ABDE', text: '#ffffff' },
};

export interface Ticket {
  id: string;
  name: string;
  price: number;
  description?: string;
  capacity?: number;
  bookedCount?: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  category: Category;
  start: Date;
  end: Date;
  color?: string;
  calendarTextColor?: string;
  description?: string;
  // Old Matukio's shortdesc - the actual field its own list-view template
  // showed per event (com_matukio/views/eventlist/tmpl/modern_eventlist.php:
  // `<span class="mat_shortdesc">...$event->shortdesc...`), distinct from
  // the full `description` shown on the event's own detail page. 95% of
  // migrated events only ever had a shortDescription, not a full
  // description - the events list previously fell back straight to
  // "Keine Beschreibung verfügbar." for almost every one of them because it
  // was reading the wrong field.
  shortDescription?: string;
  location?: string;
  locationId?: string;
  // Real venue name from the Location entity (Veranstaltungsort), not the
  // free-text `location` field above - old's real "Veranstaltungsorte"
  // sidebar filter lists real distinct venues (hiron_matukio_locations),
  // not every unique string ever typed into an event's own location text,
  // which produced far more "venues" than actually exist.
  locationName?: string;
  registrationDeadline?: string;
  imageUrl?: string;
  detailImageUrl?: string;
  organizer?: string;
  organizerId?: string;
  maxParticipants?: number;
  // Old's real getFeeText() always prices the card off event.fees (this
  // field) - not the cheapest ticket, which can be an add-on/upsell line
  // item (e.g. "Zusatztag" at €149 on an event whose real base course fee
  // is €620) rather than the actual course price.
  feePerPerson?: number;
  tickets?: Ticket[];
  tags?: string;
  eventNumber?: string;
  bookingNumber?: string;
  seriesId?: string;
  cancelled?: boolean;
  onExceed?: string; // 'waitlist' | 'stop' - old: stopbooking (0/2 = waitlist, 1 = stop)
  allDay?: boolean;
  showStartTime?: boolean;
  showEndTime?: boolean;
  showRegistrationDeadline?: boolean;
  tieredFees?: boolean;
  eventTieredFees?: {
    title?: string;
    value?: number;
    isPercentage?: boolean;
    isDiscount?: boolean;
    bookableFor?: string;
    validFrom?: string;
    validUntil?: string;
  }[];
  extraFeeOptions?: {
    title?: string;
    value?: number;
    perPlace?: boolean;
  }[];
  // Old's real top_event/hot_event (admin "Veranstaltungs-Anzeige" card) -
  // CSS classes mat_top_event/mat_hot_event + a "HOT" badge on every
  // listing the event appears in (eventlist/tmpl/modern_eventlist.php),
  // plus top_event feeding a separate "Featured Events" widget
  // (views/featured, `WHERE top_event = 1`).
  isTopEvent?: boolean;
  isHotEvent?: boolean;
}

export const useEvents = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/events?published=true&_end=10000')
      .then(res => res.json())
      .then(data => {
        const parsed = data.map((e: any) => ({
          id: e.id,
          title: e.title,
          category: (e.category || 'Sonstiges') as Category,
          start: new Date(e.startDate),
          end: e.endDate ? new Date(e.endDate) : new Date(e.startDate),
          color: e.color,
          calendarTextColor: e.calendarTextColor,
          description: e.description,
          shortDescription: e.shortDescription,
          location: e.location,
          locationId: e.locationId,
          locationName: e.Location?.title,
          registrationDeadline: e.registrationDeadline,
          imageUrl: e.imageUrl,
          detailImageUrl: e.detailImageUrl,
          organizer: e.organizer,
          organizerId: e.organizerId,
          maxParticipants: e.maxParticipants,
          feePerPerson: e.feePerPerson,
          tickets: e.tickets,
          tags: e.tags,
          eventNumber: e.eventNumber,
          bookingNumber: e.bookingNumber,
          seriesId: e.seriesId,
          cancelled: e.cancelled,
          onExceed: e.onExceed,
          allDay: e.allDay,
          showStartTime: e.showStartTime,
          showEndTime: e.showEndTime,
          showRegistrationDeadline: e.showRegistrationDeadline,
          tieredFees: e.tieredFees,
          eventTieredFees: e.eventTieredFees,
          extraFeeOptions: e.extraFeeOptions,
          isTopEvent: e.isTopEvent,
          isHotEvent: e.isHotEvent
        }));
        setEvents(parsed);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  return { events, loading };
};
