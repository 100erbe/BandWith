import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  FileText,
  Send,
  MoreHorizontal,
  Eye,
  Download,
  Trash2,
  Loader2,
  ScrollText,
} from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { supabase } from '@/lib/supabase';
import { todayLocal } from '../../lib/dates';
import { parseLocalDate } from '@/lib/dates';
import { DotText } from '@/app/components/bw';
import { ScreenHeader, IconButton, SearchField, Card, BwSheet } from '@/app/components/bw/Screen';
import { PillButton, PillField, Selector } from '@/app/components/bw/Form';

interface Contract {
  id: string;
  title: string;
  event_name: string;
  client_name: string;
  status: 'draft' | 'sent' | 'viewed' | 'signed' | 'expired';
  type: 'contract' | 'rider';
  event_date: string;
  sent_at?: string;
  signed_at?: string;
  band_id: string;
  created_at: string;
}

interface ContractsViewProps {
  onBack: () => void;
  bandId: string;
}

/** Figma "Status": dot colour + Label/XS. */
const STATUS_CONFIG: Record<string, { label: string; dot: string }> = {
  draft: { label: 'Draft', dot: 'bg-accent-past' },
  sent: { label: 'Sent', dot: 'bg-info' },
  viewed: { label: 'Viewed', dot: 'bg-warning' },
  signed: { label: 'Signed', dot: 'bg-success' },
  expired: { label: 'Expired', dot: 'bg-destructive' },
};

const StatusDot: React.FC<{ status: string }> = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || { label: status, dot: 'bg-muted-foreground' };
  return (
    <span className="flex items-center gap-1.5 shrink-0">
      <span className={cn('w-2 h-2 rounded-full', cfg.dot)} aria-hidden />
      <span className="bw-label-xs">{cfg.label}</span>
    </span>
  );
};

/** Small stat card (Figma: label + 24pt dot value). */
const StatCard: React.FC<{ label: string; value: number; inverse?: boolean }> = ({ label, value, inverse }) => (
  <div
    className={cn(
      'flex-1 min-w-0 flex flex-col gap-1 px-4 py-3 rounded-[24px]',
      inverse ? 'bg-surface-inverse text-surface-inverse-foreground' : 'bg-card text-card-foreground',
    )}
  >
    <span className="bw-label-sm truncate">{label}</span>
    <DotText text={value} size={24} label={`${label}: ${value}`} />
  </div>
);

/** Info row on the dark sheet. */
const SheetInfo: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className }) => (
  <div className={cn('flex flex-col gap-1 p-4 rounded-[16px] bg-sheet-foreground/[0.08] min-w-0', className)}>
    <p className="bw-label-sm text-sheet-foreground/70">{label}</p>
    <p className="bw-body-lg [overflow-wrap:anywhere]">{children}</p>
  </div>
);

const TABS = ['All', 'Contracts', 'Riders'] as const;

export const ContractsView: React.FC<ContractsViewProps> = ({ onBack, bandId }) => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState<typeof TABS[number]>('All');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewingContract, setViewingContract] = useState<Contract | null>(null);
  
  // Create form state
  const [formType, setFormType] = useState<'contract' | 'rider'>('contract');
  const [formTitle, setFormTitle] = useState('');
  const [formEventName, setFormEventName] = useState('');
  const [formClientName, setFormClientName] = useState('');
  const [formEventDate, setFormEventDate] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [saving, setSaving] = useState(false);
  
  const resetForm = () => {
    setFormType('contract');
    setFormTitle('');
    setFormEventName('');
    setFormClientName('');
    setFormEventDate('');
    setFormNotes('');
  };
  
  const handleSaveContract = async () => {
    if (!formTitle.trim() || !formClientName.trim() || saving) return;
    setSaving(true);
    
    try {
      const newContract: Contract = {
        id: crypto.randomUUID(),
        title: formTitle.trim(),
        event_name: formEventName.trim() || 'Untitled Event',
        client_name: formClientName.trim(),
        status: 'draft',
        type: formType,
        event_date: formEventDate || todayLocal(),
        band_id: bandId,
        created_at: new Date().toISOString(),
      };
      
      const { error } = await supabase
        .from('contracts')
        .insert({
          id: newContract.id,
          title: newContract.title,
          event_name: newContract.event_name,
          client_name: newContract.client_name,
          status: newContract.status,
          type: newContract.type,
          event_date: newContract.event_date,
          band_id: bandId,
        });
      
      if (error) {
        console.error('Error saving contract to supabase:', error);
      }
      
      setContracts(prev => [newContract, ...prev]);
      resetForm();
      setShowCreateModal(false);
    } catch (err) {
      console.error('Error saving contract:', err);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    loadContracts();
  }, [bandId]);

  const loadContracts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('contracts')
        .select('*')
        .eq('band_id', bandId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setContracts(data || []);
    } catch (err) {
      console.error('Error loading contracts:', err);
      setContracts([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredContracts = contracts.filter(contract => {
    const matchesSearch = 
      contract.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contract.event_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contract.client_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = 
      selectedTab === 'All' || 
      (selectedTab === 'Contracts' && contract.type === 'contract') ||
      (selectedTab === 'Riders' && contract.type === 'rider');
    return matchesSearch && matchesTab;
  });

  const stats = useMemo(() => {
    const draft = contracts.filter(c => c.status === 'draft').length;
    const sent = contracts.filter(c => c.status === 'sent').length;
    const viewed = contracts.filter(c => c.status === 'viewed').length;
    const signed = contracts.filter(c => c.status === 'signed').length;
    const expired = contracts.filter(c => c.status === 'expired').length;
    const contractsCount = contracts.filter(c => c.type === 'contract').length;
    const ridersCount = contracts.filter(c => c.type === 'rider').length;
    
    return {
      total: contracts.length,
      draft,
      sent,
      viewed,
      signed,
      expired,
      contracts: contractsCount,
      riders: ridersCount
    };
  }, [contracts]);

  const getTabCount = (tab: typeof TABS[number]) => {
    if (tab === 'All') return contracts.length;
    return contracts.filter(c => 
      tab === 'Contracts' ? c.type === 'contract' : c.type === 'rider'
    ).length;
  };

  const handleDelete = async (id: string) => {
    try {
      await supabase.from('contracts').delete().eq('id', id);
    } catch (err) {
      console.error('Error deleting contract:', err);
    }
    setContracts(prev => prev.filter(c => c.id !== id));
    setMenuOpenId(null);
  };

  const handleView = (contract: Contract) => {
    setViewingContract(contract);
    setMenuOpenId(null);
  };

  const handleDownloadPdf = (contract: Contract) => {
    const content = `
CONTRACT DOCUMENT
=================

Title: ${contract.title}
Event: ${contract.event_name}
Client: ${contract.client_name}
Event Date: ${contract.event_date}
Status: ${contract.status.toUpperCase()}
Type: ${contract.type.toUpperCase()}

---
Generated by BandWith
    `.trim();
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${contract.title.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setMenuOpenId(null);
  };

  const handleSendToClient = async (contract: Contract) => {
    try {
      await supabase
        .from('contracts')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', contract.id);
      
      setContracts(prev => prev.map(c => 
        c.id === contract.id ? { ...c, status: 'sent' as const, sent_at: new Date().toISOString() } : c
      ));
    } catch (err) {
      console.error('Error sending contract:', err);
    }
    setMenuOpenId(null);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '—';
    const date = parseLocalDate(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
      className="fixed inset-0 z-[70] bg-background text-foreground flex flex-col overflow-y-auto"
      style={{
        overscrollBehaviorX: 'none',
        touchAction: 'pan-y',
      }}
    >
      <ScreenHeader
        onBack={onBack}
        backLabel="Go back"
        overline="Legal & riders"
        title="Contracts & docs"
        actions={<IconButton label="Create document" variant="filled" icon={<Plus />} onClick={() => setShowCreateModal(true)} />}
      />

      <div className="flex-1 flex flex-col gap-4 px-4 pt-4 max-w-2xl mx-auto w-full" style={{ paddingBottom: 'calc(var(--safe-bottom) + 40px)' }}>
        <SearchField value={searchQuery} onChange={setSearchQuery} label="Search documents" placeholder="Search by title, client or event…" />

        {/* Tabs (Figma Selector MD with counts) */}
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <Selector key={tab} size="md" selected={selectedTab === tab} onClick={() => setSelectedTab(tab)} count={getTabCount(tab)}>
              {tab}
            </Selector>
          ))}
        </div>

        {/* Overview */}
        {contracts.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2" aria-label={`${stats.signed} of ${stats.total} signed`}>
            <StatCard label="Total docs" value={stats.total} inverse />
            <StatCard label="Signed" value={stats.signed} />
            <StatCard label="Pending" value={stats.draft + stats.sent + stats.viewed} />
          </motion.div>
        )}

        {/* Documents */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : contracts.length === 0 ? (
          <Card className="items-center text-center py-10 gap-4">
            <FileText className="w-10 h-10 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <h2 className="bw-h3">No documents yet</h2>
              <p className="bw-body-sm text-muted-foreground max-w-xs">
                Keep your band performance agreements and technical riders organised in one place.
              </p>
            </div>
            <PillButton size="md" fullWidth={false} icon={<Plus className="w-4 h-4" />} onClick={() => setShowCreateModal(true)}>
              Create first document
            </PillButton>
          </Card>
        ) : filteredContracts.length === 0 ? (
          <Card className="items-center text-center py-8">
            <h2 className="bw-h3">No matches</h2>
            <p className="bw-body-sm text-muted-foreground">No documents match your search or filter.</p>
          </Card>
        ) : (
          <ul className="flex flex-col gap-4" aria-label={`Documents (${filteredContracts.length})`}>
            {filteredContracts.map((contract, index) => {
              const TypeIcon = contract.type === 'contract' ? FileText : ScrollText;
              const meta = [contract.client_name, contract.event_name, `Event date ${formatDate(contract.event_date)}`]
                .filter(Boolean)
                .join(' · ');
              return (
                <motion.li
                  key={contract.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.03, 0.3) }}
                  className="relative"
                >
                  <Card className="relative gap-2">
                    <div className="flex items-center gap-3">
                      <TypeIcon className="w-[22px] h-[22px] shrink-0" aria-label={contract.type === 'contract' ? 'Contract' : 'Rider'} />
                      <div className="flex-1" />
                      <StatusDot status={contract.status} />
                      <button
                        type="button"
                        onClick={() => setMenuOpenId(menuOpenId === contract.id ? null : contract.id)}
                        aria-label={`Actions for ${contract.title}`}
                        aria-expanded={menuOpenId === contract.id}
                        className="relative z-10 -m-3 p-3 text-foreground"
                      >
                        <MoreHorizontal className="w-[18px] h-[18px]" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleView(contract)}
                      className="text-left flex flex-col gap-2 after:absolute after:inset-0 after:rounded-[24px] after:content-['']"
                    >
                      <h3 className="bw-h3 text-foreground [overflow-wrap:anywhere]">{contract.title}</h3>
                      <p className="bw-body-sm text-muted-foreground line-clamp-2">{meta}</p>
                    </button>
                  </Card>

                  <AnimatePresence>
                    {menuOpenId === contract.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="absolute right-3 top-11 z-20 min-w-[180px] p-1 rounded-[16px] bg-popover text-popover-foreground shadow-lg border border-border origin-top-right"
                        role="menu"
                      >
                        {[
                          { label: 'View', icon: <Eye className="w-4 h-4" />, run: () => handleView(contract) },
                          { label: 'Download', icon: <Download className="w-4 h-4" />, run: () => handleDownloadPdf(contract) },
                          ...(contract.status === 'draft'
                            ? [{ label: 'Send to client', icon: <Send className="w-4 h-4" />, run: () => handleSendToClient(contract) }]
                            : []),
                          { label: 'Delete', icon: <Trash2 className="w-4 h-4" />, run: () => handleDelete(contract.id), danger: true },
                        ].map((item) => (
                          <button
                            key={item.label}
                            type="button"
                            role="menuitem"
                            onClick={item.run}
                            className={cn(
                              'w-full h-11 px-3 flex items-center gap-3 rounded-[12px] bw-body-sm font-medium text-left hover:bg-foreground/[0.06]',
                              'danger' in item && item.danger ? 'text-destructive' : 'text-foreground',
                            )}
                          >
                            {item.icon}
                            {item.label}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Create document — full screen */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: 'tween', duration: 0.25 }}
            className="fixed inset-0 z-[100] flex flex-col bg-background text-foreground"
          >
            <ScreenHeader
              onBack={() => setShowCreateModal(false)}
              overline="New document"
              title={`Create ${formType === 'contract' ? 'contract' : 'rider'}`}
              titleSize="h1"
            />

            <div className="flex-1 overflow-y-auto px-4 pt-6 pb-8 max-w-xl mx-auto w-full flex flex-col gap-6">
              <fieldset className="flex flex-col gap-2">
                <legend className="bw-label-sm text-muted-foreground mb-2">Document type</legend>
                <div className="flex flex-wrap gap-2">
                  <Selector size="md" selected={formType === 'contract'} onClick={() => setFormType('contract')}>
                    <FileText className="w-4 h-4" />
                    Contract
                  </Selector>
                  <Selector size="md" selected={formType === 'rider'} onClick={() => setFormType('rider')}>
                    <ScrollText className="w-4 h-4" />
                    Rider
                  </Selector>
                </div>
              </fieldset>

              <PillField
                label="Document title *"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Performance agreement 2026"
              />
              <PillField
                label="Event name"
                value={formEventName}
                onChange={(e) => setFormEventName(e.target.value)}
                placeholder="Annual gala night"
              />
              <PillField
                label="Client / venue *"
                value={formClientName}
                onChange={(e) => setFormClientName(e.target.value)}
                placeholder="Hotel Arts & Club"
              />
              <PillField label="Event date" type="date" value={formEventDate} onChange={(e) => setFormEventDate(e.target.value)} />

              <div className="flex flex-col gap-2">
                <label htmlFor="contract-notes" className="bw-label-sm text-muted-foreground">
                  Additional notes & terms
                </label>
                <textarea
                  id="contract-notes"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Technical specifications, load-in requirements, hospitality…"
                  rows={3}
                  className="w-full px-4 py-3.5 rounded-[24px] bg-field border border-border bw-body-lg text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-2 focus:border-foreground resize-none"
                />
              </div>
            </div>

            <div className="shrink-0 px-4 pt-3 bg-background" style={{ paddingBottom: 'calc(var(--safe-bottom) + 16px)' }}>
              <div className="max-w-xl mx-auto w-full">
                <PillButton
                  onClick={handleSaveContract}
                  loading={saving}
                  disabled={!formTitle.trim() || !formClientName.trim()}
                  icon={<FileText className="w-[18px] h-[18px]" />}
                >
                  Create {formType === 'contract' ? 'contract' : 'rider'}
                </PillButton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* View document (Figma Sheet, Style=Dark) */}
      <BwSheet
        open={!!viewingContract}
        onClose={() => setViewingContract(null)}
        overline={viewingContract ? STATUS_CONFIG[viewingContract.status]?.label || viewingContract.status : undefined}
        title={viewingContract?.title ?? ''}
        zIndex={110}
        footer={
          viewingContract && (
            <div className="flex gap-2">
              <PillButton
                variant="white"
                icon={<Download className="w-[18px] h-[18px]" />}
                onClick={() => {
                  handleDownloadPdf(viewingContract);
                  setViewingContract(null);
                }}
              >
                Download
              </PillButton>
              {viewingContract.status === 'draft' && (
                <PillButton
                  icon={<Send className="w-[18px] h-[18px]" />}
                  onClick={() => {
                    handleSendToClient(viewingContract);
                    setViewingContract(null);
                  }}
                >
                  Send
                </PillButton>
              )}
            </div>
          )
        }
      >
        {viewingContract && (
          <div className="flex flex-col gap-2">
            <SheetInfo label="Event">{viewingContract.event_name}</SheetInfo>
            <div className="grid grid-cols-2 gap-2">
              <SheetInfo label="Client" className="[&>p:last-child]:truncate">{viewingContract.client_name}</SheetInfo>
              <SheetInfo label="Event date">{formatDate(viewingContract.event_date)}</SheetInfo>
            </div>
            <SheetInfo label="Document type" className="capitalize">{viewingContract.type}</SheetInfo>
            {viewingContract.sent_at && <SheetInfo label="Sent">{formatDate(viewingContract.sent_at)}</SheetInfo>}
            {viewingContract.signed_at && <SheetInfo label="Signed">{formatDate(viewingContract.signed_at)}</SheetInfo>}
          </div>
        )}
      </BwSheet>
    </motion.div>
  );
};

export default ContractsView;
