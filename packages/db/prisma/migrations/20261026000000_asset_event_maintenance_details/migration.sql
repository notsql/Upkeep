-- AlterTable
ALTER TABLE "AssetEvent" ADD COLUMN     "downtimeMinutes" INTEGER,
ADD COLUMN     "findings" VARCHAR(2500),
ADD COLUMN     "partsReplaced" VARCHAR(2500),
ADD COLUMN     "serviceProvider" VARCHAR(200),
ADD COLUMN     "workPerformed" VARCHAR(2500);
