import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import { neon } from "@neondatabase/serverless";
import path from "path";
import { schedulerService } from "./services/schedulerService";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// PostgreSQL session store for proper persistence in hosted environments
const PgSession = ConnectPgSimple(session);
const sql = neon(process.env.DATABASE_URL!);

// Session table will be created automatically by connect-pg-simple

// Session configuration with PostgreSQL store
app.use(session({
  store: new PgSession({
    conString: process.env.DATABASE_URL,
    tableName: 'session',
    createTableIfMissing: true, // Let connect-pg-simple create the table
    pruneSessionInterval: 60 * 15, // Prune expired sessions every 15 minutes
    errorLog: console.error // Log any store errors
  }),
  secret: process.env.SESSION_SECRET || 'moorehorticulture-secret',
  resave: false, // Don't save session if unmodified  
  saveUninitialized: true, // Create session for all requests to ensure proper cookie handling
  rolling: true, // Reset expiration time on each request
  cookie: {
    secure: false, // Set to true in production with HTTPS
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: '/',
    sameSite: 'lax'
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
    userId: number;
    role: string;
  }
}

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

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Add a specific route for the job tracker page before vite middleware
  // This ensures this particular route won't get caught in the vite catch-all
  app.get('/track', (req, res) => {
    res.sendFile(path.resolve('./client/index.html'));
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
  
  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    // Start the scheduler service after server is running
    schedulerService.start();
  });
})();
