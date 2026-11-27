import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/Toaster';
import { TopLoader } from '@/components/TopLoader';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = { title: { default: 'Team Sprint — work, in motion', template: '%s · Team Sprint' }, description: 'Team Sprint is a modern issue-tracking and sprint-planning platform for fast-moving teams.' };
export const viewport: Viewport = { themeColor: '#f7f7f8', width: 'device-width', initialScale: 1 };

const themeInit = `try{var t=localStorage.getItem('orbit-theme')||'simple';document.documentElement.setAttribute('data-theme',t)}catch(e){document.documentElement.setAttribute('data-theme','simple')}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="simple" className={`${inter.variable} ${mono.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeInit }} /></head>
      {/* Browser extensions (Gemini, Grammarly, ColorZilla…) add attributes to <body> before React loads; ignore those attribute-only mismatches. */}
      <body suppressHydrationWarning>
        <TopLoader />
        <div className="aurora" aria-hidden><i /><i /><i /></div>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
