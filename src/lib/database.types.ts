export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      locations: {
        Row: {
          id: string
          lat: number
          lng: number
          name: string
          created_at: string
          user_id: string
        }
        Insert: {
          id?: string
          lat: number
          lng: number
          name: string
          created_at?: string
          user_id: string
        }
        Update: {
          id?: string
          lat?: number
          lng?: number
          name?: string
          created_at?: string
          user_id?: string
        }
      }
      reviews: {
        Row: {
          id: string
          location_id: string
          user_id: string
          rating: number
          comment: string | null
          created_at: string
        }
        Insert: {
          id?: string
          location_id: string
          user_id: string
          rating: number
          comment?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          location_id?: string
          user_id?: string
          rating?: number
          comment?: string | null
          created_at?: string
        }
      }
      favorites: {
        Row: {
          id: string
          user_id: string
          location_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          location_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          location_id?: string
          created_at?: string
        }
      }
    }
  }
}