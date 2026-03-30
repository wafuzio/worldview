'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

type SessionResult = {
  id: string;
  economicScore: number | null;
  socialScore: number | null;
  completedAt: string | null;
  answers: {
    value: number;
    question: {
      text: string;
      leftLabel: string | null;
      rightLabel: string | null;
      category: { name: string };
      evidence: {
        relationship: string;
        note: string | null;
        evidence: { id: string; title: string; summary: string; sourceUrl: string | null };
      }[];
    };
  }[];
};

type PoliticalEntity = {
  id: string;
  name: string;
  economicScore: number | null;
  socialScore: number | null;
  description: string | null;
};

export default function ResultsPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const [result, setResult] = useState<SessionResult | null>(null);
  const [entities, setEntities] = useState<PoliticalEntity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/sessions/${sessionId}`).then((r) => r.json()),
      fetch('/api/entities').then((r) => r.json()),
    ]).then(([sessionData, entitiesData]) => {
      setResult(sessionData);
      setEntities(entitiesData);
      setLoading(false);
    });
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-slate-600">Loading results...</div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-slate-600">Session not found</div>
      </div>
    );
  }

  const economic = result.economicScore ?? 0;
  const social = result.socialScore ?? 0;
  const evidenceBackedAnswers = result.answers
    .filter((a) => a.question.evidence.length > 0)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 8);

  const relLabel = (rel: string) => {
    if (rel === 'supports_left') return 'Supports left side';
    if (rel === 'supports_right') return 'Supports right side';
    if (rel === 'contradicts') return 'Challenges framing';
    return 'Context';
  };

  // Find closest political entity
  const closest = entities.reduce(
    (best, entity) => {
      const dist = Math.sqrt(
        Math.pow((entity.economicScore ?? 0) - economic, 2) +
          Math.pow((entity.socialScore ?? 0) - social, 2)
      );
      return dist < best.dist ? { entity, dist } : best;
    },
    { entity: entities[0], dist: Infinity }
  );

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Your Results</h1>
          <p className="text-slate-600">Based on your responses to {result.answers.length} questions</p>
        </div>

        {/* Political compass visualization */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <h2 className="text-xl font-semibold mb-6">Your Political Position</h2>
          <div className="relative w-full max-w-md mx-auto aspect-square border-2 border-slate-300">
            {/* Quadrant labels */}
            <div className="absolute top-2 left-2 text-xs text-slate-500">Authoritarian Left</div>
            <div className="absolute top-2 right-2 text-xs text-slate-500 text-right">Authoritarian Right</div>
            <div className="absolute bottom-2 left-2 text-xs text-slate-500">Libertarian Left</div>
            <div className="absolute bottom-2 right-2 text-xs text-slate-500 text-right">Libertarian Right</div>

            {/* Axes */}
            <div className="absolute top-0 bottom-0 left-1/2 w-px bg-slate-300" />
            <div className="absolute left-0 right-0 top-1/2 h-px bg-slate-300" />

            {/* Your position */}
            <div
              className="absolute w-4 h-4 bg-blue-600 rounded-full transform -translate-x-1/2 -translate-y-1/2 z-10 ring-4 ring-blue-200"
              style={{
                left: `${50 + economic * 50}%`,
                top: `${50 - social * 50}%`,
              }}
              title="You"
            />

            {/* Political entities */}
            {entities.map((entity) => (
              <div
                key={entity.id}
                className="absolute w-3 h-3 bg-slate-400 rounded-full transform -translate-x-1/2 -translate-y-1/2 opacity-60"
                style={{
                  left: `${50 + (entity.economicScore ?? 0) * 50}%`,
                  top: `${50 - (entity.socialScore ?? 0) * 50}%`,
                }}
                title={entity.name}
              />
            ))}
          </div>

          <div className="mt-6 text-center">
            <p className="text-lg">
              You align most closely with: <strong className="text-blue-600">{closest.entity?.name}</strong>
            </p>
            {closest.entity?.description && (
              <p className="text-slate-600 mt-2">{closest.entity.description}</p>
            )}
          </div>
        </div>

        {/* Score breakdown */}
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="font-semibold mb-2">Economic Axis</h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-blue-600">Left</span>
              <div className="flex-1 h-3 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-red-500"
                  style={{ width: `${50 + economic * 50}%` }}
                />
              </div>
              <span className="text-sm text-red-600">Right</span>
            </div>
            <p className="text-sm text-slate-600 mt-2">
              Score: {(economic * 100).toFixed(0)}% toward {economic > 0 ? 'free market' : 'regulated economy'}
            </p>
          </div>

          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="font-semibold mb-2">Social Axis</h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-green-600">Liberty</span>
              <div className="flex-1 h-3 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-purple-500"
                  style={{ width: `${50 + social * 50}%` }}
                />
              </div>
              <span className="text-sm text-purple-600">Authority</span>
            </div>
            <p className="text-sm text-slate-600 mt-2">
              Score: {(Math.abs(social) * 100).toFixed(0)}% toward {social > 0 ? 'authority' : 'liberty'}
            </p>
          </div>
        </div>

        {/* Evidence for your positions */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <h2 className="text-xl font-semibold mb-2">Evidence Behind Your Strongest Positions</h2>
          <p className="text-sm text-slate-500 mb-6">
            Ranked by how strongly you answered each question and linked to source material attached to that question.
          </p>
          <div className="space-y-6">
            {evidenceBackedAnswers.length === 0 && (
              <div className="text-sm text-slate-500">No evidence has been linked to your answered questions yet.</div>
            )}
            {evidenceBackedAnswers.map((answer) => (
                <div key={answer.question.text} className="border-b pb-4 last:border-0">
                  <h3 className="font-medium text-slate-900">{answer.question.text}</h3>
                  <p className="text-sm text-slate-500 mb-2">
                    {answer.question.category.name} | Your position: {answer.value > 0 ? 'Right-leaning' : answer.value < 0 ? 'Left-leaning' : 'Depends/Neutral'}
                    {' '}({Math.abs(answer.value)} / 2 strength)
                  </p>
                  <div className="space-y-2">
                    {answer.question.evidence.map(({ evidence, relationship, note }) => (
                      <div key={evidence.id} className="bg-slate-50 p-3 rounded">
                        <span className="inline-block mb-1 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">
                          {relLabel(relationship)}
                        </span>
                        <p className="font-medium text-sm">{evidence.title}</p>
                        <p className="text-sm text-slate-600">{evidence.summary}</p>
                        {note && <p className="text-xs text-slate-500 mt-1">{note}</p>}
                        {evidence.sourceUrl && (
                          <a
                            href={evidence.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:underline"
                          >
                            View source →
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>

        <div className="flex justify-center gap-4">
          <Link
            href="/quiz"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            Retake Quiz
          </Link>
          <Link
            href="/"
            className="px-6 py-3 bg-slate-200 text-slate-800 rounded-lg font-medium hover:bg-slate-300"
          >
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
