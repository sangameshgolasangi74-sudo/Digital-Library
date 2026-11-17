import { useState } from 'react';
import { HERO_LIBRARY_IMAGE } from '../lib/coverAssets';
import { apiRequest } from '../lib/api';
import { User } from '../types';

export function AboutPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#19A68C]">Our Mission</p>
        <h1 className="font-display text-4xl font-bold text-[#142B45] text-balance">
          Making Knowledge Accessible Through Shared Libraries &amp; Community Exchange
        </h1>
        <p className="text-base text-[#303846] leading-relaxed">
          Digital Library was created to eliminate the fragmentation between commercial secondhand bookstores, campus textbook swaps, and public digital repositories. Instead of forcing learners to juggle separate tools to price-check editions, message owners, and track borrowed books, Digital Library brings all four circulation models under one roof.
        </p>
      </div>

      <div className="h-80 rounded-2xl overflow-hidden border border-slate-200">
        <img
          src={HERO_LIBRARY_IMAGE}
          alt="Digital Library reading room"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-2">
          <h2 className="font-display text-xl font-bold text-[#142B45]">For Students &amp; Independent Readers</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Compare purchase prices, propose direct book swaps, borrow reference volumes for exact term lengths, and launch open-access digital monographs directly in your browser.
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-2">
          <h2 className="font-display text-xl font-bold text-[#142B45]">For Book Owners, Faculty &amp; Institutions</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Publish ISBN-indexed book listings in seconds, toggle buy/exchange/borrow permissions independently, approve swap requests, and monitor return schedules from a unified Owner Dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}

interface ContactPageProps {
  user: User | null;
  settings: Record<string, string>;
  onNotify: (title: string, description?: string, variant?: 'success' | 'error' | 'info') => void;
}

export function ContactPage({ user, settings, onNotify }: ContactPageProps) {
  const [email, setEmail] = useState(user?.email || '');
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiRequest('/api/contact', {
        method: 'POST',
        body: JSON.stringify({ email, subject, details })
      });
      setSubmitted(true);
      setSubject('');
      setDetails('');
      onNotify('Inquiry sent', 'Our library support administrators have received your message.');
    } catch (err) {
      onNotify('Submission failed', err instanceof Error ? err.message : 'Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 lg:grid-cols-12 gap-10">
      <div className="lg:col-span-5 space-y-6">
        <h1 className="font-display text-3xl font-bold text-[#142B45]">Contact &amp; Support Desk</h1>
        <p className="text-sm text-slate-600 leading-relaxed">
          Have a question about an exchange dispute, institutional partnership, or digital library access? Reach the Digital Library administrative desk directly.
        </p>
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 text-sm">
          <div>
            <p className="text-xs text-slate-500">Support Email</p>
            <p className="font-medium text-[#142B45]">{settings.support_email || 'sangameshgolasangi74@gmail.com'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Library Helpline</p>
            <p className="font-mono-num font-medium text-[#142B45]">{settings.support_phone || '+1 (800) 555-0194'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Central Exchange Hub</p>
            <p className="font-medium text-[#142B45]">{settings.campus_hub_address || '210 Civic Library Square, Reading Hall B'}</p>
          </div>
        </div>
      </div>

      <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
        {submitted ? (
          <div className="py-10 text-center space-y-3">
            <h2 className="font-display text-xl font-bold text-[#142B45]">Message Logged</h2>
            <p className="text-sm text-slate-600">
              Your inquiry has been routed to the Digital Library Administrator Complaint &amp; Support Queue.
            </p>
            <button
              type="button"
              onClick={() => setSubmitted(false)}
              className="px-4 py-2 bg-[#142B45] text-white text-xs font-semibold rounded-lg"
            >
              Send Another Message
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <h2 className="font-display text-xl font-bold text-[#142B45]">Send an Inquiry or Report</h2>
            <div>
              <label className="block text-xs font-medium text-[#142B45] mb-1">Your Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="reader@university.edu"
                className="w-full px-3.5 py-2.5 bg-[#F5F7FA] border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#142B45] mb-1">Subject</label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Institutional library onboarding or order assistance"
                className="w-full px-3.5 py-2.5 bg-[#F5F7FA] border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#142B45] mb-1">Details</label>
              <textarea
                rows={4}
                required
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Describe how our team can help..."
                className="w-full px-3.5 py-2.5 bg-[#F5F7FA] border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-[#142B45] hover:bg-[#1e3d61] text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {submitting ? 'Submitting...' : 'Submit Inquiry'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
