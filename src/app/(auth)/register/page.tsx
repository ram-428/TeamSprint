'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Field, Spinner } from '@/components/ui';
import { api, ApiError } from '@/lib/api';

function strength(pw: string) {
  let s = 0; if (pw.length >= 10) s++; if (/[A-Z]/.test(pw)) s++; if (/[0-9]/.test(pw)) s++; if (/[^A-Za-z0-9]/.test(pw)) s++; if (pw.length >= 14) s++;
  return s;
}

export default function RegisterPage() {
  const router = useRouter();
  const [f, setF] = useState({ name: '', email: '', orgName: '', password: '' });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [fields, setFields] = useState<Record<string, string>>({});
  const s = strength(f.password); const labels = ['Too weak', 'Weak', 'Okay', 'Good', 'Strong', 'Excellent'];
  const colors = ['#f87171', '#f87171', '#fbbf24', '#60a5fa', '#34d399', '#22d3ee'];
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(''); setFields({});
    try { await api('/api/auth/register', { body: f }); router.replace('/dashboard'); router.refresh(); }
    catch (x) { if (x instanceof ApiError) { setErr(x.message); setFields(x.fields || {}); } setBusy(false); }
  }
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="glass w-full max-w-[460px] rounded-[28px] p-8">
        <Logo />
        <h1 className="mt-6 text-[28px] font-semibold">Create your workspace</h1>
        <p className="mb-6 mt-1 text-muted">Start planning in under a minute. Free forever for small teams.</p>
        <form onSubmit={submit} className="space-y-4" noValidate>
          {err && <div role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-[13.5px] text-danger">{err}</div>}
          <Field label="Your name" error={fields.name}><input className={`input ${fields.name ? 'err' : ''}`} value={f.name} onChange={set('name')} autoFocus /></Field>
          <Field label="Work email" error={fields.email}><input type="email" className={`input ${fields.email ? 'err' : ''}`} value={f.email} onChange={set('email')} /></Field>
          <Field label="Workspace name" error={fields.orgName}><input className={`input ${fields.orgName ? 'err' : ''}`} placeholder="Acme Inc" value={f.orgName} onChange={set('orgName')} /></Field>
          <Field label="Password" error={fields.password}>
            <input type="password" autoComplete="new-password" className={`input ${fields.password ? 'err' : ''}`} value={f.password} onChange={set('password')} />
            <div className="mt-2 flex gap-1" aria-hidden>{[0, 1, 2, 3, 4].map((i) => <motion.span key={i} className="h-1 flex-1 rounded-full" animate={{ background: i < s ? colors[s] : 'var(--border)' }} />)}</div>
            <p className="mt-1 text-xs" style={{ color: f.password ? colors[s] : 'var(--text-faint)' }}>{f.password ? labels[s] : 'Min 10 characters, one capital letter and one number'}</p>
          </Field>
          <button className="btn btn-primary w-full !h-11" disabled={busy}>{busy ? <Spinner /> : <>Create workspace <ArrowRight size={16} /></>}</button>
        </form>
        <p className="mt-5 text-center text-[13.5px] text-muted">Already have an account? <Link href="/login" className="font-semibold text-accent2 hover:underline">Sign in</Link></p>
      </motion.div>
    </div>
  );
}
