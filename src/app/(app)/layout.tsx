import { redirect } from 'next/navigation';
import { getUser } from '@/server/auth';
import { connectDB } from '@/server/db';
import { Org } from '@/server/models';
import { Shell } from '@/components/Shell';

export const dynamic = 'force-dynamic';

const orgNames = new Map<string, string>();
async function orgNameOf(id: string) {
  const hit = orgNames.get(id); if (hit) return hit;
  await connectDB();
  const org = await Org.findById(id).select('name').lean<any>();
  if (org?.name) orgNames.set(id, org.name);
  return org?.name as string | undefined;
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect('/login?expired=1');
  const orgName = user.orgId ? await orgNameOf(user.orgId) : undefined;
  return <Shell me={{ ...user, orgName }}>{children}</Shell>;
}
