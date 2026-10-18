import {
    List,
    Datagrid,
    TextField,
    DateField,
    NumberField,
    Filter,
    SelectInput,
    ShowButton,
    Show,
    TopToolbar,
    ListButton,
    useRecordContext,
    useUpdate,
    useNotify,
    useRefresh,
    useListContext,
    Button as RaButton,
    FunctionField,
    BooleanField,
    useInput,
    useGetList,
} from 'react-admin';
import { useState, useEffect, useRef } from 'react';
import {
    Table, TableBody, TableCell, TableRow, Paper, Typography, Box, Grid, Card, CardContent,
    FormControl, InputLabel, Select, MenuItem, Button, TextField as MuiTextField, Divider,
    Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Tooltip, Chip,
    Checkbox, FormControlLabel, CircularProgress, ListSubheader, InputAdornment
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import DownloadIcon from '@mui/icons-material/Download';
import PrintIcon from '@mui/icons-material/Print';
import BadgeIcon from '@mui/icons-material/Badge';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import RestoreIcon from '@mui/icons-material/Restore';
import { formatBirthDateDisplay, formatBirthDateForInput } from '../utils/birthDate';

const salutationChoices = ['Bitte wählen', 'Herr', 'Frau', 'Divers'];

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('auth')}` });

// Old's real event filter/selector (bookings list + voucher form) builds
// its dropdown text via raw SQL: CONCAT(a.title, ' ', r.begin) - title
// first, then the raw DATETIME value verbatim (YYYY-MM-DD HH:MM), not a
// German-locale date - confirmed against old's own live dropdown.
const eventOptionSqlDate = (isoDate: string) => {
    const d = new Date(isoDate);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};

async function postBulk(path: string, body: any) {
    const res = await fetch(`/api/bookings${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Fehler');
    return data;
}

// --- Filters (mirrors Matukio's search box, "Active or Floating" status
// dropdown, event dropdown, and time-period dropdown) ---
// No "Alle Zeiten" entry in timeChoices: the SelectInput's own empty option
// already stands for it (the backend treats a missing period as all times) -
// listing it again showed that entry twice. Old's filter_status dropdown
// (views/bookings/tmpl/default.php) has 9 options incl. "Aktiv oder
// Schwebend" as its own explicit entry (not just the default) - matched here
// 1:1, same order, same STATUS_PSEUDO-backed 'activeandpending' value.
const statusChoices = [
    { id: 'all', name: 'Alle' },
    { id: 'activeandpending', name: 'Aktiv oder Schwebend' },
    { id: 'active', name: 'Bestätigt' },
    { id: 'pending', name: 'Ausstehend' },
    { id: 'waitlist', name: 'Warteliste' },
    { id: 'archived', name: 'Abgeschlossen' },
    { id: 'deleted', name: 'Storniert / Papierkorb' },
    { id: 'paid', name: 'Bezahlt' },
    { id: 'unpaid', name: 'Unbezahlt' },
];

const timeChoices = [
    { id: 'day', name: 'Letzter Tag' },
    { id: 'week', name: 'Letzte Woche' },
    { id: 'month', name: 'Letzter Monat' },
    { id: 'year', name: 'Letztes Jahr' },
];

// Umlaut-insensitive search text: "Südafrika" must be found by typing
// "sudafrika" (old's select2 dropdown ignored the dots too) or "suedafrika".
// The plain variant strips the dots (ü -> u); the transliterated variant
// spells them out (ü -> ue), and the search term is tested against both.
const foldGerman = (text: string, transliterate = false) => {
    let t = text.toLowerCase().replace(/ß/g, 'ss');
    if (transliterate) t = t.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue');
    return t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
};

// Event filter with a search box inside the open dropdown (old's Joomla
// list used a select2-style searchable dropdown - with hundreds of dated
// events, scrolling a plain select to find one is impractical). Plain MUI
// Select + useInput instead of ReferenceInput/SelectInput, since
// SelectInput has no way to put a text field inside its menu.
const EventFilterInput = ({ source, label }: { source: string; label: string; alwaysOn?: boolean }) => {
    const { field } = useInput({ source });
    const { data = [] } = useGetList('events', {
        pagination: { page: 1, perPage: 500 },
        sort: { field: 'startDate', order: 'DESC' },
    });
    const [search, setSearch] = useState('');

    // Old's own event filter (administrator/components/com_matukio/
    // views/bookings/view.html.php) builds each option as
    // CONCAT(title, ' ', begin) - every recurring date of e.g. "Grundkurs"
    // is otherwise an identical, indistinguishable entry with no way to
    // tell which actual date you're picking.
    const optionText = (record: any) => `${record.title} ${eventOptionSqlDate(record.startDate)}`;

    // Chrome's page translation rewrites the menu items' text in the DOM
    // only - `data` stays German. So the search is matched against both the
    // German option text and whatever the item currently shows on screen
    // (e.g. "South Africa VIP Tour" when the admin translated the page).
    // For that to work every item stays mounted and non-matching ones are
    // just hidden - unmounting them would throw away Chrome's translation.
    const itemRefs = useRef<Record<string, HTMLLIElement | null>>({});
    const matches = (e: any, term: string) => {
        const shown = itemRefs.current[e.id]?.textContent || '';
        return [optionText(e), shown].some(text =>
            foldGerman(text).includes(term) || foldGerman(text, true).includes(term));
    };
    const term = foldGerman(search.trim());
    // Keep the currently selected event visible even if it doesn't match.
    const isVisible = (e: any) => !term || e.id === field.value || matches(e, term);
    const visibleCount = data.filter(isVisible).length;

    const selectedValue = data.some((e: any) => e.id === field.value) ? field.value : '';

    return (
        <FormControl variant="filled" size="small" margin="dense" sx={{ minWidth: 200 }}>
            <InputLabel>{label}</InputLabel>
            <Select
                value={selectedValue}
                // '' (not undefined) for "Alle Events" - see SearchInput's apply()
                onChange={e => field.onChange(e.target.value)}
                onClose={() => setSearch('')}
                // Focus must stay in the search field, not jump to the
                // first menu item when the menu opens.
                MenuProps={{ autoFocus: false, slotProps: { paper: { sx: { maxHeight: 450 } } } }}
                renderValue={(value: any) => {
                    const ev = data.find((e: any) => e.id === value);
                    return ev ? optionText(ev) : 'Alle Events';
                }}
                displayEmpty={false}
            >
                <ListSubheader sx={{ bgcolor: 'background.paper', pt: 1, pb: 1, lineHeight: 'normal' }}>
                    <MuiTextField
                        size="small"
                        autoFocus
                        fullWidth
                        placeholder="Event suchen…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        // Stop the Select's built-in type-to-jump from
                        // stealing keystrokes (Escape still closes it).
                        onKeyDown={e => { if (e.key !== 'Escape') e.stopPropagation(); }}
                        slotProps={{ input: { endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> } }}
                    />
                </ListSubheader>
                <MenuItem value="">Alle Events</MenuItem>
                {data.map((e: any) => {
                    const shown = isVisible(e);
                    return (
                        <MenuItem
                            key={e.id}
                            value={e.id}
                            ref={el => { itemRefs.current[e.id] = el; }}
                            // disabled too, so arrow keys skip hidden items
                            disabled={!shown}
                            sx={shown ? undefined : { display: 'none' }}
                        >
                            {optionText(e)}
                        </MenuItem>
                    );
                })}
                {visibleCount === 0 && (
                    <MenuItem disabled>Keine Events gefunden</MenuItem>
                )}
            </Select>
        </FormControl>
    );
};

// Free-text search box (name, e-mail, ID). The list only starts filtering
// from the 3rd typed letter - one or two letters match almost every
// booking, so they leave the full list showing. Emptying the box (typing it
// away or the clear button) shows all bookings again right away.
const MIN_SEARCH_LENGTH = 3;

const SearchInput = ({ source, label }: { source: string; label: string; alwaysOn?: boolean }) => {
    const { field } = useInput({ source });
    const [text, setText] = useState<string>(field.value || '');
    // The filter value this box last applied - lets an outside change (e.g.
    // react-admin's "remove all filters") be told apart from our own.
    const applied = useRef<string>(field.value || '');

    useEffect(() => {
        const outside = field.value || '';
        if (outside !== applied.current) {
            applied.current = outside;
            setText(outside);
        }
    }, [field.value]);

    const apply = (value: string) => {
        if (value === applied.current) return;
        applied.current = value;
        // '' rather than undefined: react-admin merges the filter form's
        // values into the current filters, so an undefined q would leave the
        // old search in place. An empty string actually removes it.
        field.onChange(value);
    };

    // Debounced, like react-admin's own TextInput.
    useEffect(() => {
        const term = text.trim();
        const target = term.length >= MIN_SEARCH_LENGTH ? term : '';
        if (!target) { apply(''); return; }
        const t = setTimeout(() => apply(target), 300);
        return () => clearTimeout(t);
    }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <MuiTextField
            label={label}
            variant="filled"
            size="small"
            margin="dense"
            value={text}
            onChange={e => setText(e.target.value)}
            sx={{ minWidth: 280 }}
            // MUI 9 dropped the InputProps shorthand - slotProps.input it is.
            slotProps={{
                input: {
                    endAdornment: text ? (
                        <InputAdornment position="end">
                            <IconButton size="small" aria-label="Suche leeren" onClick={() => setText('')}>
                                <CloseIcon fontSize="small" />
                            </IconButton>
                        </InputAdornment>
                    ) : undefined,
                },
            }}
        />
    );
};

// react-admin remembers list filters (URL + local storage), so a search
// typed earlier came back on every refresh / click on "Buchungen". Opening
// the list now always starts with an empty search box; the other filters
// (status, event, period) are still remembered as before.
const ClearSearchOnMount = () => {
    const { filterValues, displayedFilters, setFilters } = useListContext();
    useEffect(() => {
        // "activeandpending" is a real, explicit choice again (matches old's
        // filter_status dropdown 1:1 - see statusChoices) - only "time=all"
        // still has no explicit entry of its own.
        const { q, ...rest } = filterValues || {};
        let changed = !!q;
        if (rest.time === 'all') { delete rest.time; changed = true; }
        if (changed) setFilters(rest, displayedFilters);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    return null;
};

const BookingFilter = (props: any) => (
    <Filter {...props}>
        <SearchInput label="Suche (Name, E-Mail, ID)" source="q" alwaysOn />
        <SelectInput label="Status" source="status" choices={statusChoices} alwaysOn />
        <EventFilterInput label="Event" source="eventId" alwaysOn />
        <SelectInput label="Zeitraum" source="time" choices={timeChoices} alwaysOn emptyText="Alle Zeiten" />
    </Filter>
);

// --- Compose dialog, shared by Reject and Contact (both send free-text email) ---
const ComposeDialog = ({ open, title, onClose, onSend, defaultSubject }: {
    open: boolean; title: string; onClose: () => void; onSend: (subject: string, message: string) => Promise<void>; defaultSubject: string;
}) => {
    const [subject, setSubject] = useState(defaultSubject);
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);

    useEffect(() => { if (open) { setSubject(defaultSubject); setMessage(''); } }, [open, defaultSubject]);

    const handleSend = async () => {
        setSending(true);
        try {
            await onSend(subject, message);
            onClose();
        } finally {
            setSending(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>{title}</DialogTitle>
            <DialogContent>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                    Platzhalter verfügbar: {'{BOOKING_NAME}'}, {'{EVENT_TITLE}'}
                </Typography>
                <MuiTextField fullWidth margin="dense" label="Betreff" value={subject} onChange={(e) => setSubject(e.target.value)} />
                <MuiTextField fullWidth margin="dense" label="Nachricht" value={message} onChange={(e) => setMessage(e.target.value)} multiline minRows={6} />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Abbrechen</Button>
                <Button variant="contained" onClick={handleSend} disabled={sending || !subject || !message}>
                    {sending ? 'Sende...' : 'Senden'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

// --- Always-visible admin toolbar (mirrors the old Matukio toolbar, which
// shows every button permanently rather than only after a row is selected -
// buttons that need selected rows just warn if none are checked yet) ---
const BookingListActions = () => {
    const { selectedIds, filterValues } = useListContext();
    const notify = useNotify();
    const refresh = useRefresh();
    const [rejectOpen, setRejectOpen] = useState(false);
    const [contactOpen, setContactOpen] = useState(false);
    // old: rejection_subject - the admin-configured default subject for the
    // "Ablehnen" compose dialog (Einstellungen page).
    const [rejectionSubject, setRejectionSubject] = useState('Ihre Buchung für {EVENT_TITLE}');
    useEffect(() => {
        fetch('/api/settingsConfig', { headers: authHeaders() })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => { if (data?.rejectionSubject) setRejectionSubject(data.rejectionSubject); })
            .catch(() => {});
    }, []);

    const run = async (path: string, body: any, successMsg?: string) => {
        if (!selectedIds || selectedIds.length === 0) {
            notify('Bitte wählen Sie zuerst mindestens eine Buchung aus.', { type: 'warning' });
            return;
        }
        try {
            const result = await postBulk(path, body);
            notify(successMsg || result.message || 'Erledigt', { type: 'success' });
            refresh();
        } catch (e: any) {
            notify(`Fehler: ${e.message}`, { type: 'error' });
        }
    };

    const openCompose = (setter: (v: boolean) => void) => {
        if (!selectedIds || selectedIds.length === 0) {
            notify('Bitte wählen Sie zuerst mindestens eine Buchung aus.', { type: 'warning' });
            return;
        }
        setter(true);
    };

    const isTrashView = filterValues?.status === 'deleted';

    // Exports (CSV/Excel/participant list/signature list) scope to whichever
    // rows are checked, same as every other action in this toolbar - the
    // backend already supports an `ids` filter (buildBookingWhereClause in
    // bookings.routes.ts), this just never sent it, so an export always
    // silently ignored the selection and ran against the current list
    // filter instead. Falls back to that filter only when nothing's
    // selected, matching "export everything currently shown".
    const buildExportQs = () => {
        const qs = new URLSearchParams();
        if (selectedIds && selectedIds.length > 0) {
            qs.set('ids', selectedIds.join(','));
            return qs;
        }
        if (filterValues?.eventId) qs.set('eventId', filterValues.eventId);
        if (filterValues?.status) qs.set('status', filterValues.status);
        if (filterValues?.q) qs.set('q', filterValues.q);
        if (filterValues?.time) qs.set('time', filterValues.time);
        return qs;
    };

    // Print-list exports (participant/signature list) are meant to open in
    // a new tab so the admin can use the browser's print dialog.
    const openExport = (path: string) => {
        fetch(`/api/bookings${path}?${buildExportQs().toString()}`, { headers: authHeaders() })
            .then(async (res) => {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                window.open(url, '_blank');
            });
    };

    // The CSV export needs an actual file download with a real name - a
    // blob: URL carries no HTTP headers, so window.open() on one always
    // shows/saves it under a random blob id instead of the filename the
    // backend's Content-Disposition header specifies. An <a download> with
    // that name read back out of the response header does it properly.
    const downloadExport = (path: string, qs: URLSearchParams = buildExportQs()) => {
        fetch(`/api/bookings${path}?${qs.toString()}`, { headers: authHeaders() })
            .then(async (res) => {
                const disposition = res.headers.get('Content-Disposition') || '';
                const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/);
                const asciiMatch = disposition.match(/filename="([^"]+)"/);
                const filename = utf8Match ? decodeURIComponent(utf8Match[1]) : (asciiMatch ? asciiMatch[1] : 'export.csv');
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                link.remove();
                URL.revokeObjectURL(url);
            });
    };

    return (
        // Plain div with an inline style, not react-admin's <TopToolbar>: an
        // external stylesheet override (even with !important, confirmed
        // winning in DevTools) still failed to make TopToolbar's own flex
        // item actually wrap here - something about how its internal
        // flex-basis/overflow interacts with react-admin's runtime-injected
        // styles kept it laid out as a single unbroken row regardless. A
        // plain element we fully own, styled only via React's inline style
        // attribute, has no such competing styled-component to fight.
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, width: '100%', padding: '4px 4px 8px' }}>
            <RaButton label="Aktivieren" onClick={() => run('/bulk/activate', { ids: selectedIds })}><CheckCircleIcon /></RaButton>
            <RaButton label="Ausstehend" onClick={() => run('/bulk/pending', { ids: selectedIds })}><CancelIcon /></RaButton>
            <RaButton label="Ablehnen" onClick={() => openCompose(setRejectOpen)} />
            {isTrashView && (
                // Restores without ever emailing the customer - "Aktivieren"
                // stays available too in this view, but it DOES send the
                // Buchungsbestätigung mail (same as always), so this is the
                // one to use for a plain "undo my accidental delete".
                <RaButton label="Wiederherstellen" onClick={() => run('/bulk/restore', { ids: selectedIds })}><RestoreIcon /></RaButton>
            )}
            {!isTrashView && (
                <RaButton label="Papierkorb" onClick={() => run('/bulk/wastebasket', { ids: selectedIds })} />
            )}
            {isTrashView && (
                <RaButton label="Papierkorb leeren" onClick={() => {
                    if (!selectedIds || selectedIds.length === 0) {
                        notify('Bitte wählen Sie zuerst mindestens eine Buchung aus.', { type: 'warning' });
                        return;
                    }
                    if (window.confirm('Diese Buchungen werden endgültig gelöscht. Fortfahren?')) {
                        run('/bulk/empty-trash', { ids: selectedIds });
                    }
                }} />
            )}
            <RaButton label="Zertifikat ausstellen" onClick={() => run('/bulk/certificate', { ids: selectedIds, issue: true })} />
            <RaButton label="Zertifikat widerrufen" onClick={() => run('/bulk/certificate', { ids: selectedIds, issue: false })} />
            <RaButton label="Eingecheckt" onClick={() => run('/bulk/checkin', { ids: selectedIds })} />
            <RaButton label="Kontaktieren" onClick={() => openCompose(setContactOpen)} />
            <Tooltip title="Teilnehmerliste drucken">
                <IconButton onClick={() => openExport('/export/participant-list')}><PrintIcon /></IconButton>
            </Tooltip>
            <Tooltip title="Unterschriftenliste drucken">
                <IconButton onClick={() => openExport('/export/signature-list')}><PrintIcon fontSize="small" /></IconButton>
            </Tooltip>
            <Tooltip title="Als CSV exportieren">
                <IconButton onClick={() => downloadExport('/export/csv')}><DownloadIcon /></IconButton>
            </Tooltip>
            {/* Every booking in the database - ignores the row selection and
                all list filters (status=all, since no status at all would
                mean the backend's active+pending default). Queried fresh on
                each click, so bookings added since the page loaded are in. */}
            <RaButton label="Alle exportieren (CSV)" onClick={() => downloadExport('/export/csv', new URLSearchParams({ status: 'all' }))}>
                <DownloadIcon />
            </RaButton>

            <ComposeDialog
                open={rejectOpen}
                title="Buchungen ablehnen"
                defaultSubject={rejectionSubject}
                onClose={() => setRejectOpen(false)}
                onSend={(subject, message) => run('/bulk/reject', { ids: selectedIds, subject, message }, 'Buchungen abgelehnt und benachrichtigt.')}
            />
            <ComposeDialog
                open={contactOpen}
                title="Teilnehmer kontaktieren"
                defaultSubject="Information zu {EVENT_TITLE}"
                onClose={() => setContactOpen(false)}
                onSend={(subject, message) => run('/bulk/contact', { ids: selectedIds, subject, message })}
            />
        </div>
    );
};

const PaidToggle = ({ source, label: _label }: { source?: string, label?: string }) => {
    const record = useRecordContext();
    const notify = useNotify();
    const refresh = useRefresh();
    if (!record) return null;

    const toggle = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const res = await fetch(`/api/bookings/${record.id}/paid`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', ...authHeaders() },
                body: JSON.stringify({ paid: !record.paid }),
            });
            if (!res.ok) throw new Error('Fehler beim Aktualisieren');
            notify(record.paid ? 'Als unbezahlt markiert' : 'Als bezahlt markiert', { type: 'success' });
            refresh();
        } catch (err: any) {
            notify(`Fehler: ${err.message}`, { type: 'error' });
        }
    };

    return (
        <Tooltip title={record.paid ? 'Als unbezahlt markieren' : 'Als bezahlt markieren'}>
            <Chip
                size="small"
                label={record.paid ? 'Bezahlt' : 'Offen'}
                color={record.paid ? 'success' : 'default'}
                onClick={toggle}
            />
        </Tooltip>
    );
};

const StatusChip = ({ source, label: _label }: { source?: string, label?: string }) => {
    const record = useRecordContext();
    if (!record) return null;
    const map: Record<string, { label: string; color: any }> = {
        CONFIRMED: { label: 'Bestätigt', color: 'success' },
        PENDING: { label: 'Ausstehend', color: 'warning' },
        WAITLIST: { label: 'Warteliste', color: 'info' },
        COMPLETED: { label: 'Abgeschlossen', color: 'default' },
        CANCELLED: { label: 'Storniert', color: 'error' },
    };
    const status = record.checkedIn ? { label: 'Eingecheckt', color: 'success' } : (map[record.status] || { label: record.status, color: 'default' });
    return <Chip size="small" label={status.label} color={status.color} />;
};

export const BookingList = () => (
    <List filters={<BookingFilter />} sort={{ field: 'createdAt', order: 'DESC' }} actions={false} filterDefaultValues={{ status: 'activeandpending' }}>
        {/* We place the actions here inside the List context rather than in the
            actions prop so they can wrap freely. The grid wrapper with minmax(0, 1fr)
            prevents the wide Datagrid from forcing the parent Card to expand horizontally,
            which was previously giving the flex container too much space and preventing wrapping. */}
        <ClearSearchOnMount />
        <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', width: '100%' }}>
            <Box sx={{ mb: 2 }}>
                <BookingListActions />
            </Box>
            <div className="booking-table-scroll" style={{ width: '100%', overflowX: 'auto' }}>
                {/* bulkActionButtons must stay truthy (any non-false value,
                    an empty fragment is fine) - that's what keeps
                    hasBulkActions true so the selection checkboxes render
                    at all; drop it entirely and Datagrid falls back to its
                    own default (false, since bookings aren't deletable),
                    which silently hides the checkboxes. bulkActionsToolbar
                    ={false} is the separate prop that disables react-admin's
                    own sliding "N selected" toolbar - the thing that was
                    popping up over BookingListActions and sliding back
                    behind the table. Both are needed together. */}
                <Datagrid rowClick="show" bulkActionButtons={<></>} bulkActionsToolbar={false}>
                    <TextField source="customerName" label="Name" sortable={false} sx={{ whiteSpace: 'nowrap' }} />
                    <TextField source="customerEmail" label="E-Mail" sortable={false} sx={{ display: 'inline-block', maxWidth: 150, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title="E-Mail" />
                    <FunctionField label="Event" render={(r: any) => r.event?.title || '—'} sortable={false} sx={{ display: 'inline-block', maxWidth: 150, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} />
                    <DateField source="createdAt" label="Buchungsdatum" showTime sx={{ whiteSpace: 'nowrap' }} />
                    <NumberField source="bookedSeats" label="Plätze" sortable={false} />
                    <PaidToggle source="paid" label="Bezahlt" />
                    <BooleanField source="certificated" label="Zertifikat" />
                    <FunctionField label="Rechnung" sortable={false} render={(r: any) => <InvoiceCell record={r} />} />
                    <StatusChip source="status" label="Status" />
                    <NumberField source="totalPrice" label="Gesamtpreis (€)" options={{ style: 'currency', currency: 'EUR' }} sx={{ whiteSpace: 'nowrap' }} />
                    <ShowButton />
                    <TextField source="shortId" label="ID" sortBy="id" sx={{ display: 'inline-block', maxWidth: 80, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title="ID" />
                </Datagrid>
            </div>
        </Box>
    </List>
);

// Old's real admin bookings list "Invoice" column (MatukioHelperBasic::
// getInvoiceImage()): the real sequential number ("247/2026") next to a
// download link, shown only for bookings on a paid event - a dash for free
// events, matching old exactly (see utils/invoiceNumber.ts on the backend
// for the full skip-rule/numbering logic this `invoiceNumber` field comes
// from already pre-resolved on each list row).
const InvoiceCell = ({ record }: { record: any }) => {
    const notify = useNotify();
    const [downloading, setDownloading] = useState(false);
    if (!record.invoiceNumber) return <span style={{ color: '#999' }}>—</span>;
    const download = () => {
        setDownloading(true);
        fetch(`/api/bookings/${record.id}/invoice`, { headers: authHeaders() })
            .then(async (res) => {
                if (!res.ok) throw new Error('Download fehlgeschlagen');
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Rechnung_${String(record.invoiceNumber).replace('/', '-')}.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            })
            .catch(() => notify('Fehler beim Herunterladen der Rechnung', { type: 'error' }))
            .finally(() => setDownloading(false));
    };
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
            <span>{record.invoiceNumber}</span>
            <IconButton size="small" onClick={download} disabled={downloading} title="Rechnung herunterladen">
                <DownloadIcon fontSize="small" />
            </IconButton>
        </Box>
    );
};

const BookingShowActions = () => (
    <TopToolbar>
        <ListButton />
    </TopToolbar>
);

const NameTagButton = () => {
    const record = useRecordContext();
    if (!record) return null;
    const download = () => {
        fetch(`/api/bookings/${record.id}/name-tag`, { headers: authHeaders() })
            .then(async (res) => {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Namensschild_${record.shortId || String(record.id).split('-')[0]}.pdf`;
                a.click();
            });
    };
    return (
        <Button startIcon={<BadgeIcon />} onClick={download} variant="outlined" size="small" sx={{ mt: 2 }}>
            Namensschild (PDF)
        </Button>
    );
};

// Editor for one participant row (the main booker, or one of the co-travelers
// in additionalParticipants) - matches the fields the real 3-step booking
// form (EventBookingModal) actually collects: salutation, a single fullName
// (not split first/last), birthDate, sizeWeight.
const ParticipantFields = ({ value, onChange, label }: { value: any; onChange: (v: any) => void; label?: string }) => {
    const setField = (field: string) => (e: any) => onChange({ ...value, [field]: e.target.value });
    return (
        <Box sx={{ mb: 1 }}>
            {label && <Typography variant="caption" color="textSecondary">{label}</Typography>}
            <Grid container spacing={1}>
                <Grid size={{ xs: 4 }}>
                    <FormControl fullWidth margin="dense" size="small">
                        <InputLabel>Anrede</InputLabel>
                        <Select value={value.salutation || 'Bitte wählen'} label="Anrede" onChange={setField('salutation')}>
                            {salutationChoices.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                        </Select>
                    </FormControl>
                </Grid>
                <Grid size={{ xs: 8 }}>
                    <MuiTextField fullWidth margin="dense" size="small" label="Name" value={value.fullName || ''} onChange={setField('fullName')} />
                </Grid>
                <Grid size={{ xs: 6 }}>
                    <MuiTextField fullWidth margin="dense" size="small" label="Geburtsdatum" type="date" slotProps={{ inputLabel: { shrink: true } }} value={formatBirthDateForInput(value.birthDate)} onChange={setField('birthDate')} />
                </Grid>
                <Grid size={{ xs: 6 }}>
                    <MuiTextField fullWidth margin="dense" size="small" label="Größe/Gewicht" value={value.sizeWeight || ''} onChange={setField('sizeWeight')} />
                </Grid>
            </Grid>
        </Box>
    );
};

const AdminActions = () => {
    const record = useRecordContext();
    const notify = useNotify();
    const refresh = useRefresh();
    const [update, { isLoading }] = useUpdate();
    const [status, setStatus] = useState('PENDING');
    const [details, setDetails] = useState<any>({});
    const [participants, setParticipants] = useState<any[]>([]);
    const [customFields, setCustomFields] = useState<Array<{ key: string; value: string }>>([]);
    const [adminComment, setAdminComment] = useState('');
    const [paid, setPaid] = useState(false);
    const [checkedIn, setCheckedIn] = useState(false);
    // Old Matukio's "Benachrichtigungen und Aktualisierungen" card
    // (administrator/components/com_matukio/layouts/booking/edit.php) -
    // one-time actions to run as part of THIS save, not stored fields.
    const [notifyParticipant, setNotifyParticipant] = useState(false);
    const [notifyParticipantInvoice, setNotifyParticipantInvoice] = useState(false);
    const [updateAmount, setUpdateAmount] = useState(false);
    // Old's "Payment details" card: editable ticket-type(s)/quantity,
    // payment method, extra fee option toggles, and a coupon "Apply" field -
    // none of these had any edit control here at all before.
    const [items, setItems] = useState<{ ticketId: string; quantity: number }[]>([]);
    const [paymentMethod, setPaymentMethod] = useState('');
    const [selectedExtras, setSelectedExtras] = useState<Set<number>>(new Set());
    const [voucherCodeInput, setVoucherCodeInput] = useState('');
    const [voucherMessage, setVoucherMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
    const [validatingVoucher, setValidatingVoucher] = useState(false);
    // The customer's own free-text note (old's "Note / Coupon code" field) -
    // distinct from adminComment above, which is admin-only and never shown
    // to the customer.
    const [remarks, setRemarks] = useState('');

    // Old's "General Booking Settings" card - event_id is old's real
    // "modal_event" widget: a read-only display field + a "Veranstaltung
    // auswählen" button that opens a searchable/paginated popup of events
    // (administrator/components/com_matukio/views/dates/tmpl/element.php);
    // userid is old's plain JHTML::list.users select - a flat dropdown of
    // every registered user (309 total here - small enough to load in full,
    // exactly like old's real behavior, unlike events at 1300+ rows which
    // is why old needed a searchable popup for those instead of a select).
    // eventTickets/eventExtraOptions used to be derived straight from
    // record?.event - now held as state so picking a different event can
    // replace them with that event's own tickets/extras.
    const [eventId, setEventId] = useState('');
    const [eventOption, setEventOption] = useState<{ id: string; title: string; startDate: string } | null>(null);
    const [eventDialogOpen, setEventDialogOpen] = useState(false);
    const [eventDialogQuery, setEventDialogQuery] = useState('');
    const [eventDialogResults, setEventDialogResults] = useState<{ id: string; title: string; bookingNumber?: string; startDate: string; endDate: string | null }[]>([]);
    const [eventDialogLoading, setEventDialogLoading] = useState(false);
    const [eventDialogPage, setEventDialogPage] = useState(0);
    const [eventDialogTotal, setEventDialogTotal] = useState(0);
    // Old's real filter_status select (views/dates/tmpl/element.php) has
    // exactly 3 options: "" (Alle Veranstaltungen), "published"
    // (Freigegeben), "unpublished" (Gesperrt) - "current"/"old" aren't
    // reachable from this dropdown at all, they're dead code from the UI's
    // perspective. "" still resolves to status=current server-side (old's
    // own model: empty(status) falls into the same branch as never having
    // picked anything), while published/unpublished drop the date
    // restriction entirely and can show any event ever created.
    const [eventDialogStatus, setEventDialogStatus] = useState<'' | 'published' | 'unpublished'>('');
    const [allUsers, setAllUsers] = useState<{ id: string; name: string; email?: string }[]>([]);
    const [userId, setUserId] = useState('');
    const [eventTickets, setEventTickets] = useState<any[]>([]);
    const [eventExtraOptions, setEventExtraOptions] = useState<any[]>([]);

    const eventOptionLabel = (opt: { title: string; startDate: string }) =>
        `${new Date(opt.startDate).toLocaleDateString('de-DE')} - ${opt.title}`;

    // Loads every registered user once, exactly matching old's plain
    // "Benutzer" select (no search-as-you-type - it's a flat list).
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch('/api/users?_end=500&_sort=name&_order=ASC', { headers: authHeaders() });
                const data = await res.json();
                setAllUsers(Array.isArray(data) ? data.map((u: any) => ({ id: u.id, name: u.name || u.email, email: u.email })) : []);
            } catch {
                setAllUsers([]);
            }
        })();
    }, []);

    // Matches old's real modal list (views/dates/tmpl/element.php +
    // models/dates.php::getListQuery()) - its own default, whenever no
    // status filter has been explicitly picked, is "current"
    // (`r.end > curdate()`, MatukioModelDates::getListQuery()), sorted by
    // begin ascending (soonest first) - NOT every event ever created (that
    // list has 1300+ historical rows; old's own popup showed only 13).
    // 20 per page matches Joomla's own default list limit.
    const EVENT_DIALOG_PAGE_SIZE = 20;
    const eventDialogTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const fetchEventDialogPage = async (query: string, page: number, statusFilter: '' | 'published' | 'unpublished' = eventDialogStatus) => {
        setEventDialogLoading(true);
        try {
            const start = page * EVENT_DIALOG_PAGE_SIZE;
            const qs = query ? `q=${encodeURIComponent(query)}&` : '';
            const statusQs = statusFilter === '' ? 'status=current&' : `published=${statusFilter === 'published'}&`;
            const res = await fetch(`/api/events?${qs}${statusQs}_start=${start}&_end=${start + EVENT_DIALOG_PAGE_SIZE}&_sort=startDate&_order=ASC`);
            const data = await res.json();
            setEventDialogResults(Array.isArray(data) ? data.map((e: any) => ({ id: e.id, title: e.title, bookingNumber: e.bookingNumber, startDate: e.startDate, endDate: e.endDate })) : []);
            const contentRange = res.headers.get('Content-Range');
            const total = contentRange ? Number(contentRange.split('/')[1]) : 0;
            setEventDialogTotal(Number.isFinite(total) ? total : 0);
            setEventDialogPage(page);
        } catch {
            setEventDialogResults([]);
            setEventDialogTotal(0);
        } finally {
            setEventDialogLoading(false);
        }
    };

    const searchEventsForDialog = (query: string) => {
        if (eventDialogTimeoutRef.current) clearTimeout(eventDialogTimeoutRef.current);
        eventDialogTimeoutRef.current = setTimeout(() => fetchEventDialogPage(query, 0), 300);
    };

    const changeEventDialogStatus = (statusFilter: '' | 'published' | 'unpublished') => {
        setEventDialogStatus(statusFilter);
        fetchEventDialogPage(eventDialogQuery, 0, statusFilter);
    };

    const openEventDialog = () => {
        setEventDialogOpen(true);
        setEventDialogQuery('');
        fetchEventDialogPage('', 0);
    };

    // Admin picked a different event in the popup: that event's own
    // tickets/extras replace the current ones, and the booked items are
    // reset to the new event's first ticket - the old items referenced
    // ticket rows that belong to a different event entirely and can't
    // carry over as-is. Matches old's own selectEvent() JS glue (fills the
    // display field + hidden id, closes the modal).
    const handleEventChange = async (newValue: { id: string; title: string; startDate: string } | null) => {
        if (!newValue) return;
        setEventOption(newValue);
        setEventId(newValue.id);
        setEventDialogOpen(false);
        try {
            const res = await fetch(`/api/events/${newValue.id}`);
            const fullEvent = await res.json();
            const newTickets = fullEvent.tickets || [];
            setEventTickets(newTickets);
            setEventExtraOptions(fullEvent.extraFeeOptions || []);
            setItems(newTickets.length > 0 ? [{ ticketId: newTickets[0].id, quantity: 1 }] : []);
            setSelectedExtras(new Set());
        } catch {
            notify('Veranstaltungsdaten konnten nicht geladen werden', { type: 'error' });
        }
    };

    useEffect(() => {
        if (record) {
            setStatus(record.status);
            const d = record.customerDetails || {};
            setDetails(d);
            setParticipants(Array.isArray(d.additionalParticipants) ? d.additionalParticipants : []);
            const cf = d.customFields && typeof d.customFields === 'object' ? d.customFields : {};
            setCustomFields(Object.entries(cf).map(([key, value]) => ({ key, value: String(value ?? '') })));
            setAdminComment(record.adminComment || '');
            setPaid(!!record.paid);
            setCheckedIn(!!record.checkedIn);
            setNotifyParticipant(false);
            setNotifyParticipantInvoice(false);
            setUpdateAmount(false);
            setItems((record.items || []).map((i: any) => ({ ticketId: i.ticketId, quantity: i.quantity })));
            setPaymentMethod(record.paymentMethod || 'Bitte auswählen');
            const options: any[] = record.event?.extraFeeOptions || [];
            const storedExtras = Array.isArray(d.selectedExtras) ? d.selectedExtras : [];
            const matchedIndices = options
                .map((opt, idx) => (storedExtras.some((se: any) => se.title === opt.title) ? idx : -1))
                .filter((idx) => idx >= 0);
            setSelectedExtras(new Set(matchedIndices));
            setVoucherCodeInput(record.voucherCode || '');
            setVoucherMessage(null);
            setRemarks(record.remarks || '');
            setEventId(record.eventId);
            setEventOption(record.event ? { id: record.eventId, title: record.event.title, startDate: record.event.startDate } : null);
            setUserId(record.userId || '');
            setEventTickets(record.event?.tickets || []);
            setEventExtraOptions(record.event?.extraFeeOptions || []);
        }
    }, [record]);

    const handleApplyVoucher = async () => {
        if (!voucherCodeInput.trim() || !record) return;
        setValidatingVoucher(true);
        setVoucherMessage(null);
        try {
            const res = await fetch('/api/vouchers/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: voucherCodeInput.trim(), eventId: record.eventId }),
            });
            const data = await res.json();
            if (res.ok && data.valid) {
                setVoucherMessage({ type: 'success', text: 'Gutschein gültig - wird beim Speichern übernommen. Aktivieren Sie "Betrag aktualisieren", um den Preis anzupassen.' });
            } else {
                setVoucherMessage({ type: 'error', text: data.message || 'Ungültiger Gutschein' });
            }
        } catch {
            setVoucherMessage({ type: 'error', text: 'Fehler bei der Überprüfung des Gutscheins.' });
        } finally {
            setValidatingVoucher(false);
        }
    };

    const toggleExtra = (idx: number) => {
        setSelectedExtras((prev) => {
            const next = new Set(prev);
            if (next.has(idx)) next.delete(idx);
            else next.add(idx);
            return next;
        });
    };

    const updateItem = (idx: number, field: 'ticketId' | 'quantity', value: any) =>
        setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
    const addItem = () => setItems((prev) => [...prev, { ticketId: eventTickets[0]?.id || '', quantity: 1 }]);
    const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

    const handleSave = () => {
        if (!record) return;
        const customFieldsObj: Record<string, string> = {};
        for (const { key, value } of customFields) {
            if (key.trim()) customFieldsObj[key.trim()] = value;
        }
        const selectedExtraObjects = Array.from(selectedExtras)
            .map((idx) => eventExtraOptions[idx])
            .filter(Boolean)
            .map((opt) => ({ title: opt.title, value: opt.value, perPlace: opt.perPlace }));
        const customerDetails = {
            ...details,
            additionalParticipants: participants,
            customFields: customFieldsObj,
            selectedExtras: selectedExtraObjects,
        };
        update(
            'bookings',
            {
                id: record.id,
                data: {
                    status, customerDetails, adminComment, paid, checkedIn,
                    notifyParticipant, notifyParticipantInvoice, updateAmount,
                    items: items.filter((i) => i.ticketId && i.quantity > 0),
                    paymentMethod,
                    voucherCode: voucherCodeInput.trim() || null,
                    remarks,
                    eventId,
                    userId: userId || null,
                },
                previousData: record
            },
            {
                onSuccess: () => {
                    notify('Buchung erfolgreich aktualisiert!', { type: 'success' });
                    refresh();
                },
                onError: (error: any) => notify(`Fehler: ${error.message}`, { type: 'error' })
            }
        );
    };

    const setField = (field: string) => (e: any) => {
        setDetails((prev: any) => ({ ...prev, [field]: e.target.value }));
    };

    const addParticipant = () => setParticipants((prev) => [...prev, { salutation: 'Bitte wählen', fullName: '', birthDate: '', sizeWeight: '' }]);
    const removeParticipant = (idx: number) => setParticipants((prev) => prev.filter((_, i) => i !== idx));
    const updateParticipant = (idx: number, v: any) => setParticipants((prev) => prev.map((p, i) => (i === idx ? v : p)));

    const addCustomField = () => setCustomFields((prev) => [...prev, { key: '', value: '' }]);
    const removeCustomField = (idx: number) => setCustomFields((prev) => prev.filter((_, i) => i !== idx));
    const updateCustomField = (idx: number, field: 'key' | 'value', v: string) =>
        setCustomFields((prev) => prev.map((cf, i) => (i === idx ? { ...cf, [field]: v } : cf)));

    if (!record) return null;

    return (
        <Card elevation={1} sx={{ mt: { xs: 2, md: 0 } }}>
            <CardContent>
                <Typography variant="h6" gutterBottom>Allgemeine Buchungseinstellungen</Typography>

                {/* Old's real "modal_event" widget: a disabled/read-only display
                    field showing the current event's name + date, plus a
                    "Veranstaltung auswählen" button that opens a searchable,
                    paginated popup (old: administrator/components/com_matukio/
                    views/dates/tmpl/element.php) - not an inline dropdown,
                    since old genuinely uses a popup here for exactly this
                    reason: 1300+ events is too many for a flat select. */}
                <Box sx={{ mt: 2, mb: 1 }}>
                    <MuiTextField
                        fullWidth
                        size="small"
                        label="Veranstaltung"
                        value={eventOption ? eventOptionLabel(eventOption) : 'Keine Veranstaltung ausgewählt'}
                        slotProps={{ input: { readOnly: true } }}
                    />
                    <Button variant="contained" onClick={openEventDialog} sx={{ mt: 1 }}>
                        Veranstaltung auswählen
                    </Button>
                </Box>

                <Dialog open={eventDialogOpen} onClose={() => setEventDialogOpen(false)} maxWidth="md" fullWidth>
                    <DialogTitle>Veranstaltung auswählen</DialogTitle>
                    <DialogContent>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                            <MuiTextField
                                fullWidth
                                size="small"
                                autoFocus
                                label="Suche"
                                margin="dense"
                                value={eventDialogQuery}
                                onChange={(e) => { setEventDialogQuery(e.target.value); searchEventsForDialog(e.target.value); }}
                            />
                            <FormControl size="small" margin="dense" sx={{ minWidth: 180 }}>
                                <Select
                                    value={eventDialogStatus}
                                    displayEmpty
                                    onChange={(e) => changeEventDialogStatus(e.target.value as '' | 'published' | 'unpublished')}
                                >
                                    <MenuItem value="">Alle Veranstaltungen</MenuItem>
                                    <MenuItem value="published">Freigegeben</MenuItem>
                                    <MenuItem value="unpublished">Gesperrt</MenuItem>
                                </Select>
                            </FormControl>
                        </Box>
                        {eventDialogLoading ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} /></Box>
                        ) : (
                            <Table size="small">
                                <TableBody>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 'bold' }}>Veranstaltung</TableCell>
                                        <TableCell sx={{ fontWeight: 'bold' }}>Nr.</TableCell>
                                        <TableCell sx={{ fontWeight: 'bold' }}>Beginn</TableCell>
                                        <TableCell sx={{ fontWeight: 'bold' }}>Ende</TableCell>
                                    </TableRow>
                                    {eventDialogResults.length === 0 && (
                                        <TableRow><TableCell colSpan={4}>Keine Veranstaltungen gefunden.</TableCell></TableRow>
                                    )}
                                    {eventDialogResults.map((ev) => (
                                        <TableRow
                                            key={ev.id}
                                            hover
                                            sx={{ cursor: 'pointer' }}
                                            onClick={() => handleEventChange({ id: ev.id, title: ev.title, startDate: ev.startDate })}
                                        >
                                            <TableCell>{ev.title}</TableCell>
                                            <TableCell>{ev.bookingNumber || ''}</TableCell>
                                            <TableCell>{new Date(ev.startDate).toLocaleDateString('de-DE')}</TableCell>
                                            <TableCell>{ev.endDate ? new Date(ev.endDate).toLocaleDateString('de-DE') : ''}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                        {eventDialogTotal > 0 && (
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                                <Typography variant="body2" color="textSecondary">
                                    {eventDialogPage * EVENT_DIALOG_PAGE_SIZE + 1}
                                    –{Math.min((eventDialogPage + 1) * EVENT_DIALOG_PAGE_SIZE, eventDialogTotal)} von {eventDialogTotal}
                                </Typography>
                                <Box>
                                    <Button
                                        size="small"
                                        disabled={eventDialogPage === 0 || eventDialogLoading}
                                        onClick={() => fetchEventDialogPage(eventDialogQuery, eventDialogPage - 1)}
                                    >
                                        Zurück
                                    </Button>
                                    <Button
                                        size="small"
                                        disabled={(eventDialogPage + 1) * EVENT_DIALOG_PAGE_SIZE >= eventDialogTotal || eventDialogLoading}
                                        onClick={() => fetchEventDialogPage(eventDialogQuery, eventDialogPage + 1)}
                                    >
                                        Weiter
                                    </Button>
                                </Box>
                            </Box>
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setEventDialogOpen(false)}>Schließen</Button>
                    </DialogActions>
                </Dialog>

                {/* Old's real "Benutzer" field: JHTML::list.users - a plain
                    flat select of every registered user (309 total here),
                    not search-as-you-type, with a "none" option for a guest
                    booking. */}
                <FormControl fullWidth margin="normal" size="small">
                    <InputLabel>Benutzer</InputLabel>
                    <Select value={userId} onChange={(e) => setUserId(e.target.value)} label="Benutzer">
                        <MenuItem value="">— Gastbuchung (kein Benutzer) —</MenuItem>
                        {allUsers.map((u) => (
                            <MenuItem key={u.id} value={u.id}>{u.name}{u.email ? ` (${u.email})` : ''}</MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" gutterBottom>Verwaltung (Status)</Typography>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                    Hier können Sie den Status der Buchung anpassen, z.B. wenn eine Zahlung per Banküberweisung eingegangen ist.
                </Typography>

                <FormControl fullWidth margin="normal" size="small">
                    <InputLabel>Status</InputLabel>
                    <Select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        label="Status"
                    >
                        <MenuItem value="PENDING">Ausstehend (Pending)</MenuItem>
                        <MenuItem value="CONFIRMED">Bestätigt (Confirmed)</MenuItem>
                        <MenuItem value="WAITLIST">Warteliste (Waitlist)</MenuItem>
                        <MenuItem value="COMPLETED">Abgeschlossen (Completed)</MenuItem>
                        <MenuItem value="CANCELLED">Storniert (Cancelled)</MenuItem>
                    </Select>
                </FormControl>

                <MuiTextField
                    fullWidth margin="normal" size="small" label="Interner Kommentar (nur Admin)" multiline minRows={2}
                    value={adminComment} onChange={(e) => setAdminComment(e.target.value)}
                />

                <Box sx={{ display: 'flex', gap: 2 }}>
                    <FormControlLabel
                        control={<Checkbox checked={paid} onChange={(e) => setPaid(e.target.checked)} />}
                        label="Bezahlt"
                    />
                    <FormControlLabel
                        control={<Checkbox checked={checkedIn} onChange={(e) => setCheckedIn(e.target.checked)} />}
                        label="Eingecheckt"
                    />
                </Box>

                <NameTagButton />

                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" gutterBottom>Zahlungsdetails</Typography>

                {items.map((item, idx) => (
                    <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <MuiTextField
                            select size="small" label="Ticket-Typ" value={item.ticketId}
                            onChange={(e) => updateItem(idx, 'ticketId', e.target.value)}
                            sx={{ flex: 2 }}
                        >
                            {eventTickets.map((t) => (
                                <MenuItem key={t.id} value={t.id}>{t.name} (€ {Number(t.price).toFixed(2)})</MenuItem>
                            ))}
                        </MuiTextField>
                        <MuiTextField
                            type="number" size="small" label="Anzahl" value={item.quantity}
                            onChange={(e) => updateItem(idx, 'quantity', Math.max(1, Number(e.target.value) || 1))}
                            sx={{ width: 90 }}
                            slotProps={{ htmlInput: { min: 1 } }}
                        />
                        {items.length > 1 && (
                            <IconButton size="small" onClick={() => removeItem(idx)}><DeleteIcon fontSize="small" /></IconButton>
                        )}
                    </Box>
                ))}
                {eventTickets.length > 0 && (
                    <Tooltip title="Ticket-Position hinzufügen">
                        <IconButton size="small" onClick={addItem}><AddIcon fontSize="small" /></IconButton>
                    </Tooltip>
                )}

                <FormControl fullWidth margin="dense" size="small">
                    <InputLabel>Zahlungsmethode</InputLabel>
                    <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} label="Zahlungsmethode">
                        <MenuItem value="Bitte auswählen">Bitte auswählen</MenuItem>
                        <MenuItem value="Gutschein">Gutschein</MenuItem>
                        <MenuItem value="Überweisung">Überweisung</MenuItem>
                        <MenuItem value="Barzahlung">Barzahlung vor Ort</MenuItem>
                    </Select>
                </FormControl>

                {eventExtraOptions.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>Zusätzliche Optionen</Typography>
                        {eventExtraOptions.map((opt: any, idx: number) => (
                            <FormControlLabel
                                key={idx}
                                sx={{ display: 'flex' }}
                                control={<Checkbox checked={selectedExtras.has(idx)} onChange={() => toggleExtra(idx)} />}
                                label={`${opt.title} (€ ${Number(opt.value).toFixed(2)}${opt.perPlace ? ' pro Person' : ''})`}
                            />
                        ))}
                    </Box>
                )}

                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                    <MuiTextField
                        size="small" label="Gutscheincode" value={voucherCodeInput}
                        onChange={(e) => setVoucherCodeInput(e.target.value)}
                        sx={{ flex: 1 }}
                    />
                    <Button variant="outlined" size="small" onClick={handleApplyVoucher} disabled={validatingVoucher || !voucherCodeInput.trim()}>
                        {validatingVoucher ? 'Prüfen...' : 'Anwenden'}
                    </Button>
                </Box>
                {voucherMessage && (
                    <Typography variant="caption" sx={{ display: 'block', color: voucherMessage.type === 'error' ? 'error.main' : 'success.main', mt: 0.5 }}>
                        {voucherMessage.text}
                    </Typography>
                )}

                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" gutterBottom>Kundendetails bearbeiten (Hauptbucher)</Typography>
                <ParticipantFields value={details} onChange={setDetails} />
                <MuiTextField fullWidth margin="dense" size="small" label="E-Mail" value={details.email || ''} onChange={setField('email')} />
                <MuiTextField fullWidth margin="dense" size="small" label="Telefon" value={details.phone || ''} onChange={setField('phone')} />
                <MuiTextField fullWidth margin="dense" size="small" label="Straße" value={details.street || ''} onChange={setField('street')} />
                <MuiTextField fullWidth margin="dense" size="small" label="PLZ" value={details.zip || ''} onChange={setField('zip')} />
                <MuiTextField fullWidth margin="dense" size="small" label="Stadt" value={details.city || ''} onChange={setField('city')} />
                <MuiTextField fullWidth margin="dense" size="small" label="Land (optional)" value={details.country || ''} onChange={setField('country')} />
                <MuiTextField
                    fullWidth margin="dense" size="small" label="Anmerkung des Kunden" multiline minRows={2}
                    value={remarks} onChange={(e) => setRemarks(e.target.value)}
                />

                <Divider sx={{ my: 2 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle2" gutterBottom>Weitere Teilnehmer</Typography>
                    <Tooltip title="Teilnehmer hinzufügen">
                        <IconButton size="small" onClick={addParticipant}><AddIcon fontSize="small" /></IconButton>
                    </Tooltip>
                </Box>
                {participants.length === 0 && (
                    <Typography variant="body2" color="textSecondary">Keine weiteren Teilnehmer.</Typography>
                )}
                {participants.map((p, idx) => (
                    <Box key={idx} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, border: '1px solid #eee', borderRadius: 1, p: 1, mb: 1 }}>
                        <Box sx={{ flexGrow: 1 }}>
                            <ParticipantFields value={p} onChange={(v) => updateParticipant(idx, v)} label={`Teilnehmer ${idx + 2}`} />
                        </Box>
                        <IconButton size="small" onClick={() => removeParticipant(idx)}><DeleteIcon fontSize="small" /></IconButton>
                    </Box>
                ))}

                <Divider sx={{ my: 2 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle2" gutterBottom>Zusätzliche Formularfelder</Typography>
                    <Tooltip title="Feld hinzufügen">
                        <IconButton size="small" onClick={addCustomField}><AddIcon fontSize="small" /></IconButton>
                    </Tooltip>
                </Box>
                {customFields.length === 0 && (
                    <Typography variant="body2" color="textSecondary">Keine zusätzlichen Felder.</Typography>
                )}
                {customFields.map((cf, idx) => (
                    <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <MuiTextField margin="dense" size="small" label="Feldname" value={cf.key} onChange={(e) => updateCustomField(idx, 'key', e.target.value)} sx={{ flex: 1 }} />
                        <MuiTextField margin="dense" size="small" label="Wert" value={cf.value} onChange={(e) => updateCustomField(idx, 'value', e.target.value)} sx={{ flex: 1 }} />
                        <IconButton size="small" onClick={() => removeCustomField(idx)}><DeleteIcon fontSize="small" /></IconButton>
                    </Box>
                ))}

                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" gutterBottom>Benachrichtigungen und Aktualisierungen</Typography>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                    Wird beim Speichern einmalig ausgeführt - keine gespeicherten Einstellungen.
                </Typography>
                <FormControlLabel
                    control={<Checkbox checked={notifyParticipant} onChange={(e) => setNotifyParticipant(e.target.checked)} />}
                    label="Teilnehmer per E-Mail benachrichtigen (Buchungsbestätigung)"
                />
                <br />
                <FormControlLabel
                    control={<Checkbox checked={notifyParticipantInvoice} onChange={(e) => setNotifyParticipantInvoice(e.target.checked)} />}
                    label="Teilnehmer benachrichtigen inkl. Rechnung/Ticket"
                />
                <br />
                <FormControlLabel
                    control={<Checkbox checked={updateAmount} onChange={(e) => setUpdateAmount(e.target.checked)} />}
                    label="Betrag aktualisieren (aus aktuellen Tickets/Gutschein neu berechnen)"
                />

                <Box sx={{ mt: 2 }}>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handleSave}
                        disabled={isLoading}
                        fullWidth
                    >
                        Speichern
                    </Button>
                </Box>
            </CardContent>
        </Card>
    );
};

const CustomBookingDetails = () => {
    const record = useRecordContext();
    if (!record) return null;

    return (
        <Box sx={{ p: 3, width: '100%' }}>
            <Typography variant="h6" gutterBottom>Buchungsdetails</Typography>
            <Grid container spacing={3}>
                {/* Old's real layout (administrator/components/com_matukio/
                    layouts/booking/edit.php): the wide left column is the
                    editable booking/customer-detail form, the narrow right
                    column is Information/Payment/Notifications - the
                    opposite of how this was originally built here. `order`
                    swaps them visually without moving this large block of
                    read-only fields below. */}
                <Grid size={{ xs: 12, sm: 4 }} sx={{ order: 2 }}>
                    <Paper elevation={1}>
                        <Table sx={{ tableLayout: 'fixed' }}>
                            <TableBody>
                        <TableRow>
                            <TableCell component="th" scope="row" style={{ fontWeight: 'bold', width: '30%' }}>ID</TableCell>
                            <TableCell>{record.id}</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell component="th" scope="row" style={{ fontWeight: 'bold' }}>Benutzer ID</TableCell>
                            <TableCell>{record.userId}</TableCell>
                        </TableRow>
                        {record.event && (
                            <>
                                <TableRow>
                                    <TableCell component="th" scope="row" style={{ fontWeight: 'bold' }}>Event</TableCell>
                                    <TableCell>
                                        <strong>{record.event.title}</strong>
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell component="th" scope="row" style={{ fontWeight: 'bold' }}>Kategorie</TableCell>
                                    <TableCell>{record.event.category}</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell component="th" scope="row" style={{ fontWeight: 'bold' }}>Datum</TableCell>
                                    <TableCell>
                                        {new Date(record.event.startDate).toLocaleDateString('de-DE')}
                                        {record.event.endDate && ` - ${new Date(record.event.endDate).toLocaleDateString('de-DE')}`}
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell component="th" scope="row" style={{ fontWeight: 'bold' }}>Ort</TableCell>
                                    <TableCell>{record.event.location || '-'}</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell component="th" scope="row" style={{ fontWeight: 'bold' }}>Veranstalter</TableCell>
                                    <TableCell>{record.event.organizer || '-'}</TableCell>
                                </TableRow>
                            </>
                        )}
                        {!record.event && (
                            <TableRow>
                                <TableCell component="th" scope="row" style={{ fontWeight: 'bold' }}>Event ID</TableCell>
                                <TableCell>{record.eventId}</TableCell>
                            </TableRow>
                        )}
                        <TableRow>
                            <TableCell component="th" scope="row" style={{ fontWeight: 'bold' }}>Status</TableCell>
                            <TableCell>{record.status}{record.checkedIn ? ' (eingecheckt)' : ''}</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell component="th" scope="row" style={{ fontWeight: 'bold' }}>Bezahlt</TableCell>
                            <TableCell>{record.paid ? 'Ja' : 'Nein'}</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell component="th" scope="row" style={{ fontWeight: 'bold' }}>Zertifikat</TableCell>
                            <TableCell>{record.certificated ? 'Ausgestellt' : 'Nicht ausgestellt'}</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell component="th" scope="row" style={{ fontWeight: 'bold' }}>Gesamtpreis</TableCell>
                            <TableCell>
                                {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(record.totalPrice || 0)}
                                {/* Net/tax split frozen at booking time (see bookingPrice.ts) -
                                    only shown when the event actually had a tax rate configured,
                                    matching old Matukio's payment_netto/_tax invoice breakdown. */}
                                {record.priceNet != null && record.priceTax != null && (
                                    <span style={{ color: '#666', fontSize: '0.85em', marginLeft: 8 }}>
                                        (netto {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(record.priceNet)}
                                        {' '}+ {record.priceTaxRatePercent}% MwSt.{' '}
                                        {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(record.priceTax)})
                                    </span>
                                )}
                            </TableCell>
                        </TableRow>
                        {record.voucherCode && (
                            <TableRow>
                                <TableCell component="th" scope="row" style={{ fontWeight: 'bold' }}>Gutschein-Code</TableCell>
                                <TableCell>{record.voucherCode}</TableCell>
                            </TableRow>
                        )}
                        <TableRow>
                            <TableCell component="th" scope="row" style={{ fontWeight: 'bold' }}>Zahlungsart</TableCell>
                            <TableCell>{record.paymentMethod}</TableCell>
                        </TableRow>
                        {record.paymentGatewayResponse && (
                            <TableRow>
                                <TableCell component="th" scope="row" style={{ fontWeight: 'bold', verticalAlign: 'top' }}>Zahlungsanbieter-Antwort</TableCell>
                                <TableCell>
                                    <details>
                                        <summary style={{ cursor: 'pointer', color: '#428bca' }}>Rohdaten anzeigen (für Rückerstattungen/Reklamationen)</summary>
                                        <pre style={{ fontSize: '0.75em', whiteSpace: 'pre-wrap', wordBreak: 'break-all', marginTop: 8 }}>
                                            {JSON.stringify(record.paymentGatewayResponse, null, 2)}
                                        </pre>
                                    </details>
                                </TableCell>
                            </TableRow>
                        )}
                        <TableRow>
                            <TableCell component="th" scope="row" style={{ fontWeight: 'bold' }}>Erstellt am</TableCell>
                            <TableCell>{new Date(record.createdAt).toLocaleString('de-DE')}</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell component="th" scope="row" style={{ fontWeight: 'bold' }}>Bemerkungen (Kunde)</TableCell>
                            <TableCell>{record.remarks || '-'}</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell component="th" scope="row" style={{ fontWeight: 'bold' }}>Interner Kommentar</TableCell>
                            <TableCell>{record.adminComment || '-'}</TableCell>
                        </TableRow>

                        {record.customerDetails && (
                            <TableRow>
                                <TableCell component="th" scope="row" style={{ fontWeight: 'bold' }}>Hauptbucher</TableCell>
                                <TableCell>
                                    {record.customerDetails.salutation && record.customerDetails.salutation !== 'Bitte wählen' ? `${record.customerDetails.salutation} ` : ''}
                                    {record.customerDetails.fullName || `${record.customerDetails.firstName || ''} ${record.customerDetails.lastName || ''}`.trim() || record.customerDetails.name}<br />
                                    {record.customerDetails.birthDate && <>Geburtsdatum: {formatBirthDateDisplay(record.customerDetails.birthDate)}<br /></>}
                                    {record.customerDetails.sizeWeight && <>Größe/Gewicht: {record.customerDetails.sizeWeight}<br /></>}
                                    {record.customerDetails.street}<br />
                                    {record.customerDetails.zip} {record.customerDetails.city}<br />
                                    {record.customerDetails.country && <>{record.customerDetails.country}<br /></>}
                                    E-Mail: {record.customerDetails.email}<br />
                                    Tel: {record.customerDetails.phone}
                                </TableCell>
                            </TableRow>
                        )}

                        {Array.isArray(record.customerDetails?.additionalParticipants) && record.customerDetails.additionalParticipants.length > 0 && (
                            <TableRow>
                                <TableCell component="th" scope="row" style={{ fontWeight: 'bold' }}>Weitere Teilnehmer</TableCell>
                                <TableCell>
                                    <ul style={{ margin: 0, paddingLeft: '20px' }}>
                                        {record.customerDetails.additionalParticipants.map((p: any, idx: number) => (
                                            <li key={idx}>
                                                {p.salutation && p.salutation !== 'Bitte wählen' ? `${p.salutation} ` : ''}{p.fullName}
                                                {p.birthDate ? ` — geb. ${formatBirthDateDisplay(p.birthDate)}` : ''}
                                                {p.sizeWeight ? ` — ${p.sizeWeight}` : ''}
                                            </li>
                                        ))}
                                    </ul>
                                </TableCell>
                            </TableRow>
                        )}

                        {record.customerDetails?.customFields && typeof record.customerDetails.customFields === 'object' && Object.keys(record.customerDetails.customFields).length > 0 && (
                            <TableRow>
                                <TableCell component="th" scope="row" style={{ fontWeight: 'bold' }}>Zusätzliche Formularfelder</TableCell>
                                <TableCell>
                                    <ul style={{ margin: 0, paddingLeft: '20px' }}>
                                        {Object.entries(record.customerDetails.customFields).map(([key, value]: [string, any]) => (
                                            <li key={key}><strong>{key}:</strong> {String(value)}</li>
                                        ))}
                                    </ul>
                                </TableCell>
                            </TableRow>
                        )}

                        {record.items && record.items.length > 0 && (
                            <TableRow>
                                <TableCell component="th" scope="row" style={{ fontWeight: 'bold' }}>Gekaufte Tickets</TableCell>
                                <TableCell>
                                    <ul style={{ margin: 0, paddingLeft: '20px' }}>
                                        {record.items.map((item: any) => (
                                            <li key={item.id}>
                                                <strong>{item.quantity}x</strong> {item.ticket?.name}
                                                {item.ticket?.price ? ` (à €${item.ticket.price.toFixed(2)})` : ''}
                                            </li>
                                        ))}
                                    </ul>
                                </TableCell>
                            </TableRow>
                        )}
                                            </TableBody>
                        </Table>
                    </Paper>
                </Grid>
                <Grid size={{ xs: 12, sm: 8 }} sx={{ order: 1 }}>
                    <AdminActions />
                </Grid>
            </Grid>
        </Box>
    );
};

export const BookingShow = () => (
  <Show actions={<BookingShowActions />}>
      <CustomBookingDetails />
  </Show>
);