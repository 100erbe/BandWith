import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft,
  ArrowUpRight,
  Download,
  Zap,
  LogOut,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

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
  const { signOut, user } = useAuth();

  const quickActions = [
    { label: 'New Quote', lines: ['NEW', 'QUOTE'], onClick: () => onNavigate('Quote'), adminOnly: true },
    { label: 'Pricing & Rates', lines: ['PRICING', '& RATES'], onClick: () => onNavigate('PricingSettings'), adminOnly: true },
    { label: 'Invite Member', lines: ['INVITE', 'MEMBER'], onClick: () => onNavigate('InviteMember'), adminOnly: true },
    { label: 'Finance', lines: ['MONEY', 'FLOW'], onClick: () => onNavigate('Finance'), adminOnly: true },
    { label: 'Analytics', lines: ['DATA', 'INSIGHTS'], onClick: () => onNavigate('Analytics'), adminOnly: true },
  ].filter(action => isAdmin || !action.adminOnly);

  const memberActions = isAdmin ? [] : [
    { label: 'My Schedule', lines: ['MY', 'SCHEDULE'], onClick: () => onNavigate('Events') },
    { label: 'Band Info', lines: ['BAND', 'INFO'], onClick: () => onNavigate('BandMembers') },
  ];

  const allActions = [...quickActions, ...memberActions];

  const settingsItems = [
    { label: 'NOTIFICATIONS', desc: 'Push, email & sounds', section: 'notifications' },
    { label: 'APPEARANCE', desc: 'Theme & display', section: 'appearance' },
    { label: 'LANGUAGE', desc: 'English', section: 'language' },
    { label: 'PRIVACY', desc: 'Data & permissions', section: 'privacy' },
    { label: 'HELP', desc: 'FAQ & contact', section: 'help' },
    { label: 'ABOUT', desc: 'Version & legal', section: 'about' },
  ];

  const handleLogout = async () => {
    await signOut();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
          className="fixed inset-0 z-[60] bg-background overflow-y-auto overflow-x-hidden"
          style={{
            paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)',
            overscrollBehaviorX: 'none',
            touchAction: 'pan-y',
          }}
        >
          <div className="flex flex-col gap-10 px-4 pb-32">
            {/* ═══ HEADER ═══ */}
            <div className="flex items-center gap-4 w-full">
              <button
                onClick={onClose}
                className="w-[48px] h-[48px] rounded-full flex items-center justify-center border border-foreground/20 bg-foreground/5 hover:bg-foreground/10 shrink-0 active:scale-90 transition-all text-foreground"
              >
                <ArrowLeft className="w-[22px] h-[22px] text-foreground" />
              </button>
              <h2 className="text-[32px] font-bold text-foreground leading-none uppercase">
                SETTINGS
              </h2>
            </div>

            {/* ═══ QUICK ACTIONS ═══ */}
            <div className="flex flex-col gap-5">
              <div className="flex flex-col">
                <span className="text-[32px] font-bold text-foreground leading-none">QUICK</span>
                <span className="text-[32px] font-bold text-foreground leading-none">ACTIONS</span>
              </div>

              <div className="overflow-x-auto -mx-4 px-4 scrollbar-hide">
                <div className="flex gap-10 w-max">
                  {allActions.map((item, i) => (
                    <motion.button
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={item.onClick}
                      className="flex flex-col gap-3 items-start shrink-0 active:opacity-70 transition-opacity"
                    >
                      <div className="flex items-start justify-between w-full">
                        <div className="flex flex-col leading-none text-left">
                          <span className="text-xs font-bold text-foreground text-left">{item.lines[0]}</span>
                          {item.lines[1] && <span className="text-xs font-bold text-foreground text-left">{item.lines[1]}</span>}
                        </div>
                        <ArrowUpRight className="w-3.5 h-3.5 text-foreground" />
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>

            {/* ═══ BAND SETTINGS (Admin Only) ═══ */}
            {isAdmin && (
              <div className="flex flex-col gap-5">
                <div className="flex flex-col">
                  <span className="text-[32px] font-bold text-foreground leading-none">BAND</span>
                  <span className="text-[32px] font-bold text-foreground leading-none">SETTINGS</span>
                </div>

                <div className="flex flex-col gap-0">
                  <motion.button
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    onClick={() => onNavigate('PricingSettings')}
                    className="flex items-center justify-between w-full py-4 border-b border-border active:opacity-70 transition-opacity"
                  >
                    <div className="flex flex-col items-start">
                      <span className="text-xs font-bold text-foreground uppercase tracking-wide">PRICING, FEES & SERVICES</span>
                      <span className="text-[10px] font-medium text-foreground/40 uppercase">Musician fees, services & travel expenses</span>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-foreground shrink-0" />
                  </motion.button>
                </div>
              </div>
            )}

            {/* ═══ APP SETTINGS ═══ */}
            <div className="flex flex-col gap-5">
              <div className="flex flex-col">
                <span className="text-[32px] font-bold text-foreground leading-none">APP</span>
                <span className="text-[32px] font-bold text-foreground leading-none">SETTINGS</span>
              </div>

              <div className="flex flex-col gap-0">
                {settingsItems.map((item, i) => (
                  <motion.button
                    key={item.section}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => onNavigate(`Settings:${item.section}`)}
                    className="flex items-center justify-between w-full py-4 border-b border-border last:border-0 active:opacity-70 transition-opacity"
                  >
                    <div className="flex flex-col items-start">
                      <span className="text-xs font-bold text-foreground uppercase tracking-wide">{item.label}</span>
                      <span className="text-[10px] font-medium text-foreground/40 uppercase">{item.desc}</span>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-foreground shrink-0" />
                  </motion.button>
                ))}
              </div>
            </div>

            {/* ═══ UPGRADE TO PRO ═══ */}
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-primary uppercase tracking-wider bg-primary/15 border border-primary/25 rounded-[8px] px-2.5 py-0.5 w-fit">PRO</span>
                <h3 className="text-[32px] font-bold text-foreground leading-none uppercase">
                  UPGRADE
                </h3>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold text-foreground/70 uppercase tracking-wide">UNLOCK ADVANCED FEATURES</span>
                <div className="flex flex-wrap gap-2">
                  <span className="text-[11px] font-bold uppercase px-2.5 py-1 rounded-[8px] bg-foreground/5 border border-foreground/10 text-foreground/70">Unlimited Quotes</span>
                  <span className="text-[11px] font-bold uppercase px-2.5 py-1 rounded-[8px] bg-foreground/5 border border-foreground/10 text-foreground/70">Analytics</span>
                  <span className="text-[11px] font-bold uppercase px-2.5 py-1 rounded-[8px] bg-foreground/5 border border-foreground/10 text-foreground/70">Priority Support</span>
                </div>
              </div>

              <button
                className="flex items-center justify-between px-4 py-3 rounded-[12px] bg-primary text-primary-foreground w-full active:scale-95 transition-all shadow-xs hover:opacity-95"
              >
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary-foreground" />
                  <span className="text-xs font-bold uppercase tracking-wider">UPGRADE NOW</span>
                </div>
                <ArrowUpRight className="w-4 h-4 text-primary-foreground" />
              </button>
            </div>

            {/* ═══ MORE ═══ */}
            <div className="flex flex-col gap-5">
              <span className="text-[32px] font-bold text-foreground leading-none uppercase">MORE</span>

              <button
                onClick={() => window.open('mailto:support@bandwith.app?subject=Help%20Request', '_blank')}
                className="flex items-center justify-between w-full py-3 border-b border-border active:opacity-70 transition-opacity"
              >
                <span className="text-xs font-bold text-foreground uppercase tracking-wide">HELP & SUPPORT</span>
                <ArrowUpRight className="w-4 h-4 text-foreground" />
              </button>

              <button
                onClick={() => {
                  const exportData = {
                    exportedAt: new Date().toISOString(),
                    message: 'Your data export is being prepared.',
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
                className="flex items-center justify-between w-full py-3 border-b border-border active:opacity-70 transition-opacity"
              >
                <div className="flex items-center gap-2">
                  <Download className="w-3.5 h-3.5 text-foreground" />
                  <span className="text-xs font-bold text-foreground uppercase tracking-wide">EXPORT MY DATA</span>
                </div>
                <ArrowUpRight className="w-4 h-4 text-foreground" />
              </button>
            </div>

            {/* ═══ SIGN OUT ═══ */}
            <div className="flex flex-col gap-4">
              <button
                onClick={handleLogout}
                className="w-full border border-[var(--destructive)]/25 bg-[var(--destructive)]/10 hover:bg-[var(--destructive)]/15 rounded-[12px] py-3.5 flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                <LogOut className="w-4 h-4 text-[var(--destructive)]" />
                <span className="text-[12px] font-bold text-[var(--destructive)] uppercase">SIGN OUT</span>
              </button>
              {user?.email && (
                <p className="text-[10px] font-normal text-foreground/30 text-center uppercase w-full">
                  SIGNED IN AS {user.email}
                </p>
              )}
              <p className="text-center text-[10px] text-foreground/20 uppercase">
                BandWith v1.0.0
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};