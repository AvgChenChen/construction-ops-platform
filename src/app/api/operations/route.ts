import { cookies } from 'next/headers';
import { cookieName,validSession } from '@/lib/auth';
import { operationalStatus } from '@/lib/ops/monitoring';
export const dynamic='force-dynamic';
export async function GET(){if(!await validSession((await cookies()).get(cookieName)?.value))return new Response('Unauthorized',{status:401});try{return Response.json(await operationalStatus(),{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'Operational status unavailable'},{status:503});}}
