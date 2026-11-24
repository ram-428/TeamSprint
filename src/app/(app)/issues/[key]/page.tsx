'use client';
import { use } from 'react';
import { IssueView } from '@/components/issue/IssueView';

export default function IssuePage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = use(params);
  return <div className="glass mx-auto max-w-[1180px] rounded-[28px]"><IssueView issueKey={key.toUpperCase()} /></div>;
}
