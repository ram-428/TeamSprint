/** Quick-capture parser: "Fix login bug @sara !high #auth ^5 bug" → structured fields (deterministic, no AI). */
export type Captured = { summary: string; priority?: string; labels: string[]; assigneeQuery?: string; points?: number; type?: string };

const PRIOS: Record<string, string> = { highest: 'Highest', urgent: 'Highest', high: 'High', medium: 'Medium', med: 'Medium', low: 'Low', lowest: 'Lowest' };
const TYPES = ['bug', 'story', 'task', 'epic'];

export function parseCapture(input: string): Captured {
  const out: Captured = { summary: '', labels: [] };
  const words: string[] = [];
  for (const w of input.split(/\s+/)) {
    if (/^![a-z]+$/i.test(w) && PRIOS[w.slice(1).toLowerCase()]) out.priority = PRIOS[w.slice(1).toLowerCase()];
    else if (/^#[\w-]+$/.test(w)) out.labels.push(w.slice(1));
    else if (/^@[\w.-]+$/.test(w)) out.assigneeQuery = w.slice(1);
    else if (/^\^\d+(\.\d+)?$/.test(w)) out.points = Number(w.slice(1));
    else if (/^\/[a-z]+$/i.test(w) && TYPES.includes(w.slice(1).toLowerCase())) out.type = w.slice(1).toLowerCase();
    else words.push(w);
  }
  out.summary = words.join(' ').trim();
  return out;
}
