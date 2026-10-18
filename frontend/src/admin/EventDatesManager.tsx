import { Fragment, useEffect, useState } from 'react';
import { useRecordContext, useNotify, useRefresh } from 'react-admin';
import { useNavigate } from 'react-router-dom';
import {
    Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField as MuiTextField,
    ToggleButtonGroup, ToggleButton, Checkbox, FormControlLabel, Chip, IconButton, Tooltip,
    Table, TableHead, TableRow, TableCell, TableBody, Radio, RadioGroup, FormControl, FormLabel,
    Typography, CircularProgress, Switch, Select, MenuItem, InputLabel
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import BlockIcon from '@mui/icons-material/Block';
import RestoreIcon from '@mui/icons-material/Restore';
import AddIcon from '@mui/icons-material/Add';
import EventRepeatIcon from '@mui/icons-material/EventRepeat';
import { DATE_STATUS_COLORS } from './matukioStyle';

const API = '/api';

// Left-border accent color matching old Matukio's date-green/date-canceled/
// date-past/date-unpublished status classes.
function dateStatusColor(d: any): string {
    if (d.cancelled) return DATE_STATUS_COLORS.cancelled;
    if (!d.published) return DATE_STATUS_COLORS.unpublished;
    if (new Date(d.startDate) < new Date()) return DATE_STATUS_COLORS.past;
    return DATE_STATUS_COLORS.active;
}

const FILTERS: { id: string; label: string }[] = [
    { id: 'all', label: 'Alle' },
    { id: 'current', label: 'Aktuell' },
    { id: 'past', label: 'Vergangen' },
    { id: 'today', label: 'Heute' },
    { id: 'week', label: 'Diese Woche' },
    { id: 'month', label: 'Dieser Monat' },
    { id: 'year', label: 'Dieses Jahr' },
    { id: 'cancelled', label: 'Storniert' },
];

const WEEKDAYS = [
    { id: 1, label: 'Mo' }, { id: 2, label: 'Di' }, { id: 3, label: 'Mi' }, { id: 4, label: 'Do' },
    { id: 5, label: 'Fr' }, { id: 6, label: 'Sa' }, { id: 0, label: 'So' },
];

function authHeaders() {
    const token = localStorage.getItem('auth');
    return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function toLocalInput(value?: string | null) {
    if (!value) return '';
    const d = new Date(value);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toTimeInput(value?: string | null, fallback = '09:00') {
    if (!value) return fallback;
    const d = new Date(value);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toDateInput(value?: string | null) {
    if (!value) return '';
    const d = new Date(value);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const EventDatesManager = () => {
    const record = useRecordContext();
    const notify = useNotify();
    const refresh = useRefresh();
    const navigate = useNavigate();

    const [filter, setFilter] = useState('all');
    const [dates, setDates] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [addOpen, setAddOpen] = useState(false);
    const [recurOpen, setRecurOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    const [addForm, setAddForm] = useState({
        startDate: '', endDate: '', registrationDeadline: '',
        titleOverride: '', capacityOverride: '', locationOverride: '', bookingNumber: ''
    });

    const [recurForm, setRecurForm] = useState({
        type: 'weeks' as 'days' | 'weeks' | 'months' | 'years',
        weekdays: [] as number[],
        startDate: '',
        endMode: 'count' as 'date' | 'count',
        endDate: '',
        count: 4,
        interval: 1,
        beginTime: '09:00',
        endTime: '17:00',
        bookingDeadlineTime: ''
    });
    const [previewDates, setPreviewDates] = useState<string[] | null>(null);
    const [previewing, setPreviewing] = useState(false);

    // Inline "Bearbeiten" panel - opens directly under the clicked row
    // (not a full navigation/page reload like before, and not a modal) with
    // old Matukio's real per-date fields (allday/showbegin/showend/
    // showbooked - administrator/components/com_matukio/models/events.php)
    // plus a real venue picker (old's real override_place_id dropdown,
    // administrator/.../views/date/tmpl/default.php - a free-text field
    // here before). "Zusätzliche Tage" has no old equivalent (checked - no
    // "additional day" concept anywhere in com_matukio) - a new capability
    // for a date that meets on extra non-contiguous days.
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingRecord, setEditingRecord] = useState<any>(null);
    const [editSaving, setEditSaving] = useState(false);
    const [locations, setLocations] = useState<{ id: string; title: string }[]>([]);
    const [editForm, setEditForm] = useState({
        startDate: '', endDate: '', registrationDeadline: '',
        showStartTime: true, showEndTime: true, showRegistrationDeadline: true,
        allDay: false,
        showAdditionalDays: false,
        additionalDays: [] as { date: string; startTime: string; endTime: string }[],
        bookingNumber: '', titleOverride: '', maxParticipants: '', locationId: '',
    });

    useEffect(() => {
        fetch(`${API}/locations?_end=1000`, { headers: authHeaders() })
            .then((res) => (res.ok ? res.json() : []))
            .then((data) => setLocations(Array.isArray(data) ? data : []))
            .catch(() => {});
    }, []);

    const openEditRow = (d: any) => {
        if (editingId === d.id) { setEditingId(null); setEditingRecord(null); return; }
        setEditForm({
            startDate: toLocalInput(d.startDate),
            endDate: toLocalInput(d.endDate),
            registrationDeadline: toLocalInput(d.registrationDeadline),
            showStartTime: d.showStartTime !== false,
            showEndTime: d.showEndTime !== false,
            showRegistrationDeadline: d.showRegistrationDeadline !== false,
            allDay: !!d.allDay,
            showAdditionalDays: Array.isArray(d.additionalDays) && d.additionalDays.length > 0,
            additionalDays: Array.isArray(d.additionalDays) ? d.additionalDays : [],
            bookingNumber: d.bookingNumber || '',
            titleOverride: d.titleOverride || '',
            maxParticipants: d.maxParticipants != null ? String(d.maxParticipants) : '',
            locationId: d.locationId || '',
        });
        setEditingRecord(d);
        setEditingId(d.id);
    };

    const addAdditionalDay = () => {
        setEditForm((f) => ({ ...f, additionalDays: [...f.additionalDays, { date: '', startTime: '09:00', endTime: '17:00' }] }));
    };
    const updateAdditionalDay = (index: number, key: 'date' | 'startTime' | 'endTime', value: string) => {
        setEditForm((f) => ({ ...f, additionalDays: f.additionalDays.map((d, i) => (i === index ? { ...d, [key]: value } : d)) }));
    };
    const removeAdditionalDay = (index: number) => {
        setEditForm((f) => ({ ...f, additionalDays: f.additionalDays.filter((_, i) => i !== index) }));
    };

    const saveEditRow = async () => {
        if (!editingId || !editingRecord) return;
        if (!editForm.startDate) { notify('Bitte ein Startdatum angeben', { type: 'warning' }); return; }
        setEditSaving(true);
        try {
            // PUT /api/events/:id applies prisma.event.update({data}), which
            // is a true partial update - any column simply left out of the
            // payload is untouched. The only fields the route handler itself
            // defaults when absent are capacity/maxParticipants/
            // minParticipants/maxBookablePerPerson/feePerPerson, so those are
            // passed through unchanged from editingRecord. Everything else
            // (title, description, categoryId, organizerId, ...) is
            // deliberately omitted rather than spread from editingRecord:
            // categoryId in particular is a relation-backed scalar that this
            // Prisma client rejects outright in an update() payload
            // ("Unknown argument `categoryId`"), and omitting the rest is
            // both safer (can't blank out fields this form never shows) and
            // avoids that error entirely.
            const payload = {
                capacity: editingRecord.capacity,
                minParticipants: editingRecord.minParticipants,
                maxBookablePerPerson: editingRecord.maxBookablePerPerson,
                feePerPerson: editingRecord.feePerPerson,
                startDate: new Date(editForm.startDate).toISOString(),
                endDate: editForm.endDate ? new Date(editForm.endDate).toISOString() : null,
                registrationDeadline: editForm.registrationDeadline ? new Date(editForm.registrationDeadline).toISOString() : null,
                showStartTime: editForm.showStartTime,
                showEndTime: editForm.showEndTime,
                showRegistrationDeadline: editForm.showRegistrationDeadline,
                allDay: editForm.allDay,
                additionalDays: editForm.showAdditionalDays ? editForm.additionalDays.filter((d) => d.date) : [],
                bookingNumber: editForm.bookingNumber || null,
                titleOverride: editForm.titleOverride || null,
                maxParticipants: editForm.maxParticipants ? Number(editForm.maxParticipants) : null,
                locationId: editForm.locationId || null,
            };
            const res = await fetch(`${API}/events/${editingId}`, {
                method: 'PUT',
                headers: authHeaders(),
                body: JSON.stringify(payload),
            });
            if (res.ok) {
                notify('Termin aktualisiert', { type: 'success' });
                setEditingId(null);
                setEditingRecord(null);
                loadDates();
                refresh();
            } else {
                notify('Fehler beim Speichern', { type: 'error' });
            }
        } finally {
            setEditSaving(false);
        }
    };

    const seriesId = record?.seriesId;

    const loadDates = async () => {
        if (!seriesId) { setDates([]); return; }
        setLoading(true);
        try {
            const res = await fetch(`${API}/events/series/${seriesId}?filter=${filter}`, { headers: authHeaders() });
            if (res.ok) setDates(await res.json());
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDates();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [seriesId, filter]);

    if (!record) return null;

    if (!record.id) {
        return (
            <Box sx={{ border: 1, borderColor: 'divider', p: 2 }}>
                <Typography variant="body2" color="text.secondary">
                    Weitere Termine (Serientermine) können hinzugefügt werden, nachdem diese Veranstaltung gespeichert wurde.
                </Typography>
            </Box>
        );
    }

    const openAddDialog = () => {
        setAddForm({
            startDate: toLocalInput(record.startDate),
            endDate: toLocalInput(record.endDate),
            registrationDeadline: toLocalInput(record.registrationDeadline),
            titleOverride: '', capacityOverride: '', locationOverride: '', bookingNumber: ''
        });
        setAddOpen(true);
    };

    const openRecurDialog = () => {
        setRecurForm({
            type: 'weeks',
            weekdays: [],
            startDate: toDateInput(record.startDate) || toDateInput(new Date().toISOString()),
            endMode: 'count',
            endDate: '',
            count: 4,
            interval: 1,
            beginTime: toTimeInput(record.startDate, '09:00'),
            endTime: toTimeInput(record.endDate, '17:00'),
            bookingDeadlineTime: ''
        });
        setPreviewDates(null);
        setRecurOpen(true);
    };

    const submitAddDate = async () => {
        if (!addForm.startDate) { notify('Bitte ein Startdatum angeben', { type: 'warning' }); return; }
        setSaving(true);
        try {
            const res = await fetch(`${API}/events/${record.id}/add-date`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({
                    startDate: new Date(addForm.startDate).toISOString(),
                    endDate: addForm.endDate ? new Date(addForm.endDate).toISOString() : null,
                    registrationDeadline: addForm.registrationDeadline ? new Date(addForm.registrationDeadline).toISOString() : null,
                    titleOverride: addForm.titleOverride || undefined,
                    capacityOverride: addForm.capacityOverride || undefined,
                    locationOverride: addForm.locationOverride || undefined,
                    bookingNumber: addForm.bookingNumber || undefined
                })
            });
            if (res.ok) {
                notify('Termin hinzugefügt', { type: 'success' });
                setAddOpen(false);
                loadDates();
                refresh();
            } else {
                notify('Fehler beim Hinzufügen des Termins', { type: 'error' });
            }
        } finally {
            setSaving(false);
        }
    };

    const buildRecurrencePayload = () => ({
        recurrence: {
            type: recurForm.type,
            weekdays: recurForm.weekdays,
            startDate: recurForm.startDate,
            endMode: recurForm.endMode,
            endDate: recurForm.endMode === 'date' ? recurForm.endDate : undefined,
            count: recurForm.endMode === 'count' ? Number(recurForm.count) : undefined,
            interval: Number(recurForm.interval) || 1
        },
        beginTime: recurForm.beginTime,
        endTime: recurForm.endTime,
        bookingDeadlineTime: recurForm.bookingDeadlineTime || undefined
    });

    const previewRecurring = async () => {
        if (!recurForm.startDate) { notify('Bitte ein Startdatum angeben', { type: 'warning' }); return; }
        if (recurForm.endMode === 'date' && !recurForm.endDate) { notify('Bitte ein Enddatum angeben', { type: 'warning' }); return; }
        setPreviewing(true);
        try {
            const res = await fetch(`${API}/events/${record.id}/add-recurring-dates?preview=true`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify(buildRecurrencePayload())
            });
            if (res.ok) {
                const data = await res.json();
                setPreviewDates(data.dates);
            } else {
                const err = await res.json().catch(() => ({}));
                notify(err.message || 'Fehler bei der Vorschau', { type: 'error' });
            }
        } finally {
            setPreviewing(false);
        }
    };

    const submitRecurring = async () => {
        if (!recurForm.startDate) { notify('Bitte ein Startdatum angeben', { type: 'warning' }); return; }
        if (recurForm.endMode === 'date' && !recurForm.endDate) { notify('Bitte ein Enddatum angeben', { type: 'warning' }); return; }
        setSaving(true);
        try {
            const res = await fetch(`${API}/events/${record.id}/add-recurring-dates`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify(buildRecurrencePayload())
            });
            if (res.ok) {
                const data = await res.json();
                notify(`${data.count} Termine erzeugt`, { type: 'success' });
                setRecurOpen(false);
                loadDates();
                refresh();
            } else {
                const err = await res.json().catch(() => ({}));
                notify(err.message || 'Fehler beim Erzeugen der Termine', { type: 'error' });
            }
        } finally {
            setSaving(false);
        }
    };

    const togglePublish = async (id: string) => {
        try {
            const res = await fetch(`${API}/events/${id}/toggle-publish`, { method: 'PATCH', headers: authHeaders() });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            loadDates();
        } catch (err) {
            console.error(err);
            notify('Fehler beim Ändern des Veröffentlichungsstatus', { type: 'error' });
        }
    };

    const toggleCancel = async (id: string) => {
        try {
            const res = await fetch(`${API}/events/${id}/toggle-cancel`, { method: 'PATCH', headers: authHeaders() });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            loadDates();
        } catch (err) {
            console.error(err);
            notify('Fehler beim Ändern des Stornierungsstatus', { type: 'error' });
        }
    };

    const deleteDate = async (id: string) => {
        if (!window.confirm('Diesen Termin wirklich unwiderruflich löschen?')) return;
        await fetch(`${API}/events/${id}`, { method: 'DELETE', headers: authHeaders() });
        loadDates();
    };

    const toggleWeekday = (id: number) => {
        setRecurForm(f => ({
            ...f,
            weekdays: f.weekdays.includes(id) ? f.weekdays.filter(w => w !== id) : [...f.weekdays, id]
        }));
    };

    return (
        <Box sx={{ width: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {FILTERS.map(f => (
                        <Chip
                            key={f.id}
                            label={f.label}
                            color={filter === f.id ? 'primary' : 'default'}
                            onClick={() => setFilter(f.id)}
                            size="small"
                        />
                    ))}
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={openAddDialog}>
                        Termin hinzufügen
                    </Button>
                    <Button size="small" variant="outlined" startIcon={<EventRepeatIcon />} onClick={openRecurDialog}>
                        Serientermine generieren
                    </Button>
                </Box>
            </Box>

            {loading ? (
                <CircularProgress size={24} />
            ) : !seriesId ? (
                <Typography variant="body2" color="text.secondary">
                    Diese Veranstaltung gehört noch zu keiner Terminserie. Fügen Sie einen weiteren Termin hinzu, um eine Serie zu erstellen.
                </Typography>
            ) : dates.length === 0 ? (
                <Typography variant="body2" color="text.secondary">Keine Termine für diesen Filter gefunden.</Typography>
            ) : (
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Nummer</TableCell>
                            <TableCell>Beginn / Ende / Anmeldeschluss</TableCell>
                            <TableCell>Titel</TableCell>
                            <TableCell>Ort</TableCell>
                            <TableCell align="right">Kapazität</TableCell>
                            <TableCell align="right">Buchungen</TableCell>
                            <TableCell align="right">Aufrufe</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell align="right">Aktionen</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {dates.map((d) => (
                          <Fragment key={d.id}>
                            <TableRow
                                selected={d.id === record.id}
                                hover
                                sx={{ borderLeft: `3px solid ${dateStatusColor(d)}` }}
                            >
                                <TableCell>{d.bookingNumber || '-'}</TableCell>
                                <TableCell>
                                    {/* Old's per-date card (layouts/event/edit/dates.php) shows
                                        Beginn/Ende/Anmeldeschluss as three separate lines - stacked
                                        here in one cell instead of three new columns so the
                                        already-cramped table doesn't get wider. */}
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, minWidth: 220 }}>
                                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                                            <Typography variant="caption" color="text.secondary" sx={{ width: 112, flexShrink: 0, whiteSpace: 'nowrap' }}>Beginn:</Typography>
                                            <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>{new Date(d.startDate).toLocaleString('de-DE')}</Typography>
                                        </Box>
                                        {d.endDate && (
                                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                                                <Typography variant="caption" color="text.secondary" sx={{ width: 112, flexShrink: 0, whiteSpace: 'nowrap' }}>Ende:</Typography>
                                                <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>{new Date(d.endDate).toLocaleString('de-DE')}</Typography>
                                            </Box>
                                        )}
                                        {d.registrationDeadline && (
                                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                                                <Typography variant="caption" color="text.secondary" sx={{ width: 112, flexShrink: 0, whiteSpace: 'nowrap' }}>Anmeldeschluss:</Typography>
                                                <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>{new Date(d.registrationDeadline).toLocaleString('de-DE')}</Typography>
                                            </Box>
                                        )}
                                    </Box>
                                </TableCell>
                                <TableCell>{d.titleOverride || d.title}</TableCell>
                                <TableCell sx={{ maxWidth: 160 }}>
                                    <Tooltip title={d.location || ''}>
                                        <Box
                                            sx={{
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {d.location || '-'}
                                        </Box>
                                    </Tooltip>
                                </TableCell>
                                <TableCell align="right">{d.capacity}</TableCell>
                                <TableCell align="right">
                                    <Tooltip title="Buchungen dieses Termins ansehen">
                                        <Box
                                            component="span"
                                            onClick={() => navigate(`/admin/bookings?filter=${encodeURIComponent(JSON.stringify({ eventId: d.id }))}`)}
                                            sx={{ cursor: 'pointer', color: 'primary.main', textDecoration: 'underline' }}
                                        >
                                            {d.bookingsCount}
                                        </Box>
                                    </Tooltip>
                                </TableCell>
                                <TableCell align="right">{d.views ?? 0}</TableCell>
                                <TableCell>
                                    {d.cancelled && <Chip label="Storniert" color="error" size="small" sx={{ mr: 0.5 }} />}
                                    <Chip label={d.published ? 'Veröffentlicht' : 'Versteckt'} color={d.published ? 'success' : 'default'} size="small" />
                                </TableCell>
                                <TableCell align="right">
                                  <Box sx={{ display: 'flex', flexWrap: 'nowrap', justifyContent: 'flex-end', alignItems: 'center', gap: 0.25 }}>
                                    <Tooltip title="Bearbeiten">
                                        <IconButton size="small" onClick={() => openEditRow(d)}>
                                            <EditIcon fontSize="small" color={editingId === d.id ? 'primary' : 'inherit'} />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title={d.published ? 'Verstecken' : 'Veröffentlichen'}>
                                        <IconButton size="small" onClick={() => togglePublish(d.id)}>
                                            {d.published ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title={d.cancelled ? 'Reaktivieren' : 'Stornieren'}>
                                        <IconButton size="small" onClick={() => toggleCancel(d.id)}>
                                            {d.cancelled ? <RestoreIcon fontSize="small" /> : <BlockIcon fontSize="small" />}
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Löschen">
                                        <IconButton size="small" onClick={() => deleteDate(d.id)}>
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                  </Box>
                                </TableCell>
                            </TableRow>
                            {editingId === d.id && (
                                <TableRow>
                                    <TableCell colSpan={9} sx={{ bgcolor: '#fafafa', p: 2 }}>
                                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                                <MuiTextField
                                                    label="Beginn" type="datetime-local" size="small" required
                                                    value={editForm.startDate}
                                                    onChange={(e) => setEditForm((f) => ({ ...f, startDate: e.target.value }))}
                                                    slotProps={{ inputLabel: { shrink: true } }}
                                                />
                                                <FormControlLabel
                                                    control={<Switch size="small" checked={editForm.showStartTime} onChange={(e) => setEditForm((f) => ({ ...f, showStartTime: e.target.checked }))} />}
                                                    label="Anzeigen"
                                                />
                                            </Box>
                                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                                <MuiTextField
                                                    label="Ende" type="datetime-local" size="small"
                                                    value={editForm.endDate}
                                                    onChange={(e) => setEditForm((f) => ({ ...f, endDate: e.target.value }))}
                                                    slotProps={{ inputLabel: { shrink: true } }}
                                                />
                                                <FormControlLabel
                                                    control={<Switch size="small" checked={editForm.showEndTime} onChange={(e) => setEditForm((f) => ({ ...f, showEndTime: e.target.checked }))} />}
                                                    label="Anzeigen"
                                                />
                                            </Box>
                                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                                <MuiTextField
                                                    label="Anmeldeschluss" type="datetime-local" size="small"
                                                    value={editForm.registrationDeadline}
                                                    onChange={(e) => setEditForm((f) => ({ ...f, registrationDeadline: e.target.value }))}
                                                    slotProps={{ inputLabel: { shrink: true } }}
                                                />
                                                <FormControlLabel
                                                    control={<Switch size="small" checked={editForm.showRegistrationDeadline} onChange={(e) => setEditForm((f) => ({ ...f, showRegistrationDeadline: e.target.checked }))} />}
                                                    label="Anzeigen"
                                                />
                                            </Box>
                                        </Box>

                                        <FormControlLabel
                                            sx={{ mt: 1 }}
                                            control={<Switch size="small" checked={editForm.allDay} onChange={(e) => setEditForm((f) => ({ ...f, allDay: e.target.checked }))} />}
                                            label="Nicht festgelegte Zeit oder den ganzen Tag"
                                        />

                                        <Box sx={{ mt: 1 }}>
                                            {!editForm.showAdditionalDays ? (
                                                <Button size="small" onClick={() => setEditForm((f) => ({ ...f, showAdditionalDays: true }))}>
                                                    + Zusätzliche Tage
                                                </Button>
                                            ) : (
                                                <Box>
                                                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Zusätzliche Tage</Typography>
                                                    {editForm.additionalDays.map((day, i) => (
                                                        <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.5 }}>
                                                            <MuiTextField
                                                                label="Datum" type="date" size="small"
                                                                value={day.date}
                                                                onChange={(e) => updateAdditionalDay(i, 'date', e.target.value)}
                                                                slotProps={{ inputLabel: { shrink: true } }}
                                                            />
                                                            <MuiTextField
                                                                label="Von" type="time" size="small"
                                                                value={day.startTime}
                                                                onChange={(e) => updateAdditionalDay(i, 'startTime', e.target.value)}
                                                                slotProps={{ inputLabel: { shrink: true } }}
                                                            />
                                                            <MuiTextField
                                                                label="Bis" type="time" size="small"
                                                                value={day.endTime}
                                                                onChange={(e) => updateAdditionalDay(i, 'endTime', e.target.value)}
                                                                slotProps={{ inputLabel: { shrink: true } }}
                                                            />
                                                            <IconButton size="small" onClick={() => removeAdditionalDay(i)}>
                                                                <DeleteIcon fontSize="small" />
                                                            </IconButton>
                                                        </Box>
                                                    ))}
                                                    <Button size="small" onClick={addAdditionalDay}>+ Tag hinzufügen</Button>
                                                </Box>
                                            )}
                                        </Box>

                                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2 }}>
                                            <MuiTextField
                                                label="Nummer" size="small"
                                                helperText="Veranstaltungs-Nummer, z.B. 5/26 (Optional)"
                                                value={editForm.bookingNumber}
                                                onChange={(e) => setEditForm((f) => ({ ...f, bookingNumber: e.target.value }))}
                                            />
                                            <MuiTextField
                                                label="Titel Überschreibung" size="small"
                                                helperText="Hier können Sie den Titel für diesen Termin überschreiben"
                                                value={editForm.titleOverride}
                                                onChange={(e) => setEditForm((f) => ({ ...f, titleOverride: e.target.value }))}
                                            />
                                            <MuiTextField
                                                label="Max. Anzahl Teilnehmer" type="number" size="small"
                                                helperText="Hier können Sie die maximale Anzahl an Teilnehmern für diese Veranstaltung überschreiben"
                                                value={editForm.maxParticipants}
                                                onChange={(e) => setEditForm((f) => ({ ...f, maxParticipants: e.target.value }))}
                                            />
                                            <FormControl size="small" sx={{ minWidth: 220 }}>
                                                <InputLabel id={`loc-${d.id}`}>Veranstaltungsort</InputLabel>
                                                <Select
                                                    labelId={`loc-${d.id}`}
                                                    label="Veranstaltungsort"
                                                    value={editForm.locationId}
                                                    onChange={(e) => setEditForm((f) => ({ ...f, locationId: e.target.value as string }))}
                                                >
                                                    <MenuItem value="">
                                                        <em>Standard-Veranstaltungsort der Veranstaltung</em>
                                                    </MenuItem>
                                                    {locations.map((loc) => (
                                                        <MenuItem key={loc.id} value={loc.id}>{loc.title}</MenuItem>
                                                    ))}
                                                </Select>
                                            </FormControl>
                                        </Box>

                                        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                                            <Button onClick={() => { setEditingId(null); setEditingRecord(null); }}>Abbrechen</Button>
                                            <Button variant="contained" onClick={saveEditRow} disabled={editSaving}>Speichern</Button>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            )}
                          </Fragment>
                        ))}
                    </TableBody>
                </Table>
            )}

            {/* Einzelnen Termin hinzufügen */}
            <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Termin hinzufügen</DialogTitle>
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                    <MuiTextField
                        label="Beginn" type="datetime-local" fullWidth required
                        value={addForm.startDate}
                        onChange={e => setAddForm(f => ({ ...f, startDate: e.target.value }))}
                        slotProps={{ inputLabel: { shrink: true } }}
                    />
                    <MuiTextField
                        label="Ende" type="datetime-local" fullWidth
                        value={addForm.endDate}
                        onChange={e => setAddForm(f => ({ ...f, endDate: e.target.value }))}
                        slotProps={{ inputLabel: { shrink: true } }}
                    />
                    <MuiTextField
                        label="Anmeldeschluss" type="datetime-local" fullWidth
                        value={addForm.registrationDeadline}
                        onChange={e => setAddForm(f => ({ ...f, registrationDeadline: e.target.value }))}
                        slotProps={{ inputLabel: { shrink: true } }}
                    />
                    <MuiTextField
                        label="Titel überschreiben (optional)" fullWidth
                        value={addForm.titleOverride}
                        onChange={e => setAddForm(f => ({ ...f, titleOverride: e.target.value }))}
                    />
                    <MuiTextField
                        label="Kapazität überschreiben (optional)" type="number" fullWidth
                        value={addForm.capacityOverride}
                        onChange={e => setAddForm(f => ({ ...f, capacityOverride: e.target.value }))}
                    />
                    <MuiTextField
                        label="Ort überschreiben (optional)" fullWidth
                        value={addForm.locationOverride}
                        onChange={e => setAddForm(f => ({ ...f, locationOverride: e.target.value }))}
                    />
                    <MuiTextField
                        label="Nummer (optional)" fullWidth
                        helperText="Veranstaltungs-Nummer für diesen Termin, z.B. 5/26"
                        value={addForm.bookingNumber}
                        onChange={e => setAddForm(f => ({ ...f, bookingNumber: e.target.value }))}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setAddOpen(false)}>Abbrechen</Button>
                    <Button variant="contained" onClick={submitAddDate} disabled={saving}>Speichern</Button>
                </DialogActions>
            </Dialog>

            {/* Serientermine generieren */}
            <Dialog open={recurOpen} onClose={() => setRecurOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Serientermine generieren</DialogTitle>
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                    <FormControl>
                        <FormLabel>Wiederholung</FormLabel>
                        <ToggleButtonGroup
                            exclusive size="small" value={recurForm.type}
                            onChange={(_, v) => v && setRecurForm(f => ({ ...f, type: v }))}
                        >
                            <ToggleButton value="days">Täglich</ToggleButton>
                            <ToggleButton value="weeks">Wöchentlich</ToggleButton>
                            <ToggleButton value="months">Monatlich</ToggleButton>
                            <ToggleButton value="years">Jährlich</ToggleButton>
                        </ToggleButtonGroup>
                    </FormControl>

                    <MuiTextField
                        label={`Alle X ${{ days: 'Tage', weeks: 'Wochen', months: 'Monate', years: 'Jahre' }[recurForm.type]}`}
                        type="number" fullWidth
                        slotProps={{ htmlInput: { min: 1 } }}
                        value={recurForm.interval}
                        onChange={e => { setRecurForm(f => ({ ...f, interval: Number(e.target.value) })); setPreviewDates(null); }}
                        helperText="Abstand zwischen den Terminen, z.B. 2 = jede zweite Woche"
                    />

                    {(recurForm.type === 'weeks' || recurForm.type === 'months') && (
                        <FormControl>
                            <FormLabel>Wochentage</FormLabel>
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                                {WEEKDAYS.map(w => (
                                    <FormControlLabel
                                        key={w.id}
                                        control={<Checkbox size="small" checked={recurForm.weekdays.includes(w.id)} onChange={() => toggleWeekday(w.id)} />}
                                        label={w.label}
                                    />
                                ))}
                            </Box>
                        </FormControl>
                    )}

                    <MuiTextField
                        label="Startdatum" type="date" fullWidth required
                        value={recurForm.startDate}
                        onChange={e => setRecurForm(f => ({ ...f, startDate: e.target.value }))}
                        slotProps={{ inputLabel: { shrink: true } }}
                        helperText="Der erste generierte Termin liegt nach diesem Datum"
                    />

                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <MuiTextField
                            label="Beginnzeit" type="time" fullWidth
                            value={recurForm.beginTime}
                            onChange={e => setRecurForm(f => ({ ...f, beginTime: e.target.value }))}
                            slotProps={{ inputLabel: { shrink: true } }}
                        />
                        <MuiTextField
                            label="Endzeit" type="time" fullWidth
                            value={recurForm.endTime}
                            onChange={e => setRecurForm(f => ({ ...f, endTime: e.target.value }))}
                            slotProps={{ inputLabel: { shrink: true } }}
                        />
                    </Box>

                    <MuiTextField
                        label="Anmeldeschluss-Zeit (optional, gleicher Tag)" type="time" fullWidth
                        value={recurForm.bookingDeadlineTime}
                        onChange={e => setRecurForm(f => ({ ...f, bookingDeadlineTime: e.target.value }))}
                        slotProps={{ inputLabel: { shrink: true } }}
                    />

                    <FormControl>
                        <FormLabel>Endet</FormLabel>
                        <RadioGroup
                            row value={recurForm.endMode}
                            onChange={e => setRecurForm(f => ({ ...f, endMode: e.target.value as 'date' | 'count' }))}
                        >
                            <FormControlLabel value="count" control={<Radio size="small" />} label="Nach Anzahl" />
                            <FormControlLabel value="date" control={<Radio size="small" />} label="Am Datum" />
                        </RadioGroup>
                    </FormControl>

                    {recurForm.endMode === 'count' ? (
                        <MuiTextField
                            label="Anzahl Termine" type="number" fullWidth
                            value={recurForm.count}
                            onChange={e => setRecurForm(f => ({ ...f, count: Number(e.target.value) }))}
                        />
                    ) : (
                        <MuiTextField
                            label="Enddatum" type="date" fullWidth
                            value={recurForm.endDate}
                            onChange={e => setRecurForm(f => ({ ...f, endDate: e.target.value }))}
                            slotProps={{ inputLabel: { shrink: true } }}
                        />
                    )}

                    {/* Old Matukio's batch-generation step shows the actual
                        resulting date list before anything is committed -
                        this mirrors that with a dedicated preview call. */}
                    <Button variant="outlined" onClick={previewRecurring} disabled={previewing} sx={{ alignSelf: 'flex-start' }}>
                        {previewing ? 'Lädt Vorschau...' : 'Vorschau anzeigen'}
                    </Button>
                    {previewDates && (
                        <Box sx={{ border: 1, borderColor: 'divider', p: 1.5, maxHeight: 180, overflowY: 'auto' }}>
                            <Typography variant="body2" sx={{ mb: 1 }}>{previewDates.length} Termine werden erzeugt:</Typography>
                            <Typography variant="body2" color="text.secondary">
                                {previewDates.map(d => new Date(`${d}T00:00:00`).toLocaleDateString('de-DE')).join(', ')}
                            </Typography>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRecurOpen(false)}>Abbrechen</Button>
                    <Button variant="contained" onClick={submitRecurring} disabled={saving}>Termine erzeugen</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};
