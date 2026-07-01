-- S7.6 (#117): persist the OSD (40% Optional Standard Deduction) election
-- on the TaxYear model. OSD is mutually exclusive with the 8% flat rate
-- (NIRC Sec 24(A)(2)) and is only valid under the graduated rate. The
-- combination is enforced at the election API layer, not here.
--
-- Non-destructive: additive column with a server-side default of FALSE so
-- every existing TaxYear row continues to satisfy the column constraint
-- after the migration applies. No data backfill is required.

-- AlterTable
ALTER TABLE "TaxYear" ADD COLUMN "osdElection" BOOLEAN NOT NULL DEFAULT false;
