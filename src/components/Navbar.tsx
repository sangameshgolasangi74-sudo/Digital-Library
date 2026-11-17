import { useState } from 'react';
import { Menu, X, ShoppingBag } from 'lucide-react';
import { User } from '../types';

export type AppView =
  | 'home'
  | 'explore'
  | 'digital'
  | 'exchange'
  | 'about'
  | 'contact'
  | 'dashboard';

interface NavbarProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  user: User | null;
  cartCount: number;
  onOpenCart: () => void;
  onOpenAuth: (mode?: 'login' | 'register') => void;
}

export function Navbar({
  currentView,
  onNavigate,
  user,
  cartCount,
  onOpenCart,
  onOpenAuth
}: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems: { id: AppView; label: string }[] = [
    { id: 'explore', label: 'Explore Books' },
    { id: 'digital', label: 'Digital Library' },
    { id: 'exchange', label: 'Exchange' },
    { id: 'about', label: 'About' },
    { id: 'contact', label: 'Contact' }
  ];

  const handleNav = (view: AppView) => {
    onNavigate(view);
    setMobileOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={() => handleNav('home')}
          className="font-display text-2xl font-bold tracking-tight text-[#142B45] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#19A68C] rounded"
        >
          Digital Library
        </button>

        {/* Zone 2: 5 concise single-line text nav links */}
        <nav className="hidden md:flex items-center gap-7" aria-label="Primary">
          {navItems.map((item) => {
            const active = currentView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`text-sm font-medium whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#19A68C] rounded-sm ${
                  active
                    ? 'text-[#142B45] border-[#19A68C]'
                    : 'text-[#303846] border-transparent hover:text-[#142B45] hover:border-slate-300'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Primary Action Zone */}
        <div className="flex items-center gap-3 shrink-0">
          {cartCount > 0 && (
            <button
              type="button"
              onClick={onOpenCart}
              aria-label={`Open shopping bag with ${cartCount} items`}
              className="relative inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[#142B45] bg-[#F5F7FA] hover:bg-slate-200/70 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <ShoppingBag className="w-4 h-4" />
              <span className="tabular-nums font-semibold">{cartCount}</span>
            </button>
          )}

          {user ? (
            <button
              type="button"
              onClick={() => handleNav('dashboard')}
              className="px-4 py-2 text-sm font-semibold text-white bg-[#142B45] hover:bg-[#1e3c5e] rounded-lg transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#19A68C]"
            >
              My Dashboard
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              className="px-4 py-2 text-sm font-semibold text-white bg-[#142B45] hover:bg-[#1e3c5e] rounded-lg transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#19A68C]"
            >
              Sign In
            </button>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="md:hidden p-2 text-[#142B45] hover:bg-slate-100 rounded-lg transition-colors"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-slate-200 px-4 py-3 space-y-1">
          <button
            type="button"
            onClick={() => handleNav('home')}
            className="block w-full text-left px-3 py-2.5 text-sm font-medium text-[#142B45] rounded-lg hover:bg-[#F5F7FA]"
          >
            Home
          </button>
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNav(item.id)}
              className={`block w-full text-left px-3 py-2.5 text-sm font-medium rounded-lg ${
                currentView === item.id
                  ? 'bg-[#142B45]/5 text-[#142B45] font-semibold'
                  : 'text-[#303846] hover:bg-[#F5F7FA]'
              }`}
            >
              {item.label}
            </button>
          ))}
          {!user && (
            <div className="pt-2 border-t border-slate-100 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  onOpenAuth('register');
                }}
                className="flex-1 py-2.5 text-sm font-semibold text-[#142B45] border border-slate-300 rounded-lg"
              >
                Register
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
