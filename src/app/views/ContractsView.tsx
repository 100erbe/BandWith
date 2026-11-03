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
  X,
  Loader2,
  Calendar,
  ScrollText,
  ArrowLeft,
  Search,
} from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { supabase } from '@/lib/supabase';

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

const STATUS_CONFIG: Record<string, { label: string }> = {
  draft: { label: 'Draft' },
  sent: { label: 'Sent' },
  viewed: { label: 'Viewed' },
  signed: { label: 'Signed' },
  expired: { label: 'Expired' },
};

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
        event_date: formEventDate || new Date().toISOString().split('T')[0],
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
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
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
      {/* ═══ STICKY HEADER ═══ */}
      <div
        className="px-4 shrink-0 border-b border-foreground/10 bg-background/95 backdrop-blur-md sticky top-0 z-30"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
          paddingBottom: '14px',
        }}
      >
        <div className="max-w-2xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              aria-label="Go back"
              className="w-10 h-10 rounded-full border border-foreground/20 bg-foreground/5 hover:bg-foreground/10 flex items-center justify-center text-foreground transition-all active:scale-90 shrink-0"
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-foreground/50 uppercase tracking-wider">
                LEGAL & RIDERS
              </span>
              <h1 className="text-[22px] font-black uppercase text-foreground leading-none">
                CONTRACTS & DOCS
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xs active:scale-95 transition-all shrink-0"
            aria-label="Create document"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ═══ MAIN CONTENT ═══ */}
      <div className="p-4 flex-1 flex flex-col gap-5 max-w-2xl mx-auto w-full pb-32">
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents by title, client, or event..."
            className="w-full px-4 py-2.5 pl-10 rounded-[12px] bg-foreground/5 border border-foreground/10 text-sm font-medium text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-primary transition-colors"
          />
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              className={cn(
                'px-3.5 py-1.5 rounded-[8px] text-[11px] font-bold uppercase tracking-wider whitespace-nowrap transition-all border',
                selectedTab === tab
                  ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                  : 'bg-foreground/5 hover:bg-foreground/10 text-foreground/70 border-foreground/10'
              )}
            >
              {tab}
              <span className="ml-1 opacity-60">({getTabCount(tab)})</span>
            </button>
          ))}
        </div>

        {/* Stats Card */}
        {contracts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-[16px] p-5 border border-foreground/10 shadow-xs flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/50">
                DOCUMENT OVERVIEW
              </span>
              <span className="text-xs font-semibold text-foreground/50">
                {stats.signed} of {stats.total} signed
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              <div className="bg-foreground/5 rounded-[10px] p-3 border border-foreground/5">
                <span className="text-[10px] font-bold text-foreground/50 uppercase block mb-1">Total Docs</span>
                <span className="text-xl font-black text-foreground">{stats.total}</span>
              </div>
              <div className="bg-foreground/5 rounded-[10px] p-3 border border-foreground/5">
                <span className="text-[10px] font-bold text-foreground/50 uppercase block mb-1">Signed</span>
                <span className="text-xl font-black text-green-600 dark:text-green-400">{stats.signed}</span>
              </div>
              <div className="bg-foreground/5 rounded-[10px] p-3 border border-foreground/5">
                <span className="text-[10px] font-bold text-foreground/50 uppercase block mb-1">Pending</span>
                <span className="text-xl font-black text-amber-600 dark:text-amber-400">
                  {stats.draft + stats.sent + stats.viewed}
                </span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Contracts List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-foreground/30" />
          </div>
        ) : contracts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-foreground/40 border border-dashed border-foreground/15 rounded-[16px] p-8">
            <FileText className="w-12 h-12 text-foreground/20 mb-3" />
            <h3 className="text-base font-bold text-foreground mb-1">No documents yet</h3>
            <p className="text-xs text-foreground/50 max-w-xs mb-5">
              Keep your band performance agreements and technical riders organized in one place.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2.5 bg-primary text-primary-foreground rounded-[10px] font-bold text-xs uppercase tracking-wider shadow-xs hover:opacity-95 transition-opacity"
            >
              Create First Document
            </button>
          </div>
        ) : filteredContracts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-foreground/40">
            <p className="text-xs font-bold">No documents match your search or filter</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-bold text-foreground/50 uppercase tracking-wider">
                ALL DOCUMENTS ({filteredContracts.length})
              </span>
            </div>

            <div className="space-y-2.5">
              {filteredContracts.map((contract, index) => {
                const statusConfig = STATUS_CONFIG[contract.status] || { label: contract.status };
                
                return (
                  <motion.div
                    key={contract.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.03, 0.3) }}
                    className="bg-card rounded-[14px] p-4 border border-foreground/10 shadow-xs flex flex-col gap-2 hover:border-foreground/20 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-[10px] bg-foreground/5 flex items-center justify-center shrink-0 text-foreground/70">
                          {contract.type === 'contract' ? (
                            <FileText className="w-5 h-5 text-primary" />
                          ) : (
                            <ScrollText className="w-5 h-5 text-primary" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-sm text-foreground truncate">{contract.title}</h3>
                            <span className={cn(
                              'text-[9px] font-bold uppercase px-2 py-0.5 rounded-[6px] border shrink-0',
                              contract.status === 'signed'
                                ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20'
                                : contract.status === 'sent'
                                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                                : contract.status === 'viewed'
                                ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                                : 'bg-foreground/5 text-foreground/50 border-foreground/10'
                            )}>
                              {statusConfig.label}
                            </span>
                          </div>
                          <p className="text-xs text-foreground/60 truncate mt-0.5">
                            {contract.client_name} · {contract.event_name}
                          </p>
                          <p className="text-[11px] text-foreground/40 mt-1 flex items-center gap-1 font-medium">
                            <Calendar className="w-3 h-3" /> Event Date: {formatDate(contract.event_date)}
                          </p>
                        </div>
                      </div>

                      <div className="relative shrink-0">
                        <button
                          onClick={() => setMenuOpenId(menuOpenId === contract.id ? null : contract.id)}
                          aria-label="Actions"
                          className="w-8 h-8 rounded-full hover:bg-foreground/10 flex items-center justify-center text-foreground/50 transition-colors"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                        <AnimatePresence>
                          {menuOpenId === contract.id && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              className="absolute right-0 top-9 bg-card rounded-[12px] shadow-lg border border-foreground/15 p-1 z-20 min-w-[150px]"
                            >
                              <button
                                onClick={() => handleView(contract)}
                                className="w-full px-3 py-2 flex items-center gap-2 hover:bg-foreground/5 rounded-[8px] text-left text-xs font-semibold text-foreground transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5 text-foreground/60" /> View
                              </button>
                              <button
                                onClick={() => handleDownloadPdf(contract)}
                                className="w-full px-3 py-2 flex items-center gap-2 hover:bg-foreground/5 rounded-[8px] text-left text-xs font-semibold text-foreground transition-colors"
                              >
                                <Download className="w-3.5 h-3.5 text-foreground/60" /> Download
                              </button>
                              {contract.status === 'draft' && (
                                <button
                                  onClick={() => handleSendToClient(contract)}
                                  className="w-full px-3 py-2 flex items-center gap-2 hover:bg-foreground/5 rounded-[8px] text-left text-xs font-semibold text-primary transition-colors"
                                >
                                  <Send className="w-3.5 h-3.5" /> Send to Client
                                </button>
                              )}
                              <button
                                onClick={() => handleDelete(contract.id)}
                                className="w-full px-3 py-2 flex items-center gap-2 hover:bg-destructive/10 rounded-[8px] text-left text-xs font-semibold text-destructive transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Delete
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ═══ CREATE DOCUMENT MODAL ═══ */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-background text-foreground"
          >
            {/* Header */}
            <div
              className="px-4 shrink-0 border-b border-foreground/10 bg-background/95 backdrop-blur-md sticky top-0 z-30"
              style={{
                paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
                paddingBottom: '14px',
              }}
            >
              <div className="max-w-xl mx-auto w-full flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="w-10 h-10 rounded-full border border-foreground/20 bg-foreground/5 hover:bg-foreground/10 flex items-center justify-center text-foreground transition-all active:scale-90 shrink-0"
                  >
                    <ArrowLeft className="w-5 h-5 text-foreground" />
                  </button>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-foreground/50 uppercase tracking-wider">
                      NEW DOCUMENT
                    </span>
                    <h2 className="text-[20px] font-black uppercase text-foreground leading-none">
                      CREATE {formType === 'contract' ? 'CONTRACT' : 'RIDER'}
                    </h2>
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 py-6 max-w-xl mx-auto w-full pb-32 space-y-5">
              {/* Type Selection */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-foreground/50 block mb-2">
                  Document Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormType('contract')}
                    className={cn(
                      'p-3.5 rounded-[12px] flex items-center justify-center gap-2 transition-all border font-bold text-xs uppercase tracking-wider',
                      formType === 'contract'
                        ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                        : 'bg-card text-foreground/70 border-foreground/10 hover:bg-foreground/5'
                    )}
                  >
                    <FileText className="w-4 h-4" />
                    Contract
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormType('rider')}
                    className={cn(
                      'p-3.5 rounded-[12px] flex items-center justify-center gap-2 transition-all border font-bold text-xs uppercase tracking-wider',
                      formType === 'rider'
                        ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                        : 'bg-card text-foreground/70 border-foreground/10 hover:bg-foreground/5'
                    )}
                  >
                    <ScrollText className="w-4 h-4" />
                    Rider
                  </button>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-foreground/50 block mb-1.5">
                  Document Title *
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g., Performance Agreement 2026"
                  className="w-full px-4 py-3 rounded-[12px] bg-foreground/5 border border-foreground/10 text-sm font-medium text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              {/* Event Name */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-foreground/50 block mb-1.5">
                  Event Name
                </label>
                <input
                  type="text"
                  value={formEventName}
                  onChange={(e) => setFormEventName(e.target.value)}
                  placeholder="e.g., Annual Gala Night"
                  className="w-full px-4 py-3 rounded-[12px] bg-foreground/5 border border-foreground/10 text-sm font-medium text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              {/* Client Name */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-foreground/50 block mb-1.5">
                  Client / Venue *
                </label>
                <input
                  type="text"
                  value={formClientName}
                  onChange={(e) => setFormClientName(e.target.value)}
                  placeholder="e.g., Hotel Arts & Club"
                  className="w-full px-4 py-3 rounded-[12px] bg-foreground/5 border border-foreground/10 text-sm font-medium text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              {/* Event Date */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-foreground/50 block mb-1.5">
                  Event Date
                </label>
                <input
                  type="date"
                  value={formEventDate}
                  onChange={(e) => setFormEventDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-[12px] bg-foreground/5 border border-foreground/10 text-sm font-medium text-foreground focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-foreground/50 block mb-1.5">
                  Additional Notes & Terms
                </label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Technical specifications, load-in requirements, hospitality..."
                  rows={3}
                  className="w-full p-4 rounded-[12px] bg-foreground/5 border border-foreground/10 text-sm font-medium text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-primary resize-none transition-colors"
                />
              </div>
            </div>

            {/* Footer */}
            <div 
              className="sticky bottom-0 left-0 right-0 px-4 py-4 border-t border-foreground/10 bg-background/95 backdrop-blur-md"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
            >
              <div className="max-w-xl mx-auto w-full">
                <button
                  onClick={handleSaveContract}
                  disabled={!formTitle.trim() || !formClientName.trim() || saving}
                  className="w-full h-12 rounded-[12px] bg-primary text-primary-foreground font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xs disabled:opacity-40 active:scale-[0.98] transition-all"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      Create {formType === 'contract' ? 'Contract' : 'Rider'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ VIEW CONTRACT MODAL ═══ */}
      <AnimatePresence>
        {viewingContract && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setViewingContract(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-card rounded-[16px] p-6 shadow-2xl border border-foreground/10 text-foreground"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-5">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/50 mb-1 block">
                    {STATUS_CONFIG[viewingContract.status]?.label || viewingContract.status}
                  </span>
                  <h2 className="text-xl font-black text-foreground">{viewingContract.title}</h2>
                </div>
                <button
                  onClick={() => setViewingContract(null)}
                  className="w-8 h-8 rounded-full border border-foreground/20 bg-foreground/5 flex items-center justify-center text-foreground hover:bg-foreground/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 bg-foreground/5 rounded-[12px] border border-foreground/5">
                  <p className="text-[10px] font-bold text-foreground/50 uppercase mb-0.5">Event</p>
                  <p className="text-sm font-bold text-foreground">{viewingContract.event_name}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 bg-foreground/5 rounded-[12px] border border-foreground/5">
                    <p className="text-[10px] font-bold text-foreground/50 uppercase mb-0.5">Client</p>
                    <p className="text-sm font-bold text-foreground truncate">{viewingContract.client_name}</p>
                  </div>
                  <div className="p-3.5 bg-foreground/5 rounded-[12px] border border-foreground/5">
                    <p className="text-[10px] font-bold text-foreground/50 uppercase mb-0.5">Event Date</p>
                    <p className="text-sm font-bold text-foreground">{formatDate(viewingContract.event_date)}</p>
                  </div>
                </div>

                <div className="p-3.5 bg-foreground/5 rounded-[12px] border border-foreground/5">
                  <p className="text-[10px] font-bold text-foreground/50 uppercase mb-0.5">Document Type</p>
                  <p className="text-sm font-bold text-foreground capitalize">{viewingContract.type}</p>
                </div>

                {viewingContract.sent_at && (
                  <div className="p-3.5 bg-blue-500/10 rounded-[12px] border border-blue-500/20">
                    <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase mb-0.5">Sent</p>
                    <p className="text-xs font-semibold text-foreground">{formatDate(viewingContract.sent_at)}</p>
                  </div>
                )}

                {viewingContract.signed_at && (
                  <div className="p-3.5 bg-green-500/10 rounded-[12px] border border-green-500/20">
                    <p className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase mb-0.5">Signed</p>
                    <p className="text-xs font-semibold text-foreground">{formatDate(viewingContract.signed_at)}</p>
                  </div>
                )}
              </div>

              <div className="mt-5 flex gap-2.5">
                <button
                  onClick={() => {
                    handleDownloadPdf(viewingContract);
                    setViewingContract(null);
                  }}
                  className="flex-1 h-11 rounded-[12px] bg-foreground/10 hover:bg-foreground/15 text-foreground font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
                {viewingContract.status === 'draft' && (
                  <button
                    onClick={() => {
                      handleSendToClient(viewingContract);
                      setViewingContract(null);
                    }}
                    className="flex-1 h-11 rounded-[12px] bg-primary text-primary-foreground font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xs hover:opacity-95 transition-opacity"
                  >
                    <Send className="w-4 h-4" />
                    Send
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ContractsView;