import 'server-only';
import { cache } from 'react';
import { createPublicClient } from '@/lib/supabase/public';
import { queryHotel, queryStay, queryHotelIndex } from './public-stays';
export const getHotel = cache(async (slug: string) => queryHotel(createPublicClient(), slug));
export const getStay = cache(async (hotelId: string, id: string) => queryStay(createPublicClient(), hotelId, id));
export async function publicHotels(page: number) { try {
    return { ...await queryHotelIndex(createPublicClient(), page), unavailable: false };
}
catch {
    return { hotels: [], hasNext: false, unavailable: true };
} }
