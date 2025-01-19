import Link from 'next/link';

export default function NotFound() {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="text-center space-y-4">
          <h1 className="text-6xl font-bold">404</h1>
          <h2 className="text-2xl">Page Not Found</h2>
          <p className="text-gray-400">The page you&apos;re looking for doesn&apos;t exist.</p>
          <Link
            href="/"
            className="inline-block px-6 py-2 mt-4 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }