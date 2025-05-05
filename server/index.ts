import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import path from "path";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add direct static file serving for videos
app.use('/videos', express.static(path.join(process.cwd(), 'public', 'videos')));

// Request logging middleware without variable shadowing or monkey-patching
app.use((req, res, next) => {
  const start = Date.now();
  const requestPath = req.path;
  
  // Use on-finish event to log response without monkey-patching res.json
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (requestPath.startsWith("/api")) {
      let logLine = `${req.method} ${requestPath} ${res.statusCode} in ${duration}ms`;
      
      // We can log the response body size for insight without capturing the entire payload
      const contentLength = res.get('Content-Length');
      if (contentLength) {
        logLine += ` :: ${contentLength} bytes`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Main application startup with proper error handling
(async () => {
  try {
    // Register API routes
    const server = await registerRoutes(app);
    
    // Add a 404 handler for unmatched API routes
    app.use('/api/*', (req, res) => {
      res.status(404).json({ message: "API endpoint not found" });
    });

    // Error handling middleware without re-throwing errors
    app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      console.error(`Error (${status}):`, err);
      
      // Send a response if headers haven't been sent yet
      if (!res.headersSent) {
        res.status(status).json({ message });
      }
      
      // Continue to next middleware instead of throwing
      next();
    });

    // Setup Vite or serve static files based on environment
    // Use process.env.NODE_ENV instead of app.get("env")
    if (process.env.NODE_ENV === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Use environment variable for port with a fallback
    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;
    
    // Start the server
    server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      log(`serving on port ${port}`);
    });
  } catch (err) {
    // Global error handler for startup issues
    console.error("Server startup error:", err);
    process.exit(1);
  }
})();
