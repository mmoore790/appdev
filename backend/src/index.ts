import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import { schedulerService } from "./services/schedulerService";
import { pool } from "./db";
import cors from 'cors';

const app = express();

// Configure CORS to allow the frontend dev server and any configured origins
const envOrigins = [
  process.env.CORS_ORIGIN,
  process.env.FRONTEND_URL,
].filter(Boolean).join(',');

const allowedOrigins = Array.from(
  new Set(
    (envOrigins
      ? envOrigins.split(',')
      : [
          'http://localhost:5173',
          'http://127.0.0.1:5173',
          'http://localhost:5174',
          'http://127.0.0.1:5174',
        ]).map((origin) => origin.trim()).filter(Boolean),
  ),
);

// Log allowed origins for debugging (but not in production to avoid exposing config)
if (process.env.NODE_ENV !== 'production' || process.env.DEBUG_CORS === 'true') {
  console.log('[CORS] Allowed origins:', allowedOrigins);
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked request from origin: ${origin}`);
      console.warn(`[CORS] Allowed origins: ${allowedOrigins.join(', ')}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Allows session cookies
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Auth-Token', 'X-Auth-Success'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Health check endpoint (must be early for Cloud Run)
// This endpoint should work even if database is not connected
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// PostgreSQL session store for proper persistence in hosted environments
const PgSession = ConnectPgSimple(session);

// Session configuration with PostgreSQL store
// Use the shared pool instead of creating a new connection pool
app.use(session({
  store: new PgSession({
    pool: pool, // Share the same pool to avoid connection limit issues
    tableName: 'sessions',
    createTableIfMissing: false,
    pruneSessionInterval: 60 * 15, // Prune expired sessions every 15 minutes
    errorLog: (err) => {
      // Only log non-timeout errors to reduce noise
      if (!err.message?.includes('timeout') && !err.message?.includes('Connection terminated')) {
        console.error('[Session Store Error]', err);
      }
    }
  }),
  secret: process.env.SESSION_SECRET || 'moorehorticulture-secret',
  resave: false, // Don't save session if unmodified
  saveUninitialized: false, // Don't create session until something is stored (reduces DB connections)
  rolling: true, // Reset expiration on activity
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Only require HTTPS in production
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: '/',
    // In development with proxy, use 'lax' (requests appear same-origin)
    // In production, use 'none' for cross-origin (Vercel -> Render)
    sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax'
  }
}));

// Log session info for debugging
app.use((req, res, next) => {
  if (req.path === '/api/auth/login' || req.path === '/api/auth/me') {
    console.log('Session ID:', req.sessionID);
    console.log('Session data:', req.session);
  }
  next();
});

// Add user to request type
declare module 'express-session' {
  interface SessionData {
    userId?: number;
    role?: string;
    businessId?: number;
  }
}

// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      console.log(logLine); // Replaced missing 'log' function
    }
  });

  next();
});

(async () => {
  console.log('🚀 Starting server initialization...');
  console.log(`📦 Node version: ${process.version}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔌 PORT: ${process.env.PORT || '3001 (default)'}`);
  
  const server = await registerRoutes(app);
  console.log('✅ Routes registered successfully');

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    
    // Log the full error for debugging
    console.error("Error handler caught error:", {
      message: err.message,
      stack: err.stack,
      status,
      originalError: err
    });

    // If response was already sent, don't send again
    if (res.headersSent) {
      return _next(err);
    }

    // Preserve detailed error info in development
    const isDevelopment = process.env.NODE_ENV === "development";
    res.status(status).json({ 
      message,
      ...(isDevelopment && {
        stack: err.stack,
        error: err
      })
    });
    
    // Don't re-throw - error is handled
  });
  
  // Add a direct test job data endpoint that will always return test data
  app.get('/api/job-test', (req, res) => {
    res.status(200).send(JSON.stringify({
      id: 5,
      jobId: "WS-2025-175",
      equipmentId: null,
      equipmentDescription: "Lawn mower - test data",
      customerId: 3,
      assignedTo: 3,
      status: "in_progress",
      description: "Test job data for demonstration",
      createdAt: "2025-05-17",
      completedAt: null,
      estimatedHours: 2,
      actualHours: null,
      taskDetails: "This is test data that shows what job information looks like",
      customerNotified: false,
      updates: [
        {
          id: 1,
          jobId: 5,
          description: "Initial assessment complete",
          createdAt: "2025-05-17",
          serviceType: "assessment",
          technician: 3
        }
      ]
    }));
  });
  
  // The port should be 3001 to match your frontend .env file
  // Port 5000 was from Replit.
  // Use PORT environment variable (required by Google Cloud Run), otherwise default to 3001 for local dev
  const port = process.env.PORT || 3001;
  
  server.listen(Number(port), "0.0.0.0", () => {
    console.log(`✅ Backend server running on port ${port}`);
    console.log(`✅ Server accessible at http://0.0.0.0:${port}`);
    console.log(`✅ Health check available at http://0.0.0.0:${port}/health`);
    
    // Start the scheduler service after server is running
    schedulerService.start();
  });

  // Handle server errors
  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.syscall !== 'listen') {
      throw error;
    }

    const bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;

    switch (error.code) {
      case 'EACCES':
        console.error(`${bind} requires elevated privileges`);
        process.exit(1);
        break;
      case 'EADDRINUSE':
        console.error(`${bind} is already in use`);
        process.exit(1);
        break;
      default:
        throw error;
    }
  });
})().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});