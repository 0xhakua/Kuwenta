-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'TAXPAYER');

-- CreateEnum
CREATE TYPE "ElectionStatus" AS ENUM ('NOT_ELECTED', 'ELECTED_8PCT', 'ELECTED_GRADUATED');

-- CreateEnum
CREATE TYPE "TaxRate" AS ENUM ('RATE_8PCT', 'GRADUATED');

-- CreateEnum
CREATE TYPE "FormType" AS ENUM ('FORM_2551Q', 'FORM_1701Q', 'FORM_1701A');

-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('BLOCKED', 'PENDING', 'GENERATED', 'FILED');

-- CreateEnum
CREATE TYPE "OverpaymentOption" AS ENUM ('CARRY_OVER', 'REFUND', 'TAX_CREDIT_CERTIFICATE');

-- CreateEnum
CREATE TYPE "AnchorStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'TAXPAYER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxpayerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tin" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "rdoCode" TEXT NOT NULL,
    "registeredAddress" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "natureOfBusiness" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxpayerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ATCCode" (
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ewtRate" DECIMAL(5,4) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ATCCode_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "TaxpayerATC" (
    "id" TEXT NOT NULL,
    "taxpayerId" TEXT NOT NULL,
    "atcCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxpayerATC_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxYear" (
    "id" TEXT NOT NULL,
    "taxpayerId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "electionStatus" "ElectionStatus" NOT NULL DEFAULT 'NOT_ELECTED',
    "electedRate" "TaxRate",
    "electionDate" TIMESTAMP(3),
    "electionLockedAt" TIMESTAMP(3),
    "vatBreached" BOOLEAN NOT NULL DEFAULT false,
    "vatBreachDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Form2307" (
    "id" TEXT NOT NULL,
    "taxYearId" TEXT NOT NULL,
    "quarter" INTEGER NOT NULL,
    "payorTin" TEXT NOT NULL,
    "payorName" TEXT NOT NULL,
    "atcCode" TEXT NOT NULL,
    "month1Amount" DECIMAL(15,2) NOT NULL,
    "month2Amount" DECIMAL(15,2) NOT NULL,
    "month3Amount" DECIMAL(15,2) NOT NULL,
    "quarterlyTotal" DECIMAL(15,2) NOT NULL,
    "cwtWithheld" DECIMAL(15,2) NOT NULL,
    "cwtValidated" BOOLEAN NOT NULL DEFAULT false,
    "cwtDiscrepancy" DECIMAL(15,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Form2307_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxReturn" (
    "id" TEXT NOT NULL,
    "taxYearId" TEXT NOT NULL,
    "formType" "FormType" NOT NULL,
    "quarter" INTEGER,
    "sequenceOrder" INTEGER NOT NULL,
    "status" "ReturnStatus" NOT NULL DEFAULT 'BLOCKED',
    "computedTaxDue" DECIMAL(15,2),
    "taxCreditsTotal" DECIMAL(15,2),
    "netTaxDue" DECIMAL(15,2),
    "overpaymentAmt" DECIMAL(15,2),
    "statutoryDueDate" TIMESTAMP(3) NOT NULL,
    "filedDate" TIMESTAMP(3),
    "generatedAt" TIMESTAMP(3),
    "pdfPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnPenalty" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "daysLate" INTEGER NOT NULL DEFAULT 0,
    "surcharge" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "interest" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "compromisePenalty" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalPenalty" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReturnPenalty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriorYearCredit" (
    "id" TEXT NOT NULL,
    "taxYearId" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "originYear" INTEGER NOT NULL,
    "originForm" TEXT NOT NULL,
    "priorDisposition" TEXT NOT NULL,
    "isValidated" BOOLEAN NOT NULL DEFAULT false,
    "userConfirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriorYearCredit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Overpayment" (
    "id" TEXT NOT NULL,
    "taxYearId" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "disposition" "OverpaymentOption",
    "electedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Overpayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StellarReceipt" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "stellarTxId" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "network" TEXT NOT NULL DEFAULT 'testnet',
    "anchoredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "explorerUrl" TEXT NOT NULL,
    "status" "AnchorStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "StellarReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RDOPenaltySchedule" (
    "id" TEXT NOT NULL,
    "rdoCode" TEXT NOT NULL,
    "compromiseFee" DECIMAL(10,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RDOPenaltySchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicHoliday" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,

    CONSTRAINT "PublicHoliday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "TaxpayerProfile_userId_key" ON "TaxpayerProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TaxpayerProfile_tin_key" ON "TaxpayerProfile"("tin");

-- CreateIndex
CREATE UNIQUE INDEX "TaxYear_taxpayerId_year_key" ON "TaxYear"("taxpayerId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "TaxReturn_taxYearId_formType_quarter_key" ON "TaxReturn"("taxYearId", "formType", "quarter");

-- CreateIndex
CREATE UNIQUE INDEX "ReturnPenalty_returnId_key" ON "ReturnPenalty"("returnId");

-- CreateIndex
CREATE UNIQUE INDEX "PriorYearCredit_taxYearId_key" ON "PriorYearCredit"("taxYearId");

-- CreateIndex
CREATE UNIQUE INDEX "Overpayment_taxYearId_key" ON "Overpayment"("taxYearId");

-- CreateIndex
CREATE UNIQUE INDEX "StellarReceipt_returnId_key" ON "StellarReceipt"("returnId");

-- CreateIndex
CREATE UNIQUE INDEX "StellarReceipt_stellarTxId_key" ON "StellarReceipt"("stellarTxId");

-- CreateIndex
CREATE UNIQUE INDEX "RDOPenaltySchedule_rdoCode_key" ON "RDOPenaltySchedule"("rdoCode");

-- AddForeignKey
ALTER TABLE "TaxpayerProfile" ADD CONSTRAINT "TaxpayerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxpayerATC" ADD CONSTRAINT "TaxpayerATC_taxpayerId_fkey" FOREIGN KEY ("taxpayerId") REFERENCES "TaxpayerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxpayerATC" ADD CONSTRAINT "TaxpayerATC_atcCode_fkey" FOREIGN KEY ("atcCode") REFERENCES "ATCCode"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxYear" ADD CONSTRAINT "TaxYear_taxpayerId_fkey" FOREIGN KEY ("taxpayerId") REFERENCES "TaxpayerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Form2307" ADD CONSTRAINT "Form2307_taxYearId_fkey" FOREIGN KEY ("taxYearId") REFERENCES "TaxYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Form2307" ADD CONSTRAINT "Form2307_atcCode_fkey" FOREIGN KEY ("atcCode") REFERENCES "ATCCode"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxReturn" ADD CONSTRAINT "TaxReturn_taxYearId_fkey" FOREIGN KEY ("taxYearId") REFERENCES "TaxYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnPenalty" ADD CONSTRAINT "ReturnPenalty_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "TaxReturn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriorYearCredit" ADD CONSTRAINT "PriorYearCredit_taxYearId_fkey" FOREIGN KEY ("taxYearId") REFERENCES "TaxYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Overpayment" ADD CONSTRAINT "Overpayment_taxYearId_fkey" FOREIGN KEY ("taxYearId") REFERENCES "TaxYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StellarReceipt" ADD CONSTRAINT "StellarReceipt_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "TaxReturn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
