// src/config.ts
// API base URL for Twisted Soul backend

// Default: local dev server
const DEFAULT_API_BASE = "http://localhost:8080";

// You can override via Vite env var in production:
// VITE_API_BASE_URL="https://your-backend-domain.com"
export const API_BASE =
  (import.meta as any).env?.VITE_API_BASE_URL || DEFAULT_API_BASE;
