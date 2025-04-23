// src/lib/types.ts
// Manually defined types for the application

// Google Places Opening Hours structure
export interface OpeningHoursPeriodDetail {
  day: number; // 0-6, Sunday-Saturday
  time: string; // HHMM format
}
export interface OpeningHoursPeriod {
  open: OpeningHoursPeriodDetail;
  close?: OpeningHoursPeriodDetail; // May be undefined for 24/7
}
export interface OpeningHours {
  open_now?: boolean;
  periods?: OpeningHoursPeriod[];
  weekday_text?: string[];
}

// Coffee shop type definition
export interface CoffeeShop {
  id: string; // Supabase internal UUID
  google_place_id: string; // Google Place ID
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
  opening_hours?: OpeningHours; // Use the detailed type
  utc_offset_minutes?: number; // Added for timezone-aware open check
  price_range?: string;
  // wifi_available?: boolean; // Keep existing for now, map if needed later
  // pet_friendly?: boolean; // Keep existing for now, map if needed later
  // charging_available?: boolean; // Keep existing for now, map if needed later
  has_wifi?: boolean; // Matches DB column
  has_chargers?: boolean; // Matches DB column
  charger_count?: number; // Matches DB column
  pet_friendly?: boolean; // Assuming this exists in DB or is handled differently
  description?: string;
  rating?: number;
  menu_highlights?: string[];
  images?: string[]; // Stores photo references or URLs
  created_at?: string;
  updated_at?: string;
}

// User type definition
export interface User {
  id: string;
  email?: string;
  name?: string;
  avatar_url?: string;
}

// Review type definition
export interface Review {
  id: string;
  coffee_shop_id: string;
  user_id: string;
  rating: number;
  comment?: string;
  created_at: string;
  user?: User;
}

// Favorite/Bookmark type definition
export interface Favorite {
  id: string;
  user_id: string;
  coffee_shop_id: string;
  list_name?: string; // For organizing into different lists
  created_at: string;
  coffee_shop?: CoffeeShop;
}


// --- Google Places API Types ---
export interface PlaceResult {
  place_id: string;
  name: string;
  geometry: { location: { lat: number; lng: number; }; };
  vicinity?: string;
  rating?: number;
}
export interface PlaceReview {
  author_name?: string;
  rating?: number;
  text?: string;
  time?: number; // Unix timestamp
}

// Structure for Google Place Photos
export interface PlacePhoto {
  photo_reference: string;
  height: number;
  width: number;
  html_attributions?: string[];
}

export interface PlaceDetailsResult {
  place_id: string;
  name?: string;
  formatted_address?: string;
  geometry?: { location: { lat: number; lng: number; }; };
  rating?: number;
  opening_hours?: OpeningHours; // Re-use existing OpeningHours type
  reviews?: PlaceReview[];
  website?: string;
  editorial_summary?: { overview?: string };
  photos?: PlacePhoto[]; // Added photos field
  price_level?: number;
  utc_offset_minutes?: number;
}
export interface PlacesNearbyResponse {
  results: PlaceResult[];
  status: string; // e.g., "OK", "ZERO_RESULTS", "INVALID_REQUEST"
  error_message?: string;
  next_page_token?: string;
}
export interface PlaceDetailsResponse {
  result?: PlaceDetailsResult;
  status: string;
  error_message?: string;
}

// --- AI Response Types ---
export interface AiFilters {
  location_term?: string | null; // Added
  openAfter?: string | null; // HH:MM format
  openNow?: boolean | null;
  wifi_required?: boolean | null; // Renamed from wifi
  wifi_quality_min?: number | null; // Added
  power_outlets_required?: boolean | null; // Renamed from charging
  pets?: boolean | null; // Kept as 'pets' for simplicity, maps to pet_friendly
  menu_items?: string[] | null; // Added (for specific item search)
  quality?: string | null; // General quality term, maybe map to vibe or rating?
  vibe?: "quiet" | "social" | "solo" | null; // Added
  amenities?: string[] | null; // Added for specific tags like 'desk_lamp'
  distanceKm?: number | null;
  minRating?: number | null; // Maps to overall rating
  coffee_quality_min?: number | null; // Added
  price_tier?: "cheap" | "mid" | "high" | null; // Added
  socialVibe?: boolean | null; // Keep for now, might overlap with vibe:'social'
  no_time_limit?: boolean | null; // Added
}

// This specific AiResponse type might become less useful if parsing directly into the structured object below
export type AiResponse =
  | { related: true; keywords: string; count: number | null; filters: AiFilters | null } // Old structure, might deprecate
  | { related: false; message: string; suggestion?: string | null }; // Old structure

// Define the expected structured response from Gemini based on the new prompt
export interface GeminiStructuredResponse {
  query_type: "find_cafe" | "unrelated" | "clarification_needed";
  filters: AiFilters | null;
  limit: number | null;
  explanation: string | null;
}


// Database interface reflecting actual Supabase structure
export interface DatabaseSchema {
  Tables: {
    locations: { // Correct table name
      Row: CoffeeShop; // CoffeeShop interface now includes the new fields
    };
    users: {
      Row: User;
    };
    reviews: {
      Row: Review;
    };
    favorites: {
      Row: Favorite;
    };
  };
}
