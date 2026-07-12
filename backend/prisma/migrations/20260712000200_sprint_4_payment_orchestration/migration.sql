-- Sprint 4: additive payment orchestration.
-- Yommi coordinates payment state but does not process or receive money.
-- No historical Order rows are rewritten.

ALTER TABLE "Restaurant"
ADD COLUMN "acceptsPayAtRestaurant" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "acceptsCashOnDelivery" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "acceptsBankTransfer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "bankName" TEXT,
ADD COLUMN "bankAccountHolder" TEXT,
ADD COLUMN "bankAccountReference" TEXT,
ADD COLUMN "bankTransferInstructions" TEXT,
ADD COLUMN "paymentConfirmationPhone" TEXT;

ALTER TABLE "Order"
ADD COLUMN "paymentMethod" TEXT,
ADD COLUMN "paymentStatus" TEXT,
ADD COLUMN "paymentConfirmedAt" TIMESTAMP(3),
ADD COLUMN "paymentConfirmedById" TEXT,
ADD COLUMN "paymentConfirmedByRole" TEXT;