import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell,
  Palette,
  Shield,
  HelpCircle,
  Info,
  ChevronRight,
  Moon,
  Sun,
  Smartphone,
  Volume2,
  VolumeX,
  Lock,
  Eye,
  EyeOff,
  Trash2,
  AlertTriangle,
  X
} from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { useAuth } from '@/lib/AuthContext';
import { DotCheckbox } from '@/app/components/ui/DotCheckbox';
import { DotRadio } from '@/app/components/ui/DotRadio';

type SettingsSection = 'main' | 'notifications' | 'appearance' | 'privacy' | 'help' | 'about' | 'language';

interface SettingsViewProps {
  onClose: () => void;
  initialSection?: SettingsSection;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onClose, initialSection = 'main' }) => {
  const { signOut, user } = useAuth();
  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection);
  
  // Settings state
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState<'light' | 'dark' | 'system'>('light');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const renderMainSection = () => (
    <div className="space-y-2">
      {[
        { id: 'notifications' as const, icon: Bell, label: 'Notifications', desc: 'Push, email & sounds' },
        { id: 'appearance' as const, icon: Palette, label: 'Appearance', desc: 'Theme & display' },
        { id: 'privacy' as const, icon: Shield, label: 'Privacy & Security', desc: 'Data & permissions' },
        { id: 'help' as const, icon: HelpCircle, label: 'Help & Support', desc: 'FAQ & contact' },
        { id: 'about' as const, icon: Info, label: 'About', desc: 'Version & legal' },
      ].map((item, i) => (
        <motion.button
          key={item.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05 }}
          onClick={() => setActiveSection(item.id)}
          className="w-full bg-white rounded-2xl p-4 flex items-center justify-between border border-black/5 hover:border-black/20 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-black/5 flex items-center justify-center">
              <item.icon className="w-6 h-6 text-black/40" />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-black">{item.label}</h3>
              <p className="text-xs text-black/40">{item.desc}</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-black/20" />
        </motion.button>
      ))}
    </div>
  );

  const renderNotificationsSection = () => (
    <div className="space-y-4">
      <SettingsToggle
        icon={Smartphone}
        label="Push Notifications"
        desc="Receive alerts on your device"
        enabled={pushEnabled}
        onToggle={setPushEnabled}
      />
      <SettingsToggle
        icon={Bell}
        label="Email Notifications"
        desc="Get updates in your inbox"
        enabled={emailEnabled}
        onToggle={setEmailEnabled}
      />
      <SettingsToggle
        icon={soundEnabled ? Volume2 : VolumeX}
        label="Sound Effects"
        desc="Play sounds for notifications"
        enabled={soundEnabled}
        onToggle={setSoundEnabled}
      />
    </div>
  );

  const renderAppearanceSection = () => (
    <div className="space-y-4">
      <h3 className="text-xs font-bold uppercase text-black/40 px-1">Theme</h3>
      <div className="bg-white rounded-2xl p-2 border border-black/5">
        {[
          { id: 'light' as const, icon: Sun, label: 'Light' },
          { id: 'dark' as const, icon: Moon, label: 'Dark' },
          { id: 'system' as const, icon: Smartphone, label: 'System' },
        ].map((theme) => (
          <button
            key={theme.id}
            onClick={() => setDarkMode(theme.id)}
            className={cn(
              "w-full p-4 rounded-xl flex items-center justify-between transition-colors",
              darkMode === theme.id ? "bg-[#D4FB46]" : "hover:bg-black/5"
            )}
          >
            <div className="flex items-center gap-3">
              <theme.icon className={cn(
                "w-5 h-5",
                darkMode === theme.id ? "text-[#1A1A1A]" : "text-black/40"
              )} />
              <span className={cn(
                "font-medium",
                darkMode === theme.id ? "text-[#1A1A1A]" : "text-black/80"
              )}>{theme.label}</span>
            </div>
            <DotRadio selected={darkMode === theme.id} />
          </button>
        ))}
      </div>
      <p className="text-xs text-black/30 px-1">
        Note: Theme switching is currently not implemented. The app uses light mode by default.
      </p>
    </div>
  );

  const renderPrivacySection = () => (
    <div className="space-y-4">
      <SettingsToggle
        icon={Eye}
        label="Show Online Status"
        desc="Let others see when you're active"
        enabled={true}
        onToggle={() => {}}
      />
      <SettingsToggle
        icon={Lock}
        label="Two-Factor Authentication"
        desc="Add extra security to your account"
        enabled={false}
        onToggle={() => {}}
      />
      
      <div className="pt-6 border-t border-black/10">
        <h3 className="text-xs font-bold uppercase text-red-400 px-1 mb-4">Danger Zone</h3>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-center gap-4 text-red-400 hover:bg-red-500/20 transition-colors"
        >
          <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
            <Trash2 className="w-6 h-6" />
          </div>
          <div className="text-left">
            <h3 className="font-bold">Delete Account</h3>
            <p className="text-xs text-red-400/60">Permanently remove all your data</p>
          </div>
        </button>
      </div>
    </div>
  );

  const renderHelpSection = () => (
    <div className="space-y-4">
      {[
        { label: 'FAQ', desc: 'Common questions answered' },
        { label: 'Contact Support', desc: 'Get help from our team' },
        { label: 'Report a Bug', desc: 'Help us improve the app' },
        { label: 'Feature Request', desc: 'Suggest new features' },
      ].map((item, i) => (
        <button
          key={i}
          className="w-full bg-white rounded-2xl p-4 flex items-center justify-between border border-black/5 hover:border-black/20 transition-colors"
        >
          <div className="text-left">
            <h3 className="font-bold text-black">{item.label}</h3>
            <p className="text-xs text-black/40">{item.desc}</p>
          </div>
          <ChevronRight className="w-5 h-5 text-black/20" />
        </button>
      ))}
    </div>
  );

  const renderAboutSection = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 border border-black/5 text-center">
        <div className="w-20 h-20 mx-auto mb-4 bg-[#D4FB46] rounded-2xl flex items-center justify-center">
          <span className="text-[#1A1A1A] font-black text-2xl">B</span>
        </div>
        <h2 className="text-2xl font-black text-black">BandWith</h2>
        <p className="text-black/40 text-sm mt-1">Version 1.0.0</p>
      </div>
      
      <div className="space-y-2">
        {[
          { label: 'Terms of Service', external: true },
          { label: 'Privacy Policy', external: true },
          { label: 'Licenses', external: false },
        ].map((item, i) => (
          <button
            key={i}
            className="w-full bg-white rounded-xl p-4 flex items-center justify-between border border-black/5 hover:border-black/20 transition-colors"
          >
            <span className="font-medium text-black">{item.label}</span>
            <ChevronRight className="w-5 h-5 text-black/20" />
          </button>
        ))}
      </div>
      
      <p className="text-center text-xs text-black/30">
        Made with ♥ for musicians
      </p>
    </div>
  );

  const getSectionTitle = () => {
    switch (activeSection) {
      case 'notifications': return 'Notifications';
      case 'appearance': return 'Appearance';
      case 'privacy': return 'Privacy & Security';
      case 'help': return 'Help & Support';
      case 'about': return 'About';
      case 'language': return 'Language';
      default: return 'Settings';
    }
  };

  const renderLanguageSection = () => (
    <div className="space-y-4">
      <p className="text-sm text-black/40 px-1">
        Language settings will be available in a future update.
      </p>
      <div className="bg-white rounded-2xl p-4 border border-black/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🇬🇧</span>
            <span className="font-medium text-black">English</span>
          </div>
          <DotRadio selected={true} activeColor="#D4FB46" />
        </div>
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}
      className="fixed inset-0 z-[70] bg-[#E6E5E1] overflow-y-auto"
    >
      {/* Header */}
      <div className="px-6 shrink-0" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}>
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-1">App</p>
            <h1 className="text-4xl font-black text-black tracking-tight uppercase">
              {getSectionTitle()}
            </h1>
          </div>
          <button 
            onClick={activeSection === 'main' ? onClose : () => setActiveSection('main')}
            className="w-12 h-12 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center transition-all"
          >
            <X className="w-6 h-6 text-black/50" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 pb-32">
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

      {/* Delete Account Confirmation Modal */}
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
              className="bg-white rounded-3xl p-6 max-w-sm w-full border border-black/5"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-16 h-16 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
              <h2 className="text-xl font-black text-center text-black mb-2">Delete Account?</h2>
              <p className="text-center text-black/50 text-sm mb-6">
                This action cannot be undone. All your data, bands, and events will be permanently deleted.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 h-12 rounded-xl bg-black/5 text-black font-bold text-sm hover:bg-black/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  className="flex-1 h-12 rounded-xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 transition-colors"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// Toggle component
interface SettingsToggleProps {
  icon: React.ElementType;
  label: string;
  desc: string;
  enabled: boolean;
  onToggle: (value: boolean) => void;
}

const SettingsToggle: React.FC<SettingsToggleProps> = ({ icon: Icon, label, desc, enabled, onToggle }) => (
  <button
    type="button"
    onClick={() => onToggle(!enabled)}
    className="w-full bg-white rounded-2xl p-4 flex items-center justify-between border border-black/5 cursor-pointer"
  >
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl bg-black/5 flex items-center justify-center">
        <Icon className="w-6 h-6 text-black/40" />
      </div>
      <div className="text-left">
        <h3 className="font-bold text-black">{label}</h3>
        <p className="text-xs text-black/40">{desc}</p>
      </div>
    </div>
    <DotCheckbox checked={enabled} />
  </button>
);
