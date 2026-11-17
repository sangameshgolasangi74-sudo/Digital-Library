import { Heart, Star, BookOpen } from 'lucide-react';
import { Book } from '../types';
import { resolveCoverUrl } from '../lib/coverAssets';
import { formatINR } from '../lib/formatCurrency';

interface BookCardProps {
  book: Book;
  isWishlisted?: boolean;
  onToggleWishlist?: (bookId: number) => void;
  onSelect: (book: Book) => void;
}

export function BookCard({ book, isWishlisted = false, onToggleWishlist, onSelect }: BookCardProps) {
  const coverSrc = resolveCoverUrl(book.cover_url);

  const serviceSummary = [
    book.allow_buy ? formatINR(book.price) : null,
    book.allow_exchange ? 'Exchange' : null,
    book.allow_borrow ? 'Borrow' : null,
    book.is_digital ? 'Digital' : null
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <article
      className="group bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
    >
      <div
        onClick={() => onSelect(book)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(book);
          }
        }}
        className="relative aspect-[3/4] bg-[#F5F7FA] overflow-hidden cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#19A68C]"
      >
        <img
          src={coverSrc}
          alt={`Cover of ${book.title}`}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
        <div className="absolute inset-0 -z-10 flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-[#142B45]/5 to-[#19A68C]/10">
          <BookOpen className="w-8 h-8 text-[#142B45]/40 mb-2" />
          <span className="font-display text-sm font-semibold text-[#142B45] line-clamp-2">{book.title}</span>
        </div>

        {onToggleWishlist && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleWishlist(book.id);
            }}
            aria-label={isWishlisted ? `Remove ${book.title} from wishlist` : `Save ${book.title} to wishlist`}
            className="absolute top-3 right-3 w-9 h-9 rounded-lg bg-white/95 border border-slate-200 flex items-center justify-center text-[#142B45] hover:text-[#19A68C] transition-colors shadow-sm"
          >
            <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-[#19A68C] text-[#19A68C]' : ''}`} />
          </button>
        )}
      </div>

      <div className="p-4 flex-1 flex flex-col justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500 truncate">
            {book.category_name || 'General'} <span aria-hidden="true">·</span> {book.condition}
          </p>
          <button
            type="button"
            onClick={() => onSelect(book)}
            className="mt-1 text-left font-semibold text-[16px] leading-snug text-[#142B45] hover:text-[#19A68C] transition-colors line-clamp-2"
          >
            {book.title}
          </button>
          <p className="text-xs text-slate-600 mt-1 truncate">{book.author}</p>
        </div>

        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-[#142B45] tabular-nums truncate">
            {serviceSummary || 'Reference'}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-slate-600 tabular-nums shrink-0">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            {book.rating_count > 0 ? book.rating_avg.toFixed(1) : 'New'}
          </span>
        </div>
      </div>
    </article>
  );
}
