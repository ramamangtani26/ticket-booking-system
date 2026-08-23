import { PrismaClient, SeatCategory } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial system data...');

  const hashedPassword = await bcrypt.hash('password123', 10);

  // 1. Create Organiser & Customer
  const organiser = await prisma.user.upsert({
    where: { email: 'organiser@ticket.com' },
    update: {},
    create: {
      email: 'organiser@ticket.com',
      name: 'Grand Arena Organiser',
      password: hashedPassword,
      role: 'ORGANISER',
    },
  });

  const customer = await prisma.user.upsert({
    where: { email: 'customer@ticket.com' },
    update: {
      name: 'Rama Mangtani',
    },
    create: {
      email: 'customer@ticket.com',
      name: 'Rama Mangtani',
      password: hashedPassword,
      role: 'CUSTOMER',
    },
  });

  // 2. Create Venue
  const venue = await prisma.venue.create({
    data: {
      name: 'Grand Symphony Hall',
      location: 'Downtown Center, Cityville',
      rows: 6,
      cols: 8,
    },
  });

  // 3. Create Event
  const event = await prisma.event.create({
    data: {
      title: 'Neon Nights Symphony 2026',
      description: 'An immersive live orchestral & synth-wave performance.',
      venueId: venue.id,
      organiserId: organiser.id,
      startTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      pricing: {
        create: [
          { category: 'VIP', price: 150.0 },
          { category: 'PREMIUM', price: 90.0 },
          { category: 'STANDARD', price: 45.0 },
        ],
      },
    },
  });

  // 4. Generate 6x8 Seats (A to F, 1 to 8)
  const rows = ['A', 'B', 'C', 'D', 'E', 'F'];
  const seatData = [];

  for (let r = 0; r < rows.length; r++) {
    const rowLabel = rows[r];
    let category: SeatCategory = 'STANDARD';
    if (r === 0 || r === 1) category = 'VIP';
    else if (r === 2 || r === 3) category = 'PREMIUM';

    for (let c = 1; c <= 8; c++) {
      seatData.push({
        eventId: event.id,
        rowLabel,
        seatNumber: c,
        category,
        status: 'AVAILABLE' as const,
      });
    }
  }

  await prisma.seat.createMany({ data: seatData });

  console.log(`✅ Seeded successfully! Customer name updated to Rama Mangtani.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });