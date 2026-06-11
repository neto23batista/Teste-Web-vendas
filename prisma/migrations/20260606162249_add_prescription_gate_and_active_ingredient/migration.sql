-- AlterTable
ALTER TABLE `Order` ADD COLUMN `requiresPrescription` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `Product` ADD COLUMN `activeIngredient` VARCHAR(191) NULL;
