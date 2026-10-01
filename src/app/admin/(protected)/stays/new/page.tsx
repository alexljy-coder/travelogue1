import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { getStayCatalog } from '@/lib/admin/queries';
import { StayForm } from '@/components/admin/stay-form';
import { uuidSchema } from '@/lib/validation/content';
export default async function Page({ searchParams }: {
    searchParams: Promise<{
        hotel?: string;
        trip?: string;
    }>;
}) { const { client } = await requireAdmin(); const params = await searchParams; const catalog = await getStayCatalog(client); return <main><Link href="/admin/stays">Stays</Link><h1>Create Stay</h1><StayForm {...catalog} hotelId={uuidSchema.safeParse(params.hotel).success ? params.hotel : undefined} tripId={uuidSchema.safeParse(params.trip).success ? params.trip : undefined}/></main>; }
