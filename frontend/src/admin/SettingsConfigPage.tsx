import React, { useState, useEffect } from 'react';
import { useNotify } from 'react-admin';
import {
    Box,
    Card,
    CardContent,
    Typography,
    TextField,
    Button,
    Switch,
    FormControlLabel,
    Alert,
    Divider,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import { isSessionExpiredError } from './sessionExpiry';

// Consolidated admin control for the subset of old Matukio's real
// "Settings" page (JComponentHelper::getParams('com_matukio'), 165 keys)
// that a full admin audit found actually has a real, non-default effect on
// this site and no equivalent anywhere in the new app yet. The rest of
// old's settings were confirmed either dead (cron jobs all disabled on the
// real site), already-correct-and-hardcoded (CSV export charset/separator),
// or covered by an existing dedicated page (AGB legal text).
export const SettingsConfigPage = () => {
    const notify = useNotify();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [loadError, setLoadError] = useState(false);
    const [sessionExpired, setSessionExpired] = useState(false);
    const [form, setForm] = useState<any>({});

    const load = () => {
        setLoadError(false);
        fetch('/api/settingsConfig', {
            headers: { Authorization: `Bearer ${localStorage.getItem('auth')}` },
        })
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then((data) => {
                setForm(data);
                setLoading(false);
            })
            .catch((err) => {
                console.error(err);
                notify('Fehler beim Laden der Einstellungen', { type: 'error' });
                setSessionExpired(isSessionExpiredError(err)); setLoadError(true);
                setLoading(false);
            });
    };

    useEffect(load, [notify]);

    const set = (key: string) => (value: any) => setForm((prev: any) => ({ ...prev, [key]: value }));

    const handleSave = () => {
        setSaving(true);
        fetch('/api/settingsConfig', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${localStorage.getItem('auth')}`,
            },
            body: JSON.stringify(form),
        })
            .then(async (res) => {
                if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Speichern fehlgeschlagen');
                return res.json();
            })
            .then((data) => {
                setForm(data);
                notify('Einstellungen erfolgreich gespeichert', { type: 'success' });
                setSaving(false);
            })
            .catch((err) => {
                console.error(err);
                notify(err.message || 'Fehler beim Speichern', { type: 'error' });
                setSaving(false);
            });
    };

    if (loading) return <Box sx={{ p: 3 }}><Typography>Lade...</Typography></Box>;

    if (loadError) {
        return (
            <Box sx={{ p: 3 }}>
                {sessionExpired ? (
          <Alert severity="warning" action={<Button color="inherit" size="small" href="/admin/login">Erneut einloggen</Button>}>
            Ihre Sitzung ist abgelaufen. Bitte loggen Sie sich erneut ein.
          </Alert>
        ) : (
          <Alert severity="error" action={<Button color="inherit" size="small" onClick={load}>Erneut versuchen</Button>}>
                    Einstellungen konnten nicht geladen werden.
                </Alert>
        )}
            </Box>
        );
    }

    return (
        <Card sx={{ mt: 2, mb: 4, borderRadius: 2 }}>
            <Box sx={{ p: 2, bgcolor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0' }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
                    ⚙️ Einstellungen
                </Typography>
                <Button variant="contained" color="success" startIcon={<SaveIcon />} onClick={handleSave} disabled={saving} sx={{ textTransform: 'none', px: 3 }}>
                    Speichern
                </Button>
            </Box>

            <CardContent sx={{ p: 4 }}>
                <Box sx={{ maxWidth: 700 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>E-Mail-Benachrichtigungen</Typography>
                    <FormControlLabel
                        control={<Switch checked={!!form.sendmailTeilnehmer} onChange={(e) => set('sendmailTeilnehmer')(e.target.checked)} />}
                        label="Buchungsbestätigung an den Kunden senden"
                    />
                    <br />
                    <FormControlLabel
                        control={<Switch checked={!!form.notifyParticipantsPublish} onChange={(e) => set('notifyParticipantsPublish')(e.target.checked)} />}
                        label="Teilnehmer benachrichtigen, wenn eine Veranstaltung veröffentlicht wird"
                    />
                    <br />
                    <FormControlLabel
                        control={<Switch checked={!!form.notifyParticipantsCancel} onChange={(e) => set('notifyParticipantsCancel')(e.target.checked)} />}
                        label="Teilnehmer benachrichtigen, wenn eine Buchung storniert wird"
                    />
                    <br />
                    <FormControlLabel
                        control={<Switch checked={!!form.notifyParticipantsDelete} onChange={(e) => set('notifyParticipantsDelete')(e.target.checked)} />}
                        label="Teilnehmer benachrichtigen, wenn eine Veranstaltung gelöscht wird"
                    />
                    <br />
                    <FormControlLabel
                        control={<Switch checked={!!form.sendmailNewEventGroup} onChange={(e) => set('sendmailNewEventGroup')(e.target.checked)} />}
                        label="Neue Veranstaltung an registrierte Kunden melden"
                    />
                    <br />
                    <FormControlLabel
                        control={<Switch checked={!!form.sendmailInvoice} onChange={(e) => set('sendmailInvoice')(e.target.checked)} />}
                        label="Rechnung an die Buchungsbestätigung anhängen"
                    />
                    <br />
                    <FormControlLabel
                        control={<Switch checked={!!form.sendmailTicket} onChange={(e) => set('sendmailTicket')(e.target.checked)} />}
                        label="Ticket an die Buchungsbestätigung anhängen"
                    />
                    <br />
                    <FormControlLabel
                        control={<Switch checked={!!form.sendmailCertificate} onChange={(e) => set('sendmailCertificate')(e.target.checked)} />}
                        label="Zertifikat per E-Mail versenden"
                    />

                    <Divider sx={{ my: 3 }} />

                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>Kopie an die Flugschule</Typography>
                    <FormControlLabel
                        control={<Switch checked={!!form.sendmailOwner} onChange={(e) => set('sendmailOwner')(e.target.checked)} />}
                        label="Bei jeder neuen Buchung eine Kopie an die Flugschule senden"
                    />
                    <TextField
                        label="E-Mail-Adresse für Buchungskopien"
                        fullWidth
                        value={form.ownerNotificationEmail || ''}
                        onChange={(e) => set('ownerNotificationEmail')(e.target.value)}
                        sx={{ mt: 2 }}
                        disabled={!form.sendmailOwner}
                    />
                    <TextField
                        label="E-Mail BCC (bei jeder ausgehenden E-Mail)"
                        fullWidth
                        value={form.emailBcc || ''}
                        onChange={(e) => set('emailBcc')(e.target.value)}
                        helperText="Alte Matukio-Einstellung: sendmail_operator. Erhält eine BCC-Kopie jeder Buchungsbestätigung, Kopie-an-Flugschule, Neue-Veranstaltung- und Stornierungs-E-Mail."
                        sx={{ mt: 2 }}
                    />

                    <Divider sx={{ my: 3 }} />

                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>Buchung &amp; Zahlung</Typography>
                    <TextField
                        label="Zahlungs-/Stornofrist (Tage vor Kursbeginn)"
                        type="number"
                        fullWidth
                        value={form.bookingStornotage ?? 28}
                        onChange={(e) => set('bookingStornotage')(Number(e.target.value))}
                        helperText="Alte Matukio-Einstellung: booking_stornotage. Entspricht der Zahlungsfrist in der Buchungsbestätigungs-E-Mail (Vorlagen)."
                        sx={{ mb: 3 }}
                    />
                    <TextField
                        label="Standard-Betreff für Buchungsablehnungen"
                        fullWidth
                        value={form.rejectionSubject || ''}
                        onChange={(e) => set('rejectionSubject')(e.target.value)}
                        helperText="Wird als Vorschlag im 'Ablehnen'-Dialog der Buchungsliste verwendet."
                    />

                    <Divider sx={{ my: 3 }} />

                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>Website im Aufbau ("Coming soon")</Typography>
                    <Alert severity="info" sx={{ mb: 2 }}>
                        Solange aktiv, sehen neue Besucher auf allen öffentlichen Seiten eine Passwort-Seite statt der echten Website.
                        Das Admin-Panel (Login) bleibt davon unberührt erreichbar.
                    </Alert>
                    <FormControlLabel
                        control={<Switch checked={!!form.maintenanceModeEnabled} onChange={(e) => set('maintenanceModeEnabled')(e.target.checked)} />}
                        label="Website für neue Besucher sperren"
                    />
                    <TextField
                        label="Passwort für den Testzugang"
                        fullWidth
                        value={form.maintenancePassword || ''}
                        onChange={(e) => set('maintenancePassword')(e.target.value)}
                        helperText="Wer dieses Passwort eingibt, sieht die echte Website (im selben Browser gespeichert, 30 Tage gültig). Das Ändern des Passworts macht alle zuvor freigeschalteten Browser ungültig."
                        sx={{ mt: 2 }}
                    />
                </Box>
            </CardContent>
        </Card>
    );
};
