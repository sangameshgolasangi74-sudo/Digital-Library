import { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Book, CartItem, Category, ToastMessage, User, UserRole } from './types';
import { apiRequest, setStoredSessionToken } from './lib/api';
import { Navbar, AppView } from './components/Navbar';
import { HomePage } from './components/HomePage';
import { ExplorePage } from './components/ExplorePage';
import { DigitalLibraryPage } from './components/DigitalLibraryPage';
import { ExchangePage } from './components/ExchangePage';
import { AboutPage, ContactPage } from './components/AboutContactPages';
import { Footer } from './components/Footer';
import { BookDetailModal } from './components/BookDetailModal';
import { DigitalReaderModal } from './components/DigitalReaderModal';
import { CartDrawer } from './components/CartDrawer';
import { AuthModal } from './components/AuthModal';
import { ToastContainer } from './components/ToastContainer';
import { CustomerDashboard } from './components/dashboards/CustomerDashboard';
import { OwnerDashboard } from './components/dashboards/OwnerDashboard';
import { AdminDashboard } from './components/dashboards/AdminDashboard';

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>('home');
  const [exploreQuery, setExploreQuery] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [activePortal, setActivePortal] = useState<UserRole>('customer');

  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [publicStats, setPublicStats] = useState({ books: 0, users: 0, digital: 0, exchanges: 0 });
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const [wishlistIds, setWishlistIds] = useState<Set<number>>(new Set());
  const [progressMap, setProgressMap] = useState<Record<number, number>>({});
  const [cart, setCart] = useState<CartItem[]>([]);

  // Modal & Drawer state
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [readerState, setReaderState] = useState<{ book: Book; chapter: number } | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [authModal, setAuthModal] = useState<{ open: boolean; mode: 'login' | 'register' }>({
    open: false,
    mode: 'login'
  });
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const notify = useCallback(
    (title: string, description?: string, variant: 'success' | 'error' | 'info' = 'success') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, title, description, variant }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4200);
    },
    []
  );

  const loadCatalog = useCallback(async () => {
    try {
      const [bRes, cRes, sRes] = await Promise.all([
        apiRequest<{ books: Book[] }>('/api/books'),
        apiRequest<{ categories: Category[] }>('/api/categories'),
        apiRequest<{ stats: typeof publicStats; settings: Record<string, string> }>('/api/stats/public')
      ]);
      setBooks(bRes.books || []);
      setCategories(cRes.categories || []);
      setPublicStats(sRes.stats);
      setSettings(sRes.settings || {});
    } catch {
      // handled silently on initial boot
    }
  }, []);

  const loadUserContext = useCallback(async (u: User | null) => {
    if (!u) {
      setWishlistIds(new Set());
      setProgressMap({});
      return;
    }
    try {
      const [wl, prog] = await Promise.all([
        apiRequest<{ books: Book[] }>('/api/wishlist'),
        apiRequest<{ progress: { book_id: number; chapter_index: number }[] }>('/api/digital/progress')
      ]);
      setWishlistIds(new Set((wl.books || []).map((b) => b.id)));
      const map: Record<number, number> = {};
      for (const p of prog.progress || []) map[p.book_id] = p.chapter_index;
      setProgressMap(map);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadCatalog();
    apiRequest<{ user: User | null }>('/api/auth/me')
      .then((res) => {
        if (res.user) {
          setUser(res.user);
          setActivePortal(res.user.role);
          loadUserContext(res.user);
        }
      })
      .catch(() => {});
  }, [loadCatalog, loadUserContext]);

  const handleToggleWishlist = async (bookId: number) => {
    if (!user) {
      setAuthModal({ open: true, mode: 'login' });
      return;
    }
    try {
      const res = await apiRequest<{ saved: boolean }>(`/api/wishlist/${bookId}`, { method: 'POST' });
      setWishlistIds((prev) => {
        const next = new Set(prev);
        if (res.saved) next.add(bookId);
        else next.delete(bookId);
        return next;
      });
      notify(res.saved ? 'Saved to wishlist' : 'Removed from wishlist');
    } catch (err) {
      notify('Wishlist error', err instanceof Error ? err.message : 'Unable to update', 'error');
    }
  };

  const handleAddToCart = (book: Book, qty: number) => {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.book.id === book.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          quantity: Math.min(book.stock, updated[idx].quantity + qty)
        };
        return updated;
      }
      return [...prev, { book, quantity: qty }];
    });
    setCartOpen(true);
    notify('Added to bag', `${book.title} (${qty}x)`);
  };

  const handleLogout = async () => {
    await apiRequest('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setStoredSessionToken(null);
    setUser(null);
    setActivePortal('customer');
    setWishlistIds(new Set());
    setCurrentView('home');
    notify('Signed out safely');
  };

  const handleNavigate = (view: AppView) => {
    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F7FA] text-[#303846]">
      {settings.announcement_banner && !bannerDismissed && currentView !== 'dashboard' && (
        <div className="bg-[#142B45] text-white text-xs px-4 py-2 flex items-center justify-center relative">
          <span className="truncate pr-6">{settings.announcement_banner}</span>
          <button
            type="button"
            onClick={() => setBannerDismissed(true)}
            aria-label="Dismiss announcement"
            className="absolute right-3 p-1 text-slate-300 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <Navbar
        currentView={currentView}
        onNavigate={handleNavigate}
        user={user}
        cartCount={cartCount}
        onOpenCart={() => setCartOpen(true)}
        onOpenAuth={(mode = 'login') => setAuthModal({ open: true, mode })}
      />

      <div className="flex-1">
        {currentView === 'home' && (
          <HomePage
            books={books}
            categories={categories}
            wishlistIds={wishlistIds}
            publicStats={publicStats}
            onSearchSubmit={(q) => {
              setExploreQuery(q);
              handleNavigate('explore');
            }}
            onNavigate={handleNavigate}
            onSelectBook={(b) => setSelectedBook(b)}
            onToggleWishlist={handleToggleWishlist}
            onOpenReader={(b) => setReaderState({ book: b, chapter: progressMap[b.id] || 0 })}
            onOpenAuth={(mode = 'register') => setAuthModal({ open: true, mode })}
            onNotify={notify}
          />
        )}

        {currentView === 'explore' && (
          <ExplorePage
            books={books}
            categories={categories}
            wishlistIds={wishlistIds}
            initialQuery={exploreQuery}
            onSelectBook={(b) => setSelectedBook(b)}
            onToggleWishlist={handleToggleWishlist}
          />
        )}

        {currentView === 'digital' && (
          <DigitalLibraryPage
            books={books}
            progressMap={progressMap}
            onOpenReader={(b, ch) => setReaderState({ book: b, chapter: ch ?? progressMap[b.id] ?? 0 })}
            onSelectBook={(b) => setSelectedBook(b)}
          />
        )}

        {currentView === 'exchange' && (
          <ExchangePage
            books={books}
            wishlistIds={wishlistIds}
            onSelectBook={(b) => setSelectedBook(b)}
            onToggleWishlist={handleToggleWishlist}
          />
        )}

        {currentView === 'about' && <AboutPage />}

        {currentView === 'contact' && (
          <ContactPage user={user} settings={settings} onNotify={notify} />
        )}

        {currentView === 'dashboard' && user && (
          <>
            {activePortal === 'admin' && user.role === 'admin' && (
              <AdminDashboard
                user={user}
                onBooksChanged={loadCatalog}
                onSwitchPortal={(r) => setActivePortal(r)}
                onLogout={handleLogout}
                onBackToStorefront={() => handleNavigate('home')}
                onNotify={notify}
              />
            )}
            {activePortal === 'owner' && (
              <OwnerDashboard
                user={user}
                categories={categories}
                onBooksChanged={loadCatalog}
                onSwitchPortal={(r) => setActivePortal(r)}
                onLogout={handleLogout}
                onBackToStorefront={() => handleNavigate('home')}
                onNotify={notify}
              />
            )}
            {activePortal === 'customer' && (
              <CustomerDashboard
                user={user}
                books={books}
                wishlistIds={wishlistIds}
                onSelectBook={(b) => setSelectedBook(b)}
                onToggleWishlist={handleToggleWishlist}
                onOpenReader={(b, ch) => setReaderState({ book: b, chapter: ch ?? progressMap[b.id] ?? 0 })}
                onSwitchPortal={(r) => setActivePortal(r)}
                onUserUpdated={(u) => setUser(u)}
                onLogout={handleLogout}
                onBackToStorefront={() => handleNavigate('home')}
                onNotify={notify}
              />
            )}
          </>
        )}
      </div>

      {currentView !== 'dashboard' && (
        <Footer
          settings={settings}
          onNavigate={handleNavigate}
          onOpenAuth={(mode = 'login') => setAuthModal({ open: true, mode })}
        />
      )}

      <BookDetailModal
        book={selectedBook}
        user={user}
        isWishlisted={selectedBook ? wishlistIds.has(selectedBook.id) : false}
        onClose={() => setSelectedBook(null)}
        onAddToCart={handleAddToCart}
        onToggleWishlist={handleToggleWishlist}
        onOpenReader={(b) => {
          setSelectedBook(null);
          setReaderState({ book: b, chapter: progressMap[b.id] || 0 });
        }}
        onRequireAuth={() => setAuthModal({ open: true, mode: 'login' })}
        onNotify={notify}
      />

      <DigitalReaderModal
        book={readerState?.book || null}
        user={user}
        initialChapter={readerState?.chapter || 0}
        onClose={() => setReaderState(null)}
        onProgressSaved={(bookId, ch) =>
          setProgressMap((prev) => ({ ...prev, [bookId]: ch }))
        }
      />

      <CartDrawer
        open={cartOpen}
        items={cart}
        user={user}
        onClose={() => setCartOpen(false)}
        onUpdateQty={(bookId, qty) =>
          setCart((prev) => prev.map((i) => (i.book.id === bookId ? { ...i, quantity: qty } : i)))
        }
        onRemove={(bookId) => setCart((prev) => prev.filter((i) => i.book.id !== bookId))}
        onClearCart={() => setCart([])}
        onRequireAuth={() => setAuthModal({ open: true, mode: 'login' })}
        onOrderComplete={() => loadCatalog()}
        onNotify={notify}
      />

      <AuthModal
        open={authModal.open}
        initialMode={authModal.mode}
        onClose={() => setAuthModal((prev) => ({ ...prev, open: false }))}
        onSuccess={(authedUser, portal) => {
          setUser(authedUser);
          setActivePortal(portal);
          loadUserContext(authedUser);
          setCurrentView('dashboard');
        }}
        onNotify={notify}
      />

      <ToastContainer
        toasts={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />
    </div>
  );
}
