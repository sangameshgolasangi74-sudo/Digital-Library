import { useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { Book, Category } from '../types';
import { BookCard } from './BookCard';
import { formatINR } from '../lib/formatCurrency';

interface ExplorePageProps {
  books: Book[];
  categories: Category[];
  wishlistIds: Set<number>;
  initialQuery?: string;
  onSelectBook: (book: Book) => void;
  onToggleWishlist: (bookId: number) => void;
}

export function ExplorePage({
  books,
  categories,
  wishlistIds,
  initialQuery = '',
  onSelectBook,
  onToggleWishlist
}: ExplorePageProps) {
  const [query, setQuery] = useState(initialQuery);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState<'all' | 'buy' | 'exchange' | 'borrow' | 'digital'>('all');
  const [conditionFilter, setConditionFilter] = useState('all');
  const [maxPrice, setMaxPrice] = useState<number>(2500);
  const [sortBy, setSortBy] = useState<'newest' | 'price_asc' | 'price_desc' | 'rating'>('newest');

  const filtered = books
    .filter((b) => {
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        const hay = `${b.title} ${b.author} ${b.isbn} ${b.description} ${b.category_name || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (categoryFilter !== 'all' && String(b.category_id) !== categoryFilter) return false;
      if (serviceFilter === 'buy' && (!b.allow_buy || b.stock < 1)) return false;
      if (serviceFilter === 'exchange' && !b.allow_exchange) return false;
      if (serviceFilter === 'borrow' && !b.allow_borrow) return false;
      if (serviceFilter === 'digital' && !b.is_digital) return false;
      if (conditionFilter !== 'all' && b.condition !== conditionFilter) return false;
      if (b.price > maxPrice) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'price_asc') return a.price - b.price;
      if (sortBy === 'price_desc') return b.price - a.price;
      if (sortBy === 'rating') return b.rating_avg - a.rating_avg;
      return b.id - a.id;
    });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#142B45]">Explore Catalog</h1>
          <p className="text-sm text-slate-600 mt-1">
            Filter books by subject, condition, price ceiling, or availability across Buy, Exchange, Borrow, and Digital editions.
          </p>
        </div>
        <span className="text-xs font-mono-num text-slate-500">{filtered.length} matching editions</span>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, author, ISBN..."
              className="w-full pl-10 pr-3 py-2.5 bg-[#F5F7FA] border border-slate-200 rounded-lg text-sm"
            />
          </div>

          <div className="md:col-span-3">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Filter by category"
              className="w-full px-3 py-2.5 bg-[#F5F7FA] border border-slate-200 rounded-lg text-sm"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              value={conditionFilter}
              onChange={(e) => setConditionFilter(e.target.value)}
              aria-label="Filter by condition"
              className="w-full px-3 py-2.5 bg-[#F5F7FA] border border-slate-200 rounded-lg text-sm"
            >
              <option value="all">Any Condition</option>
              <option value="New">New</option>
              <option value="Like New">Like New</option>
              <option value="Good">Good</option>
              <option value="Fair">Fair</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              aria-label="Sort results"
              className="w-full px-3 py-2.5 bg-[#F5F7FA] border border-slate-200 rounded-lg text-sm"
            >
              <option value="newest">Newest First</option>
              <option value="rating">Highest Rated</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F5F7FA] rounded-lg border border-slate-200">
            {(['all', 'buy', 'exchange', 'borrow', 'digital'] as const).map((svc) => (
              <button
                key={svc}
                type="button"
                onClick={() => setServiceFilter(svc)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md capitalize transition-colors ${
                  serviceFilter === svc ? 'bg-[#142B45] text-white' : 'text-slate-600 hover:text-[#142B45]'
                }`}
              >
                {svc === 'all' ? 'All Services' : svc}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-600">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
            <label htmlFor="max-price-range">Max Price:</label>
            <input
              id="max-price-range"
              type="range"
              min={0}
              max={2500}
              step={50}
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
              className="accent-[#19A68C]"
            />
            <span className="font-mono-num font-semibold text-[#142B45] w-16">{formatINR(maxPrice)}</span>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3">
          <p className="text-base font-semibold text-[#142B45]">No books match your active filters</p>
          <p className="text-xs text-slate-500">Try clearing the search term or widening your price ceiling.</p>
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setCategoryFilter('all');
              setServiceFilter('all');
              setConditionFilter('all');
              setMaxPrice(2500);
            }}
            className="px-4 py-2 bg-[#142B45] text-white text-xs font-semibold rounded-lg"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filtered.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              isWishlisted={wishlistIds.has(book.id)}
              onToggleWishlist={onToggleWishlist}
              onSelect={onSelectBook}
            />
          ))}
        </div>
      )}
    </div>
  );
}
