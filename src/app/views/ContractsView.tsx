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
} from 'lucide-react';
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
    if (!formTitle.trim() || !formClientName.trim()) return;
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
      
      // Try to save to Supabase
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
        console.error('Error saving contract:', error);
      }
      
      // Add to local state
      setContracts([newContract, ...contracts]);
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
      // Show empty state if table doesn't exist
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

  // Calculate stats for hero card
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
    setContracts(contracts.filter(c => c.id !== id));
    setMenuOpenId(null);
  };

  const [viewingContract, setViewingContract] = useState<Contract | null>(null);

  const handleView = (contract: Contract) => {
    setViewingContract(contract);
    setMenuOpenId(null);
  };

  const handleDownloadPdf = (contract: Contract) => {
    // Generate a simple text file as PDF placeholder
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
    // Update status to 'sent'
    try {
      await supabase
        .from('contracts')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', contract.id);
      
      setContracts(contracts.map(c => 
        c.id === contract.id ? { ...c, status: 'sent' as const, sent_at: new Date().toISOString() } : c
      ));
      
      alert(`Contract "${contract.title}" has been sent to ${contract.client_name}`);
    } catch (err) {
      console.error('Error sending contract:', err);
      alert('Failed to send contract. Please try again.');
    }
    setMenuOpenId(null);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
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
      className="fixed inset-0 z-[70] bg-[#E6E5E1] overflow-y-auto overflow-x-hidden flex flex-col"
      style={{ overscrollBehaviorX: 'none', touchAction: 'pan-y' }}
    >
      {/* Header */}
      <div className="px-4 shrink-0" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}>
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={onBack}
            className="w-[50px] h-[50px] rounded-full flex items-center justify-center border-2 border-black shrink-0 active:scale-90 transition-transform"
            style={{ backgroundColor: 'rgba(216,216,216,0.2)' }}
          >
            <ArrowLeft className="w-[24px] h-[24px] text-black" />
          </button>
          <div className="flex flex-col leading-none flex-1">
            <span className="text-[32px] font-bold text-black leading-none">CONTRACTS</span>
            <span className="text-[32px] font-bold text-black leading-none">& RIDERS</span>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-[50px] h-[50px] rounded-full flex items-center justify-center bg-[#D5FB46] shrink-0 active:scale-90 transition-transform"
          >
            <Plus className="w-[20px] h-[20px] text-black" />
          </button>
        </div>

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search contracts..."
            className="w-full bg-transparent border-b-2 border-black/10 py-3 text-sm font-bold text-black placeholder:text-black/20 focus:outline-none focus:border-black transition-colors"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              className={cn(
                "px-3 py-1.5 rounded-full text-[10px] font-bold uppercase whitespace-nowrap transition-all",
                selectedTab === tab
                  ? "bg-black text-white"
                  : "bg-black/5 text-black/40 active:bg-black/10"
              )}
            >
              {tab}
              <span className="ml-1 opacity-60">{getTabCount(tab)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Contracts List */}
      <div className="flex-1 px-4 pb-20 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-black/30" />
          </div>
        ) : contracts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <FileText className="w-12 h-12 text-black/15 mb-3" />
            <span className="text-xs font-bold text-black/40 uppercase tracking-wide mb-1">No contracts found</span>
            <span className="text-[10px] font-medium text-black/30 uppercase">Create your first contract or rider</span>
          </div>
        ) : (
          <>
            {/* Stats Row */}
            <div className="flex gap-5 mb-10">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="flex-1 flex flex-col gap-1 items-start">
                <span className="text-xs font-bold text-black tracking-wide">TOTAL</span>
                <span className="text-[42px] font-bold leading-tight text-black">{stats.total}</span>
                <span className="text-[10px] font-medium text-black/40 uppercase">DOCUMENTS</span>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex-1 flex flex-col gap-1 items-start">
                <span className="text-xs font-bold text-black tracking-wide">SIGNED</span>
                <span className="text-[42px] font-bold leading-tight text-black">{stats.signed}</span>
                <span className="text-[10px] font-medium text-black/40 uppercase">COMPLETED</span>
              </motion.div>
            </div>

            {/* Section Title */}
            <div className="flex flex-col mb-5">
              <span className="text-[32px] font-bold leading-none text-black">ALL</span>
              <span className="text-[32px] font-bold leading-none text-black">DOCUMENTS</span>
            </div>

            {filteredContracts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <span className="text-[10px] font-medium text-black/40 uppercase">No documents match your filter</span>
              </div>
            ) : (
              <div className="flex flex-col gap-0">
                {filteredContracts.map((contract, index) => {
              const statusConfig = STATUS_CONFIG[contract.status];
              
              return (
                <motion.div
                  key={contract.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className="relative"
                >
                  <div className="flex items-center justify-between py-4 border-b border-black/10">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-[10px] bg-[#CDCACA] flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-black/50" />
                      </div>
                      <div className="flex flex-col items-start min-w-0">
                        <span className="text-xs font-bold text-black uppercase tracking-wide truncate max-w-full">{contract.title}</span>
                        <span className="text-[10px] font-medium text-black/40 uppercase">
                          {contract.client_name} · {statusConfig.label} · {formatDate(contract.event_date)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => setMenuOpenId(menuOpenId === contract.id ? null : contract.id)}
                      className="w-8 h-8 flex items-center justify-center active:opacity-70 transition-opacity shrink-0"
                    >
                      <MoreHorizontal className="w-4 h-4 text-black" />
                    </button>
                  </div>

                  {/* Inline Action Menu */}
                  <AnimatePresence>
                    {menuOpenId === contract.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden border-b border-black/10"
                      >
                        <div className="py-2 flex flex-col gap-0">
                          <button
                            onClick={() => handleView(contract)}
                            className="flex items-center gap-3 py-3 px-2 active:opacity-70 transition-opacity"
                          >
                            <Eye className="w-4 h-4 text-black/40" />
                            <span className="text-xs font-bold text-black uppercase tracking-wide">VIEW</span>
                          </button>
                          <button
                            onClick={() => handleDownloadPdf(contract)}
                            className="flex items-center gap-3 py-3 px-2 active:opacity-70 transition-opacity"
                          >
                            <Download className="w-4 h-4 text-black/40" />
                            <span className="text-xs font-bold text-black uppercase tracking-wide">DOWNLOAD</span>
                          </button>
                          {contract.status === 'draft' && (
                            <button
                              onClick={() => handleSendToClient(contract)}
                              className="flex items-center gap-3 py-3 px-2 active:opacity-70 transition-opacity"
                            >
                              <Send className="w-4 h-4 text-black/40" />
                              <span className="text-xs font-bold text-black uppercase tracking-wide">SEND TO CLIENT</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(contract.id)}
                            className="flex items-center gap-3 py-3 px-2 active:opacity-70 transition-opacity"
                          >
                            <Trash2 className="w-4 h-4 text-[#A73131]" />
                            <span className="text-xs font-bold text-[#A73131] uppercase tracking-wide">DELETE</span>
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Modal - Swiss Editorial Fullscreen */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-[#E6E5E1]"
          >
            {/* Header */}
            <div
              className="px-4 shrink-0"
              style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}
            >
              <div className="flex items-center gap-4 mb-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="w-[50px] h-[50px] rounded-full flex items-center justify-center border-2 border-black shrink-0 active:scale-90 transition-transform"
                  style={{ backgroundColor: 'rgba(216,216,216,0.2)' }}
                >
                  <ArrowLeft className="w-[24px] h-[24px] text-black" />
                </button>
                <div className="flex flex-col leading-none">
                  <span className="text-[32px] font-bold text-black leading-none">CREATE</span>
                  <span className="text-[32px] font-bold text-black leading-none">DOCUMENT</span>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 pb-32">
              <div className="space-y-6">
                {/* Type Selection */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 block mb-3">Document Type</label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setFormType('contract')}
                      className={cn(
                        "flex-1 p-4 rounded-2xl flex flex-col items-center gap-2 transition-all",
                        formType === 'contract'
                          ? "bg-black text-white"
                          : "bg-white/50 text-black/50 hover:bg-white"
                      )}
                    >
                      <FileText className="w-6 h-6" />
                      <span className="text-sm font-bold">Contract</span>
                    </button>
                    <button
                      onClick={() => setFormType('rider')}
                      className={cn(
                        "flex-1 p-4 rounded-2xl flex flex-col items-center gap-2 transition-all",
                        formType === 'rider'
                          ? "bg-black text-white"
                          : "bg-white/50 text-black/50 hover:bg-white"
                      )}
                    >
                      <ScrollText className="w-6 h-6" />
                      <span className="text-sm font-bold">Rider</span>
                    </button>
                  </div>
                </motion.div>
                
                {/* Title */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.15 }}
                >
                  <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 block mb-2">Document Title</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g., Performance Agreement"
                    className="w-full bg-white/50 border-b-2 border-black/10 py-4 px-0 text-xl font-medium text-black placeholder:text-black/30 focus:outline-none focus:border-black transition-colors"
                  />
                </motion.div>
                
                {/* Event Name */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 block mb-2">Event Name</label>
                  <input
                    type="text"
                    value={formEventName}
                    onChange={(e) => setFormEventName(e.target.value)}
                    placeholder="e.g., Summer Music Festival"
                    className="w-full bg-white/50 border-b-2 border-black/10 py-3 px-0 text-base font-medium text-black placeholder:text-black/30 focus:outline-none focus:border-black transition-colors"
                  />
                </motion.div>
                
                {/* Client Name */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.25 }}
                >
                  <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 block mb-2">Client / Venue</label>
                  <input
                    type="text"
                    value={formClientName}
                    onChange={(e) => setFormClientName(e.target.value)}
                    placeholder="e.g., Blue Note Jazz Club"
                    className="w-full bg-white/50 border-b-2 border-black/10 py-3 px-0 text-base font-medium text-black placeholder:text-black/30 focus:outline-none focus:border-black transition-colors"
                  />
                </motion.div>
                
                {/* Event Date */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 block mb-2">Event Date</label>
                  <div className="relative">
                    <input
                      type="date"
                      value={formEventDate}
                      onChange={(e) => setFormEventDate(e.target.value)}
                      className="w-full bg-white rounded-2xl py-4 px-4 text-base font-medium text-black focus:outline-none focus:ring-2 focus:ring-black"
                    />
                    <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-black/30 pointer-events-none" />
                  </div>
                </motion.div>
                
                {/* Notes */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.35 }}
                >
                  <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 block mb-2">Additional Notes</label>
                  <textarea
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="Any special requirements, technical specifications, or notes..."
                    rows={4}
                    className="w-full bg-white/50 rounded-2xl p-4 text-base font-medium text-black placeholder:text-black/30 focus:outline-none focus:ring-2 focus:ring-black resize-none"
                  />
                </motion.div>
              </div>
            </div>

            {/* Footer */}
            <div 
              className="absolute bottom-0 left-0 right-0 px-6 pb-6 pt-4 bg-gradient-to-t from-[#E6E5E1] via-[#E6E5E1] to-transparent"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}
            >
              <button
                onClick={handleSaveContract}
                disabled={!formTitle.trim() || !formClientName.trim() || saving}
                className="w-full h-14 rounded-full bg-black text-white font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-30 active:scale-[0.98] transition-all"
              >
                {saving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <FileText className="w-5 h-5" />
                    Create {formType === 'contract' ? 'Contract' : 'Rider'}
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* View Contract Modal */}
      <AnimatePresence>
        {viewingContract && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
            onClick={() => setViewingContract(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-6">
                <div>
                  <span className="text-[10px] font-bold uppercase text-black/40 mb-2 block">
                    {STATUS_CONFIG[viewingContract.status].label}
                  </span>
                  <h2 className="text-2xl font-bold text-black uppercase">{viewingContract.title}</h2>
                </div>
                <button
                  onClick={() => setViewingContract(null)}
                  className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center hover:bg-black/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-black/[0.03] rounded-2xl">
                  <p className="text-xs font-bold text-black/40 uppercase mb-1">Event</p>
                  <p className="text-lg font-bold text-black">{viewingContract.event_name}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-black/[0.03] rounded-2xl">
                    <p className="text-xs font-bold text-black/40 uppercase mb-1">Client</p>
                    <p className="font-bold text-black">{viewingContract.client_name}</p>
                  </div>
                  <div className="p-4 bg-black/[0.03] rounded-2xl">
                    <p className="text-xs font-bold text-black/40 uppercase mb-1">Event Date</p>
                    <p className="font-bold text-black">{formatDate(viewingContract.event_date)}</p>
                  </div>
                </div>

                <div className="p-4 bg-black/[0.03] rounded-2xl">
                  <p className="text-xs font-bold text-black/40 uppercase mb-1">Type</p>
                  <p className="font-bold text-black capitalize">{viewingContract.type}</p>
                </div>

                {viewingContract.sent_at && (
                  <div className="p-4 bg-blue-50 rounded-2xl">
                    <p className="text-xs font-bold text-blue-600 uppercase mb-1">Sent</p>
                    <p className="font-bold text-blue-900">{formatDate(viewingContract.sent_at)}</p>
                  </div>
                )}

                {viewingContract.signed_at && (
                  <div className="p-4 bg-green-50 rounded-2xl">
                    <p className="text-xs font-bold text-green-600 uppercase mb-1">Signed</p>
                    <p className="font-bold text-green-900">{formatDate(viewingContract.signed_at)}</p>
                  </div>
                )}
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => {
                    handleDownloadPdf(viewingContract);
                    setViewingContract(null);
                  }}
                  className="flex-1 h-12 rounded-full bg-black/5 text-black font-bold text-sm flex items-center justify-center gap-2 hover:bg-black/10"
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
                    className="flex-1 h-12 rounded-full bg-blue-600 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-blue-700"
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
