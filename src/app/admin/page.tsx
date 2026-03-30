'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type Category = { id: string; name: string; description: string | null };
type Tag = { id: string; name: string; color: string; synonyms?: { id: string; synonym: string }[] };
type Question = { id: string; text: string; category: Category; categoryId: string; leftLabel: string; rightLabel: string; isActive: boolean };
type Evidence = { id: string; title: string; summary: string; tags: { tag: Tag }[] };
type SuggestedQuestion = {
  text: string;
  description?: string;
  leftLabel: string;
  rightLabel: string;
  categoryId: string;
  categoryName?: string;
  rationale?: string;
  importanceScore?: number;
  supportingEvidence?: {
    evidenceId: string;
    title: string;
    relevance?: string;
  }[];
  followUps?: {
    branchCondition: '<0' | '=0' | '>0';
    text: string;
    description?: string;
    leftLabel: string;
    rightLabel: string;
  }[];
};

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'questions' | 'evidence' | 'tags'>('questions');
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/categories').then((r) => r.json()),
      fetch('/api/tags?includeSynonyms=true').then((r) => r.json()),
      fetch('/api/questions').then((r) => r.json()),
      fetch('/api/evidence').then((r) => r.json()),
    ]).then(([cats, tgs, qs, ev]) => {
      setCategories(cats);
      setTags(tgs);
      setQuestions(qs);
      setEvidence(ev);
    });
  }, []);

  const deleteQuestion = async (id: string) => {
    if (!confirm('Delete this question?')) return;
    await fetch(`/api/questions/${id}`, { method: 'DELETE' });
    setQuestions(questions.filter(q => q.id !== id));
  };

  const deleteTag = async (id: string) => {
    if (!confirm('Delete this tag?')) return;
    await fetch(`/api/tags/${id}`, { method: 'DELETE' });
    setTags(tags.filter(t => t.id !== id));
  };

  const refreshTags = async () => {
    const res = await fetch('/api/tags?includeSynonyms=true');
    setTags(await res.json());
  };

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Admin Panel</h1>
          <div className="flex gap-4 items-center">
            <Link href="/admin/agent" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">Research Agent</Link>
            <Link href="/admin/actors" className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium">Actor Images</Link>
            <Link href="/admin/ingest" className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 text-sm font-medium">Ingest Evidence</Link>
            <Link href="/" className="text-blue-600 hover:underline text-sm">&larr; Back to Quiz</Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {(['questions', 'evidence', 'tags'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-medium capitalize ${
                activeTab === tab ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Questions Tab */}
        {activeTab === 'questions' && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">{editingQuestion ? 'Edit Question' : 'Add Question'}</h2>
              <QuestionForm 
                categories={categories} 
                editingQuestion={editingQuestion}
                onSave={(q) => {
                  if (editingQuestion) {
                    setQuestions(questions.map(existing => existing.id === q.id ? q : existing));
                  } else {
                    setQuestions([...questions, q]);
                  }
                  setEditingQuestion(null);
                }}
                onCancel={() => setEditingQuestion(null)}
              />
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Questions ({questions.length})</h2>
              <div className="space-y-2">
                {questions.map((q) => (
                  <div key={q.id} className="p-3 bg-slate-50 rounded flex justify-between items-center group">
                    <div className="flex-1">
                      <p className="font-medium">{q.text}</p>
                      <p className="text-sm text-slate-500">{q.category?.name}</p>
                      <p className="text-xs text-slate-400">{q.leftLabel} ← → {q.rightLabel}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs ${q.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {q.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <button
                        onClick={() => setEditingQuestion(q)}
                        className="opacity-0 group-hover:opacity-100 px-2 py-1 text-blue-600 hover:bg-blue-50 rounded text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteQuestion(q.id)}
                        className="opacity-0 group-hover:opacity-100 px-2 py-1 text-red-600 hover:bg-red-50 rounded text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Evidence Tab */}
        {activeTab === 'evidence' && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Add Evidence</h2>
              <EvidenceForm categories={categories} tags={tags} onSave={(e) => setEvidence([...evidence, e])} />
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Evidence ({evidence.length})</h2>
              <div className="space-y-2">
                {evidence.map((e) => (
                  <div key={e.id} className="p-3 bg-slate-50 rounded">
                    <p className="font-medium">{e.title}</p>
                    <p className="text-sm text-slate-600">{e.summary}</p>
                    <div className="flex gap-1 mt-2">
                      {e.tags?.map(({ tag }) => (
                        <span key={tag.id} className="px-2 py-0.5 rounded text-xs text-white" style={{ backgroundColor: tag.color }}>
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tags Tab */}
        {activeTab === 'tags' && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">{editingTag ? 'Edit Tag' : 'Add Tag'}</h2>
              <TagForm 
                editingTag={editingTag}
                allTags={tags}
                onSave={(t) => {
                  if (editingTag) {
                    setTags(tags.map(existing => existing.id === t.id ? t : existing));
                  } else {
                    setTags([...tags, t]);
                  }
                  setEditingTag(null);
                  refreshTags();
                }}
                onCancel={() => setEditingTag(null)}
              />
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Tags ({tags.length})</h2>
              <div className="space-y-2">
                {tags.map((t) => (
                  <div key={t.id} className="flex items-center justify-between p-2 bg-slate-50 rounded group">
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 rounded text-white" style={{ backgroundColor: t.color }}>
                        {t.name}
                      </span>
                      {t.synonyms && t.synonyms.length > 0 && (
                        <span className="text-sm text-slate-500">
                          → {t.synonyms.map(s => s.synonym).join(', ')}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingTag(t)}
                        className="opacity-0 group-hover:opacity-100 px-2 py-1 text-blue-600 hover:bg-blue-50 rounded text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteTag(t.id)}
                        className="opacity-0 group-hover:opacity-100 px-2 py-1 text-red-600 hover:bg-red-50 rounded text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function QuestionForm({ categories, editingQuestion, onSave, onCancel }: { 
  categories: Category[]; 
  editingQuestion: Question | null;
  onSave: (q: Question) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [leftLabel, setLeftLabel] = useState('');
  const [rightLabel, setRightLabel] = useState('');
  const [isActive, setIsActive] = useState(true);
const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestionError, setSuggestionError] = useState('');
  const [suggestionInfo, setSuggestionInfo] = useState('');
  const [suggestions, setSuggestions] = useState<SuggestedQuestion[]>([]);
  const [creatingSetIndex, setCreatingSetIndex] = useState<number | null>(null);

  const branchConditionLabel = (condition: '<0' | '=0' | '>0', suggestion: SuggestedQuestion) => {
    if (condition === '<0') return `If answer leans: ${suggestion.leftLabel || 'left side'}`;
    if (condition === '>0') return `If answer leans: ${suggestion.rightLabel || 'right side'}`;
    return `If answer is: Depends / middle`;
  };

  useEffect(() => {
    if (editingQuestion) {
      setText(editingQuestion.text);
      setCategoryId(editingQuestion.categoryId || editingQuestion.category?.id || '');
      setLeftLabel(editingQuestion.leftLabel || '');
      setRightLabel(editingQuestion.rightLabel || '');
      setIsActive(editingQuestion.isActive);
    } else {
      setText('');
      setCategoryId('');
      setLeftLabel('');
      setRightLabel('');
      setIsActive(true);
    }
  }, [editingQuestion]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingQuestion ? `/api/questions/${editingQuestion.id}` : '/api/questions';
    const method = editingQuestion ? 'PUT' : 'POST';
    
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, categoryId, leftLabel, rightLabel, isActive }),
    });
    const question = await res.json();
    onSave(question);
    setText('');
    setLeftLabel('');
    setRightLabel('');
    setCategoryId('');
    setIsActive(true);
  };

  const handleSuggest = async () => {
    setIsSuggesting(true);
    setSuggestionError('');
    setSuggestionInfo('');
    try {
      const res = await fetch('/api/questions/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId: categoryId || null, count: 5 }),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || 'Failed to generate suggestions');
      }
      setSuggestions(Array.isArray(payload?.suggestions) ? payload.suggestions : []);
    } catch (error: any) {
      setSuggestionError(error?.message || 'Failed to generate suggestions');
      setSuggestions([]);
    } finally {
      setIsSuggesting(false);
    }
  };

  const applySuggestion = (suggestion: SuggestedQuestion) => {
    setText(suggestion.text);
    setLeftLabel(suggestion.leftLabel);
    setRightLabel(suggestion.rightLabel);
    if (suggestion.categoryId) {
      setCategoryId(suggestion.categoryId);
    }
  };

  const createBranchingSet = async (suggestion: SuggestedQuestion, idx: number) => {
    if (!suggestion.categoryId) return;
    setCreatingSetIndex(idx);
    setSuggestionError('');
    setSuggestionInfo('');
    try {
      const parentRes = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: suggestion.text,
            description: suggestion.description || null,
            categoryId: suggestion.categoryId,
            leftLabel: suggestion.leftLabel,
            rightLabel: suggestion.rightLabel,
            questionType: 'scale',
            isActive: true,
            evidenceLinks: (suggestion.supportingEvidence || []).map((ev) => ({
              evidenceId: ev.evidenceId,
              relationship: 'neutral',
              note: ev.relevance || null,
            })),
          }),
        });
      const parent = await parentRes.json();
      if (!parentRes.ok) {
        throw new Error(parent?.error || 'Failed to create parent question');
      }
      onSave(parent);

      let followUpCreated = 0;
      const followUps = Array.isArray(suggestion.followUps) ? suggestion.followUps : [];
      for (const f of followUps) {
        const childRes = await fetch('/api/questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: f.text,
            description: f.description || null,
            categoryId: suggestion.categoryId,
            leftLabel: f.leftLabel,
            rightLabel: f.rightLabel,
            questionType: 'scale',
            parentId: parent.id,
            branchCondition: f.branchCondition,
            isActive: true,
            evidenceLinks: (suggestion.supportingEvidence || []).slice(0, 2).map((ev) => ({
              evidenceId: ev.evidenceId,
              relationship: 'neutral',
              note: `Branch context: ${ev.relevance || 'Relevant background evidence'}`,
            })),
          }),
        });
        const child = await childRes.json();
        if (!childRes.ok) {
          throw new Error(child?.error || 'Failed to create follow-up question');
        }
        onSave(child);
        followUpCreated += 1;
      }

      setSuggestionInfo(`Created 1 primary + ${followUpCreated} follow-up questions.`);
    } catch (error: any) {
      setSuggestionError(error?.message || 'Failed to create branching set');
    } finally {
      setCreatingSetIndex(null);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-indigo-900">LLM Suggestion Assistant</p>
            <p className="text-xs text-indigo-800">
              Suggests up to 5 nonpartisan moral-compass question sets (main question + branch follow-ups) anchored in your evidence.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSuggest}
            disabled={isSuggesting}
            className="px-3 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-60"
          >
            {isSuggesting ? 'Generating...' : 'Suggest Questions'}
          </button>
        </div>

        {suggestionError && (
          <p className="mt-3 text-sm text-red-700">{suggestionError}</p>
        )}
        {suggestionInfo && (
          <p className="mt-3 text-sm text-emerald-700">{suggestionInfo}</p>
        )}

        {suggestions.length > 0 && (
          <div className="mt-4 space-y-3">
            {suggestions.map((s, idx) => (
              <div key={`${s.text}-${idx}`} className="rounded border border-indigo-100 bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-medium text-slate-900">{s.text}</p>
                    {s.rationale && <p className="text-xs text-slate-600">{s.rationale}</p>}
                    <p className="text-xs text-slate-500">
                      {s.categoryName || 'Category not set'} | {s.leftLabel} <span className="text-slate-400">vs</span> {s.rightLabel}
                      {typeof s.importanceScore === 'number' ? ` | importance ${s.importanceScore}/100` : ''}
                    </p>
                  </div>
                  <div className="shrink-0 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => applySuggestion(s)}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                    >
                      Use Main
                    </button>
                    <button
                      type="button"
                      onClick={() => createBranchingSet(s, idx)}
                      disabled={creatingSetIndex === idx}
                      className="px-3 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm disabled:opacity-60"
                    >
                      {creatingSetIndex === idx ? 'Creating...' : 'Create Branching Set'}
                    </button>
                  </div>
                </div>
                {s.followUps && s.followUps.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-slate-600">Branch follow-ups</p>
                    <ul className="mt-1 space-y-1">
                      {s.followUps.map((f, fIdx) => (
                        <li key={`${s.text}-${f.branchCondition}-${fIdx}`} className="text-xs text-slate-700">
                          <span className="inline-block mr-1.5 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{branchConditionLabel(f.branchCondition, s)}</span>
                          <span className="font-medium">{f.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {s.supportingEvidence && s.supportingEvidence.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-slate-600">Evidence links</p>
                    <ul className="mt-1 space-y-1">
                      {s.supportingEvidence.map((ev) => (
                        <li key={`${s.text}-${ev.evidenceId}`} className="text-xs text-slate-600">
                          <span className="font-medium">{ev.title}</span>
                          {ev.relevance ? ` - ${ev.relevance}` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Question Text</label>
        <textarea value={text} onChange={(e) => setText(e.target.value)} className="w-full p-2 border rounded" rows={2} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Category</label>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full p-2 border rounded" required>
            <option value="">Select...</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Status</label>
          <select value={isActive ? 'active' : 'inactive'} onChange={(e) => setIsActive(e.target.value === 'active')} className="w-full p-2 border rounded">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Left Label (e.g., "Government provides")</label>
          <input value={leftLabel} onChange={(e) => setLeftLabel(e.target.value)} className="w-full p-2 border rounded" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Right Label (e.g., "Individual choice")</label>
          <input value={rightLabel} onChange={(e) => setRightLabel(e.target.value)} className="w-full p-2 border rounded" required />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          {editingQuestion ? 'Save Changes' : 'Add Question'}
        </button>
        {editingQuestion && (
          <button type="button" onClick={onCancel} className="px-4 py-2 bg-slate-200 rounded hover:bg-slate-300">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function EvidenceForm({ categories, tags, onSave }: { categories: Category[]; tags: Tag[]; onSave: (e: Evidence) => void }) {
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/evidence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, summary, sourceUrl, sourceName, categoryId: categoryId || null, tagIds: selectedTags }),
    });
    const evidence = await res.json();
    onSave(evidence);
    setTitle('');
    setSummary('');
    setSourceUrl('');
    setSourceName('');
    setSelectedTags([]);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full p-2 border rounded" required />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Summary</label>
        <textarea value={summary} onChange={(e) => setSummary(e.target.value)} className="w-full p-2 border rounded" rows={3} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Source URL</label>
          <input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} className="w-full p-2 border rounded" type="url" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Source Name</label>
          <input value={sourceName} onChange={(e) => setSourceName(e.target.value)} className="w-full p-2 border rounded" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Category</label>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full p-2 border rounded">
          <option value="">None</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Tags</label>
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <label key={t.id} className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedTags.includes(t.id)}
                onChange={(e) => setSelectedTags(e.target.checked ? [...selectedTags, t.id] : selectedTags.filter((id) => id !== t.id))}
              />
              <span className="px-2 py-0.5 rounded text-white text-sm" style={{ backgroundColor: t.color }}>{t.name}</span>
            </label>
          ))}
        </div>
      </div>
      <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Add Evidence</button>
    </form>
  );
}

function TagForm({ editingTag, allTags, onSave, onCancel }: { 
  editingTag: Tag | null;
  allTags: Tag[];
  onSave: (t: Tag) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [synonyms, setSynonyms] = useState('');
  const [linkedTags, setLinkedTags] = useState<string[]>([]);

  useEffect(() => {
    if (editingTag) {
      setName(editingTag.name);
      setColor(editingTag.color);
      setSynonyms(editingTag.synonyms?.map(s => s.synonym).join(', ') || '');
      setLinkedTags([]);
    } else {
      setName('');
      setColor('#6366f1');
      setSynonyms('');
      setLinkedTags([]);
    }
  }, [editingTag]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingTag ? `/api/tags/${editingTag.id}` : '/api/tags';
    const method = editingTag ? 'PUT' : 'POST';
    
    // Parse synonyms from comma-separated string
    const synonymList = synonyms.split(',').map(s => s.trim()).filter(s => s);
    
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color, synonyms: synonymList, linkedTags }),
    });
    const tag = await res.json();
    onSave(tag);
    setName('');
    setSynonyms('');
    setLinkedTags([]);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex gap-4 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium mb-1">Tag Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full p-2 border rounded" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Color</label>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-12 h-10 border rounded cursor-pointer" />
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-1">
          Synonyms <span className="text-slate-400 font-normal">(comma-separated words that should trigger this tag)</span>
        </label>
        <input 
          value={synonyms} 
          onChange={(e) => setSynonyms(e.target.value)} 
          className="w-full p-2 border rounded" 
          placeholder="e.g., human rights, civil liberties, freedoms"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Linked Tags <span className="text-slate-400 font-normal">(selecting this tag also suggests these)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {allTags.filter(t => t.id !== editingTag?.id).map((t) => (
            <label key={t.id} className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={linkedTags.includes(t.id)}
                onChange={(e) => setLinkedTags(e.target.checked ? [...linkedTags, t.id] : linkedTags.filter(id => id !== t.id))}
              />
              <span className="px-2 py-0.5 rounded text-white text-sm" style={{ backgroundColor: t.color }}>{t.name}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          {editingTag ? 'Save Changes' : 'Add Tag'}
        </button>
        {editingTag && (
          <button type="button" onClick={onCancel} className="px-4 py-2 bg-slate-200 rounded hover:bg-slate-300">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
