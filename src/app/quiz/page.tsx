'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';

type Question = {
  id: string;
  text: string;
  description: string | null;
  questionType: string;
  leftLabel: string | null;
  rightLabel: string | null;
  yesValue: number;
  parentId: string | null;
  branchCondition: string | null;
  category: { name: string };
  followUps: Question[];
};

export default function QuizPage() {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionOrder, setQuestionOrder] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const parseJSONSafe = async (res: Response) => {
      const text = await res.text();
      if (!text) return null;
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    };

    const bootstrapQuiz = async () => {
      try {
    // Get or create session token
        let token = localStorage.getItem('quiz_session_token');
        if (!token) {
          token = uuidv4();
          localStorage.setItem('quiz_session_token', token);
        }

        const sessionRes = await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userToken: token }),
        });
        const sessionData = await parseJSONSafe(sessionRes);
        if (!sessionRes.ok || !sessionData?.id) {
          throw new Error(sessionData?.error || `Failed to start session (${sessionRes.status})`);
        }

        const questionsRes = await fetch('/api/questions');
        const questionsData = await parseJSONSafe(questionsRes);
        if (!questionsRes.ok || !Array.isArray(questionsData)) {
          throw new Error(
            questionsData?.error || `Failed to load questions (${questionsRes.status})`
          );
        }

        if (!mounted) return;
        setSessionId(sessionData.id);
        setQuestions(questionsData as Question[]);
        const roots = (questionsData as Question[]).filter((q) => !q.parentId);
        setQuestionOrder(roots.map((q) => q.id));
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || 'Failed to initialize quiz');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    bootstrapQuiz();

    return () => {
      mounted = false;
    };
  }, []);

  const getQuestionById = (id: string) => questions.find((q) => q.id === id) || null;

  const matchesBranchCondition = (condition: string | null, value: number): boolean => {
    if (!condition) return true;
    const normalized = condition.trim().toLowerCase();
    if (normalized === 'yes') return value > 0;
    if (normalized === 'no') return value < 0;

    const match = normalized.match(/^(>=|<=|>|<|=)?\s*(-?\d+)$/);
    if (!match) return false;
    const op = match[1] || '=';
    const threshold = Number(match[2]);

    switch (op) {
      case '>': return value > threshold;
      case '>=': return value >= threshold;
      case '<': return value < threshold;
      case '<=': return value <= threshold;
      case '=': return value === threshold;
      default: return false;
    }
  };

  const handleAnswer = async (value: number) => {
    const currentQuestionId = questionOrder[currentIndex];
    const currentQuestion = currentQuestionId ? getQuestionById(currentQuestionId) : null;
    if (!sessionId || !currentQuestion) return;

    const questionId = currentQuestion.id;
    setAnswers((prev) => ({ ...prev, [questionId]: value }));

    // Save answer
    await fetch('/api/answers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, questionId, value }),
    });

    const followUps = questions
      .filter((q) => q.parentId === questionId && matchesBranchCondition(q.branchCondition, value))
      .map((q) => q.id);

    const nextOrder = (() => {
      if (followUps.length === 0) return questionOrder;
      const before = questionOrder.slice(0, currentIndex + 1);
      const after = questionOrder.slice(currentIndex + 1).filter((id) => !followUps.includes(id));
      return [...before, ...followUps, ...after];
    })();

    if (nextOrder !== questionOrder) {
      setQuestionOrder(nextOrder);
    }

    if (currentIndex < nextOrder.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      // Complete quiz
      await fetch(`/api/sessions/${sessionId}/complete`, { method: 'POST' });
      router.push(`/results/${sessionId}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-slate-600">Loading quiz...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-lg w-full bg-white border border-red-200 rounded-xl p-6">
          <h1 className="text-lg font-semibold text-red-700">Could not load quiz</h1>
          <p className="text-sm text-slate-600 mt-2">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const question = getQuestionById(questionOrder[currentIndex] || '');
  const progress = questionOrder.length > 0 ? ((currentIndex + 1) / questionOrder.length) * 100 : 0;

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex justify-between text-sm text-slate-600 mb-2">
            <span>{question?.category?.name}</span>
            <span>{currentIndex + 1} of {questionOrder.length}</span>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Question card */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-semibold text-slate-900 mb-4">
            {question?.text}
          </h2>
          {question?.description && (
            <p className="text-slate-600 mb-6">{question.description}</p>
          )}

          {/* Answer options - varies by question type */}
          {question?.questionType === 'yesno' ? (
            /* Yes/No Question */
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => handleAnswer(question.yesValue)}
                className="flex-1 max-w-[200px] py-6 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-xl transition"
              >
                Yes
              </button>
              <button
                onClick={() => handleAnswer(-question.yesValue)}
                className="flex-1 max-w-[200px] py-6 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold text-xl transition"
              >
                No
              </button>
            </div>
          ) : (
            /* Scale Question (default) */
            <div className="space-y-6">
              <div className="flex justify-between text-sm">
                <span className="text-blue-600 font-medium max-w-[40%]">
                  {question?.leftLabel}
                </span>
                <span className="text-red-600 font-medium max-w-[40%] text-right">
                  {question?.rightLabel}
                </span>
              </div>

              <div className="flex gap-2">
                {[-2, -1, 0, 1, 2].map((value) => (
                  <button
                    key={value}
                    onClick={() => handleAnswer(value)}
                    className={`flex-1 py-4 rounded-lg font-medium transition ${
                      value === -2
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : value === -1
                        ? 'bg-blue-200 hover:bg-blue-300 text-blue-800'
                        : value === 0
                        ? 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                        : value === 1
                        ? 'bg-red-200 hover:bg-red-300 text-red-800'
                        : 'bg-red-600 hover:bg-red-700 text-white'
                    }`}
                  >
                    {value === -2 && 'Strongly'}
                    {value === -1 && 'Somewhat'}
                    {value === 0 && 'Neutral'}
                    {value === 1 && 'Somewhat'}
                    {value === 2 && 'Strongly'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between">
          <button
            onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
            disabled={currentIndex === 0}
            className="px-4 py-2 text-slate-600 hover:text-slate-900 disabled:opacity-50"
          >
            ← Previous
          </button>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 text-slate-600 hover:text-slate-900"
          >
            Save & Exit
          </button>
        </div>
      </div>
    </main>
  );
}
