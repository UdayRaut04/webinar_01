import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@webinar.com' },
    update: {},
    create: {
      email: 'admin@webinar.com',
      passwordHash: adminPassword,
      name: 'Admin User',
      role: 'ADMIN',
    },
  });
  console.log(`✅ Admin user created: ${admin.email}`);

  // Create sample webinar
  const webinar = await prisma.webinar.upsert({
    where: { slug: 'demo-webinar' },
    update: {},
    create: {
      slug: 'demo-webinar',
      title: 'Welcome to Our Platform Demo',
      description: 'Join us for an exciting demonstration of our new webinar platform. Learn about all the features and how to make the most of your webinars.',
      hostId: admin.id,
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      timezone: 'UTC',
      duration: 60,
      mode: 'RECORDED',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      status: 'SCHEDULED',
      accentColor: '#6366f1',
      state: {
        create: {
          isLive: false,
          currentTimestamp: 0,
        },
      },
    },
  });
  console.log(`✅ Sample webinar created: ${webinar.title}`);

  // Create sample automations
  const automations = [
    {
      webinarId: webinar.id,
      type: 'TIMED_MESSAGE' as const,
      triggerAt: 60, // 1 minute in
      content: JSON.stringify({
        senderName: 'Webinar Bot',
        message: '👋 Welcome everyone! Feel free to ask questions in the chat.',
      }),
    },
    {
      webinarId: webinar.id,
      type: 'TIMED_MESSAGE' as const,
      triggerAt: 300, // 5 minutes in
      content: JSON.stringify({
        senderName: 'Webinar Bot',
        message: '🔥 Enjoying the session? Make sure to take notes!',
      }),
    },
    {
      webinarId: webinar.id,
      type: 'CTA_POPUP' as const,
      triggerAt: 600, // 10 minutes in
      content: JSON.stringify({
        title: 'Special Offer!',
        description: 'Get 20% off when you sign up today.',
        buttonText: 'Claim Offer',
        buttonUrl: 'https://example.com/offer',
        duration: 30,
      }),
    },
  ];

  for (const automation of automations) {
    await prisma.automation.create({ data: automation });
  }
  console.log(`✅ Sample automations created`);

  // Create sample registration
  const registration = await prisma.registration.create({
    data: {
      webinarId: webinar.id,
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+1234567890',
    },
  });
  console.log(`✅ Sample registration created: ${registration.uniqueLink}`);

  console.log('\n🎉 Seeding completed!');
  console.log('\n📝 Login credentials:');
  console.log('   Email: admin@webinar.com');
  console.log('   Password: admin123');
  console.log(`\n🔗 Sample registration link: /join/${registration.uniqueLink}`);
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
