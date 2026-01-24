import React from 'react';
import { motion } from 'motion/react';
import {
  X, ArrowLeft, Send, Copy, Edit3, Trash2,
  CheckCircle, XCircle, Clock, Eye, Calendar,
  FileText
} from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { Quote, QuoteStatus, getStatusColor, getStatusLabel } from '@/app/data/quotes';

interface QuoteDetailModalProps {
  quote: Quote;
  onClose: () => void;
  onEdit?: (quote: Quote) => void;
  onSend?: (quote: Quote) => void;
  onDuplicate?: (quote: Quote) => void;
  onDelete?: (quote: Quote) => void;
}

export const QuoteDetailModal: React.FC<QuoteDetailModalProps> = ({
  quote,
  onClose,
  onEdit,
  onSend,
  onDuplicate,
  onDelete,
}) => {
  const canEdit = quote.status === 'DRAFT';
  const canSend = quote.status === 'DRAFT';
  const canDuplicate = true;

  const getStatusIcon = (status: QuoteStatus) => {
    switch (status) {
      case 'DRAFT': return <Edit3 className="w-4 h-4" />;
      case 'SENT': return <Send className="w-4 h-4" />;
      case 'ACCEPTED': return <CheckCircle className="w-4 h-4" />;
      case 'DECLINED': return <XCircle className="w-4 h-4" />;
      case 'EXPIRED': return <Clock className="w-4 h-4" />;
      default: return null;
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[110]"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, y: '100%' }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: '100%' }}
        transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
        className="fixed inset-x-0 bottom-0 z-[120] bg-[#E6E5E1] rounded-t-[2.5rem] max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-6 flex items-center justify-between border-b border-black/5 shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center text-black/50 hover:bg-black/10 hover:text-black transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-xl font-black text-black">Quote Details</h2>
              <p className="text-xs font-medium text-black/50">#{quote.id.slice(-8)}</p>
            </div>
          </div>

          <div className={cn(
            'px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-1.5',
            getStatusColor(quote.status)
          )}>
            {getStatusIcon(quote.status)}
            {getStatusLabel(quote.status)}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Client & Event */}
          <div className="p-5 bg-black rounded-2xl text-white">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/50 block mb-1">Client</span>
                <h3 className="text-2xl font-black">{quote.clientName || 'Unknown Client'}</h3>
                <p className="text-sm font-medium text-white/60 mt-1">{quote.eventTitle || 'Untitled Event'}</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/50 block mb-1">Total</span>
                <span className="text-3xl font-black text-[#D4FB46]">€{quote.total.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-black/40 ml-2 mb-3 flex items-center gap-2">
              <FileText className="w-3 h-3" /> Line Items ({quote.lineItems.length})
            </h4>
            <div className="bg-white rounded-2xl overflow-hidden divide-y divide-black/5 shadow-sm">
              {quote.lineItems.map((item) => (
                <div key={item.id} className="p-4 flex justify-between items-center">
                  <div>
                    <p className="font-bold text-black">{item.description}</p>
                    <p className="text-xs text-black/50 mt-0.5">{item.quantity} × €{item.unitPrice.toLocaleString()}</p>
                  </div>
                  <span className="text-lg font-black text-black">€{item.total.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Financial Summary */}
          <div className="p-4 bg-[#998878]/10 rounded-2xl space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-black/50 font-medium">Subtotal</span>
              <span className="font-bold text-black">€{quote.subtotal.toLocaleString()}</span>
            </div>
            {quote.discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-black/50 font-medium">Discount</span>
                <span className="font-bold text-red-500">-€{quote.discount.toLocaleString()}</span>
              </div>
            )}
            {quote.tax > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-black/50 font-medium">Tax</span>
                <span className="font-bold text-black">+€{quote.tax.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-black/10">
              <span className="text-lg font-black text-black">Total</span>
              <span className="text-xl font-black text-black">€{quote.total.toLocaleString()}</span>
            </div>
          </div>

          {/* Notes */}
          {quote.notes && (
            <div className="p-4 bg-white rounded-2xl">
              <span className="text-[10px] font-bold uppercase tracking-widest text-black/40 block mb-2">Notes</span>
              <p className="text-sm text-black/70 whitespace-pre-wrap">{quote.notes}</p>
            </div>
          )}

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-3">
            {quote.validUntil && (
              <div className="p-3 bg-black/5 rounded-xl">
                <span className="text-[9px] font-bold uppercase tracking-widest text-black/40 flex items-center gap-1 mb-1">
                  <Calendar className="w-3 h-3" /> Valid Until
                </span>
                <span className="text-sm font-bold text-black">{formatDate(quote.validUntil)}</span>
              </div>
            )}
            {quote.viewedAt && (
              <div className="p-3 bg-black/5 rounded-xl">
                <span className="text-[9px] font-bold uppercase tracking-widest text-black/40 flex items-center gap-1 mb-1">
                  <Eye className="w-3 h-3" /> Viewed
                </span>
                <span className="text-sm font-bold text-black">{formatDate(quote.viewedAt)}</span>
              </div>
            )}
            <div className="p-3 bg-black/5 rounded-xl">
              <span className="text-[9px] font-bold uppercase tracking-widest text-black/40 flex items-center gap-1 mb-1">
                <Clock className="w-3 h-3" /> Created
              </span>
              <span className="text-sm font-bold text-black">{formatDate(quote.createdAt)}</span>
            </div>
            {quote.respondedAt && (
              <div className="p-3 bg-black/5 rounded-xl">
                <span className="text-[9px] font-bold uppercase tracking-widest text-black/40 flex items-center gap-1 mb-1">
                  {quote.status === 'ACCEPTED' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                  Response
                </span>
                <span className="text-sm font-bold text-black">{formatDate(quote.respondedAt)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-black/5 shrink-0 bg-[#E6E5E1]">
          <div className="flex gap-3">
            {canEdit && onEdit && (
              <button
                onClick={() => onEdit(quote)}
                className="flex-1 h-12 rounded-xl bg-black/5 text-black font-bold text-sm uppercase tracking-wide hover:bg-black/10 transition-colors flex items-center justify-center gap-2"
              >
                <Edit3 className="w-4 h-4" /> Edit
              </button>
            )}
            {canSend && onSend && (
              <button
                onClick={() => onSend(quote)}
                className="flex-1 h-12 rounded-xl bg-[#998878] text-white font-bold text-sm uppercase tracking-wide hover:bg-[#887767] transition-colors flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" /> Send
              </button>
            )}
            {canDuplicate && onDuplicate && (
              <button
                onClick={() => onDuplicate(quote)}
                className="h-12 px-4 rounded-xl bg-black/5 text-black font-bold text-sm uppercase tracking-wide hover:bg-black/10 transition-colors flex items-center justify-center gap-2"
              >
                <Copy className="w-4 h-4" />
              </button>
            )}
            {canEdit && onDelete && (
              <button
                onClick={() => onDelete(quote)}
                className="h-12 px-4 rounded-xl bg-red-50 text-red-600 font-bold text-sm uppercase tracking-wide hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
};
