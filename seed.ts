import { getDb } from "../api/queries/connection";
import { users, barbers, services } from "./schema";
import bcrypt from "bcryptjs";

async function seed() {
  const db = getDb();

  console.log("Seeding database...");

  // Create demo barber users
  const hashedPassword = await bcrypt.hash("password123", 12);

  // Check if demo data already exists
  const existing = await db.select().from(barbers).limit(1);
  if (existing.length > 0) {
    console.log("Demo data already exists, skipping seed.");
    return;
  }

  // Create barber users
  const barberUsers = await Promise.all(
    [
      { name: "Арман Куатов", phone: "+7 701 234 5678", unionId: "local_77012345678" },
      { name: "Данияр Сулейменов", phone: "+7 702 345 6789", unionId: "local_77023456789" },
      { name: "Нурлан Беков", phone: "+7 705 456 7890", unionId: "local_77054567890" },
      { name: "Максат Темиров", phone: "+7 707 567 8901", unionId: "local_77075678901" },
      { name: "Ербол Ибрагимов", phone: "+7 747 678 9012", unionId: "local_77476789012" },
    ].map(async (u) => {
      const [user] = await db.insert(users).values({
        unionId: u.unionId,
        phone: u.phone,
        password: hashedPassword,
        name: u.name,
        role: "barber",
      });
      return { id: Number(user.insertId), name: u.name };
    })
  );

  // Create barber profiles
  const barberProfiles = [
    {
      userId: barberUsers[0].id,
      shopName: "BarberKing Алматы",
      specialty: ["Стрижка", "Борода", "Укладка"],
      experience: 8,
      bio: "Профессиональный барбер с 8-летним опытом. Специализация на классических и современных стрижках. Использую только премиальные инструменты.",
      rating: "4.9",
      reviewCount: 127,
      priceRange: "3000-6000",
      address: "пр. Назарбаева 123, Алматы",
      isActive: true,
    },
    {
      userId: barberUsers[1].id,
      shopName: "Gentleman's Cut",
      specialty: ["Борода", "Бритье", "Комплекс"],
      experience: 5,
      bio: "Эксперт по бородам и опасному бритью. Создаю уникальные образы под ваш тип лица. Доверьте свой стиль профессионалу.",
      rating: "4.8",
      reviewCount: 89,
      priceRange: "2500-5000",
      address: "ул. Достык 45, Алматы",
      isActive: true,
    },
    {
      userId: barberUsers[2].id,
      shopName: "Fade Masters",
      specialty: ["Стрижка", "Укладка", "Окрашивание"],
      experience: 6,
      bio: "Мастер фейдов и текстурированных стрижек. Работаю со всеми типами волос. Каждый клиент — это новое произведение искусства.",
      rating: "4.7",
      reviewCount: 64,
      priceRange: "2000-4500",
      address: "мкр. Самал 12, Алматы",
      isActive: true,
    },
    {
      userId: barberUsers[3].id,
      shopName: "Classic Barbershop",
      specialty: ["Стрижка", "Борода", "Комплекс"],
      experience: 10,
      bio: "Традиционный барбершоп с атмосферой старой школы. Классические стрижки, горячие полотенца, расслабляющая атмосфера.",
      rating: "5.0",
      reviewCount: 203,
      priceRange: "3500-7000",
      address: "пр. Абая 78, Алматы",
      isActive: true,
    },
    {
      userId: barberUsers[4].id,
      shopName: "Modern Style Studio",
      specialty: ["Окрашивание", "Укладка", "Стрижка"],
      experience: 4,
      bio: "Молодой и креативный стилист. Следую последним трендам в мужских стрижках. Индивидуальный подход к каждому клиенту.",
      rating: "4.6",
      reviewCount: 45,
      priceRange: "2000-4000",
      address: "ул. Жибек Жолы 156, Алматы",
      isActive: true,
    },
  ];

  const createdBarbers = await Promise.all(
    barberProfiles.map(async (bp) => {
      const [barber] = await db.insert(barbers).values(bp);
      return { id: Number(barber.insertId), ...bp };
    })
  );

  // Create services for each barber
  const servicesData = [
    // BarberKing
    [
      { barberId: createdBarbers[0].id, name: "Мужская стрижка", description: "Классическая или современная стрижка с мытьем головы", duration: 45, price: 3500, category: "haircut" as const },
      { barberId: createdBarbers[0].id, name: "Стрижка бороды", description: "Моделирование и подравнивание бороды", duration: 30, price: 2500, category: "beard" as const },
      { barberId: createdBarbers[0].id, name: "Комплекс", description: "Стрижка + борода + уход за лицом", duration: 75, price: 5500, category: "complex" as const },
      { barberId: createdBarbers[0].id, name: "Укладка", description: "Профессиональная укладка волос", duration: 20, price: 1500, category: "styling" as const },
    ],
    // Gentleman's Cut
    [
      { barberId: createdBarbers[1].id, name: "Королевское бритье", description: "Опасное бритье с горячими полотенцами", duration: 45, price: 4000, category: "shaving" as const },
      { barberId: createdBarbers[1].id, name: "Уход за бородой", description: "Мытье, масло, расческа, моделирование", duration: 30, price: 3000, category: "beard" as const },
      { barberId: createdBarbers[1].id, name: "Комплекс Джентльмен", description: "Бритье + борода + уход за кожей", duration: 60, price: 6000, category: "complex" as const },
    ],
    // Fade Masters
    [
      { barberId: createdBarbers[2].id, name: "Fade стрижка", description: "Плавный переход от кожи к волосам", duration: 40, price: 3000, category: "haircut" as const },
      { barberId: createdBarbers[2].id, name: "Текстурирование", description: "Создание текстуры и объема", duration: 25, price: 2000, category: "styling" as const },
      { barberId: createdBarbers[2].id, name: "Окрашивание", description: "Камуфляж седины или тонирование", duration: 45, price: 4500, category: "coloring" as const },
    ],
    // Classic
    [
      { barberId: createdBarbers[3].id, name: "Классическая стрижка", description: "Традиционная стрижка ножницами", duration: 50, price: 4000, category: "haircut" as const },
      { barberId: createdBarbers[3].id, name: "Борода Премиум", description: "Полный уход с маслами и бальзамами", duration: 35, price: 3500, category: "beard" as const },
      { barberId: createdBarbers[3].id, name: "VIP Комплекс", description: "Стрижка, борода, бритье, уход за лицом", duration: 90, price: 8000, category: "complex" as const },
    ],
    // Modern Style
    [
      { barberId: createdBarbers[4].id, name: "Трендовая стрижка", description: "Самые актуальные стрижки сезона", duration: 40, price: 2500, category: "haircut" as const },
      { barberId: createdBarbers[4].id, name: "Креативное окрашивание", description: "Яркие акценты и модные оттенки", duration: 60, price: 5000, category: "coloring" as const },
      { barberId: createdBarbers[4].id, name: "Укладка премиум", description: "С профессиональными средствами", duration: 30, price: 2000, category: "styling" as const },
    ],
  ];

  for (const barberServices of servicesData) {
    for (const service of barberServices) {
      await db.insert(services).values(service);
    }
  }

  console.log("Seed complete!");
  console.log(`- ${barberUsers.length} barber users created`);
  console.log(`- ${createdBarbers.length} barber profiles created`);
  console.log(`- ${servicesData.flat().length} services created`);
}

seed().catch(console.error);
