/** Tiny, XSS-safe markdown renderer: everything is HTML-escaped first, then a safe subset is re-introduced. */
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function mdToHtml(src: string): string {
  const lines = esc(src || '').split('\n');
  const out: string[] = [];
  let inList = false;
  const inline = (t: string) =>
    t.replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[\s(])_([^_]+)_/g, '$1<em>$2</em>')
      .replace(/\b([A-Z][A-Z0-9]{1,9}-\d+)\b/g, '<a href="/issues/$1" style="color:var(--accent-2);font-weight:600">$1</a>')
      .replace(/(^|\s)@([A-Za-z][\w.]*(?: [A-Z][a-z]+)?)/g, '$1<span style="color:var(--accent-2);font-weight:600">@$2</span>');
  for (const l of lines) {
    const cb = /^\s*- \[( |x)\]\s+(.*)$/i.exec(l);
    const li = /^\s*[-*]\s+(.*)$/.exec(l);
    if (cb || li) {
      if (!inList) { out.push('<ul>'); inList = true; }
      if (cb) { const done = cb[1].toLowerCase() === 'x'; out.push(`<li style="display:flex;gap:8px;align-items:flex-start"><span style="margin-top:3px;width:14px;height:14px;flex:none;border-radius:4px;border:1.5px solid ${done ? 'var(--success)' : 'var(--border-strong)'};background:${done ? 'var(--success)' : 'transparent'}"></span><span style="${done ? 'text-decoration:line-through;opacity:.6' : ''}">${inline(cb[2])}</span></li>`); }
      else out.push(`<li style="display:flex;gap:8px"><span style="color:var(--accent)">•</span><span>${inline(li![1])}</span></li>`);
      continue;
    }
    if (inList) { out.push('</ul>'); inList = false; }
    if (!l.trim()) continue;
    const h = /^(#{1,3})\s+(.*)$/.exec(l);
    out.push(h ? `<p><strong>${inline(h[2])}</strong></p>` : `<p>${inline(l)}</p>`);
  }
  if (inList) out.push('</ul>');
  return out.join('');
}
