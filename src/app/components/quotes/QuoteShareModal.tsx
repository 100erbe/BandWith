import { createPortal } from 'react-dom';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Capacitor } from '@capacitor/core';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Download,
  Share2,
  Mail,
  MessageCircle,
  Copy,
  Check,
  IconSettings,
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
  hasBankAccount,
} from '@/lib/services/pricing';
import {
  generateQuotePdf,
  QuotePdfGenerationResult,
  uploadQuotePdfForSharing,
} from '@/lib/services/quotePdf';
import { parseLocalDate } from '@/lib/dates';
import { currencySymbol } from '@/lib/currency';
import { isUuid, sendQuote } from '@/lib/services/quotes';
import { shareFile, saveFile, openExternal } from '@/lib/nativeFiles';
import { HeaderAction, IconButton } from '@/app/components/bw/Screen';
import { RailCover } from '@/lib/railActions';
import { PillButton, Selector } from '@/app/components/bw/Form';

export interface QuoteShareModalProps {
  isOpen: boolean;
  quote: Partial<Quote>;
  bandId?: string;
  bandName?: string;
  onClose: () => void;
  onOpenBandSettings?: () => void;
  /** Called after a draft quote is marked as sent (a share channel completed). */
  onSent?: (quoteId: string) => void;
}

export const QuoteShareModal: React.FC<QuoteShareModalProps> = ({
  isOpen,
  quote,
  bandId,
  bandName = 'Band',
  onClose,
  onOpenBandSettings,
  onSent,
}) => {
  const [settings, setSettings] = useState<BandPricingSettings>(DEFAULT_BAND_PRICING);
  const [pdfResult, setPdfResult] = useState<QuotePdfGenerationResult | null>(null);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(true);
  const [generateError, setGenerateError] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);
  const sentRef = useRef(false);

  const sym = currencySymbol(quote.currency || 'EUR');
  const quoteRef = useRef(quote);
  quoteRef.current = quote;
  const quoteKey = useMemo(() => {
    try { return JSON.stringify(quote); } catch { return String(quote.id || ''); }
  }, [quote]);
  const canUpload = isUuid(bandId);

  const flash = (text: string, tone: 'ok' | 'error' = 'ok') => {
    setShareFeedback({ text, tone });
    setTimeout(() => setShareFeedback(null), tone === 'error' ? 5000 : 3000);
  };

  const loadAndGenerate = useCallback(async () => {
    setIsGenerating(true);
    setGenerateError(false);
    try {
      let loadedSettings = DEFAULT_BAND_PRICING;
      if (bandId) {
        loadedSettings = await getBandPricing(bandId);
      }
      setSettings(loadedSettings);
      const generated = await generateQuotePdf(quoteRef.current, bandName, loadedSettings);
      setPdfResult(generated);
      setActivePageIndex(0);
    } catch (err) {
      console.error('[QuoteShareModal] Failed to generate PDF:', err);
      setPdfResult(null);
      setGenerateError(true);
    } finally {
      setIsGenerating(false);
    }
    // Regenerate when the quote's content changes, not on every parent
    // render (callers often pass an inline object).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bandId, bandName, quoteKey]);

  useEffect(() => {
    if (!isOpen) return;
    const onPricingSaved = () => {
      setUploadedUrl(null);
      loadAndGenerate();
    };
    window.addEventListener('bw:band-pricing-saved', onPricingSaved);
    return () => window.removeEventListener('bw:band-pricing-saved', onPricingSaved);
  }, [isOpen, loadAndGenerate]);

  useEffect(() => {
    if (isOpen) {
      setUploadedUrl(null);
      sentRef.current = false;
      loadAndGenerate();
    }
  }, [isOpen, loadAndGenerate]);

  // Upload as soon as the PDF exists, so WhatsApp / copy / email can run
  // synchronously inside the tap (iOS blocks clipboard and popups after an await).
  useEffect(() => {
    if (!isOpen || !pdfResult || !canUpload || uploadedUrl) return;
    let cancelled = false;
    setIsUploading(true);
    uploadQuotePdfForSharing(String(bandId), quote.quoteNumber || 'DRAFT', pdfResult.pdfBlob, pdfResult.fileName)
      .then((url) => { if (!cancelled && url) setUploadedUrl(url); })
      .finally(() => { if (!cancelled) setIsUploading(false); });
    return () => { cancelled = true; };
  }, [isOpen, pdfResult, canUpload, bandId, quote.quoteNumber, uploadedUrl]);

  if (!isOpen) return null;

  /** A draft becomes SENT only once it actually left through a channel. */
  const markSent = async () => {
    if (sentRef.current) return;
    const id = quote.id;
    const status = String(quote.status || '').toUpperCase();
    if (!isUuid(id) || (status && status !== 'DRAFT')) return;
    sentRef.current = true;
    const { error } = await sendQuote(id);
    if (error) {
      sentRef.current = false;
      console.warn('[QuoteShareModal] Could not mark the quote as sent:', error);
      return;
    }
    onSent?.(id);
  };

  const buildShareText = (pdfUrl?: string | null) => {
    const eventLabel = getEventTypeLabel((quote.eventType as any) || 'wedding');
    const eventDateStr = quote.eventDate
      ? parseLocalDate(quote.eventDate).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : 'TBD';
    const total = Math.round(quote.total || 0).toLocaleString();
    const validUntilStr = quote.validUntil
      ? parseLocalDate(quote.validUntil).toLocaleDateString('en-GB', {
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

  const shareTitle = `${bandName} — Quote ${quote.quoteNumber || ''}`.trim();

  /** System share sheet with the PDF attached (Mail, WhatsApp, Files, AirDrop…). */
  const sharePdf = async (opts: { markAsSent: boolean; withText: boolean }) => {
    if (!pdfResult) return;
    try {
      const result = await shareFile(pdfResult.pdfBlob, pdfResult.fileName, {
        title: shareTitle,
        text: opts.withText ? buildShareText(uploadedUrl) : undefined,
      });
      if (result === 'cancelled') return;
      if (result === 'downloaded') flash('PDF downloaded');
      else flash(opts.markAsSent ? 'Quote shared' : 'PDF ready');
      if (opts.markAsSent) void markSent();
    } catch (err) {
      console.error('[QuoteShareModal] Share failed:', err);
      flash('Could not share the PDF. Try again.', 'error');
    }
  };

  const handleNativeShare = () => sharePdf({ markAsSent: true, withText: true });

  /** Download = save the file on the device (Share opens the system sheet). */
  const handleDownload = async () => {
    if (!pdfResult) return;
    try {
      const { result, location } = await saveFile(pdfResult.pdfBlob, pdfResult.fileName);
      if (result === 'saved') flash(`PDF saved to ${location}`);
      else if (result === 'downloaded') flash('PDF downloaded');
      else if (result === 'shared') flash('PDF ready');
    } catch (err) {
      console.error('[QuoteShareModal] Save failed:', err);
      flash('Could not save the PDF. Try Share instead.', 'error');
    }
  };

  const handleWhatsAppShare = () => {
    if (!pdfResult) return;
    if (!uploadedUrl) {
      // No public link: send the file itself, WhatsApp is in the sheet.
      void sharePdf({ markAsSent: true, withText: true });
      return;
    }
    const text = buildShareText(uploadedUrl);
    const cleanPhone = (quote.clientPhone || '').replace(/[^0-9+]/g, '').replace(/^\+/, '');
    const waUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    void openExternal(waUrl);
    void markSent();
  };

  const handleEmailShare = () => {
    if (!pdfResult) return;
    if (!uploadedUrl) {
      // No link to put in the mail: share the PDF as an attachment instead.
      void sharePdf({ markAsSent: true, withText: true });
      return;
    }
    const subject = `${bandName.toUpperCase()} — Event Quote ${quote.quoteNumber || ''} (${quote.eventName || quote.eventTitle || 'Proposal'})`;
    const body = buildShareText(uploadedUrl);
    const mailto = `mailto:${encodeURIComponent(quote.clientEmail || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    void openExternal(mailto);
    void markSent();
  };

  const handleCopySummary = () => {
    const text = buildShareText(uploadedUrl);
    const done = () => {
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2500);
      void markSent();
    };
    try {
      navigator.clipboard.writeText(text).then(done, () => flash('Could not copy. Use Share PDF instead.', 'error'));
    } catch {
      flash('Could not copy. Use Share PDF instead.', 'error');
    }
  };

  const missingBranding = !settings.band_logo_url || !hasBankAccount(settings);

  // Band settings open on top of this sheet (BandPricingModal is portaled
  // above it); saving there re-renders the PDF here with the new branding.
  const openBandSettings = onOpenBandSettings;
  const pageCount = pdfResult?.pageDataUrls.length ?? 0;

  const shareChannels: {
    key: string;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    onClick: () => void;
    disabled: boolean;
  }[] = [
    {
      key: 'native',
      title: 'Share PDF document',
      subtitle: 'Native share sheet',
      icon: <Share2 />,
      onClick: handleNativeShare,
      disabled: isGenerating || !pdfResult,
    },
    {
      key: 'whatsapp',
      title: 'WhatsApp',
      subtitle: uploadedUrl ? 'Pre-filled message + PDF link' : 'Send the PDF file',
      icon: isUploading ? <Loader2 className="animate-spin" /> : <MessageCircle />,
      onClick: handleWhatsAppShare,
      disabled: isGenerating || isUploading || !pdfResult,
    },
    {
      key: 'email',
      title: 'Email client',
      subtitle: uploadedUrl ? 'Formal proposal + PDF link' : 'PDF as attachment',
      icon: isUploading ? <Loader2 className="animate-spin" /> : <Mail />,
      onClick: handleEmailShare,
      disabled: isGenerating || isUploading || !pdfResult,
    },
    {
      key: 'download',
      title: 'Download PDF',
      subtitle: Capacitor.isNativePlatform() ? 'Save a copy on this device' : 'Save to your computer',
      icon: <Download />,
      onClick: handleDownload,
      disabled: isGenerating || !pdfResult,
    },
    {
      key: 'copy',
      title: copiedSummary ? 'Copied!' : 'Copy text & link',
      subtitle: 'Paste anywhere',
      icon: copiedSummary ? <Check className="text-success" /> : <Copy />,
      onClick: handleCopySummary,
      disabled: isGenerating || isUploading || !pdfResult,
    },
  ];

  // Portaled to <body>: some callers render it inside a scrolling pane, where
  // WKWebView clips fixed children (the Done bar could end up untappable).
  return createPortal(
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ type: 'tween', duration: 0.25 }}
      role="dialog"
      aria-modal="true"
      aria-label="Quote PDF ready"
      className="bw-pane-detail dark fixed inset-0 z-[120] flex flex-col bg-background text-foreground"
    >
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <div
          className="max-w-xl mx-auto w-full px-4 flex flex-col gap-4"
          style={{ paddingTop: 'calc(var(--safe-top) + 16px)', paddingBottom: 24 }}
        >
          {/* Header: kicker + close, then branding / regenerate */}
          <header className="flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <p className="bw-label-sm text-muted-foreground truncate">
                  {quote.quoteNumber || 'Draft'} · Official quote
                </p>
                <h1 className="bw-display-lg">PDF ready</h1>
              </div>
              <RailCover pane />
              <HeaderAction pane label="Close" variant="filled" railProminent={false} icon={<X />} onClick={onClose} />
            </div>
            <div className="flex items-center gap-2">
              {openBandSettings && (
                <PillButton
                  variant="outline"
                  size="sm"
                  fullWidth={false}
                  icon={<IconSettings className="w-3.5 h-3.5" />}
                  onClick={openBandSettings}
                  title="Configure band logo, signature & payment details"
                >
                  Branding & payment
                </PillButton>
              )}
              <IconButton
                label="Regenerate PDF preview"
                size="sm"
                icon={<RefreshCw className={isGenerating ? 'animate-spin' : undefined} />}
                onClick={loadAndGenerate}
                disabled={isGenerating}
              />
            </div>
          </header>

          {/* A4 preview */}
          <section className="bg-card rounded-[24px] p-4 flex flex-col items-center gap-3">
            {pageCount > 1 && pdfResult && (
              <div className="w-full flex items-center gap-2">
                <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
                  {pdfResult.pageDataUrls.map((_, idx) => {
                    const isSummaryPage = idx === pageCount - 1 && pageCount > 1 && quote.includeProposalSummary;
                    return (
                      <Selector key={idx} selected={activePageIndex === idx} onClick={() => setActivePageIndex(idx)}>
                        {isSummaryPage ? `Page ${idx + 1} · Summary` : `Page ${idx + 1}`}
                      </Selector>
                    );
                  })}
                </div>
                <IconButton
                  label="Previous page"
                  size="sm"
                  variant="ghost"
                  icon={<ChevronLeft />}
                  onClick={() => setActivePageIndex((p) => Math.max(0, p - 1))}
                  disabled={activePageIndex === 0}
                />
                <IconButton
                  label="Next page"
                  size="sm"
                  variant="ghost"
                  icon={<ChevronRight />}
                  onClick={() => setActivePageIndex((p) => Math.min(pageCount - 1, p + 1))}
                  disabled={activePageIndex === pageCount - 1}
                />
              </div>
            )}

            <div className="relative w-full flex items-center justify-center overflow-hidden">
              {generateError && !isGenerating ? (
                <div className="w-full max-w-[260px] aspect-[1/1.414] bg-card rounded-[16px] flex flex-col items-center justify-center gap-3 p-6 text-center">
                  <AlertCircle className="w-7 h-7 text-destructive" />
                  <p className="bw-body-sm">The PDF could not be created.</p>
                  <PillButton variant="outline" size="sm" fullWidth={false} icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={loadAndGenerate}>
                    Try again
                  </PillButton>
                </div>
              ) : isGenerating || !pdfResult ? (
                <div className="w-full max-w-[260px] aspect-[1/1.414] bg-white text-black rounded-[16px] flex flex-col items-center justify-center gap-3 p-6">
                  <Loader2 className="w-7 h-7 animate-spin" />
                  <p className="bw-label-xs text-black/60 text-center">Rendering A4 PDF…</p>
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
                    alt={`Quote PDF page ${activePageIndex + 1}`}
                    className="max-h-[52vh] w-auto max-w-full object-contain rounded-[16px] bg-white"
                  />
                </AnimatePresence>
              )}
            </div>

            <p className="bw-label-xs text-muted-foreground text-center">
              {pdfResult
                ? `A4 portrait · Page ${activePageIndex + 1} of ${pageCount} · ${(pdfResult.pdfBlob.size / 1024).toFixed(0)} KB`
                : 'A4 portrait · Preparing…'}
            </p>
          </section>

          {/* Missing branding tip */}
          {missingBranding && openBandSettings && (
            <button
              type="button"
              onClick={openBandSettings}
              className="w-full flex items-center gap-3 p-4 rounded-[16px] bg-card text-left active:scale-[0.99] transition-transform"
            >
              <AlertCircle className="w-5 h-5 shrink-0 text-warning" />
              <span className="flex-1 min-w-0 flex flex-col gap-1">
                <span className="bw-label-sm text-foreground">Complete your band branding</span>
                <span className="bw-body-sm text-muted-foreground">
                  {!settings.band_logo_url
                    ? 'Add logo and signature to the PDF'
                    : 'Add your bank account to show transfer details on the quote.'}
                </span>
              </span>
              <ChevronRight className="w-5 h-5 shrink-0" aria-hidden />
            </button>
          )}

          {/* Share channels */}
          <section className="flex flex-col gap-2">
            <h2 className="bw-label-sm text-muted-foreground pt-2">Share quote via</h2>
            {shareChannels.map((ch) => (
              <button
                key={ch.key}
                type="button"
                onClick={ch.onClick}
                disabled={ch.disabled}
                className="w-full flex items-center gap-3 p-4 rounded-[16px] bg-sheet text-sheet-foreground text-left active:scale-[0.99] transition-transform disabled:opacity-40"
              >
                <span className="w-10 h-10 rounded-full bg-foreground/[0.08] flex items-center justify-center shrink-0 [&_svg]:w-5 [&_svg]:h-5">
                  {ch.icon}
                </span>
                <span className="flex-1 min-w-0 flex flex-col gap-1">
                  <span className="bw-body-lg truncate">{ch.title}</span>
                  <span className="bw-body-sm text-muted-foreground truncate">{ch.subtitle}</span>
                </span>
                <ChevronRight className="w-5 h-5 shrink-0" aria-hidden />
              </button>
            ))}
          </section>

          {shareFeedback && (
            <p
              role="status"
              className={`self-center inline-flex items-center gap-2 min-h-9 px-4 py-2 rounded-full bw-button-sm ${
                shareFeedback.tone === 'ok' ? 'bg-success text-success-foreground' : 'bg-destructive-solid text-white'
              }`}
            >
              {shareFeedback.tone === 'ok' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {shareFeedback.text}
            </p>
          )}
        </div>
      </div>

      {/* Done */}
      <div className="shrink-0 px-4 pt-3" style={{ paddingBottom: 'calc(var(--safe-bottom) + 16px)' }}>
        <div className="max-w-xl mx-auto w-full">
          <PillButton icon={<Check className="w-[18px] h-[18px]" />} onClick={onClose}>
            Done
          </PillButton>
        </div>
      </div>
    </motion.div>,
    document.body,
  );
};
