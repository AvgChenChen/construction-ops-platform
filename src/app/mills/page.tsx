import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cookieName, validSession } from '@/lib/auth';
import MillsPilot from '@/components/mills-pilot';

export const dynamic = 'force-dynamic';

export default async function MillsPage() {
  const session = (await cookies()).get(cookieName)?.value;
  if (!(await validSession(session))) redirect('/login');
  return <MillsPilot />;
}
