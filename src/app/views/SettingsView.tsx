import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell,
  Shield,
  HelpCircle,
  Info,
  Moon,
  Sun,
  Smartphone,
  Volume2,
  VolumeX,
  Lock,
  Eye,
  Trash2,
  AlertTriangle,
  ArrowUpRight,
  ArrowLeft,
  X
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { DotCheckbox } from '@/app/components/ui/DotCheckbox';
import { DotRadio } from '@/app/components/ui/DotRadio';

type SettingsSection = 'main' | 'notifications' | 'appearance' | 'privacy' | 'help' | 'about' | 'language';

interface SettingsViewProps {
  onClose: () => void;
  initialSection?: SettingsSection;
}

const SectionDotGrid: React.FC<{ filled: number; color?: string }> = ({ filled, color = '#000000' }) => (
  <div
    className="grid gap-1 w-full h-[32px]"
    style={{ gridTemplateColumns: 'repeat(6, 1fr)', gridTemplateRows: 'repeat(2, 1fr)' }}
  >
    {Array.from({ length: 12 }).map((_, i) => (
      <div
        key={i}
        className="rounded-[10px]"
        style={{ backgroundColor: i < filled ? color : 'rgba(0,0,0,0.1)' }}
      />
    ))}
  </div>
);

export const SettingsView: React.FC<SettingsViewProps> = ({ onClose, initialSection = 'main' }) => {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection);
  
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState<'light' | 'dark' | 'system'>('light');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const getSectionTitle = (): string => {
    switch (activeSection) {
      case 'notifications': return 'NOTIFICATIONS';
      case 'appearance': return 'APPEARANCE';
      case 'privacy': return 'PRIVACY';
      case 'help': return 'HELP';
      case 'about': return 'ABOUT';
      case 'language': return 'LANGUAGE';
      default: return 'SETTINGS';
    }
  };

  const renderMainSection = () => (
    <div className="flex flex-col gap-0">
      {[
        { id: 'notifications' as const, label: 'NOTIFICATIONS', desc: 'Push, email & sounds' },
        { id: 'appearance' as const, label: 'APPEARANCE', desc: 'Theme & display' },
        { id: 'language' as const, label: 'LANGUAGE', desc: 'English' },
        { id: 'privacy' as const, label: 'PRIVACY & SECURITY', desc: 'Data & permissions' },
        { id: 'help' as const, label: 'HELP & SUPPORT', desc: 'FAQ & contact' },
        { id: 'about' as const, label: 'ABOUT', desc: 'Version & legal' },
      ].map((item, i) => (
        <motion.button
          key={item.id}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.04 }}
          onClick={() => setActiveSection(item.id)}
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
  );

  const renderNotificationsSection = () => (
    <div className="flex flex-col gap-8">
      <SectionDotGrid filled={pushEnabled && emailEnabled && soundEnabled ? 12 : pushEnabled && emailEnabled ? 8 : pushEnabled ? 4 : 0} />

      <div className="flex flex-col gap-0">
        <SettingsToggle
          label="PUSH NOTIFICATIONS"
          desc="Receive alerts on your device"
          icon={Smartphone}
          enabled={pushEnabled}
          onToggle={setPushEnabled}
        />
        <SettingsToggle
          label="EMAIL NOTIFICATIONS"
          desc="Get updates in your inbox"
          icon={Bell}
          enabled={emailEnabled}
          onToggle={setEmailEnabled}
        />
        <SettingsToggle
          label="SOUND EFFECTS"
          desc="Play sounds for notifications"
          icon={soundEnabled ? Volume2 : VolumeX}
          enabled={soundEnabled}
          onToggle={setSoundEnabled}
        />
      </div>
    </div>
  );

  const renderAppearanceSection = () => (
    <div className="flex flex-col gap-8">
      <SectionDotGrid filled={darkMode === 'light' ? 4 : darkMode === 'dark' ? 8 : 12} />

      <div className="flex flex-col gap-2">
        <span className="text-xs font-bold text-black/40 uppercase tracking-wide">THEME</span>
        <div className="flex flex-col gap-0">
          {[
            { id: 'light' as const, icon: Sun, label: 'LIGHT' },
            { id: 'dark' as const, icon: Moon, label: 'DARK' },
            { id: 'system' as const, icon: Smartphone, label: 'SYSTEM' },
          ].map((theme) => (
            <button
              key={theme.id}
              onClick={() => setDarkMode(theme.id)}
              className="flex items-center justify-between w-full py-4 border-b border-black/10 last:border-0 active:opacity-70 transition-opacity"
            >
              <div className="flex items-center gap-3">
                <theme.icon className="w-4 h-4 text-black/40" />
                <span className="text-xs font-bold text-black uppercase tracking-wide">{theme.label}</span>
              </div>
              <DotRadio
                selected={darkMode === theme.id}
                activeColor={darkMode === theme.id ? '#000000' : undefined}
                className="!w-[60px] !h-[38px]"
              />
            </button>
          ))}
        </div>
        <p className="text-[10px] font-medium text-black/30 uppercase mt-2">
          Theme switching coming soon. Using light mode.
        </p>
      </div>
    </div>
  );

  const renderPrivacySection = () => (
    <div className="flex flex-col gap-8">
      <SectionDotGrid filled={6} color="#0147FF" />

      <div className="flex flex-col gap-0">
        <SettingsToggle
          label="SHOW ONLINE STATUS"
          desc="Let others see when you're active"
          icon={Eye}
          enabled={true}
          onToggle={() => {}}
        />
        <SettingsToggle
          label="TWO-FACTOR AUTH"
          desc="Add extra security"
          icon={Lock}
          enabled={false}
          onToggle={() => {}}
        />
      </div>

      <div className="flex flex-col gap-4 pt-4 border-t border-black/10">
        <span className="text-xs font-bold text-[#A73131] uppercase tracking-wide">DANGER ZONE</span>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full border border-[#A73131] bg-[rgba(167,49,49,0.1)] rounded-[10px] py-3.5 flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          <Trash2 className="w-4 h-4 text-[#A73131]" />
          <span className="text-[12px] font-bold text-[#A73131] uppercase">DELETE ACCOUNT</span>
        </button>
      </div>
    </div>
  );

  const renderHelpSection = () => (
    <div className="flex flex-col gap-8">
      <SectionDotGrid filled={8} color="#9A8878" />

      <div className="flex flex-col gap-0">
        {[
          { label: 'FAQ', desc: 'Common questions answered' },
          { label: 'CONTACT SUPPORT', desc: 'Get help from our team' },
          { label: 'REPORT A BUG', desc: 'Help us improve the app' },
          { label: 'FEATURE REQUEST', desc: 'Suggest new features' },
        ].map((item, i) => (
          <button
            key={i}
            className="flex items-center justify-between w-full py-4 border-b border-black/10 last:border-0 active:opacity-70 transition-opacity"
          >
            <div className="flex flex-col items-start">
              <span className="text-xs font-bold text-black uppercase tracking-wide">{item.label}</span>
              <span className="text-[10px] font-medium text-black/40 uppercase">{item.desc}</span>
            </div>
            <ArrowUpRight className="w-4 h-4 text-black shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );

  const renderAboutSection = () => (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-5">
        <div
          className="grid gap-1 w-[120px] h-[72px]"
          style={{ gridTemplateColumns: 'repeat(6, 1fr)', gridTemplateRows: 'repeat(4, 1fr)' }}
        >
          {Array.from({ length: 24 }).map((_, i) => (
            <div
              key={i}
              className="rounded-[10px]"
              style={{ backgroundColor: i < 18 ? '#D5FB46' : 'rgba(0,0,0,0.1)' }}
            />
          ))}
        </div>
        <div className="flex flex-col">
          <span className="text-[42px] font-bold text-black leading-none">BANDWITH</span>
          <span className="text-xs font-bold text-black/40 uppercase tracking-wide mt-1">Version 1.0.0</span>
        </div>
      </div>

      <div className="flex flex-col gap-0">
        {[
          { label: 'TERMS OF SERVICE' },
          { label: 'PRIVACY POLICY' },
          { label: 'LICENSES' },
        ].map((item, i) => (
          <button
            key={i}
            className="flex items-center justify-between w-full py-4 border-b border-black/10 last:border-0 active:opacity-70 transition-opacity"
          >
            <span className="text-xs font-bold text-black uppercase tracking-wide">{item.label}</span>
            <ArrowUpRight className="w-4 h-4 text-black shrink-0" />
          </button>
        ))}
      </div>

      <p className="text-[10px] font-normal text-black/30 text-center uppercase">
        Made with love for musicians
      </p>
    </div>
  );

  const renderLanguageSection = () => (
    <div className="flex flex-col gap-8">
      <SectionDotGrid filled={3} color="#0147FF" />

      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-medium text-black/40 uppercase">
          More languages coming soon.
        </span>
        <button className="flex items-center justify-between w-full py-4 border-b border-black/10 active:opacity-70">
          <div className="flex items-center gap-3">
            <span className="text-lg">🇬🇧</span>
            <span className="text-xs font-bold text-black uppercase tracking-wide">ENGLISH</span>
          </div>
          <DotRadio selected={true} activeColor="#000000" className="!w-[60px] !h-[38px]" />
        </button>
      </div>
    </div>
  );

  const sectionTitle = getSectionTitle();

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
      className="fixed inset-0 z-[70] bg-[#E6E5E1] overflow-y-auto overflow-x-hidden"
      style={{
        overscrollBehaviorX: 'none',
        touchAction: 'pan-y',
      }}
    >
      {/* Header */}
      <div
        className="px-4 shrink-0"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}
      >
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={activeSection === 'main' ? onClose : () => setActiveSection('main')}
            className="w-[50px] h-[50px] rounded-full flex items-center justify-center border-2 border-black shrink-0 active:scale-90 transition-transform"
            style={{ backgroundColor: 'rgba(216,216,216,0.2)' }}
          >
            <ArrowLeft className="w-[24px] h-[24px] text-black" />
          </button>
          <h1 className="text-[32px] font-bold text-black leading-none uppercase">{sectionTitle}</h1>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-32">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {activeSection === 'main' && renderMainSection()}
            {activeSection === 'notifications' && renderNotificationsSection()}
            {activeSection === 'appearance' && renderAppearanceSection()}
            {activeSection === 'privacy' && renderPrivacySection()}
            {activeSection === 'help' && renderHelpSection()}
            {activeSection === 'about' && renderAboutSection()}
            {activeSection === 'language' && renderLanguageSection()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Delete Confirm */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#E6E5E1] rounded-[10px] p-6 max-w-sm w-full"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex flex-col gap-5">
                <div className="w-12 h-12 mx-auto bg-[rgba(167,49,49,0.15)] rounded-[10px] flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-[#A73131]" />
                </div>
                <div className="flex flex-col gap-2 text-center">
                  <h2 className="text-[22px] font-bold text-black uppercase">DELETE ACCOUNT?</h2>
                  <p className="text-[10px] font-medium text-black/40 uppercase">
                    This action cannot be undone. All your data will be permanently deleted.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 h-12 rounded-[10px] bg-black/5 text-black font-bold text-xs uppercase active:scale-95 transition-transform"
                  >
                    Cancel
                  </button>
                  <button
                    className="flex-1 h-12 rounded-[10px] bg-[#A73131] text-white font-bold text-xs uppercase active:scale-95 transition-transform"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

interface SettingsToggleProps {
  label: string;
  desc: string;
  icon: React.ElementType;
  enabled: boolean;
  onToggle: (value: boolean) => void;
}

const SettingsToggle: React.FC<SettingsToggleProps> = ({ label, desc, icon: Icon, enabled, onToggle }) => (
  <button
    type="button"
    onClick={() => onToggle(!enabled)}
    className="flex items-center justify-between w-full py-4 border-b border-black/10 last:border-0 active:opacity-70 transition-opacity cursor-pointer"
  >
    <div className="flex items-center gap-3">
      <Icon className="w-4 h-4 text-black/40 shrink-0" />
      <div className="flex flex-col items-start">
        <span className="text-xs font-bold text-black uppercase tracking-wide">{label}</span>
        <span className="text-[10px] font-medium text-black/40 uppercase">{desc}</span>
      </div>
    </div>
    <DotCheckbox checked={enabled} className="!w-[60px] !h-[38px]" />
  </button>
);
