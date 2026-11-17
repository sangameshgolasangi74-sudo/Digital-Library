import { AppView } from './Navbar';

interface FooterProps {
  settings: Record<string, string>;
  onNavigate: (view: AppView) => void;
  onOpenAuth: (mode?: 'login' | 'register') => void;
}

export function Footer({ settings, onNavigate, onOpenAuth }: FooterProps) {
  return (
    <footer className="bg-[#142B45] text-slate-300 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        <div className="space-y-3">
          <span className="font-display text-2xl font-bold text-white">Digital Library</span>
          <p className="text-xs text-slate-300 leading-relaxed">
            Digital Public Library and Book Exchange System connecting students, educators, and civic reading communities.
          </p>
        </div>

        <div className="space-y-2.5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-white">Platform</h3>
          <ul className="space-y-2 text-xs">
            <li>
              <button type="button" onClick={() => onNavigate('explore')} className="hover:text-white transition-colors">
                Explore Catalog
              </button>
            </li>
            <li>
              <button type="button" onClick={() => onNavigate('digital')} className="hover:text-white transition-colors">
                Digital Public Library
              </button>
            </li>
            <li>
              <button type="button" onClick={() => onNavigate('exchange')} className="hover:text-white transition-colors">
                Exchange &amp; Borrow Hub
              </button>
            </li>
          </ul>
        </div>

        <div className="space-y-2.5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-white">Organization</h3>
          <ul className="space-y-2 text-xs">
            <li>
              <button type="button" onClick={() => onNavigate('about')} className="hover:text-white transition-colors">
                About Digital Library
              </button>
            </li>
            <li>
              <button type="button" onClick={() => onNavigate('contact')} className="hover:text-white transition-colors">
                Contact &amp; Support
              </button>
            </li>
            <li>
              <button type="button" onClick={() => onOpenAuth('login')} className="hover:text-white transition-colors">
                Member &amp; Staff Portals
              </button>
            </li>
          </ul>
        </div>

        <div className="space-y-2.5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-white">Contact Desk</h3>
          <p className="text-xs">{settings.support_email || 'sangameshgolasangi74@gmail.com'}</p>
          <p className="text-xs font-mono-num">{settings.support_phone || '+1 (800) 555-0194'}</p>
          <p className="text-xs text-slate-400">{settings.campus_hub_address || '210 Civic Library Square, Reading Hall B'}</p>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
          <span>&copy; {new Date().getFullYear()} Digital Library &amp; Book Exchange System</span>
          <span>All rights reserved</span>
        </div>
      </div>
    </footer>
  );
}
