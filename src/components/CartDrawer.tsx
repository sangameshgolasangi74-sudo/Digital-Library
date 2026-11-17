import { useState } from 'react';
import { X, Trash2, CheckCircle2, ShoppingBag } from 'lucide-react';
import { CartItem, User } from '../types';
import { resolveCoverUrl } from '../lib/coverAssets';
import { apiRequest } from '../lib/api';
import { formatINR } from '../lib/formatCurrency';

interface CartDrawerProps {
  open: boolean;
  items: CartItem[];
  user: User | null;
  onClose: () => void;
  onUpdateQty: (bookId: number, qty: number) => void;
  onRemove: (bookId: number) => void;
  onClearCart: () => void;
  onRequireAuth: () => void;
  onOrderComplete: (orderIds: number[]) => void;
  onNotify: (title: string, description?: string, variant?: 'success' | 'error' | 'info') => void;
}

export function CartDrawer({
  open,
  items,
  user,
  onClose,
  onUpdateQty,
  onRemove,
  onClearCart,
  onRequireAuth,
  onOrderComplete,
  onNotify
}: CartDrawerProps) {
  const [shippingName, setShippingName] = useState(user?.name || '');
  const [shippingAddress, setShippingAddress] = useState(user?.address || '');
  const [shippingPhone, setShippingPhone] = useState(user?.phone || '');
  const [paymentMethod, setPaymentMethod] = useState('Card');
  const [submitting, setSubmitting] = useState(false);
  const [confirmedOrders, setConfirmedOrders] = useState<number[] | null>(null);

  if (!open) return null;

  const subtotal = items.reduce((sum, item) => sum + Number(item.book.price) * item.quantity, 0);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onClose();
      onRequireAuth();
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiRequest<{ orderIds: number[] }>('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          items: items.map((i) => ({ bookId: i.book.id, quantity: i.quantity })),
          paymentMethod,
          shippingName: shippingName || user.name,
          shippingAddress: shippingAddress || user.address || 'Campus Pickup Hub',
          shippingPhone: shippingPhone || user.phone || '555-0100'
        })
      });
      setConfirmedOrders(res.orderIds);
      onClearCart();
      onOrderComplete(res.orderIds);
      onNotify('Order confirmed', `Order #${res.orderIds[0]} recorded successfully.`);
    } catch (err) {
      onNotify('Checkout failed', err instanceof Error ? err.message : 'Unable to process order.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#142B45]/45 backdrop-blur-xs flex justify-end">
      <div className="bg-white w-full max-w-md h-full flex flex-col border-l border-slate-200 shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[#142B45]" />
            <h2 className="font-display text-lg font-bold text-[#142B45]">Book Bag</h2>
          </div>
          <button
            type="button"
            onClick={() => {
              setConfirmedOrders(null);
              onClose();
            }}
            aria-label="Close bag"
            className="p-2 text-slate-500 hover:text-[#142B45] rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {confirmedOrders ? (
            <div className="py-10 text-center space-y-4">
              <CheckCircle2 className="w-12 h-12 text-[#19A68C] mx-auto" />
              <h3 className="font-display text-xl font-bold text-[#142B45]">
                Order #{confirmedOrders[0]} Confirmed
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Your payment record and fulfillment status are now visible in your Customer Dashboard under My Orders.
              </p>
              <button
                type="button"
                onClick={() => {
                  setConfirmedOrders(null);
                  onClose();
                }}
                className="px-5 py-2.5 bg-[#142B45] text-white text-sm font-semibold rounded-lg"
              >
                Continue Browsing
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-medium text-[#142B45]">Your book bag is empty</p>
              <p className="text-xs text-slate-500">Explore our catalog to buy physical editions.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-4">
                {items.map((item) => (
                  <div key={item.book.id} className="flex gap-3 pb-4 border-b border-slate-100">
                    <img
                      src={resolveCoverUrl(item.book.cover_url)}
                      alt={item.book.title}
                      referrerPolicy="no-referrer"
                      className="w-16 h-20 object-cover rounded-lg bg-[#F5F7FA] border border-slate-200 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#142B45] truncate">{item.book.title}</p>
                      <p className="text-xs text-slate-500 truncate">{item.book.author}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <div className="inline-flex items-center border border-slate-200 rounded-md">
                          <button
                            type="button"
                            onClick={() => onUpdateQty(item.book.id, Math.max(1, item.quantity - 1))}
                            className="px-2 py-0.5 text-xs hover:bg-slate-100"
                          >
                            -
                          </button>
                          <span className="px-2 text-xs font-mono-num">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => onUpdateQty(item.book.id, Math.min(item.book.stock, item.quantity + 1))}
                            className="px-2 py-0.5 text-xs hover:bg-slate-100"
                          >
                            +
                          </button>
                        </div>
                        <span className="text-sm font-mono-num font-semibold text-[#142B45]">
                          {formatINR(Number(item.book.price) * item.quantity)}
                        </span>
                        <button
                          type="button"
                          onClick={() => onRemove(item.book.id)}
                          aria-label={`Remove ${item.book.title}`}
                          className="p-1 text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <form id="checkout-form" onSubmit={handleCheckout} className="space-y-3 pt-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Delivery & Payment Details
                </h3>
                <input
                  type="text"
                  required
                  value={shippingName}
                  onChange={(e) => setShippingName(e.target.value)}
                  placeholder="Recipient Full Name"
                  className="w-full px-3 py-2 bg-[#F5F7FA] border border-slate-200 rounded-lg text-sm"
                />
                <input
                  type="text"
                  required
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  placeholder="Delivery Address or Campus Reading Hub"
                  className="w-full px-3 py-2 bg-[#F5F7FA] border border-slate-200 rounded-lg text-sm"
                />
                <input
                  type="tel"
                  required
                  value={shippingPhone}
                  onChange={(e) => setShippingPhone(e.target.value)}
                  placeholder="Contact Phone Number"
                  className="w-full px-3 py-2 bg-[#F5F7FA] border border-slate-200 rounded-lg text-sm"
                />
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F5F7FA] border border-slate-200 rounded-lg text-sm"
                  >
                    <option value="Card">Debit / Credit Card</option>
                    <option value="Campus Credit">University / Library Credit</option>
                    <option value="Cash on Delivery">Cash on Delivery (COD)</option>
                  </select>
                </div>
              </form>
            </div>
          )}
        </div>

        {items.length > 0 && !confirmedOrders && (
          <div className="p-6 border-t border-slate-200 bg-[#F5F7FA] space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Subtotal</span>
              <span className="text-lg font-bold font-mono-num text-[#142B45]">{formatINR(subtotal)}</span>
            </div>
            <button
              type="submit"
              form="checkout-form"
              disabled={submitting}
              className="w-full py-3 px-4 bg-[#142B45] hover:bg-[#1e3d61] disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors"
            >
              {submitting ? 'Confirming Order...' : user ? `Complete Order · ${formatINR(subtotal)}` : 'Sign In to Checkout'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
