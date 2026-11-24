'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Mail } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Field, Spinner } from '@/components/ui';
import { PasswordField, passwordRuleError } from '@/components/PasswordField';
import { ThemeSwitch } from '@/components/ThemeSwitch';
import { api, ApiError } from '@/lib/api';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState(''); const [challenge, setChallenge] = useState(''); const [sentTo, setSentTo] = useState('');
  const [code, setCode] = useState(''); const [pw, setPw] = useState(''); const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [fields, setFields] = useState<Record<string, string>>({});
  const [wait, setWait] = useState(0); const [info, setInfo] = useState('');

  useEffect(() => { if (wait <= 0) return; const t = setTimeout(() => setWait((w) => w - 1), 1000); return () => clearTimeout(t); }, [wait]);

  const fail = (x: unknown) => {
    if (x instanceof ApiError) {
      setErr(x.message); setFields(x.fields || {});
      if (['CHALLENGE_EXPIRED', 'TOO_MANY'].includes(x.code)) { setChallenge(''); setCode(''); setPw(''); setPw2(''); }
    } else setErr('Could not reach the server');
  };

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault(); setErr(''); setFields({}); setInfo('');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setFields({ email: 'Enter a valid email' }); return; }
    setBusy(true);
    try {
      const r = await api<{ challenge: string; email: string }>('/api/auth/forgot-password', { body: { email: email.trim() } });
      setChallenge(r.challenge); setSentTo(r.email); setCode(''); setWait(60);
      if (challenge) setInfo('A new code is on its way.');
    } catch (x) { fail(x); } finally { setBusy(false); }
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setInfo('');
    const f: Record<string, string> = {};
    if (!/^\d{6}$/.test(code)) f.code = 'Enter the 6-digit code';
    const rule = passwordRuleError(pw); if (rule) f.password = rule;
    else if (pw !== pw2) f.confirm = 'Passwords do not match';
    setFields(f); if (Object.keys(f).length) return;
    setBusy(true);
    try { await api('/api/auth/reset-password', { body: { challenge, code, password: pw } }); router.replace('/login?reset=1'); }
    catch (x) { fail(x); setBusy(false); }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center p-6">
      <ThemeSwitch className="absolute right-4 top-4 z-30" />
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="glass w-full max-w-[440px] rounded-[28px] p-8">
        <Logo />
        <h1 className="mt-6 text-[26px] font-semibold">{challenge ? 'Reset your password' : 'Forgot your password?'}</h1>
        <p className="mb-6 mt-1 text-muted">
          {challenge ? <>We sent a 6-digit code to <b>{sentTo}</b>. Enter it and choose a new password. Check your spam folder if it doesn’t arrive.</> : 'Enter your account email and we’ll send you a code to reset it.'}
        </p>

        {err && <div role="alert" className="mb-4 rounded-xl border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-[13.5px] text-danger">{err}</div>}
        {info && !err && <div role="status" className="mb-4 rounded-xl border border-accent/30 bg-accent/10 px-3.5 py-2.5 text-[13.5px]">{info}</div>}

        {!challenge ? (
          <form onSubmit={sendCode} className="space-y-4" noValidate>
            <Field label="Email" error={fields.email}>
              <div className="relative"><Mail size={16} className="absolute left-3.5 top-3 text-faint" />
                <input type="email" autoComplete="username" autoFocus placeholder="you@company.com" aria-label="Email" className={`input !pl-10 ${fields.email ? 'err' : ''}`} value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            </Field>
            <button className="btn btn-primary w-full !h-11" disabled={busy || !email.trim()}>{busy ? <Spinner /> : <>Send code <ArrowRight size={16} /></>}</button>
          </form>
        ) : (
          <form onSubmit={reset} className="space-y-4" noValidate>
            <Field label="Verification code" error={fields.code}>
              <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus aria-label="Verification code" className={`input text-center text-[22px] tracking-[0.4em] ${fields.code ? 'err' : ''}`} placeholder="••••••" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
            </Field>
            <PasswordField label="New password" value={pw} onChange={setPw} error={fields.password} autoComplete="new-password" meter />
            <PasswordField label="Confirm new password" value={pw2} onChange={setPw2} error={fields.confirm} autoComplete="new-password" />
            <button className="btn btn-primary w-full !h-11" disabled={busy}>{busy ? <Spinner /> : <>Reset password <ArrowRight size={16} /></>}</button>
            <div className="flex items-center justify-between text-[12.5px]">
              <button type="button" className="text-accent2 hover:underline disabled:text-faint disabled:no-underline" disabled={busy || wait > 0} onClick={() => sendCode()}>{wait > 0 ? `Resend code in ${wait}s` : 'Resend code'}</button>
              <button type="button" className="text-muted hover:underline" onClick={() => { setChallenge(''); setCode(''); setPw(''); setPw2(''); setErr(''); setFields({}); setInfo(''); }}>Use a different email</button>
            </div>
          </form>
        )}
        <p className="mt-5 text-center text-[13.5px] text-muted"><Link href="/login" className="inline-flex items-center gap-1.5 font-semibold text-accent2 hover:underline"><ArrowLeft size={14} /> Back to sign in</Link></p>
      </motion.div>
    </div>
  );
}
