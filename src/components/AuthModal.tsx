import { useState } from 'react';
import { X, Eye, EyeOff, ShieldCheck, UserCheck, BookMarked } from 'lucide-react';
import { User, UserRole } from '../types';
import { apiRequest, setStoredSessionToken } from '../lib/api';

interface AuthModalProps {
  open: boolean;
  initialMode?: 'login' | 'register';
  onClose: () => void;
  onSuccess: (user: User, selectedPortal: UserRole) => void;
  onNotify: (title: string, description?: string, variant?: 'success' | 'error' | 'info') => void;
}

export function AuthModal({
  open,
  initialMode = 'login',
  onClose,
  onSuccess,
  onNotify
}: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'recover'>(initialMode);
  const [portalRole, setPortalRole] = useState<UserRole>('customer');
  const [showPassword, setShowPassword] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [institution, setInstitution] = useState('');
  const [registerRole, setRegisterRole] = useState<'customer' | 'owner'>('customer');

  // Password recovery state
  const [recoverStep, setRecoverStep] = useState<'email' | 'otp' | 'new-password'>('email');
  const [resetCode, setResetCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const resetRecoveryState = () => {
    setRecoverStep('email');
    setResetCode('');
    setResetToken('');
    setNewPassword('');
    setConfirmPassword('');
    setShowNewPassword(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiRequest<{ user: User; sessionToken: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, portalRole })
      });
      setStoredSessionToken(res.sessionToken);
      onNotify(`Welcome back, ${res.user.name}`, `Signed into ${portalRole} workspace.`);
      onSuccess(res.user, portalRole);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest<{ user: User; sessionToken: string }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name,
          email,
          password,
          role: registerRole,
          phone,
          institution
        })
      });
      setStoredSessionToken(res.sessionToken);
      onNotify('Account created', 'Your Digital Library customer and book owner access is ready.');
      onSuccess(res.user, registerRole);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await apiRequest<{
        step: string;
        message: string;
      }>('/api/auth/recover-password', {
        method: 'POST',
        body: JSON.stringify({ action: 'request', email })
      });
      setResetCode('');
      setResetToken('');
      setRecoverStep('otp');
      onNotify('OTP sent to your email', res.message, 'info');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (recoverStep === 'email') {
      await handleRequestOtp();
      return;
    }

    if (recoverStep === 'otp') {
      if (!resetCode.trim()) {
        setError('Please enter the 6-digit OTP.');
        return;
      }
      setLoading(true);
      try {
        const res = await apiRequest<{
          step: string;
          resetToken: string;
          message: string;
        }>('/api/auth/recover-password', {
          method: 'POST',
          body: JSON.stringify({ action: 'verify-otp', email, resetCode })
        });
        setResetToken(res.resetToken);
        setResetCode('');
        setRecoverStep('new-password');
        onNotify('OTP verified', res.message, 'success');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Invalid OTP.');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiRequest<{ step: string; message: string }>('/api/auth/recover-password', {
        method: 'POST',
        body: JSON.stringify({
          action: 'reset-password',
          email,
          resetToken,
          newPassword
        })
      });
      onNotify('Password updated', res.message);
      setMode('login');
      setPassword('');
      resetRecoveryState();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password reset failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#142B45]/55 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Digital Library Account Authentication"
        className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden"
      >
        <div className="px-6 py-4 bg-[#142B45] text-white flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-bold">
              {mode === 'login' ? 'Sign In to Digital Library' : mode === 'register' ? 'Create Reader Account' : 'Recover Password'}
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              {mode === 'login'
                ? 'Choose your role portal to access your workspace'
                : mode === 'register'
                  ? 'Register once for both Customer and Book Owner services'
                  : 'Verify your account email to set a new password'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close authentication modal"
            className="p-1.5 text-slate-300 hover:text-white rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Mode Tabs */}
          <div className="flex gap-1 p-1 bg-[#F5F7FA] border border-slate-200 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
                resetRecoveryState();
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${
                mode === 'login' ? 'bg-white text-[#142B45] shadow-xs' : 'text-slate-600'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError('');
                resetRecoveryState();
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${
                mode === 'register' ? 'bg-white text-[#142B45] shadow-xs' : 'text-slate-600'
              }`}
            >
              Register
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('recover');
                setError('');
                resetRecoveryState();
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${
                mode === 'recover' ? 'bg-white text-[#142B45] shadow-xs' : 'text-slate-600'
              }`}
            >
              Reset Password
            </button>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
              {error}
            </div>
          )}

          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Separate Role Login Portal Selector */}
              <div>
                <label className="block text-xs font-semibold text-[#142B45] mb-1.5">Login Portal</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPortalRole('customer')}
                    className={`p-2.5 rounded-lg border text-left transition-colors ${
                      portalRole === 'customer'
                        ? 'border-[#19A68C] bg-[#19A68C]/10 text-[#142B45]'
                        : 'border-slate-200 text-slate-600 hover:bg-[#F5F7FA]'
                    }`}
                  >
                    <UserCheck className="w-4 h-4 mb-1 text-[#19A68C]" />
                    <span className="block text-xs font-semibold">Customer</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPortalRole('owner')}
                    className={`p-2.5 rounded-lg border text-left transition-colors ${
                      portalRole === 'owner'
                        ? 'border-[#19A68C] bg-[#19A68C]/10 text-[#142B45]'
                        : 'border-slate-200 text-slate-600 hover:bg-[#F5F7FA]'
                    }`}
                  >
                    <BookMarked className="w-4 h-4 mb-1 text-[#142B45]" />
                    <span className="block text-xs font-semibold">Book Owner</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPortalRole('admin')}
                    className={`p-2.5 rounded-lg border text-left transition-colors ${
                      portalRole === 'admin'
                        ? 'border-[#142B45] bg-[#142B45]/10 text-[#142B45]'
                        : 'border-slate-200 text-slate-600 hover:bg-[#F5F7FA]'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4 mb-1 text-[#142B45]" />
                    <span className="block text-xs font-semibold">Administrator</span>
                  </button>
                </div>
                {portalRole === 'admin' && (
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    Protected portal: administrator accounts cannot be registered publicly.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-[#142B45] mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@university.edu"
                  className="w-full px-3.5 py-2.5 bg-[#F5F7FA] border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#19A68C]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-[#142B45]">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('recover');
                      setError('');
                      resetRecoveryState();
                    }}
                    className="text-xs font-medium text-[#19A68C] hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full px-3.5 py-2.5 pr-10 bg-[#F5F7FA] border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#19A68C]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-[#142B45]"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-[#142B45] hover:bg-[#1e3e63] disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors"
              >
                {loading ? 'Signing In...' : `Sign In as ${portalRole === 'owner' ? 'Book Owner' : portalRole === 'admin' ? 'Administrator' : 'Customer'}`}
              </button>

            </form>
          )}

          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-[#142B45] mb-1">Primary Account Focus</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRegisterRole('customer')}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold ${
                      registerRole === 'customer'
                        ? 'border-[#19A68C] bg-[#19A68C]/10 text-[#142B45]'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    Reader / Customer
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegisterRole('owner')}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold ${
                      registerRole === 'owner'
                        ? 'border-[#19A68C] bg-[#19A68C]/10 text-[#142B45]'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    Book Owner / Seller
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  All registered members can use both Customer and Book Owner dashboards.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#142B45] mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jordan Patel"
                    className="w-full px-3 py-2 bg-[#F5F7FA] border border-slate-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#142B45] mb-1">Phone</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 014-2200"
                    className="w-full px-3 py-2 bg-[#F5F7FA] border border-slate-200 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#142B45] mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jordan@college.edu"
                  className="w-full px-3 py-2 bg-[#F5F7FA] border border-slate-200 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#142B45] mb-1">Institution or Neighborhood</label>
                <input
                  type="text"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  placeholder="e.g. State Engineering College / Downtown Hub"
                  className="w-full px-3 py-2 bg-[#F5F7FA] border border-slate-200 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#142B45] mb-1">Password (min 6 characters)</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a strong password"
                    className="w-full px-3 py-2 pr-10 bg-[#F5F7FA] border border-slate-200 rounded-lg text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-[#19A68C] hover:bg-[#158c76] disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors"
              >
                {loading ? 'Creating Account...' : 'Create Digital Library Account'}
              </button>
            </form>
          )}

          {mode === 'recover' && (
            <form onSubmit={handleRecover} className="space-y-4">
              {recoverStep === 'email' && (
                <div>
                  <label className="block text-xs font-medium text-[#142B45] mb-1">Registered Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your registered email"
                    className="w-full px-3.5 py-2.5 bg-[#F5F7FA] border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#19A68C]"
                  />
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    Registered users receive a 6-digit OTP to verify ownership before setting a new password.
                  </p>
                </div>
              )}

              {recoverStep === 'otp' && (
                <div className="space-y-3">
                  <div className="p-3 bg-[#F5F7FA] border border-slate-200 rounded-lg text-xs text-[#303846]">
                    A 6-digit OTP has been sent to <span className="font-semibold text-[#142B45]">{email}</span>. Check your inbox and spam folder.
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#142B45] mb-1">Enter 6-Digit OTP</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      required
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value.replace(/\s+/g, ''))}
                      placeholder="Enter 6-digit OTP"
                      className="w-full px-3.5 py-2.5 bg-[#F5F7FA] border border-slate-200 rounded-lg text-sm font-mono-num tracking-widest focus:outline-none focus:ring-2 focus:ring-[#19A68C]"
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => {
                        setError('');
                        resetRecoveryState();
                      }}
                      className="text-slate-600 hover:text-[#142B45]"
                    >
                      Change email
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={handleRequestOtp}
                      className="font-medium text-[#19A68C] hover:underline"
                    >
                      Resend OTP
                    </button>
                  </div>
                </div>
              )}

              {recoverStep === 'new-password' && (
                <div className="space-y-3.5">
                  <div className="p-3 bg-[#19A68C]/10 border border-[#19A68C]/30 rounded-lg text-xs text-[#142B45]">
                    OTP verified for <span className="font-semibold">{email}</span>. Set your new password below.
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#142B45] mb-1">New Password (min 6 characters)</label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        className="w-full px-3.5 py-2.5 pr-10 bg-[#F5F7FA] border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#19A68C]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((prev) => !prev)}
                        aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-[#142B45]"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#142B45] mb-1">Confirm New Password</label>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="w-full px-3.5 py-2.5 bg-[#F5F7FA] border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#19A68C]"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-[#142B45] hover:bg-[#1e3e63] disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors"
              >
                {loading
                  ? 'Processing...'
                  : recoverStep === 'email'
                    ? 'Send OTP'
                    : recoverStep === 'otp'
                      ? 'Verify OTP'
                      : 'Set New Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
