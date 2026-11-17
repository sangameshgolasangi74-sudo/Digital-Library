import { useEffect, useState } from 'react';
import { X, Star, ShoppingBag, Repeat, Clock, BookOpen, Send, Heart } from 'lucide-react';
import { Book, Review, User } from '../types';
import { resolveCoverUrl } from '../lib/coverAssets';
import { apiRequest } from '../lib/api';
import { formatINR } from '../lib/formatCurrency';

interface BookDetailModalProps {
  book: Book | null;
  user: User | null;
  isWishlisted: boolean;
  onClose: () => void;
  onAddToCart: (book: Book, qty: number) => void;
  onToggleWishlist: (bookId: number) => void;
  onOpenReader: (book: Book) => void;
  onRequireAuth: () => void;
  onNotify: (title: string, description?: string, variant?: 'success' | 'error' | 'info') => void;
}

type ActionTab = 'buy' | 'exchange' | 'borrow' | 'message';

export function BookDetailModal({
  book,
  user,
  isWishlisted,
  onClose,
  onAddToCart,
  onToggleWishlist,
  onOpenReader,
  onRequireAuth,
  onNotify
}: BookDetailModalProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [myBooks, setMyBooks] = useState<Book[]>([]);
  const [activeTab, setActiveTab] = useState<ActionTab>('buy');
  const [qty, setQty] = useState(1);

  // Exchange form state
  const [offeredBookId, setOfferedBookId] = useState<string>('');
  const [offeredTitle, setOfferedTitle] = useState('');
  const [offeredCondition, setOfferedCondition] = useState('Like New');
  const [exchangeNote, setExchangeNote] = useState('');

  // Borrow form state
  const [borrowDays, setBorrowDays] = useState(14);

  // Message form state
  const [messageBody, setMessageBody] = useState('');

  // Review form state
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!book) return;
    setQty(1);
    if (book.allow_buy) setActiveTab('buy');
    else if (book.allow_exchange) setActiveTab('exchange');
    else if (book.allow_borrow) setActiveTab('borrow');
    else setActiveTab('message');

    apiRequest<{ reviews: Review[] }>(`/api/books/${book.id}`)
      .then((res) => setReviews(res.reviews || []))
      .catch(() => setReviews([]));

    if (user) {
      apiRequest<{ books: Book[] }>('/api/owner/books')
        .then((res) => setMyBooks(res.books || []))
        .catch(() => setMyBooks([]));
    }
  }, [book, user]);

  if (!book) return null;

  const isOwnListing = user && user.id === book.owner_id;

  const handleExchangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return onRequireAuth();
    setSubmitting(true);
    try {
      await apiRequest('/api/exchanges', {
        method: 'POST',
        body: JSON.stringify({
          requestedBookId: book.id,
          offeredBookId: offeredBookId ? Number(offeredBookId) : null,
          offeredTitle,
          offeredCondition,
          note: exchangeNote
        })
      });
      onNotify('Exchange proposal sent', `Your swap offer for "${book.title}" has been sent to ${book.owner_name}.`);
      setOfferedTitle('');
      setExchangeNote('');
    } catch (err) {
      onNotify('Unable to send proposal', err instanceof Error ? err.message : 'Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBorrowSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return onRequireAuth();
    setSubmitting(true);
    try {
      await apiRequest('/api/borrowings', {
        method: 'POST',
        body: JSON.stringify({
          bookId: book.id,
          durationDays: borrowDays
        })
      });
      onNotify('Borrow request submitted', `${borrowDays}-day borrow request sent to ${book.owner_name}.`);
    } catch (err) {
      onNotify('Borrow request failed', err instanceof Error ? err.message : 'Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMessageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return onRequireAuth();
    if (!messageBody.trim()) return;
    setSubmitting(true);
    try {
      await apiRequest('/api/messages', {
        method: 'POST',
        body: JSON.stringify({
          receiverId: book.owner_id,
          bookId: book.id,
          body: messageBody
        })
      });
      onNotify('Message delivered', `Sent directly to ${book.owner_name}.`);
      setMessageBody('');
    } catch (err) {
      onNotify('Message failed', err instanceof Error ? err.message : 'Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return onRequireAuth();
    if (!reviewComment.trim()) return;
    setSubmitting(true);
    try {
      await apiRequest('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({
          bookId: book.id,
          rating: reviewRating,
          comment: reviewComment
        })
      });
      const updated = await apiRequest<{ reviews: Review[] }>(`/api/books/${book.id}`);
      setReviews(updated.reviews || []);
      setReviewComment('');
      onNotify('Review published', 'Thank you for rating this edition.');
    } catch (err) {
      onNotify('Could not post review', err instanceof Error ? err.message : 'Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#142B45]/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={book.title}
        className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
      >
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500 truncate">
              {book.category_name} <span aria-hidden="true">·</span> ISBN {book.isbn}
            </p>
            <h2 className="font-display text-xl font-bold text-[#142B45] truncate">{book.title}</h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => (user ? onToggleWishlist(book.id) : onRequireAuth())}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-slate-200 rounded-lg hover:bg-[#F5F7FA] transition-colors"
            >
              <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-[#19A68C] text-[#19A68C]' : 'text-slate-600'}`} />
              {isWishlisted ? 'Saved' : 'Save'}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close details"
              className="p-2 text-slate-500 hover:text-[#142B45] hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* Left Column: Cover + Details + Reviews */}
          <div className="md:col-span-5 space-y-6">
            <div className="aspect-[3/4] rounded-xl overflow-hidden bg-[#F5F7FA] border border-slate-200">
              <img
                src={resolveCoverUrl(book.cover_url)}
                alt={book.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="space-y-2 text-sm border-t border-slate-100 pt-4">
              <div className="flex justify-between">
                <span className="text-slate-500">Author</span>
                <span className="font-medium text-[#142B45] text-right">{book.author}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Condition</span>
                <span className="font-medium text-[#142B45]">{book.condition}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Listed By</span>
                <span className="font-medium text-[#142B45] text-right">
                  {book.owner_name}
                  {book.owner_institution ? ` · ${book.owner_institution}` : ''}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Stock Available</span>
                <span className="font-mono-num font-medium text-[#142B45]">{book.stock} copies</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Rating</span>
                <span className="inline-flex items-center gap-1 font-mono-num font-medium text-[#142B45]">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  {book.rating_count > 0 ? `${book.rating_avg.toFixed(1)} (${book.rating_count})` : 'No ratings yet'}
                </span>
              </div>
            </div>

            {book.is_digital === 1 && (
              <button
                type="button"
                onClick={() => onOpenReader(book)}
                className="w-full py-2.5 px-4 bg-[#19A68C] hover:bg-[#158c76] text-white font-semibold text-sm rounded-lg inline-flex items-center justify-center gap-2 transition-colors"
              >
                <BookOpen className="w-4 h-4" />
                Read Open-Access Digital Edition
              </button>
            )}
          </div>

          {/* Right Column: Description + Independent Service Tabs + Reviews */}
          <div className="md:col-span-7 space-y-6">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Synopsis & Notes</h3>
              <p className="text-sm text-[#303846] leading-relaxed">{book.description}</p>
            </div>

            {/* Service Action Selector */}
            <div className="bg-[#F5F7FA] border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap gap-1.5 p-1 bg-white border border-slate-200 rounded-lg">
                {book.allow_buy === 1 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('buy')}
                    className={`flex-1 min-w-[90px] py-2 px-3 text-xs font-semibold rounded-md inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                      activeTab === 'buy' ? 'bg-[#142B45] text-white' : 'text-slate-600 hover:text-[#142B45]'
                    }`}
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    Buy ({formatINR(book.price)})
                  </button>
                )}
                {book.allow_exchange === 1 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('exchange')}
                    className={`flex-1 min-w-[90px] py-2 px-3 text-xs font-semibold rounded-md inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                      activeTab === 'exchange' ? 'bg-[#142B45] text-white' : 'text-slate-600 hover:text-[#142B45]'
                    }`}
                  >
                    <Repeat className="w-3.5 h-3.5" />
                    Exchange
                  </button>
                )}
                {book.allow_borrow === 1 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('borrow')}
                    className={`flex-1 min-w-[90px] py-2 px-3 text-xs font-semibold rounded-md inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                      activeTab === 'borrow' ? 'bg-[#142B45] text-white' : 'text-slate-600 hover:text-[#142B45]'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    Borrow
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveTab('message')}
                  className={`flex-1 min-w-[90px] py-2 px-3 text-xs font-semibold rounded-md inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                    activeTab === 'message' ? 'bg-[#142B45] text-white' : 'text-slate-600 hover:text-[#142B45]'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  Message Owner
                </button>
              </div>

              {activeTab === 'buy' && book.allow_buy === 1 && (
                <div className="space-y-4">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-2xl font-bold font-mono-num text-[#142B45]">
                        {formatINR(book.price)}
                      </span>
                      <span className="text-xs text-slate-500 ml-2">Physical copy · {book.condition}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <label htmlFor="qty-select" className="text-xs text-slate-600">
                        Qty
                      </label>
                      <select
                        id="qty-select"
                        value={qty}
                        onChange={(e) => setQty(Number(e.target.value))}
                        className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-md text-sm font-mono-num"
                      >
                        {Array.from({ length: Math.min(5, Math.max(1, book.stock)) }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={book.stock < 1 || Boolean(isOwnListing)}
                    onClick={() => {
                      onAddToCart(book, qty);
                      onClose();
                    }}
                    className="w-full py-2.5 px-4 bg-[#142B45] hover:bg-[#1d3b5e] disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors"
                  >
                    {isOwnListing
                      ? 'This is your own listing'
                      : book.stock < 1
                        ? 'Currently Out of Stock'
                        : `Add to Bag · ${formatINR(Number(book.price) * qty)}`}
                  </button>
                </div>
              )}

              {activeTab === 'exchange' && book.allow_exchange === 1 && (
                <form onSubmit={handleExchangeSubmit} className="space-y-3">
                  <p className="text-xs text-slate-600">
                    Propose swapping one of your listed books or another volume in your personal collection.
                  </p>
                  {myBooks.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-[#142B45] mb-1">
                        Select from your listed books (optional)
                      </label>
                      <select
                        value={offeredBookId}
                        onChange={(e) => {
                          setOfferedBookId(e.target.value);
                          const found = myBooks.find((b) => String(b.id) === e.target.value);
                          if (found) {
                            setOfferedTitle(found.title);
                            setOfferedCondition(found.condition);
                          }
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                      >
                        <option value="">-- Or enter a book title manually below --</option>
                        {myBooks.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.title} ({b.condition})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-[#142B45] mb-1">Book You Offer</label>
                      <input
                        type="text"
                        required
                        value={offeredTitle}
                        onChange={(e) => setOfferedTitle(e.target.value)}
                        placeholder="e.g. Clean Code by Robert Martin"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#142B45] mb-1">Condition</label>
                      <select
                        value={offeredCondition}
                        onChange={(e) => setOfferedCondition(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                      >
                        <option>New</option>
                        <option>Like New</option>
                        <option>Good</option>
                        <option>Fair</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#142B45] mb-1">Pickup / Meetup Note</label>
                    <input
                      type="text"
                      value={exchangeNote}
                      onChange={(e) => setExchangeNote(e.target.value)}
                      placeholder="Suggest campus reading hall or local handoff time"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submitting || Boolean(isOwnListing)}
                    className="w-full py-2.5 px-4 bg-[#19A68C] hover:bg-[#158c76] disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors"
                  >
                    {isOwnListing ? 'Own Listing' : submitting ? 'Sending Proposal...' : 'Send Exchange Proposal'}
                  </button>
                </form>
              )}

              {activeTab === 'borrow' && book.allow_borrow === 1 && (
                <form onSubmit={handleBorrowSubmit} className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Lending Deposit / Fee</span>
                    <span className="font-mono-num font-bold text-[#142B45]">
                      {formatINR(book.borrow_fee)}
                    </span>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#142B45] mb-1">Borrowing Duration</label>
                    <select
                      value={borrowDays}
                      onChange={(e) => setBorrowDays(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                    >
                      <option value={7}>7 Days (1 Week)</option>
                      <option value={14}>14 Days (Standard 2 Weeks)</option>
                      <option value={21}>21 Days (3 Weeks)</option>
                      <option value={30}>30 Days (Academic Month)</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={submitting || Boolean(isOwnListing)}
                    className="w-full py-2.5 px-4 bg-[#142B45] hover:bg-[#1d3b5e] disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors"
                  >
                    {isOwnListing ? 'Own Listing' : submitting ? 'Submitting...' : 'Request Book Borrow'}
                  </button>
                </form>
              )}

              {activeTab === 'message' && (
                <form onSubmit={handleMessageSubmit} className="space-y-3">
                  <label className="block text-xs font-medium text-[#142B45]">
                    Direct Message to {book.owner_name}
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={messageBody}
                    onChange={(e) => setMessageBody(e.target.value)}
                    placeholder="Ask about edition year, annotations, or pickup availability..."
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                  />
                  <button
                    type="submit"
                    disabled={submitting || Boolean(isOwnListing)}
                    className="w-full py-2.5 px-4 bg-[#142B45] hover:bg-[#1d3b5e] disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors"
                  >
                    {isOwnListing ? 'You own this listing' : submitting ? 'Sending...' : 'Send Message'}
                  </button>
                </form>
              )}
            </div>

            {/* Community Reviews */}
            <div className="border-t border-slate-200 pt-5 space-y-4">
              <h3 className="text-sm font-semibold text-[#142B45]">
                Reader Reviews ({reviews.length})
              </h3>

              <form onSubmit={handleReviewSubmit} className="flex flex-col sm:flex-row gap-2">
                <select
                  value={reviewRating}
                  onChange={(e) => setReviewRating(Number(e.target.value))}
                  aria-label="Rating"
                  className="px-3 py-2 bg-[#F5F7FA] border border-slate-200 rounded-lg text-sm"
                >
                  <option value={5}>5 Stars</option>
                  <option value={4}>4 Stars</option>
                  <option value={3}>3 Stars</option>
                  <option value={2}>2 Stars</option>
                  <option value={1}>1 Star</option>
                </select>
                <input
                  type="text"
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Share your experience with this edition..."
                  className="flex-1 px-3 py-2 bg-[#F5F7FA] border border-slate-200 rounded-lg text-sm"
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-[#142B45] text-white text-xs font-semibold rounded-lg hover:bg-[#1d3b5e] whitespace-nowrap"
                >
                  Post Review
                </button>
              </form>

              <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                {reviews.length === 0 ? (
                  <p className="text-xs text-slate-500">No reader reviews yet. Be the first to review this book.</p>
                ) : (
                  reviews.map((rev) => (
                    <div key={rev.id} className="border-b border-slate-100 pb-3 last:border-none">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#142B45]">{rev.user_name || 'Verified Reader'}</span>
                        <span className="font-mono-num text-amber-600">{rev.rating}/5</span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">{rev.comment}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
