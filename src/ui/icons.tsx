import type { ReactElement } from 'react';

const S = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
export const ICONS: Record<string, ReactElement> = {
  scan: <svg viewBox="0 0 24 24" {...S} strokeWidth="2"><path d="M4 8V5h3M20 8V5h-3M4 16v3h3M20 16v3h-3" /><path d="M8 9v6M11 9v6M14 9v6M17 9v6" /></svg>,
  log: <svg viewBox="0 0 24 24" {...S} strokeWidth="2"><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 9h6M9 13h6M9 17h3" /></svg>,
  effects: <svg viewBox="0 0 24 24" {...S} strokeWidth="2"><path d="M3 12h4l3-7 4 14 3-7h4" /></svg>,
  profile: <svg viewBox="0 0 24 24" {...S} strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></svg>,
  search: <svg viewBox="0 0 24 24" {...S} strokeWidth="2"><circle cx="11" cy="11" r="6" /><path d="M20 20l-4-4" /></svg>,
  camera: <svg viewBox="0 0 24 24" {...S} strokeWidth="2"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>,
  usual: <svg viewBox="0 0 24 24" {...S} strokeWidth="2"><path d="M4 12a8 8 0 1 0 3-6.2" /><path d="M4 4v4h4" /><path d="M12 8v4l3 2" /></svg>,
  leaf: <svg viewBox="0 0 24 24" {...S} strokeWidth="2"><path d="M5 13c0-5 4-8 9-8 2 0 4 .5 5 1-1 8-5 13-11 13-2 0-3-1-3-6z" /><path d="M5 19c3-4 6-7 10-9" /></svg>,
  avoid: <svg viewBox="0 0 24 24" {...S} strokeWidth="2.4"><circle cx="12" cy="12" r="9" /><path d="M6 18L18 6" /></svg>,
  caution: <svg viewBox="0 0 24 24" {...S} strokeWidth="2.4"><path d="M12 3l10 18H2z" /><path d="M12 10v5M12 18v.5" /></svg>,
  good: <svg viewBox="0 0 24 24" {...S} strokeWidth="2.4"><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></svg>,
  unknown: <svg viewBox="0 0 24 24" {...S} strokeWidth="2.4"><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17v.5" /></svg>,
  torch: <svg viewBox="0 0 24 24" {...S} strokeWidth="2"><path d="M8 3h8l-1 6H9z" /><path d="M9 9l1 12h4l1-12" /></svg>,
};
