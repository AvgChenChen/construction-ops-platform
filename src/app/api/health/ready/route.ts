import { operationalStatus } from '@/lib/ops/monitoring';
export const dynamic='force-dynamic';
export async function GET(){try{const status=await operationalStatus();return Response.json({status:status.ready?'ready':'not_ready'},{status:status.ready?200:503});}catch{return Response.json({status:'not_ready'},{status:503});}}
