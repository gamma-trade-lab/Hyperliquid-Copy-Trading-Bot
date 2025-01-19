'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-bold">Error</h1>
        <h2 className="text-2xl">Something went wrong</h2>
        <p className="text-gray-400">
          {error.message || 'An unexpected error occurred'}
        </p>
        <button
          onClick={reset}
          className="inline-block px-6 py-2 mt-4 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}