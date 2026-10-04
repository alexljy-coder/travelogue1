import 'server-only';
import { cache } from 'react';
import { createPublicClient } from '@/lib/supabase/public';
import { queryHotel, queryHotelIndex } from './public-hotels';
export const getHotel = cache(async (slug: string) => queryHotel(createPublicClient(), slug));
export async function publicHotels(page: number) { try {
    return { ...await queryHotelIndex(createPublicClient(), page), unavailable: false };
}
catch {
    return { hotels: [], hasNext: false, unavailable: true };
} }
