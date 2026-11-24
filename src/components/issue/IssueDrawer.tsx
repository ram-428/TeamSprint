'use client';
import { Drawer } from '../ui';
import { IssueView } from './IssueView';

export function IssueDrawer({ issueKey, onClose }: { issueKey: string | null; onClose: () => void }) {
  return <Drawer open={!!issueKey} onClose={onClose} width={980}>{issueKey && <IssueView key={issueKey} issueKey={issueKey} onClose={onClose} embedded />}</Drawer>;
}
