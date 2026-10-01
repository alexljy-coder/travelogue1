import Link from 'next/link';
import type { AdminClient } from '@/lib/admin/queries';
export async function AdminTripStays({ client, tripId }: {
    client: AdminClient;
    tripId: string;
}) { const stays = await client.from('stays').select('id,hotel_id,check_in,status', { count: 'exact' }).eq('trip_id', tripId).order('check_in', { ascending: false, nullsFirst: false }).order('id').limit(25); if (stays.error)
    throw new Error('Unable to load Trip Stays.'); const ids = [...new Set((stays.data ?? []).map(s => s.hotel_id))]; const hotels = ids.length ? await client.from('hotels').select('id,name').in('id', ids) : { data: [], error: null }; if (hotels.error)
    throw new Error('Unable to load Hotels.'); return <section className="content-section"><h2>Hotels / Stays</h2><Link href={`/admin/stays/new?trip=${tripId}`}>Add Stay</Link>{!stays.data?.length ? <p>No Stays recorded yet.</p> : <ul>{stays.data.map(s => <li key={s.id}><Link href={`/admin/stays/${s.id}`}>{hotels.data?.find(h => h.id === s.hotel_id)?.name} · {s.check_in ?? 'Undated Stay'}</Link> · {s.status}</li>)}</ul>}{(stays.count ?? 0) > 25 && <Link href="/admin/stays">All Stays</Link>}</section>; }
