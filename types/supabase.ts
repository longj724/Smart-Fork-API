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
      Meal_Embeddings: {
        Row: {
          content: string
          embedding: string
          id: number
          meal_id: number
          token_count: number | null
          user_id: string
        }
        Insert: {
          content: string
          embedding: string
          id?: number
          meal_id: number
          token_count?: number | null
          user_id: string
        }
        Update: {
          content?: string
          embedding?: string
          id?: number
          meal_id?: number
          token_count?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "Meal_Embeddings_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "Meals"
            referencedColumns: ["id"]
          }
        ]
      }
      Meals: {
        Row: {
          createdAt: string
          datetime: string
          id: number
          imageUrls: string[] | null
          notes: string | null
          type: string | null
          userId: string
        }
        Insert: {
          createdAt?: string
          datetime: string
          id?: number
          imageUrls?: string[] | null
          notes?: string | null
          type?: string | null
          userId: string
        }
        Update: {
          createdAt?: string
          datetime?: string
          id?: number
          imageUrls?: string[] | null
          notes?: string | null
          type?: string | null
          userId?: string
        }
        Relationships: []
      }
      Messages: {
        Row: {
          created_at: string
          id: number
          messages: string
          token_count: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          messages: string
          token_count: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: number
          messages?: string
          token_count?: number
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_meals_by_year_month:
        | {
            Args: {
              year: number
              month: number
            }
            Returns: {
              createdAt: string
              datetime: string
              id: number
              imageUrls: string[] | null
              notes: string | null
              type: string | null
              userId: string
            }[]
          }
        | {
            Args: {
              year: number
              month: number
              userid: string
            }
            Returns: {
              createdAt: string
              datetime: string
              id: number
              imageUrls: string[] | null
              notes: string | null
              type: string | null
              userId: string
            }[]
          }
      hnswhandler: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      ivfflathandler: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      meal_simliarity_search: {
        Args: {
          query_embedding: string
          similarity_threshold: number
          match_count: number
        }
        Returns: {
          content: string
          meal_id: number
          simliarity: number
        }[]
      }
      requesting_user_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      vector_avg: {
        Args: {
          "": number[]
        }
        Returns: string
      }
      vector_dims: {
        Args: {
          "": string
        }
        Returns: number
      }
      vector_norm: {
        Args: {
          "": string
        }
        Returns: number
      }
      vector_out: {
        Args: {
          "": string
        }
        Returns: unknown
      }
      vector_send: {
        Args: {
          "": string
        }
        Returns: string
      }
      vector_typmod_in: {
        Args: {
          "": unknown[]
        }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (Database["public"]["Tables"] & Database["public"]["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (Database["public"]["Tables"] &
      Database["public"]["Views"])
  ? (Database["public"]["Tables"] &
      Database["public"]["Views"])[PublicTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
  ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
  ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof Database["public"]["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof Database["public"]["Enums"]
  ? Database["public"]["Enums"][PublicEnumNameOrOptions]
  : never
