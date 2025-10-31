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
      profiles: {
        Row: {
          id: string
          email: string
          first_name: string | null
          last_name: string | null
          role: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          first_name?: string | null
          last_name?: string | null
          role?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          first_name?: string | null
          last_name?: string | null
          role?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      law_firms: {
        Row: {
          id: string
          name: string
          description: string | null
          location: string
          website: string | null
          contact_email: string
          contact_phone: string | null
          capacity: number | null
          success_rate: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          location: string
          website?: string | null
          contact_email: string
          contact_phone?: string | null
          capacity?: number | null
          success_rate?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          location?: string
          website?: string | null
          contact_email?: string
          contact_phone?: string | null
          capacity?: number | null
          success_rate?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      practice_areas: {
        Row: {
          id: string
          name: string
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          created_at?: string
        }
        Relationships: []
      }
      law_firm_practice_areas: {
        Row: {
          id: string
          law_firm_id: string
          practice_area_id: string
          experience_years: number | null
          created_at: string
        }
        Insert: {
          id?: string
          law_firm_id: string
          practice_area_id: string
          experience_years?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          law_firm_id?: string
          practice_area_id?: string
          experience_years?: number | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "law_firm_practice_areas_law_firm_id_fkey"
            columns: ["law_firm_id"]
            isOneToOne: false
            referencedRelation: "law_firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "law_firm_practice_areas_practice_area_id_fkey"
            columns: ["practice_area_id"]
            isOneToOne: false
            referencedRelation: "practice_areas"
            referencedColumns: ["id"]
          }
        ]
      }
      conversations: {
        Row: {
          id: string
          tavus_conversation_id: string
          user_id: string | null
          name: string | null
          email: string | null
          phone: string | null
          case_description: string | null
          urgency_score: number | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tavus_conversation_id: string
          user_id?: string | null
          name?: string | null
          email?: string | null
          phone?: string | null
          case_description?: string | null
          urgency_score?: number | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tavus_conversation_id?: string
          user_id?: string | null
          name?: string | null
          email?: string | null
          phone?: string | null
          case_description?: string | null
          urgency_score?: number | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      leads: {
        Row: {
          id: string
          conversation_id: string
          practice_area_id: string | null
          user_id: string | null
          status: string
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          practice_area_id?: string | null
          user_id?: string | null
          status?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          practice_area_id?: string | null
          user_id?: string | null
          status?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_practice_area_id_fkey"
            columns: ["practice_area_id"]
            isOneToOne: false
            referencedRelation: "practice_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      matches: {
        Row: {
          id: string
          lead_id: string
          law_firm_id: string
          match_score: number | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          lead_id: string
          law_firm_id: string
          match_score?: number | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          lead_id?: string
          law_firm_id?: string
          match_score?: number | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_law_firm_id_fkey"
            columns: ["law_firm_id"]
            isOneToOne: false
            referencedRelation: "law_firms"
            referencedColumns: ["id"]
          }
        ]
      }
    }
  }
}