import { cookies } from 'next/headers';
import { sessionActor, cookieName, validOrigin } from '@/lib/auth';
import { contractorStatusUpdateSchema, executeContractorStatusUpdate, readContractorWorkspace } from '@/lib/mills/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const actor = await sessionActor((await cookies()).get(cookieName)?.value);
  if (!actor) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return Response.json(await readContractorWorkspace(actor.id), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error && error.message === 'Contractor workspace access denied' ? error.message : 'Contractor workspace unavailable';
    return Response.json({ error: message }, { status: message === 'Contractor workspace access denied' ? 403 : 503 });
  }
}

export async function POST(req: Request) {
  const actor = await sessionActor((await cookies()).get(cookieName)?.value);
  if (!actor) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!validOrigin(req)) return Response.json({ error: 'Origin rejected' }, { status: 403 });
  try {
    const body = await req.json() as { status?: unknown };
    const input = contractorStatusUpdateSchema.pick({ status: true }).parse({ status: body.status });
    const workspace = await readContractorWorkspace(actor.id);
    return Response.json(await executeContractorStatusUpdate(actor.id, { action: 'updateTradeStatus', tradeId: workspace.viewer.tradeId, status: input.status }));
  } catch (error) {
    const message = error instanceof Error && error.message === 'Trade access denied' ? error.message : 'Invalid contractor workspace request';
    return Response.json({ error: message }, { status: message === 'Trade access denied' ? 403 : 400 });
  }
}
