import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Download,
  Share2,
  Mail,
  MessageCircle,
  Copy,
  Check,
  FileText,
  Settings,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  RefreshCw,
} from '@/app/components/icons';
import { Quote, getEventTypeLabel } from '@/app/data/quotes';
import {
  BandPricingSettings,
  DEFAULT_BAND_PRICING,
  getBandPricing,
} from '@/lib/services/pricing';
import {
  generateQuotePdf,
  QuotePdfGenerationResult,
  uploadQuotePdfForSharing,
} from '@/lib/services/quotePdf';

export interface QuoteShareModalProps {
  isOpen: boolean;
  quote: Partial<Quote>;
  bandId?: string;
  bandName?: string;
  onClose: () => void;
  onOpenBandSettings?: () => void;
}

export const QuoteShareModal: React.FC<QuoteShareModalProps> = ({
  isOpen,
  quote,
  bandId,
  bandName = 'Band',
  onClose,
  onOpenBandSettings,
}) => {
  const [settings, setSettings] = useState<BandPricingSettings>(DEFAULT_BAND_PRICING);
  const [pdfResult, setPdfResult] = useState<QuotePdfGenerationResult | null>(null);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const sym =
    quote.currency === 'USD'
      ? '$'
      : quote.currency === 'GBP'
        ? '£'
        : quote.currency === 'CHF'
          ? 'CHF '
          : '€';

  const loadAndGenerate = useCallback(async () => {
    setIsGenerating(true);
    try {
      let loadedSettings = DEFAULT_BAND_PRICING;
      if (bandId) {
        loadedSettings = await getBandPricing(bandId);
      }
      setSettings(loadedSettings);
      const generated = await generateQuotePdf(quote, bandName, loadedSettings);
      setPdfResult(generated);
      setActivePageIndex(0);
    } catch (err) {
      console.error('[QuoteShareModal] Failed to generate PDF:', err);
    } finally {
      setIsGenerating(false);
    }
  }, [bandId, bandName, quote]);

  useEffect(() => {
    if (isOpen) {
      setUploadedUrl(null);
      loadAndGenerate();
    }
  }, [isOpen, loadAndGenerate]);

  if (!isOpen) return null;

  const ensurePublicPdfUrl = async (): Promise<string | null> => {
    if (uploadedUrl) return uploadedUrl;
    if (!pdfResult || !bandId) return null;
    setIsUploading(true);
    try {
      const url = await uploadQuotePdfForSharing(
        bandId,
        quote.quoteNumber || 'DRAFT',
        pdfResult.pdfBlob,
        pdfResult.fileName
      );
      if (url) setUploadedUrl(url);
      return url;
    } finally {
      setIsUploading(false);
    }
  };

  const triggerDownload = () => {
    if (!pdfResult) return;
    const url = URL.createObjectURL(pdfResult.pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = pdfResult.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    setShareFeedback('PDF downloaded');
    setTimeout(() => setShareFeedback(null), 3000);
  };

  const buildShareText = (pdfUrl?: string | null) => {
    const eventLabel = getEventTypeLabel((quote.eventType as any) || 'wedding');
    const eventDateStr = quote.eventDate
      ? new Date(quote.eventDate).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : 'TBD';
    const total = Math.round(quote.total || 0).toLocaleString();
    const validUntilStr = quote.validUntil
      ? new Date(quote.validUntil).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : `${quote.validityDays || settings.default_validity_days || 30} days`;

    const venueLocation = [
      quote.venueName || (quote as any).venue,
      quote.venueCity || (quote as any).city,
    ]
      .filter(Boolean)
      .join(', ');

    const lines = [
      `Hi ${quote.clientName || 'there'},`,
      ``,
      `Here is the official event proposal from ${bandName.toUpperCase()} for "${quote.eventName || quote.eventTitle || eventLabel}":`,
      `• Quote Ref: ${quote.quoteNumber || 'EVT-QUOTE'}`,
      `• Event Date: ${eventDateStr}`,
      `• Location: ${venueLocation || 'TBD'}`,
      `• Lineup: ${quote.musicianCount || (quote.musicians || []).length || 1} Musicians`,
      `• Total Proposal: ${sym}${total}${quote.vatExempt ? ' (VAT Exempt)' : ` (incl. ${quote.vatRate ?? settings.default_vat_rate ?? 22}% VAT)`}`,
      quote.depositRequired !== false && (quote.depositAmount || 0) > 0
        ? `• Booking Deposit (${quote.depositPercentage || settings.default_deposit_rate || 20}%): ${sym}${Math.round(quote.depositAmount || 0).toLocaleString()}`
        : null,
      `• Valid Until: ${validUntilStr}`,
      pdfUrl ? `\n📄 View / Download Full PDF Quote:\n${pdfUrl}` : null,
      ``,
      `Please let us know if you have any questions or would like to tailor the package!`,
      `Best regards,`,
      settings.signer_name || bandName,
    ].filter((line): line is string => line !== null);

    return lines.join('\n');
  };

  const handleNativeShare = async () => {
    if (!pdfResult) return;
    try {
      const nav = navigator as any;
      if (
        nav.share &&
        nav.canShare &&
        nav.canShare({ files: [pdfResult.pdfFile] })
      ) {
        await nav.share({
          title: `${bandName} — Quote ${quote.quoteNumber || ''}`,
          text: buildShareText(uploadedUrl),
          files: [pdfResult.pdfFile],
        });
        setShareFeedback('Quote shared successfully');
        setTimeout(() => setShareFeedback(null), 3000);
        return;
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      console.warn('[QuoteShareModal] Native share fallback:', err);
    }
    triggerDownload();
  };

  const handleWhatsAppShare = async () => {
    if (!pdfResult) return;
    const publicUrl = await ensurePublicPdfUrl();
    if (!publicUrl) {
      triggerDownload();
    }
    const text = buildShareText(publicUrl);
    const cleanPhone = (quote.clientPhone || '').replace(/[^0-9+]/g, '').replace(/^\+/, '');
    const waUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const handleEmailShare = async () => {
    if (!pdfResult) return;
    const publicUrl = await ensurePublicPdfUrl();
    triggerDownload();

    const subject = `${bandName.toUpperCase()} — Event Quote ${quote.quoteNumber || ''} (${quote.eventName || quote.eventTitle || 'Proposal'})`;
    const body = buildShareText(publicUrl);
    const mailto = `mailto:${encodeURIComponent(quote.clientEmail || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  };

  const handleCopySummary = async () => {
    const publicUrl = await ensurePublicPdfUrl();
    const text = buildShareText(publicUrl);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2500);
    } catch (err) {
      console.error('Failed to copy quote summary:', err);
    }
  };

  const missingBranding = !settings.band_logo_url || !settings.bank_iban;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-3 sm:p-6 overflow-hidden"
    >
      <motion.div
        initial={{ scale: 0.96, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 16 }}
        className="w-full max-w-5xl bg-[#F7F7F5] rounded-[2rem] shadow-2xl border border-black/10 flex flex-col max-h-[94vh] overflow-hidden"
      >
        {/* Top Bar */}
        <div className="px-5 sm:px-8 py-4 sm:py-5 bg-white border-b border-black/5 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#D5FB46] flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-black" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-black/40">
                  OFFICIAL QUOTE PDF READY
                </span>
                <span className="px-2 py-0.5 rounded-full bg-black text-white text-[10px] font-bold">
                  {quote.quoteNumber || 'DRAFT'}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight text-black truncate">
                {quote.eventName || quote.eventTitle || quote.clientName || 'Event Proposal'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onOpenBandSettings && (
              <button
                onClick={onOpenBandSettings}
                className="px-3.5 py-2 rounded-full bg-[#F2F2F0] hover:bg-black hover:text-white text-black text-[11px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5"
                title="Configure Band Logo, Signature & Payment Details"
              >
                <Settings className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Branding & Payment</span>
              </button>
            )}
            <button
              onClick={loadAndGenerate}
              disabled={isGenerating}
              className="w-9 h-9 rounded-full bg-[#F2F2F0] hover:bg-black/10 flex items-center justify-center text-black transition-colors"
              title="Regenerate PDF Preview"
            >
              <RefreshCw
                className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`}
              />
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-[#F2F2F0] hover:bg-black hover:text-white flex items-center justify-center text-black transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body: Left A4 Preview + Right Sharing Controls */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 min-h-0">
          {/* Left Column: High-DPI A4 Document Preview */}
          <div className="lg:col-span-7 bg-[#E6E5E1] p-4 sm:p-6 flex flex-col items-center justify-between border-b lg:border-b-0 lg:border-r border-black/10 min-h-[380px]">
            {/* Page Switcher Header */}
            <div className="w-full flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 flex-wrap">
                {pdfResult &&
                  pdfResult.pageDataUrls.map((_, idx) => {
                    const isSummaryPage =
                      idx === pdfResult.pageDataUrls.length - 1 &&
                      pdfResult.pageDataUrls.length > 1 &&
                      quote.includeProposalSummary;
                    return (
                      <button
                        key={idx}
                        onClick={() => setActivePageIndex(idx)}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all ${
                          activePageIndex === idx
                            ? 'bg-black text-white shadow-sm'
                            : 'bg-white/70 text-black/60 hover:bg-white'
                        }`}
                      >
                        {isSummaryPage
                          ? `Page ${idx + 1} · Summary`
                          : `Page ${idx + 1}`}
                      </button>
                    );
                  })}
              </div>

              {pdfResult && pdfResult.pageDataUrls.length > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() =>
                      setActivePageIndex((p) => Math.max(0, p - 1))
                    }
                    disabled={activePageIndex === 0}
                    className="w-7 h-7 rounded-full bg-white/80 disabled:opacity-40 flex items-center justify-center text-black"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() =>
                      setActivePageIndex((p) =>
                        Math.min(pdfResult.pageDataUrls.length - 1, p + 1)
                      )
                    }
                    disabled={
                      activePageIndex === pdfResult.pageDataUrls.length - 1
                    }
                    className="w-7 h-7 rounded-full bg-white/80 disabled:opacity-40 flex items-center justify-center text-black"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* A4 Sheet Container */}
            <div className="relative w-full flex-1 flex items-center justify-center overflow-hidden my-1">
              {isGenerating || !pdfResult ? (
                <div className="w-full max-w-[420px] aspect-[1/1.414] bg-white rounded-xl shadow-lg flex flex-col items-center justify-center gap-3 p-8">
                  <Loader2 className="w-8 h-8 text-black animate-spin" />
                  <p className="text-xs font-bold uppercase tracking-widest text-black/50">
                    Rendering High-Resolution A4 PDF...
                  </p>
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  <motion.img
                    key={activePageIndex}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.18 }}
                    src={pdfResult.pageDataUrls[activePageIndex]}
                    alt={`Quote PDF Page ${activePageIndex + 1}`}
                    className="max-h-[58vh] w-auto max-w-full object-contain rounded-lg shadow-2xl border border-black/10 bg-white"
                  />
                </AnimatePresence>
              )}
            </div>

            <div className="w-full flex items-center justify-between text-[11px] font-bold text-black/50 mt-3 pt-2 border-t border-black/10">
              <span>Format: A4 Portrait (210 × 297 mm)</span>
              <span>
                {pdfResult
                  ? `${pdfResult.pageDataUrls.length} ${
                      pdfResult.pageDataUrls.length === 1 ? 'Page' : 'Pages'
                    } · ${(pdfResult.pdfBlob.size / 1024).toFixed(0)} KB`
                  : 'Preparing...'}
              </span>
            </div>
          </div>

          {/* Right Column: Share Channels & Actions */}
          <div className="lg:col-span-5 p-5 sm:p-7 flex flex-col justify-between gap-6 bg-[#F7F7F5]">
            <div className="flex flex-col gap-5">
              {/* Missing Branding Tip */}
              {missingBranding && onOpenBandSettings && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-black uppercase tracking-wider text-amber-900">
                      Complete Your Band Branding
                    </div>
                    <p className="text-xs text-amber-800/80 mt-0.5 leading-relaxed">
                      {!settings.band_logo_url && !settings.bank_iban
                        ? 'Upload your Band Logo, Signature, and IBAN/Bank details in Band Settings to include them automatically on your PDF.'
                        : !settings.band_logo_url
                          ? 'Upload your Band Logo in Band Settings to brand the header of your quote PDF.'
                          : 'Add your IBAN / Payment Details in Band Settings to display bank transfer info on the quote.'}
                    </p>
                    <button
                      onClick={onOpenBandSettings}
                      className="mt-2.5 px-3 py-1.5 rounded-lg bg-amber-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-black transition-colors"
                    >
                      Open Band Settings
                    </button>
                  </div>
                </div>
              )}

              {/* Quote Quick Recap Card */}
              <div className="bg-white rounded-2xl p-4 border border-black/5 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-black/40">
                    CLIENT RECIPIENT
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                    Valid {quote.validityDays || settings.default_validity_days || 30} Days
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <div>
                    <div className="text-base font-black text-black">
                      {quote.clientName || 'Client'}
                    </div>
                    {quote.clientCompany && (
                      <div className="text-xs font-bold text-black/50">
                        {quote.clientCompany}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-black text-black">
                      {sym}
                      {Math.round(quote.total || 0).toLocaleString()}
                    </div>
                    <div className="text-[10px] font-bold uppercase text-black/40">
                      {quote.vatExempt
                        ? 'VAT Exempt'
                        : `Incl. ${quote.vatRate ?? settings.default_vat_rate ?? 22}% VAT`}
                    </div>
                  </div>
                </div>
                {(quote.clientEmail || quote.clientPhone) && (
                  <div className="pt-2 border-t border-black/5 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-black/60">
                    {quote.clientEmail && <span>✉️ {quote.clientEmail}</span>}
                    {quote.clientPhone && <span>📱 {quote.clientPhone}</span>}
                  </div>
                )}
              </div>

              {/* Primary Share Actions */}
              <div className="flex flex-col gap-2.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-black/40">
                  SHARE QUOTE VIA
                </span>

                {/* Native OS Share / Attach PDF */}
                <button
                  onClick={handleNativeShare}
                  disabled={isGenerating || !pdfResult}
                  className="w-full py-4 px-5 rounded-2xl bg-black text-white hover:bg-black/90 disabled:opacity-40 transition-all flex items-center justify-between group shadow-lg shadow-black/10"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-[#D5FB46] text-black flex items-center justify-center shrink-0">
                      <Share2 className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-black uppercase tracking-wider">
                        Share PDF Document
                      </div>
                      <div className="text-[11px] text-white/60 font-medium">
                        Send PDF file directly via WhatsApp, Mail, AirDrop...
                      </div>
                    </div>
                  </div>
                  <Sparkles className="w-4 h-4 text-[#D5FB46] shrink-0" />
                </button>

                {/* WhatsApp & Email Row */}
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={handleWhatsAppShare}
                    disabled={isGenerating || isUploading || !pdfResult}
                    className="p-4 rounded-2xl bg-[#25D366]/15 hover:bg-[#25D366]/25 border border-[#25D366]/30 text-black transition-all flex flex-col gap-2 text-left"
                  >
                    <div className="w-9 h-9 rounded-xl bg-[#25D366] text-white flex items-center justify-center">
                      {isUploading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <MessageCircle className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-black uppercase tracking-wider">
                        WhatsApp
                      </div>
                      <div className="text-[10px] font-bold text-black/50 mt-0.5">
                        Pre-filled message + PDF link
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={handleEmailShare}
                    disabled={isGenerating || isUploading || !pdfResult}
                    className="p-4 rounded-2xl bg-white hover:bg-black/5 border border-black/10 text-black transition-all flex flex-col gap-2 text-left"
                  >
                    <div className="w-9 h-9 rounded-xl bg-black text-white flex items-center justify-center">
                      {isUploading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Mail className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-black uppercase tracking-wider">
                        Email Client
                      </div>
                      <div className="text-[10px] font-bold text-black/50 mt-0.5">
                        Formal proposal + PDF download
                      </div>
                    </div>
                  </button>
                </div>

                {/* Download PDF & Copy Summary Row */}
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={triggerDownload}
                    disabled={isGenerating || !pdfResult}
                    className="py-3.5 px-4 rounded-xl bg-white hover:bg-black hover:text-white border border-black/10 text-black text-xs font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download PDF
                  </button>

                  <button
                    onClick={handleCopySummary}
                    disabled={isGenerating || isUploading || !pdfResult}
                    className="py-3.5 px-4 rounded-xl bg-white hover:bg-black hover:text-white border border-black/10 text-black text-xs font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
                  >
                    {copiedSummary ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-500" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy Text & Link
                      </>
                    )}
                  </button>
                </div>
              </div>

              {shareFeedback && (
                <div className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold text-center">
                  {shareFeedback}
                </div>
              )}
            </div>

            {/* Done Button */}
            <div className="pt-3 border-t border-black/10 flex items-center justify-between">
              <span className="text-[11px] font-bold text-black/40">
                Ready to send to {quote.clientName || 'client'}
              </span>
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-full bg-black/10 hover:bg-black hover:text-white text-black text-xs font-black uppercase tracking-widest transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
