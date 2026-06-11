import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("admin123", 10);

  const existingAdmin = await prisma.user.findFirst({
    where: {
      OR: [{ phone: "3008588571" }, { phone: "3001234567" }],
    },
  });

  if (existingAdmin) {
    await prisma.user.update({
      where: { id: existingAdmin.id },
      data: {
        name: "mundialpick",
        phone: "3008588571",
        passwordHash,
        role: Role.ADMIN,
      },
    });
  } else {
    await prisma.user.create({
      data: {
        name: "mundialpick",
        phone: "3008588571",
        passwordHash,
        role: Role.ADMIN,
      },
    });
  }

  const matches = [
    {
      homeTeam: "Mexico",
      awayTeam: "South Africa",
      group: "Grupo A",
      venue: "Estadio Azteca",
      startsAt: new Date("2026-06-11T20:00:00.000Z"),
    },
    {
      homeTeam: "Canada",
      awayTeam: "Japan",
      group: "Grupo B",
      venue: "BMO Field",
      startsAt: new Date("2026-06-12T00:00:00.000Z"),
    },
    {
      homeTeam: "United States",
      awayTeam: "Ghana",
      group: "Grupo C",
      venue: "MetLife Stadium",
      startsAt: new Date("2026-06-12T23:00:00.000Z"),
    },
  ];

  for (const match of matches) {
    await prisma.match.upsert({
      where: {
        id: `${match.homeTeam}-${match.awayTeam}`.toLowerCase().replaceAll(" ", "-"),
      },
      update: match,
      create: {
        id: `${match.homeTeam}-${match.awayTeam}`.toLowerCase().replaceAll(" ", "-"),
        ...match,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
