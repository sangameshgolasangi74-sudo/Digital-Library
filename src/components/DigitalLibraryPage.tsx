import { BookOpen, ArrowRight } from 'lucide-react';
import { Book } from '../types';
import { resolveCoverUrl } from '../lib/coverAssets';

interface DigitalLibraryPageProps {
  books: Book[];
  progressMap: Record<number, number>;
  onOpenReader: (book: Book, initialChapter?: number) => void;
  onSelectBook: (book: Book) => void;
}

export function DigitalLibraryPage({
  books,
  progressMap,
  onOpenReader,
  onSelectBook
}: DigitalLibraryPageProps) {
  const digitalBooks = books.filter((b) => b.is_digital === 1);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      <div className="bg-[#142B45] text-white rounded-2xl p-8 sm:p-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="max-w-2xl space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#19A68C]">
            Open-Access Public Repository
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-balance">
            Digital Library Public Repository
          </h1>
          <p className="text-sm text-slate-200 leading-relaxed">
            Access legally verified public-domain classics, Creative Commons textbooks, and faculty-shared digital monographs directly in your browser with automatic chapter bookmarking.
          </p>
        </div>
        <div className="bg-white/10 border border-white/15 rounded-xl px-6 py-4 shrink-0">
          <p className="font-mono-num text-2xl font-bold">{digitalBooks.length}</p>
          <p className="text-xs text-slate-300 mt-0.5">Readable Online Editions</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {digitalBooks.map((book) => {
          const savedChapter = progressMap[book.id] || 0;
          const totalChapters = book.digital_chapters?.length || 1;
          return (
            <article
              key={book.id}
              className="bg-white border border-slate-200 rounded-xl p-5 flex gap-5 items-start"
            >
              <img
                src={resolveCoverUrl(book.cover_url)}
                alt={book.title}
                referrerPolicy="no-referrer"
                className="w-28 h-36 object-cover rounded-lg bg-[#F5F7FA] border border-slate-200 shrink-0"
              />
              <div className="flex-1 min-w-0 space-y-2.5">
                <p className="text-xs text-slate-500">
                  {book.category_name} <span aria-hidden="true">·</span> {totalChapters} Chapters
                </p>
                <h2 className="font-display text-lg font-bold text-[#142B45] leading-snug">
                  {book.title}
                </h2>
                <p className="text-xs font-medium text-slate-600">{book.author}</p>
                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{book.description}</p>

                <div className="pt-2 flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => onOpenReader(book, savedChapter)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#19A68C] hover:bg-[#158c76] text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    {savedChapter > 0 ? `Resume Section ${savedChapter + 1}` : 'Launch Reader'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectBook(book)}
                    className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-[#142B45] hover:bg-[#F5F7FA] rounded-lg border border-slate-200"
                  >
                    Edition Details
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
