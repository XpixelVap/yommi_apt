ALTER TABLE "Restaurant"
ADD COLUMN "operationalStatus" TEXT NOT NULL DEFAULT 'CLOSED',
ADD COLUMN "operationalStatusChangedAt" TIMESTAMP(3),
ADD COLUMN "operationalStatusChangedById" TEXT,
ADD COLUMN "operationalStatusChangedByRole" TEXT,
ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'America/Tijuana',
ADD COLUMN "manualOpenUntil" TIMESTAMP(3);

ALTER TABLE "Order"
ADD COLUMN "customerNotes" TEXT,
ADD COLUMN "estimatedReadyAt" TIMESTAMP(3),
ADD COLUMN "cancelReason" TEXT,
ADD COLUMN "cancelledAt" TIMESTAMP(3),
ADD COLUMN "cancelledById" TEXT,
ADD COLUMN "cancelledByRole" TEXT,
ADD COLUMN "cancellationRequestedAt" TIMESTAMP(3),
ADD COLUMN "customerNoShowAt" TIMESTAMP(3),
ADD COLUMN "customerNoShowNote" TEXT;
