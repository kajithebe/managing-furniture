-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('CREATED', 'EDITED', 'BORROWED', 'APPROVED', 'DECLINED', 'RETURNED', 'MARKED_RETURNED', 'OVERDUE', 'STATUS_CHANGED', 'LOCATION_CORRECTED', 'HOME_CHANGED');

-- CreateTable
CREATE TABLE "Setting" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "maxLoanHours" INTEGER NOT NULL DEFAULT 4,
    "reminderMinutes" INTEGER NOT NULL DEFAULT 30,
    "repeatOverdueEmail" BOOLEAN NOT NULL DEFAULT true,
    "ccModeratorsOnOverdue" BOOLEAN NOT NULL DEFAULT false,
    "codeScheme" JSONB NOT NULL,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemEvent" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "type" "EventType" NOT NULL,
    "userId" INTEGER,
    "loanId" INTEGER,
    "fromRoomId" INTEGER,
    "toRoomId" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "actorId" INTEGER NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" INTEGER,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ItemEvent" ADD CONSTRAINT "ItemEvent_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
