import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cookieName, validSession } from '@/lib/auth';
import MillsHeadquarters from '@/components/mills-headquarters';

export const dynamic = 'force-dynamic';

export default async function HeadquartersPage() {
  const session = (await cookies()).get(cookieName)?.value;
  if (!(await validSession(session))) redirect('/login?next=/hq');
  return <MillsHeadquarters />;
}
