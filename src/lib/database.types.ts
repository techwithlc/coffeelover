export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      favorites: {
        Row: {
          coffee_shop_id: string
          created_at: string
          id: number
          user_id: string | null
        }
        Insert: {
          coffee_shop_id: string
          created_at?: string
          id?: number
          user_id?: string | null
        }
        Update: {
          coffee_shop_id?: string
          created_at?: string
          id?: number
          user_id?: string | null
        }
        Relationships: []
      }
      location_ratings: {
        Row: {
          coffee_rating: number | null
          created_at: string
          id: string
          location_id: string
          staff_rating: number | null
          user_id: string
          wifi_rating: number | null
        }
        Insert: {
          coffee_rating?: number | null
          created_at?: string
          id?: string
          location_id: string
          staff_rating?: number | null
          user_id: string
          wifi_rating?: number | null
        }
        Update: {
          coffee_rating?: number | null
          created_at?: string
          id?: string
          location_id?: string
          staff_rating?: number | null
          user_id?: string
          wifi_rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "location_ratings_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      location_wifi_details: {
        Row: {
          created_at: string
          id: string
          location_id: string
          password: string | null
          ssid: string | null
          user_id: string | null
          wifi_type: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          location_id: string
          password?: string | null
          ssid?: string | null
          user_id?: string | null
          wifi_type?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: string
          password?: string | null
          ssid?: string | null
          user_id?: string | null
          wifi_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "location_wifi_details_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_favorite: boolean | null
          lat: number
          lng: number
          name: string | null
          opening_hours: string | null
          price_range: string | null
          tags: string[] | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_favorite?: boolean | null
          lat: number
          lng: number
          name?: string | null
          opening_hours?: string | null
          price_range?: string | null
          tags?: string[] | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_favorite?: boolean | null
          lat?: number
          lng?: number
          name?: string | null
          opening_hours?: string | null
          price_range?: string | null
          tags?: string[] | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string
          location_id: string
          rating: number | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          id?: string
          location_id: string
          rating?: number | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          id?: string
          location_id?: string
          rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
