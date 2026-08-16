import React, { useState } from 'react';
import { 
  Database, 
  X, 
  Check, 
  Copy, 
  ExternalLink, 
  RefreshCw, 
  Lock, 
  User, 
  ShieldCheck, 
  Github, 
  Cloud, 
  FileCode, 
  CheckCircle2, 
  AlertCircle,
  Sparkles,
  Server
} from 'lucide-react';
import { TransportLane, AlertNotification, AuditLogEntry, SupabaseSettings, SupabaseUser, CloudSyncState } from '../types';
import { 
  getSavedSupabaseConfig, 
  saveSupabaseConfig, 
  getActiveUser, 
  setActiveUser, 
  syncDataToSupabase, 
  SUPABASE_SQL_MIGRATION,
  DEFAULT_SUPABASE_USER 
} from '../services/supabaseService';

interface SupabaseSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  lanes: TransportLane[];
  alerts: AlertNotification[];
  auditLogs: AuditLogEntry[];
  onSyncComplete?: (state: CloudSyncState) => void;
}

export const SupabaseSyncModal: React.FC<SupabaseSyncModalProps> = ({
  isOpen,
  onClose,
  lanes,
  alerts,
  auditLogs,
  onSyncComplete
}) => {
  const [activeTab, setActiveTab] = useState<'CONNECT' | 'SQL_SCHEMA' | 'USER_AUTH' | 'GITHUB_SYNC'>('CONNECT');
  const [config, setConfig] = useState<SupabaseSettings>(getSavedSupabaseConfig());
  const [user, setUser] = useState<SupabaseUser>(getActiveUser());
  const [copiedSql, setCopiedSql] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<CloudSyncState | null>(null);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState('');

  if (!isOpen) return null;

  const handleSaveConfig = () => {
    saveSupabaseConfig(config);
    setSaveSuccessMessage('Supabase credentials saved successfully.');
    setTimeout(() => setSaveSuccessMessage(''), 3000);
  };

  const handleTestAndSync = async () => {
    setIsSyncing(true);
    handleSaveConfig();
    try {
      const result = await syncDataToSupabase(lanes, alerts, auditLogs);
      setSyncResult(result);
      if (onSyncComplete) onSyncComplete(result);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_MIGRATION);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const handleSaveUser = () => {
    setActiveUser(user);
    setSaveSuccessMessage('User profile updated and session persisted.');
    setTimeout(() => setSaveSuccessMessage(''), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Cloud Database & Online Persistence
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-normal">
                  Supabase & GitHub
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Real database sync for logins, users, lanes, temperature telemetry, and online code persistence
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-800 bg-slate-950/40 text-xs">
          <button
            onClick={() => setActiveTab('CONNECT')}
            className={`pb-3 font-semibold transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'CONNECT'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Server className="w-4 h-4" /> Supabase Connection
          </button>
          <button
            onClick={() => setActiveTab('SQL_SCHEMA')}
            className={`pb-3 font-semibold transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'SQL_SCHEMA'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-4 h-4" /> 1-Click SQL Tables
          </button>
          <button
            onClick={() => setActiveTab('USER_AUTH')}
            className={`pb-3 font-semibold transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'USER_AUTH'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-4 h-4" /> User Login & Roles
          </button>
          <button
            onClick={() => setActiveTab('GITHUB_SYNC')}
            className={`pb-3 font-semibold transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'GITHUB_SYNC'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Github className="w-4 h-4" /> GitHub Online Export
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-300">
          
          {saveSuccessMessage && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{saveSuccessMessage}</span>
            </div>
          )}

          {/* TAB 1: CONNECT SUPABASE */}
          {activeTab === 'CONNECT' && (
            <div className="space-y-4">
              <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200 text-sm">Supabase Project API Credentials</span>
                  <a
                    href="https://supabase.com/dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-emerald-400 hover:underline"
                  >
                    Open Supabase Dashboard <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Project URL (e.g. https://xyzcompany.supabase.co)</label>
                  <input
                    type="text"
                    value={config.url}
                    onChange={(e) => setConfig({ ...config, url: e.target.value })}
                    placeholder="https://your-project.supabase.co"
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Public Anon Key (Client API Key)</label>
                  <input
                    type="password"
                    value={config.anonKey}
                    onChange={(e) => setConfig({ ...config, anonKey: e.target.value })}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-slate-400">
                    Keys are safely stored locally in your browser session.
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSaveConfig}
                      className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-colors"
                    >
                      Save Keys
                    </button>
                    <button
                      onClick={handleTestAndSync}
                      disabled={isSyncing}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-md transition-colors disabled:opacity-50"
                    >
                      {isSyncing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      Sync All Tables to Supabase
                    </button>
                  </div>
                </div>
              </div>

              {/* Sync Status Card */}
              {syncResult && (
                <div className={`p-4 rounded-xl border ${
                  syncResult.status === 'synced' 
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                    : syncResult.status === 'offline_cached'
                      ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}>
                  <div className="font-bold mb-1 flex items-center justify-between">
                    <span>
                      Sync Status: {syncResult.status === 'synced' ? 'Live Cloud Connected' : syncResult.status === 'offline_cached' ? 'Fast Local Persistence' : 'Sync Notice'}
                    </span>
                    <span className="text-[10px] font-mono opacity-80">{syncResult.lastSyncedAt ? new Date(syncResult.lastSyncedAt).toLocaleTimeString() : '--'}</span>
                  </div>
                  <p className="text-[11px] opacity-90 mb-2">
                    {syncResult.errorMessage || 'All pharmaceutical lane records, real-time alerts, and audit logs successfully synced.'}
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                    <div className="bg-slate-900/60 p-1.5 rounded">
                      <span className="block opacity-75">Lanes</span>
                      <strong>{syncResult.syncedTables.lanes}</strong>
                    </div>
                    <div className="bg-slate-900/60 p-1.5 rounded">
                      <span className="block opacity-75">Alerts</span>
                      <strong>{syncResult.syncedTables.alerts}</strong>
                    </div>
                    <div className="bg-slate-900/60 p-1.5 rounded">
                      <span className="block opacity-75">Audit Logs</span>
                      <strong>{syncResult.syncedTables.auditLogs}</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SQL SCHEMA */}
          {activeTab === 'SQL_SCHEMA' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-200">Supabase SQL Migration Script</h3>
                  <p className="text-slate-400 text-[11px]">Copy and paste into your Supabase project's SQL Editor to instantiate all tables in 2 seconds.</p>
                </div>
                <button
                  onClick={handleCopySql}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md transition-colors"
                >
                  {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedSql ? 'Copied to Clipboard!' : 'Copy SQL'}
                </button>
              </div>

              <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-[11px] font-mono text-emerald-400/90 overflow-x-auto max-h-72 select-all leading-relaxed">
                {SUPABASE_SQL_MIGRATION}
              </pre>
            </div>
          )}

          {/* TAB 3: USER AUTH & ROLES */}
          {activeTab === 'USER_AUTH' && (
            <div className="space-y-4">
              <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-3">
                <h3 className="font-bold text-slate-200 text-sm">Authenticated User Session Profile</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Full Name</label>
                    <input
                      type="text"
                      value={user.name}
                      onChange={(e) => setUser({ ...user, name: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Corporate Email</label>
                    <input
                      type="email"
                      value={user.email}
                      onChange={(e) => setUser({ ...user, email: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Assigned Role</label>
                    <select
                      value={user.role}
                      onChange={(e) => setUser({ ...user, role: e.target.value as any })}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="Quality Lead">Quality Lead (GDP Sign-off & CAPA)</option>
                      <option value="Logistics Director">Logistics Director (Route & Carrier Dispatch)</option>
                      <option value="GDP Auditor">GDP Auditor (Read-only Verification)</option>
                      <option value="Supply Chain Analyst">Supply Chain Analyst (Risk Prediction)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Organization</label>
                    <input
                      type="text"
                      value={user.organization}
                      onChange={(e) => setUser({ ...user, organization: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSaveUser}
                    className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors"
                  >
                    Save User Profile
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: GITHUB ONLINE EXPORT */}
          {activeTab === 'GITHUB_SYNC' && (
            <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-slate-100 font-bold text-sm">
                <Github className="w-5 h-5 text-white" />
                Online Code Persistence & GitHub Sync
              </div>
              <p className="text-slate-400 text-xs leading-relaxed">
                Your application code (both React frontend, Express server, Google Maps components, and Supabase connectors) is preserved online in Google AI Studio and can be exported directly to your GitHub account:
              </p>

              <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-4 space-y-2.5 text-xs text-slate-300">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-200 flex items-center justify-center font-bold text-[11px] shrink-0">1</span>
                  <span>
                    Click the <strong>Settings</strong> (⚙️ gear icon) in the top-right corner of Google AI Studio.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-200 flex items-center justify-center font-bold text-[11px] shrink-0">2</span>
                  <span>
                    Select <strong>Export to GitHub</strong> to create or push directly to a new repository on your GitHub account.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-200 flex items-center justify-center font-bold text-[11px] shrink-0">3</span>
                  <span>
                    Or choose <strong>Download ZIP</strong> to save the entire source tree locally.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-200 flex items-center justify-center font-bold text-[11px] shrink-0">4</span>
                  <span>
                    Use <strong>Deploy to Cloud Run</strong> for continuous live production hosting.
                  </span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs">
          <span className="text-slate-400">
            Current User: <strong className="text-slate-200">{user.name}</strong> ({user.role})
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
