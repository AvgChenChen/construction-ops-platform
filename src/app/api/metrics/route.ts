import { monitoringAuthorized,operationalStatus,metrics } from '@/lib/ops/monitoring';
export const dynamic='force-dynamic';
export async function GET(req:Request){if(!monitoringAuthorized(req))return new Response('Unauthorized',{status:401});try{return new Response(metrics(await operationalStatus()),{headers:{'Content-Type':'text/plain; version=0.0.4','Cache-Control':'no-store'}});}catch{return new Response('Metrics unavailable',{status:503});}}
