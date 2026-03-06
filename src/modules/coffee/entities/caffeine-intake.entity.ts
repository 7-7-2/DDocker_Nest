export interface CaffeineIntakeRow {
  id: number;
  user_id: string;
  brand_id: number;
  product_name: string;
  caffeine: number;
  size: string;
  shot: number;
  intensity: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}
