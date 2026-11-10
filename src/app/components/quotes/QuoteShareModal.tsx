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
} from '@/lib/services/pricing';
import {
  generateQuotePdf,
  QuotePdfGenerationResult,
  uploadQuotePdfForSharing,
} from '@/lib/services/quotePdf';
import { parseLocalDate } from '@/lib/dates';
import { IconButton } from '@/app/components/bw/Screen';
import { PillButton, Selector } from '@/app/components/bw/Form';

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
      ? parseLocalDate(quote.eventDate).toLocaleDateString('en-GB', {
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
      subtitle: 'Pre-filled message + PDF link',
      icon: isUploading ? <Loader2 className="animate-spin" /> : <MessageCircle />,
      onClick: handleWhatsAppShare,
      disabled: isGenerating || isUploading || !pdfResult,
    },
    {
      key: 'email',
      title: 'Email client',
      subtitle: 'Formal proposal + PDF download',
      icon: isUploading ? <Loader2 className="animate-spin" /> : <Mail />,
      onClick: handleEmailShare,
      disabled: isGenerating || isUploading || !pdfResult,
    },
    {
      key: 'download',
      title: 'Download PDF',
      subtitle: 'Save to Files',
      icon: <Download />,
      onClick: triggerDownload,
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ type: 'tween', duration: 0.25 }}
      role="dialog"
      aria-modal="true"
      aria-label="Quote PDF ready"
      className="dark fixed inset-0 z-[120] flex flex-col bg-background text-foreground"
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
              <IconButton label="Close" variant="filled" icon={<X />} onClick={onClose} />
            </div>
            <div className="flex items-center gap-2">
              {onOpenBandSettings && (
                <PillButton
                  variant="outline"
                  size="sm"
                  fullWidth={false}
                  icon={<IconSettings className="w-3.5 h-3.5" />}
                  onClick={onOpenBandSettings}
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
              {isGenerating || !pdfResult ? (
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
          {missingBranding && onOpenBandSettings && (
            <button
              type="button"
              onClick={onOpenBandSettings}
              className="w-full flex items-center gap-3 p-4 rounded-[16px] bg-card text-left active:scale-[0.99] transition-transform"
            >
              <AlertCircle className="w-5 h-5 shrink-0 text-warning" />
              <span className="flex-1 min-w-0 flex flex-col gap-1">
                <span className="bw-label-sm text-foreground">Complete your band branding</span>
                <span className="bw-body-sm text-muted-foreground">
                  {!settings.band_logo_url && !settings.bank_iban
                    ? 'Add logo, signature and IBAN in Band settings to include them on the PDF.'
                    : !settings.band_logo_url
                      ? 'Upload your band logo to brand the header of the PDF.'
                      : 'Add your IBAN / payment details to show bank transfer info on the quote.'}
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
            <p role="status" className="self-center inline-flex items-center gap-2 h-9 px-4 rounded-full bg-success text-success-foreground bw-button-sm">
              <Check className="w-4 h-4" />
              {shareFeedback}
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
    </motion.div>
  );
};
