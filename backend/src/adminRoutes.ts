import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { GoogleGenAI, Type } from "@google/genai";
import { InvalidOrderTransitionError, ORDER_STATUSES, resolveOrderTransition } from './core/order-status';
import { getRestaurantReadiness } from './core/restaurant-readiness';
import { assertRestaurantReadyForApproval, RestaurantNotReadyError } from './core/restaurant-access';
import { logRestaurantFunnelEvent } from './core/funnel-events';
import { PaymentRuleError, assertPaymentCompatibleOrderTransition } from './core/payment-orchestration';
import { toAdminRestaurantDto, toOrderDto } from './core/payment-dtos';
import { env } from './config/env';
import { emitSafeOrderEvent } from './core/order-events';
import { CANCELLATION_REASONS, OrderOperationError, cancelOrder } from './core/order-operations';
import { OPERATIONAL_STATUSES, OperationalRuleError, getOperationalAvailability, updateOperationalStatus } from './core/restaurant-operational';

const prisma = new PrismaClient();
const JWT_SECRET = env.JWT_SECRET;

export const adminRouter = Router();

// RBAC Middleware
adminRouter.use(async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });

    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    (req as any).user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

// AI Extractor
adminRouter.post('/extract-restaurant', async (req, res) => {
  try {
    const { sourceText } = req.body;
    if (!sourceText) {
      return res.status(400).json({ error: 'Source text is required' });
    }

    const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    
    const systemPrompt = `Eres un asistente que analiza información de restaurantes para la plataforma Yommi.
OBJETIVO
Extraer y estructurar la información del restaurante detectado en Google Maps o en la fuente proporcionada.
INSTRUCCIONES
Detecta automáticamente la ciudad y el país a partir de la dirección del restaurante.
Extrae los siguientes datos si están disponibles:
nombre
direccion
ciudad
pais
telefono
sitio_web
instagram
categoria (tipo de comida)
rating
numero_reviews
Si el restaurante tiene número de teléfono con WhatsApp:
Genera un enlace de invitación a WhatsApp con el siguiente mensaje prellenado:
"Hola, acabo de encontrar su restaurante y creo que debería aparecer en Yommi, una app donde los clientes descubren y califican restaurantes de la ciudad. El registro es gratuito. Pueden hacerlo aquí: https://yommi.app"
Formato del enlace:
https://wa.me/NUMERO?text=MENSAJE_URL_ENCODED
Si NO existe teléfono o WhatsApp:
Usa el perfil de Instagram como método de contacto.
Genera un botón llamado:
INVITAR A YOMMI
Reglas del botón:
Si existe WhatsApp → abrir enlace WhatsApp
Si no existe WhatsApp → abrir Instagram
Devuelve el resultado en formato JSON estructurado así:
{
"nombre": "",
"direccion": "",
"ciudad": "",
"pais": "",
"telefono": "",
"instagram": "",
"categoria": "",
"rating": "",
"numero_reviews": "",
"boton_invitar": {
"texto": "Invitar a Yommi",
"tipo": "whatsapp | instagram",
"link": ""
}
}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: sourceText,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            nombre: { type: Type.STRING },
            direccion: { type: Type.STRING },
            ciudad: { type: Type.STRING },
            pais: { type: Type.STRING },
            telefono: { type: Type.STRING },
            sitio_web: { type: Type.STRING },
            instagram: { type: Type.STRING },
            categoria: { type: Type.STRING },
            rating: { type: Type.STRING },
            numero_reviews: { type: Type.STRING },
            boton_invitar: {
              type: Type.OBJECT,
              properties: {
                texto: { type: Type.STRING },
                tipo: { type: Type.STRING },
                link: { type: Type.STRING }
              }
            }
          }
        }
      }
    });

    const jsonStr = response.text?.trim() || "{}";
    const data = JSON.parse(jsonStr);
    
    res.json(data);
  } catch (error) {
    console.error('Extraction error:', error);
    res.status(500).json({ error: 'Failed to extract information' });
  }
});

// Dashboard Overview
adminRouter.get('/stats', async (req, res) => {
  const totalRestaurants = await prisma.restaurant.count();
  const registeredRestaurants = await prisma.restaurant.count({ where: { isActive: true } });
  const pendingClaims = await prisma.restaurantClaimRequest.count({ where: { status: 'PENDING' } });
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const totalOrdersToday = await prisma.order.count({
    where: { createdAt: { gte: today } }
  });
  
  const totalUsers = await prisma.user.count();
  
  const mostRequested = await prisma.restaurantInvitation.findMany({
    orderBy: { request_count: 'desc' },
    take: 5
  });

  res.json({
    totalRestaurants,
    registeredRestaurants,
    pendingClaims,
    totalOrdersToday,
    totalUsers,
    mostRequested
  });
});

// Restaurants Management
adminRouter.get('/restaurants', async (req, res) => {
  const restaurants = await prisma.restaurant.findMany({
    
  });
  res.json(restaurants.map(toAdminRestaurantDto));
});

adminRouter.post('/restaurants', async (req, res) => {
  const { name, owner_name, phone, city, category, status } = req.body;
  
  try {
    const email = `${name.replace(/\s+/g, '').toLowerCase()}_${Date.now()}@yommi.com`;
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    const restaurant = await prisma.restaurant.create({
      data: { 
        restaurant_name: name, 
        owner_name: owner_name || name,
        email,
        password_hash: hashedPassword,
        description: category, 
        phone_number: phone, 
        address: city, 
        city: city,
        isActive: status === 'ACTIVE',
        status: status === 'ACTIVE' ? 'approved' : 'pending_verification'
      }
    });
    
    if (category) {
      await prisma.category.create({
        data: {
          name: category,
          restaurantId: restaurant.id
        }
      });
    }

    res.json(toAdminRestaurantDto(restaurant));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create restaurant' });
  }
});

adminRouter.put('/restaurants/:id', async (req, res) => {
  const { name, owner_name, phone, city, category, status } = req.body;
  
  try {
    const restaurant = await prisma.restaurant.update({
      where: { id: req.params.id },
      data: { 
        restaurant_name: name, 
        owner_name: owner_name || name,
        description: category, 
        phone_number: phone, 
        address: city, 
        city: city,
        isActive: status === 'ACTIVE',
        status: status === 'ACTIVE' ? 'approved' : 'pending_verification'
      }
    });

    res.json(toAdminRestaurantDto(restaurant));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update restaurant' });
  }
});

adminRouter.put('/restaurants/:id/isActive', async (req, res) => {
  const { isActive } = req.body;
  const restaurant = await prisma.restaurant.update({
    where: { id: req.params.id },
    data: { isActive }
  });
  res.json(toAdminRestaurantDto(restaurant));
});

adminRouter.patch('/restaurants/:id/approve', async (req, res) => {
  try {
    const restaurantId = req.params.id;
    const existing = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      include: { categories: { include: { products: true } }, products: true }
    });
    if (!existing) return res.status(404).json({ error: 'Restaurant not found' });

    const readiness = getRestaurantReadiness(existing);
    assertRestaurantReadyForApproval(readiness);

    const restaurant = await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { status: 'approved', isActive: true }
    });

    const directoryEntry = await prisma.restaurantDirectory.findFirst({
      where: { name: restaurant.restaurant_name }
    });
    if (directoryEntry) {
      await prisma.restaurantDirectory.update({
        where: { id: directoryEntry.id },
        data: { status: 'ACTIVE' }
      });
    }
    logRestaurantFunnelEvent('restaurant_approved', restaurant.id);
    res.json({ restaurant: toAdminRestaurantDto(restaurant), readiness });
  } catch (error) {
    if (error instanceof RestaurantNotReadyError) {
      return res.status(409).json({
        error: error.message,
        readiness: error.readiness
      });
    }
    res.status(500).json({ error: 'Failed to approve restaurant' });
  }
});
adminRouter.patch('/restaurants/:id/reject', async (req, res) => {
  try {
    const restaurantId = req.params.id;
    const restaurant = await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { status: 'rejected', isActive: false }
    });
    res.json(toAdminRestaurantDto(restaurant));
  } catch (error) {
    console.error('Error rejecting restaurant:', error);
    res.status(500).json({ error: 'Failed to reject restaurant' });
  }
});

adminRouter.delete('/restaurants/:id', async (req, res) => {
  try {
    const restaurantId = req.params.id;
    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    
    if (restaurant) {
      // Delete restaurant orders
      await prisma.order.deleteMany({ where: { restaurantId: restaurant.id } });
      
      // Delete restaurant products and categories
      const categories = await prisma.category.findMany({ where: { restaurantId: restaurant.id } });
      for (const cat of categories) {
        await prisma.product.deleteMany({ where: { categoryId: cat.id } });
      }
      await prisma.category.deleteMany({ where: { restaurantId: restaurant.id } });
      
      // Delete the restaurant
      await prisma.restaurant.delete({ where: { id: restaurantId } });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting restaurant:', error);
    res.status(500).json({ error: 'Failed to delete restaurant' });
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

// Directory Management
adminRouter.get('/directory', async (req, res) => {
  const directory = await prisma.restaurantDirectory.findMany({
    orderBy: { createdAt: 'desc' }
  });
  res.json(directory);
});

adminRouter.post('/directory', async (req, res) => {
  const { name, city, address, cuisine_type, phone, phone_optional, status, instagram } = req.body;
  const normalizedPhone = normalizeWhatsApp(phone);
  const normalizedOptional = normalizeWhatsApp(phone_optional);
  const entry = await prisma.restaurantDirectory.create({
    data: { name, city, address, cuisine_type, phone: normalizedPhone, phone_optional: normalizedOptional || normalizedPhone, whatsapp: normalizedOptional || normalizedPhone, status: status || 'UNCLAIMED', instagram }
  });
  res.json(entry);
});

adminRouter.put('/directory/:id', async (req, res) => {
  const { name, city, address, cuisine_type, phone, phone_optional, status, instagram } = req.body;
  const normalizedPhone = normalizeWhatsApp(phone);
  const normalizedOptional = normalizeWhatsApp(phone_optional);
  const entry = await prisma.restaurantDirectory.update({
    where: { id: req.params.id },
    data: { name, city, address, cuisine_type, phone: normalizedPhone, phone_optional: normalizedOptional || normalizedPhone, whatsapp: normalizedOptional || normalizedPhone, status: status || 'UNCLAIMED', instagram }
  });
  res.json(entry);
});

adminRouter.delete('/directory/:id', async (req, res) => {
  await prisma.restaurantDirectory.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

// Invitations
adminRouter.get('/invitations', async (req, res) => {
  const invitations = await prisma.restaurantInvitation.findMany({
    orderBy: { updated_at: 'desc' }
  });
  res.json(invitations);
});

// Demand
adminRouter.get('/demand', async (req, res) => {
  const demand = await prisma.restaurantInvitation.findMany({
    orderBy: { request_count: 'desc' }
  });
  res.json(demand);
});

// Claims
adminRouter.get('/claims', async (req, res) => {
  const claims = await prisma.restaurantClaimRequest.findMany({
    include: { restaurantDirectory: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json(claims);
});

adminRouter.put('/claims/:id/status', async (req, res) => {
  const { status } = req.body;
  const claim = await prisma.restaurantClaimRequest.update({
    where: { id: req.params.id },
    data: { status },
    include: { restaurantDirectory: true }
  });

  if (status === 'APPROVED') {
    await prisma.restaurantDirectory.update({
      where: { id: claim.restaurantDirectoryId },
      data: { status: 'ACTIVE' }
    });

    const existingRestaurant = await prisma.restaurant.findUnique({ where: { email: claim.email } });
    if (!existingRestaurant) {
      const hashedPassword = await bcrypt.hash('changeme123', 10);
      await prisma.restaurant.create({
        data: {
          restaurant_name: claim.restaurant_name || claim.restaurantDirectory.name,
          owner_name: claim.name,
          email: claim.email,
          phone_number: claim.phone,
          password_hash: hashedPassword,
          address: claim.restaurantDirectory.address,
          city: claim.restaurantDirectory.city,
          coverUrl: claim.restaurantDirectory.image_url,
          status: 'approved',
          isActive: true
        }
      });
    } else {
      await prisma.restaurant.update({
        where: { id: existingRestaurant.id },
        data: { status: 'approved', isActive: true }
      });
    }
  }

  res.json(claim);
});

const adminOperationalStatusSchema = z.object({
  status: z.enum(OPERATIONAL_STATUSES),
  manualOpenUntil: z.string().datetime().nullable().optional()
}).strict();

adminRouter.patch('/restaurants/:id/operational-status', async (req: any, res) => {
  try {
    const input = adminOperationalStatusSchema.parse(req.body);
    const restaurant = await updateOperationalStatus({
      prisma,
      restaurantId: req.params.id,
      actor: { id: req.user.id, role: 'ADMIN' },
      status: input.status,
      manualOpenUntil: input.manualOpenUntil ? new Date(input.manualOpenUntil) : null
    });
    res.json({ ...getOperationalAvailability(restaurant), manualOpenUntil: restaurant.manualOpenUntil });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.issues[0].message });
    if (error instanceof OperationalRuleError) return res.status(409).json({ code: error.code, error: error.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// Orders
adminRouter.get('/orders', async (req, res) => {
  const orders = await prisma.order.findMany({
    include: { restaurant: true, client: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json(orders.map(order => toOrderDto(order, false, true)));
});

const adminOrderStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  estimatedMinutes: z.number().int().min(5).max(180).optional(),
  cancelReason: z.enum(CANCELLATION_REASONS).optional()
}).strict();

adminRouter.put('/orders/:id/status', async (req: any, res) => {
  try {
    const input = adminOrderStatusSchema.parse(req.body);
    const existingOrder = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!existingOrder) return res.status(404).json({ error: 'Order not found' });
    if (input.status === 'CANCELLED') {
      if (!input.cancelReason) return res.status(400).json({ code: 'INVALID_CANCELLATION_REASON', error: 'Selecciona un motivo de cancelaci?n.' });
      const result = await cancelOrder({
        prisma,
        io: req.app.get('io'),
        orderId: existingOrder.id,
        actor: { id: req.user.id, role: 'ADMIN' },
        reason: input.cancelReason
      });
      return res.json(toOrderDto(result.order, false, true));
    }
    if (input.status === 'ACCEPTED' && input.estimatedMinutes === undefined) {
      return res.status(400).json({ code: 'INVALID_ESTIMATED_TIME', error: 'Selecciona un tiempo estimado entre 5 y 180 minutos.' });
    }

    const status = resolveOrderTransition(existingOrder.status, input.status);
    assertPaymentCompatibleOrderTransition(existingOrder.paymentMethod, existingOrder.paymentStatus, status);
    const estimatedReadyAt = status === 'ACCEPTED'
      ? new Date(Date.now() + input.estimatedMinutes! * 60 * 1000)
      : undefined;
    const order = await prisma.$transaction(async tx => {
      const updated = await tx.order.update({
        where: { id: existingOrder.id },
        data: { status, ...(estimatedReadyAt ? { estimatedReadyAt } : {}) }
      });
      await tx.orderStatusHistory.create({
        data: { orderId: updated.id, status, notes: 'Status updated by platform admin' }
      });
      return updated;
    });
    emitSafeOrderEvent(req.app.get('io'), 'ORDER_UPDATED', order);
    res.json(toOrderDto(order, false, true));
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.issues[0].message });
    if (error instanceof OrderOperationError) {
      const status = error.code === 'ORDER_NOT_FOUND' ? 404 : error.code === 'FORBIDDEN' ? 403 : 409;
      return res.status(status).json({ code: error.code, error: error.message });
    }
    if (error instanceof InvalidOrderTransitionError || error instanceof PaymentRuleError) {
      return res.status(409).json({ error: error.message });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Users
adminRouter.get('/users', async (req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' }
  });
  res.json(users);
});

adminRouter.put('/users/:id/suspend', async (req, res) => {
  const { suspend } = req.body;
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { isSuspended: suspend }
  });
  res.json(user);
});

adminRouter.delete('/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Find associated driver
    const driver = await prisma.deliveryDriver.findUnique({ where: { userId } });

    if (driver) {
      // Remove driver from orders
      await prisma.order.updateMany({ 
        where: { driverId: driver.id },
        data: { driverId: null }
      });
      
      // Delete associated driver
      await prisma.deliveryDriver.delete({ where: { id: driver.id } });
    }
    
    // Delete user orders (if client)
    await prisma.order.deleteMany({ where: { clientId: userId } });
    
    // Finally delete the user
    await prisma.user.delete({ where: { id: userId } });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// LEGACY/FROZEN: driver management is retained for compatibility only.
// Do not add new Yommi fleet business rules.
// Drivers
adminRouter.get('/drivers', async (req, res) => {
  const drivers = await prisma.deliveryDriver.findMany({
    
  });
  res.json(drivers);
});

// Banners
adminRouter.get('/banners', async (req, res) => {
  try {
    const banners = await prisma.banner.findMany({
      orderBy: { order: 'asc' }
    });
    res.json(banners);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

adminRouter.post('/banners', async (req, res) => {
  try {
    const { title, subtitle, image, buttonText, link, city, order, active } = req.body;
    const banner = await prisma.banner.create({
      data: {
        title,
        subtitle,
        image,
        buttonText,
        link,
        city: city || null,
        order: parseInt(order) || 0,
        active: active !== undefined ? active : true
      }
    });
    res.json(banner);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

adminRouter.put('/banners/:id', async (req, res) => {
  try {
    const { title, subtitle, image, buttonText, link, city, order, active } = req.body;
    const banner = await prisma.banner.update({
      where: { id: req.params.id },
      data: {
        title,
        subtitle,
        image,
        buttonText,
        link,
        city: city || null,
        order: parseInt(order) || 0,
        active: active !== undefined ? active : true
      }
    });
    res.json(banner);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

adminRouter.delete('/banners/:id', async (req, res) => {
  try {
    await prisma.banner.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});
