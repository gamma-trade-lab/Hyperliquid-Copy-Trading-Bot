// src/app/layout.tsx
import { Inter } from 'next/font/google';
import './globals.css';
import ClientLayout from '../components/ClientLayout';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'JENNA AI Trading Assistant',
  description: 'AI-powered Solana trading assistant and market analyzer',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}