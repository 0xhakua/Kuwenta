-- Add step-2 settlement fields to Overpayment (used by 9.16 / 9.18 / 9.20)
ALTER TABLE "Overpayment" ADD COLUMN "carryOverAppliedAt" TIMESTAMP(3);
ALTER TABLE "Overpayment" ADD COLUMN "refundReceivedAt" TIMESTAMP(3);
ALTER TABLE "Overpayment" ADD COLUMN "refundReference" TEXT;
ALTER TABLE "Overpayment" ADD COLUMN "tccNumber" TEXT;
ALTER TABLE "Overpayment" ADD COLUMN "tccAppliedAt" TIMESTAMP(3);

-- Link PriorYearCredit to the Overpayment that produced it (used by 9.16)
ALTER TABLE "PriorYearCredit" ADD COLUMN "sourceOverpaymentId" TEXT;
