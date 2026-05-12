import { useState } from 'react';

export interface AdminPermissions {
  edit_players: boolean;
  delete_players: boolean;
  manage_backups: boolean;
  manage_beta_testers: boolean;
  publish_release: boolean;
}

export const DEFAULT_PERMISSIONS: AdminPermissions = {
  edit_players: true,
  delete_players: true,
  manage_backups: true,
  manage_beta_testers: true,
  publish_release: false,
};

export const FEATURE_LABELS: Record<keyof AdminPermissions, { label: string; icon: string; description: string }> = {
  edit_players: { label: 'Edit Players', icon: '✏️', description: 'Edit player names, wins, and losses' },
  delete_players: { label: 'Delete Players', icon: '🗑️', description: 'Permanently delete players from database' },
  manage_backups: { label: 'System Backups', icon: '💾', description: 'Create, restore, and delete leaderboard backups' },
  manage_beta_testers: { label: 'Beta Testers', icon: '🧪', description: 'Invite and remove beta test users' },
  publish_release: { label: 'Publish Release', icon: '🚀', description: 'Toggle public release of features globally' },
};

interface AdminManagementProps {
  adminPermissions: Record<string, AdminPermissions>;
  mainAdminEmail: string;
  onSavePermissions: (perms: Record<string, AdminPermissions>) => Promise<void>;
}

export const AdminManagement = ({
  adminPermissions,
  mainAdminEmail,
  onSavePermissions,
}: AdminManagementProps) => {
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newAdminEmail.toLowerCase().trim();
    if (!clean || clean === mainAdminEmail || adminPermissions[clean]) return;

    setSaving(true);
    try {
      const updated = { ...adminPermissions, [clean]: { ...DEFAULT_PERMISSIONS } };
      await onSavePermissions(updated);
      setNewAdminEmail('');
    } catch (err) {
      console.error('Failed to add admin:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePermission = async (email: string, feature: keyof AdminPermissions) => {
    const current = adminPermissions[email] || { ...DEFAULT_PERMISSIONS };
    const updated = {
      ...adminPermissions,
      [email]: { ...current, [feature]: !current[feature] },
    };
    await onSavePermissions(updated);
  };

  const handleRemoveAdmin = async (email: string) => {
    if (!confirm(`Remove ${email} as admin? They will lose all admin privileges.`)) return;
    const updated = { ...adminPermissions };
    delete updated[email];
    await onSavePermissions(updated);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="font-cyber font-black text-2xl sm:text-3xl mb-1 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
          👑 Admin Management
        </h1>
        <p className="text-gray-400 text-sm">Control feature access for other administrators.</p>
      </div>

      {/* Main Admin Badge */}
      <div
        className="border rounded-2xl p-5 flex items-center gap-4"
        style={{
          background: 'linear-gradient(135deg, rgba(234,179,8,0.08), rgba(249,115,22,0.08))',
          borderColor: 'rgba(234,179,8,0.3)',
        }}
      >
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-xl flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, #facc15, #f97316)',
            boxShadow: '0 0 20px rgba(234,179,8,0.4)',
          }}
        >
          👑
        </div>
        <div>
          <p className="text-yellow-400 font-cyber font-bold text-sm uppercase tracking-wider">
            Main Administrator
          </p>
          <p className="text-white font-bold">{mainAdminEmail}</p>
          <p className="text-gray-500 text-[10px] mt-0.5">
            Full access to all features • Cannot be modified
          </p>
        </div>
      </div>

      {/* Add New Admin */}
      <div className="glass-dark border border-white/10 rounded-2xl p-6">
        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
          <span className="text-lg">➕</span> Add New Admin
        </h3>
        <form onSubmit={handleAddAdmin} className="flex gap-3">
          <input
            type="email"
            value={newAdminEmail}
            onChange={(e) => setNewAdminEmail(e.target.value)}
            placeholder="Enter Google Email Address..."
            className="flex-1 bg-black/50 border border-white/20 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-yellow-400 focus:shadow-[0_0_15px_rgba(234,179,8,0.3)] transition-all"
            required
            disabled={saving}
          />
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-cyber font-bold rounded-xl hover:from-yellow-400 hover:to-orange-400 hover:shadow-[0_0_20px_rgba(234,179,8,0.5)] transition-all active:scale-95 disabled:opacity-50 flex-shrink-0"
          >
            {saving ? '...' : 'Add →'}
          </button>
        </form>
      </div>

      {/* Admin List with Permissions */}
      <div>
        <h3 className="font-bold text-white mb-4 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span className="text-lg">🛡️</span>
            Admin Roster ({Object.keys(adminPermissions).length})
          </span>
          <span className="text-xs text-gray-500 font-normal">Synced to Firestore</span>
        </h3>

        {Object.keys(adminPermissions).length === 0 ? (
          <div className="bg-black/40 border border-white/5 rounded-2xl p-8 text-center text-gray-500 text-sm">
            No other admins configured yet. Add one above.
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(adminPermissions).map(([email, perms]) => (
              <div
                key={email}
                className="bg-black/40 border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition-all"
              >
                {/* Admin Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold uppercase"
                      style={{
                        background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
                        boxShadow: '0 4px 15px rgba(139,92,246,0.3)',
                      }}
                    >
                      {email[0]}
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm">{email}</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                        {Object.values(perms).filter(Boolean).length}/
                        {Object.keys(perms).length} features active
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveAdmin(email)}
                    className="text-[10px] font-bold uppercase tracking-wider text-red-500 px-3 py-1.5 rounded-lg border border-red-500/30 hover:bg-red-500 hover:text-white transition-all"
                  >
                    Remove
                  </button>
                </div>

                {/* Permissions Grid */}
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(
                    Object.entries(FEATURE_LABELS) as [
                      keyof AdminPermissions,
                      (typeof FEATURE_LABELS)[keyof AdminPermissions],
                    ][]
                  ).map(([featureKey, featureInfo]) => {
                    const isEnabled = perms[featureKey];
                    return (
                      <button
                        key={featureKey}
                        onClick={() => handleTogglePermission(email, featureKey)}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left group ${
                          isEnabled
                            ? 'bg-green-500/10 border-green-500/30 hover:border-green-400'
                            : 'bg-red-500/5 border-red-500/20 hover:border-red-400 opacity-60'
                        }`}
                      >
                        <span className="text-lg flex-shrink-0">{featureInfo.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`font-bold text-xs ${
                              isEnabled ? 'text-green-400' : 'text-red-400'
                            }`}
                          >
                            {featureInfo.label}
                          </p>
                          <p className="text-gray-500 text-[9px] truncate">
                            {featureInfo.description}
                          </p>
                        </div>
                        <div
                          className={`w-8 h-5 rounded-full flex-shrink-0 transition-all relative ${
                            isEnabled ? 'bg-green-500' : 'bg-red-500/40'
                          }`}
                        >
                          <div
                            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                              isEnabled ? 'left-[14px]' : 'left-0.5'
                            }`}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
