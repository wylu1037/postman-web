import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'postman-web',
  description: 'AK/SK gateway request builder'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
