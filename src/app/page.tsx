'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Home() {
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('quiz_session_token');
    setSessionToken(token);
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            Worldview Quiz
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Discover your political worldview through your core beliefs — 
            without spin, labels, or leading questions.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-semibold mb-4">How it works</h2>
          <ol className="space-y-3 text-slate-700">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-semibold">1</span>
              <span>Answer questions about your beliefs on various topics — no political framing</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-semibold">2</span>
              <span>See where your views place you on the political spectrum</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-semibold">3</span>
              <span>Explore evidence and facts related to your positions</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-semibold">4</span>
              <span>Save your session to track how your views evolve over time</span>
            </li>
          </ol>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/quiz"
            className="px-8 py-4 bg-blue-600 text-white rounded-lg font-semibold text-lg hover:bg-blue-700 transition text-center"
          >
            Start Quiz
          </Link>
          {sessionToken && (
            <Link
              href="/results"
              className="px-8 py-4 bg-slate-200 text-slate-800 rounded-lg font-semibold text-lg hover:bg-slate-300 transition text-center"
            >
              View Past Results
            </Link>
          )}
        </div>

        <div className="mt-8 flex flex-col items-center gap-3">
          <Link
            href="/map"
            className="px-6 py-3 bg-slate-800 text-slate-100 rounded-lg font-medium hover:bg-slate-700 transition text-center"
          >
            Corruption Map →
          </Link>
          <div className="flex gap-4 mt-2">
            <Link href="/timeline" className="text-slate-500 hover:text-slate-700 text-sm">
              Timeline
            </Link>
            <Link href="/admin" className="text-slate-500 hover:text-slate-700 text-sm">
              Admin Panel
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
