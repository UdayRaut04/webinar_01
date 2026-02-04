-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Webinar" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "hostId" TEXT NOT NULL,
    "scheduledAt" DATETIME NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "duration" INTEGER NOT NULL DEFAULT 60,
    "mode" TEXT NOT NULL DEFAULT 'RECORDED',
    "videoUrl" TEXT,
    "thumbnailUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "accentColor" TEXT NOT NULL DEFAULT '#6366f1',
    "autoEndEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoEndBuffer" INTEGER NOT NULL DEFAULT 5,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Webinar_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Webinar" ("accentColor", "createdAt", "description", "duration", "hostId", "id", "mode", "scheduledAt", "slug", "status", "thumbnailUrl", "timezone", "title", "updatedAt", "videoUrl") SELECT "accentColor", "createdAt", "description", "duration", "hostId", "id", "mode", "scheduledAt", "slug", "status", "thumbnailUrl", "timezone", "title", "updatedAt", "videoUrl" FROM "Webinar";
DROP TABLE "Webinar";
ALTER TABLE "new_Webinar" RENAME TO "Webinar";
CREATE UNIQUE INDEX "Webinar_slug_key" ON "Webinar"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
