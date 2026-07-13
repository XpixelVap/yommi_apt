import express from 'express';
import 'express-async-errors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cron from 'node-cron';
import { apiRouter } from './src/routes';
import { prisma } from './src/db';
import { env, isAllowedOrigin } from './src/config/env';

if (env.NODE_ENV === 'production') console.log = function () {};

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);

  cron.schedule('0 0 * * *', async () => {
    try {
      await prisma.$transaction([
        prisma.product.updateMany({ data: { order_count_today: 0 } }),
        prisma.restaurant.updateMany({ data: { orders_today: 0 } })
      ]);
    } catch {
      console.error('Daily counters could not be reset');
    }
  });

  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
      methods: ['GET', 'POST']
    }
  });
  app.set('io', io);

  app.use(helmet({ contentSecurityPolicy: env.NODE_ENV === 'production', crossOriginEmbedderPolicy: false }));
  app.use(cors({
    origin: (origin, callback) => isAllowedOrigin(origin)
      ? callback(null, true)
      : callback(new Error('Origin not allowed by CORS')),
    credentials: true
  }));

  app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));
  app.get('/ready', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.status(200).json({ status: 'ready' });
    } catch {
      res.status(503).json({ status: 'not_ready' });
    }
  });

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
    validate: { xForwardedForHeader: false }
  });
  app.use('/api', apiLimiter);
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof SyntaxError && 'body' in err) return res.status(400).json({ error: 'Invalid JSON payload' });
    next(err);
  });

  app.use('/api', apiRouter);
  app.all('/api/*', (_req, res) => res.status(404).json({ error: 'API route not found' }));
  app.use('/uploads', express.static(env.UPLOAD_DIR));

  io.on('connection', socket => {
    socket.on('joinOrder', orderId => socket.join(`order_${orderId}`));
    socket.on('updateLocation', data => io.to(`order_${data.orderId}`).emit('locationUpdated', data));
    socket.on('updateOrderStatus', data => io.to(`order_${data.orderId}`).emit('orderStatusUpdated', data));
  });

  app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) return next(err);
    console.error('Unhandled request error');
    res.status(500).json({ error: 'Internal Server Error' });
  });

  httpServer.listen(env.PORT, '0.0.0.0', () => console.info(`Server listening on port ${env.PORT}`));
}

startServer().catch(() => {
  console.error('Backend failed to start');
  process.exit(1);
});