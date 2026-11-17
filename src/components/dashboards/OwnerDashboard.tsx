import { useEffect, useState } from 'react';
import { Upload, Trash2, Plus, Send } from 'lucide-react';
import {
  Book,
  Borrowing,
  Category,
  ExchangeRequest,
  Message,
  Order,
  User,
  UserRole
} from '../../types';
import { apiRequest } from '../../lib/api';
import { COVER_PRESET_OPTIONS, resolveCoverUrl } from '../../lib/coverAssets';
import { formatINR } from '../../lib/formatCurrency';
import { DashboardShell, SidebarNavItem } from './DashboardShell';

interface OwnerDashboardProps {
  user: User;
  categories: Category[];
  onBooksChanged: () => void;
  onSwitchPortal: (role: UserRole) => void;
  onLogout: () => void;
  onBackToStorefront: () => void;
  onNotify: (title: string, description?: string, variant?: 'success' | 'error' | 'info') => void;
}

export function OwnerDashboard({
  user,
  categories,
  onBooksChanged,
  onSwitchPortal,
  onLogout,
  onBackToStorefront,
  onNotify
}: OwnerDashboardProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [myBooks, setMyBooks] = useState<Book[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [exchanges, setExchanges] = useState<ExchangeRequest[]>([]);
  const [borrowings, setBorrowings] = useState<Borrowing[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);

  // Add Book Form
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [isbn, setIsbn] = useState('');
  const [categoryId, setCategoryId] = useState<string>(categories[0]?.id ? String(categories[0].id) : '1');
  const [condition, setCondition] = useState<'New' | 'Like New' | 'Good' | 'Fair'>('Like New');
  const [price, setPrice] = useState('450');
  const [borrowFee, setBorrowFee] = useState('50');
  const [stock, setStock] = useState('1');
  const [description, setDescription] = useState('');
  const [allowBuy, setAllowBuy] = useState(true);
  const [allowExchange, setAllowExchange] = useState(true);
  const [allowBorrow, setAllowBorrow] = useState(true);
  const [isDigital, setIsDigital] = useState(false);
  const [digitalText, setDigitalText] = useState('');
  const [coverUrl, setCoverUrl] = useState('cover_algorithms');
  const [submitting, setSubmitting] = useState(false);

  // Reply state
  const [replyReceiverId, setReplyReceiverId] = useState<number | null>(null);
  const [replyBody, setReplyBody] = useState('');

  const loadOwnerData = async () => {
    try {
      const [bRes, oRes, eRes, brRes, mRes] = await Promise.all([
        apiRequest<{ books: Book[] }>('/api/owner/books'),
        apiRequest<{ orders: Order[] }>('/api/owner/orders'),
        apiRequest<{ exchanges: ExchangeRequest[] }>('/api/owner/exchanges'),
        apiRequest<{ borrowings: Borrowing[] }>('/api/owner/borrowings'),
        apiRequest<{ messages: Message[] }>('/api/messages')
      ]);
      setMyBooks(bRes.books || []);
      setOrders(oRes.orders || []);
      setExchanges(eRes.exchanges || []);
      setBorrowings(brRes.borrowings || []);
      setMessages(mRes.messages || []);
    } catch {
      // handled silently
    }
  };

  useEffect(() => {
    loadOwnerData();
  }, [user.id]);

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      onNotify('Image too large', 'Please upload a cover image smaller than 2MB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCoverUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreateBook = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiRequest('/api/owner/books', {
        method: 'POST',
        body: JSON.stringify({
          title,
          author,
          isbn,
          categoryId: Number(categoryId || categories[0]?.id || 1),
          condition,
          price: Number(price),
          borrowFee: Number(borrowFee),
          stock: Number(stock),
          description,
          allowBuy,
          allowExchange,
          allowBorrow,
          isDigital,
          digitalText,
          coverUrl
        })
      });
      onNotify('Book published', `"${title}" is now live in the Digital Library catalog.`);
      setTitle('');
      setAuthor('');
      setIsbn('');
      setDescription('');
      setDigitalText('');
      await loadOwnerData();
      onBooksChanged();
      setActiveTab('listings');
    } catch (err) {
      onNotify('Could not publish listing', err instanceof Error ? err.message : 'Error', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBook = async (bookId: number) => {
    await apiRequest(`/api/owner/books/${bookId}`, { method: 'DELETE' });
    await loadOwnerData();
    onBooksChanged();
    onNotify('Listing archived');
  };

  const handleOrderStatus = async (orderId: number, orderStatus: string) => {
    await apiRequest(`/api/owner/orders/${orderId}`, {
      method: 'PATCH',
      body: JSON.stringify({ orderStatus })
    });
    await loadOwnerData();
    onNotify(`Order #${orderId} updated to ${orderStatus}`);
  };

  const handleExchangeAction = async (exchangeId: number, status: string) => {
    await apiRequest(`/api/owner/exchanges/${exchangeId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
    await loadOwnerData();
    onNotify(`Exchange #${exchangeId} marked ${status}`);
  };

  const handleBorrowAction = async (borrowId: number, status: string) => {
    await apiRequest(`/api/owner/borrowings/${borrowId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
    await loadOwnerData();
    onNotify(`Borrowing #${borrowId} marked ${status}`);
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyReceiverId || !replyBody.trim()) return;
    await apiRequest('/api/messages', {
      method: 'POST',
      body: JSON.stringify({ receiverId: replyReceiverId, body: replyBody })
    });
    setReplyBody('');
    setReplyReceiverId(null);
    await loadOwnerData();
    onNotify('Reply delivered to customer');
  };

  const totalSales = orders
    .filter((o) => o.order_status !== 'cancelled')
    .reduce((sum, o) => sum + Number(o.total_amount), 0);

  const pendingExchanges = exchanges.filter((e) => e.status === 'pending').length;
  const activeBorrows = borrowings.filter((b) => b.status === 'active' || b.status === 'pending').length;

  const navItems: SidebarNavItem[] = [
    { id: 'overview', label: 'Owner Overview' },
    { id: 'add', label: 'Add New Book' },
    { id: 'listings', label: 'Manage Listings', badge: myBooks.length },
    { id: 'orders', label: 'Purchase Requests', badge: orders.length },
    { id: 'exchanges', label: 'Exchange Requests', badge: pendingExchanges },
    { id: 'borrowings', label: 'Borrowing & Returns', badge: activeBorrows },
    { id: 'messages', label: 'Customer Messages', badge: messages.length },
    { id: 'history', label: 'Sales & Exchange History' }
  ];

  return (
    <DashboardShell
      user={user}
      activePortal="owner"
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
              <h1 className="font-display text-2xl font-bold text-[#142B45]">Book Owner Workspace</h1>
              <p className="text-sm text-slate-600 mt-1">
                Manage your inventory, review exchange proposals, and track active physical loans.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('add')}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#142B45] text-white text-xs font-semibold rounded-lg whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              List a New Book
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs text-slate-500">Active Listings</p>
              <p className="font-mono-num text-2xl font-bold text-[#142B45] mt-1">{myBooks.length}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs text-slate-500">Total Sales Volume</p>
              <p className="font-mono-num text-2xl font-bold text-[#19A68C] mt-1">{formatINR(totalSales)}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs text-slate-500">Pending Exchanges</p>
              <p className="font-mono-num text-2xl font-bold text-[#142B45] mt-1">{pendingExchanges}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs text-slate-500">Active Loans &amp; Holds</p>
              <p className="font-mono-num text-2xl font-bold text-[#142B45] mt-1">{activeBorrows}</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'add' && (
        <form onSubmit={handleCreateBook} className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
          <h1 className="font-display text-2xl font-bold text-[#142B45]">List a New Book</h1>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 space-y-3">
              <label className="block text-xs font-semibold text-[#142B45]">Book Cover Preview</label>
              <div className="aspect-[3/4] rounded-xl overflow-hidden bg-[#F5F7FA] border border-slate-200">
                <img
                  src={resolveCoverUrl(coverUrl)}
                  alt="Book cover preview"
                  className="w-full h-full object-cover"
                />
              </div>

              <label className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-[#F5F7FA] hover:bg-slate-200/70 border border-slate-200 rounded-lg text-xs font-semibold text-[#142B45] cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                Upload Cover Image
                <input type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
              </label>

              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Or select studio cover template</label>
                <select
                  value={coverUrl.startsWith('data:') ? '' : coverUrl}
                  onChange={(e) => e.target.value && setCoverUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F5F7FA] border border-slate-200 rounded-lg text-xs"
                >
                  <option value="">Custom Uploaded Image</option>
                  {COVER_PRESET_OPTIONS.map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="lg:col-span-8 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#142B45] mb-1">Book Title</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Introduction to Distributed Databases"
                    className="w-full px-3 py-2 bg-[#F5F7FA] border border-slate-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#142B45] mb-1">Author(s)</label>
                  <input
                    type="text"
                    required
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="Dr. Elena Vance"
                    className="w-full px-3 py-2 bg-[#F5F7FA] border border-slate-200 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#142B45] mb-1">ISBN</label>
                  <input
                    type="text"
                    required
                    value={isbn}
                    onChange={(e) => setIsbn(e.target.value)}
                    placeholder="978-0-262-00001-2"
                    className="w-full px-3 py-2 bg-[#F5F7FA] border border-slate-200 rounded-lg text-sm font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#142B45] mb-1">Category</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F5F7FA] border border-slate-200 rounded-lg text-sm"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#142B45] mb-1">Condition</label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value as typeof condition)}
                    className="w-full px-3 py-2 bg-[#F5F7FA] border border-slate-200 rounded-lg text-sm"
                  >
                    <option value="New">New</option>
                    <option value="Like New">Like New</option>
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#142B45] mb-1">Sale Price (₹)</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F5F7FA] border border-slate-200 rounded-lg text-sm font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#142B45] mb-1">Borrow Fee (₹)</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={borrowFee}
                    onChange={(e) => setBorrowFee(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F5F7FA] border border-slate-200 rounded-lg text-sm font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#142B45] mb-1">Copies Available</label>
                  <input
                    type="number"
                    min="1"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F5F7FA] border border-slate-200 rounded-lg text-sm font-mono-num"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#142B45] mb-1">Description</label>
                <textarea
                  rows={3}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe edition details, highlighting status, and pickup options..."
                  className="w-full px-3 py-2 bg-[#F5F7FA] border border-slate-200 rounded-lg text-sm"
                />
              </div>

              <div className="p-4 bg-[#F5F7FA] border border-slate-200 rounded-xl space-y-3">
                <p className="text-xs font-semibold text-[#142B45]">Enabled Services</p>
                <div className="flex flex-wrap gap-5 text-xs">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={allowBuy} onChange={(e) => setAllowBuy(e.target.checked)} className="accent-[#19A68C]" />
                    Enable Selling
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={allowExchange} onChange={(e) => setAllowExchange(e.target.checked)} className="accent-[#19A68C]" />
                    Enable Exchange
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={allowBorrow} onChange={(e) => setAllowBorrow(e.target.checked)} className="accent-[#19A68C]" />
                    Enable Borrowing
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={isDigital} onChange={(e) => setIsDigital(e.target.checked)} className="accent-[#19A68C]" />
                    Open-Access Digital Edition
                  </label>
                </div>
                {isDigital && (
                  <textarea
                    rows={3}
                    value={digitalText}
                    onChange={(e) => setDigitalText(e.target.value)}
                    placeholder="Paste open-access chapter text (separate paragraphs with blank lines)..."
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs"
                  />
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 bg-[#19A68C] hover:bg-[#158c76] text-white text-sm font-semibold rounded-lg"
              >
                {submitting ? 'Publishing...' : 'Publish Book Listing'}
              </button>
            </div>
          </div>
        </form>
      )}

      {activeTab === 'listings' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="font-display text-2xl font-bold text-[#142B45]">Manage Book Listings</h1>
            <button
              type="button"
              onClick={() => setActiveTab('add')}
              className="px-3.5 py-2 bg-[#142B45] text-white text-xs font-semibold rounded-lg"
            >
              Add Book
            </button>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F5F7FA] border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-3 px-4 font-semibold">Book</th>
                  <th className="py-3 px-4 font-semibold">Condition</th>
                  <th className="py-3 px-4 font-semibold text-right">Price</th>
                  <th className="py-3 px-4 font-semibold text-right">Stock</th>
                  <th className="py-3 px-4 font-semibold">Services</th>
                  <th className="py-3 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {myBooks.map((b) => (
                  <tr key={b.id}>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-[#142B45]">{b.title}</p>
                      <p className="text-slate-500">{b.author} · {b.isbn}</p>
                    </td>
                    <td className="py-3 px-4">{b.condition}</td>
                    <td className="py-3 px-4 text-right font-mono-num">{formatINR(b.price)}</td>
                    <td className="py-3 px-4 text-right font-mono-num">{b.stock}</td>
                    <td className="py-3 px-4 text-slate-600">
                      {[b.allow_buy && 'Sell', b.allow_exchange && 'Exchange', b.allow_borrow && 'Borrow']
                        .filter(Boolean)
                        .join(' · ')}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteBook(b.id)}
                        aria-label={`Archive ${b.title}`}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="space-y-4">
          <h1 className="font-display text-2xl font-bold text-[#142B45]">Purchase Requests &amp; Orders</h1>
          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F5F7FA] border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-3 px-4 font-semibold">Order</th>
                  <th className="py-3 px-4 font-semibold">Book</th>
                  <th className="py-3 px-4 font-semibold">Customer</th>
                  <th className="py-3 px-4 font-semibold text-right">Total</th>
                  <th className="py-3 px-4 font-semibold">Fulfillment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="py-3 px-4 font-mono-num font-semibold">#{o.id}</td>
                    <td className="py-3 px-4 font-medium text-[#142B45]">{o.book_title}</td>
                    <td className="py-3 px-4">{o.buyer_name}</td>
                    <td className="py-3 px-4 text-right font-mono-num">{formatINR(o.total_amount)}</td>
                    <td className="py-3 px-4">
                      <select
                        value={o.order_status}
                        onChange={(e) => handleOrderStatus(o.id, e.target.value)}
                        className="px-2 py-1 bg-[#F5F7FA] border border-slate-200 rounded text-xs"
                      >
                        <option value="processing">Processing</option>
                        <option value="shipped">Shipped</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'exchanges' && (
        <div className="space-y-4">
          <h1 className="font-display text-2xl font-bold text-[#142B45]">Incoming Exchange Proposals</h1>
          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
            {exchanges.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500">No exchange requests received yet.</p>
            ) : (
              exchanges.map((ex) => (
                <div key={ex.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500">
                      Proposed by <strong className="text-[#142B45]">{ex.requester_name}</strong> · Status:{' '}
                      <span className="font-semibold capitalize">{ex.status}</span>
                    </p>
                    <p className="text-sm font-semibold text-[#142B45]">
                      Offering &ldquo;{ex.offered_title}&rdquo; ({ex.offered_condition}) for your &ldquo;{ex.requested_book_title}&rdquo;
                    </p>
                    {ex.note && <p className="text-xs text-slate-600">{ex.note}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {ex.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleExchangeAction(ex.id, 'accepted')}
                          className="px-3 py-1.5 bg-[#19A68C] text-white text-xs font-semibold rounded-lg"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExchangeAction(ex.id, 'rejected')}
                          className="px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 text-xs font-semibold rounded-lg"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {ex.status === 'accepted' && (
                      <button
                        type="button"
                        onClick={() => handleExchangeAction(ex.id, 'completed')}
                        className="px-3 py-1.5 bg-[#142B45] text-white text-xs font-semibold rounded-lg"
                      >
                        Mark Completed
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'borrowings' && (
        <div className="space-y-4">
          <h1 className="font-display text-2xl font-bold text-[#142B45]">Borrowing Requests &amp; Return Tracking</h1>
          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F5F7FA] border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-3 px-4 font-semibold">Book</th>
                  <th className="py-3 px-4 font-semibold">Borrower</th>
                  <th className="py-3 px-4 font-semibold font-mono-num">Due Date</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {borrowings.map((br) => (
                  <tr key={br.id}>
                    <td className="py-3 px-4 font-medium text-[#142B45]">{br.book_title}</td>
                    <td className="py-3 px-4">{br.borrower_name}</td>
                    <td className="py-3 px-4 font-mono-num">{br.due_date}</td>
                    <td className="py-3 px-4 capitalize font-semibold">{br.status}</td>
                    <td className="py-3 px-4 text-right space-x-2">
                      {br.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleBorrowAction(br.id, 'active')}
                            className="px-2.5 py-1 bg-[#19A68C] text-white rounded text-xs font-semibold"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleBorrowAction(br.id, 'rejected')}
                            className="px-2.5 py-1 bg-red-50 text-red-700 rounded text-xs font-semibold"
                          >
                            Decline
                          </button>
                        </>
                      )}
                      {(br.status === 'active' || br.status === 'overdue') && (
                        <button
                          type="button"
                          onClick={() => handleBorrowAction(br.id, 'returned')}
                          className="px-2.5 py-1 bg-[#142B45] text-white rounded text-xs font-semibold"
                        >
                          Mark Returned
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'messages' && (
        <div className="space-y-4">
          <h1 className="font-display text-2xl font-bold text-[#142B45]">Customer Inquiries</h1>
          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
            {messages.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500">No messages yet.</p>
            ) : (
              messages.map((m) => {
                const isSender = m.sender_id === user.id;
                const peerId = isSender ? m.receiver_id : m.sender_id;
                const peerName = isSender ? m.receiver_name : m.sender_name;
                return (
                  <div key={m.id} className="p-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs text-slate-500">
                        {isSender ? `To ${peerName}` : `From ${peerName}`}
                        {m.book_title ? ` · Re: ${m.book_title}` : ''}
                      </p>
                      <p className="text-sm text-[#142B45] mt-0.5">{m.body}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplyReceiverId(peerId)}
                      className="px-3 py-1.5 text-xs font-semibold bg-[#F5F7FA] border border-slate-200 rounded-lg"
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
                placeholder="Write reply to customer..."
                className="flex-1 px-3 py-2 bg-[#F5F7FA] border border-slate-200 rounded-lg text-sm"
              />
              <button type="submit" className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#142B45] text-white text-xs font-semibold rounded-lg">
                <Send className="w-3.5 h-3.5" />
                Send
              </button>
            </form>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-6">
          <h1 className="font-display text-2xl font-bold text-[#142B45]">Sales &amp; Exchange History</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <h2 className="text-sm font-semibold text-[#142B45]">Completed &amp; Shipped Sales</h2>
              <div className="divide-y divide-slate-100 text-xs">
                {orders.map((o) => (
                  <div key={o.id} className="py-2.5 flex justify-between">
                    <span>{o.book_title} ({o.buyer_name})</span>
                    <span className="font-mono-num font-semibold">{formatINR(o.total_amount)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <h2 className="text-sm font-semibold text-[#142B45]">Exchange Ledger</h2>
              <div className="divide-y divide-slate-100 text-xs">
                {exchanges.map((ex) => (
                  <div key={ex.id} className="py-2.5 flex justify-between">
                    <span>{ex.offered_title} &harr; {ex.requested_book_title}</span>
                    <span className="capitalize font-semibold text-[#19A68C]">{ex.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
