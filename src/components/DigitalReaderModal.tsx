import { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight, BookmarkCheck, Type } from 'lucide-react';
import { Book, User } from '../types';
import { apiRequest } from '../lib/api';

interface DigitalReaderModalProps {
  book: Book | null;
  user: User | null;
  initialChapter?: number;
  onClose: () => void;
  onProgressSaved?: (bookId: number, chapterIndex: number) => void;
}

type ReaderTheme = 'paper' | 'sepia' | 'slate';

export function DigitalReaderModal({
  book,
  user,
  initialChapter = 0,
  onClose,
  onProgressSaved
}: DigitalReaderModalProps) {
  const [chapterIndex, setChapterIndex] = useState(initialChapter);
  const [fontSize, setFontSize] = useState(17);
  const [theme, setTheme] = useState<ReaderTheme>('paper');
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    setChapterIndex(initialChapter);
  }, [book, initialChapter]);

  if (!book) return null;

  const chapters =
    book.digital_chapters && book.digital_chapters.length > 0
      ? book.digital_chapters
      : [
          {
            title: 'Open-Access Preview',
            paragraphs: [
              book.description,
              'This volume is curated in the Digital Library Public Repository for immediate academic and community reading.'
            ]
          }
        ];

  const activeChapter = chapters[Math.min(chapterIndex, chapters.length - 1)];

  const handleChapterChange = async (nextIndex: number) => {
    setChapterIndex(nextIndex);
    if (user) {
      try {
        await apiRequest(`/api/digital/${book.id}/progress`, {
          method: 'POST',
          body: JSON.stringify({ chapterIndex: nextIndex })
        });
        setSavedNotice(true);
        onProgressSaved?.(book.id, nextIndex);
        setTimeout(() => setSavedNotice(false), 1800);
      } catch {
        // silent ignore
      }
    }
  };

  const themeClasses: Record<ReaderTheme, string> = {
    paper: 'bg-white text-[#303846]',
    sepia: 'bg-[#FAF6EC] text-[#3B3228]',
    slate: 'bg-[#142B45] text-slate-100'
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-6">
      <div className={`w-full max-w-5xl h-[90vh] rounded-2xl border border-slate-200 overflow-hidden flex flex-col shadow-2xl ${themeClasses[theme]}`}>
        {/* Reader Top Toolbar */}
        <div className="px-5 py-3.5 border-b border-slate-200/20 bg-[#142B45] text-white flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs text-slate-300 truncate">{book.author}</p>
            <h2 className="font-display text-base font-bold truncate">{book.title}</h2>
          </div>

          <div className="flex items-center gap-3">
            {savedNotice && (
              <span className="inline-flex items-center gap-1 text-xs text-[#19A68C]">
                <BookmarkCheck className="w-4 h-4" />
                Progress saved
              </span>
            )}

            <div className="flex items-center gap-1 bg-white/10 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setTheme('paper')}
                className={`px-2.5 py-1 text-xs rounded ${theme === 'paper' ? 'bg-white text-[#142B45] font-semibold' : 'text-slate-200'}`}
              >
                Light
              </button>
              <button
                type="button"
                onClick={() => setTheme('sepia')}
                className={`px-2.5 py-1 text-xs rounded ${theme === 'sepia' ? 'bg-[#FAF6EC] text-[#3B3228] font-semibold' : 'text-slate-200'}`}
              >
                Sepia
              </button>
              <button
                type="button"
                onClick={() => setTheme('slate')}
                className={`px-2.5 py-1 text-xs rounded ${theme === 'slate' ? 'bg-[#19A68C] text-white font-semibold' : 'text-slate-200'}`}
              >
                Night
              </button>
            </div>

            <div className="flex items-center gap-1 bg-white/10 rounded-lg px-2 py-1">
              <Type className="w-3.5 h-3.5 text-slate-300" />
              <button
                type="button"
                onClick={() => setFontSize((s) => Math.max(14, s - 1))}
                className="px-1.5 text-xs hover:text-[#19A68C]"
              >
                A-
              </button>
              <span className="text-xs font-mono-num">{fontSize}</span>
              <button
                type="button"
                onClick={() => setFontSize((s) => Math.min(22, s + 1))}
                className="px-1.5 text-xs hover:text-[#19A68C]"
              >
                A+
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close digital reader"
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden">
          <aside className="hidden md:block w-64 border-r border-slate-200/25 p-4 overflow-y-auto">
            <p className="text-xs font-semibold uppercase tracking-wider opacity-60 mb-3">
              Chapters ({chapters.length})
            </p>
            <div className="space-y-1">
              {chapters.map((ch, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleChapterChange(idx)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-xs leading-snug transition-colors ${
                    idx === chapterIndex
                      ? 'bg-[#19A68C] text-white font-semibold'
                      : 'hover:bg-black/5 opacity-85'
                  }`}
                >
                  {ch.title}
                </button>
              ))}
            </div>
          </aside>

          <main className="flex-1 overflow-y-auto p-6 sm:p-12">
            <div className="max-w-2xl mx-auto space-y-6">
              <p className="text-xs font-mono-num uppercase tracking-wider opacity-60">
                Section {chapterIndex + 1} of {chapters.length}
              </p>
              <h3 className="font-display text-2xl sm:text-3xl font-bold leading-tight">
                {activeChapter.title}
              </h3>

              <div className="space-y-5 leading-relaxed" style={{ fontSize: `${fontSize}px`, lineHeight: 1.75 }}>
                {activeChapter.paragraphs.map((p, idx) => (
                  <p key={idx}>{p}</p>
                ))}
              </div>

              <div className="pt-8 mt-8 border-t border-slate-200/30 flex items-center justify-between">
                <button
                  type="button"
                  disabled={chapterIndex === 0}
                  onClick={() => handleChapterChange(chapterIndex - 1)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border border-current/20 disabled:opacity-35"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
                <button
                  type="button"
                  disabled={chapterIndex >= chapters.length - 1}
                  onClick={() => handleChapterChange(chapterIndex + 1)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-[#19A68C] text-white disabled:opacity-35"
                >
                  Next Chapter
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
