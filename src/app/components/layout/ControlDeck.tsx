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

type GridCell = { c: number; r: number; cs?: number; rs?: number; d: boolean };

const ACTION_GRID_PATTERNS: Record<string, GridCell[]> = {
  'New Quote': [
    // N (cols 1-3)
    { c:1, r:1, rs:5, d:true }, { c:2, r:1, d:true }, { c:3, r:1, rs:5, d:true },
    { c:2, r:2, d:false }, { c:2, r:3, d:false }, { c:2, r:4, d:false }, { c:2, r:5, d:false },
    // gap
    { c:4, r:1, d:false }, { c:4, r:2, d:false }, { c:4, r:3, d:false }, { c:4, r:4, d:false }, { c:4, r:5, d:false },
    // Q (cols 5-7)
    { c:5, r:1, cs:3, d:true }, { c:5, r:2, rs:3, d:true }, { c:7, r:2, rs:3, d:true },
    { c:6, r:5, d:true }, { c:7, r:5, d:true },
    { c:6, r:2, d:false }, { c:6, r:3, d:false }, { c:6, r:4, d:false }, { c:5, r:5, d:false },
  ],
  'Invite Member': [
    // I (cols 1-3)
    { c:1, r:1, cs:3, d:true }, { c:2, r:2, rs:3, d:true }, { c:1, r:5, cs:3, d:true },
    { c:1, r:2, d:false }, { c:3, r:2, d:false }, { c:1, r:3, d:false }, { c:3, r:3, d:false },
    { c:1, r:4, d:false }, { c:3, r:4, d:false },
    // gap
    { c:4, r:1, d:false }, { c:4, r:2, d:false }, { c:4, r:3, d:false }, { c:4, r:4, d:false }, { c:4, r:5, d:false },
    // M (cols 5-7)
    { c:5, r:1, rs:5, d:true }, { c:6, r:1, rs:2, d:true }, { c:7, r:1, rs:5, d:true },
    { c:6, r:3, d:false }, { c:6, r:4, d:false }, { c:6, r:5, d:false },
  ],
  Finance: [
    // M (cols 1-3)
    { c:1, r:1, rs:5, d:true }, { c:2, r:1, rs:2, d:true }, { c:3, r:1, rs:5, d:true },
    { c:2, r:3, d:false }, { c:2, r:4, d:false }, { c:2, r:5, d:false },
    // gap
    { c:4, r:1, d:false }, { c:4, r:2, d:false }, { c:4, r:3, d:false }, { c:4, r:4, d:false }, { c:4, r:5, d:false },
    // F (cols 5-7)
    { c:5, r:1, cs:3, d:true }, { c:5, r:2, rs:4, d:true }, { c:6, r:3, d:true },
    { c:6, r:2, d:false }, { c:7, r:2, d:false }, { c:7, r:3, d:true },
    { c:6, r:4, d:false }, { c:7, r:4, d:false }, { c:6, r:5, d:false }, { c:7, r:5, d:false },
  ],
  Analytics: [
    // D (cols 1-3)
    { c:1, r:1, rs:5, d:true }, { c:2, r:1, d:true }, { c:3, r:2, rs:3, d:true }, { c:2, r:5, d:true },
    { c:3, r:1, d:false }, { c:2, r:2, d:false }, { c:2, r:3, d:false }, { c:2, r:4, d:false }, { c:3, r:5, d:false },
    // gap
    { c:4, r:1, d:false }, { c:4, r:2, d:false }, { c:4, r:3, d:false }, { c:4, r:4, d:false }, { c:4, r:5, d:false },
    // I (cols 5-7)
    { c:5, r:1, cs:3, d:true }, { c:6, r:2, rs:3, d:true }, { c:5, r:5, cs:3, d:true },
    { c:5, r:2, d:false }, { c:7, r:2, d:false }, { c:5, r:3, d:false }, { c:7, r:3, d:false },
    { c:5, r:4, d:false }, { c:7, r:4, d:false },
  ],
  'My Schedule': [
    // M (cols 1-3)
    { c:1, r:1, rs:5, d:true }, { c:2, r:1, rs:2, d:true }, { c:3, r:1, rs:5, d:true },
    { c:2, r:3, d:false }, { c:2, r:4, d:false }, { c:2, r:5, d:false },
    // gap
    { c:4, r:1, d:false }, { c:4, r:2, d:false }, { c:4, r:3, d:false }, { c:4, r:4, d:false }, { c:4, r:5, d:false },
    // S (cols 5-7)
    { c:5, r:1, cs:3, d:true }, { c:5, r:2, d:true }, { c:5, r:3, cs:3, d:true }, { c:7, r:4, d:true }, { c:5, r:5, cs:3, d:true },
    { c:6, r:2, d:false }, { c:7, r:2, d:false }, { c:5, r:4, d:false }, { c:6, r:4, d:false },
  ],
  'Band Info': [
    // B (cols 1-3)
    { c:1, r:1, rs:5, d:true }, { c:2, r:1, cs:2, d:true }, { c:3, r:2, d:true },
    { c:2, r:3, cs:2, d:true }, { c:3, r:4, d:true }, { c:2, r:5, cs:2, d:true },
    { c:2, r:2, d:false }, { c:2, r:4, d:false },
    // gap
    { c:4, r:1, d:false }, { c:4, r:2, d:false }, { c:4, r:3, d:false }, { c:4, r:4, d:false }, { c:4, r:5, d:false },
    // I (cols 5-7)
    { c:5, r:1, cs:3, d:true }, { c:6, r:2, rs:3, d:true }, { c:5, r:5, cs:3, d:true },
    { c:5, r:2, d:false }, { c:7, r:2, d:false }, { c:5, r:3, d:false }, { c:7, r:3, d:false },
    { c:5, r:4, d:false }, { c:7, r:4, d:false },
  ],
};

const PixelArtGrid: React.FC<{ pattern: GridCell[]; color: string }> = ({ pattern, color }) => (
  <div
    className="grid gap-1 w-[100px] h-[91px]"
    style={{ gridTemplateColumns: 'repeat(7, 1fr)', gridTemplateRows: 'repeat(5, 1fr)' }}
  >
    {pattern.map((cell, i) => (
      <div
        key={i}
        className="rounded-[10px]"
        style={{
          gridColumn: cell.cs ? `${cell.c} / span ${cell.cs}` : cell.c,
          gridRow: cell.rs ? `${cell.r} / span ${cell.rs}` : cell.r,
          backgroundColor: cell.d ? color : '#CDCACA',
        }}
      />
    ))}
  </div>
);

const ProDotGrid: React.FC = () => (
  <div
    className="grid gap-1 w-full h-[48px]"
    style={{ gridTemplateColumns: 'repeat(8, 1fr)', gridTemplateRows: 'repeat(2, 1fr)' }}
  >
    {Array.from({ length: 16 }).map((_, i) => (
      <div
        key={i}
        className="rounded-[10px]"
        style={{ backgroundColor: i < 11 ? '#D5FB46' : 'rgba(0,0,0,0.1)' }}
      />
    ))}
  </div>
);

export const ControlDeck: React.FC<ControlDeckProps> = ({
  isOpen,
  onClose,
  onNavigate,
  isAdmin = true
}) => {
  const { signOut, user } = useAuth();

  const quickActions = [
    { label: 'New Quote', lines: ['NEW', 'QUOTE'], color: '#D5FB46', onClick: () => onNavigate('Quote'), adminOnly: true },
    { label: 'Invite Member', lines: ['INVITE', 'MEMBER'], color: '#0147FF', onClick: () => onNavigate('InviteMember'), adminOnly: true },
    { label: 'Finance', lines: ['MONEY', 'FLOW'], color: '#22C55E', onClick: () => onNavigate('Finance'), adminOnly: true },
    { label: 'Analytics', lines: ['DATA', 'INSIGHTS'], color: '#F59E0B', onClick: () => onNavigate('Analytics'), adminOnly: true },
  ].filter(action => isAdmin || !action.adminOnly);

  const memberActions = isAdmin ? [] : [
    { label: 'My Schedule', lines: ['MY', 'SCHEDULE'], color: '#3B82F6', onClick: () => onNavigate('Events') },
    { label: 'Band Info', lines: ['BAND', 'INFO'], color: '#8B5CF6', onClick: () => onNavigate('BandMembers') },
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
          className="fixed inset-0 z-[60] bg-[#E6E5E1] overflow-y-auto overflow-x-hidden"
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
                className="w-[50px] h-[50px] rounded-full flex items-center justify-center border-2 border-black shrink-0 active:scale-90 transition-transform"
                style={{ backgroundColor: 'rgba(216,216,216,0.2)' }}
              >
                <ArrowLeft className="w-[24px] h-[24px] text-black" />
              </button>
              <h2 className="text-[32px] font-bold text-black leading-none uppercase">
                SETTINGS
              </h2>
            </div>

            {/* ═══ QUICK ACTIONS ═══ */}
            <div className="flex flex-col gap-5">
              <div className="flex flex-col">
                <span className="text-[32px] font-bold text-black leading-none">QUICK</span>
                <span className="text-[32px] font-bold text-black leading-none">ACTIONS</span>
              </div>

              <div className="overflow-x-auto -mx-4 px-4 scrollbar-hide">
                <div className="flex gap-10 w-max">
                  {allActions.map((item, i) => {
                    const pattern = ACTION_GRID_PATTERNS[item.label];
                    return (
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
                            <span className="text-xs font-bold text-black text-left">{item.lines[0]}</span>
                            {item.lines[1] && <span className="text-xs font-bold text-black text-left">{item.lines[1]}</span>}
                          </div>
                          <ArrowUpRight className="w-3.5 h-3.5 text-black" />
                        </div>
                        {pattern && <PixelArtGrid pattern={pattern} color={item.color} />}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ═══ APP SETTINGS ═══ */}
            <div className="flex flex-col gap-5">
              <div className="flex flex-col">
                <span className="text-[32px] font-bold text-black leading-none">APP</span>
                <span className="text-[32px] font-bold text-black leading-none">SETTINGS</span>
              </div>

              <div className="flex flex-col gap-0">
                {settingsItems.map((item, i) => (
                  <motion.button
                    key={item.section}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => onNavigate(`Settings:${item.section}`)}
                    className="flex items-center justify-between w-full py-4 border-b border-black/10 last:border-0 active:opacity-70 transition-opacity"
                  >
                    <div className="flex flex-col items-start">
                      <span className="text-xs font-bold text-black uppercase tracking-wide">{item.label}</span>
                      <span className="text-[10px] font-medium text-black/40 uppercase">{item.desc}</span>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-black shrink-0" />
                  </motion.button>
                ))}
              </div>
            </div>

            {/* ═══ UPGRADE TO PRO ═══ */}
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-[#D5FB46] uppercase tracking-wide bg-black rounded-[6px] px-1.5 py-0.5 w-fit">PRO</span>
                <h3 className="text-[32px] font-bold text-black leading-none uppercase">
                  UPGRADE
                </h3>
              </div>

              <ProDotGrid />

              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold text-black uppercase tracking-wide">UNLOCK ADVANCED FEATURES</span>
                <div className="flex flex-wrap gap-2">
                  <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-[6px] bg-black/10 text-black/50">Unlimited Quotes</span>
                  <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-[6px] bg-black/10 text-black/50">Analytics</span>
                  <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-[6px] bg-black/10 text-black/50">Priority Support</span>
                </div>
              </div>

              <button
                className="flex items-center justify-between p-2.5 rounded-[10px] bg-[#D5FB46] w-full active:scale-95 transition-transform"
              >
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-black" />
                  <span className="text-xs font-bold text-black uppercase">UPGRADE NOW</span>
                </div>
                <ArrowUpRight className="w-4 h-4 text-black" />
              </button>
            </div>

            {/* ═══ MORE ═══ */}
            <div className="flex flex-col gap-5">
              <span className="text-[32px] font-bold text-black leading-none uppercase">MORE</span>

              <button
                onClick={() => window.open('mailto:support@bandwith.app?subject=Help%20Request', '_blank')}
                className="flex items-center justify-between w-full py-3 border-b border-black/10 active:opacity-70 transition-opacity"
              >
                <span className="text-xs font-bold text-black uppercase tracking-wide">HELP & SUPPORT</span>
                <ArrowUpRight className="w-4 h-4 text-black" />
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
                className="flex items-center justify-between w-full py-3 border-b border-black/10 active:opacity-70 transition-opacity"
              >
                <div className="flex items-center gap-2">
                  <Download className="w-3.5 h-3.5 text-black" />
                  <span className="text-xs font-bold text-black uppercase tracking-wide">EXPORT MY DATA</span>
                </div>
                <ArrowUpRight className="w-4 h-4 text-black" />
              </button>
            </div>

            {/* ═══ SIGN OUT ═══ */}
            <div className="flex flex-col gap-4">
              <button
                onClick={handleLogout}
                className="w-full border border-[#A73131] bg-[rgba(167,49,49,0.15)] rounded-[10px] py-3.5 flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                <LogOut className="w-4 h-4 text-[#A73131]" />
                <span className="text-[12px] font-bold text-[#A73131] uppercase">SIGN OUT</span>
              </button>
              {user?.email && (
                <p className="text-[10px] font-normal text-black/30 text-center uppercase w-full">
                  SIGNED IN AS {user.email}
                </p>
              )}
              <p className="text-center text-[10px] text-black/20 uppercase">
                BandWith v1.0.0
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
