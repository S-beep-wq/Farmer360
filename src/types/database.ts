
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "buyer_demands": {
                  Row: {
                    "buyer_id": string,"closed_at": string | null,"created_at": string,"crop_id": string,"demand_status": string,"demand_type": string,"district": string,"id": string,"location": string,"payment_terms": string | null,"pickup_available": boolean,"quality_requirements": string | null,"quantity": number,"quantity_kg": number | null,"quantity_unit": string,"required_date": string,"state": string,"updated_at": string
                  }
                  Insert: {
                    "buyer_id"?: string,"closed_at"?: string | null,"created_at"?: string,"crop_id": string,"demand_status"?: string,"demand_type": string,"district": string,"id"?: string,"location": string,"payment_terms"?: string | null,"pickup_available": boolean,"quality_requirements"?: string | null,"quantity": number,"quantity_kg"?: never,"quantity_unit": string,"required_date": string,"state": string,"updated_at"?: string
                  }
                  Update: {
                    "buyer_id"?: string,"closed_at"?: string | null,"created_at"?: string,"crop_id"?: string,"demand_status"?: string,"demand_type"?: string,"district"?: string,"id"?: string,"location"?: string,"payment_terms"?: string | null,"pickup_available"?: boolean,"quality_requirements"?: string | null,"quantity"?: number,"quantity_kg"?: never,"quantity_unit"?: string,"required_date"?: string,"state"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "buyer_demands_buyer_id_fkey"
      columns: ["buyer_id"]
isOneToOne: false
      referencedRelation: "buyers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "buyer_demands_crop_id_fkey"
      columns: ["crop_id"]
isOneToOne: false
      referencedRelation: "crop_catalog"
      referencedColumns: ["id"]
    }
                  ]
                },"buyers": {
                  Row: {
                    "buyer_type": string,"created_at": string,"district": string,"id": string,"location": string,"name": string,"organization_name": string | null,"phone": string | null,"preferred_language": string,"state": string,"updated_at": string,"user_id": string,"verification_status": string
                  }
                  Insert: {
                    "buyer_type": string,"created_at"?: string,"district": string,"id"?: string,"location": string,"name": string,"organization_name"?: string | null,"phone"?: string | null,"preferred_language"?: string,"state": string,"updated_at"?: string,"user_id"?: string,"verification_status"?: string
                  }
                  Update: {
                    "buyer_type"?: string,"created_at"?: string,"district"?: string,"id"?: string,"location"?: string,"name"?: string,"organization_name"?: string | null,"phone"?: string | null,"preferred_language"?: string,"state"?: string,"updated_at"?: string,"user_id"?: string,"verification_status"?: string
                  }
                  Relationships: [
                    
                  ]
                },"crop_activities": {
                  Row: {
                    "activity_date": string,"activity_type": string,"cost": number | null,"created_at": string,"crop_cycle_id": string,"deleted_at": string | null,"id": string,"notes": string | null,"quantity": number | null,"quantity_unit": string | null,"updated_at": string
                  }
                  Insert: {
                    "activity_date": string,"activity_type": string,"cost"?: number | null,"created_at"?: string,"crop_cycle_id": string,"deleted_at"?: string | null,"id"?: string,"notes"?: string | null,"quantity"?: number | null,"quantity_unit"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "activity_date"?: string,"activity_type"?: string,"cost"?: number | null,"created_at"?: string,"crop_cycle_id"?: string,"deleted_at"?: string | null,"id"?: string,"notes"?: string | null,"quantity"?: number | null,"quantity_unit"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "crop_activities_crop_cycle_id_fkey"
      columns: ["crop_cycle_id"]
isOneToOne: false
      referencedRelation: "crop_cycle_totals"
      referencedColumns: ["crop_cycle_id"]
    },{
      foreignKeyName: "crop_activities_crop_cycle_id_fkey"
      columns: ["crop_cycle_id"]
isOneToOne: false
      referencedRelation: "crop_cycles"
      referencedColumns: ["id"]
    }
                  ]
                },"crop_catalog": {
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
                    "actual_harvest_date": string | null,"actual_sowing_date": string | null,"completed_at": string | null,"created_at": string,"crop_id": string,"current_growth_stage": string | null,"expected_harvest_date": string | null,"id": string,"notes": string | null,"planned_sowing_date": string | null,"plot_id": string,"season": string,"status": string,"updated_at": string,"variety_name": string | null
                  }
                  Insert: {
                    "actual_harvest_date"?: string | null,"actual_sowing_date"?: string | null,"completed_at"?: string | null,"created_at"?: string,"crop_id": string,"current_growth_stage"?: string | null,"expected_harvest_date"?: string | null,"id"?: string,"notes"?: string | null,"planned_sowing_date"?: string | null,"plot_id": string,"season": string,"status"?: string,"updated_at"?: string,"variety_name"?: string | null
                  }
                  Update: {
                    "actual_harvest_date"?: string | null,"actual_sowing_date"?: string | null,"completed_at"?: string | null,"created_at"?: string,"crop_id"?: string,"current_growth_stage"?: string | null,"expected_harvest_date"?: string | null,"id"?: string,"notes"?: string | null,"planned_sowing_date"?: string | null,"plot_id"?: string,"season"?: string,"status"?: string,"updated_at"?: string,"variety_name"?: string | null
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
                },"crop_observations": {
                  Row: {
                    "ai_analysis": Json | null,"ai_confidence": number | null,"created_at": string,"created_by": string,"crop_cycle_id": string,"deleted_at": string | null,"farmer_notes": string | null,"growth_stage": string | null,"health_status": string,"id": string,"observation_date": string,"updated_at": string
                  }
                  Insert: {
                    "ai_analysis"?: Json | null,"ai_confidence"?: number | null,"created_at"?: string,"created_by"?: string,"crop_cycle_id": string,"deleted_at"?: string | null,"farmer_notes"?: string | null,"growth_stage"?: string | null,"health_status": string,"id"?: string,"observation_date": string,"updated_at"?: string
                  }
                  Update: {
                    "ai_analysis"?: Json | null,"ai_confidence"?: number | null,"created_at"?: string,"created_by"?: string,"crop_cycle_id"?: string,"deleted_at"?: string | null,"farmer_notes"?: string | null,"growth_stage"?: string | null,"health_status"?: string,"id"?: string,"observation_date"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "crop_observations_crop_cycle_id_fkey"
      columns: ["crop_cycle_id"]
isOneToOne: false
      referencedRelation: "crop_cycle_totals"
      referencedColumns: ["crop_cycle_id"]
    },{
      foreignKeyName: "crop_observations_crop_cycle_id_fkey"
      columns: ["crop_cycle_id"]
isOneToOne: false
      referencedRelation: "crop_cycles"
      referencedColumns: ["id"]
    }
                  ]
                },"crop_photos": {
                  Row: {
                    "captured_at": string | null,"created_at": string,"file_name": string,"file_size": number,"id": string,"mime_type": string,"observation_id": string,"storage_path": string,"uploaded_at": string
                  }
                  Insert: {
                    "captured_at"?: string | null,"created_at"?: string,"file_name": string,"file_size": number,"id"?: string,"mime_type": string,"observation_id": string,"storage_path": string,"uploaded_at"?: string
                  }
                  Update: {
                    "captured_at"?: string | null,"created_at"?: string,"file_name"?: string,"file_size"?: number,"id"?: string,"mime_type"?: string,"observation_id"?: string,"storage_path"?: string,"uploaded_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "crop_photos_observation_id_fkey"
      columns: ["observation_id"]
isOneToOne: false
      referencedRelation: "crop_observations"
      referencedColumns: ["id"]
    }
                  ]
                },"demand_interests": {
                  Row: {
                    "created_at": string,"demand_id": string,"farmer_id": string,"id": string,"note": string | null
                  }
                  Insert: {
                    "created_at"?: string,"demand_id": string,"farmer_id"?: string,"id"?: string,"note"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"demand_id"?: string,"farmer_id"?: string,"id"?: string,"note"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "demand_interests_demand_id_fkey"
      columns: ["demand_id"]
isOneToOne: false
      referencedRelation: "buyer_demands"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "demand_interests_farmer_id_fkey"
      columns: ["farmer_id"]
isOneToOne: false
      referencedRelation: "farmers"
      referencedColumns: ["id"]
    }
                  ]
                },"expenses": {
                  Row: {
                    "amount": number,"category": string,"created_at": string,"crop_cycle_id": string,"currency": string,"deleted_at": string | null,"expense_date": string,"id": string,"notes": string | null,"quantity": number | null,"quantity_unit": string | null,"updated_at": string,"vendor": string | null
                  }
                  Insert: {
                    "amount": number,"category": string,"created_at"?: string,"crop_cycle_id": string,"currency"?: string,"deleted_at"?: string | null,"expense_date": string,"id"?: string,"notes"?: string | null,"quantity"?: number | null,"quantity_unit"?: string | null,"updated_at"?: string,"vendor"?: string | null
                  }
                  Update: {
                    "amount"?: number,"category"?: string,"created_at"?: string,"crop_cycle_id"?: string,"currency"?: string,"deleted_at"?: string | null,"expense_date"?: string,"id"?: string,"notes"?: string | null,"quantity"?: number | null,"quantity_unit"?: string | null,"updated_at"?: string,"vendor"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "expenses_crop_cycle_id_fkey"
      columns: ["crop_cycle_id"]
isOneToOne: false
      referencedRelation: "crop_cycle_totals"
      referencedColumns: ["crop_cycle_id"]
    },{
      foreignKeyName: "expenses_crop_cycle_id_fkey"
      columns: ["crop_cycle_id"]
isOneToOne: false
      referencedRelation: "crop_cycles"
      referencedColumns: ["id"]
    }
                  ]
                },"farmers": {
                  Row: {
                    "created_at": string,"deletion_requested_at": string | null,"district": string,"full_name": string,"id": string,"phone": string | null,"preferred_language": string,"state": string,"updated_at": string,"user_id": string,"village": string
                  }
                  Insert: {
                    "created_at"?: string,"deletion_requested_at"?: string | null,"district": string,"full_name": string,"id"?: string,"phone"?: string | null,"preferred_language"?: string,"state": string,"updated_at"?: string,"user_id"?: string,"village": string
                  }
                  Update: {
                    "created_at"?: string,"deletion_requested_at"?: string | null,"district"?: string,"full_name"?: string,"id"?: string,"phone"?: string | null,"preferred_language"?: string,"state"?: string,"updated_at"?: string,"user_id"?: string,"village"?: string
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
                },"harvests": {
                  Row: {
                    "created_at": string,"crop_cycle_id": string,"deleted_at": string | null,"harvest_date": string,"id": string,"notes": string | null,"quality_grade": string | null,"quantity": number,"quantity_unit": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"crop_cycle_id": string,"deleted_at"?: string | null,"harvest_date": string,"id"?: string,"notes"?: string | null,"quality_grade"?: string | null,"quantity": number,"quantity_unit": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"crop_cycle_id"?: string,"deleted_at"?: string | null,"harvest_date"?: string,"id"?: string,"notes"?: string | null,"quality_grade"?: string | null,"quantity"?: number,"quantity_unit"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "harvests_crop_cycle_id_fkey"
      columns: ["crop_cycle_id"]
isOneToOne: false
      referencedRelation: "crop_cycle_totals"
      referencedColumns: ["crop_cycle_id"]
    },{
      foreignKeyName: "harvests_crop_cycle_id_fkey"
      columns: ["crop_cycle_id"]
isOneToOne: false
      referencedRelation: "crop_cycles"
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
                },"sales": {
                  Row: {
                    "buyer_name": string | null,"buyer_type": string,"created_at": string,"deleted_at": string | null,"gross_amount": number | null,"harvest_id": string,"id": string,"net_amount": number | null,"notes": string | null,"other_cost": number,"payment_status": string,"price_per_unit": number,"quantity": number,"quantity_unit": string,"sale_date": string,"transport_cost": number,"updated_at": string
                  }
                  Insert: {
                    "buyer_name"?: string | null,"buyer_type": string,"created_at"?: string,"deleted_at"?: string | null,"gross_amount"?: never,"harvest_id": string,"id"?: string,"net_amount"?: never,"notes"?: string | null,"other_cost"?: number,"payment_status": string,"price_per_unit": number,"quantity": number,"quantity_unit": string,"sale_date": string,"transport_cost"?: number,"updated_at"?: string
                  }
                  Update: {
                    "buyer_name"?: string | null,"buyer_type"?: string,"created_at"?: string,"deleted_at"?: string | null,"gross_amount"?: never,"harvest_id"?: string,"id"?: string,"net_amount"?: never,"notes"?: string | null,"other_cost"?: number,"payment_status"?: string,"price_per_unit"?: number,"quantity"?: number,"quantity_unit"?: string,"sale_date"?: string,"transport_cost"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sales_harvest_id_fkey"
      columns: ["harvest_id"]
isOneToOne: false
      referencedRelation: "harvests"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "crop_cycle_totals": {
                  Row: {
                    "crop_cycle_id": string | null,"expense_total": number | null,"harvested_kg": number | null,"revenue": number | null,"selling_costs": number | null,"sold_kg": number | null,"unpaid_sales": number | null,"work_costs": number | null
                  }
                  Insert: {
                           "crop_cycle_id"?: string | null,"expense_total"?: never,"harvested_kg"?: never,"revenue"?: never,"selling_costs"?: never,"sold_kg"?: never,"unpaid_sales"?: never,"work_costs"?: never
                         }
                        Update: {
                           "crop_cycle_id"?: string | null,"expense_total"?: never,"harvested_kg"?: never,"revenue"?: never,"selling_costs"?: never,"sold_kg"?: never,"unpaid_sales"?: never,"work_costs"?: never
                         }
                        Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "account_deletion_requested":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"account_photo_paths":
{ Args: Record<PropertyKey, never>; Returns: string[]
                           },
"boundary_geojson":
{ Args: { "p": Database["public"]['Tables']["plots"]['Row'] }; Returns: Json
                           },
"crop_photo_path_owned":
{ Args: { "p_name": string }; Returns: boolean
                           },
"current_buyer_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"current_farmer_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"delete_my_account":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"demand_interested_farmers":
{ Args: { "p_demand_id": string }; Returns: {
              "created_at": string,"district": string,"full_name": string,"interest_id": string,"note": string,"phone": string,"village": string
            }[]
                           },
"harvest_sold_kg":
{ Args: { "p_except_sale_id"?: string,"p_harvest_id": string }; Returns: number
                           },
"owns_crop_cycle":
{ Args: { "p_crop_cycle_id": string }; Returns: boolean
                           },
"owns_demand":
{ Args: { "p_demand_id": string }; Returns: boolean
                           },
"owns_harvest":
{ Args: { "p_harvest_id": string }; Returns: boolean
                           },
"owns_observation":
{ Args: { "p_observation_id": string }; Returns: boolean
                           },
"owns_plot":
{ Args: { "p_plot_id": string }; Returns: boolean
                           },
"produce_unit_kg":
{ Args: { "p_unit": string }; Returns: number
                           },
"today_in_india":
{ Args: Record<PropertyKey, never>; Returns: string
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
