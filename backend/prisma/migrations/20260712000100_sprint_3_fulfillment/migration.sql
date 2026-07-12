-- Sprint 3: additive fulfillment configuration.
-- No historical rows are rewritten. Existing Order.fulfillmentType values remain NULL.
ALTER TABLE "Restaurant"
ADD COLUMN "deliveryFeeCents" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Order"
ADD COLUMN "deliveryFeeCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "fulfillmentType" TEXT;