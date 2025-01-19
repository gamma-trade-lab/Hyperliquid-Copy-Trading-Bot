'use client';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export default function Navbar() {
  const { connected } = useWallet();

  return (
    <nav className="bg-white shadow-lg dark:bg-gray-800">
      <div className="container mx-auto px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Link href="/" className="text-xl font-bold text-gray-800 dark:text-white">
              JENNA AI
            </Link>
            
            <div className="ml-10 hidden space-x-8 lg:block">
              <Link href="/" className="text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white">
                Home
              </Link>
              <Link href="/portfolio" className="text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white">
                Portfolio
              </Link>
              <Link href="/trading" className="text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white">
                Trading
              </Link>
              <Link href="/analysis" className="text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white">
                Analysis
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {!connected && (
              <span className="text-sm text-gray-600 dark:text-gray-400">
                No wallet connected
              </span>
            )}
            <WalletMultiButton className="px-4 py-2 rounded-lg font-medium bg-purple-500 hover:bg-purple-600" />
          </div>
        </div>
      </div>
    </nav>
  );
}