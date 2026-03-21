-- P1.5: Fix webhook active column from integer to boolean
ALTER TABLE "webhooks" ALTER COLUMN "active" TYPE BOOLEAN USING (active = 1);
ALTER TABLE "webhooks" ALTER COLUMN "active" SET DEFAULT true;
