CREATE TYPE "RoomStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'SUSPENDED', 'CLOSED');

CREATE TABLE "RoomPlan" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "participantLimit" INTEGER,
  "durationDays" INTEGER NOT NULL DEFAULT 365,
  "priceInCents" INTEGER NOT NULL,
  "benefits" TEXT[],
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RoomPlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RoomPlan_slug_key" ON "RoomPlan"("slug");

INSERT INTO "RoomPlan" ("id", "slug", "name", "participantLimit", "durationDays", "priceInCents", "benefits", "updatedAt")
VALUES
  ('room_plan_basic', 'sala-basica', 'Sala Básica', 20, 365, 4000000, ARRAY['Ranking privado', 'Chat de sala', 'Código de acceso', 'Panel del dueño'], CURRENT_TIMESTAMP),
  ('room_plan_pro', 'sala-pro', 'Sala Pro', 50, 365, 8000000, ARRAY['Todo lo de Básica', 'Hasta 50 participantes', 'Estadísticas del grupo', 'Administradores adicionales'], CURRENT_TIMESTAMP),
  ('room_plan_premium', 'sala-premium', 'Sala Premium', 100, 365, 12000000, ARRAY['Todo lo de Pro', 'Hasta 100 participantes', 'Panel avanzado', 'Soporte prioritario'], CURRENT_TIMESTAMP),
  ('room_plan_business', 'sala-empresarial', 'Sala Empresarial', NULL, 365, 0, ARRAY['Participantes personalizados', 'Atención comercial', 'Configuración a medida', 'Soporte prioritario'], CURRENT_TIMESTAMP);

ALTER TABLE "League"
  ADD COLUMN "planId" TEXT,
  ADD COLUMN "status" "RoomStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "description" TEXT,
  ADD COLUMN "rules" TEXT;

UPDATE "League"
SET
  "planId" = CASE
    WHEN "maxParticipants" <= 20 THEN 'room_plan_basic'
    WHEN "maxParticipants" <= 50 THEN 'room_plan_pro'
    ELSE 'room_plan_premium'
  END,
  "expiresAt" = COALESCE("paidAt", "createdAt") + INTERVAL '1 year',
  "description" = COALESCE("description", 'Sala privada de quiniela administrada por su creador.'),
  "rules" = COALESCE("rules", 'El administrador de la sala define las reglas internas para sus participantes.');

CREATE INDEX "League_planId_idx" ON "League"("planId");
CREATE INDEX "League_status_expiresAt_idx" ON "League"("status", "expiresAt");

ALTER TABLE "League"
  ADD CONSTRAINT "League_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "RoomPlan"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
