'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { BellOff, CheckCheck } from 'lucide-react';
import clsx from 'clsx';
import { api, errMsg, toast, useApi } from '@/lib/api';
import { Avatar, Card, EmptyState, ListSkeleton, PageHeader, Tabs, relTime } from '@/components/ui';

const TYPE_LABEL: Record<string, string> = { assigned: 'Assigned', mention: 'Mention', comment: 'Comment', status: 'Status', sprint: 'Sprint', member: 'Project', automation: 'Automation' };

export default function Inbox() {
  const router = useRouter(); const [tab, setTab] = useState<'all' | 'unread' | 'mention'>('all');
  const { data, mutate, reload, loading } = useApi<{ unread: number; items: any[] }>('/api/notifications?limit=100');
  const items = (data?.items || []).filter((n) => (tab === 'unread' ? !n.readAt : tab === 'mention' ? n.type === 'mention' : true));
  async function open(n: any) { if (!n.readAt) { mutate(data && { ...data, unread: data.unread - 1, items: data.items.map((x) => (x._id === n._id ? { ...x, readAt: new Date().toISOString() } : x)) }); api('/api/notifications', { body: { id: n._id } }).catch(() => reload()); } if (n.issueKey) router.push(`/issues/${n.issueKey}`); }
  async function readAll() { try { await api('/api/notifications', { body: { all: true } }); reload(); toast.success('All caught up'); } catch (e) { toast.error(errMsg(e)); } }
  return (
    <div className="mx-auto max-w-[820px]">
      <PageHeader title="Inbox" subtitle={data ? `${data.unread} unread` : '…'} actions={<button className="btn" onClick={readAll} disabled={!data?.unread}><CheckCheck size={15} /> Mark all read</button>} />
      <div className="mb-4"><Tabs id="inbox" value={tab} onChange={setTab} tabs={[{ id: 'all', label: 'All' }, { id: 'unread', label: 'Unread', count: data?.unread }, { id: 'mention', label: 'Mentions' }]} /></div>
      <Card className="overflow-hidden">
        {loading ? <div className="p-4"><ListSkeleton /></div> : items.length === 0 ? <EmptyState title="Nothing here" text={tab === 'all' ? "You'll see assignments, mentions and updates here." : 'No notifications in this view.'} icon={<BellOff size={28} />} /> : (
          <AnimatePresence initial={false}>{items.map((n, i) => (
            <motion.button key={n._id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.025 }} onClick={() => open(n)} className={clsx('flex w-full items-start gap-3.5 border-b border-[var(--border)] px-5 py-4 text-left transition-colors last:border-0 hover:bg-[var(--surface-2)]', !n.readAt && 'bg-[var(--accent-soft)]/50')}>
              <Avatar user={n.actor} size={36} /><div className="min-w-0 flex-1"><div className={clsx('text-[14px] leading-snug', !n.readAt && 'font-semibold')}>{n.message}</div><div className="mt-1 flex items-center gap-2 text-xs text-faint"><span className="chip !h-5 !text-[10px]">{TYPE_LABEL[n.type] || n.type}</span>{n.issueKey && <span className="key">{n.issueKey}</span>}<span>{relTime(n.createdAt)}</span></div></div>
              {!n.readAt && <span className="mt-2 h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_10px_var(--accent)]" aria-label="Unread" />}
            </motion.button>))}</AnimatePresence>)}
      </Card>
    </div>
  );
}
