/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_MAPS_API_KEY: string;
  readonly VITE_GEMINI_API_KEY: string;
  readonly VITE_SUPABASE_URL: string; // Assuming this is used in supabaseClient.ts
  readonly VITE_SUPABASE_ANON_KEY: string; // Assuming this is used in supabaseClient.ts
  // Add other environment variables your application uses here
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
