import { ReactNode, useState } from 'react';
import { LogOut, Menu, X, ArrowLeftRight } from 'lucide-react';
import { User, UserRole } from '../../types';

export interface SidebarNavItem {
  id: string;
  label: string;
  badge?: number;
}

interface DashboardShellProps {
  user: User;
  activePortal: UserRole;
  activeTab: string;
  navItems: SidebarNavItem[];
  onSelectTab: (id: string) => void;
  onSwitchPortal: (role: UserRole) => void;
  onLogout: () => void;
  onBackToStorefront: () => void;
  children: ReactNode;
}

export function DashboardShell({
  user,
  activePortal,
  activeTab,
  navItems,
  onSelectTab,
  onSwitchPortal,
  onLogout,
  onBackToStorefront,
  children
}: DashboardShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const portalLabel =
    activePortal === 'admin'
      ? 'Administrator Console'
      : activePortal === 'owner'
        ? 'Book Owner Workspace'
        : 'Customer Workspace';

  const activeNavLabel = navItems.find((n) => n.id === activeTab)?.label || 'Overview';

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#F5F7FA] flex">
      {/* Desktop Sidebar (256px) */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-slate-200 shrink-0">
        <div className="p-5 border-b border-slate-200 space-y-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#19A68C]">
              {portalLabel}
            </p>
            <p className="text-sm font-bold text-[#142B45] truncate mt-0.5">{user.name}</p>
            <p className="text-xs text-slate-500 truncate">{user.email}</p>
          </div>

          {user.role !== 'admin' && (
            <button
              type="button"
              onClick={() => onSwitchPortal(activePortal === 'customer' ? 'owner' : 'customer')}
              className="w-full py-2 px-3 bg-[#F5F7FA] hover:bg-slate-200/70 border border-slate-200 rounded-lg text-xs font-semibold text-[#142B45] inline-flex items-center justify-center gap-1.5 transition-colors"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-[#19A68C]" />
              Switch to {activePortal === 'customer' ? 'Owner View' : 'Customer View'}
            </button>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto" aria-label="Dashboard navigation">
          {navItems.map((item) => {
            const active = item.id === activeTab;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                  active
                    ? 'bg-[#142B45] text-white font-semibold'
                    : 'text-[#303846] hover:bg-[#F5F7FA] hover:text-[#142B45]'
                }`}
              >
                <span className="truncate">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`font-mono-num text-[11px] px-1.5 py-0.5 rounded ${
                      active ? 'bg-[#19A68C] text-white' : 'bg-slate-100 text-[#142B45]'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-200 space-y-1">
          <button
            type="button"
            onClick={onBackToStorefront}
            className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-[#F5F7FA] hover:text-[#142B45]"
          >
            Return to Storefront
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="bg-white border-b border-slate-200 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label="Toggle dashboard menu"
              className="lg:hidden p-2 text-[#142B45] bg-[#F5F7FA] rounded-lg"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
            <div className="text-xs text-slate-500 flex items-center gap-2 truncate">
              <span>{portalLabel}</span>
              <span aria-hidden="true">/</span>
              <span className="font-semibold text-[#142B45] truncate">{activeNavLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {user.role !== 'admin' && (
              <button
                type="button"
                onClick={() => onSwitchPortal(activePortal === 'customer' ? 'owner' : 'customer')}
                className="lg:hidden px-3 py-1.5 text-xs font-semibold bg-[#F5F7FA] border border-slate-200 rounded-lg text-[#142B45]"
              >
                {activePortal === 'customer' ? 'Owner View' : 'Customer View'}
              </button>
            )}
            <button
              type="button"
              onClick={onLogout}
              className="lg:hidden px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-200 rounded-lg"
            >
              Sign Out
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-b border-slate-200 p-3 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`px-3 py-2 rounded-lg text-xs font-medium text-left truncate ${
                  item.id === activeTab ? 'bg-[#142B45] text-white' : 'bg-[#F5F7FA] text-[#303846]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}

        <main className="flex-1 p-4 sm:p-8 max-w-6xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
