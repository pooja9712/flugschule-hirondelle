import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Banner } from '../components/common/Banner';
import { SafeHtml } from '../components/common/SafeHtml';
import { stripDuplicateHeroImage } from '../utils/eventDescription';
import { useEvents, categoryColors } from '../hooks/useEvents';
import type { Category } from '../hooks/useEvents';
export const Events = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { events, loading } = useEvents();

  // Filters State
  const initialCategoryStr = searchParams.get('category');
  const [selectedCategories, setSelectedCategories] = useState<Set<Category>>(
    initialCategoryStr ? new Set(initialCategoryStr.split(',') as Category[]) : new Set()
  );
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [dateFilter, setDateFilter] = useState(searchParams.get('date') || 'future'); // future, past, today, thisMonth, thisYear
  const [feeFilter, setFeeFilter] = useState(searchParams.get('fee') || 'all'); // all, free, paid
  const [selectedLocations, setSelectedLocations] = useState<Set<string>>(new Set());
  const [selectedOrganizers, setSelectedOrganizers] = useState<Set<string>>(new Set());
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  // Old's real eventlist page (views/eventlist/tmpl/bootstrap3.php) has two
  // dropdowns top-right of the results: an "ordering" select (Standard /
  // Datum auf-/absteigend / Titel auf-/absteigend, models/eventlist.php's
  // getOrderBy()) and an unlabeled "limit" select (3/5/10/20/50 per page,
  // MatukioHelperRendering::getLimitSelect()) - neither existed here before,
  // the sort label was a hardcoded "Datum aufsteigend" that never changed.
  type SortOrder = 'standard' | 'date_asc' | 'date_desc' | 'title_asc' | 'title_desc';
  const [sortOrder, setSortOrder] = useState<SortOrder>('date_asc');
  const [pageLimit, setPageLimit] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Sync state to URL
  useEffect(() => {
    const newParams = new URLSearchParams();
    if (searchTerm) newParams.set('search', searchTerm);
    if (dateFilter && dateFilter !== 'future') newParams.set('date', dateFilter);
    if (feeFilter && feeFilter !== 'all') newParams.set('fee', feeFilter);
    if (selectedCategories.size > 0) newParams.set('category', Array.from(selectedCategories).join(','));
    setSearchParams(newParams, { replace: true });
  }, [searchTerm, dateFilter, feeFilter, selectedCategories, setSearchParams]);

  // Extract unique values for filters
  const uniqueCategories = useMemo(() => {
    const cats = new Set(events.map(e => e.category));
    return Array.from(cats).sort();
  }, [events]);

  // Old's real "Veranstaltungsorte" sidebar lists every registered venue
  // (hiron_matukio_locations, 6 of them) unconditionally - including ones
  // with no currently-scheduled event (e.g. "Bassano-Tour", "Südafrika-Tour"
  // between trips) - not just whichever venues happen to have a published
  // event right now, and definitely not every unique free-text `location`
  // string an event ever had (generic placeholders like "Ort und genaue
  // Uhrzeit wird am Vortag bekannt gegeben" for dates with no fixed venue
  // yet). Fetched independently of the event list for exactly that reason.
  const [allLocations, setAllLocations] = useState<{ id: string; title: string }[]>([]);
  useEffect(() => {
    fetch('/api/locations/public')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setAllLocations(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);
  const uniqueLocations = useMemo(() => {
    return allLocations
      .map((l): [string, string] => [l.id, l.title])
      .sort((a, b) => a[1].localeCompare(b[1]));
  }, [allLocations]);

  const uniqueOrganizers = useMemo(() => {
    const orgs = new Set(events.map(e => e.organizer || 'Flugschule Hirondelle').filter(Boolean));
    return Array.from(orgs).sort();
  }, [events]);

  const uniqueTags = useMemo(() => {
    const tags = new Set<string>();
    events.forEach(e => {
      if (e.tags) {
        e.tags.split(',').map(t => t.trim()).filter(Boolean).forEach(t => tags.add(t));
      }
    });
    return Array.from(tags).sort();
  }, [events]);

  // Apply Filters
  const filteredEvents = useMemo(() => {
    let result = events;

    // Search
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(e => 
        e.title.toLowerCase().includes(lower) || 
        (e.description && e.description.toLowerCase().includes(lower))
      );
    }

    // Category
    if (selectedCategories.size > 0) {
      result = result.filter(e => selectedCategories.has(e.category));
    }

    // Location
    if (selectedLocations.size > 0) {
      result = result.filter(e => !!e.locationId && selectedLocations.has(e.locationId));
    }

    // Organizer
    if (selectedOrganizers.size > 0) {
      result = result.filter(e => selectedOrganizers.has(e.organizer || 'Flugschule Hirondelle'));
    }

    // Tags
    if (selectedTags.size > 0) {
      result = result.filter(e => {
        if (!e.tags) return false;
        const eTags = e.tags.split(',').map(t => t.trim());
        return Array.from(selectedTags).some(t => eTags.includes(t));
      });
    }

    // Fees
    if (feeFilter === 'free') {
      result = result.filter(e => !e.tickets || e.tickets.length === 0 || e.tickets.every(t => t.price === 0));
    } else if (feeFilter === 'paid') {
      result = result.filter(e => e.tickets && e.tickets.some(t => t.price > 0));
    }

    // Dates
    const now = new Date();
    const todayStr = now.toDateString();
    // Old's real default "upcoming events" filter (models/eventlist.php's
    // buildDateQuery(), dateid defaults to 1, event_stopshowing defaults to
    // 2/"booked") is `r.booked > NOW()` - the REGISTRATION DEADLINE, not the
    // event's own start/end date. That's why an event whose deadline has
    // passed disappears from old's real list entirely (confirmed: old's own
    // live site returns zero results for a category whose only event is in
    // exactly that state), regardless of whether it's still "today". Falls
    // back to the event's own end date only for the (common, migrated) case
    // where no registrationDeadline was ever set.
    const stopShowingAt = (e: typeof events[number]) => e.registrationDeadline ? new Date(e.registrationDeadline) : e.end;

    if (dateFilter === 'future') {
      result = result.filter(e => stopShowingAt(e) > now);
    } else if (dateFilter === 'past') {
      result = result.filter(e => stopShowingAt(e) <= now);
    } else if (dateFilter === 'today') {
      result = result.filter(e => e.start.toDateString() === todayStr);
    } else if (dateFilter === 'thisMonth') {
      result = result.filter(e => e.start.getMonth() === now.getMonth() && e.start.getFullYear() === now.getFullYear());
    } else if (dateFilter === 'thisYear') {
      result = result.filter(e => e.start.getFullYear() === now.getFullYear());
    }

    // Old's real 5 ordering options (models/eventlist.php's getOrderBy()) -
    // "Standard" falls back to the component's own default ordering, which
    // in practice is r.begin ASC, same as "Datum aufsteigend".
    switch (sortOrder) {
      case 'date_desc':
        result.sort((a, b) => b.start.getTime() - a.start.getTime());
        break;
      case 'title_asc':
        result.sort((a, b) => a.title.localeCompare(b.title, 'de'));
        break;
      case 'title_desc':
        result.sort((a, b) => b.title.localeCompare(a.title, 'de'));
        break;
      case 'date_asc':
      case 'standard':
      default:
        result.sort((a, b) => a.start.getTime() - b.start.getTime());
        break;
    }

    return result;
  }, [events, searchTerm, selectedCategories, selectedLocations, selectedOrganizers, selectedTags, feeFilter, dateFilter, sortOrder]);

  // Reset to page 1 whenever the result set or its ordering/size changes,
  // so a filter change never leaves the view stranded on an out-of-range page.
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategories, selectedLocations, selectedOrganizers, selectedTags, feeFilter, dateFilter, sortOrder, pageLimit]);

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / pageLimit));
  const paginatedEvents = useMemo(
    () => filteredEvents.slice((currentPage - 1) * pageLimit, currentPage * pageLimit),
    [filteredEvents, currentPage, pageLimit]
  );

  // Handlers for Checkboxes
  const toggleSet = (set: Set<any>, value: any, setter: React.Dispatch<React.SetStateAction<Set<any>>>) => {
    const newSet = new Set(set);
    if (newSet.has(value)) newSet.delete(value);
    else newSet.add(value);
    setter(newSet);
  };

  return (
    <div className="bg-gray-50 min-h-screen pb-12">
      <Banner />

      <div className="container mx-auto px-4 mt-8 flex flex-col md:flex-row gap-8">
        
        {/* SIDEBAR FILTER */}
        <div className="w-full md:w-1/4 flex-shrink-0 print:hidden">
          <div className="bg-white p-6 rounded-lg shadow-sm sticky top-24">
            <h2 className="text-xl font-bold text-gray-800 mb-6 border-b pb-2">Filter</h2>
            
            {/* View Switch */}
            <div className="mb-4">
              <button
                onClick={() => navigate('/buchungskalender')}
                className="w-full bg-blue-50 text-blue-700 font-semibold py-2 rounded-md hover:bg-blue-100 transition flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                Zum Kalender wechseln
              </button>
            </div>

            {/* Calendar file download + print */}
            <div className="mb-6 flex gap-2">
              <a
                href="/api/events/ics"
                className="flex-1 bg-gray-50 text-gray-700 font-semibold py-2 rounded-md hover:bg-gray-100 transition flex items-center justify-center gap-2 text-sm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Kalender
              </a>
              <button
                onClick={() => window.print()}
                className="bg-gray-50 text-gray-700 font-semibold py-2 px-4 rounded-md hover:bg-gray-100 transition flex items-center justify-center"
                title="Liste drucken"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              </button>
              <a
                href="/api/events/rss"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-gray-50 text-gray-700 font-semibold py-2 px-4 rounded-md hover:bg-gray-100 transition flex items-center justify-center"
                title="RSS-Feed abonnieren"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a14 14 0 0114 14M5 12a7 7 0 017 7" /><circle cx="6" cy="18" r="1.5" fill="currentColor" stroke="none" /></svg>
              </a>
            </div>

            {/* Search */}
            <div className="mb-6">
              <h3 className="font-semibold text-gray-700 mb-2">Suche</h3>
              <input 
                type="text" 
                placeholder="Nach Events suchen..." 
                className="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Dates */}
            <div className="mb-6">
              <h3 className="font-semibold text-gray-700 mb-2">Datum</h3>
              <select 
                className="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              >
                <option value="future">Zukünftige Events</option>
                <option value="today">Heute</option>
                <option value="thisMonth">Diesen Monat</option>
                <option value="thisYear">Dieses Jahr</option>
                <option value="past">Vergangene Events</option>
                <option value="all">Alle</option>
              </select>
            </div>

            {/* Categories */}
            <div className="mb-6">
              <h3 className="font-semibold text-gray-700 mb-2">Kategorien</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                {Object.keys(categoryColors).filter(cat => cat !== 'ALLE ANZEIGEN').sort().map(cat => (
                    <label key={cat} className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="rounded text-blue-600 focus:ring-blue-500"
                        checked={selectedCategories.has(cat as Category)}
                        onChange={() => toggleSet(selectedCategories, cat as Category, setSelectedCategories)}
                      />
                      <span className="text-sm text-gray-700">{cat}</span>
                    </label>
                  ))}
                </div>
              </div>

            {/* Fees */}
            <div className="mb-6">
              <h3 className="font-semibold text-gray-700 mb-2">Gebühren</h3>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="fee" value="all" checked={feeFilter === 'all'} onChange={(e) => setFeeFilter(e.target.value)} className="text-blue-600" />
                  <span className="text-sm text-gray-700">Alle</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="fee" value="free" checked={feeFilter === 'free'} onChange={(e) => setFeeFilter(e.target.value)} className="text-blue-600" />
                  <span className="text-sm text-gray-700">Kostenlos</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="fee" value="paid" checked={feeFilter === 'paid'} onChange={(e) => setFeeFilter(e.target.value)} className="text-blue-600" />
                  <span className="text-sm text-gray-700">Kostenpflichtig</span>
                </label>
              </div>
            </div>

            {/* Locations */}
            {uniqueLocations.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-gray-700 mb-2">Veranstaltungsorte</h3>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                  {uniqueLocations.map(([id, name]) => (
                    <label key={id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded text-blue-600 focus:ring-blue-500"
                        checked={selectedLocations.has(id)}
                        onChange={() => toggleSet(selectedLocations, id, setSelectedLocations)}
                      />
                      <span className="text-sm text-gray-700">{name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Organizers */}
            {uniqueOrganizers.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-gray-700 mb-2">Veranstalter</h3>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                  {uniqueOrganizers.map(org => (
                    <label key={org} className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="rounded text-blue-600 focus:ring-blue-500"
                        checked={selectedOrganizers.has(org)}
                        onChange={() => toggleSet(selectedOrganizers, org, setSelectedOrganizers)}
                      />
                      <span className="text-sm text-gray-700">{org}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            {uniqueTags.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-gray-700 mb-2">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {uniqueTags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => toggleSet(selectedTags, tag, setSelectedTags)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        selectedTags.has(tag) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* MAIN LIST VIEW */}
        <div className="w-full md:w-3/4">
          {/* Header */}
          <div className="bg-white p-4 rounded-lg shadow-sm mb-6 flex flex-wrap justify-between items-center gap-3">
            <h2 className="text-lg font-medium text-gray-700">
              <span className="font-bold text-blue-600 mr-2">{filteredEvents.length}</span>
              Ergebnis(se) gefunden
            </h2>
            <div className="flex items-center gap-2">
              {/* Old's unlabeled "limit" select (MatukioHelperRendering::
                  getLimitSelect()) - items per page, no visible label. */}
              <select
                value={pageLimit}
                onChange={(e) => setPageLimit(Number(e.target.value))}
                className="text-sm border border-gray-300 rounded px-2 py-1.5 text-gray-700 bg-white"
                aria-label="Anzahl pro Seite"
              >
                {[3, 5, 10, 20, 50].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              {/* Old's "ordering" select (models/eventlist.php's getOrderBy()) */}
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                className="text-sm border border-gray-300 rounded px-2 py-1.5 text-gray-700 bg-white"
              >
                <option value="standard">Standard</option>
                <option value="date_asc">Datum aufsteigend</option>
                <option value="date_desc">Datum absteigend</option>
                <option value="title_asc">Titel aufsteigend</option>
                <option value="title_desc">Titel absteigend</option>
              </select>
            </div>
          </div>

          {/* List */}
          {loading ? (
            <div className="text-center py-20 text-gray-500">Events werden geladen...</div>
          ) : filteredEvents.length === 0 ? (
            <div className="bg-white p-12 rounded-lg shadow-sm text-center">
              <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <h3 className="text-xl font-medium text-gray-900 mb-2">Keine Events gefunden</h3>
              <p className="text-gray-500">Bitte passe deine Filter an, um mehr Ergebnisse zu sehen.</p>
              <button 
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategories(new Set());
                  setSelectedLocations(new Set());
                  setSelectedOrganizers(new Set());
                  setSelectedTags(new Set());
                  setDateFilter('future');
                  setFeeFilter('all');
                }}
                className="mt-6 text-blue-600 hover:underline font-medium"
              >
                Filter zurücksetzen
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {paginatedEvents.map(event => {
                const colorObj = categoryColors[event.category] || categoryColors['Sonstiges'];
                const isPastEvent = new Date() > new Date(event.end || event.start);

                // Calculate spaces
                const totalCapacity = event.maxParticipants || 0;
                const totalBooked = event.tickets?.reduce((sum, t) => sum + (t.bookedCount || 0), 0) || 0;
                const spacesLeft = Math.max(0, totalCapacity - totalBooked);

                // Old Matukio's real 3-state "Ampel" (traffic light) logic
                // (getEventBookableArray, art=0, the default/public-list case):
                //   buchgraf=2 (green) by default - bookable, has room
                //   buchgraf=0 (red) if now > registration deadline (booking closed),
                //     OR the event is cancelled,
                //     OR full AND stopbooking=1 (old: "unbookable")
                //   buchgraf=1 (yellow) if full AND stopbooking is 0 or 2 (old: "on
                //     the waitlist" - still bookable, onto a real waitlist)
                // New's onExceed ('stop' | 'waitlist') is the exact same field old
                // called stopbooking, just as a named string instead of 0/1/2.
                const registrationClosed = !!event.registrationDeadline && new Date() > new Date(event.registrationDeadline);
                const isFull = totalCapacity > 0 && spacesLeft <= 0;
                // Old's real isBookable() (helpers/rendering.php) never
                // checks the event's own end time at all - only cancelled,
                // the registration deadline (`booked > NOW()`), and
                // full+stopbooking gate the button. Whether the event's own
                // end date/time has passed only ever adds a cosmetic CSS
                // tint on old's real site (mat_event_completed) - it never
                // hides the button or shows any "already happened" text on
                // this list page (that only happens once its own deadline
                // has passed too, which is what registrationClosed already
                // covers - isPastEvent was wrongly used here before).
                const isOverbooked = isFull && event.onExceed === 'stop';
                const isBookable = !event.cancelled && !registrationClosed && !isOverbooked;
                const trafficLight: 'green' | 'yellow' | 'red' | 'cancelled' | 'unlimited' =
                  event.cancelled ? 'cancelled'
                  : totalCapacity <= 0 ? 'unlimited'
                  : !isBookable ? 'red'
                  : isFull ? 'yellow' // full, but onExceed is 'waitlist' (or unset - old's own default)
                  : 'green';
                // Unfloored - old's real "Freie Plätze" line goes negative
                // when overbooked (helpers/events.php's calculateBookedPlacesRecurring:
                // `$result->free = $event->maxpupil - $booked;`, no floor).
                const freiePlaetzeRaw = totalCapacity - totalBooked;

                // Old's real getFeeText() prices the card off event.fees
                // (feePerPerson) itself, not the cheapest ticket - ticket
                // rows can include add-ons/upsells (e.g. "Zusatztag",
                // "Kombikurs") priced far above or below the actual base
                // course fee. The "*" only means "several fee options
                // exist, see the detail page" (different_fees), it's not
                // about which number is shown.
                const hasMultipleFeeOptions = (event.tickets || []).length > 1;
                const displayPrice = event.feePerPerson ?? 0;

                return (
                  <div
                    key={event.id}
                    className="rounded-lg shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow flex flex-col sm:flex-row"
                    // Old's real .mat_event_completed/.mat_hot_event/.mat_top_event
                    // CSS classes (media/com_matukio/css/modern.css) - purely
                    // cosmetic, never gate the button/traffic-light (see
                    // isBookable above). Hot (#f2dede) wins over top (#dff0d8)
                    // when an event is somehow both, matching old's own CSS
                    // cascade order (.mat_hot_event is declared after
                    // .mat_top_event, so it wins a tie on equal specificity).
                    style={{
                      backgroundColor: event.isHotEvent ? '#f2dede'
                        : event.isTopEvent ? '#dff0d8'
                        : isPastEvent ? 'rgba(255,60,59,0.06)' : '#fff'
                    }}
                  >
                    {/* Image / Date block - old's real .mat_event_img is just
                        `width:100%` with NO forced height (verified against
                        its actual compiled CSS), inside a narrow col-sm-2
                        column; the image's own natural aspect ratio decides
                        the height, it's never stretched/cropped to match the
                        text column's height. `self-start` stops this flex
                        row from stretching the image box to the card's full
                        height the way it did before. Old's real template
                        wraps this image in an <a> to the event's own detail
                        page (bootstrap3.php: `<a href="$link">` around the
                        image, same $link as the title below). */}
                    <Link to={`/buchungskalender/${event.id}`} className="sm:w-1/3 md:w-1/4 flex-shrink-0 self-start relative bg-gray-100 block">
                      {event.imageUrl ? (
                        <img
                          src={event.imageUrl.startsWith('http') ? event.imageUrl : `${event.imageUrl}`}
                          alt=""
                          className="w-full h-auto block"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement?.classList.add('flex', 'items-center', 'justify-center', 'aspect-[4/3]');
                            e.currentTarget.parentElement!.innerHTML += `<svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>`;
                          }}
                        />
                      ) : (
                        <div className="w-full aspect-[4/3] flex items-center justify-center text-gray-400">
                          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </div>
                      )}
                      <div className="absolute top-0 left-0 bg-white bg-opacity-90 px-3 py-2 text-center rounded-br-lg shadow-sm">
                        {/* Stored dates are naive wall-clock values serialized
                            with a UTC "Z" suffix (see EventDetailsView.tsx) -
                            UTC methods/timeZone keep this consistent for
                            every viewer regardless of their own timezone. */}
                        <div className="text-xs font-bold text-gray-500 uppercase">{event.start.toLocaleDateString('de-DE', { month: 'short', timeZone: 'UTC' })}</div>
                        <div className="text-2xl font-black text-gray-800">{event.start.getUTCDate()}</div>
                      </div>
                    </Link>

                    {/* Content */}
                    <div className="p-5 sm:w-2/3 md:w-3/4 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span 
                              className="inline-block px-2 py-1 text-xs font-semibold rounded mb-2"
                              style={{ backgroundColor: colorObj.bg, color: colorObj.text }}
                            >
                              {event.category}
                            </span>
                            {event.cancelled && (
                              <span className="inline-block px-2 py-1 text-xs font-semibold rounded mb-2 ml-2 bg-red-100 text-red-700">
                                Storniert
                              </span>
                            )}
                            <h3 className={`text-xl font-bold text-gray-900 ${event.cancelled ? 'line-through opacity-60' : ''}`}>
                              <Link to={`/buchungskalender/${event.id}`} className="hover:underline">{event.title}</Link>
                              {/* Old's exact COM_MATUKIO_HOT string ("*Hot*"),
                                  shown right after the title - eventlist/tmpl/
                                  modern_eventlist.php's $hot_event_text. */}
                              {event.isHotEvent && <span className="ml-1 text-red-700 font-bold">*Hot*</span>}
                            </h3>
                          </div>
                          <div className="text-right">
                            <span className="block text-lg font-bold text-gray-900">
                              {/* Old's getFeeText() appends "*" whenever the event has
                                  several fee options (different_fees) - not a net/gross
                                  marker, just "see detail page for other prices". */}
                              {displayPrice > 0 ? `€ ${displayPrice.toFixed(2)}${hasMultipleFeeOptions ? ' *' : ''}` : 'Kostenlos'}
                            </span>
                          </div>
                        </div>

                        {/* Old Matukio's real eventlist card (bootstrap3.php's
                            mat_event_short_description) shows shortdesc's
                            real rich HTML in full - bullet lists, bold/italic
                            notes, even an inline image - not a stripped,
                            2-line plain-text snippet. Falls back to
                            description only for the rare event that has one
                            but no shortDescription. stripDuplicateHeroImage
                            drops the description's own leading image when
                            it's the exact same file as the thumbnail shown
                            to its left, matching EventDetailsView.tsx's own
                            hero/hero-in-body de-duplication. */}
                        <div className="text-gray-600 text-sm mb-4 prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_a]:text-blue-600 [&_a]:underline">
                          {(event.shortDescription || event.description) ? (
                            <SafeHtml html={stripDuplicateHeroImage(event.shortDescription || event.description, event)} />
                          ) : (
                            'Keine Beschreibung verfügbar.'
                          )}
                        </div>
                        
                        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-500 mb-4">
                          <div className="flex items-center gap-1.5">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            {event.start.toLocaleDateString('de-DE', { timeZone: 'UTC' })} {event.end > event.start && `- ${event.end.toLocaleDateString('de-DE', { timeZone: 'UTC' })}`}
                          </div>
                          {event.location && (
                            <div className="flex items-center gap-1.5">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                              {event.location}
                            </div>
                          )}
                          <div className="flex items-center gap-1.5">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                            {event.organizer || 'Flugschule Hirondelle'}
                          </div>
                        </div>
                      </div>

                        {/* Old's real "Gebucht: X | Freie Plätze: Y" line
                            (helpers/events.php's calculateBookedPlacesRecurring -
                            only ACTIVE bookings counted, Y can go negative when
                            overbooked) plus its inline cancelled/waitlist/
                            overbooked warning spans (bootstrap3.php:442-459) -
                            shown directly, not hidden behind any click. */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600 mb-2">
                          <span className="flex items-center gap-1.5">
                            <div className={`w-3 h-3 rounded-full ${
                              trafficLight === 'cancelled' ? 'bg-sky-500'
                              : trafficLight === 'unlimited' ? 'bg-blue-500'
                              : trafficLight === 'red' ? 'bg-sky-500'
                              : trafficLight === 'yellow' ? 'bg-yellow-400'
                              : 'bg-green-500'
                            }`}></div>
                          </span>
                          {totalCapacity > 0 && (
                            <span>Gebucht: {totalBooked} | Freie Plätze: {freiePlaetzeRaw}</span>
                          )}
                          {event.cancelled && (
                            <span className="inline-flex items-center gap-1 text-red-700 font-medium">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                              Abgesagt
                            </span>
                          )}
                          {!event.cancelled && trafficLight === 'yellow' && (
                            <span className="inline-flex items-center gap-1 text-orange-600 font-medium">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                              Ihre Buchung wird auf der Warteliste durchgeführt.
                            </span>
                          )}
                          {!event.cancelled && isOverbooked && (
                            <span className="inline-flex items-center gap-1 text-red-700 font-medium">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                              Die Veranstaltung ist überbucht
                            </span>
                          )}
                        </div>

                        <div className="flex flex-col sm:flex-row justify-end items-center gap-2 border-t pt-4">
                          <div className="flex gap-2 w-full sm:w-auto">
                            {/* Old Matukio's "Mehr Informationen" links straight to
                                the event's own booking-calendar page (its full
                                details view), not a popup - matches "Buchen"'s own
                                destination, just a secondary/outlined call to action. */}
                            <button
                              onClick={() => navigate(`/buchungskalender/${event.id}`)}
                              className="flex-1 sm:flex-none px-6 py-2 border border-blue-600 text-blue-600 font-medium rounded hover:bg-blue-50 transition"
                            >
                              Mehr Informationen
                            </button>
                            {/* Old's real getBookingButton() renders NOTHING here
                                (not even a disabled button) whenever isBookable()
                                is false - cancelled, registration closed, or full
                                with stopbooking=1 - regardless of whether the
                                event's own end time has already passed today. */}
                            {isBookable && (
                              <button
                                onClick={() => navigate(`/buchungskalender/${event.id}`)}
                                className="flex-1 sm:flex-none px-6 py-2 bg-blue-600 text-white font-medium rounded hover:bg-blue-700 transition"
                              >
                                {trafficLight === 'yellow' ? 'Buchen auf der Warte-Liste' : 'Jetzt buchen'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                );
              })}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 mt-8">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 text-sm border border-gray-300 rounded disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Zurück
              </button>
              <span className="text-sm text-gray-600">Seite {currentPage} von {totalPages}</span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 text-sm border border-gray-300 rounded disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Weiter
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
