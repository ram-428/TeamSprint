/* eslint-disable @next/next/no-img-element */
/** Brand marks. `icon` = TS app icon (public/brand/icon.png). `full` = icon + "team Sprint" wordmark image on a light plate. */
export function Logo({ size = 32, text = true, variant = 'inline' }: { size?: number; text?: boolean; variant?: 'inline' | 'full' | 'sidebar' }) {
  if (variant === 'sidebar') {
    return (
      <span className="flex w-full items-center justify-center overflow-hidden rounded-2xl bg-white shadow-[0_8px_26px_-12px_rgba(124,92,255,.55)]">
        <img src="/brand/logo-full.png" alt="Team Sprint" style={{ width: '100%', height: 'auto', display: 'block', maxHeight: 84, objectFit: 'contain' }} />
      </span>
    );
  }
  if (variant === 'full') {
    return (
      <span className="inline-flex rounded-2xl bg-white px-4 py-2 shadow-[0_10px_40px_-12px_rgba(124,92,255,.6)]" style={{ height: size }}>
        <img src="/brand/logo-full.png" alt="Team Sprint" style={{ height: '100%', width: 'auto' }} />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2.5">
      <img src="/brand/icon.png" alt="" width={size} height={size} style={{ width: size, height: size }} className="shrink-0 rounded-[28%]" />
      {text && <span className="leading-[1.05]"><span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">team</span><span className="block text-[19px] font-bold tracking-tight">Sprint</span></span>}
    </span>
  );
}
