import React, { useState, useEffect, useRef } from 'react';
import tippy from 'tippy.js';
import 'tippy.js/dist/tippy.css';
import DOMPurify from 'dompurify';
import { Banner } from '../components/common/Banner';
import { EventBookingModal } from '../components/events/EventBookingModal';
import { EventDetailsView } from '../components/events/EventDetailsView';
import { useParams, useNavigate } from 'react-router-dom';

import { useEvents, categoryColors } from '../hooks/useEvents';
import type { Category, CalendarEvent } from '../hooks/useEvents';


const ALL_CATEGORIES = Object.keys(categoryColors).filter(c => c !== 'ALLE ANZEIGEN') as Category[];

const germanDays = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const germanMonths = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

// Old site's brcalendar/tmpl/default.php $shortTitles table - an exact-title
// lookup, not a length/duration heuristic. Any event whose title isn't one
// of these keys is shown in full (wrapped across lines if needed).
const SHORT_TITLES: Record<string, string> = {
  'Schnupperkurs': 'SK',
  'Schnupperwochenende': 'SW',
  'Refresher': 'RE',
  'Grundkurs': 'GK',
  'B-Schein Theorie': 'B-TH',
  'Rettungsgeräte Seminar': 'RET',
  'Winden-Kompakt Kurs': 'W',
  'Schnuppertag': 'ST',
};

// Meeus/Jones/Butcher algorithm for the Gregorian Easter Sunday - every
// other German public holiday below is a fixed offset from it (or a fixed
// calendar date), so this is all that's needed to compute holidays for
// any year, not just the ones hardcoded in the old site's
// brcalendarHolidays.json (which stops at 2035).
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

const addDays = (d: Date, n: number) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};

const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Matches the old site's brcalendarHolidays.json exactly (Baden-Württemberg
// public holidays, minus Heilige Drei Könige which that file never
// included either) - computed instead of hardcoded so it stays correct
// for any year.
function getGermanHolidays(year: number): Set<string> {
  const easter = easterSunday(year);
  return new Set([
    new Date(year, 0, 1),     // Neujahrstag
    addDays(easter, -2),      // Karfreitag
    addDays(easter, 1),       // Ostermontag
    new Date(year, 4, 1),     // Tag der Arbeit
    addDays(easter, 39),      // Christi Himmelfahrt
    addDays(easter, 50),      // Pfingstmontag
    addDays(easter, 60),      // Fronleichnam
    new Date(year, 9, 3),     // Tag der Deutschen Einheit
    new Date(year, 10, 1),    // Allerheiligen
    new Date(year, 11, 25),   // 1. Weihnachtstag
    new Date(year, 11, 26),   // 2. Weihnachtstag
  ].map(dateKey));
}

export const Buchungskalender = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  
  const { events, loading } = useEvents();
  // Old Matukio's calendar shows all categories by default, with an
  // "Alle anzeigen"/"Alle ausblenden" pair plus a per-category toggle -
  // multiple categories can be shown/hidden independently at once, not a
  // single-select filter.
  const [visibleCategories, setVisibleCategories] = useState<Set<Category>>(new Set(ALL_CATEGORIES));
  const toggleCategory = (cat: Category) => {
    setVisibleCategories(new Set([cat]));
  };
  const [activeYear, setActiveYear] = useState<number>(new Date().getFullYear());
  const [selectedEventForBooking, setSelectedEventForBooking] = useState<CalendarEvent | null>(null);
  const [selectedTicketQuantities, setSelectedTicketQuantities] = useState<Record<string, number>>({});
  const calendarRef = useRef<HTMLDivElement>(null);

  const selectedEventForDetails = eventId ? events.find(e => e.id === eventId) : null;

  // "Zusätzliche Termine": old's real logic (MatukioHelperRecurring::
  // getRecurringDatesMinimal(), called with its defaults from the live
  // bootstrap3 event template - verified against the restored production
  // DB's own component config, which confirms bootstrap3 is genuinely the
  // active template here) is "every other date of this same series whose
  // begin is after NOW, limit 10" - NOT relative to whichever occurrence
  // you're currently viewing, and not capped at 2. Viewing a past or
  // far-future date of a series should show the exact same list of real
  // upcoming dates either way.
  const now = new Date();
  const additionalDates = selectedEventForDetails?.seriesId
    ? events
        .filter(e =>
          e.seriesId === selectedEventForDetails.seriesId &&
          e.id !== selectedEventForDetails.id &&
          e.start > now
        )
        .sort((a, b) => a.start.getTime() - b.start.getTime())
        .slice(0, 10)
    : selectedEventForDetails?.eventNumber
    ? events
        .filter(e =>
          e.eventNumber === selectedEventForDetails.eventNumber &&
          e.id !== selectedEventForDetails.id &&
          e.start > now
        )
        .sort((a, b) => a.start.getTime() - b.start.getTime())
        .slice(0, 10)
    : [];

  // Initialize tooltips
  useEffect(() => {
    if (!loading && calendarRef.current) {
      tippy('.event-block', {
        theme: 'light',
        allowHTML: true,
        placement: 'right-start', // Match screenshot placement
        interactive: true, // Allow clicking links inside the tooltip
        maxWidth: 450, // Make it wider to fit content like the screenshot
        delay: [200, 0],
        appendTo: document.body,
      });
    }
  }, [loading, events, visibleCategories, activeYear]);

  // Generate calendar months for the active year
  const months = Array.from({ length: 12 }, (_, i) => {
    const daysInMonth = new Date(activeYear, i + 1, 0).getDate();
    const firstDayIndex = new Date(activeYear, i, 1).getDay(); // 0 = Sunday
    return {
      monthIndex: i,
      name: germanMonths[i],
      daysInMonth,
      firstDayIndex
    };
  });

  const getFilteredEvents = () => {
    if (visibleCategories.size === ALL_CATEGORIES.length) return events;
    if (visibleCategories.size === 0) return [];
    return events.filter(e => visibleCategories.has(e.category as Category));
  };

  const filteredEvents = getFilteredEvents();
  const germanHolidays = getGermanHolidays(activeYear);

  // Helper to determine layout rows for events in a month
  const getEventRowsForMonth = (monthIndex: number, daysInMonth: number) => {
    // Event dates are stored as naive German wall-clock values serialized with
    // a "Z" (UTC) suffix - so month/day boundaries must be built with
    // Date.UTC and events positioned via getUTCDate(), not the local-timezone
    // Date methods, otherwise a viewer whose browser timezone differs enough
    // can see an event shifted onto the wrong calendar day.
    const monthStart = new Date(Date.UTC(activeYear, monthIndex, 1));
    const monthEnd = new Date(Date.UTC(activeYear, monthIndex, daysInMonth, 23, 59, 59, 999));

    // Find events that overlap with this month
    const monthEvents = filteredEvents.filter(e => {
      return e.start <= monthEnd && e.end >= monthStart;
    });

    const rows: { event: CalendarEvent, startDay: number, endDay: number }[][] = [];

    // Sort events by start date, then duration
    monthEvents.sort((a, b) => {
      if (a.start.getTime() !== b.start.getTime()) return a.start.getTime() - b.start.getTime();
      return (b.end.getTime() - b.start.getTime()) - (a.end.getTime() - a.start.getTime());
    });

    monthEvents.forEach(e => {
      // Calculate start and end day clamped to this month (1-indexed)
      const startDay = e.start < monthStart ? 1 : e.start.getUTCDate();
      const endDay = e.end > monthEnd ? daysInMonth : e.end.getUTCDate();

      // Find first row where it fits
      let rowIndex = 0;
      let fitted = false;
      while (!fitted) {
        if (!rows[rowIndex]) {
          rows[rowIndex] = [];
        }
        // Check overlap
        const overlaps = rows[rowIndex].some(existing => {
          return !(endDay < existing.startDay || startDay > existing.endDay);
        });
        
        if (!overlaps) {
          rows[rowIndex].push({ event: e, startDay, endDay });
          fitted = true;
        } else {
          rowIndex++;
        }
      }
    });

    return rows;
  };

  return (
    <div className="w-full bg-white pb-20">
      <Banner />

      <div className="container mx-auto px-4 py-8 max-w-[1200px]">
        {/* Main Title */}
        <div className="text-center mb-16 mt-8">
          <h1 className="font-luxury text-4xl md:text-5xl lg:text-6xl text-luxury-dark mb-6 tracking-wide break-words hyphens-auto uppercase">
            TERMINE
          </h1>
          <div className="w-24 h-px bg-luxury-gold mx-auto mb-8"></div>
        </div>

        {selectedEventForDetails ? (
          <div className="mt-8">
            <EventDetailsView
              event={selectedEventForDetails}
              additionalDates={additionalDates}
              onSelectAdditionalDate={(id) => navigate(`/buchungskalender/${id}`)}
              onBack={() => navigate('/buchungskalender')}
              onBook={(quantities) => {
                const token = localStorage.getItem('token');
                if (!token) {
                  navigate('/anmeldung?redirect=' + encodeURIComponent(`/buchungskalender/${selectedEventForDetails.id}`));
                  return;
                }
                setSelectedTicketQuantities(quantities);
                setSelectedEventForBooking(selectedEventForDetails);
              }}
            />
          </div>
        ) : (
          <>
            <div className="flex flex-col lg:flex-row gap-12 mb-16">
              {/* Intro Text */}
              <div className="w-full lg:w-1/2 flex flex-col items-start">
                <p className="text-gray-500 leading-relaxed font-light mb-8 max-w-2xl text-[15px]">
                  Klickt einfach im Kalender auf den entsprechenden Termin für Details und Buchung. Über die Buttons rechts könnt ihr die Termine der Kategorien ein-/ausblenden.
                </p>
                <div className="mb-8 w-full">
                  <span className="text-[14px] mr-4 text-gray-500 italic font-luxury text-lg">Hier geht's zur</span>
                  <button
                    onClick={() => navigate('/events')}
                    className="px-8 py-3 bg-transparent border border-luxury-gold text-luxury-gold hover:bg-luxury-gold hover:text-white transition-colors duration-300 uppercase tracking-widest text-[14px] font-semibold rounded-sm"
                  >
                    LISTENANSICHT
                  </button>
                </div>
                <p className="text-gray-400 text-[13px] leading-relaxed font-light">
                  Wir empfehlen zur Absicherung für Stornos / Absagen den Abschluss einer Seminarversicherung bzw. für unsere mehrtätigen Kurse / Reisen zusätzlich eine Reiseversicherung. Diese kann auch nach Buchung abgeschlossen werden. Infos dazu findet ihr hier sowie in eurer Buchungsbestätigung, die ihr nach Buchungsabschluss per E-Mail erhaltet.
                </p>
              </div>

          {/* Filters */}
          <div className="w-full lg:w-1/2">
            <div className="w-full">
              <div className="grid grid-cols-2 gap-2 mb-2">
                <button
                  onClick={() => setVisibleCategories(new Set(ALL_CATEGORIES))}
                  className="w-full py-2 text-[14px] font-bold tracking-widest uppercase transition-opacity hover:opacity-90 rounded-sm bg-luxury-slate text-white"
                >
                  Alle anzeigen
                </button>
                <button
                  onClick={() => setVisibleCategories(new Set())}
                  className="w-full py-2 text-[14px] font-bold tracking-widest uppercase transition-opacity hover:opacity-90 rounded-sm bg-gray-300 text-gray-700"
                >
                  Alle ausblenden
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {/* Column 1 */}
                <div className="flex flex-col gap-2">
                  {['Schnupperkurs', 'Höhenflugschulung (A-Schein)', 'Reisen', 'Refresherkurs', 'Windenschulung', 'Sonstiges'].map(cat => (
                    <button
                      key={cat}
                      onClick={() => toggleCategory(cat as Category)}
                      className={`w-full py-2.5 px-2 text-[14px] font-bold tracking-widest uppercase truncate transition-all hover:opacity-90 rounded-sm ${!visibleCategories.has(cat as Category) ? 'opacity-30 line-through' : ''}`}
                      style={{ backgroundColor: categoryColors[cat as Category].bg, color: categoryColors[cat as Category].text }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                {/* Column 2 */}
                <div className="flex flex-col gap-2">
                  {['Grundkurs', 'Groundhandlingkurs', 'Performance Training', 'Unbeschr. LF-Schein (B-Schein)', 'Thermik- und Streckenseminar', 'Rettungsgerätetraining'].map(cat => (
                    <button
                      key={cat}
                      onClick={() => toggleCategory(cat as Category)}
                      className={`w-full py-2.5 px-2 text-[14px] font-bold tracking-widest uppercase truncate transition-all hover:opacity-90 rounded-sm ${!visibleCategories.has(cat as Category) ? 'opacity-30 line-through' : ''}`}
                      style={{ backgroundColor: categoryColors[cat as Category].bg, color: categoryColors[cat as Category].text }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Year Selector */}
        <div className="flex items-center justify-center mb-16 mt-8">
          <button 
            onClick={() => setActiveYear(activeYear - 1)} 
            className="px-6 py-2 bg-transparent text-gray-400 hover:text-luxury-gold transition-colors font-luxury text-2xl"
          >
            &lt; {activeYear - 1}
          </button>
          <div className="px-10 py-3 bg-luxury-gold text-white font-luxury text-4xl shadow-md rounded-sm mx-4">
            {activeYear}
          </div>
          <button 
            onClick={() => setActiveYear(activeYear + 1)} 
            className="px-6 py-2 bg-transparent text-gray-400 hover:text-luxury-gold transition-colors font-luxury text-2xl"
          >
            {activeYear + 1} &gt;
          </button>
        </div>

        {/* Calendar */}
        {loading ? (
          <div className="flex justify-center py-20 text-gray-500">Lade Termine...</div>
        ) : (
        <div ref={calendarRef} className="flex flex-col w-full border-t border-[#cccccc] pt-5">
          {months.map(month => {
            const rows = getEventRowsForMonth(month.monthIndex, month.daysInMonth);
            const totalRows = Math.max(rows.length, 3); // Minimum 3 empty event rows for visual consistency

            // Generate day headers
            const days = Array.from({ length: month.daysInMonth }, (_, i) => {
              const date = new Date(activeYear, month.monthIndex, i + 1);
              const dayOfWeek = date.getDay(); // 0 = Sun, 6 = Sat
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
              const isHoliday = germanHolidays.has(dateKey(date));
              return { num: i + 1, name: germanDays[dayOfWeek], isWeekend, isHoliday };
            });

            // Build each row as a real sequence of table cells (an empty
            // filler <td colSpan> for gaps, an event <td colSpan> for
            // occupied spans) instead of CSS-Grid-positioned overlays. A
            // real <table> with the browser's default table-layout: auto
            // lets a day's column grow wider than its neighbours when that
            // column's own content needs it (exactly like the old site's
            // real <table>-based brcalendarTable) - a CSS Grid's tracks
            // can't do that (they're shared, evenly-distributed tracks),
            // which was previously forcing long single-day titles to wrap
            // across extra lines and, since a CSS Grid row's height is
            // shared by every item placed in it, dragging every other
            // event in that same row taller too.
            const tableRows = Array.from({ length: totalRows }, (_, rIdx) => {
              const row = [...(rows[rIdx] || [])].sort((a, b) => a.startDay - b.startDay);
              const cells: ({ type: 'empty'; span: number; key: string } | { type: 'event'; span: number; item: typeof row[number] })[] = [];
              let day = 1;
              row.forEach(item => {
                if (item.startDay > day) {
                  cells.push({ type: 'empty', span: item.startDay - day, key: `empty-${rIdx}-${day}` });
                }
                cells.push({ type: 'event', span: item.endDay - item.startDay + 1, item });
                day = item.endDay + 1;
              });
              if (day <= month.daysInMonth) {
                cells.push({ type: 'empty', span: month.daysInMonth - day + 1, key: `empty-${rIdx}-${day}` });
              }
              return cells;
            });

            return (
              <div key={month.name} className="w-full">
                <h3 className="text-[14px] font-normal text-[#666666] mb-2">{month.name}</h3>
                <div className="overflow-x-auto w-full mb-5 shadow-[0_0_3px_rgba(0,0,0,0.2)] bg-white scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                  <table className="w-full border-t border-l border-[#f0f0f0]" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {days.map(d => (
                          <td
                            key={`header-${d.num}`}
                            className="text-center border-b border-[#f0f0f0]"
                            style={{
                              // Old site's .weekday/.saturday/.sunday all set
                              // width: 24px on these exact header cells.
                              // table-layout: auto gives the FIRST row's
                              // widths priority when sizing columns, so
                              // this is what actually keeps every day
                              // uniform by default - only a column whose
                              // own content truly can't fit (an unbreakable
                              // long single-line event title) grows beyond
                              // it. Without a width hint here, auto-layout
                              // instead free-balances every column against
                              // every row (including wide multi-day event
                              // spans), which is what made the whole table
                              // lopsided.
                              width: '24px',
                              height: '33px',
                              backgroundColor: d.isHoliday ? '#bbbbbb' : d.isWeekend ? '#cccccc' : '#f0f0f0',
                            }}
                          >
                            <div className="text-[14px] leading-[14px] text-gray-800">{d.num}</div>
                            <div className="text-[11px] leading-[14px] text-gray-500 opacity-50">{d.name}</div>
                          </td>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tableRows.map((cells, rIdx) => (
                        <tr key={rIdx}>
                          {cells.map(cell => {
                            if (cell.type === 'empty') {
                              return (
                                <td
                                  key={cell.key}
                                  colSpan={cell.span}
                                  className="border-r border-b border-[#f0f0f0] bg-white"
                                  style={{ height: '24px' }}
                                />
                              );
                            }

                            const item = cell.item;
                            // Old site only ever shortens the event's own
                            // exact title via this fixed dictionary
                            // (brcalendar/tmpl/default.php's $shortTitles) -
                            // it never truncates/abbreviates by duration or
                            // length, it always shows the full title
                            // otherwise, wrapped across lines if needed.
                            const baseTitle = item.event.titleOverride || item.event.title;
                            const displayText = SHORT_TITLES[baseTitle] || baseTitle;

                            return (
                              <td
                                key={item.event.id}
                                colSpan={cell.span}
                                onClick={() => navigate(`/buchungskalender/${item.event.id}`)}
                                data-tippy-content={DOMPurify.sanitize(`
                                  <div class='p-5 text-left bg-white font-sans'>
                                    ${(item.event.detailImageUrl || item.event.imageUrl) ? `
                                    <img src='${item.event.detailImageUrl || item.event.imageUrl}' class='w-full h-32 object-cover rounded-sm mb-4' />
                                    ` : ''}
                                    <h4 class='font-luxury text-2xl text-luxury-dark mb-1'>${baseTitle}${item.event.isHotEvent ? " <span class='ml-1 text-red-700 font-bold'>*Hot*</span>" : ''}${item.event.cancelled ? " <span class='text-red-700 text-xs uppercase font-bold align-middle bg-red-100 px-2 py-1 rounded-sm'>Storniert</span>" : ''}</h4>
                                    <div class='flex flex-col gap-1 mb-4 pb-4 border-b border-gray-100'>
                                      <div class='flex items-center gap-2 text-[12px] text-gray-500 font-semibold'>
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"></path></svg>
                                        ${item.event.category}
                                      </div>
                                      ${(item.event.feePerPerson ?? 0) > 0 ? `
                                      <div class='flex items-center gap-2 text-[12px] text-gray-800 font-bold'>
                                        <svg class="w-4 h-4 text-luxury-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path></svg>
                                        € ${item.event.feePerPerson!.toFixed(2)}${(item.event.tickets?.length || 0) > 1 ? ' *' : ''}
                                      </div>
                                      ` : ''}
                                    </div>

                                    <div class='text-[13px] text-gray-600 mb-6 leading-relaxed max-h-[300px] overflow-y-auto pr-2 custom-scrollbar'>
                                      ${item.event.description ? item.event.description.replace(/\\n/g, '<br/>') : 'Keine Beschreibung verfügbar.'}
                                    </div>

                                    <a href='/buchungskalender/${item.event.id}' class='text-luxury-gold text-[12px] uppercase tracking-widest font-bold hover:text-luxury-dark transition-colors inline-flex items-center gap-2'>
                                      Mehr erfahren
                                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                                    </a>
                                  </div>
                                `)}
                                className={`event-block rounded-sm px-1 py-[2px] cursor-pointer hover:opacity-90 transition-opacity align-middle text-center whitespace-normal break-words text-[11.9px] leading-[14.875px] ${item.event.cancelled ? 'opacity-50' : ''}`}
                                style={{
                                  backgroundColor: item.event.color || categoryColors[item.event.category]?.bg || '#bdc3c7',
                                  color: item.event.calendarTextColor || categoryColors[item.event.category]?.text || '#374151',
                                  height: '24px',
                                }}
                              >
                                {/* Old site's .br-event-title inherits
                                    .br-event's font-size: .85em (of its
                                    14px table font) = 11.9px - noticeably
                                    smaller than the day-grid's own 14px.
                                    Matching it exactly, together with the
                                    real <table> auto-layout above, is what
                                    lets full names like "Schnupper-/
                                    Einsteigerkurs" fit without being cut
                                    off or forced onto extra lines, same as
                                    the old site. */}
                                <span className={`font-normal leading-tight text-[11.9px] ${item.event.cancelled ? 'line-through' : ''}`}>
                                  {displayText}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
        )}
        </>
        )}

        <EventBookingModal 
          isOpen={!!selectedEventForBooking} 
          onClose={() => setSelectedEventForBooking(null)} 
          event={selectedEventForBooking} 
          initialQuantities={selectedTicketQuantities}
        />

      </div>
    </div>
  );
};
