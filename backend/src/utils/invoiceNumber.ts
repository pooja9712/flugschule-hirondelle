import { prisma } from './prisma';

// Mirrors old Matukio's own invoice-numbering exactly (MatukioHelperInvoice::
// getInvoiceNumber(), invoice.php, and the skip rule in
// MatukioHelperBasic::getInvoiceImage(), basic.php):
// - No invoice at all for a free event - checked against the EVENT's own
//   base fee (feePerPerson), NOT the booking's final totalPrice. A booking
//   fully covered by a voucher/discount on an otherwise-paid event still
//   gets a real invoice number in old - confirmed directly against old's
//   real historical data: every one of the ~601 migrated bookings with
//   totalPrice=0 and no historical invoice number also had feePerPerson<=0,
//   zero exceptions.
// - Once assigned, a booking's number is permanent - never recalculated,
//   even if the event's fee is edited afterwards.
// - Sequential per calendar year, based on when the BOOKING was created
//   (not the event's date, not today's date) - continuing the real
//   historical sequence migrated into this table (see
//   backfill_invoice_numbers_2026-10-11.ts), not restarting from 1.
export async function getOrCreateInvoiceNumber(bookingId: string): Promise<{ number: number; year: number; createdAt: Date } | null> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { event: true, invoiceNumber: true },
  });
  if (!booking) return null;
  if ((booking.event.feePerPerson ?? 0) <= 0) return null;
  if (booking.invoiceNumber) return booking.invoiceNumber;

  const year = booking.createdAt.getFullYear();
  return prisma.$transaction(async (tx) => {
    // Re-check inside the transaction in case two requests raced to assign
    // this same booking's number concurrently.
    const again = await tx.invoiceNumber.findUnique({ where: { bookingId } });
    if (again) return again;
    const last = await tx.invoiceNumber.findFirst({ where: { year }, orderBy: { number: 'desc' } });
    const number = last ? last.number + 1 : 1;
    return tx.invoiceNumber.create({ data: { bookingId, year, number } });
  });
}

export function formatInvoiceNumber(inv: { number: number; year: number } | null): string | null {
  return inv ? `${inv.number}/${inv.year}` : null;
}
