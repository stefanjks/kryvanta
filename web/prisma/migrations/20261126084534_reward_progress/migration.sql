-- AlterTable
ALTER TABLE "minecraft_accounts" ADD COLUMN     "rewardProgressSeconds" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rewardsStored" INTEGER NOT NULL DEFAULT 0;
