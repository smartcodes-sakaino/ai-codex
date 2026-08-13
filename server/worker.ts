import { httpServerHandler } from "cloudflare:node";

interface WorkerEnv {
  HYPERDRIVE: { connectionString: string };
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  SESSION_SECRET: string;
  GEMINI_API_KEY: string;
  GOOGLE_SERVICE_ACCOUNT_JSON: string;
  DRIVE_IMAGES_FOLDER_ID: string;
  DRIVE_VIDEOS_FOLDER_ID: string;
}

async function initApp(env: WorkerEnv) {
  // server/db.ts, objectStorage.ts, etc. all read plain process.env.*
  // values at module-import time, so these must be set before ./app
  // (and its dependency graph) is imported.
  process.env.DATABASE_URL = env.HYPERDRIVE.connectionString;
  process.env.SESSION_SECRET = env.SESSION_SECRET;
  process.env.GEMINI_API_KEY = env.GEMINI_API_KEY;
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = env.GOOGLE_SERVICE_ACCOUNT_JSON;
  process.env.DRIVE_IMAGES_FOLDER_ID = env.DRIVE_IMAGES_FOLDER_ID;
  process.env.DRIVE_VIDEOS_FOLDER_ID = env.DRIVE_VIDEOS_FOLDER_ID;

  const { createApp } = await import("./app");
  const { setFontLoader } = await import("./lms/certificate");

  // pdfkit needs the Japanese font's raw bytes; on Workers there is no
  // filesystem to read them from, so they are shipped as static assets
  // instead and fetched through the assets binding on first use.
  let fontsPromise: Promise<{ regular: Buffer; bold: Buffer }> | null = null;
  setFontLoader(() => {
    if (!fontsPromise) {
      fontsPromise = (async () => {
        const [regularRes, boldRes] = await Promise.all([
          env.ASSETS.fetch(new Request("https://assets.local/fonts/NotoSansJP-Regular.ttf")),
          env.ASSETS.fetch(new Request("https://assets.local/fonts/NotoSansJP-Bold.ttf")),
        ]);
        return {
          regular: Buffer.from(await regularRes.arrayBuffer()),
          bold: Buffer.from(await boldRes.arrayBuffer()),
        };
      })();
    }
    return fontsPromise;
  });

  const app = await createApp();
  app.listen(3000);
  return httpServerHandler({ port: 3000 });
}

// Workers forbid async I/O (opening a DB connection, fetching, etc.) at the
// top level of the script — it must happen inside a handler. So the whole
// app (which eagerly opens a pg Pool and a session store on import) is only
// built lazily, on the first request, and memoized after that.
let starting: Promise<ReturnType<typeof httpServerHandler>> | null = null;

function start(env: WorkerEnv) {
  if (!starting) {
    starting = initApp(env).catch((err) => {
      // Let the next request try again instead of permanently caching a
      // failed startup (e.g. a transient Hyperdrive connection hiccup) for
      // the lifetime of this isolate.
      starting = null;
      throw err;
    });
  }
  return starting;
}

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext) {
    const handler = await start(env);
    return handler.fetch(request, env, ctx);
  },
};
