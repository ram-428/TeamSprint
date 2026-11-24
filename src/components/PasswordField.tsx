'use client';
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Field } from '@/components/ui';

export function passwordStrength(pw: string) {
  let s = 0; if (pw.length >= 10) s++; if (/[A-Z]/.test(pw)) s++; if (/[0-9]/.test(pw)) s++; if (/[^A-Za-z0-9]/.test(pw)) s++; if (pw.length >= 14) s++;
  return s;
}
/** Client-side mirror of the server rule (10+ chars, a capital letter, a number). Returns an error message or ''. */
export function passwordRuleError(pw: string) {
  if (pw.length < 10) return 'Use at least 10 characters';
  if (!/[A-Z]/.test(pw)) return 'Add an uppercase letter';
  if (!/[0-9]/.test(pw)) return 'Add a number';
  return '';
}

const LABELS = ['Too weak', 'Weak', 'Okay', 'Good', 'Strong', 'Excellent'];
const COLORS = ['#f87171', '#f87171', '#fbbf24', '#60a5fa', '#34d399', '#22d3ee'];

export function PasswordField({ label, value, onChange, error, autoComplete, meter, hint, autoFocus }: {
  label: string; value: string; onChange: (v: string) => void; error?: string; autoComplete: string; meter?: boolean; hint?: string; autoFocus?: boolean;
}) {
  const [show, setShow] = useState(false); const [caps, setCaps] = useState(false);
  const s = passwordStrength(value);
  return (
    <Field label={label} error={error} hint={meter ? undefined : hint}>
      <div className="relative">
        <input type={show ? 'text' : 'password'} autoComplete={autoComplete} autoFocus={autoFocus} aria-label={label} className={`input !pr-11 ${error ? 'err' : ''}`} value={value}
          onChange={(e) => onChange(e.target.value)} onKeyUp={(e) => setCaps(e.getModifierState('CapsLock'))} />
        <button type="button" aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-3 top-2.5 text-faint transition-colors hover:text-text" onClick={() => setShow((v) => !v)}>
          {show ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
      {caps && <p className="mt-1 text-xs text-warning">Caps Lock is on</p>}
      {meter && (
        <>
          <div className="mt-2 flex gap-1" aria-hidden>{[0, 1, 2, 3, 4].map((i) => <span key={i} className="h-1 flex-1 rounded-full transition-colors" style={{ background: i < s ? COLORS[s] : 'var(--border)' }} />)}</div>
          {!error && <p className="mt-1 text-xs" style={{ color: value ? COLORS[s] : 'var(--text-faint)' }}>{value ? LABELS[s] : (hint || 'Min 10 characters, one capital letter and one number')}</p>}
        </>
      )}
    </Field>
  );
}
