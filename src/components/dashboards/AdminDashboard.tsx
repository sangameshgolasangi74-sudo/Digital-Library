import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import {
  Book,
  Borrowing,
  Category,
  Complaint,
  ExchangeRequest,
  Order,
  SiteSettings,
  User,
  UserRole
} from '../../types';
import { apiRequest } from '../../lib/api';
import { formatINR } from '../../lib/formatCurrency';
import { DashboardShell, SidebarNavItem } from './DashboardShell';

interface AdminDashboardProps {
  user: User;
  onBooksChanged: () => void;
  onSwitchPortal: (role: UserRole) => void;
  onLogout: () => void;
  onBackToStorefront: () => void;
  onNotify: (title: string, description?: string, variant?: 'success' | 'error' | 'info') => void;
}

export function AdminDashboard({
  user,
  onBooksChanged,
  onSwitchPortal,
  onLogout,
  onBackToStorefront,
  onNotify
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [metrics, setMetrics] = useState({
    totalUsers: 0,
    totalOwners: 0,
    totalBooks: 0,
    digitalBooks: 0,
    completedOrders: 0,
    totalRevenue: 0,
    totalExchanges: 0,
    activeBorrowings: 0,
    openComplaints: 0
  });
  const [categoryBreakdown, setCategoryBreakdown] = useState<{ name: string; count: number }[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [exchanges, setExchanges] = useState<ExchangeRequest[]>([]);
  const [borrowings, setBorrowings] = useState<Borrowing[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [settings, setSettings] = useState<SiteSettings>({
    site_name: 'Digital Library',
    support_email: '',
    support_phone: '',
    campus_hub_address: '',
    default_borrow_days: '14',
    exchange_service_fee: '0.00',
    announcement_banner: ''
  });

  // New category
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');

  const loadAdminData = async () => {
    try {
      const [ov, usr, bk, cat, ord, ex, br, cmp, st] = await Promise.all([
        apiRequest<{ metrics: typeof metrics; categoryBreakdown: { name: string; count: number }[] }>('/api/admin/overview'),
        apiRequest<{ users: User[] }>('/api/admin/users'),
        apiRequest<{ books: Book[] }>('/api/admin/books'),
        apiRequest<{ categories: Category[] }>('/api/categories'),
        apiRequest<{ orders: Order[] }>('/api/admin/orders'),
        apiRequest<{ exchanges: ExchangeRequest[] }>('/api/admin/exchanges'),
        apiRequest<{ borrowings: Borrowing[] }>('/api/admin/borrowings'),
        apiRequest<{ complaints: Complaint[] }>('/api/admin/complaints'),
        apiRequest<{ settings: SiteSettings }>('/api/admin/settings')
      ]);
      setMetrics(ov.metrics);
      setCategoryBreakdown(ov.categoryBreakdown || []);
      setUsers(usr.users || []);
      setBooks(bk.books || []);
      setCategories(cat.categories || []);
      setOrders(ord.orders || []);
      setExchanges(ex.exchanges || []);
      setBorrowings(br.borrowings || []);
      setComplaints(cmp.complaints || []);
      setSettings(st.settings);
    } catch {
      // handled silently
    }
  };

  useEffect(() => {
    loadAdminData();
  }, [user.id]);

  const handleUserStatus = async (uid: number, status: 'active' | 'suspended') => {
    await apiRequest(`/api/admin/users/${uid}`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
    await loadAdminData();
    onNotify(`User account ${status}`);
  };

  const handleToggleBookDigital = async (book: Book) => {
    await apiRequest(`/api/admin/books/${book.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isDigital: book.is_digital ? 0 : 1 })
    });
    await loadAdminData();
    onBooksChanged();
    onNotify('Digital library flag updated');
  };

  const handleToggleBookArchive = async (book: Book) => {
    const nextStatus = book.status === 'archived' ? 'available' : 'archived';
    await apiRequest(`/api/admin/books/${book.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: nextStatus })
    });
    await loadAdminData();
    onBooksChanged();
    onNotify(`Book status set to ${nextStatus}`);
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/categories', {
        method: 'POST',
        body: JSON.stringify({ name: newCatName, description: newCatDesc })
      });
      setNewCatName('');
      setNewCatDesc('');
      await loadAdminData();
      onBooksChanged();
      onNotify('Category added');
    } catch (err) {
      onNotify('Error', err instanceof Error ? err.message : 'Unable to add category', 'error');
    }
  };

  const handleDeleteCategory = async (catId: number) => {
    try {
      await apiRequest(`/api/admin/categories/${catId}`, { method: 'DELETE' });
      await loadAdminData();
      onBooksChanged();
      onNotify('Category removed');
    } catch (err) {
      onNotify('Cannot delete', err instanceof Error ? err.message : 'Category has books', 'error');
    }
  };

  const handleResolveComplaint = async (c: Complaint, status: 'investigating' | 'resolved', note: string) => {
    await apiRequest(`/api/admin/complaints/${c.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, adminNote: note })
    });
    await loadAdminData();
    onNotify(`Ticket #${c.id} updated to ${status}`);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiRequest('/api/admin/settings', {
      method: 'PATCH',
      body: JSON.stringify(settings)
    });
    onBooksChanged();
    onNotify('Website settings saved');
  };

  const navItems: SidebarNavItem[] = [
    { id: 'overview', label: 'Overview & KPIs' },
    { id: 'users', label: 'Users & Owners', badge: users.length },
    { id: 'books', label: 'Books & Digital Library', badge: books.length },
    { id: 'categories', label: 'Categories', badge: categories.length },
    { id: 'orders', label: 'Orders', badge: orders.length },
    { id: 'exchanges', label: 'Exchanges', badge: exchanges.length },
    { id: 'borrowings', label: 'Borrowings', badge: borrowings.length },
    { id: 'complaints', label: 'Complaints', badge: metrics.openComplaints },
    { id: 'reports', label: 'Reports & Analytics' },
    { id: 'settings', label: 'Website Settings' }
  ];

  const maxCatCount = Math.max(1, ...categoryBreakdown.map((c) => c.count));

  return (
    <DashboardShell
      user={user}
      activePortal="admin"
      activeTab={activeTab}
      navItems={navItems}
      onSelectTab={setActiveTab}
      onSwitchPortal={onSwitchPortal}
      onLogout={onLogout}
      onBackToStorefront={onBackToStorefront}
    >
      {activeTab === 'overview' && (
        <div className="space-y-8">
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h1 className="font-display text-2xl font-bold text-[#142B45]">
              Platform Administration Console
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Protected governance over registered readers, book owners, catalog inventory, digital editions, and community disputes.
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs text-slate-500">Registered Users &amp; Owners</p>
              <p className="font-mono-num text-2xl font-bold text-[#142B45] mt-1">{metrics.totalUsers}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs text-slate-500">Total Listed Books</p>
              <p className="font-mono-num text-2xl font-bold text-[#142B45] mt-1">{metrics.totalBooks}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs text-slate-500">Completed Orders</p>
              <p className="font-mono-num text-2xl font-bold text-[#19A68C] mt-1">{metrics.completedOrders}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs text-slate-500">Total Book Exchanges</p>
              <p className="font-mono-num text-2xl font-bold text-[#142B45] mt-1">{metrics.totalExchanges}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs text-slate-500">Active Borrowings</p>
              <p className="font-mono-num text-2xl font-bold text-[#142B45] mt-1">{metrics.activeBorrowings}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs text-slate-500">Gross Order Volume</p>
              <p className="font-mono-num text-2xl font-bold text-[#142B45] mt-1">{formatINR(metrics.totalRevenue)}</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="space-y-4">
          <h1 className="font-display text-2xl font-bold text-[#142B45]">User &amp; Book Owner Management</h1>
          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F5F7FA] border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-3 px-4 font-semibold">Name</th>
                  <th className="py-3 px-4 font-semibold">Email</th>
                  <th className="py-3 px-4 font-semibold">Primary Role</th>
                  <th className="py-3 px-4 font-semibold">Institution</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="py-3 px-4 font-semibold text-[#142B45]">{u.name}</td>
                    <td className="py-3 px-4 text-slate-600">{u.email}</td>
                    <td className="py-3 px-4 capitalize">{u.role}</td>
                    <td className="py-3 px-4 text-slate-600">{u.institution || '-'}</td>
                    <td className="py-3 px-4 capitalize font-semibold">{u.status}</td>
                    <td className="py-3 px-4 text-right">
                      {u.role !== 'admin' && (
                        <button
                          type="button"
                          onClick={() => handleUserStatus(u.id, u.status === 'active' ? 'suspended' : 'active')}
                          className={`px-2.5 py-1 rounded text-xs font-semibold ${
                            u.status === 'active'
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'bg-[#19A68C] text-white'
                          }`}
                        >
                          {u.status === 'active' ? 'Suspend' : 'Restore'}
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

      {activeTab === 'books' && (
        <div className="space-y-4">
          <h1 className="font-display text-2xl font-bold text-[#142B45]">Catalog &amp; Digital Library Moderation</h1>
          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F5F7FA] border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-3 px-4 font-semibold">Title &amp; ISBN</th>
                  <th className="py-3 px-4 font-semibold">Owner</th>
                  <th className="py-3 px-4 font-semibold">Category</th>
                  <th className="py-3 px-4 font-semibold">Digital Library</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {books.map((b) => (
                  <tr key={b.id}>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-[#142B45]">{b.title}</p>
                      <p className="font-mono-num text-slate-500">{b.isbn}</p>
                    </td>
                    <td className="py-3 px-4">{b.owner_name}</td>
                    <td className="py-3 px-4">{b.category_name}</td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => handleToggleBookDigital(b)}
                        className={`px-2.5 py-1 rounded text-xs font-semibold ${
                          b.is_digital ? 'bg-[#19A68C] text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {b.is_digital ? 'Digital Enabled' : 'Physical Only'}
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => handleToggleBookArchive(b)}
                        className="px-2.5 py-1 rounded border border-slate-200 text-xs font-semibold capitalize text-[#142B45]"
                      >
                        {b.status}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'categories' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form onSubmit={handleAddCategory} className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-4 h-fit">
            <h2 className="font-display text-lg font-bold text-[#142B45]">Add Category</h2>
            <div>
              <label className="block text-xs font-medium text-[#142B45] mb-1">Category Name</label>
              <input
                type="text"
                required
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="e.g. Mathematics"
                className="w-full px-3 py-2 bg-[#F5F7FA] border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#142B45] mb-1">Description</label>
              <textarea
                rows={3}
                value={newCatDesc}
                onChange={(e) => setNewCatDesc(e.target.value)}
                placeholder="Subject scope..."
                className="w-full px-3 py-2 bg-[#F5F7FA] border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <button type="submit" className="w-full py-2.5 bg-[#142B45] text-white text-xs font-semibold rounded-lg">
              Create Category
            </button>
          </form>

          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
            {categories.map((c) => (
              <div key={c.id} className="p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[#142B45]">
                    {c.name} <span className="font-mono-num text-xs text-slate-500">({c.book_count || 0} books)</span>
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">{c.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteCategory(c.id)}
                  aria-label={`Delete ${c.name}`}
                  className="p-1.5 text-slate-400 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="space-y-4">
          <h1 className="font-display text-2xl font-bold text-[#142B45]">All Platform Orders</h1>
          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F5F7FA] border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-3 px-4 font-semibold">Order</th>
                  <th className="py-3 px-4 font-semibold">Book</th>
                  <th className="py-3 px-4 font-semibold">Buyer</th>
                  <th className="py-3 px-4 font-semibold">Owner</th>
                  <th className="py-3 px-4 font-semibold text-right">Amount</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="py-3 px-4 font-mono-num font-semibold">#{o.id}</td>
                    <td className="py-3 px-4 font-medium text-[#142B45]">{o.book_title}</td>
                    <td className="py-3 px-4">{o.buyer_name}</td>
                    <td className="py-3 px-4">{o.owner_name}</td>
                    <td className="py-3 px-4 text-right font-mono-num">{formatINR(o.total_amount)}</td>
                    <td className="py-3 px-4 capitalize font-semibold">{o.order_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'exchanges' && (
        <div className="space-y-4">
          <h1 className="font-display text-2xl font-bold text-[#142B45]">Exchange Ledger</h1>
          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F5F7FA] border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-3 px-4 font-semibold">Requester</th>
                  <th className="py-3 px-4 font-semibold">Offered Book</th>
                  <th className="py-3 px-4 font-semibold">Requested Book</th>
                  <th className="py-3 px-4 font-semibold">Owner</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {exchanges.map((ex) => (
                  <tr key={ex.id}>
                    <td className="py-3 px-4">{ex.requester_name}</td>
                    <td className="py-3 px-4">{ex.offered_title}</td>
                    <td className="py-3 px-4 font-medium text-[#142B45]">{ex.requested_book_title}</td>
                    <td className="py-3 px-4">{ex.owner_name}</td>
                    <td className="py-3 px-4 capitalize font-semibold">{ex.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'borrowings' && (
        <div className="space-y-4">
          <h1 className="font-display text-2xl font-bold text-[#142B45]">Borrowing Oversight</h1>
          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F5F7FA] border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-3 px-4 font-semibold">Book</th>
                  <th className="py-3 px-4 font-semibold">Borrower</th>
                  <th className="py-3 px-4 font-semibold">Owner</th>
                  <th className="py-3 px-4 font-semibold font-mono-num">Due Date</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {borrowings.map((br) => (
                  <tr key={br.id}>
                    <td className="py-3 px-4 font-medium text-[#142B45]">{br.book_title}</td>
                    <td className="py-3 px-4">{br.borrower_name}</td>
                    <td className="py-3 px-4">{br.owner_name}</td>
                    <td className="py-3 px-4 font-mono-num">{br.due_date}</td>
                    <td className="py-3 px-4 capitalize font-semibold">{br.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'complaints' && (
        <div className="space-y-4">
          <h1 className="font-display text-2xl font-bold text-[#142B45]">Complaints &amp; Support Tickets</h1>
          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
            {complaints.map((c) => (
              <div key={c.id} className="p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[#142B45]">
                      #{c.id} · {c.subject}
                    </p>
                    <p className="text-xs text-slate-500">
                      From {c.user_name || c.user_email || 'Guest'} · Status:{' '}
                      <span className="capitalize font-semibold">{c.status}</span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleResolveComplaint(c, 'investigating', c.admin_note || 'Under review by library desk.')}
                      className="px-3 py-1.5 text-xs font-semibold bg-[#F5F7FA] border border-slate-200 rounded-lg"
                    >
                      Mark Investigating
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResolveComplaint(c, 'resolved', c.admin_note || 'Resolved by administration.')}
                      className="px-3 py-1.5 text-xs font-semibold bg-[#19A68C] text-white rounded-lg"
                    >
                      Resolve
                    </button>
                  </div>
                </div>
                <p className="text-xs text-[#303846]">{c.details}</p>
                {c.admin_note && (
                  <p className="text-xs text-slate-500">Admin Note: {c.admin_note}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="space-y-6">
          <h1 className="font-display text-2xl font-bold text-[#142B45]">Reports &amp; Catalog Analytics</h1>
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-[#142B45]">Books Distributed by Subject Category</h2>
            <div className="space-y-3">
              {categoryBreakdown.map((item) => (
                <div key={item.name} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-[#142B45]">{item.name}</span>
                    <span className="font-mono-num text-slate-600">{item.count} titles</span>
                  </div>
                  <div className="h-2.5 bg-[#F5F7FA] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#19A68C] rounded-full"
                      style={{ width: `${Math.round((item.count / maxCatCount) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 max-w-2xl">
          <h1 className="font-display text-2xl font-bold text-[#142B45]">Website Settings</h1>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#142B45] mb-1">Platform Name</label>
              <input
                type="text"
                value={settings.site_name}
                onChange={(e) => setSettings({ ...settings, site_name: e.target.value })}
                className="w-full px-3 py-2 bg-[#F5F7FA] border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#142B45] mb-1">Support Email</label>
              <input
                type="email"
                value={settings.support_email}
                onChange={(e) => setSettings({ ...settings, support_email: e.target.value })}
                className="w-full px-3 py-2 bg-[#F5F7FA] border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#142B45] mb-1">Support Phone</label>
              <input
                type="text"
                value={settings.support_phone}
                onChange={(e) => setSettings({ ...settings, support_phone: e.target.value })}
                className="w-full px-3 py-2 bg-[#F5F7FA] border border-slate-200 rounded-lg text-sm font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#142B45] mb-1">Default Borrow Days</label>
              <input
                type="number"
                value={settings.default_borrow_days}
                onChange={(e) => setSettings({ ...settings, default_borrow_days: e.target.value })}
                className="w-full px-3 py-2 bg-[#F5F7FA] border border-slate-200 rounded-lg text-sm font-mono-num"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#142B45] mb-1">Central Exchange Hub Address</label>
            <input
              type="text"
              value={settings.campus_hub_address}
              onChange={(e) => setSettings({ ...settings, campus_hub_address: e.target.value })}
              className="w-full px-3 py-2 bg-[#F5F7FA] border border-slate-200 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#142B45] mb-1">Site Announcement Banner</label>
            <input
              type="text"
              value={settings.announcement_banner}
              onChange={(e) => setSettings({ ...settings, announcement_banner: e.target.value })}
              className="w-full px-3 py-2 bg-[#F5F7FA] border border-slate-200 rounded-lg text-sm"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className="px-6 py-2.5 bg-[#142B45] text-white text-xs font-semibold rounded-lg">
              Save Platform Settings
            </button>
            <a
              href="/Digital-Library.zip"
              download="Digital-Library.zip"
              className="px-5 py-2.5 bg-[#19A68C] hover:bg-[#158c76] text-white text-xs font-semibold rounded-lg transition-colors"
            >
              Download Digital-Library.zip
            </a>
          </div>
        </form>
      )}
    </DashboardShell>
  );
}
