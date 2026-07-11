import express from "express";
import "express-async-errors";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cron from "node-cron";
import { apiRouter } from "./src/routes";
import { prisma } from "./src/db";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

dotenv.config();

if (process.env.NODE_ENV === 'production') {
  console.log = function () {};
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3001;
  
  // Trust the first proxy to allow express-rate-limit to accurately identify users
  app.set('trust proxy', 1);
  
  try {
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      console.log("Database is empty. Please run 'npx prisma db seed' to populate initial data.");
    }
  } catch (error) {
    console.error("Error checking database:", error);
  }

  // Reset daily order counts every midnight
  cron.schedule("0 0 * * *", async () => {
    try {
      await prisma.product.updateMany({
        data: { order_count_today: 0 }
      });
      await prisma.restaurant.updateMany({
        data: { orders_today: 0 }
      });
      console.log("Daily order counts reset successfully.");
    } catch (error) {
      console.error("Error resetting daily order counts:", error);
    }
  });

  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
  
  app.set('io', io);

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for development/vite
    crossOriginEmbedderPolicy: false,
  }));

  // Rate limiting for API
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // Limit each IP to 500 requests per `window` (here, per 15 minutes)
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later." },
    validate: { xForwardedForHeader: false }
  });

  app.use(cors());
  app.use("/api", apiLimiter);
  app.use(express.json({ limit: '50mb' }));
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof SyntaxError && 'body' in err) {
      return res.status(400).json({ error: "Invalid JSON payload" });
    }
    next();
  });
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // API routes FIRST
  app.use("/api", apiRouter);

  // Catch-all for unhandled API routes to prevent falling through to Vite SPA
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: "API route not found" });
  });

  // Global error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Global Error:", err);
    if (res.headersSent) {
      return next(err);
    }
    res.status(500).json({ error: "Internal Server Error" });
  });

  app.use('/uploads', express.static('uploads'));

  // Socket.io setup
  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);
    
    socket.on("joinOrder", (orderId) => {
      socket.join(`order_${orderId}`);
      console.log(`Socket ${socket.id} joined order_${orderId}`);
    });

    socket.on("updateLocation", (data) => {
      // data: { orderId, lat, lng }
      io.to(`order_${data.orderId}`).emit("locationUpdated", data);
    });

    socket.on("updateOrderStatus", (data) => {
      io.to(`order_${data.orderId}`).emit("orderStatusUpdated", data);
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });

  // Removed Vite middleware for split architecture

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
