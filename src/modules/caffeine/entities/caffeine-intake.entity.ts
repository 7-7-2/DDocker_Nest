export interface CaffeineIntakeRow {
  id: number;
  user_id: string;
  brand_id: number;
  caffeine: number;
  size: string;
  shot: number;
  intensity: string;
  product_name: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}
