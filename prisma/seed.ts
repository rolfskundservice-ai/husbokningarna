import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminPass = await bcrypt.hash("ändra-mig-admin", 10);
  const ownerPass = await bcrypt.hash("ändra-mig-ägare", 10);
  const partner1Pass = await bcrypt.hash("ändra-mig-partner1", 10);
  const partner2Pass = await bcrypt.hash("ändra-mig-partner2", 10);

  const admin = await prisma.user.upsert({
    where: { email: "forvaltare@example.com" },
    update: {},
    create: {
      name: "Förvaltare",
      email: "forvaltare@example.com",
      passwordHash: adminPass,
      role: Role.ADMIN,
    },
  });

  await prisma.user.upsert({
    where: { email: "agare@example.com" },
    update: {},
    create: {
      name: "Gårdsägare",
      email: "agare@example.com",
      passwordHash: ownerPass,
      role: Role.OWNER,
    },
  });

  const partner1 = await prisma.user.upsert({
    where: { email: "partner1@example.com" },
    update: {},
    create: {
      name: "Partner Polen 1",
      email: "partner1@example.com",
      passwordHash: partner1Pass,
      role: Role.PARTNER,
    },
  });

  const partner2 = await prisma.user.upsert({
    where: { email: "partner2@example.com" },
    update: {},
    create: {
      name: "Partner Polen 2",
      email: "partner2@example.com",
      passwordHash: partner2Pass,
      role: Role.PARTNER,
    },
  });

  const stuga1 = await prisma.property.upsert({
    where: { id: "stuga-1" },
    update: {},
    create: {
      id: "stuga-1",
      name: "Stuga 1 - Sjöstugan",
      description: "Stuga vid sjön, 6 bäddar",
      color: "#2563eb",
    },
  });

  const stuga2 = await prisma.property.upsert({
    where: { id: "stuga-2" },
    update: {},
    create: {
      id: "stuga-2",
      name: "Stuga 2 - Skogsstugan",
      description: "Stuga i skogsbrynet, 4 bäddar",
      color: "#16a34a",
    },
  });

  const stuga3 = await prisma.property.upsert({
    where: { id: "stuga-3" },
    update: {},
    create: {
      id: "stuga-3",
      name: "Stuga 3 - Bryggstugan",
      description: "Stuga vid bryggan, 8 bäddar",
      color: "#d97706",
    },
  });

  // Ge partners åtkomst till alla 3 stugor (justera vid behov)
  for (const partner of [partner1, partner2]) {
    for (const property of [stuga1, stuga2, stuga3]) {
      await prisma.propertyAccess.upsert({
        where: { userId_propertyId: { userId: partner.id, propertyId: property.id } },
        update: {},
        create: { userId: partner.id, propertyId: property.id },
      });
    }
  }

  console.log("Seed klar. Inloggningar (byt lösenord direkt!):");
  console.log("forvaltare@example.com / ändra-mig-admin");
  console.log("agare@example.com / ändra-mig-ägare");
  console.log("partner1@example.com / ändra-mig-partner1");
  console.log("partner2@example.com / ändra-mig-partner2");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
