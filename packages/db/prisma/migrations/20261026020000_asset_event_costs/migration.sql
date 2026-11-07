-- AlterTable
ALTER TABLE "AssetEvent" ADD COLUMN     "labourCost" DECIMAL(14,2),
ADD COLUMN     "otherCost" DECIMAL(14,2),
ADD COLUMN     "partsCost" DECIMAL(14,2);
