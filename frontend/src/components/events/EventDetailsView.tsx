import React from 'react';
import { Link } from 'react-router-dom';
import { SafeHtml } from '../common/SafeHtml';
import { stripDuplicateHeroImage } from '../../utils/eventDescription';

interface Ticket {
  id: string;
  name: string;
  price: number;
  capacity?: number;
  bookedCount?: number;
}

interface EventDetailsViewProps {
  event: any;
  additionalDates?: { id: string; start: Date }[];
  onSelectAdditionalDate?: (id: string) => void;
  onBack: () => void;
  onBook: (quantities: Record<string, number>) => void;
}

export const EventDetailsView: React.FC<EventDetailsViewProps> = ({ event, additionalDates = [], onSelectAdditionalDate, onBack, onBook }) => {
  const [ticketQuantities, setTicketQuantities] = React.useState<Record<string, number>>({});
  const [participants, setParticipants] = React.useState<{ name: string }[] | null>(null);

  // Only visible to a logged-in user who is themselves booked on this event -
  // the backend enforces this too, this fetch just silently does nothing if
  // the visitor isn't eligible (403) instead of showing an error.
  React.useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !event?.id) { setParticipants(null); return; }
    fetch(`/api/bookings/event/${event.id}/participants`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.ok ? res.json() : null)
      .then(data => setParticipants(data))
      .catch(() => setParticipants(null));
  }, [event?.id]);

  // Old Matukio's hiron_matukio_recurring.hits counter - incremented once
  // per real visit to this page. Fire-and-forget: a failure here should
  // never affect the visitor's actual page.
  React.useEffect(() => {
    if (!event?.id) return;
    fetch(`/api/events/${event.id}/view`, { method: 'POST' }).catch(() => {});
  }, [event?.id]);

  // Most migrated events have no registrationDeadline set at all (null), so
  // isPastDeadline alone never catches an event whose own date has simply
  // already happened - that let a "Jetzt buchen" button show for events
  // long over. Falls back to the event's own start date when there's no
  // explicit deadline.
  const isPastEvent = new Date() > new Date(event.end || event.endDate || event.start || event.startDate);
  const isPastDeadline = isPastEvent || (event.registrationDeadline && new Date() > new Date(event.registrationDeadline));
  // Old site's "Freie Plätze": event-wide capacity minus the sum of only
  // ACTIVE (our CONFIRMED, via ticket.bookedCount) bookings across every
  // ticket - matches MatukioHelperUtilsEvents::getEventBookableArray()
  // exactly (maxpupil - gebucht, floored at 0). Old Matukio has no
  // per-ticket-type capacity at all: one shared pool for the whole event,
  // not one independent pool per ticket type - a 26-seat event with 3
  // ticket types is 26 seats total, not 26 each. maxParticipants missing/0
  // means "unlimited" (matches Events.tsx's own traffic-light logic).
  const totalBookedActive = (event.tickets || []).reduce((sum: number, t: Ticket) => sum + (t.bookedCount || 0), 0);
  const freiePlaetze = event.maxParticipants ? Math.max(0, event.maxParticipants - totalBookedActive) : null;

  // The ticket rows already show "(Ausgebucht - Warteliste)" and the book
  // button already switches to "Auf Warteliste eintragen" once the selected
  // quantity would exceed the pooled capacity - but the Status field in the
  // sidebar never reflected this at all, always saying "Anmeldung offen"
  // even for an event already over its real, pooled capacity.
  const isFullyBooked = freiePlaetze !== null && freiePlaetze <= 0;
  // Old's real "stopbooking=1" state - full AND no waitlist allowed at all.
  // This wasn't checked anywhere here, so a closed-with-no-waitlist event
  // still showed a normal, submittable "Auf Warteliste eintragen" button
  // (matches Events.tsx's own trafficLight==='red' fix for the list page).
  const isBookingClosed = isFullyBooked && event.onExceed === 'stop';

  const isWaitlistBooking = React.useMemo(() => {
    if (freiePlaetze === null) return false; // no pooled limit configured - unlimited
    const requestedQuantity = Object.values(ticketQuantities).reduce((sum, q) => sum + (q || 0), 0);
    return requestedQuantity > freiePlaetze;
  }, [ticketQuantities, freiePlaetze]);

  // See stripDuplicateHeroImage's own comment - shared with Events.tsx's
  // list card, which shows this same shortDescription HTML next to the
  // event's own thumbnail too.
  const descriptionHtml = React.useMemo(
    () => stripDuplicateHeroImage(event.shortDescription || event.description, event),
    [event.shortDescription, event.description, event.detailImageUrl, event.imageUrl]
  );

  // Every ticket quantity selector defaults to 0 - no ticket is silently
  // pre-added to the booking just by opening the page.
  React.useEffect(() => {
    setTicketQuantities({});
  }, [event]);

  const handleQuantityChange = (ticketId: string, qty: number) => {
    setTicketQuantities(prev => ({ ...prev, [ticketId]: qty }));
  };

  const handleBookClick = () => {
    onBook(ticketQuantities);
  };

  return (
    <div className="w-full bg-white animate-fade-in">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="mb-8 flex items-center gap-2 text-gray-500 hover:text-luxury-gold transition-colors text-sm uppercase tracking-widest font-semibold print:hidden"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
        Zurück zum Kalender
      </button>

      {/* Main Title & Action Bar */}
      <div className="flex justify-between items-end mb-6 border-b border-gray-200 pb-4">
        <div>
          <h1 className="font-luxury text-4xl md:text-5xl text-luxury-dark uppercase tracking-wide mb-4">
            {event.titleOverride || event.title}
            {event.cancelled && (
              <span className="ml-4 align-middle text-sm font-sans font-bold uppercase tracking-widest text-red-700 bg-red-100 px-3 py-1 rounded-sm">
                Storniert
              </span>
            )}
          </h1>
          
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-gray-500 text-sm">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
              <span>
                {/* Dates are stored as naive wall-clock values (no real
                    timezone - matches how the old site stored them too),
                    serialized with a UTC "Z" suffix - formatting with the
                    viewer's own local timezone would silently shift the
                    displayed date/time depending on where they are.
                    timeZone: 'UTC' displays the stored value as-is for
                    every viewer, everywhere. */}
                {/* Old Matukio's allday/showbegin/showend toggles - an
                    all-day/multi-day event (e.g. a week-long tour) has no
                    single relevant hour, so the time is hidden entirely
                    rather than showing an arbitrary default like 00:00. */}
                {new Date(event.start || event.startDate).toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}
                {!event.allDay && event.showStartTime !== false &&
                  ` · ${new Date(event.start || event.startDate).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} Uhr`}
                {event.end && event.end !== event.start ? ` bis ${new Date(event.end || event.endDate).toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}` : ''}
                {event.end && event.end !== event.start && !event.allDay && event.showEndTime !== false &&
                  ` · ${new Date(event.end || event.endDate).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} Uhr`}
              </span>
            </div>
            
            {event.location && (
              <>
                <div className="hidden sm:block text-gray-300">|</div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                  {event.locationId ? (
                    <Link to={`/veranstaltungsort/${event.locationId}`} className="hover:text-[#2a6496] hover:underline transition-colors font-bold">{event.location}</Link>
                  ) : (
                    <span>{event.location}</span>
                  )}
                </div>
              </>
            )}

            <div className="hidden sm:block text-gray-300">|</div>

            <div className="flex items-center gap-2 text-luxury-gold">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path></svg>
              <span className="font-semibold">{event.category}</span>
            </div>
          </div>

          {/* Zusätzliche Tage - new (no old Matukio equivalent), display-
              only extra day/time entries beyond the event's own start/end
              range. Was only ever rendered in the admin edit form before. */}
          {Array.isArray(event.additionalDays) && event.additionalDays.length > 0 && (
            <div className="mt-2 text-gray-500 text-sm">
              <span className="font-semibold text-gray-600">Zusätzliche Tage: </span>
              {event.additionalDays.map((d: { date: string; startTime: string; endTime: string }, i: number) => (
                <span key={i}>
                  {i > 0 && ', '}
                  {new Date(d.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  {d.startTime && ` · ${d.startTime}`}
                  {d.endTime && ` - ${d.endTime}`}
                </span>
              ))}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-1 print:hidden">
          {/* Print Button */}
          <button
            onClick={() => window.print()}
            className="text-gray-400 hover:text-luxury-dark transition-colors p-2"
            title="Drucken"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-12">
        {/* Left Column - Main Details */}
        <div className="w-full lg:w-2/3 flex flex-col gap-8">
          
          {/* Booking Box */}
          <div className="bg-gray-50 border border-gray-200 rounded-sm overflow-hidden print:hidden">
            <div className="bg-luxury-slate/10 border-b border-gray-200 text-luxury-dark py-3 px-5 font-luxury text-xl tracking-wide">
              Buchen Sie jetzt!
            </div>
            <div className="p-6">
              {event.cancelled ? (
                <div className="flex items-start gap-3 text-red-700">
                  <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                  <span className="font-semibold">Dieser Termin wurde storniert. Eine Buchung ist nicht mehr möglich.</span>
                </div>
              ) : isPastDeadline ? (
                <div className="flex items-start gap-3 text-red-700">
                  <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                  <span className="font-semibold">{isPastEvent ? 'Diese Veranstaltung hat bereits stattgefunden.' : 'Die Anmeldefrist ist überschritten.'}</span>
                </div>
              ) : isBookingClosed ? (
                <div className="flex items-start gap-3 text-red-700">
                  <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                  <span className="font-semibold">Diese Veranstaltung ist ausgebucht - eine Warteliste wird nicht angeboten.</span>
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  {event.tickets && event.tickets.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      {event.tickets.map((ticket: Ticket) => (
                        <div key={ticket.id} className="flex flex-col sm:flex-row sm:items-center justify-between py-3 border-b border-dashed border-gray-300 gap-4">
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-luxury-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                            <div className="flex flex-col">
                              <span className="text-gray-700">{ticket.name}: € {ticket.price.toFixed(2)}</span>
                              {/* Capacity is event-wide/pooled (see freiePlaetze above), not
                                  per ticket type, so this only shows this ticket type's own
                                  booking count - not a "x of y" against its own capacity,
                                  which old Matukio never had either. */}
                              <span className="text-xs text-gray-500">
                                {ticket.bookedCount || 0} gebucht
                                {isFullyBooked && <span className="ml-2 text-[#53a8c7] font-semibold">(Ausgebucht - Warteliste)</span>}
                              </span>
                            </div>
                          </div>
                          <select 
                            value={ticketQuantities[ticket.id] || 0}
                            onChange={(e) => handleQuantityChange(ticket.id, parseInt(e.target.value))}
                            className="w-20 p-2 border border-gray-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-luxury-gold bg-white"
                          >
                            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                              <option key={n} value={n}>{n}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-start gap-3 text-green-700 mb-4">
                      <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                      <span className="font-semibold">Plätze verfügbar. Anmeldung möglich.</span>
                    </div>
                  )}
                  
                  <div className="flex justify-end mt-2">
                    <button 
                      onClick={handleBookClick}
                      className={`px-8 py-2.5 text-white transition-colors text-[14px] rounded-sm shadow-sm ${isWaitlistBooking ? 'bg-[#53a8c7] hover:bg-[#4396b5]' : 'bg-[#5bc0de] hover:bg-[#46b8da]'}`}
                    >
                      {isWaitlistBooking ? 'Auf Warteliste eintragen' : 'Jetzt buchen'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Event Details Box */}
          <div className="bg-gray-50 border border-gray-200 rounded-sm overflow-hidden mb-12">
            <div className="bg-luxury-slate text-white py-3 px-5 font-luxury text-xl tracking-wide">
              Veranstaltungs-Details
            </div>
            <div className="p-6">
              {/* Old Matukio's real event content (paragraphs, images, real
                  links like the DHV exam-question page or a Google Maps
                  pin) migrated into `shortDescription`, not `description` -
                  `description` is empty for ~95% of events. This was
                  previously rendered as plain escaped text (event.description
                  only, no HTML), which for the few events that DID have a
                  description silently dropped every link/image/paragraph
                  break in it. SafeHtml renders the real HTML safely instead,
                  restoring links exactly as they exist in the migrated data -
                  nothing needs to be re-imported from the old site. */}
              {/* Old site's own event-description links render as plain
                  medium-blue text with no underline (verified live against
                  fs-hirondelle.de: computed color rgb(51, 153, 204) =
                  #3399CC) - "prose-luxury"'s own link color (a muted gold,
                  matching the rest of the site's link styling) didn't read
                  as an obvious clickable link here, which looked like the
                  links had gone missing even though they work. */}
              <div className="prose prose-sm md:prose-base prose-luxury max-w-none text-gray-600 mb-8 [&_a]:text-[#3399CC] [&_a]:no-underline hover:[&_a]:underline">
                <SafeHtml html={descriptionHtml || 'Keine Beschreibung verfügbar.'} />
              </div>

              {(event.detailImageUrl || event.imageUrl) && (
                <img
                  src={event.detailImageUrl || event.imageUrl}
                  alt={event.title}
                  className="w-full h-auto rounded-sm object-cover shadow-md mb-8"
                  style={{ maxHeight: '500px' }}
                />
              )}
            </div>
          </div>

        </div>

        {/* Right Column - Sidebar */}
        <div className="w-full lg:w-1/3 flex flex-col gap-8">
          
          {/* Information Sidebar */}
          <div className="bg-white border border-gray-200 rounded-sm overflow-hidden shadow-sm">
            <div className="bg-luxury-slate/10 border-b border-gray-200 text-luxury-dark py-3 px-5 font-luxury text-xl tracking-wide">
              Informationen
            </div>
            <div className="p-0">
              <table className="w-full text-sm text-left">
                <tbody>
                  {event.bookingNumber && (
                    <tr className="border-b border-gray-100">
                      <td className="py-3 px-5 font-semibold text-gray-500 w-1/3">Nummer</td>
                      <td className="py-3 px-5 text-gray-700">{event.bookingNumber}</td>
                    </tr>
                  )}
                  <tr className="border-b border-gray-100">
                    <td className="py-3 px-5 font-semibold text-gray-500 w-1/3">Status</td>
                    <td className="py-3 px-5 text-gray-700">
                      {event.cancelled ? <span className="text-red-700 font-semibold">Storniert</span> : isPastEvent ? 'Bereits stattgefunden' : isPastDeadline ? 'Anmeldeschluss vorbei' : isBookingClosed ? <span className="text-red-700 font-semibold">Ausgebucht</span> : isFullyBooked ? <span className="text-[#53a8c7] font-semibold">Ausgebucht (Warteliste)</span> : 'Anmeldung offen'}
                    </td>
                  </tr>
                  {freiePlaetze !== null && (
                    <tr className="border-b border-gray-100">
                      <td className="py-3 px-5 font-semibold text-gray-500 w-1/3">Freie Plätze</td>
                      <td className="py-3 px-5 text-gray-700">
                        {freiePlaetze}
                        {freiePlaetze === 0 && !event.cancelled && !isPastEvent && !isBookingClosed && (
                          <span className="text-[#53a8c7]"> *Ihre Buchung wird auf der Warteliste durchgeführt.</span>
                        )}
                      </td>
                    </tr>
                  )}
                  <tr className="border-b border-gray-100">
                    <td className="py-3 px-5 font-semibold text-gray-500">Info</td>
                    <td className="py-3 px-5 text-gray-700">
                      Beachten Sie die Verfügbarkeit pro Ticketkategorie.
                    </td>
                  </tr>
                  {event.showRegistrationDeadline !== false && (
                    <tr className="border-b border-gray-100">
                      <td className="py-3 px-5 font-semibold text-gray-500">Anmelde-schluss</td>
                      <td className="py-3 px-5 text-gray-700">
                        {event.registrationDeadline ? new Date(event.registrationDeadline).toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) : '-'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div className="p-4 bg-gray-50 text-[10px] text-gray-400 italic">
                * Die finale Buchung wird geprüft.
              </div>
            </div>
          </div>

          {/* Organizer Sidebar */}
          <div className="bg-white border border-gray-200 rounded-sm overflow-hidden shadow-sm">
            <div className="bg-luxury-slate/10 border-b border-gray-200 text-luxury-dark py-3 px-5 font-luxury text-xl tracking-wide">
              Veranstalter
            </div>
            <div className="p-5 flex flex-col gap-3">
              {event.organizerId ? (
                <Link to={`/veranstalter/${event.organizerId}`} className="text-[#428bca] hover:text-[#2a6496] hover:underline font-semibold">
                  {event.organizer || 'Flugschule Hirondelle'}
                </Link>
              ) : (
                <span className="text-gray-700 font-semibold">{event.organizer || 'Flugschule Hirondelle'}</span>
              )}
            </div>
          </div>

          {/* Additional Dates Sidebar - other upcoming occurrences of the same course */}
          {additionalDates.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-sm overflow-hidden shadow-sm">
              <div className="bg-luxury-slate/10 border-b border-gray-200 text-luxury-dark py-3 px-5 font-luxury text-xl tracking-wide">
                Zusätzliche Termine
              </div>
              <div className="p-5 flex flex-col gap-2">
                {additionalDates.map(d => (
                  <button
                    key={d.id}
                    onClick={() => onSelectAdditionalDate?.(d.id)}
                    className="text-left text-[#428bca] hover:text-[#2a6496] hover:underline text-sm font-bold"
                  >
                    {new Date(d.start).toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC' })}, {new Date(d.start).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Participants Sidebar - only shown if the backend confirms this
              visitor themselves has a booking on this event */}
          {participants && participants.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-sm overflow-hidden shadow-sm">
              <div className="bg-luxury-slate/10 border-b border-gray-200 text-luxury-dark py-3 px-5 font-luxury text-xl tracking-wide">
                Teilnehmerliste
              </div>
              <div className="p-5 flex flex-col gap-1.5 text-sm text-gray-600">
                {participants.map((p, i) => (
                  <div key={i}>{p.name}</div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
