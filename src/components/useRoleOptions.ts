'use client';
import { useApi } from '@/lib/api';
import { DEFAULT_ROLES } from '@/lib/permissions';

/** The organization's project roles (built-in + custom) as Select options; built-ins until the list loads. */
export function useRoleOptions() {
  const { data } = useApi<{ roles?: { key: string; name: string }[] }>('/api/masters');
  return (data?.roles?.length ? data.roles : DEFAULT_ROLES).map((r) => ({ value: r.key, label: r.name }));
}
