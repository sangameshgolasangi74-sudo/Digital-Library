import { useState } from 'react';
import { Search, ArrowRight, BookOpen, Repeat, Clock, ShoppingBag } from 'lucide-react';
import { Book, Category } from '../types';
import { HERO_LIBRARY_IMAGE } from '../lib/coverAssets';
import { BookCard } from './BookCard';
import { AppView } from './Navbar';
import { apiRequest } from '../lib/api';

interface HomePageProps {
  books: Book[];
  categories: Category[];
  wishlistIds: Set<number>;
  publicStats: { books: number; users: number; digital: number; exchanges: number };
  onSearchSubmit: (query: string) => void;
  onNavigate: (view: AppView) => void;
  onSelectBook: (book: Book) => void;
  onToggleWishlist: (bookId: number) => void;
  onOpenReader: (book: Book) => void;
  onOpenAuth: (mode?: 'login' | 'register') => void;
  onNotify: (title: string, description?: string, variant?: 'success' | 'error' | 'info') => void;
}

export function HomePage({
  books,
  categories,
  wishlistIds,
  publicStats,
  onSearchSubmit,
  onNavigate,
  onSelectBook,
  onToggleWishlist,
  onOpenReader,
  onOpenAuth,
  onNotify
}: HomePageProps) {
  const [heroQuery, setHeroQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [subscribing, setSubscribing] = useState(false);

  const filteredBooks =
    selectedCategory === 'all'
      ? books
      : books.filter((b) => String(b.category_id) === selectedCategory);

  const featuredBooks = filteredBooks.slice(0, 4);
  const recentBooks = [...books].slice(0, 4);
  const digitalBooks = books.filter((b) => b.is_digital === 1).slice(0, 3);

  const handleHeroSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchSubmit(heroQuery);
  };

  const handleNewsletter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail.trim()) return;
    setSubscribing(true);
    try {
      const res = await apiRequest<{ message: string }>('/api/newsletter', {
        method: 'POST',
        body: JSON.stringify({ email: newsletterEmail })
      });
      onNotify('Subscribed', res.message);
      setNewsletterEmail('');
    } catch (err) {
      onNotify('Subscription error', err instanceof Error ? err.message : 'Invalid email.', 'error');
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <div className="space-y-20 pb-20">
      {/* 1. Hero Split Showcase + 4-Column Service Strip */}
      <section className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#19A68C]">
                Public Library &amp; Community Exchange
              </p>
              <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-[#142B45] leading-[1.12] text-balance">
                Discover Books. Share Knowledge. Build Connections.
              </h1>
              <p className="text-base text-[#303846] leading-relaxed max-w-xl">
                Digital Library connects students, educators, and independent readers in a single civic platform—buy affordable editions, swap books peer-to-peer, borrow locally, and read open-access digital volumes online.
              </p>

              <form onSubmit={handleHeroSearch} className="flex flex-col sm:flex-row gap-2.5 max-w-xl">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={heroQuery}
                    onChange={(e) => setHeroQuery(e.target.value)}
                    placeholder="Search by title, author, subject, or ISBN..."
                    aria-label="Search books"
                    className="w-full pl-10 pr-4 py-3 bg-[#F5F7FA] border border-slate-200 rounded-xl text-sm text-[#142B45] focus:outline-none focus:ring-2 focus:ring-[#19A68C] focus:bg-white transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  className="px-6 py-3 bg-[#142B45] hover:bg-[#1e3d61] text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0"
                >
                  Search Catalog
                </button>
              </form>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => onNavigate('explore')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#19A68C] hover:bg-[#158c76] text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
                >
                  Explore Books
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAuth('register')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-[#F5F7FA] text-[#142B45] border border-slate-300 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
                >
                  Join Digital Library
                </button>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="h-72 sm:h-96 lg:h-full min-h-[340px] rounded-2xl overflow-hidden border border-slate-200 bg-[#F5F7FA]">
                <img
                  src={HERO_LIBRARY_IMAGE}
                  alt="Sunlit public library reading room and community book exchange table"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>

          {/* 4-Column Service Pillars */}
          <div className="mt-12 pt-10 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <button
              type="button"
              onClick={() => onNavigate('explore')}
              className="text-left p-5 rounded-xl bg-[#F5F7FA] hover:bg-slate-100 border border-slate-200/80 transition-colors"
            >
              <ShoppingBag className="w-5 h-5 text-[#142B45] mb-3" />
              <h3 className="text-sm font-semibold text-[#142B45]">Buy &amp; Sell Textbooks</h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Purchase verified student and collector editions directly from peers with transparent pricing.
              </p>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('exchange')}
              className="text-left p-5 rounded-xl bg-[#F5F7FA] hover:bg-slate-100 border border-slate-200/80 transition-colors"
            >
              <Repeat className="w-5 h-5 text-[#19A68C] mb-3" />
              <h3 className="text-sm font-semibold text-[#142B45]">Peer Book Exchange</h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Trade books you have finished for next semester&apos;s reading list without paying retail markup.
              </p>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('exchange')}
              className="text-left p-5 rounded-xl bg-[#F5F7FA] hover:bg-slate-100 border border-slate-200/80 transition-colors"
            >
              <Clock className="w-5 h-5 text-[#142B45] mb-3" />
              <h3 className="text-sm font-semibold text-[#142B45]">Local Borrowing</h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Borrow physical volumes for 7 to 30 days with clear due dates and automated return tracking.
              </p>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('digital')}
              className="text-left p-5 rounded-xl bg-[#F5F7FA] hover:bg-slate-100 border border-slate-200/80 transition-colors"
            >
              <BookOpen className="w-5 h-5 text-[#19A68C] mb-3" />
              <h3 className="text-sm font-semibold text-[#142B45]">Digital Public Library</h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Read legally licensed open-access editions immediately in our distraction-free browser reader.
              </p>
            </button>
          </div>
        </div>
      </section>

      {/* 2. Featured Books & Popular Categories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl font-bold text-[#142B45]">Featured Editions &amp; Categories</h2>
            <p className="text-sm text-slate-600 mt-1">
              Curated physical volumes and open-access texts ready to buy, exchange, or borrow.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('explore')}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#19A68C] hover:text-[#142B45] transition-colors whitespace-nowrap"
          >
            Browse full catalog
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Interactive Category Segmented Filter */}
        <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-white border border-slate-200 rounded-xl w-fit">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              selectedCategory === 'all'
                ? 'bg-[#142B45] text-white'
                : 'text-slate-600 hover:text-[#142B45] hover:bg-[#F5F7FA]'
            }`}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(String(cat.id))}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                selectedCategory === String(cat.id)
                  ? 'bg-[#142B45] text-white'
                  : 'text-slate-600 hover:text-[#142B45] hover:bg-[#F5F7FA]'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {featuredBooks.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              isWishlisted={wishlistIds.has(book.id)}
              onToggleWishlist={onToggleWishlist}
              onSelect={onSelectBook}
            />
          ))}
        </div>

        {/* Recently Added Strip */}
        <div className="pt-8 border-t border-slate-200 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-xl font-bold text-[#142B45]">Recently Added to the Shelves</h3>
            <span className="text-xs font-mono-num text-slate-500">{books.length} active listings</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {recentBooks.map((book) => (
              <BookCard
                key={`recent-${book.id}`}
                book={book}
                isWishlisted={wishlistIds.has(book.id)}
                onToggleWishlist={onToggleWishlist}
                onSelect={onSelectBook}
              />
            ))}
          </div>
        </div>
      </section>

      {/* 3. How Digital Library Works & Open-Access Digital Library */}
      <section className="bg-white border-y border-slate-200 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-5 space-y-6">
            <h2 className="font-display text-3xl font-bold text-[#142B45] text-balance">
              How Digital Library Works
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Every registered member receives unified access to browse, borrow, swap, or list personal volumes through separate, purpose-built dashboards.
            </p>
            <div className="space-y-5 pt-2">
              <div className="pb-4 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-[#142B45]">01. Search by ISBN, Subject, or Service</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Filter instantly between copies for sale, peer-to-peer book swaps, short-term campus borrowing, or free digital editions.
                </p>
              </div>
              <div className="pb-4 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-[#142B45]">02. Connect &amp; Confirm in One Workspace</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Message book owners directly, propose an exchange from your shelf, or verify delivery and payment terms at checkout.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#142B45]">03. Track Returns, Orders &amp; Reading Progress</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Stay on top of due dates, order shipments, and chapter bookmarks across physical and digital reading lists.
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 bg-[#F5F7FA] border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-display text-2xl font-bold text-[#142B45]">Digital Public Library</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Open-access monographs and coursebooks readable immediately in your browser.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('digital')}
                className="text-xs font-semibold text-[#19A68C] hover:text-[#142B45] whitespace-nowrap"
              >
                View all digital books
              </button>
            </div>

            <div className="divide-y divide-slate-200 bg-white border border-slate-200 rounded-xl">
              {digitalBooks.map((book) => (
                <div key={book.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500">
                      {book.category_name} <span aria-hidden="true">·</span> Open Access
                    </p>
                    <h4 className="text-sm font-semibold text-[#142B45] truncate mt-0.5">{book.title}</h4>
                    <p className="text-xs text-slate-600">{book.author}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenReader(book)}
                    className="px-4 py-2 bg-[#19A68C] hover:bg-[#158c76] text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    Read Now
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 4. Why Choose BookBridge, Testimonials & Newsletter */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 bg-[#142B45] text-white rounded-2xl p-8">
          <div>
            <p className="font-mono-num text-3xl font-bold">{publicStats.books}</p>
            <p className="text-xs text-slate-300 mt-1">Active Catalog Volumes</p>
          </div>
          <div>
            <p className="font-mono-num text-3xl font-bold">{publicStats.digital}</p>
            <p className="text-xs text-slate-300 mt-1">Open-Access Digital Titles</p>
          </div>
          <div>
            <p className="font-mono-num text-3xl font-bold">{publicStats.exchanges}</p>
            <p className="text-xs text-slate-300 mt-1">Peer Book Exchanges</p>
          </div>
          <div>
            <p className="font-mono-num text-3xl font-bold">{publicStats.users}</p>
            <p className="text-xs text-slate-300 mt-1">Verified Community Members</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <blockquote className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
            <p className="text-sm text-[#303846] leading-relaxed">
              &ldquo;Before Digital Library, our engineering cohort spent over ₹14,000 each term on new textbooks. By exchanging and borrowing upper-year copies directly on campus, I cut my semester book costs by 68%.&rdquo;
            </p>
            <footer className="pt-2 border-t border-slate-100">
              <p className="text-xs font-semibold text-[#142B45]">Nadia Rahman</p>
              <p className="text-xs text-slate-500">M.Sc. Computer Science, Pacific State University</p>
            </footer>
          </blockquote>

          <blockquote className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
            <p className="text-sm text-[#303846] leading-relaxed">
              &ldquo;Managing student lending requests used to mean scattered spreadsheets and lost emails. The Owner Dashboard keeps every borrow due date, swap offer, and return status organized in one place.&rdquo;
            </p>
            <footer className="pt-2 border-t border-slate-100">
              <p className="text-xs font-semibold text-[#142B45]">Dr. Samuel Okafor</p>
              <p className="text-xs text-slate-500">Faculty Librarian, Civic Humanities Trust</p>
            </footer>
          </blockquote>

          <blockquote className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
            <p className="text-sm text-[#303846] leading-relaxed">
              &ldquo;Having legally cleared digital previews alongside physical editions lets our seminar students start reading immediately on day one while waiting for physical swap handoffs.&rdquo;
            </p>
            <footer className="pt-2 border-t border-slate-100">
              <p className="text-xs font-semibold text-[#142B45]">Claire Beaumont</p>
              <p className="text-xs text-slate-500">Lecturer in Architecture &amp; Urban Design</p>
            </footer>
          </blockquote>
        </div>

        {/* Newsletter */}
        <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-xl">
            <h2 className="font-display text-2xl font-bold text-[#142B45]">
              Quarterly Open-Access &amp; Exchange Digest
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Receive curated updates when new public-domain digital monographs and campus book exchange fairs open.
            </p>
          </div>
          <form onSubmit={handleNewsletter} className="flex flex-col sm:flex-row gap-2.5 w-full lg:w-auto">
            <input
              type="email"
              required
              value={newsletterEmail}
              onChange={(e) => setNewsletterEmail(e.target.value)}
              placeholder="Enter your email address"
              aria-label="Newsletter email"
              className="px-4 py-2.5 bg-[#F5F7FA] border border-slate-200 rounded-lg text-sm min-w-[260px]"
            />
            <button
              type="submit"
              disabled={subscribing}
              className="px-5 py-2.5 bg-[#142B45] hover:bg-[#1e3d61] text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
            >
              {subscribing ? 'Subscribing...' : 'Subscribe'}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
