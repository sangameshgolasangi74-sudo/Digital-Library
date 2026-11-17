import { useState } from 'react';
import { Repeat, Clock } from 'lucide-react';
import { Book } from '../types';
import { BookCard } from './BookCard';

interface ExchangePageProps {
  books: Book[];
  wishlistIds: Set<number>;
  onSelectBook: (book: Book) => void;
  onToggleWishlist: (bookId: number) => void;
}

export function ExchangePage({
  books,
  wishlistIds,
  onSelectBook,
  onToggleWishlist
}: ExchangePageProps) {
  const [mode, setMode] = useState<'exchange' | 'borrow'>('exchange');

  const exchangeBooks = books.filter((b) => b.allow_exchange === 1);
  const borrowBooks = books.filter((b) => b.allow_borrow === 1);
  const displayed = mode === 'exchange' ? exchangeBooks : borrowBooks;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="bg-white border border-slate-200 rounded-2xl p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="max-w-2xl space-y-2">
          <h1 className="font-display text-3xl font-bold text-[#142B45]">
            Book Exchange &amp; Local Borrowing Hub
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            Select any book below to propose a peer-to-peer swap from your personal shelf or request a 7 to 30-day physical loan.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#F5F7FA] border border-slate-200 rounded-xl w-fit shrink-0">
          <button
            type="button"
            onClick={() => setMode('exchange')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
              mode === 'exchange' ? 'bg-[#142B45] text-white' : 'text-slate-600 hover:text-[#142B45]'
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
            Available for Exchange ({exchangeBooks.length})
          </button>
          <button
            type="button"
            onClick={() => setMode('borrow')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
              mode === 'borrow' ? 'bg-[#142B45] text-white' : 'text-slate-600 hover:text-[#142B45]'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Available to Borrow ({borrowBooks.length})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {displayed.map((book) => (
          <BookCard
            key={book.id}
            book={book}
            isWishlisted={wishlistIds.has(book.id)}
            onToggleWishlist={onToggleWishlist}
            onSelect={onSelectBook}
          />
        ))}
      </div>
    </div>
  );
}
