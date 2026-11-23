'use client';
import { useEffect, useState } from 'react';
import { Contrast, Moon, Sun } from 'lucide-react';
import clsx from 'clsx';

type Theme = 'dark' | 'light' | 'simple';
const OPTIONS = [['light', 'Light', Sun], ['dark', 'Dark', Moon], ['simple', 'Simple', Contrast]] as const;

/** Three-way theme picker (light is the default). Persists to localStorage like the in-app switcher. */
export function ThemeSwitch({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>('simple');
  useEffect(() => { try { setTheme(((localStorage.getItem('orbit-theme') as Theme) || 'simple')); } catch { /* ignore */ } }, []);
  const pick = (t: Theme) => { setTheme(t); document.documentElement.setAttribute('data-theme', t); try { localStorage.setItem('orbit-theme', t); } catch { /* ignore */ } };
  return (
    <div role="radiogroup" aria-label="Theme" className={clsx('inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface)] p-0.5', className)}>
      {OPTIONS.map(([t, label, I]) => (
        <button key={t} type="button" role="radio" aria-checked={theme === t} aria-label={`${label} theme`} title={`${label} theme`} onClick={() => pick(t)}
          className={clsx('flex h-8 w-8 items-center justify-center rounded-[10px] transition-colors', theme === t ? 'bg-[var(--accent)] text-white' : 'text-muted hover:text-text')}><I size={16} /></button>
      ))}
    </div>
  );
}
