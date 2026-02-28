import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Bell,
  Sun,
  Moon,
  ShieldCheck,
  ChevronRight,
  HelpCircle,
  FileText,
  UserPlus,
  Download,
  CreditCard,
  BarChart3,
  Zap,
  Globe
} from 'lucide-react';

interface ControlDeckProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (item: string) => void;
  isAdmin?: boolean;
}

export const ControlDeck: React.FC<ControlDeckProps> = ({
  isOpen,
  onClose,
  onNavigate,
  isAdmin = true
}) => {
  // Filter quick actions based on role
  const quickActions = [
    { label: "New Quote", icon: FileText, color: "#D4FB46", onClick: () => onNavigate("Quote"), adminOnly: true },
    { label: "Invite Member", icon: UserPlus, color: "#0047FF", onClick: () => onNavigate("InviteMember"), adminOnly: true },
    { label: "Finance", icon: CreditCard, color: "#22C55E", onClick: () => onNavigate("Finance"), adminOnly: true },
    { label: "Analytics", icon: BarChart3, color: "#F59E0B", onClick: () => onNavigate("Analytics"), adminOnly: true },
  ].filter(action => isAdmin || !action.adminOnly);
  
  // For members, show alternative actions
  const memberActions = isAdmin ? [] : [
    { label: "My Schedule", icon: FileText, color: "#3B82F6", onClick: () => onNavigate("Events") },
    { label: "Band Info", icon: UserPlus, color: "#8B5CF6", onClick: () => onNavigate("BandMembers") },
  ];
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}
          className="fixed inset-0 z-[60] bg-[#050505] overflow-y-auto px-4 pb-32 text-white"
          style={{ 
            paddingTop: 'calc(env(safe-area-inset-top, 0px) + 48px)',
          }}
        >
          {/* Header */}
          <div className="flex justify-between items-start mb-8">
            <div>
              <span className="text-[#D4FB46] text-[10px] font-bold uppercase tracking-widest mb-1 block">Settings</span>
              <h2 className="text-3xl font-black tracking-tighter">Preferences</h2>
            </div>
            <button 
              onClick={onClose}
              className="w-12 h-12 rounded-full bg-[#1C1C1E] border border-white/10 flex items-center justify-center text-white active:scale-90 transition-transform"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Quick Actions - Role-based */}
          <h3 className="text-xs font-bold uppercase tracking-widest text-stone-500 mb-4 px-2">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3 mb-8">
            {[...quickActions, ...memberActions].map((item, i) => (
              <button 
                key={i} 
                onClick={item.onClick}
                className="h-24 bg-[#1C1C1E] rounded-[1.5rem] flex flex-col justify-between p-4 border border-white/5 hover:border-white/20 group transition-all active:scale-95"
              >
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${item.color}15` }}
                >
                  <item.icon className="w-5 h-5" style={{ color: item.color }} />
                </div>
                <span className="text-sm font-bold text-white/80 group-hover:text-white text-left">{item.label}</span>
              </button>
            ))}
          </div>

          {/* App Settings List */}
          <h3 className="text-xs font-bold uppercase tracking-widest text-stone-500 mb-4 px-2">App Settings</h3>
          <div className="bg-[#1C1C1E] rounded-[2rem] overflow-hidden border border-white/10 mb-8">
            {[
              { label: "Notifications", icon: Bell, subtitle: "Push, email, in-app", section: "notifications" },
              { label: "Appearance", icon: Sun, subtitle: "Dark mode", section: "appearance" },
              { label: "Language", icon: Globe, subtitle: "English", section: "language" },
              { label: "Privacy & Security", icon: ShieldCheck, subtitle: "Data, permissions", section: "privacy" }
            ].map((item, i) => (
              <button 
                key={i}
                onClick={() => onNavigate(`Settings:${item.section}`)} 
                className="w-full p-5 flex items-center justify-between border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                    <item.icon className="w-5 h-5 text-white/60" />
                  </div>
                  <div className="text-left">
                    <span className="font-bold text-sm block">{item.label}</span>
                    <span className="text-[11px] text-white/40">{item.subtitle}</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-stone-600" />
              </button>
            ))}
          </div>

          {/* Subscription/Pro Features */}
          <div className="bg-gradient-to-r from-[#D4FB46]/10 to-[#D4FB46]/5 rounded-[2rem] p-5 border border-[#D4FB46]/20 mb-8">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-[#D4FB46] flex items-center justify-center">
                <Zap className="w-6 h-6 text-black" />
              </div>
              <div>
                <h4 className="font-black text-white">Upgrade to Pro</h4>
                <p className="text-[12px] text-white/50">Unlock advanced features</p>
              </div>
            </div>
            <div className="flex gap-2">
              <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-white/10 text-white/60">Unlimited Quotes</span>
              <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-white/10 text-white/60">Analytics</span>
              <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-white/10 text-white/60">Priority Support</span>
            </div>
          </div>

          {/* Help & About */}
          <div className="space-y-3">
            <button 
              onClick={() => {
                window.open('mailto:support@bandwith.app?subject=Help%20Request', '_blank');
              }}
              className="w-full py-4 rounded-[1.5rem] bg-[#1C1C1E] border border-white/5 text-sm font-bold text-stone-300 hover:text-white flex items-center justify-center gap-2 hover:bg-white/5 transition-all"
            >
              <HelpCircle className="w-4 h-4" /> Help & Support
            </button>
            <button 
              onClick={() => {
                // Export user data as JSON
                const exportData = {
                  exportedAt: new Date().toISOString(),
                  message: "Your data export is being prepared. In a full implementation, this would include all your bands, events, songs, and settings."
                };
                const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `bandwith-export-${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
              }}
              className="w-full py-4 rounded-[1.5rem] bg-[#1C1C1E] border border-white/5 text-sm font-bold text-stone-300 hover:text-white flex items-center justify-center gap-2 hover:bg-white/5 transition-all"
            >
              <Download className="w-4 h-4" /> Export My Data
            </button>
          </div>

          {/* App Version */}
          <p className="text-center text-[10px] text-white/20 mt-8">
            BandWith v1.0.0 • Made with 🎸 for musicians
          </p>

        </motion.div>
      )}
    </AnimatePresence>
  );
};
