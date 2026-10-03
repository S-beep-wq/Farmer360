
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "crop_catalog": {
                  Row: {
                    "category": string,"created_at": string,"description": string | null,"id": string,"labour_requirement": string | null,"name": string,"name_hi": string,"scientific_name": string | null,"season": string | null,"typical_duration_days": number | null,"updated_at": string,"water_requirement": string | null
                  }
                  Insert: {
                    "category": string,"created_at"?: string,"description"?: string | null,"id"?: string,"labour_requirement"?: string | null,"name": string,"name_hi": string,"scientific_name"?: string | null,"season"?: string | null,"typical_duration_days"?: number | null,"updated_at"?: string,"water_requirement"?: string | null
                  }
                  Update: {
                    "category"?: string,"created_at"?: string,"description"?: string | null,"id"?: string,"labour_requirement"?: string | null,"name"?: string,"name_hi"?: string,"scientific_name"?: string | null,"season"?: string | null,"typical_duration_days"?: number | null,"updated_at"?: string,"water_requirement"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"crop_cycles": {
                  Row: {
                    "actual_harvest_date": string | null,"actual_sowing_date": string | null,"created_at": string,"crop_id": string,"current_growth_stage": string | null,"expected_harvest_date": string | null,"id": string,"notes": string | null,"planned_sowing_date": string | null,"plot_id": string,"season": string,"status": string,"updated_at": string,"variety_name": string | null
                  }
                  Insert: {
                    "actual_harvest_date"?: string | null,"actual_sowing_date"?: string | null,"created_at"?: string,"crop_id": string,"current_growth_stage"?: string | null,"expected_harvest_date"?: string | null,"id"?: string,"notes"?: string | null,"planned_sowing_date"?: string | null,"plot_id": string,"season": string,"status"?: string,"updated_at"?: string,"variety_name"?: string | null
                  }
                  Update: {
                    "actual_harvest_date"?: string | null,"actual_sowing_date"?: string | null,"created_at"?: string,"crop_id"?: string,"current_growth_stage"?: string | null,"expected_harvest_date"?: string | null,"id"?: string,"notes"?: string | null,"planned_sowing_date"?: string | null,"plot_id"?: string,"season"?: string,"status"?: string,"updated_at"?: string,"variety_name"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "crop_cycles_crop_id_fkey"
      columns: ["crop_id"]
isOneToOne: false
      referencedRelation: "crop_catalog"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "crop_cycles_plot_id_fkey"
      columns: ["plot_id"]
isOneToOne: false
      referencedRelation: "plots"
      referencedColumns: ["id"]
    }
                  ]
                },"farmers": {
                  Row: {
                    "created_at": string,"district": string,"full_name": string,"id": string,"phone": string | null,"preferred_language": string,"state": string,"updated_at": string,"user_id": string,"village": string
                  }
                  Insert: {
                    "created_at"?: string,"district": string,"full_name": string,"id"?: string,"phone"?: string | null,"preferred_language"?: string,"state": string,"updated_at"?: string,"user_id"?: string,"village": string
                  }
                  Update: {
                    "created_at"?: string,"district"?: string,"full_name"?: string,"id"?: string,"phone"?: string | null,"preferred_language"?: string,"state"?: string,"updated_at"?: string,"user_id"?: string,"village"?: string
                  }
                  Relationships: [
                    
                  ]
                },"farms": {
                  Row: {
                    "area_unit": string | null,"created_at": string,"district": string | null,"farmer_id": string,"id": string,"irrigation_available": boolean | null,"irrigation_type": string | null,"latitude": number | null,"longitude": number | null,"name": string,"notes": string | null,"soil_source": string | null,"soil_type": string | null,"state": string | null,"total_area": number | null,"updated_at": string,"village": string | null
                  }
                  Insert: {
                    "area_unit"?: string | null,"created_at"?: string,"district"?: string | null,"farmer_id"?: string,"id"?: string,"irrigation_available"?: boolean | null,"irrigation_type"?: string | null,"latitude"?: number | null,"longitude"?: number | null,"name": string,"notes"?: string | null,"soil_source"?: string | null,"soil_type"?: string | null,"state"?: string | null,"total_area"?: number | null,"updated_at"?: string,"village"?: string | null
                  }
                  Update: {
                    "area_unit"?: string | null,"created_at"?: string,"district"?: string | null,"farmer_id"?: string,"id"?: string,"irrigation_available"?: boolean | null,"irrigation_type"?: string | null,"latitude"?: number | null,"longitude"?: number | null,"name"?: string,"notes"?: string | null,"soil_source"?: string | null,"soil_type"?: string | null,"state"?: string | null,"total_area"?: number | null,"updated_at"?: string,"village"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "farms_farmer_id_fkey"
      columns: ["farmer_id"]
isOneToOne: false
      referencedRelation: "farmers"
      referencedColumns: ["id"]
    }
                  ]
                },"plots": {
                  Row: {
                    "area": number | null,"area_unit": string | null,"boundary": unknown,"boundary_area_sq_m": number | null,"created_at": string,"farm_id": string,"id": string,"irrigation_available": boolean | null,"irrigation_type": string | null,"latitude": number | null,"location_accuracy_m": number | null,"location_source": string | null,"longitude": number | null,"name": string,"notes": string | null,"soil_ph": number | null,"soil_source": string | null,"soil_type": string | null,"updated_at": string,"boundary_geojson": Json | null
                  }
                  Insert: {
                    "area"?: number | null,"area_unit"?: string | null,"boundary"?: unknown,"boundary_area_sq_m"?: number | null,"created_at"?: string,"farm_id": string,"id"?: string,"irrigation_available"?: boolean | null,"irrigation_type"?: string | null,"latitude"?: number | null,"location_accuracy_m"?: number | null,"location_source"?: string | null,"longitude"?: number | null,"name": string,"notes"?: string | null,"soil_ph"?: number | null,"soil_source"?: string | null,"soil_type"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "area"?: number | null,"area_unit"?: string | null,"boundary"?: unknown,"boundary_area_sq_m"?: number | null,"created_at"?: string,"farm_id"?: string,"id"?: string,"irrigation_available"?: boolean | null,"irrigation_type"?: string | null,"latitude"?: number | null,"location_accuracy_m"?: number | null,"location_source"?: string | null,"longitude"?: number | null,"name"?: string,"notes"?: string | null,"soil_ph"?: number | null,"soil_source"?: string | null,"soil_type"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "plots_farm_id_fkey"
      columns: ["farm_id"]
isOneToOne: false
      referencedRelation: "farms"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "boundary_geojson":
{ Args: { "p": Database["public"]['Tables']["plots"]['Row'] }; Returns: Json
                           },
"current_farmer_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"owns_plot":
{ Args: { "p_plot_id": string }; Returns: boolean
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
