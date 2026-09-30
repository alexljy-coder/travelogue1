import type { Database } from '@/types/database';

// Anonymous column grants enforce these boundaries even if a query accidentally asks for more.
export const publicPhotoColumns = [
  'id', 'width', 'height', 'classification', 'context', 'featured', 'caption', 'description',
  'status', 'editorial_order', 'trip_id', 'location_id', 'stay_id', 'captured_at',
  'camera_make', 'camera_model', 'lens', 'focal_length', 'aperture', 'shutter_speed', 'iso',
  'created_at', 'updated_at',
] as const satisfies readonly (keyof Database['public']['Tables']['photos']['Row'])[];

export const publicStayColumns = [
  'id', 'hotel_id', 'trip_id', 'check_in', 'check_out', 'room_type', 'purpose', 'rating',
  'review_text', 'status', 'editorial_order', 'created_at', 'updated_at',
] as const satisfies readonly (keyof Database['public']['Tables']['stays']['Row'])[];
