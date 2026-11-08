import { cookies } from 'next/headers';
import { sessionActor, cookieName, validOrigin } from '@/lib/auth';
import { executeCommand, millsCommandSchema, readWorkspace } from '@/lib/mills/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const operator = await sessionActor((await cookies()).get(cookieName)?.value);
  if (!operator) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return Response.json(await readWorkspace(operator.id), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error && error.message === 'Mills account access denied' ? error.message : 'Mills workspace unavailable';
    return Response.json({ error: message }, { status: message === 'Mills account access denied' ? 403 : 503 });
  }
}

export async function POST(req: Request) {
  const operator = await sessionActor((await cookies()).get(cookieName)?.value);
  if (!operator) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!validOrigin(req)) return Response.json({ error: 'Origin rejected' }, { status: 403 });
  try {
    const body = await req.json();
    const input = millsCommandSchema.parse(body);
    return Response.json(await executeCommand(input, operator.id));
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const accessDenied = message === 'Mills account access denied' || message === 'Mills operator access required';
    return Response.json({ error: accessDenied ? message : 'Mills request could not be completed' }, { status: accessDenied ? 403 : 400 });
  }
}
