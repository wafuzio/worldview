'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Actor = {
  id: string;
  name: string;
  type: string;
  title: string | null;
  affiliation: string | null;
  imageUrl: string | null;
};

const OUTPUT_SIZE = 512;

export default function AdminActorsPage() {
  const [actors, setActors] = useState<Actor[]>([]);
  const [query, setQuery] = useState('');
  const [missingOnly, setMissingOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [pendingSuggestionUrl, setPendingSuggestionUrl] = useState<string | null>(null);
  const [pendingSuggestionSource, setPendingSuggestionSource] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/politicians')
      .then((r) => r.json())
      .then((data) => setActors(Array.isArray(data) ? data : []));
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const byText = !q ? actors : actors.filter((a) =>
      `${a.name} ${a.type} ${a.title || ''} ${a.affiliation || ''}`.toLowerCase().includes(q)
    );
    if (!missingOnly) return byText;
    return byText.filter((a) => !a.imageUrl);
  }, [actors, query, missingOnly]);

  const selected = actors.find((a) => a.id === selectedId) || null;

  useEffect(() => {
    if (!selected) return;
    setImageUrlInput(selected.imageUrl || '');
    setSourceImage(toDisplayUrl(selected.imageUrl));
    setPendingSuggestionUrl(null);
    setPendingSuggestionSource(null);
    setScale(1);
    setOffsetX(0);
    setOffsetY(0);
    setStatus(null);
  }, [selectedId, selected?.imageUrl]);

  const updateActorImageInState = (id: string, imageUrl: string | null) => {
    setActors((prev) => prev.map((a) => (a.id === id ? { ...a, imageUrl } : a)));
  };

  const onFileChosen = async (file: File) => {
    const dataUrl = await fileToDataUrl(file);
    setSourceImage(dataUrl);
    setStatus('Image loaded. Adjust crop/zoom, then save.');
  };

  const saveFromUrl = async () => {
    if (!selected || !imageUrlInput.trim()) return;
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/politicians/${selected.id}/image`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: imageUrlInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save image URL');
      updateActorImageInState(selected.id, data.imageUrl || null);
      setSourceImage(toDisplayUrl(data.imageUrl || null));
      setPendingSuggestionUrl(null);
      setPendingSuggestionSource(null);
      setStatus('Image URL saved.');
    } catch (e: any) {
      setStatus(e.message);
    } finally {
      setSaving(false);
    }
  };

  const autoSuggest = async () => {
    if (!selected) return;
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/politicians/${selected.id}/image/auto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          persist: false,
          excludeUrls: getRejectedImageUrls(selected.id),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not auto-suggest image');
      const suggestionUrl = data?.suggestion?.imageUrl || null;
      if (!suggestionUrl) throw new Error('No suggestion URL returned');
      setPendingSuggestionUrl(suggestionUrl);
      setPendingSuggestionSource(data?.source || null);
      setImageUrlInput(suggestionUrl);
      setSourceImage(toDisplayUrl(suggestionUrl));
      setStatus(`Suggestion ready to review (${data.source || 'unknown source'}).`);
    } catch (e: any) {
      setStatus(e.message);
    } finally {
      setSaving(false);
    }
  };

  const applySuggestion = async () => {
    if (!selected || !pendingSuggestionUrl) return;
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/politicians/${selected.id}/image`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: pendingSuggestionUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to apply suggestion');
      updateActorImageInState(selected.id, data.imageUrl || null);
      setImageUrlInput(data.imageUrl || '');
      setSourceImage(toDisplayUrl(data.imageUrl || null));
      setPendingSuggestionUrl(null);
      setPendingSuggestionSource(null);
      setStatus('Suggestion applied.');
    } catch (e: any) {
      setStatus(e.message);
    } finally {
      setSaving(false);
    }
  };

  const rejectSuggestion = async () => {
    if (!selected || !pendingSuggestionUrl) return;
    rememberRejectedImageUrl(selected.id, pendingSuggestionUrl);
    setPendingSuggestionUrl(null);
    setPendingSuggestionSource(null);
    setImageUrlInput(selected.imageUrl || '');
    setSourceImage(toDisplayUrl(selected.imageUrl));
    setStatus('Suggestion rejected. Fetching another option...');
    await autoSuggest();
  };

  const deleteCurrentImage = async () => {
    if (!selected) return;
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/politicians/${selected.id}/image`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete image');
      updateActorImageInState(selected.id, null);
      setPendingSuggestionUrl(null);
      setPendingSuggestionSource(null);
      setImageUrlInput('');
      setSourceImage(null);
      setStatus('Image removed from actor.');
    } catch (e: any) {
      setStatus(e.message);
    } finally {
      setSaving(false);
    }
  };

  const saveCroppedUpload = async () => {
    if (!selected || !sourceImage) return;
    setSaving(true);
    setStatus(null);
    try {
      const blob = await renderCroppedSquare(sourceImage, scale, offsetX, offsetY, OUTPUT_SIZE);
      const file = new File([blob], `${selected.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-image.png`, {
        type: 'image/png',
      });
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/politicians/${selected.id}/image`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      updateActorImageInState(selected.id, data.imageUrl || null);
      setImageUrlInput(data.imageUrl || '');
      setSourceImage(toDisplayUrl(data.imageUrl || null));
      setPendingSuggestionUrl(null);
      setPendingSuggestionSource(null);
      setStatus('Cropped image uploaded and saved.');
    } catch (e: any) {
      setStatus(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Actor Images</h1>
            <p className="text-slate-500 mt-1">Set portraits for people and logos for organizations.</p>
          </div>
          <Link href="/admin" className="text-blue-600 hover:underline text-sm">&larr; Back to Admin</Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
          <section className="bg-white rounded-xl shadow p-4 space-y-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search actors..."
              className="w-full p-2 border rounded-md text-sm"
            />
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={missingOnly}
                onChange={(e) => setMissingOnly(e.target.checked)}
              />
              Show only actors missing images
            </label>
            <div className="max-h-[70vh] overflow-y-auto space-y-1">
              {filtered.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setSelectedId(a.id)}
                  className={`w-full text-left px-3 py-2 rounded-md border ${
                    selectedId === a.id ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-sm font-medium text-slate-900">{a.name}</div>
                  <div className="text-xs text-slate-500 capitalize">
                    {a.type.replace('_', ' ')} {a.imageUrl ? '• has image' : '• missing image'}
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-xl shadow p-6">
            {!selected ? (
              <div className="text-slate-500">Select an actor to manage image settings.</div>
            ) : (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">{selected.name}</h2>
                  <p className="text-sm text-slate-500 capitalize">
                    {selected.type.replace('_', ' ')}
                    {selected.title ? ` - ${selected.title}` : ''}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="text-sm font-medium text-slate-700">Current / Source Image</div>
                    <div className="w-56 h-56 rounded-full border border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center">
                      {sourceImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={sourceImage} alt={selected.name} className="w-full h-full object-contain p-2" />
                      ) : (
                        <span className="text-xs text-slate-400">No image selected</span>
                      )}
                    </div>
                    <button
                      onClick={autoSuggest}
                      disabled={saving}
                      className="px-3 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 disabled:opacity-50"
                    >
                      Auto-find Portrait/Logo
                    </button>
                    {pendingSuggestionUrl && (
                      <div className="space-y-2">
                        <div className="text-xs text-slate-500">
                          Suggested source: {pendingSuggestionSource || 'unknown'}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={applySuggestion}
                            disabled={saving}
                            className="px-3 py-2 bg-emerald-600 text-white rounded-md text-sm hover:bg-emerald-700 disabled:opacity-50"
                          >
                            Apply Suggestion
                          </button>
                          <button
                            onClick={rejectSuggestion}
                            disabled={saving}
                            className="px-3 py-2 bg-amber-600 text-white rounded-md text-sm hover:bg-amber-700 disabled:opacity-50"
                          >
                            Reject Suggestion
                          </button>
                        </div>
                      </div>
                    )}
                    {selected.imageUrl && (
                      <button
                        onClick={deleteCurrentImage}
                        disabled={saving}
                        className="px-3 py-2 bg-rose-600 text-white rounded-md text-sm hover:bg-rose-700 disabled:opacity-50"
                      >
                        Delete Current Image
                      </button>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Image URL</label>
                      <input
                        value={imageUrlInput}
                        onChange={(e) => setImageUrlInput(e.target.value)}
                        className="w-full p-2 border rounded-md text-sm"
                        placeholder="https://..."
                      />
                      <div className="mt-2">
                        <button
                          onClick={saveFromUrl}
                          disabled={saving || !imageUrlInput.trim()}
                          className="px-3 py-2 bg-slate-800 text-white rounded-md text-sm hover:bg-slate-900 disabled:opacity-50"
                        >
                          Save URL
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Upload and Crop</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) onFileChosen(f);
                        }}
                        className="block w-full text-sm"
                      />
                    </div>
                  </div>
                </div>

                {sourceImage && (
                  <div className="border-t pt-4 space-y-4">
                    <div className="text-sm font-medium text-slate-700">Crop + Resize Preview ({OUTPUT_SIZE}x{OUTPUT_SIZE})</div>
                    <CropPreview src={sourceImage} scale={scale} offsetX={offsetX} offsetY={offsetY} />

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <SliderField label="Zoom" min={0.3} max={3} step={0.01} value={scale} onChange={setScale} />
                      <SliderField label="Pan X" min={-100} max={100} step={1} value={offsetX} onChange={setOffsetX} />
                      <SliderField label="Pan Y" min={-100} max={100} step={1} value={offsetY} onChange={setOffsetY} />
                    </div>

                    <button
                      onClick={saveCroppedUpload}
                      disabled={saving}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
                    >
                      Save Cropped Upload
                    </button>
                  </div>
                )}

                {status && <div className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">{status}</div>}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function SliderField({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block">
      <div className="text-xs text-slate-500 mb-1">{label}: {value.toFixed(step < 1 ? 2 : 0)}</div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </label>
  );
}

function CropPreview({
  src,
  scale,
  offsetX,
  offsetY,
}: {
  src: string;
  scale: number;
  offsetX: number;
  offsetY: number;
}) {
  return (
    <div className="w-56 h-56 rounded-full overflow-hidden border border-slate-300 bg-slate-50">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Crop preview"
        className="w-full h-full object-contain p-2"
        style={{
          transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
          transformOrigin: 'center',
        }}
      />
    </div>
  );
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed reading file'));
    reader.readAsDataURL(file);
  });
}

async function renderCroppedSquare(
  source: string,
  scale: number,
  offsetX: number,
  offsetY: number,
  outputSize: number
): Promise<Blob> {
  const img = await loadImage(source);
  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create canvas context');

  // "Contain-first" render model:
  // At zoom 1, entire image fits inside output square (no forced crop).
  // Zoom >1 crops in; zoom <1 zooms out with padding.
  ctx.clearRect(0, 0, outputSize, outputSize);
  const fitScale = Math.min(outputSize / img.width, outputSize / img.height);
  const safeScale = Math.max(0.1, scale);
  const drawW = img.width * fitScale * safeScale;
  const drawH = img.height * fitScale * safeScale;

  const panRange = outputSize * 0.5;
  const panX = (offsetX / 100) * panRange;
  const panY = (offsetY / 100) * panRange;

  const dx = (outputSize - drawW) / 2 + panX;
  const dy = (outputSize - drawH) / 2 + panY;

  ctx.drawImage(img, dx, dy, drawW, drawH);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error('Failed to create blob'));
      else resolve(blob);
    }, 'image/png', 0.92);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

function toDisplayUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) {
    return `/api/image-proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
}

function rejectedImageUrlsKey(actorId: string): string {
  return `actor-image-rejected:${actorId}`;
}

function getRejectedImageUrls(actorId: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(rejectedImageUrlsKey(actorId));
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((u) => typeof u === 'string');
  } catch {
    return [];
  }
}

function rememberRejectedImageUrl(actorId: string, imageUrl: string): void {
  if (typeof window === 'undefined') return;
  const current = getRejectedImageUrls(actorId);
  const next = Array.from(new Set([...current, imageUrl]));
  window.localStorage.setItem(rejectedImageUrlsKey(actorId), JSON.stringify(next));
}
