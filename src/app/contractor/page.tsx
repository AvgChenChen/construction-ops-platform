import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cookieName, validSession } from '@/lib/auth';
import ContractorWorkspace from '@/components/contractor-workspace';

export const dynamic = 'force-dynamic';

export default async function ContractorPage() {
  const session = (await cookies()).get(cookieName)?.value;
  if (!(await validSession(session))) redirect('/login?next=/contractor');
  return <ContractorWorkspace />;
}
