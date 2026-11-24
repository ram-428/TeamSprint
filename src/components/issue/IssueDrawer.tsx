'use client';
import { Modal } from '../ui';
import { IssueView } from './IssueView';

export function IssueDrawer({ issueKey, onClose }: { issueKey: string | null; onClose: () => void }) {
  return (
    <Modal open={!!issueKey} onClose={onClose} width={880} padded={false} scroll centered>
      {issueKey && <IssueView key={issueKey} issueKey={issueKey} onClose={onClose} embedded />}
    </Modal>
  );
}
