import React, { useState, useEffect } from 'react';
import { formatBirthDateDisplay } from '../../utils/birthDate';

interface Ticket {
  id: string;
  name: string;
  price: number;
  description: string;
}

interface EventBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: any;
  initialQuantities?: Record<string, number>;
}

// The 9 standard registration fields (old Matukio's "Standard Booking
// Form" admin capability - hiron_matukio_bookingform_field, formId=1,
// used in ~99% of all historical bookings, per this session's earlier
// migration audit). Label text, required/optional and field order are
// admin-configurable via Buchungs-Formular > BookingFormConfig; this is
// the fallback used if that config can't be loaded, and also defines
// which field ids are recognized (an admin can reorder/relabel/require
// these, but adding a genuinely new field belongs in the separate,
// already-working Benutzerdefinierte Felder system instead - this form
// doesn't have a mechanism for a brand new field's data to reach the
// booking record).
const STANDARD_FIELD_DEFS: { id: string; type: string; label: string; required: boolean }[] = [
  { id: 'salutation', type: 'select', label: 'Anrede', required: true },
  { id: 'fullName', type: 'text', label: 'Vorname Nachname', required: true },
  { id: 'birthDate', type: 'text', label: 'Geburtsdatum', required: true },
  { id: 'sizeWeight', type: 'text', label: 'Größe in cm / Gewicht in kg', required: true },
  { id: 'phone', type: 'text', label: 'Telefon / Mobil', required: true },
  { id: 'email', type: 'email', label: 'E-Mail', required: true },
  { id: 'street', type: 'text', label: 'Straße', required: true },
  { id: 'zip', type: 'text', label: 'Postleitzahl', required: true },
  { id: 'city', type: 'text', label: 'Ort', required: true },
];

export const EventBookingModal: React.FC<EventBookingModalProps> = ({ isOpen, onClose, event, initialQuantities = {} }) => {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [agbAccepted, setAgbAccepted] = useState(false);
  const [newsletterOptIn, setNewsletterOptIn] = useState(false);
  const [bookingId, setBookingId] = useState('');
  const [bookingStatus, setBookingStatus] = useState('PENDING');
  
  const [formData, setFormData] = useState({
    salutation: 'Bitte wählen',
    fullName: '',
    birthDate: '',
    sizeWeight: '',
    phone: '',
    email: '',
    street: '',
    zip: '',
    city: '',
    remarks: '',
    paymentMethod: 'Bitte auswählen'
  });

  const [customFields, setCustomFields] = useState<any[]>([]);
  const [dynamicFormData, setDynamicFormData] = useState<Record<string, any>>({});
  const [participants, setParticipants] = useState<any[]>([]);
  const [standardFields, setStandardFields] = useState(STANDARD_FIELD_DEFS);

  // Old Matukio's real "Additional Selectable Fee Options" - flat bolt-on
  // add-ons (e.g. a hotel room) the customer opts into themselves, on top
  // of whichever ticket they already picked.
  const [selectedExtras, setSelectedExtras] = useState<Set<number>>(new Set());

  const [voucherCode, setVoucherCode] = useState('');
  const [voucherDiscount, setVoucherDiscount] = useState<{ amount: number, isPercentage: boolean } | null>(null);
  const [voucherMessage, setVoucherMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);
  const [validatingVoucher, setValidatingVoucher] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      
      // Calculate initial price to see if it's free
      let initialPrice = 0;
      let totalQty = 0;
      if (event?.tickets) {
        Object.entries(initialQuantities).forEach(([ticketId, qty]) => {
          const ticket = event.tickets.find((t: Ticket) => t.id === ticketId);
          initialPrice += (ticket ? ticket.price * qty : 0);
          totalQty += qty;
        });
      }

      // Initialize participants array (if totalQty > 1, create empty objects for additional participants)
      const initialParticipants = Array.from({ length: Math.max(0, totalQty - 1) }).map(() => ({
        salutation: 'Bitte wählen',
        fullName: '',
        birthDate: '',
        sizeWeight: '',
      }));
      setParticipants(initialParticipants);

      setFormData({
        salutation: 'Bitte wählen',
        fullName: '',
        birthDate: '',
        sizeWeight: '',
        phone: '',
        email: '',
        street: '',
        zip: '',
        city: '',
        remarks: '',
        paymentMethod: initialPrice === 0 ? 'Kostenlos' : 'Bitte auswählen'
      });
      setDynamicFormData({});
      setVoucherCode('');
      setVoucherDiscount(null);
      setVoucherMessage(null);

      // Pre-fill the booker's own contact fields from their saved profile
      // (Mein Profil / /api/auth/me) when logged in, so a returning
      // customer doesn't have to retype name/address/phone/etc. every
      // booking - salutation and sizeWeight aren't collected on the
      // profile page, so those stay blank regardless. Runs after the
      // blank reset above, not instead of it, so each fresh open still
      // starts clean before layering in profile data once the fetch
      // resolves (no flash of a PREVIOUS booking's leftover values).
      const token = localStorage.getItem('token');
      if (token) {
        fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
          .then(res => (res.ok ? res.json() : null))
          .then(user => {
            if (!user) return;
            setFormData(prev => ({
              ...prev,
              fullName: user.name || prev.fullName,
              birthDate: user.birthDate ? formatBirthDateDisplay(user.birthDate) : prev.birthDate,
              phone: user.phone || prev.phone,
              email: user.email || prev.email,
              street: user.address1 || prev.street,
              zip: user.postalCode || prev.zip,
              city: user.location || prev.city,
            }));
          })
          .catch(() => {});
      }

      // Fetch custom fields
      fetch('/api/customFields/public')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            // Filter fields relevant to this event category
            const relevantFields = data.filter(field => {
              if (field.whenToShow === 'none') return false;
              if (field.categoryIds) {
                const cats = field.categoryIds.split(',').map((c: string) => c.trim().toLowerCase());
                if (event?.category && !cats.includes(event.category.toLowerCase())) {
                  return false;
                }
              }
              return true;
            });
            setCustomFields(relevantFields);
            
            // Initialize dynamic form data with default values
            const initialDynamicData: Record<string, any> = {};
            relevantFields.forEach(field => {
              initialDynamicData[field.slug] = field.defaultValue || (field.fieldType === 'checkbox' ? false : '');
            });
            setDynamicFormData(initialDynamicData);
          }
        })
        .catch(err => console.error("Failed to load custom fields", err));

      // Admin-configurable standard-field labels/required/order (Buchungs-
      // Formular). Only trust it if it actually contains recognized field
      // ids - anything else (empty, malformed, a genuinely new field id
      // with no data-path to reach the booking) falls back to the
      // hardcoded defaults above rather than silently dropping fields.
      // formId: old's real per-event "Individuelles Buchungsformular"
      // override (Event.customBookingFormId) - falls back to the site
      // default server-side if this event has none set.
      fetch(`/api/bookingFormConfig/public${event.customBookingFormId ? `?formId=${event.customBookingFormId}` : ''}`)
        .then(res => res.json())
        .then(config => {
          const step = config?.steps?.find((s: any) => s.id === 'step-1') || config?.steps?.[0];
          const knownIds = new Set(STANDARD_FIELD_DEFS.map(f => f.id));
          const fields = Array.isArray(step?.fields) ? step.fields.filter((f: any) => knownIds.has(f.id)) : [];
          if (fields.length > 0) setStandardFields(fields);
        })
        .catch(err => console.error("Failed to load booking form config, using defaults", err));
    }
  }, [isOpen, event, initialQuantities]);

  if (!isOpen || !event) return null;

  const totalPrice = Object.entries(initialQuantities).reduce((total, [ticketId, qty]) => {
    const ticket = event.tickets?.find((t: Ticket) => t.id === ticketId);
    return total + (ticket ? ticket.price * qty : 0);
  }, 0);

  const totalTickets = Object.values(initialQuantities).reduce((a, b) => a + b, 0);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Preview only - the server independently recomputes this from scratch and
  // never trusts what the client sends, this just lets the customer see the
  // adjustment before submitting. Matukio's different_fees_override supports
  // both a discount (isDiscount: true, price cut) and a surcharge
  // (isDiscount: false, e.g. a "Premium Paket" upgrade costing MORE than the
  // base fee) - see administrator/components/com_matukio/helpers/fees.php's
  // getDifferentFeeValue() in the old codebase, which adds the value when
  // discount is falsy. Both directions must be honored, not just discounts.
  const isRegisteredUser = !!localStorage.getItem('token');
  const applicableTieredFee = (() => {
    if (!event.tieredFees || !Array.isArray(event.eventTieredFees)) return null;
    const now = new Date();
    return event.eventTieredFees.find((fee: any) => {
      if (!fee) return false;
      if (fee.bookableFor === 'registered' && !isRegisteredUser) return false;
      if (fee.validFrom && now < new Date(fee.validFrom)) return false;
      if (fee.validUntil && now > new Date(fee.validUntil)) return false;
      return true;
    }) || null;
  })();

  // BUG FIX: matches the server's own bookingPrice.ts fix - old applies an
  // ABSOLUTE-value tiered fee PER SEAT (each booked ticket independently
  // gets its own fees +/- value), so a group's real total scales as
  // N x value, not a single flat value regardless of ticket count. A
  // PERCENTAGE-based fee needs no such scaling (already linear against the
  // total). Without this, the preview shown here would undercharge/
  // overcharge and disagree with what the server actually bills.
  const tieredFeeQuantityScale = applicableTieredFee?.isPercentage ? 1 : Math.max(1, totalTickets);
  const priceAfterTieredFee = applicableTieredFee ? Math.max(0,
    applicableTieredFee.isPercentage
      ? (applicableTieredFee.isDiscount
        ? totalPrice * (1 - Number(applicableTieredFee.value) / 100)
        : totalPrice * (1 + Number(applicableTieredFee.value) / 100))
      : (applicableTieredFee.isDiscount
        ? totalPrice - Number(applicableTieredFee.value) * tieredFeeQuantityScale
        : totalPrice + Number(applicableTieredFee.value) * tieredFeeQuantityScale)
  ) : totalPrice;

  const extrasTotal = (event.extraFeeOptions || []).reduce((sum: number, opt: any, i: number) => {
    if (!selectedExtras.has(i)) return sum;
    return sum + (opt.perPlace ? Number(opt.value) * totalTickets : Number(opt.value));
  }, 0);
  const priceAfterExtras = priceAfterTieredFee + extrasTotal;

  const finalPrice = Math.max(0, voucherDiscount ? (
    voucherDiscount.isPercentage
      ? priceAfterExtras * (1 - voucherDiscount.amount / 100)
      : priceAfterExtras - voucherDiscount.amount
  ) : priceAfterExtras);

  const toggleExtra = (index: number) => {
    setSelectedExtras(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleValidateVoucher = async () => {
    if (!voucherCode.trim()) {
      setVoucherMessage({ type: 'error', text: 'Bitte geben Sie einen Gutscheincode ein.' });
      return;
    }
    
    setValidatingVoucher(true);
    setVoucherMessage(null);

    try {
      const res = await fetch('/api/vouchers/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: voucherCode.trim(), eventId: event.id })
      });
      const data = await res.json();
      
      if (res.ok && data.valid) {
        setVoucherDiscount({ amount: data.value, isPercentage: data.isPercentage });
        setVoucherMessage({ type: 'success', text: `Gutschein erfolgreich angewendet!` });
        
        // Auto select 'Gutschein' as payment method if the total becomes 0
        if (!data.isPercentage && data.value >= totalPrice) {
            setFormData(prev => ({ ...prev, paymentMethod: 'Gutschein' }));
        }
      } else {
        setVoucherDiscount(null);
        setVoucherMessage({ type: 'error', text: data.message || 'Ungültiger Gutschein' });
      }
    } catch (error) {
      setVoucherDiscount(null);
      setVoucherMessage({ type: 'error', text: 'Fehler bei der Überprüfung des Gutscheins.' });
    } finally {
      setValidatingVoucher(false);
    }
  };

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      const missingRequiredField = standardFields.some((field) => {
        if (!field.required) return false;
        const value = (formData as any)[field.id];
        return field.id === 'salutation' ? value === 'Bitte wählen' : !value;
      });
      if (missingRequiredField) {
        alert("Bitte füllen Sie alle Pflichtfelder aus.");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (formData.paymentMethod === 'Bitte auswählen') {
        alert("Bitte wählen Sie eine Zahlungsmethode aus.");
        return;
      }
      setStep(3);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    const items = Object.entries(initialQuantities)
      .filter(([_, qty]) => qty > 0)
      .map(([ticketId, qty]) => ({ ticketId, quantity: qty }));

    try {
      const selectedExtraOptions = Array.from(selectedExtras);
      const payload = {
        eventId: event.id,
        items,
        totalPrice: finalPrice,
        voucherCode: voucherDiscount ? voucherCode : undefined,
        selectedExtraOptions,
        customerDetails: {
          salutation: formData.salutation,
          fullName: formData.fullName,
          birthDate: formData.birthDate,
          sizeWeight: formData.sizeWeight,
          phone: formData.phone,
          email: formData.email,
          street: formData.street,
          zip: formData.zip,
          city: formData.city,
          additionalParticipants: participants,
          customFields: dynamicFormData,
          selectedExtras: selectedExtraOptions.map(i => event.extraFeeOptions?.[i]).filter(Boolean),
          newsletterOptIn
        },
        paymentMethod: formData.paymentMethod,
        remarks: formData.remarks
      };

      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();

        setBookingId(data.id.split('-')[0].toUpperCase()); // Shortened display ID
        setBookingStatus(data.status);
        setStep(4);
      } else {
        const errData = await res.json();
        alert("Fehler bei der Buchung: " + (errData.message || "Bitte versuchen Sie es später erneut."));
      }
    } catch (error) {
      alert("Fehler bei der Buchung. Bitte überprüfen Sie Ihre Verbindung.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white max-w-4xl w-full rounded-sm shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header matching the event details style */}
        <div className="bg-white border-b border-gray-200 p-6 flex justify-between items-start relative">
          <div>
            <h2 className="font-luxury text-3xl text-luxury-dark mb-2 tracking-wide uppercase">{event.title}</h2>
            <div className="flex items-center gap-2 text-gray-500 text-sm font-semibold">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
              {new Date(event.start || event.startDate).toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit' })}
              {event.end && event.end !== event.start ? ` bis ${new Date(event.end || event.endDate).toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit' })}` : ''}
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-luxury-dark transition-colors text-3xl leading-none"
            title="Schließen"
          >
            &times;
          </button>
        </div>

        {/* Progress Bar */}
        <div className="bg-gray-50 px-8 py-6 border-b border-gray-200">
          <div className="flex items-center justify-between relative max-w-2xl mx-auto">
            {/* Connecting Line */}
            <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-gray-200 -z-10 -translate-y-1/2"></div>
            <div className={`absolute top-1/2 left-0 h-[2px] bg-luxury-gold -z-10 -translate-y-1/2 transition-all duration-500`} style={{ width: step === 1 ? '0%' : step === 2 ? '50%' : '100%' }}></div>

            {/* Steps */}
            {[
              { num: 1, label: 'Anmeldung' },
              { num: 2, label: 'Bezahlung' },
              { num: 3, label: 'Buchung' }
            ].map(s => (
              <div key={s.num} className="flex flex-col items-center bg-gray-50 px-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm mb-2 transition-colors duration-300 ${
                  step === s.num || (step === 4 && s.num === 3) ? 'bg-luxury-gold text-white' : (step > s.num ? 'bg-gray-800 text-white' : 'bg-gray-300 text-gray-500')
                }`}>
                  {s.num}
                </div>
                <span className={`text-sm ${step >= s.num ? 'text-luxury-dark font-semibold' : 'text-gray-500'}`}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="p-8 overflow-y-auto flex-1 bg-white">
          
          {step === 1 && (
            <form onSubmit={handleNextStep}>
              
              <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-sm">
                <p className="text-red-700 text-sm font-semibold mb-2">Hinweis: Buchungen auf Warteliste sind ebenfalls verbindlich. Manchmal können wir euch die Teilnahme erst kurzfristig bestätigen. Wenn ihr nicht könnt, bitte bis spätestens 3 Tage vor dem Kurs Wartelistenbuchung absagen. Andernfalls müssen wir euch den Kurspreis berechnen.</p>
                <p className="text-gray-600 text-xs leading-relaxed">Wir empfehlen zur Absicherung für Stornos / Absagen den Abschluss einer Seminarversicherung bzw. für unsere mehrtätigen Kurse / Reisen zusätzlich eine Reiseversicherung. Diese kann auch nach Buchung abgeschlossen werden. Infos dazu findet ihr auf unserer Seite sowie in eurer Buchungsbestätigung, die ihr nach Buchungsabschluss per E-Mail erhaltet.</p>
              </div>

              <div className="space-y-6">
                {standardFields.map((field) => (
                  <div key={field.id}>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">{field.label}{field.required ? ' *' : ''}</label>
                    {field.id === 'salutation' ? (
                      <select
                        name="salutation"
                        value={formData.salutation}
                        onChange={handleInputChange}
                        className="w-full p-2.5 border border-gray-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-luxury-gold bg-white"
                        required={field.required}
                      >
                        <option value="Bitte wählen">Bitte wählen</option>
                        <option value="Herr">Herr</option>
                        <option value="Frau">Frau</option>
                      </select>
                    ) : (
                      <input
                        type={field.id === 'email' ? 'email' : field.id === 'phone' ? 'tel' : 'text'}
                        placeholder={field.id === 'birthDate' ? 'TT.MM.JJJJ' : undefined}
                        name={field.id}
                        value={(formData as any)[field.id] || ''}
                        onChange={handleInputChange}
                        required={field.required}
                        className="w-full p-2.5 border border-gray-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-luxury-gold"
                      />
                    )}
                  </div>
                ))}

                {participants.length > 0 && (
                  <div className="border-t border-gray-200 pt-6 mt-2 space-y-6">
                    <h3 className="font-luxury text-xl text-luxury-dark mb-4">Weitere Teilnehmer</h3>
                    {participants.map((p, index) => (
                      <div key={index} className="p-4 bg-gray-50 border border-gray-200 rounded-sm space-y-4">
                        <h4 className="font-semibold text-gray-700">Teilnehmer {index + 2}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Anrede *</label>
                            <select 
                              value={p.salutation} 
                              onChange={(e) => {
                                const newP = [...participants];
                                newP[index].salutation = e.target.value;
                                setParticipants(newP);
                              }}
                              className="w-full p-2.5 border border-gray-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-luxury-gold bg-white"
                              required
                            >
                              <option value="Bitte wählen">Bitte wählen</option>
                              <option value="Herr">Herr</option>
                              <option value="Frau">Frau</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Vorname Nachname *</label>
                            <input type="text" value={p.fullName} onChange={(e) => {
                                const newP = [...participants];
                                newP[index].fullName = e.target.value;
                                setParticipants(newP);
                              }} required className="w-full p-2.5 border border-gray-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-luxury-gold" />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Geburtsdatum *</label>
                            <input type="text" placeholder="TT.MM.JJJJ" value={p.birthDate} onChange={(e) => {
                                const newP = [...participants];
                                newP[index].birthDate = e.target.value;
                                setParticipants(newP);
                              }} required className="w-full p-2.5 border border-gray-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-luxury-gold" />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Größe (cm) / Gewicht (kg) *</label>
                            <input type="text" value={p.sizeWeight} onChange={(e) => {
                                const newP = [...participants];
                                newP[index].sizeWeight = e.target.value;
                                setParticipants(newP);
                              }} required className="w-full p-2.5 border border-gray-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-luxury-gold" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {customFields.length > 0 && (
                  <div className="border-t border-gray-200 pt-6 mt-2 space-y-6">
                    <h3 className="font-luxury text-xl text-luxury-dark mb-4">Zusätzliche Angaben</h3>
                    {customFields.map((field) => (
                      <div key={field.id}>
                        {field.fieldType === 'checkbox' ? (
                          <label className="flex items-start gap-2 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={dynamicFormData[field.slug] || false}
                              onChange={(e) => setDynamicFormData(prev => ({ ...prev, [field.slug]: e.target.checked }))}
                              required={!field.allowEmpty}
                              className="mt-1"
                            />
                            <span className="text-sm text-gray-700 font-semibold">{field.title} {field.allowEmpty ? '' : '*'}</span>
                          </label>
                        ) : field.fieldType === 'textarea' ? (
                          <>
                            {field.showLabel && <label className="block text-sm font-semibold text-gray-700 mb-1">{field.title} {!field.allowEmpty && '*'}</label>}
                            <textarea 
                              value={dynamicFormData[field.slug] || ''} 
                              onChange={(e) => setDynamicFormData(prev => ({ ...prev, [field.slug]: e.target.value }))}
                              required={!field.allowEmpty} 
                              rows={3}
                              className="w-full p-2.5 border border-gray-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-luxury-gold resize-none" 
                            />
                          </>
                        ) : field.fieldType === 'select' ? (
                          <>
                            {field.showLabel && <label className="block text-sm font-semibold text-gray-700 mb-1">{field.title} {!field.allowEmpty && '*'}</label>}
                            <select 
                              value={dynamicFormData[field.slug] || ''} 
                              onChange={(e) => setDynamicFormData(prev => ({ ...prev, [field.slug]: e.target.value }))}
                              required={!field.allowEmpty}
                              className="w-full p-2.5 border border-gray-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-luxury-gold bg-white"
                            >
                              <option value="">Bitte wählen</option>
                              {field.options?.split(',').map((opt: string) => (
                                <option key={opt.trim()} value={opt.trim()}>{opt.trim()}</option>
                              ))}
                            </select>
                          </>
                        ) : (
                          <>
                            {field.showLabel && <label className="block text-sm font-semibold text-gray-700 mb-1">{field.title} {!field.allowEmpty && '*'}</label>}
                            <input 
                              type={field.fieldType || 'text'} 
                              value={dynamicFormData[field.slug] || ''} 
                              onChange={(e) => setDynamicFormData(prev => ({ ...prev, [field.slug]: e.target.value }))}
                              required={!field.allowEmpty} 
                              className="w-full p-2.5 border border-gray-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-luxury-gold" 
                            />
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="border-t border-gray-200 pt-6 mt-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Bemerkung / Gutscheincode</label>
                  <textarea name="remarks" value={formData.remarks} onChange={handleInputChange} rows={4} className="w-full p-2.5 border border-gray-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-luxury-gold resize-none" />
                </div>
              </div>

              <div className="flex justify-end mt-8 border-t border-gray-200 pt-6">
                <button 
                  type="submit"
                  className="px-10 py-3 bg-[#5bc0de] text-white hover:bg-[#46b8da] transition-colors rounded-sm shadow-sm"
                >
                  Weiter
                </button>
              </div>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleNextStep} className="max-w-2xl mx-auto flex flex-col h-full min-h-[400px]">
              <div className="flex-1 space-y-8">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Zahlungsmethode<span className="text-gray-500 font-normal"> Eine der Optionen muss ausgewählt sein.</span>
                  </label>
                  <select 
                    name="paymentMethod" 
                    value={formData.paymentMethod} 
                    onChange={handleInputChange}
                    className="w-full p-2.5 border border-gray-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-luxury-gold bg-white"
                    required
                  >
                    {totalPrice === 0 ? (
                      <option value="Kostenlos">Kostenlos (0,00 €)</option>
                    ) : (
                      <>
                        <option value="Bitte auswählen">Bitte auswählen</option>
                        <option value="Gutschein">Gutschein</option>
                        <option value="Überweisung">Überweisung</option>
                        <option value="Barzahlung">Barzahlung vor Ort</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="border-t border-gray-200 pt-8 mt-8">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Gutscheincode</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={voucherCode} 
                      onChange={(e) => setVoucherCode(e.target.value)} 
                      placeholder="Code eingeben"
                      className="flex-1 p-2.5 border border-gray-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-luxury-gold" 
                      disabled={validatingVoucher || voucherDiscount !== null}
                    />
                    {voucherDiscount ? (
                      <button 
                        type="button"
                        onClick={() => { setVoucherCode(''); setVoucherDiscount(null); setVoucherMessage(null); }}
                        className="px-4 py-2 bg-red-100 text-red-600 rounded-sm font-semibold hover:bg-red-200"
                      >
                        Entfernen
                      </button>
                    ) : (
                      <button 
                        type="button"
                        onClick={handleValidateVoucher}
                        disabled={validatingVoucher || !voucherCode.trim()}
                        className="px-4 py-2 bg-luxury-gold text-white rounded-sm font-semibold hover:bg-[#aa883e] disabled:opacity-50"
                      >
                        {validatingVoucher ? 'Prüfen...' : 'Einlösen'}
                      </button>
                    )}
                  </div>
                  {voucherMessage && (
                    <p className={`text-sm mt-2 font-semibold ${voucherMessage.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                      {voucherMessage.text}
                    </p>
                  )}
                </div>

                {event.extraFeeOptions && event.extraFeeOptions.length > 0 && (
                  <div className="border-t border-gray-200 pt-8 mt-8">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Zusätzliche buchbare Optionen</label>
                    <div className="space-y-2">
                      {event.extraFeeOptions.map((opt: any, i: number) => (
                        <label key={i} className="flex items-center gap-2 text-sm text-gray-700">
                          <input type="checkbox" checked={selectedExtras.has(i)} onChange={() => toggleExtra(i)} />
                          {opt.title} ({Number(opt.value) < 0 ? '-' : '+'} € {Math.abs(Number(opt.value)).toFixed(2)}{opt.perPlace ? ' pro Person' : ''})
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="border-t border-gray-200 pt-8 mt-8">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Anzahl</label>
                  <input 
                    type="text" 
                    value={totalTickets} 
                    disabled 
                    className="w-full p-2.5 border border-gray-300 rounded-sm bg-gray-50 text-gray-700" 
                  />
                  {event.title?.toUpperCase().includes('TENERIFFA') && (
                    <p className="text-gray-600 text-xs mt-2 italic">* Die Veranstaltung ist ausgebucht - Ihre Buchung wird auf der Warteliste vermerkt.</p>
                  )}
                </div>
              </div>

              <div className="mt-12 flex justify-end">
                <div className="text-right w-full">
                  {applicableTieredFee && (
                    <p className={`text-sm mb-1 ${applicableTieredFee.isDiscount ? 'text-green-600' : 'text-gray-600'}`}>
                      {applicableTieredFee.title || (applicableTieredFee.isDiscount ? 'Rabatt' : 'Zuschlag')}: {applicableTieredFee.isDiscount ? '-' : '+'} {applicableTieredFee.isPercentage ? `${applicableTieredFee.value}%` : `€ ${(Number(applicableTieredFee.value) * tieredFeeQuantityScale).toFixed(2)}`}
                    </p>
                  )}
                  {extrasTotal !== 0 && (
                    <p className="text-sm text-gray-600 mb-1">
                      Zusätzliche Optionen: {extrasTotal < 0 ? '-' : '+'} € {Math.abs(extrasTotal).toFixed(2)}
                    </p>
                  )}
                  {voucherDiscount && (
                    <p className="text-sm text-green-600 mb-1">
                      Gutschein: - {voucherDiscount.isPercentage ? `${voucherDiscount.amount}%` : `€ ${voucherDiscount.amount.toFixed(2)}`}
                    </p>
                  )}
                  <p className="text-gray-600 mb-4 font-bold text-lg">Gesamtpreis: € {finalPrice.toFixed(2)}</p>
                  <div className="flex justify-end gap-4 border-t border-gray-200 pt-4">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="px-6 py-2 border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors rounded-sm shadow-sm"
                    >
                      Zurück
                    </button>
                    <button 
                      type="submit"
                      className="px-8 py-2 bg-[#5bc0de] text-white hover:bg-[#46b8da] transition-colors rounded-sm shadow-sm"
                    >
                      Weiter
                    </button>
                  </div>
                </div>
              </div>
            </form>
          )}

          {step === 3 && (
            <div className="max-w-3xl mx-auto flex flex-col h-full min-h-[400px]">
              
              <div className="flex-1 space-y-8">
                {/* User Data Box */}
                <div className="bg-white border border-gray-200 rounded-sm overflow-hidden">
                  <div className="p-6">
                    <h3 className="font-luxury text-2xl text-luxury-dark mb-6">Bestätigung</h3>
                    
                    <div className="grid grid-cols-[1fr_2fr] gap-y-3 text-[13px]">
                      <div className="font-semibold text-gray-700">Anrede</div>
                      <div className="text-gray-600">{formData.salutation}</div>
                      
                      <div className="font-semibold text-gray-700">Vorname Nachname</div>
                      <div className="text-gray-600">{formData.fullName}</div>
                      
                      <div className="font-semibold text-gray-700">Geburtsdatum</div>
                      <div className="text-gray-600">{formData.birthDate}</div>
                      
                      <div className="font-semibold text-gray-700">Größe in cm / Gewicht in kg</div>
                      <div className="text-gray-600">{formData.sizeWeight}</div>
                      
                      <div className="font-semibold text-gray-700">Telefon / Mobil</div>
                      <div className="text-gray-600">{formData.phone}</div>
                      
                      <div className="font-semibold text-gray-700">E-Mail</div>
                      <div className="text-gray-600">{formData.email}</div>
                      
                      <div className="font-semibold text-gray-700">Straße</div>
                      <div className="text-gray-600">{formData.street}</div>
                      
                      <div className="font-semibold text-gray-700">Postleitzahl</div>
                      <div className="text-gray-600">{formData.zip}</div>
                      
                      <div className="font-semibold text-gray-700">Ort</div>
                      <div className="text-gray-600">{formData.city}</div>
                      
                      <div className="font-semibold text-gray-700">Bemerkung / Gutscheincode</div>
                      <div className="text-gray-600">{formData.remarks || '-'}</div>
                    </div>
                  </div>
                </div>

                {/* Price Box */}
                <div className="bg-white border border-gray-200 rounded-sm overflow-hidden">
                  <div className="p-6">
                    <div className="grid grid-cols-[1fr_auto] gap-y-4 text-sm mb-6 border-b border-gray-100 pb-6">
                      <div className="font-semibold text-gray-700">Anzahl</div>
                      <div className="font-semibold text-gray-700 text-right">Gesamtpreis</div>
                      
                      <div className="text-gray-600">{totalTickets}</div>
                      <div className="text-gray-600 text-right">€ {totalPrice.toFixed(2)}</div>
                    </div>

                    {applicableTieredFee && (
                      <div className="grid grid-cols-[1fr_auto] gap-y-1 text-sm text-green-600 mt-2">
                        <div>{applicableTieredFee.title || 'Rabatt'}</div>
                        <div className="text-right">- {applicableTieredFee.isPercentage ? `${applicableTieredFee.value}%` : `€ ${(Number(applicableTieredFee.value) * tieredFeeQuantityScale).toFixed(2)}`}</div>
                      </div>
                    )}
                    {extrasTotal !== 0 && (
                      <div className={`grid grid-cols-[1fr_auto] gap-y-1 text-sm mt-2 ${extrasTotal < 0 ? 'text-green-600' : 'text-gray-600'}`}>
                        <div>Zusätzliche Optionen</div>
                        <div className="text-right">{extrasTotal < 0 ? '-' : '+'} € {Math.abs(extrasTotal).toFixed(2)}</div>
                      </div>
                    )}
                    {voucherDiscount && (
                      <div className="grid grid-cols-[1fr_auto] gap-y-1 text-sm text-green-600 mt-2">
                        <div>Gutschein</div>
                        <div className="text-right">- {voucherDiscount.isPercentage ? `${voucherDiscount.amount}%` : `€ ${voucherDiscount.amount.toFixed(2)}`}</div>
                      </div>
                    )}

                    <div className="grid grid-cols-[1fr_auto] gap-y-4 text-sm mt-4">
                      <div className="font-semibold text-gray-700 text-right">Gesamt</div>
                      <div className="font-semibold text-gray-700 text-right w-24">€ {finalPrice.toFixed(2)}</div>
                    </div>
                  </div>
                </div>

                {/* Newsletter opt-in Toggle */}
                <div className="flex items-center gap-4 mt-6">
                  <button
                    type="button"
                    onClick={() => setNewsletterOptIn(!newsletterOptIn)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${newsletterOptIn ? 'bg-[#5bc0de]' : 'bg-gray-200'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${newsletterOptIn ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                  <span
                    className="text-sm font-semibold text-gray-600 cursor-pointer"
                    onClick={() => setNewsletterOptIn(!newsletterOptIn)}
                  >
                    Ich möchte den Newsletter der Flugschule Hirondelle erhalten.
                  </span>
                </div>

                {/* AGB Toggle */}
                <div className="flex items-center gap-4 mt-6">
                  <button
                    type="button"
                    onClick={() => setAgbAccepted(!agbAccepted)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${agbAccepted ? 'bg-[#5bc0de]' : 'bg-gray-200'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${agbAccepted ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                  <span className="text-sm font-semibold">
                    <span className="text-gray-600 cursor-pointer" onClick={() => setAgbAccepted(!agbAccepted)}>Ich akzeptiere die </span>
                    <a href="/agb" target="_blank" rel="noopener noreferrer" className="text-[#5bc0de] hover:underline">AGB</a>
                    <span className="text-gray-600 cursor-pointer" onClick={() => setAgbAccepted(!agbAccepted)}> und </span>
                    <a href="/widerrufsbelehrung" target="_blank" rel="noopener noreferrer" className="text-[#5bc0de] hover:underline">Widerrufsbelehrung</a>
                    <span className="text-gray-600 cursor-pointer" onClick={() => setAgbAccepted(!agbAccepted)}>.</span>
                  </span>
                </div>
              </div>

              {/* Buttons */}
              <div className="mt-12 flex justify-end">
                <div className="flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setStep(2)}
                    className="px-6 py-2 border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors rounded-sm shadow-sm"
                  >
                    Zurück
                  </button>
                  <button 
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting || !agbAccepted}
                    className="px-8 py-2 bg-[#5bc0de] text-white hover:bg-[#46b8da] disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-sm shadow-sm"
                  >
                    {isSubmitting ? 'Wird gebucht...' : 'Zahlungspflichtig buchen'}
                  </button>
                </div>
              </div>

            </div>
          )}

          {step === 4 && (
            <div className="max-w-3xl mx-auto flex flex-col h-full min-h-[400px]">
              
              {/* Alert Banner */}
              {event.title?.toUpperCase().includes('TENERIFFA') ? (
                <div className="bg-[#dff0d8] border border-[#d6e9c6] text-[#3c763d] p-4 rounded-sm mb-8 flex justify-between items-center">
                  <span>Ihre Buchung war erfolgreich! Da die maximale Teilnehmerzahl bereits erreicht war, wurden Sie auf die Warteliste gesetzt.</span>
                  <button onClick={onClose} className="text-[#3c763d] hover:opacity-70 font-bold">&times;</button>
                </div>
              ) : (
                <div className="bg-[#dff0d8] border border-[#d6e9c6] text-[#3c763d] p-4 rounded-sm mb-8 flex justify-between items-center">
                  <span>Ihre Buchung war erfolgreich!</span>
                  <button onClick={onClose} className="text-[#3c763d] hover:opacity-70 font-bold">&times;</button>
                </div>
              )}

              {/* Event Booking Details */}
              <div className="mb-12">
                <h3 className="font-luxury text-2xl text-luxury-dark mb-4">Ihre Buchungsdetails</h3>
                <div className="grid grid-cols-[1fr_2fr] gap-y-1 text-sm text-gray-700">
                  <div className="text-gray-500">Veranstaltung</div>
                  <div className="text-[#5bc0de]">{event.title}</div>
                  
                  <div className="text-gray-500">Buchungs-ID</div>
                  <div>{bookingId}</div>
                  
                  <div className="text-gray-500">Beginn</div>
                  <div>{new Date(event.start || event.startDate).toLocaleString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
                  
                  <div className="text-gray-500">Ende</div>
                  <div>{event.end ? new Date(event.end || event.endDate).toLocaleString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}</div>
                  
                  <div className="text-gray-500">Status</div>
                  <div>{bookingStatus === 'WAITLIST' ? 'Buchung auf Warteliste' : 'Buchung bestätigt'}</div>
                  
                  <div className="text-gray-500">Ihre Gebühren</div>
                  <div>€ {finalPrice.toFixed(2)}</div>
                  
                  <div className="text-gray-500">Zahlungsmethode</div>
                  <div>{formData.paymentMethod}</div>
                  
                  <div className="text-gray-500">Ihr Zahlungsstatus</div>
                  <div>Offen</div>
                </div>
              </div>

              {/* User Booking Details */}
              <div className="mb-12">
                <h3 className="font-luxury text-2xl text-luxury-dark mb-4">Ihre Buchungsdetails</h3>
                <div className="grid grid-cols-[1fr_2fr] gap-y-1 text-sm text-gray-700">
                  <div className="text-gray-500">Anrede</div>
                  <div>{formData.salutation}</div>
                  
                  <div className="text-gray-500">Vorname Nachname</div>
                  <div>{formData.fullName}</div>
                  
                  <div className="text-gray-500">Geburtsdatum</div>
                  <div>{formData.birthDate}</div>
                  
                  <div className="text-gray-500">Gewicht in kg</div>
                  <div>{formData.sizeWeight}</div>
                  
                  <div className="text-gray-500">Telefon / Mobil</div>
                  <div>{formData.phone}</div>
                  
                  <div className="text-gray-500">E-Mail</div>
                  <div>{formData.email}</div>
                  
                  <div className="text-gray-500">Straße</div>
                  <div>{formData.street}</div>
                  
                  <div className="text-gray-500">Postleitzahl</div>
                  <div>{formData.zip}</div>
                  
                  <div className="text-gray-500">Ort</div>
                  <div>{formData.city}</div>
                  
                  <div className="text-gray-500">Bemerkung / Gutscheincode</div>
                  <div>{formData.remarks}</div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="border-t border-gray-200 pt-6">
                <button 
                  onClick={() => window.print()}
                  className="w-full py-2 mb-4 border border-gray-300 text-[#5bc0de] hover:bg-gray-50 transition-colors rounded-sm text-sm"
                >
                  Drucken
                </button>
                <div className="flex gap-4">
                  <button 
                    className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors rounded-sm text-sm"
                  >
                    Kalender-Datei
                  </button>
                  <button 
                    className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors rounded-sm text-sm"
                  >
                    Buchung stornieren
                  </button>
                  <div className="flex-1"></div>
                  <button 
                    onClick={onClose}
                    className="px-8 py-2 bg-luxury-gold text-white hover:bg-opacity-90 transition-colors rounded-sm text-sm"
                  >
                    Schließen
                  </button>
                </div>
              </div>

            </div>
          )}
        </div>
        
      </div>
    </div>
  );
};
