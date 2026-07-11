import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'admin@yommi.com';
  const adminEmail2 = 'admin@yummi.com';
  
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const adminPassword = await bcrypt.hash('admin123', 10);
    await prisma.user.create({
      data: {
        email: adminEmail,
        password_hash: adminPassword,
        name: 'Admin',
        role: 'ADMIN',
      },
    });
    console.log(`Admin user created: ${adminEmail}`);
  }

  const existingAdmin2 = await prisma.user.findUnique({ where: { email: adminEmail2 } });
  if (!existingAdmin2) {
    const adminPassword2 = await bcrypt.hash('admin123', 10);
    await prisma.user.create({
      data: {
        email: adminEmail2,
        password_hash: adminPassword2,
        name: 'Admin Yummi',
        role: 'ADMIN',
      },
    });
    console.log(`Admin user created: ${adminEmail2}`);
  }

  const hashedPassword = await bcrypt.hash('password123', 10);

  const existingRestaurant = await prisma.restaurant.findUnique({ where: { email: 'restaurant@example.com' } });
  
  if (!existingRestaurant) {
    const restaurant = await prisma.restaurant.create({
      data: {
        restaurant_name: 'Burger Master',
        owner_name: 'Burger Master Owner',
        email: 'restaurant@example.com',
        password_hash: hashedPassword,
        description: 'Las mejores hamburguesas de la ciudad, preparadas a la parrilla.',
        phone_number: '1234567890',
        logo_url: 'https://picsum.photos/seed/burgerlogo/200',
        coverUrl: 'https://picsum.photos/seed/burgercover/800/400',
        address: 'Av. Principal 123',
        city: 'Madrid',
        lat: 19.4326,
        lng: -99.1332,
        isActive: true,
        status: 'verified',
      },
    });

    const category = await prisma.category.create({
      data: {
        restaurantId: restaurant.id,
        name: 'Hamburguesas',
      },
    });

    await prisma.product.create({
      data: {
        restaurantId: restaurant.id,
        categoryId: category.id,
        name: 'Hamburguesa Clásica',
        description: 'Carne de res, queso, lechuga, tomate y salsa especial.',
        price: 120,
        imageUrl: 'https://picsum.photos/seed/burger1/400',
        isAvailable: true,
      },
    });

    await prisma.product.create({
      data: {
        restaurantId: restaurant.id,
        categoryId: category.id,
        name: 'Hamburguesa Doble',
        description: 'Doble carne de res, doble queso, tocino y salsa BBQ.',
        price: 180,
        imageUrl: 'https://picsum.photos/seed/burger2/400',
        isAvailable: true,
      },
    });
  }

  console.log('Seed completed successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
