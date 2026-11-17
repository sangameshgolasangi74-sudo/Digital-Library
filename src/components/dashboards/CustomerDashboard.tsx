import { useEffect, useState } from 'react';
import { BookOpen, Send, Check } from 'lucide-react';
import {
  Book,
  Borrowing,
  ExchangeRequest,
  Message,
  NotificationItem,
  Order,
  Review,
  User,
  UserRole
} from '../../types';
import { apiRequest } from '../../lib/api';
import { formatINR } from '../../lib/formatCurrency';
import { DashboardShell, SidebarNavItem } from './DashboardShell';
import { BookCard } from '../BookCard';

interface CustomerDashboardProps {
  user: User;
  books: Book[];
  wishlistIds: Set<number>;
  onSelectBook: (book: Book) => void;
  onToggleWishlist: (bookId: number) => void;
  onOpenReader: (book: Book, chapter?: number) => void;
  onSwitchPortal: (role: UserRole) => void;
  onUserUpdated: (user: User) => void;
  onLogout: () => void;
  onBackToStorefront: () => void;
  onNotify: (title: string, description?: string, variant?: 'success' | 'error' | 'info') => void;
}

export function CustomerDashboard({
  user,
  books,
  wishlistIds,
  onSelectBook,
  onToggleWishlist,
  onOpenReader,
  onSwitchPortal,
  onUserUpdated,
  onLogout,
  onBackToStorefront,
  onNotify
}: CustomerDashboardProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [orders, setOrders] = useState<Order[]>([]);
  const [exchanges, setExchanges] = useState<ExchangeRequest[]>([]);
  const [borrowings, setBorrowings] = useState<Borrowing[]>([]);
  const [wishlistBooks, setWishlistBooks] = useState<Book[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [progressMap, setProgressMap] = useState<Record<number, number>>({});
  const [browseQuery, setBrowseQuery] = useState('');

  // Reply message state
  const [replyReceiverId, setReplyReceiverId] = useState<number | null>(null);
  const [replyBody, setReplyBody] = useState('');

  // Account settings state
  const [profileForm, setProfileForm] = useState({
    name: user.name,
    phone: user.phone,
    address: user.address,
    institution: user.institution,
    bio: user.bio
  });
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const loadData = async () => {
    try {
      const [ord, ex, br, wl, msg, notif, rev, prog] = await Promise.all([
        apiRequest<{ orders: Order[] }>('/api/orders/my'),
        apiRequest<{ exchanges: ExchangeRequest[] }>('/api/exchanges/my'),
        apiRequest<{ borrowings: Borrowing[] }>('/api/borrowings/my'),
        apiRequest<{ books: Book[] }>('/api/wishlist'),
        apiRequest<{ messages: Message[] }>('/api/messages'),
        apiRequest<{ notifications: NotificationItem[] }>('/api/notifications'),
        apiRequest<{ reviews: Review[] }>('/api/reviews/my'),
        apiRequest<{ progress: { book_id: number; chapter_index: number }[] }>('/api/digital/progress')
      ]);
      setOrders(ord.orders || []);
      setExchanges(ex.exchanges || []);
      setBorrowings(br.borrowings || []);
      setWishlistBooks(wl.books || []);
      setMessages(msg.messages || []);
      setNotifications(notif.notifications || []);
      setReviews(rev.reviews || []);
      const pMap: Record<number, number> = {};
      for (const p of prog.progress || []) pMap[p.book_id] = p.chapter_index;
      setProgressMap(pMap);
    } catch {
      // handled silently
    }
  };

  useEffect(() => {
    loadData();
  }, [user.id]);

  const unreadNotifications = notifications.filter((n) => n.is_read === 0).length;

  const navItems: SidebarNavItem[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'browse', label: 'Browse & Search' },
    { id: 'digital', label: 'Digital Reading Library' },
    { id: 'wishlist', label: 'Wishlist', badge: wishlistBooks.length },
    { id: 'orders', label: 'My Orders', badge: orders.length },
    { id: 'exchanges', label: 'Exchange Requests', badge: exchanges.length },
    { id: 'borrowings', label: 'Borrowing History', badge: borrowings.length },
    { id: 'messages', label: 'Messages', badge: messages.length },
    { id: 'notifications', label: 'Notifications', badge: unreadNotifications },
    { id: 'reviews', label: 'My Reviews' },
    { id: 'settings', label: 'Account Settings' }
  ];

  const handleMarkNotificationsRead = async () => {
    await apiRequest('/api/notifications/read', { method: 'PATCH' });
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
    onNotify('Notifications marked read');
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyReceiverId || !replyBody.trim()) return;
    try {
      await apiRequest('/api/messages', {
        method: 'POST',
        body: JSON.stringify({ receiverId: replyReceiverId, body: replyBody })
      });
      setReplyBody('');
      setReplyReceiverId(null);
      await loadData();
      onNotify('Reply sent');
    } catch (err) {
      onNotify('Send failed', err instanceof Error ? err.message : 'Error', 'error');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest<{ user: User }>('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify(profileForm)
      });
      onUserUpdated(res.user);
      onNotify('Profile saved', 'Your customer details have been updated.');
    } catch (err) {
      onNotify('Update failed', err instanceof Error ? err.message : 'Error', 'error');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/auth/password', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword, newPassword })
      });
      setCurrentPassword('');
      setNewPassword('');
      onNotify('Password updated');
    } catch (err) {
      onNotify('Password update failed', err instanceof Error ? err.message : 'Error', 'error');
    }
  };

  const digitalBooks = books.filter((b) => b.is_digital === 1);
  const filteredBrowse = books.filter((b) => {
    if (!browseQuery.trim()) return true;
    const q = browseQuery.toLowerCase();
    return `${b.title} ${b.author} ${b.isbn} ${b.category_name}`.toLowerCase().includes(q);
  });

  return (
    <DashboardShell
      user={user}
      activePortal="customer"
      activeTab={activeTab}
      navItems={navItems}
      onSelectTab={setActiveTab}
      onSwitchPortal={onSwitchPortal}
      onLogout={onLogout}
      onBackToStorefront={onBackToStorefront}
    >
      {activeTab === 'overview' && (
        <div className="space-y-8">
          <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-bold text-[#142B45]">
                Welcome back, {user.name}
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                {user.institution || 'Digital Library Member'} <span aria-hidden="true">·</span> {user.email}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('browse')}
              className="px-4 py-2 bg-[#19A68C] hover:bg-[#158c76] text-white text-xs font-semibold rounded-lg whitespace-nowrap"
            >
              Browse New Books
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs text-slate-500">Orders Placed</p>
              <p className="font-mono-num text-2xl font-bold text-[#142B45] mt-1">{orders.length}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs text-slate-500">Exchange Proposals</p>
              <p className="font-mono-num text-2xl font-bold text-[#142B45] mt-1">{exchanges.length}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs text-slate-500">Active &amp; Past Borrows</p>
              <p className="font-mono-num text-2xl font-bold text-[#142B45] mt-1">{borrowings.length}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs text-slate-500">Saved Wishlist</p>
              <p className="font-mono-num text-2xl font-bold text-[#142B45] mt-1">{wishlistBooks.length}</p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-[#142B45]">Recent Borrowing &amp; Exchange Activity</h2>
            <div className="divide-y divide-slate-100 text-sm">
              {borrowings.slice(0, 3).map((b) => (
                <div key={b.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-[#142B45] truncate">Borrow: {b.book_title}</p>
                    <p className="text-xs text-slate-500">Due {b.due_date} · Owner: {b.owner_name}</p>
                  </div>
                  <span className="text-xs font-semibold capitalize text-[#19A68C]">{b.status}</span>
                </div>
              ))}
              {exchanges.slice(0, 2).map((ex) => (
                <div key={ex.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-[#142B45] truncate">
                      Swap: {ex.offered_title} &rarr; {ex.requested_book_title}
                    </p>
                    <p className="text-xs text-slate-500">Owner: {ex.owner_name}</p>
                  </div>
                  <span className="text-xs font-semibold capitalize text-[#142B45]">{ex.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'browse' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h1 className="font-display text-2xl font-bold text-[#142B45]">Browse Catalog</h1>
            <input
              type="text"
              value={browseQuery}
              onChange={(e) => setBrowseQuery(e.target.value)}
              placeholder="Filter by title, author, ISBN..."
              className="px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm w-full sm:w-72"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBrowse.map((book) => (
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
      )}

      {activeTab === 'digital' && (
        <div className="space-y-6">
          <h1 className="font-display text-2xl font-bold text-[#142B45]">Digital Reading Library</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {digitalBooks.map((book) => {
              const savedCh = progressMap[book.id] || 0;
              return (
                <div key={book.id} className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500">{book.category_name}</p>
                    <h3 className="text-sm font-semibold text-[#142B45] truncate mt-0.5">{book.title}</h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {book.author} · Section {savedCh + 1} of {book.digital_chapters?.length || 1}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenReader(book, savedCh)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#19A68C] text-white text-xs font-semibold rounded-lg shrink-0"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    Read
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'wishlist' && (
        <div className="space-y-6">
          <h1 className="font-display text-2xl font-bold text-[#142B45]">Saved Wishlist</h1>
          {wishlistBooks.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-600">
              Your wishlist is empty. Save books while browsing to track prices and availability.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {wishlistBooks.map((book) => (
                <BookCard
                  key={book.id}
                  book={book}
                  isWishlisted={true}
                  onToggleWishlist={async (id) => {
                    await onToggleWishlist(id);
                    loadData();
                  }}
                  onSelect={onSelectBook}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="space-y-4">
          <h1 className="font-display text-2xl font-bold text-[#142B45]">My Purchase Orders</h1>
          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F5F7FA] border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-3 px-4 font-semibold">Order</th>
                  <th className="py-3 px-4 font-semibold">Book Title</th>
                  <th className="py-3 px-4 font-semibold">Seller</th>
                  <th className="py-3 px-4 font-semibold text-right">Amount</th>
                  <th className="py-3 px-4 font-semibold">Payment</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No orders placed yet.
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => (
                    <tr key={o.id} className="hover:bg-[#F5F7FA]/60">
                      <td className="py-3 px-4 font-mono-num font-semibold text-[#142B45]">#{o.id}</td>
                      <td className="py-3 px-4 font-medium text-[#142B45]">{o.book_title}</td>
                      <td className="py-3 px-4 text-slate-600">{o.owner_name}</td>
                      <td className="py-3 px-4 font-mono-num text-right font-semibold">{formatINR(o.total_amount)}</td>
                      <td className="py-3 px-4 text-slate-600">{o.payment_method} ({o.payment_status})</td>
                      <td className="py-3 px-4 font-semibold capitalize text-[#19A68C]">{o.order_status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'exchanges' && (
        <div className="space-y-4">
          <h1 className="font-display text-2xl font-bold text-[#142B45]">My Exchange Requests</h1>
          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F5F7FA] border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-3 px-4 font-semibold">Requested Book</th>
                  <th className="py-3 px-4 font-semibold">Your Offered Book</th>
                  <th className="py-3 px-4 font-semibold">Owner</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {exchanges.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500">No exchange proposals sent yet.</td>
                  </tr>
                ) : (
                  exchanges.map((ex) => (
                    <tr key={ex.id}>
                      <td className="py-3 px-4 font-medium text-[#142B45]">{ex.requested_book_title}</td>
                      <td className="py-3 px-4 text-slate-600">{ex.offered_title} ({ex.offered_condition})</td>
                      <td className="py-3 px-4 text-slate-600">{ex.owner_name}</td>
                      <td className="py-3 px-4 font-semibold capitalize text-[#142B45]">{ex.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'borrowings' && (
        <div className="space-y-4">
          <h1 className="font-display text-2xl font-bold text-[#142B45]">My Borrowing History</h1>
          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F5F7FA] border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-3 px-4 font-semibold">Book Title</th>
                  <th className="py-3 px-4 font-semibold">Owner</th>
                  <th className="py-3 px-4 font-semibold font-mono-num">Duration</th>
                  <th className="py-3 px-4 font-semibold font-mono-num">Due Date</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {borrowings.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">No borrowing records yet.</td>
                  </tr>
                ) : (
                  borrowings.map((br) => (
                    <tr key={br.id}>
                      <td className="py-3 px-4 font-medium text-[#142B45]">{br.book_title}</td>
                      <td className="py-3 px-4 text-slate-600">{br.owner_name}</td>
                      <td className="py-3 px-4 font-mono-num">{br.duration_days} days</td>
                      <td className="py-3 px-4 font-mono-num">{br.due_date}</td>
                      <td className="py-3 px-4 font-semibold capitalize text-[#19A68C]">{br.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'messages' && (
        <div className="space-y-6">
          <h1 className="font-display text-2xl font-bold text-[#142B45]">Messages</h1>
          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
            {messages.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500">No messages yet.</p>
            ) : (
              messages.map((m) => {
                const isSender = m.sender_id === user.id;
                const peerId = isSender ? m.receiver_id : m.sender_id;
                const peerName = isSender ? m.receiver_name : m.sender_name;
                return (
                  <div key={m.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-xs text-slate-500">
                        {isSender ? `To ${peerName}` : `From ${peerName}`}
                        {m.book_title ? ` · Re: ${m.book_title}` : ''}
                      </p>
                      <p className="text-sm text-[#142B45]">{m.body}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplyReceiverId(peerId)}
                      className="px-3 py-1.5 text-xs font-semibold text-[#142B45] bg-[#F5F7FA] border border-slate-200 rounded-lg shrink-0"
                    >
                      Reply
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {replyReceiverId && (
            <form onSubmit={handleSendReply} className="bg-white border border-slate-200 rounded-xl p-4 flex gap-2">
              <input
                type="text"
                required
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                placeholder="Write your reply..."
                className="flex-1 px-3 py-2 bg-[#F5F7FA] border border-slate-200 rounded-lg text-sm"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#142B45] text-white text-xs font-semibold rounded-lg"
              >
                <Send className="w-3.5 h-3.5" />
                Send
              </button>
            </form>
          )}
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="font-display text-2xl font-bold text-[#142B45]">Notifications</h1>
            <button
              type="button"
              onClick={handleMarkNotificationsRead}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg text-[#142B45]"
            >
              <Check className="w-3.5 h-3.5 text-[#19A68C]" />
              Mark All Read
            </button>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500">All caught up.</p>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className={`p-4 ${n.is_read === 0 ? 'bg-[#19A68C]/5' : ''}`}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-[#142B45]">{n.title}</p>
                    <span className="text-[11px] font-mono-num text-slate-400">{n.created_at.slice(0, 10)}</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">{n.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'reviews' && (
        <div className="space-y-4">
          <h1 className="font-display text-2xl font-bold text-[#142B45]">My Reviews &amp; Ratings</h1>
          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
            {reviews.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500">You have not posted any book reviews yet.</p>
            ) : (
              reviews.map((r) => (
                <div key={r.id} className="p-4 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#142B45]">{r.book_title}</span>
                    <span className="font-mono-num text-amber-600 font-semibold">{r.rating}/5</span>
                  </div>
                  <p className="text-xs text-slate-600">{r.comment}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form onSubmit={handleSaveProfile} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-[#142B45]">Profile Information</h2>
            <div>
              <label className="block text-xs font-medium text-[#142B45] mb-1">Full Name</label>
              <input
                type="text"
                required
                value={profileForm.name}
                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                className="w-full px-3 py-2 bg-[#F5F7FA] border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#142B45] mb-1">Phone</label>
              <input
                type="text"
                value={profileForm.phone}
                onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                className="w-full px-3 py-2 bg-[#F5F7FA] border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#142B45] mb-1">Address</label>
              <input
                type="text"
                value={profileForm.address}
                onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                className="w-full px-3 py-2 bg-[#F5F7FA] border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#142B45] mb-1">Institution / Hub</label>
              <input
                type="text"
                value={profileForm.institution}
                onChange={(e) => setProfileForm({ ...profileForm, institution: e.target.value })}
                className="w-full px-3 py-2 bg-[#F5F7FA] border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#142B45] mb-1">Reader Bio</label>
              <textarea
                rows={3}
                value={profileForm.bio}
                onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                className="w-full px-3 py-2 bg-[#F5F7FA] border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <button type="submit" className="px-5 py-2.5 bg-[#142B45] text-white text-xs font-semibold rounded-lg">
              Save Profile
            </button>
          </form>

          <form onSubmit={handleChangePassword} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 h-fit">
            <h2 className="font-display text-lg font-bold text-[#142B45]">Update Password</h2>
            <div>
              <label className="block text-xs font-medium text-[#142B45] mb-1">Current Password</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 bg-[#F5F7FA] border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#142B45] mb-1">New Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 bg-[#F5F7FA] border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <button type="submit" className="px-5 py-2.5 bg-[#19A68C] text-white text-xs font-semibold rounded-lg">
              Update Password
            </button>
          </form>
        </div>
      )}
    </DashboardShell>
  );
}
