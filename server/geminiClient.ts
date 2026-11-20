import { GoogleGenAI } from "@google/genai";

// On Replit, Gemini goes through Replit AI Integrations (billed to the Replit
// account's credits, no daily free-tier cap). Elsewhere (local dev, Workers),
// fall back to a direct GEMINI_API_KEY.
let logged = false;

export function createGeminiClient(): GoogleGenAI {
  const integrationKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
  const integrationUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
  const viaIntegrations = Boolean(integrationKey && integrationUrl);
  if (!logged) {
    console.log(`Gemini: ${viaIntegrations ? "Replit AI Integrations" : "GEMINI_API_KEY"} (${GEMINI_TEXT_MODEL})`);
    logged = true;
  }
  if (viaIntegrations) {
    return new GoogleGenAI({
      apiKey: integrationKey,
      httpOptions: { apiVersion: "", baseUrl: integrationUrl },
    });
  }
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

// gemini-2.5-flash is deprecated (routed to gemini-3.5-flash-lite from 2026-12-01).
export const GEMINI_TEXT_MODEL = "gemini-3.5-flash-lite";
