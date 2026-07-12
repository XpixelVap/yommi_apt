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
  console.log('Register route hit:', req.body);
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
      const restaurant = await prisma.restaurant.create({
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
          has_delivery: has_delivery || false,
          has_pickup: has_pickup || false
        }
      });
      
      // Also add to directory
      await prisma.restaurantDirectory.create({
        data: {
          name: name,
          city: city || '',
          address: address || '',
          cuisine_type: category || '',
          phone: normalizedPhone,
          whatsapp: normalizedPhone,
          instagram: instagram || '',
          status: 'UNCLAIMED'
        }
      });

      return res.json({ message: 'Restaurant registered successfully. Pending verification.' });
    } else {
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

      if (restaurant.status === 'pending_verification') {
        return res.status(403).json({ error: 'Tu restaurante está pendiente de verificación.' });
      }
      if (restaurant.status === 'rejected') {
        return res.status(403).json({ error: 'Tu solicitud de restaurante fue rechazada.' });
      }
      if (restaurant.status === 'suspended') {
        return res.status(403).json({ error: 'Tu restaurante está suspendido.' });
      }

      const token = jwt.sign({ userId: restaurant.id, role: 'RESTAURANT' }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({ token, user: { id: restaurant.id, email: restaurant.email, name: restaurant.restaurant_name, role: 'RESTAURANT' } });
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
      return res.json({ user: { ...restaurant, role: 'RESTAURANT' } });
    } else {
      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        include: { driver: true }
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
  const where: any = { isActive: true, status: 'approved' };
  
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
      status: { in: ['DELIVERED', 'COMPLETED'] }
    };

    if (city) {
      const cityStr = String(city);
      const isSlug = /^[a-z0-9-]+$/.test(cityStr);
      if (isSlug) {
        where.restaurant = {
          city: { contains: cityStr } // Simple search, ideally we'd filter by slug properly
        };
      } else {
        where.restaurant = {
          city: { contains: cityStr }
        };
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
        where: { isAvailable: true },
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
    const whereRest: any = { isActive: true, status: 'approved' };
    
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
  
  // Fetch only names and IDs first to find the match
  const restaurantNames = await prisma.restaurant.findMany({
    select: { id: true, restaurant_name: true }
  });
  
  const matchId = restaurantNames.find(r => generateSlug(r.restaurant_name) === slug)?.id;
  
  if (matchId) {
    const fullRestaurant = await prisma.restaurant.findUnique({
      where: { id: matchId },
      include: { 
        categories: { 
          include: { 
            products: {
              orderBy: { order_count: 'desc' }
            } 
          } 
        },
        ratings: { include: { user: { select: { name: true } } } }
      }
    });
    return res.json({ ...fullRestaurant, status: 'approved' });
  }

  const directoryNames = await prisma.restaurantDirectory.findMany({
    select: { id: true, name: true, status: true }
  });
  const dirMatchId = directoryNames.find(d => generateSlug(d.name) === slug)?.id;
  
  if (dirMatchId) {
    const fullDirRestaurant = await prisma.restaurantDirectory.findUnique({
      where: { id: dirMatchId }
    });
    return res.json({ ...fullDirRestaurant, status: fullDirRestaurant?.status });
  }

  res.status(404).json({ error: 'Restaurant not found' });
});

let trendingCache: { data: any, timestamp: number } | null = null;

apiRouter.get('/restaurants/trending', async (req, res) => {
  try {
    const now = Date.now();
    if (trendingCache && now - trendingCache.timestamp < 5 * 60 * 1000) {
      return res.json(trendingCache.data);
    }

    const restaurants = await prisma.restaurant.findMany({
      where: { isActive: true, status: 'approved' },
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
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: req.params.id },
    include: { 
      categories: { include: { products: true } },
      ratings: { include: { user: { select: { name: true } } } }
    }
  });
  
  if (restaurant) {
    if (restaurant.status !== 'approved' || !restaurant.isActive) {
      return res.status(404).json({ error: 'Restaurant not found or inactive' });
    }
    return res.json({ ...restaurant, status: 'approved' });
  }

  const directory = await prisma.restaurantDirectory.findUnique({
    where: { id: req.params.id }
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

// Restaurant Admin routes
apiRouter.get('/restaurant/profile', authMiddleware, async (req: any, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    if (!restaurantId) return res.status(403).json({ error: 'Forbidden' });
    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
    res.json(restaurant);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

apiRouter.put('/restaurant/profile', authMiddleware, async (req: any, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    if (!restaurantId) return res.status(403).json({ error: 'Forbidden' });
    const { name, description, phone, address, city, cover_image, logoUrl, opening_hours, has_delivery, has_pickup } = req.body;
    
    const restaurant = await prisma.restaurant.update({
      where: { id: restaurantId },
      data: {
        restaurant_name: name,
        description,
        phone_number: phone,
        address,
        city,
        cover_image,
        coverUrl: cover_image,
        logo_url: logoUrl,
        opening_hours,
        has_delivery: has_delivery !== undefined ? has_delivery : undefined,
        has_pickup: has_pickup !== undefined ? has_pickup : undefined
      }
    });
    res.json(restaurant);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

apiRouter.get('/restaurant/menu', authMiddleware, async (req: any, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    if (!restaurantId) return res.status(403).json({ error: 'Forbidden' });
    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });

    const categories = await prisma.category.findMany({
      where: { restaurantId: restaurant.id },
      include: { products: true }
    });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

apiRouter.post('/restaurant/categories', authMiddleware, async (req: any, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    if (!restaurantId) return res.status(403).json({ error: 'Forbidden' });
    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });

    const category = await prisma.category.create({
      data: { name: req.body.name, restaurantId: restaurant.id }
    });
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

apiRouter.put('/restaurant/categories/:id', authMiddleware, async (req: any, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    if (!restaurantId) return res.status(403).json({ error: 'Forbidden' });

    const ownedCategory = await prisma.category.findUnique({ where: { id: req.params.id } });
    if (!ownedCategory) return res.status(404).json({ error: 'Category not found' });
    if (!isOwnedByRestaurant(ownedCategory, restaurantId)) {
      return res.status(403).json({ error: 'Forbidden: You do not own this category' });
    }

    const category = await prisma.category.update({
      where: { id: req.params.id },
      data: { name: req.body.name }
    });
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

apiRouter.delete('/restaurant/categories/:id', authMiddleware, async (req: any, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    if (!restaurantId) return res.status(403).json({ error: 'Forbidden' });
    
    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });

    const category = await prisma.category.findUnique({ where: { id: req.params.id } });
    if (!category) return res.status(404).json({ error: 'Category not found' });

    if (!isOwnedByRestaurant(category, restaurant.id)) {
      return res.status(403).json({ error: 'Forbidden: You do not own this category' });
    }

    await prisma.product.deleteMany({ where: { categoryId: req.params.id } });
    await prisma.category.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('[Delete Category Error]', error);
    res.status(500).json({ error: 'Server error' });
  }
});

apiRouter.post('/restaurant/products', authMiddleware, async (req: any, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    if (!restaurantId) return res.status(403).json({ error: 'Forbidden' });
    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });

    const { categoryId, name, description, price, imageUrl, isAvailable } = req.body;
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) return res.status(404).json({ error: 'Category not found' });
    if (!isOwnedByRestaurant(category, restaurant.id)) {
      return res.status(403).json({ error: 'Forbidden: You do not own this category' });
    }

    const product = await prisma.product.create({
      data: {
        restaurantId: restaurant.id,
        categoryId,
        name,
        description,
        price: parseFloat(price),
        imageUrl,
        isAvailable: isAvailable ?? true
      }
    });
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

apiRouter.put('/restaurant/products/:id', authMiddleware, async (req: any, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    if (!restaurantId) return res.status(403).json({ error: 'Forbidden' });
    const { name, description, price, imageUrl, isAvailable, categoryId } = req.body;

    const existingProduct = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!existingProduct) return res.status(404).json({ error: 'Product not found' });
    if (!isOwnedByRestaurant(existingProduct, restaurantId)) {
      return res.status(403).json({ error: 'Forbidden: You do not own this product' });
    }

    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) return res.status(404).json({ error: 'Category not found' });
    if (!isOwnedByRestaurant(category, restaurantId)) {
      return res.status(403).json({ error: 'Forbidden: You do not own this category' });
    }

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        name,
        description,
        price: parseFloat(price),
        imageUrl,
        isAvailable,
        categoryId
      }
    });
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

apiRouter.delete('/restaurant/products/:id', authMiddleware, async (req: any, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    if (!restaurantId) return res.status(403).json({ error: 'Forbidden' });
    
    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });

    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    
    if (!isOwnedByRestaurant(product, restaurant.id)) {
      return res.status(403).json({ error: 'Forbidden: You do not own this product' });
    }

    await prisma.product.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('[Delete Product Error]', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Orders routes
const createOrderSchema = z.object({
  restaurantId: z.string().min(1),
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().int().positive(),
    options: z.array(z.unknown()).optional()
  })).min(1),
  deliveryAddress: z.string().min(1),
  deliveryLat: z.number().optional(),
  deliveryLng: z.number().optional(),
  guestName: z.string().optional(),
  guestPhone: z.string().optional()
});

apiRouter.post('/orders', optionalAuthMiddleware, async (req: any, res) => {
  try {
    const {
      restaurantId,
      items,
      deliveryAddress,
      deliveryLat,
      deliveryLng,
      guestName,
      guestPhone
    } = createOrderSchema.parse(req.body);
    
    if (!req.user && (!guestName || !guestPhone)) {
      return res.status(400).json({ error: 'Guest name and phone are required for unauthenticated orders' });
    }

    let normalizedGuestPhone = guestPhone;
    if (guestPhone) {
      const phoneValidation = phoneSchema.safeParse(guestPhone);
      if (!phoneValidation.success) {
        return res.status(400).json({ error: phoneValidation.error.issues[0].message });
      }
      normalizedGuestPhone = normalizeWhatsApp(guestPhone);
    }

    const productIds = [...new Set(items.map(item => item.productId))];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, restaurantId: true, price: true, isAvailable: true }
    });

    const pricing = calculateOrderPricing(restaurantId, items, products);
    const order = await prisma.order.create({
      data: {
        clientId: req.user?.userId || null,
        guestName: req.user ? null : guestName,
        guestPhone: req.user ? null : normalizedGuestPhone,
        restaurantId,
        totalAmount: pricing.totalAmount,
        deliveryAddress,
        deliveryLat,
        deliveryLng,
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
        statusHistory: {
          create: { status: 'PENDING', notes: 'Order placed' }
        }
      },
      include: { items: { include: { product: true } }, restaurant: true, client: true }
    });

    console.log(`[Order Created] ID: ${order.id}, Restaurant ID: ${order.restaurantId}, Status: ${order.status}`);

    const io = req.app.get('io');
    if (io) {
      io.emit('newOrder', order);
    }

    res.json(order);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message });
    }
    if (error instanceof OrderPricingError) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

apiRouter.get('/orders', authMiddleware, async (req: any, res) => {
  try {
    let where;
    if (req.user.role === 'CLIENT') {
      where = { clientId: req.user.userId };
    } else if (req.user.role === 'RESTAURANT') {
      const rest = await prisma.restaurant.findUnique({ where: { id: req.user.userId } });
      if (!rest) return res.status(403).json({ error: 'Forbidden' });
      where = { restaurantId: rest.id };
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
    const restaurant = await prisma.restaurant.findUnique({ where: { id: req.user.userId } });
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });

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
      const restaurant = await prisma.restaurant.findUnique({ where: { id: req.user.userId } });
      if (!restaurant || orderToUpdate.restaurantId !== restaurant.id) {
        return res.status(403).json({ error: 'Forbidden: You do not own this order' });
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
