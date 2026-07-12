import { Router } from 'express';
import 'dotenv/config';
import { prisma } from './db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { OAuth2Client } from 'google-auth-library';
import { GoogleGenAI, Type } from "@google/genai";
import { adminRouter } from './adminRoutes';
import rateLimit from 'express-rate-limit';
import {
  publicRegistrationRoleSchema,
  resolvePublicUserRole
} from './core/public-registration';
import { calculateOrderPricing, OrderPricingError } from './core/order-pricing';
import { isOwnedByRestaurant } from './core/ownership';
import {
  InvalidOrderTransitionError,
  resolveOrderTransition
} from './core/order-status';
import {
  getRestaurantReadiness,
  isRestaurantProfileMinimumComplete
} from './core/restaurant-readiness';
import { canConfigureRestaurant, canOperateRestaurant } from './core/restaurant-access';
import { logRestaurantFunnelEvent } from './core/funnel-events';

const googleClient = new OAuth2Client(process.env.VITE_GOOGLE_CLIENT_ID);

export const apiRouter = Router();
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
  validate: { xForwardedForHeader: false }
});

// Setup multer storage
const storage = multer.memoryStorage();

const upload = multer({ 
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG, PNG and WebP are allowed.'));
    }
  }
});

const processImage = async (req: any, res: any, next: any) => {
  if (!req.file) return next();

  let dest = 'uploads/';
  if (req.path.includes('/upload/menu')) {
    dest = 'uploads/menu/';
  } else if (req.path.includes('/upload/restaurant/cover')) {
    dest = 'uploads/restaurants/covers/';
  } else if (req.path.includes('/upload/restaurant')) {
    dest = 'uploads/restaurants/';
  } else if (req.path.includes('/upload/banner')) {
    dest = 'uploads/banners/';
  }

  fs.mkdirSync(dest, { recursive: true });

  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
  const filename = `${req.file.fieldname}-${uniqueSuffix}.webp`;
  const filepath = path.join(dest, filename);

  try {
    const image = sharp(req.file.buffer);
    const metadata = await image.metadata();
    
    // Resize if the image is too large (e.g., width > 1200px)
    if (metadata.width && metadata.width > 1200) {
      image.resize({ width: 1200, withoutEnlargement: true });
    }

    await image
      .webp({ quality: 80, effort: 6 }) // effort: 6 for better compression
      .toFile(filepath);
    
    req.file.path = filepath;
    req.file.filename = filename;
    next();
  } catch (error) {
    console.error('Error processing image:', error);
    res.status(500).json({ error: 'Error processing image' });
  }
};

// Cache middleware for public data
const cacheMiddleware = (duration: number) => {
  return (req: any, res: any, next: any) => {
    if (req.method === 'GET') {
      res.set('Cache-Control', `public, max-age=${duration}`);
    }
    next();
  };
};

apiRouter.use('/admin', adminRouter);

// Banners routes (Public)
apiRouter.get('/public/banners', cacheMiddleware(300), async (req, res) => {
  try {
    const { city } = req.query;
    
    let where: any = { active: true };
    
    if (city) {
      const cityStr = String(city);
      // If city is provided, match banners that are for this city OR banners that are global (city is null)
      where.OR = [
        { city: cityStr },
        { city: null },
        { city: '' }
      ];
    }

    const banners = await prisma.banner.findMany({
      where,
      orderBy: { order: 'asc' }
    });
    
    res.json(banners);
  } catch (error) {
    console.error('Error fetching banners:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

const phoneSchema = z.string().regex(/^\+?[0-9\s\-\(\)]{10,15}$/, "El número de teléfono no es válido");

// AI Route
apiRouter.post('/ai-assistant', async (req, res) => {
  try {
    const { query } = req.body;
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    const searchRestaurantsFunction = {
      name: "searchRestaurants",
      parameters: {
        type: Type.OBJECT,
        description: "Search for restaurants in the database based on cuisine, food type, or name.",
        properties: {
          searchTerm: {
            type: Type.STRING,
            description: "The food type, cuisine, or restaurant name to search for (e.g., 'pizza', 'italiana', 'sushi', 'tacos').",
          },
        },
        required: ["searchTerm"],
      },
    };

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: query,
      config: {
        systemInstruction: "You are a helpful food delivery assistant. If the user asks for food recommendations, use the searchRestaurants tool to find matches in our database. If the user asks for something else, answer politely.",
        tools: [{ functionDeclarations: [searchRestaurantsFunction] }],
      },
    });

    const functionCalls = response.functionCalls;
    let restaurants: any[] = [];
    let textResponse = response.text || "Aquí tienes algunas opciones que podrían gustarte:";

    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];
      if (call.name === "searchRestaurants") {
        const searchTerm = (call.args as any).searchTerm;
        
        restaurants = await prisma.restaurant.findMany({
          where: {
            isActive: true,
            status: 'approved',
            OR: [
              { restaurant_name: { contains: searchTerm } },
              { description: { contains: searchTerm } },
              { categories: { some: { name: { contains: searchTerm } } } },
              { products: { some: { name: { contains: searchTerm } } } }
            ]
          },
          take: 5
        });

        if (restaurants.length === 0) {
          textResponse = `Lo siento, no encontré restaurantes que ofrezcan "${searchTerm}" en este momento. ¿Te gustaría buscar otra cosa?`;
        } else {
          textResponse = `¡Encontré estas opciones para "${searchTerm}"!`;
        }
      }
    }

    res.json({ text: textResponse, restaurants });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'AI Error' });
  }
});

apiRouter.post('/ai/ask', async (req, res) => {
  try {
    const { query } = req.body;
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: query,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: {
              latitude: 19.4326, // Default to Mexico City for demo
              longitude: -99.1332
            }
          }
        }
      },
    });

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const places = chunks
      .filter((c: any) => c.maps?.uri)
      .map((c: any) => ({ uri: c.maps.uri, title: c.maps.title }));

    res.json({ text: response.text, places });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'AI Error' });
  }
});

function normalizeWhatsApp(phone: string): string {
  if (!phone) return phone;
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');
  if (!cleaned.startsWith('+')) {
    cleaned = '+52' + cleaned;
  }
  return cleaned;
}

export function generateSlug(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

const restaurantReadinessInclude = {
  categories: { include: { products: true } },
  products: true
} as const;

function toRestaurantSessionUser(restaurant: any) {
  return {
    id: restaurant.id,
    restaurantId: restaurant.id,
    email: restaurant.email,
    name: restaurant.restaurant_name,
    role: 'RESTAURANT',
    status: restaurant.status,
    isActive: restaurant.isActive
  };
}

function toRestaurantProfile(restaurant: any) {
  return {
    id: restaurant.id,
    restaurant_name: restaurant.restaurant_name,
    owner_name: restaurant.owner_name,
    email: restaurant.email,
    phone_number: restaurant.phone_number,
    address: restaurant.address,
    city: restaurant.city,
    description: restaurant.description,
    logo_url: restaurant.logo_url,
    coverUrl: restaurant.coverUrl,
    cover_image: restaurant.cover_image,
    lat: restaurant.lat,
    lng: restaurant.lng,
    has_delivery: restaurant.has_delivery,
    has_pickup: restaurant.has_pickup,
    deliveryFeeCents: restaurant.deliveryFeeCents,
    opening_hours: restaurant.opening_hours,
    status: restaurant.status,
    isActive: restaurant.isActive
  };
}

async function loadRestaurantWithReadiness(restaurantId: string) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    include: restaurantReadinessInclude
  });
  if (!restaurant) return null;
  return { restaurant, readiness: getRestaurantReadiness(restaurant) };
}

async function logReadinessMilestones(restaurantId: string): Promise<void> {
  const result = await loadRestaurantWithReadiness(restaurantId);
  if (!result) return;
  if (isRestaurantProfileMinimumComplete(result.readiness)) {
    logRestaurantFunnelEvent('restaurant_profile_minimum_completed', restaurantId);
  }
  if (result.readiness.ready) {
    logRestaurantFunnelEvent('restaurant_ready', restaurantId);
  }
}
const publicReadyRestaurantWhere: any = {
  status: 'approved',
  isActive: true,
  AND: [
    { restaurant_name: { not: '' } },
    { phone_number: { not: '' } },
    { OR: [
      { AND: [{ address: { not: null } }, { address: { not: '' } }] },
      { AND: [{ lat: { not: null } }, { lng: { not: null } }] }
    ] },
    { opening_hours: { not: null } },
    { opening_hours: { not: '' } },
    { OR: [{ has_pickup: true }, { has_delivery: true }] },
    { categories: { some: {} } },
    { products: { some: { isAvailable: true, price: { gt: 0 } } } }
  ]
};
// Auth routes
const registerSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  name: z.string().min(2, "El nombre es muy corto"),
  phone: z.string().optional(),
  role: publicRegistrationRoleSchema.optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  category: z.string().optional(),
  instagram: z.string().optional(),
  owner_name: z.string().optional(),
  has_delivery: z.boolean().optional(),
  has_pickup: z.boolean().optional(),
});

apiRouter.post('/auth/register', authLimiter, async (req, res) => {
  try {
    const validatedData = registerSchema.parse(req.body);
    const { email, password, name, phone, role, city, address, category, instagram, owner_name, has_delivery, has_pickup } = validatedData;
    
    let normalizedPhone = phone || '';
    if (phone) {
      normalizedPhone = normalizeWhatsApp(phone);
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    const existingRestaurant = await prisma.restaurant.findUnique({ where: { email } });
    
    if (existingUser || existingRestaurant) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    if (resolvePublicUserRole(role) === 'RESTAURANT') {
      const restaurant = await prisma.$transaction(async tx => {
        const created = await tx.restaurant.create({
          data: {
            restaurant_name: name,
            owner_name: owner_name || name,
            email,
            password_hash: hashedPassword,
            phone_number: normalizedPhone,
            city,
            address,
            description: category,
            status: 'pending_verification',
            isActive: false,
            has_delivery: has_delivery || false,
            has_pickup: has_pickup || false
          }
        });

        await tx.restaurantDirectory.create({
          data: {
            name,
            city: city || '',
            address: address || '',
            cuisine_type: category || '',
            phone: normalizedPhone,
            whatsapp: normalizedPhone,
            instagram: instagram || '',
            status: 'PENDING'
          }
        });
        return created;
      });

      const token = jwt.sign(
        { userId: restaurant.id, role: 'RESTAURANT' },
        JWT_SECRET,
        { expiresIn: '7d' }
      );
      logRestaurantFunnelEvent('restaurant_registered', restaurant.id);
      return res.status(201).json({
        message: 'Restaurant registered successfully. Complete onboarding while verification is pending.',
        token,
        user: toRestaurantSessionUser(restaurant)
      });    } else {
      const user = await prisma.user.create({
        data: { email, password_hash: hashedPassword, name, phone: normalizedPhone, role: 'CLIENT', provider: 'email' }
      });


      const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
    }
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message });
    }
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

apiRouter.post('/auth/login', authLimiter, async (req, res) => {
  try {
    const validatedData = loginSchema.parse(req.body);
    const { email, password } = validatedData;
    
    // Check user
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      if (!user.password_hash) return res.status(400).json({ error: 'Please login with Google' });
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) return res.status(400).json({ error: 'Invalid credentials' });

      const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
    }

    // Check restaurant
    const restaurant = await prisma.restaurant.findUnique({ where: { email } });
    if (restaurant) {
      const valid = await bcrypt.compare(password, restaurant.password_hash);
      if (!valid) return res.status(400).json({ error: 'Invalid credentials' });

      if (restaurant.status === 'rejected') {
        return res.status(403).json({ error: 'Tu solicitud de restaurante fue rechazada.' });
      }
      if (restaurant.status === 'suspended') {
        return res.status(403).json({ error: 'Tu restaurante está suspendido.' });
      }

      const token = jwt.sign({ userId: restaurant.id, role: 'RESTAURANT' }, JWT_SECRET, { expiresIn: '7d' });
      logRestaurantFunnelEvent('restaurant_first_login', restaurant.id);
      return res.json({ token, user: toRestaurantSessionUser(restaurant) });
    }

    return res.status(400).json({ error: 'Invalid credentials' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

apiRouter.post('/auth/google', authLimiter, async (req, res) => {
  try {
    const { token } = req.body;
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.VITE_GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(400).json({ error: 'Invalid Google token' });
    }

    const { email, name, picture } = payload;

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: name || 'Usuario',
          profile_image: picture,
          provider: 'google',
          role: 'CLIENT'
        }
      });
    }

    const jwtToken = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token: jwtToken, user: { id: user.id, email: user.email, name: user.name, role: user.role, profile_image: user.profile_image } });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ error: 'Google authentication failed' });
  }
});

// Middleware to check auth
export const authMiddleware = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Upload routes
apiRouter.post('/upload/menu', authMiddleware, upload.single('image'), processImage, (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const imageUrl = `${process.env.API_URL || ''}/${req.file.path.replace(/\\/g, '/')}`;
  res.json({ imageUrl });
});

apiRouter.post('/upload/restaurant', authMiddleware, upload.single('image'), processImage, (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const imageUrl = `${process.env.API_URL || ''}/${req.file.path.replace(/\\/g, '/')}`;
  res.json({ imageUrl });
});

apiRouter.post('/upload/restaurant/cover', authMiddleware, upload.single('image'), processImage, (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const imageUrl = `${process.env.API_URL || ''}/${req.file.path.replace(/\\/g, '/')}`;
  res.json({ imageUrl });
});

apiRouter.post('/upload/banner', authMiddleware, upload.single('image'), processImage, (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const imageUrl = `${process.env.API_URL || ''}/${req.file.path.replace(/\\/g, '/')}`;
  res.json({ imageUrl });
});

// Middleware to check auth optionally
export const optionalAuthMiddleware = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
    } catch (e) {
      // Ignore invalid token for optional auth
    }
  }
  next();
};

// Get current user profile
apiRouter.get('/auth/me', authMiddleware, async (req: any, res) => {
  try {
    if (req.user.role === 'RESTAURANT') {
      const restaurant = await prisma.restaurant.findUnique({
        where: { id: req.user.userId }
      });
      if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
      return res.json({ user: toRestaurantSessionUser(restaurant) });
    } else {
      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { id: true, name: true, email: true, phone: true, role: true, profile_image: true, isSuspended: true }
      });
      if (!user) return res.status(404).json({ error: 'User not found' });
      return res.json({ user });
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Restaurants routes
apiRouter.get('/restaurants', cacheMiddleware(60), async (req, res, next) => {
  try {
    const { city, page, limit, has_delivery, has_pickup } = req.query;
  const where: any = { ...publicReadyRestaurantWhere };
  
  if (has_delivery === 'true') {
    where.has_delivery = true;
  }
  if (has_pickup === 'true') {
    where.has_pickup = true;
  }
  
  const pageNumber = parseInt(page as string) || 1;
  const pageSize = parseInt(limit as string) || 50; // Default to 50 for backward compatibility if not provided
  const skip = (pageNumber - 1) * pageSize;

  if (city) {
    const cityStr = String(city);
    const isSlug = /^[a-z0-9-]+$/.test(cityStr);
    if (isSlug) {
      const allRestaurants = await prisma.restaurant.findMany({
        where,
        include: { categories: { include: { products: true } } },
        orderBy: { total_orders: 'desc' }
      });
      const filtered = allRestaurants.filter(r => 
        (r.city && generateSlug(r.city) === cityStr) || 
        (r.address && generateSlug(r.address).includes(cityStr))
      );
      
      const paginatedFiltered = filtered.slice(skip, skip + pageSize);
      return res.json({
        data: paginatedFiltered,
        pagination: {
          total: filtered.length,
          page: pageNumber,
          limit: pageSize,
          totalPages: Math.ceil(filtered.length / pageSize)
        }
      });
    } else {
      where.OR = [
        { city: { equals: cityStr } },
        { address: { contains: cityStr } }
      ];
    }
  }

  const [total, restaurants] = await Promise.all([
    prisma.restaurant.count({ where }),
    prisma.restaurant.findMany({
      where,
      include: { categories: { include: { products: true } } },
      orderBy: {
        total_orders: 'desc'
      },
      skip,
      take: pageSize
    })
  ]);

  res.json({
    data: restaurants,
    pagination: {
      total,
      page: pageNumber,
      limit: pageSize,
      totalPages: Math.ceil(total / pageSize)
    }
  });
  } catch (error) {
    next(error);
  }
});

apiRouter.get('/popular-today', cacheMiddleware(180), async (req, res) => {
  try {
    const { city } = req.query;
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);

    const where: any = {
      createdAt: { gte: yesterday },
      status: { in: ['DELIVERED', 'COMPLETED'] },
      restaurant: publicReadyRestaurantWhere
    };

    if (city) {
      const cityStr = String(city);
      const isSlug = /^[a-z0-9-]+$/.test(cityStr);
      if (isSlug) {
        where.restaurant = { ...publicReadyRestaurantWhere, city: { contains: cityStr } };
      } else {
        where.restaurant = { ...publicReadyRestaurantWhere, city: { contains: cityStr } };
      }
    }

    const recentOrders = await prisma.order.findMany({
      where,
      include: {
        items: {
          include: {
            product: {
              include: {
                restaurant: true
              }
            }
          }
        }
      }
    });

    const productCounts: Record<string, { count: number, product: any }> = {};

    recentOrders.forEach(order => {
      order.items.forEach(item => {
        if (item.product) {
          if (!productCounts[item.productId]) {
            productCounts[item.productId] = { count: 0, product: item.product };
          }
          productCounts[item.productId].count += item.quantity;
        }
      });
    });

    const popularProducts = Object.values(productCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(p => ({ ...p.product, recent_orders: p.count }));

    if (popularProducts.length === 0) {
      const fallbackProducts = await prisma.product.findMany({
        where: { isAvailable: true, restaurant: publicReadyRestaurantWhere },
        take: 10,
        include: { restaurant: true }
      });
      return res.json(fallbackProducts.map(p => ({ ...p, recent_orders: Math.floor(Math.random() * 10) + 1 })));
    }

    res.json(popularProducts);
  } catch (error) {
    console.error('Error fetching popular products:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

apiRouter.get('/directory', cacheMiddleware(60), async (req, res) => {
  try {
    const { search, city, cuisine, page, limit, has_delivery, has_pickup } = req.query;
    const whereDir: any = { status: 'UNCLAIMED' };
    const whereRest: any = { ...publicReadyRestaurantWhere };
    
    if (has_delivery === 'true') {
      whereRest.has_delivery = true;
    }
    if (has_pickup === 'true') {
      whereRest.has_pickup = true;
    }
    
    const pageNumber = parseInt(page as string) || 1;
    const pageSize = parseInt(limit as string) || 50;
    const skip = (pageNumber - 1) * pageSize;

    if (search) {
      whereDir.name = { contains: String(search) };
      whereRest.restaurant_name = { contains: String(search) };
    }
    
    const cityStr = city ? String(city) : null;
    const isCitySlug = cityStr && /^[a-z0-9-]+$/.test(cityStr);
    
    if (cityStr && !isCitySlug) {
      whereDir.city = { contains: cityStr };
      whereRest.OR = [
        { city: { equals: cityStr } },
        { address: { contains: cityStr } }
      ];
    }

    const cuisineStr = cuisine ? String(cuisine) : null;
    const isCuisineSlug = cuisineStr && /^[a-z0-9-]+$/.test(cuisineStr);

    if (cuisineStr && !isCuisineSlug) {
      whereDir.cuisine_type = { contains: cuisineStr };
      whereRest.description = { contains: cuisineStr };
    }
    
    let directory: any[] = [];
    if (has_delivery !== 'true' && has_pickup !== 'true') {
      directory = await prisma.restaurantDirectory.findMany({
        where: whereDir,
        orderBy: { name: 'asc' }
      });
    }

    let registered = await prisma.restaurant.findMany({
      where: whereRest,
      orderBy: { restaurant_name: 'asc' }
    });

    if (isCitySlug) {
      directory = directory.filter(d => d.city && generateSlug(d.city) === cityStr);
      registered = registered.filter(r => 
        (r.city && generateSlug(r.city) === cityStr) || 
        (r.address && generateSlug(r.address).includes(cityStr))
      );
    }

    if (isCuisineSlug) {
      directory = directory.filter(d => d.cuisine_type && generateSlug(d.cuisine_type).includes(cuisineStr));
      registered = registered.filter(r => 
        (r.description && generateSlug(r.description).includes(cuisineStr)) ||
        (r.restaurant_name && generateSlug(r.restaurant_name).includes(cuisineStr))
      );
    }

    const combined = [
      ...registered.map(r => ({
        id: r.id,
        name: r.restaurant_name,
        city: r.city || (r.address ? r.address.split(',')[0] : 'Desconocido'),
        address: r.address || 'Sin dirección',
        cuisine_type: r.description || 'Varios',
        image_url: r.cover_image || r.coverUrl || r.logo_url || null,
        phone_optional: r.phone_number,
        status: 'approved',
        createdAt: r.createdAt,
        opening_hours: r.opening_hours
      })),
      ...directory
    ];

    combined.sort((a, b) => a.name.localeCompare(b.name));

    const paginatedCombined = combined.slice(skip, skip + pageSize);

    res.json({
      data: paginatedCombined,
      pagination: {
        total: combined.length,
        page: pageNumber,
        limit: pageSize,
        totalPages: Math.ceil(combined.length / pageSize)
      }
    });
  } catch (error) {
    console.error('Error fetching directory:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

apiRouter.get('/restaurants/slug/:slug', async (req, res) => {
  const { slug } = req.params;

  const restaurants = await prisma.restaurant.findMany({
    where: publicReadyRestaurantWhere,
    include: {
      categories: { include: { products: { orderBy: { order_count: 'desc' } } } },
      products: true,
      ratings: { include: { user: { select: { name: true } } } }
    }
  });
  const restaurant = restaurants.find(item => generateSlug(item.restaurant_name) === slug);

  if (restaurant) {
    const readiness = getRestaurantReadiness(restaurant);
    if (!canOperateRestaurant(restaurant, readiness)) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    const { password_hash: _passwordHash, products: _products, ...publicRestaurant } = restaurant;
    return res.json(publicRestaurant);
  }

  const directoryNames = await prisma.restaurantDirectory.findMany({
    where: { status: 'UNCLAIMED' },
    select: { id: true, name: true }
  });
  const directoryMatch = directoryNames.find(item => generateSlug(item.name) === slug);
  if (directoryMatch) {
    const directory = await prisma.restaurantDirectory.findUnique({ where: { id: directoryMatch.id } });
    return res.json(directory);
  }

  return res.status(404).json({ error: 'Restaurant not found' });
});
let trendingCache: { data: any, timestamp: number } | null = null;

apiRouter.get('/restaurants/trending', async (req, res) => {
  try {
    const now = Date.now();
    if (trendingCache && now - trendingCache.timestamp < 5 * 60 * 1000) {
      return res.json(trendingCache.data);
    }

    const restaurants = await prisma.restaurant.findMany({
      where: publicReadyRestaurantWhere,
      select: {
        id: true,
        restaurant_name: true,
        description: true,
        logo_url: true,
        coverUrl: true,
        city: true,
        total_orders: true,
        orders_today: true,
        rating_score: true,
        rating_count: true
      }
    });

    const trending = restaurants.map(r => {
      const score = (r.orders_today * 0.7) + (r.total_orders * 0.2) + (r.rating_score * r.rating_count * 0.1);
      return { ...r, trendingScore: score };
    })
    .sort((a, b) => b.trendingScore - a.trendingScore)
    .slice(0, 10);

    trendingCache = { data: trending, timestamp: now };
    res.json(trending);
  } catch (error) {
    console.error('Error fetching trending restaurants:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

apiRouter.get('/restaurants/:id/social-proof', async (req, res) => {
  try {
    const { id } = req.params;
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    const recentOrdersCount = await prisma.order.count({
      where: {
        restaurantId: id,
        createdAt: { gte: thirtyMinutesAgo }
      }
    });

    res.json({ recentOrders: recentOrdersCount });
  } catch (error) {
    console.error('Error fetching social proof:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

apiRouter.get('/restaurants/:id', async (req, res) => {
  const restaurant = await prisma.restaurant.findFirst({
    where: { id: req.params.id, ...publicReadyRestaurantWhere },
    include: {
      categories: { include: { products: true } },
      products: true,
      ratings: { include: { user: { select: { name: true } } } }
    }
  });

  if (restaurant) {
    const readiness = getRestaurantReadiness(restaurant);
    if (!canOperateRestaurant(restaurant, readiness)) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    const { password_hash: _passwordHash, products: _products, ...publicRestaurant } = restaurant;
    return res.json(publicRestaurant);
  }

  const directory = await prisma.restaurantDirectory.findUnique({
    where: { id: req.params.id, status: 'UNCLAIMED' }
  });

  if (directory) {
    return res.json({ ...directory, status: directory.status });
  }

  res.status(404).json({ error: 'Restaurant not found' });
});

apiRouter.post('/restaurants/:id/ratings', authMiddleware, async (req: any, res) => {
  try {
    const { rating, comment } = req.body;
    const restaurantId = req.params.id;
    const userId = req.user.userId;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Invalid rating' });
    }

    const newRating = await prisma.rating.create({
      data: {
        user_id: userId,
        restaurant_id: restaurantId,
        rating,
        comment
      }
    });

    res.json(newRating);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

apiRouter.post('/invitations', async (req, res) => {
  const { restaurant_name, city, phone, instagram } = req.body;
  const normalizedPhone = normalizeWhatsApp(phone);
  
  const existing = await prisma.restaurantInvitation.findFirst({
    where: { 
      restaurant_name: { equals: restaurant_name },
      city: { equals: city }
    }
  });

  if (existing) {
    const updated = await prisma.restaurantInvitation.update({
      where: { id: existing.id },
      data: { 
        request_count: existing.request_count + 1,
        phone: normalizedPhone || existing.phone,
        instagram: instagram || existing.instagram
      }
    });
    return res.json(updated);
  }

  const invite = await prisma.restaurantInvitation.create({
    data: {
      restaurant_name,
      city,
      phone: normalizedPhone,
      instagram,
      request_count: 1
    }
  });
  res.json(invite);
});

apiRouter.post('/directory/:id/claim', async (req, res) => {
  const directoryId = req.params.id;
  const { name, phone, email, restaurant_name, verification_message } = req.body;
  
  const claim = await prisma.restaurantClaimRequest.create({
    data: {
      restaurantDirectoryId: directoryId,
      name,
      phone,
      email,
      restaurant_name,
      verification_message
    }
  });
  res.json(claim);
});

const getRestaurantId = (req: any) => {
  if (req.user.role === 'ADMIN' && req.query.restaurantId) {
    return req.query.restaurantId;
  }
  if (req.user.role === 'RESTAURANT') {
    return req.user.userId;
  }
  return null;
};

// Restaurant configuration routes (available to pending and approved restaurants).
const restaurantProfileSchema = z.object({
  name: z.string().trim().min(2).optional(),
  description: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  cover_image: z.string().optional(),
  logoUrl: z.string().optional(),
  opening_hours: z.string().optional(),
  has_delivery: z.boolean().optional(),
  has_pickup: z.boolean().optional(),
  deliveryFeeCents: z.number().int().nonnegative().optional()
}).strict();

const categoryPayloadSchema = z.object({ name: z.string().trim().min(1) }).strict();
const productPayloadSchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().trim().min(1),
  description: z.string().optional(),
  price: z.number().positive().finite(),
  imageUrl: z.string().optional(),
  isAvailable: z.boolean()
}).strict();

apiRouter.get('/restaurant/profile', authMiddleware, async (req: any, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    if (!restaurantId) return res.status(403).json({ error: 'Forbidden' });
    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
    if (!canConfigureRestaurant(restaurant)) return res.status(403).json({ error: 'Restaurant cannot be configured in its current state' });
    res.json(toRestaurantProfile(restaurant));
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

apiRouter.get('/restaurant/readiness', authMiddleware, async (req: any, res) => {
  const restaurantId = getRestaurantId(req);
  if (!restaurantId) return res.status(403).json({ error: 'Forbidden' });
  const result = await loadRestaurantWithReadiness(restaurantId);
  if (!result) return res.status(404).json({ error: 'Restaurant not found' });
  if (!canConfigureRestaurant(result.restaurant)) return res.status(403).json({ error: 'Forbidden' });
  res.json({
    ...result.readiness,
    status: result.restaurant.status,
    isActive: result.restaurant.isActive,
    canReceiveOrders: canOperateRestaurant(result.restaurant, result.readiness)
  });
});

apiRouter.put('/restaurant/profile', authMiddleware, async (req: any, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    if (!restaurantId) return res.status(403).json({ error: 'Forbidden' });
    const existing = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!existing) return res.status(404).json({ error: 'Restaurant not found' });
    if (!canConfigureRestaurant(existing)) return res.status(403).json({ error: 'Restaurant cannot be configured in its current state' });

    const data = restaurantProfileSchema.parse(req.body);
    if (data.has_delivery === false && data.has_pickup === false) {
      return res.status(400).json({ error: 'At least one fulfillment method must be enabled' });
    }

    const restaurant = await prisma.restaurant.update({
      where: { id: restaurantId },
      data: {
        restaurant_name: data.name,
        description: data.description,
        phone_number: data.phone,
        address: data.address,
        city: data.city,
        cover_image: data.cover_image,
        coverUrl: data.cover_image,
        logo_url: data.logoUrl,
        opening_hours: data.opening_hours,
        has_delivery: data.has_delivery,
        has_pickup: data.has_pickup,
        deliveryFeeCents: data.deliveryFeeCents
      }
    });
    await logReadinessMilestones(restaurantId);
    res.json(toRestaurantProfile(restaurant));
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.issues[0].message });
    res.status(500).json({ error: 'Server error' });
  }
});
async function loadConfigurableRestaurant(restaurantId: string) {
  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
  return restaurant && canConfigureRestaurant(restaurant) ? restaurant : null;
}

apiRouter.get('/restaurant/menu', authMiddleware, async (req: any, res) => {
  const restaurantId = getRestaurantId(req);
  if (!restaurantId) return res.status(403).json({ error: 'Forbidden' });
  const restaurant = await loadConfigurableRestaurant(restaurantId);
  if (!restaurant) return res.status(403).json({ error: 'Restaurant cannot be configured in its current state' });
  const categories = await prisma.category.findMany({
    where: { restaurantId },
    include: { products: true }
  });
  res.json(categories);
});

apiRouter.post('/restaurant/categories', authMiddleware, async (req: any, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    if (!restaurantId) return res.status(403).json({ error: 'Forbidden' });
    if (!await loadConfigurableRestaurant(restaurantId)) return res.status(403).json({ error: 'Restaurant cannot be configured in its current state' });
    const { name } = categoryPayloadSchema.parse(req.body);
    const category = await prisma.category.create({ data: { name, restaurantId } });
    await logReadinessMilestones(restaurantId);
    res.status(201).json(category);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.issues[0].message });
    res.status(500).json({ error: 'Server error' });
  }
});

apiRouter.put('/restaurant/categories/:id', authMiddleware, async (req: any, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    if (!restaurantId) return res.status(403).json({ error: 'Forbidden' });
    if (!await loadConfigurableRestaurant(restaurantId)) return res.status(403).json({ error: 'Restaurant cannot be configured in its current state' });
    const category = await prisma.category.findUnique({ where: { id: req.params.id } });
    if (!category) return res.status(404).json({ error: 'Category not found' });
    if (!isOwnedByRestaurant(category, restaurantId)) return res.status(403).json({ error: 'Forbidden: You do not own this category' });
    const { name } = categoryPayloadSchema.parse(req.body);
    res.json(await prisma.category.update({ where: { id: category.id }, data: { name } }));
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.issues[0].message });
    res.status(500).json({ error: 'Server error' });
  }
});

apiRouter.delete('/restaurant/categories/:id', authMiddleware, async (req: any, res) => {
  const restaurantId = getRestaurantId(req);
  if (!restaurantId) return res.status(403).json({ error: 'Forbidden' });
  if (!await loadConfigurableRestaurant(restaurantId)) return res.status(403).json({ error: 'Restaurant cannot be configured in its current state' });
  const category = await prisma.category.findUnique({ where: { id: req.params.id } });
  if (!category) return res.status(404).json({ error: 'Category not found' });
  if (!isOwnedByRestaurant(category, restaurantId)) return res.status(403).json({ error: 'Forbidden: You do not own this category' });
  await prisma.$transaction([
    prisma.product.deleteMany({ where: { categoryId: category.id } }),
    prisma.category.delete({ where: { id: category.id } })
  ]);
  res.json({ success: true });
});

apiRouter.post('/restaurant/products', authMiddleware, async (req: any, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    if (!restaurantId) return res.status(403).json({ error: 'Forbidden' });
    if (!await loadConfigurableRestaurant(restaurantId)) return res.status(403).json({ error: 'Restaurant cannot be configured in its current state' });
    const data = productPayloadSchema.parse(req.body);
    const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!category) return res.status(404).json({ error: 'Category not found' });
    if (!isOwnedByRestaurant(category, restaurantId)) return res.status(403).json({ error: 'Forbidden: You do not own this category' });
    const product = await prisma.product.create({ data: { ...data, restaurantId } });
    logRestaurantFunnelEvent('restaurant_first_product_created', restaurantId);
    await logReadinessMilestones(restaurantId);
    res.status(201).json(product);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.issues[0].message });
    res.status(500).json({ error: 'Server error' });
  }
});

apiRouter.put('/restaurant/products/:id', authMiddleware, async (req: any, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    if (!restaurantId) return res.status(403).json({ error: 'Forbidden' });
    if (!await loadConfigurableRestaurant(restaurantId)) return res.status(403).json({ error: 'Restaurant cannot be configured in its current state' });
    const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Product not found' });
    if (!isOwnedByRestaurant(existing, restaurantId)) return res.status(403).json({ error: 'Forbidden: You do not own this product' });
    const data = productPayloadSchema.parse(req.body);
    const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!category) return res.status(404).json({ error: 'Category not found' });
    if (!isOwnedByRestaurant(category, restaurantId)) return res.status(403).json({ error: 'Forbidden: You do not own this category' });
    const product = await prisma.product.update({ where: { id: existing.id }, data });
    await logReadinessMilestones(restaurantId);
    res.json(product);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.issues[0].message });
    res.status(500).json({ error: 'Server error' });
  }
});

apiRouter.delete('/restaurant/products/:id', authMiddleware, async (req: any, res) => {
  const restaurantId = getRestaurantId(req);
  if (!restaurantId) return res.status(403).json({ error: 'Forbidden' });
  if (!await loadConfigurableRestaurant(restaurantId)) return res.status(403).json({ error: 'Restaurant cannot be configured in its current state' });
  const product = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!product) return res.status(404).json({ error: 'Product not found' });
  if (!isOwnedByRestaurant(product, restaurantId)) return res.status(403).json({ error: 'Forbidden: You do not own this product' });
  await prisma.product.delete({ where: { id: product.id } });
  res.json({ success: true });
});
// Orders routes
const createOrderSchema = z.object({
  restaurantId: z.string().min(1),
  fulfillmentType: z.enum(['PICKUP', 'DELIVERY']),
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().int().positive(),
    options: z.array(z.unknown()).optional()
  }).strict()).min(1),
  deliveryAddress: z.string().trim().optional(),
  deliveryLat: z.number().optional(),
  deliveryLng: z.number().optional(),
  guestName: z.string().optional(),
  guestPhone: z.string().optional()
}).strict();

apiRouter.post('/orders', optionalAuthMiddleware, async (req: any, res) => {
  try {
    const input = createOrderSchema.parse(req.body);
    if (!req.user && (!input.guestName || !input.guestPhone)) {
      return res.status(400).json({ error: 'Guest name and phone are required for unauthenticated orders' });
    }

    let normalizedGuestPhone = input.guestPhone;
    if (input.guestPhone) {
      const phoneValidation = phoneSchema.safeParse(input.guestPhone);
      if (!phoneValidation.success) return res.status(400).json({ error: phoneValidation.error.issues[0].message });
      normalizedGuestPhone = normalizeWhatsApp(input.guestPhone);
    }

    const restaurantResult = await loadRestaurantWithReadiness(input.restaurantId);
    if (!restaurantResult || !canOperateRestaurant(restaurantResult.restaurant, restaurantResult.readiness)) {
      return res.status(404).json({ error: 'Restaurant not found or not accepting orders' });
    }
    const restaurant = restaurantResult.restaurant;
    if (input.fulfillmentType === 'PICKUP' && !restaurant.has_pickup) {
      return res.status(400).json({ error: 'Pickup is not enabled for this restaurant' });
    }
    if (input.fulfillmentType === 'DELIVERY' && !restaurant.has_delivery) {
      return res.status(400).json({ error: 'Delivery is not enabled for this restaurant' });
    }
    if (input.fulfillmentType === 'DELIVERY' && !input.deliveryAddress) {
      return res.status(400).json({ error: 'Delivery address is required for delivery orders' });
    }

    const productIds = [...new Set(input.items.map(item => item.productId))];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, restaurantId: true, price: true, isAvailable: true }
    });
    const pricing = calculateOrderPricing(
      input.restaurantId,
      input.items,
      products,
      input.fulfillmentType,
      restaurant.deliveryFeeCents
    );

    const order = await prisma.order.create({
      data: {
        clientId: req.user?.role === 'CLIENT' ? req.user.userId : null,
        guestName: req.user?.role === 'CLIENT' ? null : input.guestName,
        guestPhone: req.user?.role === 'CLIENT' ? null : normalizedGuestPhone,
        restaurantId: input.restaurantId,
        totalAmount: pricing.totalAmount,
        fulfillmentType: input.fulfillmentType,
        deliveryFeeCents: pricing.deliveryFeeCents,
        deliveryAddress: input.fulfillmentType === 'PICKUP'
          ? (restaurant.address || restaurant.restaurant_name)
          : input.deliveryAddress!,
        deliveryLat: input.fulfillmentType === 'DELIVERY' ? input.deliveryLat : restaurant.lat,
        deliveryLng: input.fulfillmentType === 'DELIVERY' ? input.deliveryLng : restaurant.lng,
        status: 'PENDING',
        trackingToken: Math.random().toString(36).substring(2, 15),
        items: {
          create: pricing.items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            options: JSON.stringify(item.options || [])
          }))
        },
        statusHistory: { create: { status: 'PENDING', notes: 'Order placed' } }
      },
      include: { items: { include: { product: true } }, restaurant: true, client: true }
    });

    logRestaurantFunnelEvent('restaurant_first_order_received', order.restaurantId, { orderId: order.id });
    const io = req.app.get('io');
    if (io) io.emit('newOrder', order);
    res.status(201).json(order);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.issues[0].message });
    if (error instanceof OrderPricingError) return res.status(400).json({ error: error.message });
    res.status(500).json({ error: 'Server error' });
  }
});
apiRouter.get('/orders', authMiddleware, async (req: any, res) => {
  try {
    let where;
    if (req.user.role === 'CLIENT') {
      where = { clientId: req.user.userId };
    } else if (req.user.role === 'RESTAURANT') {
      const result = await loadRestaurantWithReadiness(req.user.userId);
      if (!result || !canOperateRestaurant(result.restaurant, result.readiness)) {
        return res.status(403).json({ error: 'Restaurant is not approved and ready to receive orders' });
      }
      where = { restaurantId: result.restaurant.id };
    } else if (req.user.role === 'DRIVER') {
      const driver = await prisma.deliveryDriver.findUnique({ where: { userId: req.user.userId } });
      if (!driver) return res.status(403).json({ error: 'Forbidden' });
      where = { driverId: driver.id };
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    const orders = await prisma.order.findMany({
      where,
      include: { restaurant: true, items: { include: { product: true } }, driver: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

apiRouter.get('/restaurant/orders', authMiddleware, async (req: any, res) => {
  try {
    if (req.user.role !== 'RESTAURANT') return res.status(403).json({ error: 'Forbidden' });
    const result = await loadRestaurantWithReadiness(req.user.userId);
    if (!result) return res.status(404).json({ error: 'Restaurant not found' });
    if (!canOperateRestaurant(result.restaurant, result.readiness)) {
      return res.status(403).json({ error: 'Restaurant is not approved and ready to receive orders' });
    }
    const restaurant = result.restaurant;

    const orders = await prisma.order.findMany({
      where: { restaurantId: restaurant.id },
      include: { items: { include: { product: true } }, client: true, driver: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

apiRouter.patch('/orders/:id/status', authMiddleware, async (req: any, res) => {
  try {
    const orderToUpdate = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!orderToUpdate) return res.status(404).json({ error: 'Order not found' });

    if (req.user.role === 'RESTAURANT') {
      const result = await loadRestaurantWithReadiness(req.user.userId);
      if (!result || !canOperateRestaurant(result.restaurant, result.readiness) || orderToUpdate.restaurantId !== result.restaurant.id) {
        return res.status(403).json({ error: 'Forbidden: Restaurant cannot operate this order' });
      }
    } else if (req.user.role === 'DRIVER') {
      const driver = await prisma.deliveryDriver.findUnique({ where: { userId: req.user.userId } });
      if (!driver || orderToUpdate.driverId !== driver.id) {
        return res.status(403).json({ error: 'Forbidden: You are not assigned to this order' });
      }
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const status = resolveOrderTransition(orderToUpdate.status, req.body.status);

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status },
      include: { restaurant: true, client: true, items: true }
    });
    await prisma.orderStatusHistory.create({
      data: { orderId: order.id, status, notes: `Status updated to ${status}` }
    });

    if (status === 'DELIVERED') {
      for (const item of order.items) {
        await prisma.product.update({
          where: { id: item.productId },
          data: { 
            order_count: { increment: item.quantity },
            order_count_today: { increment: item.quantity }
          }
        });
      }
      
      await prisma.restaurant.update({
        where: { id: order.restaurantId },
        data: {
          total_orders: { increment: 1 },
          orders_today: { increment: 1 }
        }
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('orderStatusUpdated', { orderId: order.id, status });
      io.to(`order_${order.id}`).emit('orderStatusUpdated', { orderId: order.id, status });
    }

    res.json(order);
  } catch (error) {
    if (error instanceof InvalidOrderTransitionError) {
      return res.status(409).json({ error: error.message });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

apiRouter.get('/orders/:id/tracking', async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { 
        restaurant: true, 
        driver: true, 
        items: { include: { product: true } },
        trackingLocations: { orderBy: { timestamp: 'desc' }, take: 1 } 
      }
    });
    
    if (!order) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }
    
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});
