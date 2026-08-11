import type { Metadata } from 'next';

import { DM_Sans, Geist_Mono } from 'next/font/google';

import './globals.css';

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: 'Finora',
    template: '%s · Finora',
  },
  description:
    'Finora is a conversational financial operating system for people and AI agents. Prepare, approve, and track financial actions in one place.',
  metadataBase: new URL('https://finora.app'),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en'>
      <body className={`${dmSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
