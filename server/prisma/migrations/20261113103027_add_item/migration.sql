-- CreateEnum
CREATE TYPE "Condition" AS ENUM ('GOOD', 'NEEDS_REPAIR', 'BROKEN', 'IN_REPAIR', 'DISPOSED');

-- CreateTable
CREATE TABLE "Item" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "brandId" INTEGER,
    "colourId" INTEGER,
    "hasWheels" BOOLEAN NOT NULL DEFAULT false,
    "wheelCount" INTEGER,
    "notes" TEXT,
    "homeRoomId" INTEGER NOT NULL,
    "currentRoomId" INTEGER NOT NULL,
    "condition" "Condition" NOT NULL DEFAULT 'GOOD',
    "onLoan" BOOLEAN NOT NULL DEFAULT false,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Item_code_key" ON "Item"("code");

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_colourId_fkey" FOREIGN KEY ("colourId") REFERENCES "Colour"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_homeRoomId_fkey" FOREIGN KEY ("homeRoomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_currentRoomId_fkey" FOREIGN KEY ("currentRoomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
