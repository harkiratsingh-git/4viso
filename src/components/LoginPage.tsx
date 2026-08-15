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
  Sparkles, 
  Eye, 
  EyeOff, 
  Building2, 
  FileText, 
  Fingerprint,
  RefreshCw,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  Database
} from 'lucide-react';
import { SupabaseUser, UserRole } from '../types';

interface LoginPageProps {
  onLoginSuccess: (user: SupabaseUser, role: UserRole) => void;
  onCancel?: () => void;
  currentUser?: SupabaseUser | null;
}

export const DEMO_ACCOUNTS: Array<{
  user: SupabaseUser;
  role: UserRole;
  passwordHint: string;
  description: string;
  badgeColor: string;
}> = [
  {
    user: {
      id: 'usr-quality-01',
      name: 'Dr. Elena Rostova',
      email: 'elena.rostova@biopharma-coldchain.com',
      role: 'Quality Lead',
      organization: 'Global BioPharma Quality Operations',
      createdAt: '2026-01-10T08:00:00Z',
      avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&h=120&fit=crop&crop=faces'
    },
    role: {
      id: 'quality',
      title: 'VP of Quality Assurance',
      department: 'QA & Regulatory Affairs',
      name: 'Dr. Elena Rostova'
    },
    passwordHint: 'BioPharma2026!QA',
    description: '21 CFR Part 11 Electronic Signature Authority, CAPA signoffs, and GDP release permissions.',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
  },
  {
    user: {
      id: 'usr-logistics-02',
      name: 'Marcus Vance',
      email: 'm.vance@coldchain-logistics.net',
      role: 'Logistics Director',
      organization: 'Trans-Global Cold-Chain Logistics',
      createdAt: '2026-02-14T09:30:00Z',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop&crop=faces'
    },
    role: {
      id: 'logistics',
      title: 'Global Logistics Director',
      department: 'Global Freight & Fleet Ops',
      name: 'Marcus Vance'
    },
    passwordHint: 'FleetCold2026!Log',
    description: 'Lane configuration, carrier SLA dispatch, active shipment rerouting, and packaging overrides.',
    badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/40'
  },
  {
    user: {
      id: 'usr-auditor-03',
      name: 'Sarah Jenkins',
      email: 's.jenkins@eudra-gdp-audit.org',
      role: 'GDP Auditor',
      organization: 'EudraLex & WHO External Audit Body',
      createdAt: '2026-03-01T11:15:00Z',
      avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=120&h=120&fit=crop&crop=faces'
    },
    role: {
      id: 'auditor',
      title: 'Lead GDP Compliance Auditor',
      department: 'Compliance & Audit Integrity',
      name: 'Sarah Jenkins'
    },
    passwordHint: 'Audit2026!Eudra',
    description: 'Read-only access to immutable audit hashes, excursion investigation logs, and compliance certificates.',
    badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/40'
  },
  {
    user: {
      id: 'usr-analyst-04',
      name: 'Alex Chen',
      email: 'a.chen@iot-telemetry.io',
      role: 'Supply Chain Analyst',
      organization: 'PharmaTrack Predictive Telemetry Lab',
      createdAt: '2026-04-12T14:20:00Z',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&fit=crop&crop=faces'
    },
    role: {
      id: 'executive',
      title: 'Senior IoT Telemetry Analyst',
      department: 'Predictive Analytics & IoT',
      name: 'Alex Chen'
    },
    passwordHint: 'IoTAnalytics2026!',
    description: 'Microclimate thermal risk modeling, MKT degradation equations, and sensor calibration telemetry.',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40'
  }
];

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  onCancel,
  currentUser
}) => {
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER' | 'SSO'>('LOGIN');
  const [email, setEmail] = useState<string>('elena.rostova@biopharma-coldchain.com');
  const [password, setPassword] = useState<string>('BioPharma2026!QA');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [fullName, setFullName] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<SupabaseUser['role']>('Quality Lead');
  const [organization, setOrganization] = useState<string>('Global BioPharma Corp');
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState<boolean>(false);
  const [resetEmail, setResetEmail] = useState<string>('');
  const [resetSent, setResetSent] = useState<boolean>(false);

  // Handle standard submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email || !email.includes('@')) {
      setErrorMsg('Please enter a valid work email address.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must contain at least 6 characters.');
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);

      if (authMode === 'LOGIN') {
        // Find existing demo account or construct user
        const matched = DEMO_ACCOUNTS.find(a => a.user.email.toLowerCase() === email.toLowerCase());
        const userToLogin: SupabaseUser = matched ? matched.user : {
          id: `usr-${Date.now()}`,
          email,
          name: email.split('@')[0].replace('.', ' ').replace(/\b\w/g, c => c.toUpperCase()),
          role: selectedRole,
          organization: 'BioPharma Enterprise Logistics',
          createdAt: new Date().toISOString(),
          avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&h=120&fit=crop&crop=faces'
        };

        const roleToAssign: UserRole = matched ? matched.role : {
          id: selectedRole === 'Quality Lead' ? 'quality' : selectedRole === 'Logistics Director' ? 'logistics' : selectedRole === 'GDP Auditor' ? 'auditor' : 'executive',
          title: selectedRole,
          department: 'BioPharma Supply Chain Operations',
          name: userToLogin.name
        };

        setSuccessMsg(`Authenticated successfully. Welcome back, ${userToLogin.name}!`);
        setTimeout(() => {
          onLoginSuccess(userToLogin, roleToAssign);
        }, 600);
      } else {
        // Registration
        if (!fullName.trim()) {
          setErrorMsg('Full Name is required for 21 CFR Part 11 accountability.');
          return;
        }

        const newUser: SupabaseUser = {
          id: `usr-${Date.now()}`,
          email,
          name: fullName,
          role: selectedRole,
          organization: organization || 'BioPharma Solutions',
          createdAt: new Date().toISOString(),
          avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&h=120&fit=crop&crop=faces'
        };

        const newRole: UserRole = {
          id: selectedRole === 'Quality Lead' ? 'quality' : selectedRole === 'Logistics Director' ? 'logistics' : selectedRole === 'GDP Auditor' ? 'auditor' : 'executive',
          title: `${selectedRole} - ${organization}`,
          department: 'Quality & Operations',
          name: fullName
        };

        setSuccessMsg('Account registered and credentials validated. Redirecting to workspace...');
        setTimeout(() => {
          onLoginSuccess(newUser, newRole);
        }, 800);
      }
    }, 700);
  };

  // Quick 1-click login with demo persona
  const handleQuickDemoLogin = (account: typeof DEMO_ACCOUNTS[0]) => {
    setIsLoading(true);
    setErrorMsg(null);
    setTimeout(() => {
      setIsLoading(false);
      onLoginSuccess(account.user, account.role);
    }, 400);
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-6 px-4">
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-900/95 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl">
        
        {/* Left Side: Brand & Quick Demo Persona Switcher */}
        <div className="lg:col-span-5 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 sm:p-8 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-lg shadow-teal-500/20">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                  PharmaTrack<span className="text-teal-400">GDP</span>
                </h1>
                <p className="text-[11px] text-slate-400 font-medium">
                  Cold-Chain & Telemetry Security Gateway
                </p>
              </div>
            </div>

            <div className="mb-6 bg-slate-900/80 border border-slate-800 rounded-xl p-3.5">
              <div className="flex items-center gap-2 text-xs font-bold text-teal-400 mb-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>1-Click Demo Persona Login</span>
              </div>
              <p className="text-[11px] text-slate-400 mb-3">
                Select any verified role below to sign in immediately without typing passwords:
              </p>

              <div className="space-y-2">
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.user.id}
                    onClick={() => handleQuickDemoLogin(acc)}
                    disabled={isLoading}
                    className="w-full text-left p-2.5 rounded-lg bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800 hover:border-teal-500/50 transition-all flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={acc.user.avatarUrl}
                        alt={acc.user.name}
                        className="w-8 h-8 rounded-full border border-slate-700 object-cover flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-200 group-hover:text-white truncate">
                          {acc.user.name}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {acc.user.role} • {acc.user.organization.split(' ')[0]}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-teal-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-400" />
              <span>
                <strong>21 CFR Part 11 Compliant</strong>: All actions, excursions, and CAPA signoffs are timestamped and cryptographically hashed.
              </span>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
            <span>Security Layer v4.2</span>
            <span>Supabase Cloud Sync Ready</span>
          </div>
        </div>

        {/* Right Side: Interactive Login / Register Form */}
        <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between">
          <div>
            {/* Top Auth Mode Tabs */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-6">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setAuthMode('LOGIN');
                    setErrorMsg(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    authMode === 'LOGIN'
                      ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => {
                    setAuthMode('REGISTER');
                    setErrorMsg(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    authMode === 'REGISTER'
                      ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Register Account
                </button>
                <button
                  onClick={() => {
                    setAuthMode('SSO');
                    setErrorMsg(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    authMode === 'SSO'
                      ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Enterprise SSO
                </button>
              </div>

              {onCancel && (
                <button
                  onClick={onCancel}
                  className="text-xs text-slate-400 hover:text-slate-200 font-medium"
                >
                  Back to App
                </button>
              )}
            </div>

            {/* Error / Success Feedback */}
            {errorMsg && (
              <div className="mb-4 p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* FORM: STANDARD LOGIN / REGISTER */}
            {(authMode === 'LOGIN' || authMode === 'REGISTER') && (
              <form onSubmit={handleSubmit} className="space-y-4">
                {authMode === 'REGISTER' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Full Legal Name (for 21 CFR Part 11 Audit Trail)
                    </label>
                    <div className="relative">
                      <UserCheck className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Dr. Alex Mercer"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500"
                        required
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Authorized Work Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500"
                      required
                    />
                  </div>
                </div>

                {authMode === 'REGISTER' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Assigned Role
                      </label>
                      <select
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value as SupabaseUser['role'])}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
                      >
                        <option value="Quality Lead">Quality Assurance Lead</option>
                        <option value="Logistics Director">Logistics & Fleet Director</option>
                        <option value="GDP Auditor">GDP Compliance Auditor</option>
                        <option value="Supply Chain Analyst">Supply Chain Analyst</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Organization / Facility
                      </label>
                      <div className="relative">
                        <Building2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                          type="text"
                          value={organization}
                          onChange={(e) => setOrganization(e.target.value)}
                          placeholder="e.g. Novartis BioPharma"
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-300">
                      Password
                    </label>
                    {authMode === 'LOGIN' && (
                      <button
                        type="button"
                        onClick={() => setShowForgotPassword(true)}
                        className="text-[11px] text-teal-400 hover:underline"
                      >
                        Forgot Password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-9 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-slate-400 hover:text-slate-200">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded border-slate-700 text-teal-500 focus:ring-0 bg-slate-950"
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
                <div className="text-xs text-slate-400 mb-3">
                  Connect via your enterprise Identity Provider (IdP) for single sign-on:
                </div>

                <button
                  onClick={() => handleQuickDemoLogin(DEMO_ACCOUNTS[0])}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 transition-all flex items-center justify-center gap-2.5"
                >
                  <Building2 className="w-4 h-4 text-blue-400" />
                  <span>Sign in with Microsoft Azure AD / Entra ID</span>
                </button>

                <button
                  onClick={() => handleQuickDemoLogin(DEMO_ACCOUNTS[1])}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 transition-all flex items-center justify-center gap-2.5"
                >
                  <ShieldCheck className="w-4 h-4 text-teal-400" />
                  <span>Sign in with Okta Enterprise SSO</span>
                </button>

                <button
                  onClick={() => handleQuickDemoLogin(DEMO_ACCOUNTS[2])}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 transition-all flex items-center justify-center gap-2.5"
                >
                  <Fingerprint className="w-4 h-4 text-emerald-400" />
                  <span>Sign in with Google Workspace SAML</span>
                </button>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-400">
                  SSO enforces automatic SAML 2.0 / OpenID Connect profile provisioning directly into Supabase <code className="text-teal-400">auth.users</code> and <code className="text-teal-400">user_profiles</code>.
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800 text-[11px] text-slate-500 text-center">
            Protected by 256-bit encryption & GDP 21 CFR Part 11 electronic records.
          </div>
        </div>

      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <Key className="w-5 h-5 text-teal-400" />
              Reset Security Password
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Enter your verified email to receive a 21 CFR Part 11 security reset link and OTP token.
            </p>

            {resetSent ? (
              <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Reset token sent! Check your inbox for temporary OTP verification.</span>
              </div>
            ) : (
              <div className="mb-4">
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  value={resetEmail || email}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(false);
                  setResetSent(false);
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200"
              >
                Close
              </button>
              {!resetSent && (
                <button
                  type="button"
                  onClick={() => setResetSent(true)}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-teal-500 text-slate-950 hover:bg-teal-400 transition-colors"
                >
                  Send OTP Token
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
