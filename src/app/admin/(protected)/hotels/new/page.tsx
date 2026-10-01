import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { getGeography } from '@/lib/admin/queries';
import { HotelForm } from '@/components/admin/hotel-form';
export default async function Page() { const { client } = await requireAdmin(); return <main><Link href="/admin/hotels">Hotels</Link><h1>Create Hotel</h1><HotelForm {...await getGeography(client)}/></main>; }
