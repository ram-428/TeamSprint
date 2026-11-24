'use client';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { onToast, type Toast } from '@/lib/api';

const ICON = { success: CheckCircle2, error: AlertTriangle, info: Info };
const COLOR = { success: 'var(--success)', error: 'var(--danger)', info: 'var(--info)' };

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => onToast((t) => {
    setItems((s) => [...s.slice(-3), t]);
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== t.id)), t.action ? 8000 : 4500);
  }), []);
  return (
    <div className="fixed bottom-5 right-5 z-[100] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2" aria-live="polite" role="status">
      <AnimatePresence initial={false}>
        {items.map((t) => {
          const I = ICON[t.kind];
          return (
            <motion.div
              key={t.id} layout initial={{ opacity: 0, x: 60, scale: 0.95 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 60, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }} drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.5}
              onDragEnd={(_, i) => i.offset.x > 80 && setItems((s) => s.filter((x) => x.id !== t.id))}
              className="glass relative flex items-start gap-3 overflow-hidden rounded-2xl p-3.5 pr-9"
            >
              <I size={18} style={{ color: COLOR[t.kind] }} className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1 text-[13.5px]">
                <div>{t.message}</div>
                {t.action && <button className="mt-1 text-xs font-semibold text-accent2 hover:underline" onClick={() => { t.action!.run(); setItems((s) => s.filter((x) => x.id !== t.id)); }}>{t.action.label}</button>}
              </div>
              <button aria-label="Dismiss" className="absolute right-2 top-2 rounded-md p-1 text-faint hover:text-text" onClick={() => setItems((s) => s.filter((x) => x.id !== t.id))}><X size={14} /></button>
              <motion.span className="absolute bottom-0 left-0 h-[2px]" style={{ background: COLOR[t.kind] }} initial={{ width: '100%' }} animate={{ width: 0 }} transition={{ duration: t.action ? 8 : 4.5, ease: 'linear' }} />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
