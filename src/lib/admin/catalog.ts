import type { Database } from '@/types/database';
export type Country = Database['public']['Tables']['countries']['Row'];
export type City = Database['public']['Tables']['cities']['Row'];
export type CityOption = City & { country_name: string };
export type Trip = Database['public']['Tables']['trips']['Row'];
export type Location = Database['public']['Tables']['locations']['Row'];

export type Hotel = Database['public']['Tables']['hotels']['Row'];
export type Stay = Database['public']['Tables']['stays']['Row'];
export type StayOption = Stay & { hotel_name: string; trip_title: string };
