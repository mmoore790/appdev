import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import cors from "cors";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";

import { pool } from "./db";
import { schedulerService } from "./services/schedulerService";
import { registerRoutes } from "./routes";

const app = express();

/* ------------------------------------------------------
 *  CORS CONFIG
 * ---------------------------------------------------- */
const envOrigins = [
  process.env.CORS_ORIGIN,
  process.env.FRONTEND_URL,
].filter(Boolean).join(',');

const allowedOrigins = Array.from(new Set(
  (envOrigins ? envOrigins.split(',') : [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
  ]).map(o => o.trim()).filter(Boolean)
));

if (process.env.NODE_ENV !== 'production') {
  console.log('[CORS] Allowed origins:', allowedOrigins);
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);

    console.warn(`[CORS] Blocked origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

/* ------------------------------------------------------
 *  SESSION STORE
 * ---------------------------------------------------- */
const PgSession = ConnectPgSimple(session);

app.use(session({
  store: new PgSession({
    pool: pool,
    tableName: 'sessions',
    createTableIfMissing: false,
    pruneSessionInterval: 60 * 15,
  }),
  secret: process.env.SESSION_SECRET || 'moorehorticulture-secret',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  }
}));

/* ------------------------------------------------------
 *  LOGGING FOR API CALLS
 * ---------------------------------------------------- */
app.use((req, res, next) => {
  const start = Date.now();
  const originalJson = res.json;

  let payload: any;

  res.json = function (data) {
    payload = data;
    return originalJson.apply(res, [data]);
  };

  res.on("finish", () => {
    if (!req.path.startsWith("/api")) return;
    const duration = Date.now() - start;

    let log = `${req.method} ${req.path} ${res.statusCode} in ${duration}ms`;
    if (payload) log += ` :: ${JSON.stringify(payload)}`.substring(0, 120);

    console.log(log);
  });

  next();
});

/* ------------------------------------------------------
 *  HEALTH CHECK ENDPOINT (MUST BE FAST)
 * ---------------------------------------------------- */
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/* ------------------------------------------------------
 *  EXPRESS ERROR HANDLER
 * ---------------------------------------------------- */
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || 500;

  console.error("Express error:", {
    message: err.message,
    stack: err.stack,
    status
  });

  res.status(status).json({
    message: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

/* ======================================================
 *   🚀 CLOUD RUN–OPTIMIZED STARTUP
 * ==================================================== */
(async () => {
  try {
    console.log('[INIT] Starting server bootstrap...');
    console.log('[ENV] PORT =', process.env.PORT);

    const port = parseInt(process.env.PORT || "3001", 10);

    if (isNaN(port)) {
      throw new Error(`Invalid PORT value: ${process.env.PORT}`);
    }

    const httpServer = createServer(app);

    /** 1️⃣ START LISTENING ***IMMEDIATELY*** */
    httpServer.listen(port, "0.0.0.0", () => {
      console.log(`✅ Server listening on port ${port}`);
      console.log(`➡️ Loading routes & background services asynchronously...`);
    });

    /** 2️⃣ THEN LOAD ROUTES + BACKGROUND STUFF ASYNC */
    registerRoutes(app)
      .then(() => console.log("✅ Routes registered"))
      .catch((e) => console.error("❌ Failed to register routes:", e));

    try {
      schedulerService.start();
      console.log("✅ Scheduler started");
    } catch (e) {
      console.error("❌ Scheduler failed to start:", e);
    }

    /** 3️⃣ TEST DATA (UNCHANGED) */
    app.get('/api/job-test', (req, res) => {
      res.status(200).json({
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
      });
    });

  } catch (err) {
    console.error("❌ Fatal startup error:", err);
    process.exit(1);
  }
})();
