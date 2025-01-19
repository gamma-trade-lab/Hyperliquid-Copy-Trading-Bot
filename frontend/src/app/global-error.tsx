'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-black text-white">
          <div className="text-center space-y-4">
            <h1 className="text-6xl font-bold">500</h1>
            <h2 className="text-2xl">Server Error</h2>
            <p className="text-gray-400">
              {error.message || 'Something went wrong on our end'}
            </p>
            <button
              onClick={reset}
              className="inline-block px-6 py-2 mt-4 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}