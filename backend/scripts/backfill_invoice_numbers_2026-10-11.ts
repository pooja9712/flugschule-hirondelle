// One-time migration: carries over old Matukio's real, already-issued
// invoice numbers (hiron_matukio_invoice_number, 6,734 rows spanning
// 2013-2026) into the new InvoiceNumber table, matched via
// Booking.customerDetails.oldBookingId (set by migrate_old_data.ts for
// every migrated booking). These numbers were already sent to real
// customers on real invoices - they must be preserved exactly, never
// recalculated/reassigned, so going forward (see utils/invoiceNumber.ts)
// the sequence continues from each year's real historical max instead of
// restarting at 1.
//
// Verified before running (2026-10-11): of 7,301 migrated bookings, 6,700
// matched a real historical invoice number; the other 601 are explained
// completely - every one has both totalPrice=0 AND its event's
// feePerPerson<=0 (a genuinely free event), matching old's own skip rule
// exactly, zero exceptions/anomalies found.
//
// Needs a second, LOCAL-ONLY connection to the restored copy of old's real
// database (d03dbe51 on 127.0.0.1:3306) purely to read the historical
// numbers - that restore isn't present on the production server, so this
// script is run once locally to produce invoice_number_migration_data.json,
// which is what actually gets uploaded and applied on production (a plain
// insert from that file, no old-DB connection needed there).
//
// Run with: npx tsx scripts/backfill_invoice_numbers_2026-10-11.ts

import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { prisma } from '../src/utils/prisma';
import fs from 'fs';
import path from 'path';

const OLD_DB_URL = 'mysql://root:@127.0.0.1:3306/d03dbe51';
const oldAdapter = new PrismaMariaDb(OLD_DB_URL);
const oldPrisma = new PrismaClient({ adapter: oldAdapter });

interface MigrationRow {
  bookingId: string;
  year: number;
  number: number;
}

async function main() {
  const dataFile = path.join(__dirname, 'invoice_number_migration_data.json');

  let rows: MigrationRow[];

  if (fs.existsSync(dataFile)) {
    console.log(`Found existing ${dataFile} - applying it directly (no old-DB connection needed).`);
    rows = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  } else {
    console.log('No data file found - computing the mapping from the local old-DB restore...');
    const newBookings: any[] = await prisma.$queryRawUnsafe(`
      SELECT id, JSON_EXTRACT(customerDetails, '$.oldBookingId') as oldId
      FROM Booking
      WHERE JSON_EXTRACT(customerDetails, '$.oldBookingId') IS NOT NULL
    `);

    const oldIds = newBookings.map((r) => Number(r.oldId));
    const idsCsv = oldIds.join(',');
    const oldInvoices: any[] = await oldPrisma.$queryRawUnsafe(
      `SELECT booking_id, year, number FROM hiron_matukio_invoice_number WHERE booking_id IN (${idsCsv})`
    );
    const byOldId = new Map(oldInvoices.map((r: any) => [r.booking_id, r]));

    rows = [];
    for (const nb of newBookings) {
      const match = byOldId.get(Number(nb.oldId));
      if (match) rows.push({ bookingId: nb.id, year: match.year, number: match.number });
    }

    fs.writeFileSync(dataFile, JSON.stringify(rows, null, 2));
    console.log(`Computed ${rows.length} rows, saved to ${dataFile}`);
  }

  console.log(`Applying ${rows.length} historical invoice numbers...`);
  let created = 0;
  let skipped = 0;
  for (const row of rows) {
    const existing = await prisma.invoiceNumber.findUnique({ where: { bookingId: row.bookingId } });
    if (existing) { skipped++; continue; }
    await prisma.invoiceNumber.create({ data: row });
    created++;
  }
  console.log(`Created ${created}, skipped ${skipped} (already present).`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
