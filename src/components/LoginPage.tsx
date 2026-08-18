import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Mail,
  Key,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  UserCheck,
  Eye,
  EyeOff,
  Building2,
  Fingerprint,
  RefreshCw,
  Users,
} from 'lucide-react';
import { SupabaseUser } from '../types';
import { signInWithEmail, signUpWithEmail, sendPasswordReset } from '../services/supabaseService';
import { useThemeTokens } from '../contexts/ViewModeContext';

interface LoginPageProps {
  onLoginSuccess: (user: SupabaseUser) => void;
  onCancel?: () => void;
  currentUser?: SupabaseUser | null;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  onCancel,
  currentUser
}) => {
  const t = useThemeTokens();
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER' | 'SSO'>('LOGIN');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [fullName, setFullName] = useState<string>('');
  const [organization, setOrganization] = useState<string>('');
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState<boolean>(false);
  const [showForgotPassword, setShowForgotPassword] = useState<boolean>(false);
  const [resetEmail, setResetEmail] = useState<string>('');
  const [resetSent, setResetSent] = useState<boolean>(false);
  const [resetError, setResetError] = useState<string | null>(null);

  // Real Supabase Auth submit — signInWithPassword for Sign In, auth.signUp for Register.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setNeedsEmailConfirmation(false);

    if (!email || !email.includes('@')) {
      setErrorMsg('Please enter a valid work email address.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must contain at least 6 characters.');
      return;
    }

    setIsLoading(true);

    if (authMode === 'LOGIN') {
      const result = await signInWithEmail(email, password);
      setIsLoading(false);

      if (!result.success || !result.user) {
        setErrorMsg(result.message);
        return;
      }

      setSuccessMsg(`Authenticated successfully. Welcome back, ${result.user.name}!`);
      setTimeout(() => onLoginSuccess(result.user!), 500);
    } else {
      if (!fullName.trim()) {
        setIsLoading(false);
        setErrorMsg('Full Name is required for 21 CFR Part 11 accountability.');
        return;
      }

      const result = await signUpWithEmail(email, password, {
        fullName,
        organization: organization || 'Unassigned Organization',
      });
      setIsLoading(false);

      if (!result.success) {
        setErrorMsg(result.message);
        return;
      }

      if (result.needsEmailConfirmation) {
        setNeedsEmailConfirmation(true);
        setSuccessMsg(result.message);
        return;
      }

      setSuccessMsg(result.message);
      if (result.user) {
        setTimeout(() => onLoginSuccess(result.user!), 600);
      }
    }
  };

  const handleSendPasswordReset = async () => {
    setResetError(null);
    const target = resetEmail || email;
    if (!target || !target.includes('@')) {
      setResetError('Enter a valid email address first.');
      return;
    }
    const result = await sendPasswordReset(target);
    if (!result.success) {
      setResetError(result.message);
      return;
    }
    setResetSent(true);
  };

  const inputClass = `w-full ${t.cardBgSunken} border ${t.light ? 'border-slate-300' : 'border-slate-700'} rounded-lg px-3 py-2 text-xs ${t.textPrimary} ${t.light ? 'placeholder-slate-400' : 'placeholder-slate-500'} focus:outline-none focus:border-teal-500`;
  const authTabClass = (mode: typeof authMode) => `px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
    authMode === mode
      ? t.light ? 'bg-teal-100 text-teal-700 border border-teal-300' : 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
      : `${t.textMuted} ${t.light ? 'hover:text-slate-900' : 'hover:text-slate-200'}`
  }`;

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-6 px-4">
      <div className={`w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-6 ${t.cardBg} border ${t.light ? 'border-slate-300' : 'border-slate-800'} rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl`}>

        {/* Left Side: Brand & Why Sign In */}
        <div className={`lg:col-span-5 p-6 sm:p-8 flex flex-col justify-between border-b lg:border-b-0 lg:border-r ${t.border} ${
          t.light ? 'bg-gradient-to-br from-slate-50 via-white to-slate-50' : 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950'
        }`}>
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-lg shadow-teal-500/20">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h1 className={`text-xl font-black tracking-tight flex items-center gap-2 ${t.textPrimary}`}>
                  PharmaTrack<span className={t.light ? 'text-teal-600' : 'text-teal-400'}>GDP</span>
                </h1>
                <p className={`text-[11px] font-medium ${t.textMuted}`}>
                  Cold-Chain & Telemetry Security Gateway
                </p>
              </div>
            </div>

            <div className={`mb-4 rounded-xl p-3.5 border ${t.cardBgSunken} ${t.border}`}>
              <div className={`flex items-center gap-2 text-xs font-bold mb-1.5 ${t.light ? 'text-teal-600' : 'text-teal-400'}`}>
                <Users className="w-3.5 h-3.5" />
                <span>What signing in unlocks</span>
              </div>
              <p className={`text-[11px] leading-relaxed ${t.textMuted}`}>
                Advanced mode's full operational console — the lane management table, per-leg carrier assignment,
                mid-transit disruption reporting, GDP compliance trends, and the immutable audit trail — all backed
                by real Supabase data instead of the local demo dataset. Simple mode stays open without an account.
              </p>
            </div>

            <div className={`p-3 rounded-lg border text-[11px] flex items-start gap-2 ${
              t.light ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
            }`}>
              <CheckCircle2 className={`w-4 h-4 flex-shrink-0 mt-0.5 ${t.light ? 'text-emerald-600' : 'text-emerald-400'}`} />
              <span>
                <strong>21 CFR Part 11 Compliant</strong>: All actions, excursions, and CAPA signoffs are timestamped and cryptographically hashed.
              </span>
            </div>
          </div>

          <div className={`mt-6 pt-4 border-t flex items-center justify-between text-[11px] ${t.light ? 'border-slate-200' : 'border-slate-800/80'} ${t.textFaint}`}>
            <span>Security Layer v4.2</span>
            <span>Supabase Cloud Sync Ready</span>
          </div>
        </div>

        {/* Right Side: Interactive Login / Register Form */}
        <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between">
          <div>
            {/* Top Auth Mode Tabs */}
            <div className={`flex items-center justify-between border-b pb-3 mb-6 ${t.border}`}>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setAuthMode('LOGIN');
                    setErrorMsg(null);
                    setNeedsEmailConfirmation(false);
                  }}
                  className={authTabClass('LOGIN')}
                >
                  Sign In
                </button>
                <button
                  onClick={() => {
                    setAuthMode('REGISTER');
                    setErrorMsg(null);
                    setNeedsEmailConfirmation(false);
                  }}
                  className={authTabClass('REGISTER')}
                >
                  Register Account
                </button>
                <button
                  onClick={() => {
                    setAuthMode('SSO');
                    setErrorMsg(null);
                    setNeedsEmailConfirmation(false);
                  }}
                  className={authTabClass('SSO')}
                >
                  Enterprise SSO
                </button>
              </div>

              {onCancel && (
                <button
                  onClick={onCancel}
                  className={`text-xs font-medium ${t.textMuted} ${t.light ? 'hover:text-slate-900' : 'hover:text-slate-200'}`}
                >
                  Back to App
                </button>
              )}
            </div>

            {/* Error / Success Feedback */}
            {errorMsg && (
              <div className={`mb-4 p-3 rounded-lg text-xs flex items-center gap-2 border ${
                t.light ? 'bg-rose-50 border-rose-300 text-rose-700' : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
              }`}>
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && !needsEmailConfirmation && (
              <div className={`mb-4 p-3 rounded-lg text-xs flex items-center gap-2 border ${
                t.light ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              }`}>
                <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${t.light ? 'text-emerald-600' : 'text-emerald-400'}`} />
                <span>{successMsg}</span>
              </div>
            )}

            {needsEmailConfirmation && (
              <div className={`mb-4 p-4 rounded-xl text-center border ${t.light ? 'bg-teal-50 border-teal-300' : 'bg-teal-500/10 border-teal-500/30'}`}>
                <Mail className={`w-8 h-8 mx-auto mb-2 ${t.light ? 'text-teal-600' : 'text-teal-400'}`} />
                <div className={`text-sm font-bold mb-1 ${t.light ? 'text-teal-700' : 'text-teal-200'}`}>Confirm your email to finish signing up</div>
                <p className={`text-[11px] ${t.textMuted}`}>{successMsg}</p>
                <button
                  type="button"
                  onClick={() => {
                    setNeedsEmailConfirmation(false);
                    setSuccessMsg(null);
                    setAuthMode('LOGIN');
                  }}
                  className={`mt-3 text-[11px] hover:underline font-semibold ${t.light ? 'text-teal-600' : 'text-teal-400'}`}
                >
                  Back to Sign In
                </button>
              </div>
            )}

            {/* FORM: STANDARD LOGIN / REGISTER */}
            {(authMode === 'LOGIN' || authMode === 'REGISTER') && !needsEmailConfirmation && (
              <form onSubmit={handleSubmit} className="space-y-4">
                {authMode === 'REGISTER' && (
                  <div>
                    <label className={`block text-xs font-semibold mb-1.5 ${t.textSecondary}`}>
                      Full Legal Name (for 21 CFR Part 11 Audit Trail)
                    </label>
                    <div className="relative">
                      <UserCheck className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${t.textFaint}`} />
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Dr. Alex Mercer"
                        className={`${inputClass} pl-9 pr-3`}
                        required
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className={`block text-xs font-semibold mb-1.5 ${t.textSecondary}`}>
                    Authorized Work Email
                  </label>
                  <div className="relative">
                    <Mail className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${t.textFaint}`} />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      className={`${inputClass} pl-9 pr-3`}
                      required
                    />
                  </div>
                </div>

                {authMode === 'REGISTER' && (
                  <div className="space-y-3">
                    <div>
                      <label className={`block text-xs font-semibold mb-1.5 ${t.textSecondary}`}>
                        Organization / Facility
                      </label>
                      <div className="relative">
                        <Building2 className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${t.textFaint}`} />
                        <input
                          type="text"
                          value={organization}
                          onChange={(e) => setOrganization(e.target.value)}
                          placeholder="e.g. Novartis BioPharma"
                          className={`${inputClass} pl-9 pr-3`}
                        />
                      </div>
                    </div>
                    <p className={`text-[11px] leading-relaxed ${t.textFaint}`}>
                      New accounts start as <strong className={t.textSecondary}>Supply Chain Analyst</strong> — the
                      role with no CAPA/certification or critical-alert sign-off authority. An existing Quality Lead
                      or GDP Auditor can grant a higher role afterward from Settings.
                    </p>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className={`block text-xs font-semibold ${t.textSecondary}`}>
                      Password
                    </label>
                    {authMode === 'LOGIN' && (
                      <button
                        type="button"
                        onClick={() => setShowForgotPassword(true)}
                        className={`text-[11px] hover:underline ${t.light ? 'text-teal-600' : 'text-teal-400'}`}
                      >
                        Forgot Password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${t.textFaint}`} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className={`${inputClass} pl-9 pr-9`}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className={`absolute right-3 top-1/2 -translate-y-1/2 ${t.textFaint} ${t.light ? 'hover:text-slate-700' : 'hover:text-slate-300'}`}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <label className={`flex items-center gap-2 cursor-pointer select-none ${t.textMuted} ${t.light ? 'hover:text-slate-900' : 'hover:text-slate-200'}`}>
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className={`rounded text-teal-500 focus:ring-0 ${t.light ? 'border-slate-300 bg-white' : 'border-slate-700 bg-slate-950'}`}
                    />
                    <span>Remember this device for 30 days</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-slate-950 font-bold text-xs shadow-lg shadow-teal-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Verifying Cryptographic Credentials...</span>
                    </>
                  ) : (
                    <>
                      <span>{authMode === 'LOGIN' ? 'Sign In to Workspace' : 'Create GDP Authorized Account'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* SSO / ENTERPRISE MODE */}
            {authMode === 'SSO' && (
              <div className="space-y-4 py-2">
                <div className={`text-xs mb-3 ${t.textMuted}`}>
                  Enterprise single sign-on providers for this project:
                </div>

                <button
                  disabled
                  className={`w-full py-2.5 px-4 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2.5 cursor-not-allowed opacity-60 ${t.cardBgSunken} ${t.border} ${t.textFaint}`}
                >
                  <Building2 className="w-4 h-4" />
                  <span>Microsoft Azure AD / Entra ID</span>
                </button>

                <button
                  disabled
                  className={`w-full py-2.5 px-4 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2.5 cursor-not-allowed opacity-60 ${t.cardBgSunken} ${t.border} ${t.textFaint}`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Okta Enterprise SSO</span>
                </button>

                <button
                  disabled
                  className={`w-full py-2.5 px-4 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2.5 cursor-not-allowed opacity-60 ${t.cardBgSunken} ${t.border} ${t.textFaint}`}
                >
                  <Fingerprint className="w-4 h-4" />
                  <span>Google Workspace SAML</span>
                </button>

                <div className={`p-3 rounded-lg border text-[11px] flex items-start gap-2 ${
                  t.light ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                }`}>
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>No SSO provider is enabled on this Supabase project yet. Enable one under Authentication → Providers, then these buttons can be wired to <code className={t.light ? 'text-amber-800' : 'text-amber-200'}>supabase.auth.signInWithOAuth()</code>. Use email Sign In / Register for now.</span>
                </div>
              </div>
            )}
          </div>

          <div className={`mt-6 pt-4 border-t text-[11px] text-center ${t.border} ${t.textFaint}`}>
            Protected by 256-bit encryption & GDP 21 CFR Part 11 electronic records.
          </div>
        </div>

      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className={`fixed inset-0 backdrop-blur-md z-50 flex items-center justify-center p-4 ${t.light ? 'bg-slate-900/40' : 'bg-slate-950/80'}`}>
          <div className={`w-full max-w-md ${t.cardBg} border ${t.light ? 'border-slate-300' : 'border-slate-800'} rounded-xl p-6 shadow-2xl`}>
            <h3 className={`text-base font-bold mb-2 flex items-center gap-2 ${t.textPrimary}`}>
              <Key className={`w-5 h-5 ${t.light ? 'text-teal-600' : 'text-teal-400'}`} />
              Reset Security Password
            </h3>
            <p className={`text-xs mb-4 ${t.textMuted}`}>
              Enter your account email — Supabase will send a secure password reset link to it.
            </p>

            {resetError && (
              <div className={`p-3 rounded-lg text-xs mb-4 flex items-center gap-2 border ${
                t.light ? 'bg-rose-50 border-rose-300 text-rose-700' : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
              }`}>
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{resetError}</span>
              </div>
            )}

            {resetSent ? (
              <div className={`p-3 rounded-lg text-xs mb-4 flex items-center gap-2 border ${
                t.light ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              }`}>
                <CheckCircle2 className={`w-4 h-4 ${t.light ? 'text-emerald-600' : 'text-emerald-400'}`} />
                <span>Reset link sent to {resetEmail || email}. Check your inbox.</span>
              </div>
            ) : (
              <div className="mb-4">
                <label className={`block text-xs font-medium mb-1.5 ${t.textSecondary}`}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={resetEmail || email}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="name@company.com"
                  className={inputClass}
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(false);
                  setResetSent(false);
                  setResetError(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${t.textMuted} ${t.light ? 'hover:text-slate-900' : 'hover:text-slate-200'}`}
              >
                Close
              </button>
              {!resetSent && (
                <button
                  type="button"
                  onClick={handleSendPasswordReset}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-teal-500 text-slate-950 hover:bg-teal-400 transition-colors"
                >
                  Send Reset Link
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
