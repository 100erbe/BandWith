import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  Search,
  FileText,
  CheckCircle,
  Clock,
  Send,
  AlertCircle,
  MoreVertical,
  Eye,
  Download,
  Trash2,
  X,
  Loader2,
  Calendar,
  ScrollText,
  PenTool,
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

const STATUS_CONFIG = {
  draft: { label: 'Draft', color: 'bg-black/10 text-black/60', icon: FileText },
  sent: { label: 'Sent', color: 'bg-blue-500/10 text-blue-600', icon: Send },
  viewed: { label: 'Viewed', color: 'bg-purple-500/10 text-purple-600', icon: Eye },
  signed: { label: 'Signed', color: 'bg-green-500/10 text-green-600', icon: CheckCircle },
  expired: { label: 'Expired', color: 'bg-red-500/10 text-red-600', icon: AlertCircle },
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
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 50 }}
      transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}
      className="fixed inset-0 z-[70] bg-[#E6E5E1] overflow-y-auto flex flex-col"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Header */}
      <div className="px-6 shrink-0" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}>
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-1">Legal</p>
            <h1 className="text-4xl font-black text-black tracking-tight uppercase">DOCUMENTS</h1>
            <p className="text-sm text-black/50 font-bold tracking-tight mt-1">{stats.sent + stats.viewed} pending · {stats.signed} signed</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="w-12 h-12 rounded-full bg-[#D4FB46] flex items-center justify-center active:scale-95 transition-transform"
            >
              <Plus className="w-5 h-5 text-black" />
            </button>
            <button
              onClick={onBack}
              className="w-12 h-12 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center transition-all"
            >
              <X className="w-6 h-6 text-black/50" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-black/30" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search contracts..."
            className="w-full h-12 pl-11 pr-4 rounded-2xl bg-white text-sm font-medium text-black placeholder:text-black/30 border border-black/5 focus:outline-none focus:border-black/20 transition-colors"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              className={cn(
                "flex-1 py-3 rounded-full text-sm font-bold transition-all",
                selectedTab === tab
                  ? "bg-black text-white"
                  : "bg-white/60 text-black/50 hover:bg-white"
              )}
            >
              {tab}
              <span className="ml-1.5 text-xs opacity-60">{getTabCount(tab)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Contracts List */}
      <div className="flex-1 px-5 py-4 pb-20 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-black/40" />
          </div>
        ) : contracts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FileText className="w-12 h-12 text-black/20 mb-3" />
            <p className="text-black/50 font-medium">No contracts found</p>
            <p className="text-black/40 text-sm">Create your first contract or rider</p>
          </div>
        ) : (
          <>
            {/* Hero Card - Contract Pipeline */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mb-6 p-6 bg-gradient-to-br from-[#1A1A1A] to-[#2A2A2E] rounded-[2rem] relative overflow-hidden shadow-xl"
            >
              {/* Decorative gradient */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4FB46]/10 rounded-full blur-3xl" />
              
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <span className="text-[#D4FB46] text-[10px] font-bold uppercase tracking-widest block mb-1">Documents</span>
                    <div className="flex items-baseline gap-3">
                      <h3 className="text-4xl font-black text-white tracking-tighter">{stats.total}</h3>
                      <span className="text-stone-500 text-lg font-medium">total</span>
                    </div>
                  </div>
                  <div className="w-14 h-14 bg-[#D4FB46] rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(212,251,70,0.3)]">
                    <ScrollText className="w-7 h-7 text-[#1A1A1A]" />
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-3 mb-5">
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white/5 rounded-xl p-3 border border-white/10"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Send className="w-4 h-4 text-blue-400" />
                      <span className="text-[10px] font-bold text-stone-500 uppercase">Sent</span>
                    </div>
                    <span className="text-xl font-black text-white">{stats.sent}</span>
                  </motion.div>
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.25 }}
                    className="bg-white/5 rounded-xl p-3 border border-white/10"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <PenTool className="w-4 h-4 text-green-400" />
                      <span className="text-[10px] font-bold text-stone-500 uppercase">Signed</span>
                    </div>
                    <span className="text-xl font-black text-white">{stats.signed}</span>
                  </motion.div>
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="bg-white/5 rounded-xl p-3 border border-white/10"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="w-4 h-4 text-stone-400" />
                      <span className="text-[10px] font-bold text-stone-500 uppercase">Draft</span>
                    </div>
                    <span className="text-xl font-black text-white">{stats.draft}</span>
                  </motion.div>
                </div>

                {/* Progress Pipeline */}
                {stats.total > 0 && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.35 }}
                  >
                    <div className="flex items-center justify-between text-[10px] font-bold text-stone-500 mb-2">
                      <span>SIGNING PIPELINE</span>
                      <span>{Math.round((stats.signed / stats.total) * 100)}% completed</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden flex">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(stats.signed / stats.total) * 100}%` }}
                        transition={{ delay: 0.4, duration: 0.5, ease: "easeOut" }}
                        className="bg-green-500 h-full"
                      />
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(stats.viewed / stats.total) * 100}%` }}
                        transition={{ delay: 0.5, duration: 0.5, ease: "easeOut" }}
                        className="bg-purple-500 h-full"
                      />
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(stats.sent / stats.total) * 100}%` }}
                        transition={{ delay: 0.6, duration: 0.5, ease: "easeOut" }}
                        className="bg-blue-500 h-full"
                      />
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(stats.draft / stats.total) * 100}%` }}
                        transition={{ delay: 0.7, duration: 0.5, ease: "easeOut" }}
                        className="bg-stone-500 h-full"
                      />
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-[10px] font-bold">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Signed</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500" /> Viewed</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Sent</span>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>

            {/* List Header */}
            <h4 className="text-[10px] font-bold text-black/40 uppercase tracking-widest mb-3 px-1">
              {filteredContracts.length === 0 ? 'No matches' : `All Documents (${filteredContracts.length})`}
            </h4>

            {filteredContracts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Search className="w-8 h-8 text-black/20 mb-2" />
                <p className="text-black/50 font-medium text-sm">No documents match your filter</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredContracts.map((contract, index) => {
              const statusConfig = STATUS_CONFIG[contract.status];
              const StatusIcon = statusConfig.icon;
              
              return (
                <motion.div
                  key={contract.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white rounded-2xl p-4 relative"
                >
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center",
                      contract.type === 'contract' ? "bg-blue-500/10" : "bg-purple-500/10"
                    )}>
                      <FileText className={cn(
                        "w-5 h-5",
                        contract.type === 'contract' ? "text-blue-600" : "text-purple-600"
                      )} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-bold text-black truncate pr-2">{contract.title}</h3>
                          <p className="text-sm text-black/50 truncate">{contract.event_name}</p>
                        </div>
                        
                        <button
                          onClick={() => setMenuOpenId(menuOpenId === contract.id ? null : contract.id)}
                          className="p-2 -mr-2 -mt-1 rounded-lg hover:bg-black/5 transition-colors"
                        >
                          <MoreVertical className="w-4 h-4 text-black/40" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2 mt-3">
                        <span className={cn(
                          "px-2 py-1 rounded-full text-[10px] font-bold uppercase flex items-center gap-1",
                          statusConfig.color
                        )}>
                          <StatusIcon className="w-3 h-3" />
                          {statusConfig.label}
                        </span>
                        <span className="text-xs text-black/40 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(contract.event_date)}
                        </span>
                      </div>

                      <p className="text-xs text-black/40 mt-2">
                        Client: {contract.client_name}
                      </p>
                    </div>
                  </div>

                  {/* Context Menu */}
                  <AnimatePresence>
                    {menuOpenId === contract.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="absolute right-4 top-12 bg-white rounded-xl shadow-xl border border-black/5 overflow-hidden z-10"
                      >
                        <button
                          onClick={() => handleView(contract)}
                          className="w-full px-4 py-3 flex items-center gap-3 text-sm font-medium text-black/70 hover:bg-white/80"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </button>
                        <button
                          onClick={() => handleDownloadPdf(contract)}
                          className="w-full px-4 py-3 flex items-center gap-3 text-sm font-medium text-black/70 hover:bg-white/80"
                        >
                          <Download className="w-4 h-4" />
                          Download PDF
                        </button>
                        {contract.status === 'draft' && (
                          <button
                            onClick={() => handleSendToClient(contract)}
                            className="w-full px-4 py-3 flex items-center gap-3 text-sm font-medium text-blue-600 hover:bg-blue-50"
                          >
                            <Send className="w-4 h-4" />
                            Send to Client
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(contract.id)}
                          className="w-full px-4 py-3 flex items-center gap-3 text-sm font-medium text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
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
              className="px-6 pt-6 pb-4 flex-shrink-0"
              style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-1">Contracts</p>
                  <h1 className="text-4xl font-black text-black tracking-tight">CREATE</h1>
                  <p className="text-sm text-black/50 mt-1">Professional documentation</p>
                </div>
                <button 
                  onClick={() => setShowCreateModal(false)}
                  className="w-12 h-12 rounded-full bg-black/5 flex items-center justify-center hover:bg-black/10 transition-colors"
                >
                  <X className="w-5 h-5 text-black" />
                </button>
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
                  <span className={cn(
                    "text-[10px] font-bold uppercase px-2 py-1 rounded-full mb-2 inline-block",
                    STATUS_CONFIG[viewingContract.status].color
                  )}>
                    {STATUS_CONFIG[viewingContract.status].label}
                  </span>
                  <h2 className="text-2xl font-black text-black">{viewingContract.title}</h2>
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
