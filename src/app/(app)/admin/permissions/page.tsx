'use client';
import { PageHeader } from '@/components/ui';
import { useMe } from '@/components/UserContext';
import { Forbidden, SelectOrgFirst } from '@/components/AdminShared';
import { PermissionsAdmin } from '@/components/PermissionsAdmin';

export default function PermissionsPage() {
  const me = useMe();
  const isSuper = me.platformRole === 'super_admin';
  if (me.role !== 'org_admin' && !isSuper) return <Forbidden />;
  // Always the organization chosen in the top bar (a super admin switches it there).
  const orgId = isSuper ? me.orgId || '' : '';
  return (
    <div className="mx-auto max-w-[1280px]">
      <PageHeader title="Permissions" subtitle={`Project roles and permission schemes for ${me.orgName || 'your organization'}`} />
      {isSuper && !orgId ? <SelectOrgFirst /> : <PermissionsAdmin key={orgId} orgId={orgId} />}
    </div>
  );
}
