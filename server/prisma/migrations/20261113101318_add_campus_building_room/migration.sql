-- CreateTable
CREATE TABLE "Campus" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Campus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Building" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "campusId" INTEGER NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Building_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "buildingId" INTEGER NOT NULL,
    "qrToken" TEXT NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Campus_name_key" ON "Campus"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Campus_code_key" ON "Campus"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Building_campusId_name_key" ON "Building"("campusId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Room_qrToken_key" ON "Room"("qrToken");

-- CreateIndex
CREATE UNIQUE INDEX "Room_buildingId_name_key" ON "Room"("buildingId", "name");

-- AddForeignKey
ALTER TABLE "Building" ADD CONSTRAINT "Building_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
