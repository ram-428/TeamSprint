'use client';
import { PageHeader } from '@/components/ui';
import { useMe } from '@/components/UserContext';
import { Forbidden, SelectOrgFirst } from '@/components/AdminShared';
import { MastersTab } from '@/components/MastersTab';

export default function MastersPage() {
  const me = useMe();
  const isSuper = me.platformRole === 'super_admin';
  if (me.role !== 'org_admin' && !isSuper) return <Forbidden />;
  // Always the organization chosen in the top bar (a super admin switches it there).
  const orgId = isSuper ? me.orgId || '' : '';
  return (
    <div className="mx-auto max-w-[1180px]">
      <PageHeader title="Masters" subtitle={`Issue types and statuses used across ${me.orgName || 'your organization'}`} />
      {isSuper && !orgId ? <SelectOrgFirst /> : <MastersTab key={orgId} orgId={orgId} />}
    </div>
  );
}
