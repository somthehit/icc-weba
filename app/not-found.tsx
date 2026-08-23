import React from 'react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
      <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Page Not Found</h2>
      <p className="text-sm text-gray-600 mb-6">Could not find requested resource</p>
      <Link
        href="/"
        className="px-5 py-2.5 bg-[#0056b3] text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm text-sm"
      >
        Return Home
      </Link>
    </div>
  );
}
