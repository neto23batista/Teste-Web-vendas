-- AlterTable
ALTER TABLE `order` ADD COLUMN `requiresPrescription` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `product` ADD COLUMN `activeIngredient` VARCHAR(191) NULL;
