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
  id: string;
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
  opening_hours?: OpeningHours; // Use the detailed type
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
  images?: string[];
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
