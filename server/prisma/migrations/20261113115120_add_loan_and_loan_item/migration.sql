-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "LoanItemStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'RETURNED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "ReturnMethod" AS ENUM ('SCAN', 'MODERATOR');

-- CreateTable
CREATE TABLE "Loan" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "toRoomId" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" "LoanStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanItem" (
    "id" SERIAL NOT NULL,
    "loanId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "status" "LoanItemStatus" NOT NULL,
    "decidedById" INTEGER,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "returnedAt" TIMESTAMP(3),
    "returnedById" INTEGER,
    "returnMethod" "ReturnMethod",
    "reminderSentAt" TIMESTAMP(3),
    "lastOverdueEmailAt" TIMESTAMP(3),
    "lastContactedAt" TIMESTAMP(3),

    CONSTRAINT "LoanItem_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanItem" ADD CONSTRAINT "LoanItem_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanItem" ADD CONSTRAINT "LoanItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
