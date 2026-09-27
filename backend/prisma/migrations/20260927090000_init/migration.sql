-- CreateTable
CREATE TABLE "Release" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "date" TIMESTAMPTZ(3) NOT NULL,
    "additionalInfo" TEXT,
    "completedSteps" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Release_pkey" PRIMARY KEY ("id")
);
