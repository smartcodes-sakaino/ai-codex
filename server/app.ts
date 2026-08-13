import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { registerRoutes } from "./routes";
import { pool } from "./db";

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

// Builds and fully configures the Express app (session, JSON parsing, API routes,
// error handler) but does not start listening and does not attach Vite/static-file
// serving — callers (local dev, production static file server, Workers) each wire
// up the remaining piece appropriate to their environment.
export async function createApp() {
  const app = express();

  // Both Replit and Cloudflare Workers put a reverse proxy in front of this app,
  // terminating TLS themselves and forwarding to us over plain HTTP with an
  // X-Forwarded-Proto header. Without "trust proxy", Express doesn't honor that
  // header, so it sees every request as insecure — and express-session silently
  // refuses to ever set the session cookie when cookie.secure is true, since it
  // thinks the connection isn't HTTPS. This is what allows login to "succeed"
  // (the response body is correct) while every subsequent request still comes
  // back unauthenticated, because no session cookie was ever issued.
  app.set("trust proxy", 1);

  const PgSession = connectPgSimple(session);
  app.use(
    session({
      // pruneSessionInterval is disabled: its background setInterval would fire
      // outside of any request's execution context, which Cloudflare Workers
      // disallows (I/O is only permitted while handling a request) and was
      // observed to intermittently hang/crash the isolate for later requests.
      store: new PgSession({ pool, createTableIfMissing: true, pruneSessionInterval: false }),
      secret: process.env.SESSION_SECRET || "",
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        secure: process.env.NODE_ENV === "production",
      },
    }),
  );

  app.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.use(express.urlencoded({ extended: false }));

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

        log(logLine);
      }
    });

    next();
  });

  await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  return app;
}
