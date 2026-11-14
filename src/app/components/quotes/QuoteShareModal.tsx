import { createPortal } from 'react-dom';
import { useSystemBack } from '@/lib/backStack';
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
  Smartphone,
  Link,
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
import { OnlineDepositLinks } from '@/app/components/quotes/OnlineDeposit';
import { useT, translate, intlLocale, type Locale } from '@/lib/i18n';
import { docLanguageFor, rememberDocLanguage } from '@/lib/i18n/docLanguage';
import { DocLanguagePicker } from '@/app/components/bw/DocLanguagePicker';
import {
  buildClientQuoteSnapshot,
  clientLinkMessage,
  getQuoteLinkState,
  markQuoteLinkSent,
  publishQuoteLink,
  quoteLinkUrl,
  rotateQuoteLink,
  sendQuoteEmail,
  type QuoteChannel,
  type QuoteLinkStatus,
  type QuoteMessageKind,
} from '@/lib/services/quoteLinks';

export interface QuoteShareModalProps {
  isOpen: boolean;
  quote: Partial<Quote>;
  bandId?: string;
  bandName?: string;
  onClose: () => void;
  onOpenBandSettings?: () => void;
  /** Called after a draft quote is marked as sent (a share channel completed). */
  onSent?: (quoteId: string) => void;
  /**
   * What the message with the client's link says (migration 099): the
   * first send, a reminder, or "the quote was updated".
   */
  kind?: QuoteMessageKind;
  /** The client's link changed (sent, reminded, new link). */
  onLinkChanged?: () => void;
  /**
   * "Send quote" in the iPad composer (Figma iPad · 06 "Quote / New"): email
   * the client's link once, as soon as the link and the PDF are ready. Without
   * the client's email it says so and the other channels stay available.
   */
  autoSendEmail?: boolean;
}

const isIOS = () =>
  Capacitor.getPlatform() === 'ios' || (typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent));

export const QuoteShareModal: React.FC<QuoteShareModalProps> = ({
  isOpen,
  quote,
  bandId,
  bandName = 'Band',
  onClose,
  onOpenBandSettings,
  onSent,
  kind = 'sent',
  onLinkChanged,
  autoSendEmail = false,
}) => {
  const t = useT();
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
  // Language of the PDF and of the message the client receives.
  const clientKey = quote.clientEmail || quote.clientName;
  const [docLang, setDocLang] = useState<Locale>(() => docLanguageFor(clientKey));
  const tr = (source: string, vars?: Record<string, string | number>) => translate(docLang, source, vars);

  const sym = currencySymbol(quote.currency || 'EUR');
  const quoteRef = useRef(quote);
  quoteRef.current = quote;
  const quoteKey = useMemo(() => {
    try { return JSON.stringify(quote); } catch { return String(quote.id || ''); }
  }, [quote]);
  const canUpload = isUuid(bandId);
  // The client's confirmation link: only for a saved quote of a real band.
  const canLink = canUpload && isUuid(quote.id);
  const [link, setLink] = useState<{ token: string; status: QuoteLinkStatus; revoked: boolean } | null>(null);
  const [linkError, setLinkError] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // "Send quote": what happened, kept at the top of the sheet (the flash
  // below the channels is easy to miss when nobody tapped anything).
  const [autoNote, setAutoNote] = useState<{ text: string; tone: 'ok' | 'error' | 'busy' } | null>(null);
  const autoPendingRef = useRef(false);
  const flash = (text: string, tone: 'ok' | 'error' = 'ok') => {
    if (autoPendingRef.current) {
      autoPendingRef.current = false;
      setAutoNote({ text, tone });
    }
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
      const generated = await generateQuotePdf(quoteRef.current, bandName, loadedSettings, docLang);
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
  }, [bandId, bandName, quoteKey, docLang]);

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
      setDocLang(docLanguageFor(clientKey));
      sentRef.current = false;
      loadAndGenerate();
    }
  }, [isOpen, loadAndGenerate]);

  // The link's token, so every channel can open synchronously inside the tap.
  // A quote without a link gets one now (still a draft: nothing is sent).
  useEffect(() => {
    if (!isOpen || !canLink) return;
    let cancelled = false;
    setLinkError(false);
    (async () => {
      const { data, error } = await getQuoteLinkState(String(quote.id));
      if (cancelled) return;
      if (error) {
        setLinkError(true);
        return;
      }
      if (data?.link) {
        setLink({ token: data.link.token, status: data.link.status, revoked: !!data.link.revoked_at });
        // The page and the emails speak the language the client already got.
        if (data.link.status !== 'draft') setDocLang(data.link.lang);
        return;
      }
      const lang = docLanguageFor(clientKey);
      const created = await publishQuoteLink(String(quote.id), buildClientQuoteSnapshot(quoteRef.current, lang, DEFAULT_BAND_PRICING), lang);
      if (cancelled) return;
      if (created.data) setLink({ token: created.data.token, status: created.data.status, revoked: created.data.revoked });
      else setLinkError(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, canLink, quote.id]);

  // The PDF upload finished (with or without a link): "Send quote" can go.
  const uploadTriedRef = useRef(false);
  // Upload as soon as the PDF exists, so WhatsApp / copy / email can run
  // synchronously inside the tap (iOS blocks clipboard and popups after an await).
  useEffect(() => {
    if (!isOpen || !pdfResult || !canUpload || uploadedUrl) return;
    let cancelled = false;
    setIsUploading(true);
    uploadQuotePdfForSharing(String(bandId), quote.quoteNumber || 'DRAFT', pdfResult.pdfBlob, pdfResult.fileName)
      .then((url) => { if (!cancelled && url) setUploadedUrl(url); })
      .finally(() => {
        uploadTriedRef.current = true;
        if (!cancelled) setIsUploading(false);
      });
    return () => { cancelled = true; };
  }, [isOpen, pdfResult, canUpload, bandId, quote.quoteNumber, uploadedUrl]);

  // "Send quote": one email to the client once everything is ready.
  const emailLinkRef = useRef<(() => Promise<void>) | null>(null);
  const autoSentRef = useRef(false);
  useEffect(() => {
    if (isOpen) return;
    autoSentRef.current = false;
    uploadTriedRef.current = false;
    autoPendingRef.current = false;
    setAutoNote(null);
  }, [isOpen]);
  const autoSendReady =
    isOpen && autoSendEmail && !!link && !link.revoked && !isGenerating && !!pdfResult && !isUploading && (!canUpload || !!uploadedUrl || uploadTriedRef.current);
  useEffect(() => {
    if (!autoSendReady || autoSentRef.current) return;
    autoSentRef.current = true;
    autoPendingRef.current = true;
    if (quote.clientEmail) setAutoNote({ text: t('Sending the quote to {email}…', { email: quote.clientEmail }), tone: 'busy' });
    void emailLinkRef.current?.().finally(() => {
      // Nothing was flashed (e.g. the link went away): don't leave "Sending…".
      if (autoPendingRef.current) {
        autoPendingRef.current = false;
        setAutoNote(null);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSendReady]);

  useSystemBack(isOpen, onClose);

  if (!isOpen) return null;

  /** Publish what the client sees now (summary, language, PDF), then record the send. */
  const publishAndRecord = async (channel: QuoteChannel) => {
    const id = String(quote.id);
    const snapshot = buildClientQuoteSnapshot(quoteRef.current, docLang, settings);
    const pub = await publishQuoteLink(id, snapshot, docLang, uploadedUrl);
    if (pub.error || !pub.data) {
      flash(t('The client page could not be updated. Try again.'), 'error');
      return false;
    }
    const sent = await markQuoteLinkSent(id, kind === 'reminder' ? 'reminded' : 'sent', channel);
    if (sent.error) {
      flash(t('The client page could not be updated. Try again.'), 'error');
      return false;
    }
    setLink((l) => (l ? { ...l, status: sent.data || l.status } : l));
    if (String(quote.status || '').toUpperCase() === 'DRAFT' || !quote.status) onSent?.(id);
    onLinkChanged?.();
    return true;
  };

  const linkMessage = () => {
    if (!link) return '';
    const snapshot = buildClientQuoteSnapshot(quoteRef.current, docLang, settings);
    return clientLinkMessage(quoteRef.current, {
      bandName,
      url: quoteLinkUrl(link.token),
      lang: docLang,
      kind,
      total: snapshot.totalLabel,
      signer: settings.signer_name,
    });
  };

  const cleanPhone = () => (quote.clientPhone || '').replace(/[^0-9+]/g, '');

  const sendLinkVia = (channel: 'whatsapp' | 'sms' | 'copy') => {
    if (!link || link.revoked) return;
    const text = linkMessage();
    if (channel === 'copy') {
      try {
        navigator.clipboard.writeText(text).then(
          () => {
            setCopiedLink(true);
            setTimeout(() => setCopiedLink(false), 2500);
            void publishAndRecord('copy');
          },
          () => flash(t('Could not copy the link.'), 'error'),
        );
      } catch {
        flash(t('Could not copy the link.'), 'error');
      }
      return;
    }
    const phone = cleanPhone();
    const url =
      channel === 'whatsapp'
        ? `https://wa.me/${phone.replace(/^\+/, '')}?text=${encodeURIComponent(text)}`
        : `sms:${phone}${isIOS() ? '&' : '?'}body=${encodeURIComponent(text)}`;
    void openExternal(url);
    void publishAndRecord(channel).then((ok) => ok && flash(kind === 'reminder' ? t('Reminder sent') : t('Quote shared')));
  };

  const emailLink = async () => {
    if (!link || link.revoked || emailing) return;
    if (!quote.clientEmail) {
      flash(t('Add the client’s email to the quote first.'), 'error');
      return;
    }
    setEmailing(true);
    try {
      const id = String(quote.id);
      const pub = await publishQuoteLink(id, buildClientQuoteSnapshot(quoteRef.current, docLang, settings), docLang, uploadedUrl);
      if (pub.error) {
        flash(t('The client page could not be updated. Try again.'), 'error');
        return;
      }
      const res = await sendQuoteEmail(id, kind);
      if (!res.ok && res.code === 'too_soon') {
        flash(t('An email was just sent. Wait a minute and try again.'), 'error');
        return;
      }
      if (!res.ok) {
        // The server could not send it (no mail server yet, or offline): hand
        // the same message to the mail app instead.
        const subject = tr('{band} — Quote {ref}', { band: bandName, ref: quote.quoteNumber || '' }).trim();
        void openExternal(`mailto:${encodeURIComponent(quote.clientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(linkMessage())}`);
      }
      if (await publishAndRecord('email')) {
        flash(res.ok ? t('Email sent to {email}', { email: quote.clientEmail }) : t('Your mail app opened with the message and the link.'));
      }
    } finally {
      setEmailing(false);
    }
  };

  emailLinkRef.current = emailLink;

  const newLink = async () => {
    if (!isUuid(quote.id)) return;
    const { data, error } = await rotateQuoteLink(quote.id);
    if (error || !data) {
      flash(t('Could not create a new link. Try again.'), 'error');
      return;
    }
    setLink((l) => (l ? { ...l, token: data, revoked: false } : l));
    onLinkChanged?.();
    flash(t('New link ready. The old one no longer works.'));
  };

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

  const changeDocLang = (l: Locale) => {
    if (l === docLang) return;
    rememberDocLanguage(clientKey, l);
    // Drop the old PDF and link so nothing in the previous language gets uploaded or shared.
    setPdfResult(null);
    setUploadedUrl(null);
    setDocLang(l);
  };

  const buildShareText = (pdfUrl?: string | null) => {
    const eventLabel = tr(getEventTypeLabel((quote.eventType as any) || 'wedding'));
    const eventDateStr = quote.eventDate
      ? parseLocalDate(quote.eventDate).toLocaleDateString(intlLocale('en-GB', docLang), {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : tr('TBD', { context: 'doc' });
    const total = Math.round(quote.total || 0).toLocaleString(intlLocale(undefined, docLang));
    const validUntilStr = quote.validUntil
      ? parseLocalDate(quote.validUntil).toLocaleDateString(intlLocale('en-GB', docLang), {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : tr('{days} days', { days: quote.validityDays || settings.default_validity_days || 30 });

    const venueLocation = [
      quote.venueName || (quote as any).venue,
      quote.venueCity || (quote as any).city,
    ]
      .filter(Boolean)
      .join(', ');

    const amount = `${sym}${total}`;
    const lines = [
      quote.clientName ? tr('Hi {name},', { name: quote.clientName }) : tr('Hi there,'),
      ``,
      tr('Here is the official event proposal from {band} for "{event}":', {
        band: bandName.toUpperCase(),
        event: quote.eventName || quote.eventTitle || eventLabel,
      }),
      tr('• Quote Ref: {ref}', { ref: quote.quoteNumber || 'EVT-QUOTE' }),
      tr('• Event Date: {date}', { date: eventDateStr }),
      tr('• Location: {place}', { place: venueLocation || tr('TBD', { context: 'doc' }) }),
      tr('• Lineup: {count} Musicians', { count: quote.musicianCount || (quote.musicians || []).length || 1 }),
      quote.vatExempt
        ? tr('• Total Proposal: {amount} (VAT Exempt)', { amount })
        : tr('• Total Proposal: {amount} (incl. {rate}% VAT)', { amount, rate: quote.vatRate ?? settings.default_vat_rate ?? 22 }),
      quote.depositRequired !== false && (quote.depositAmount || 0) > 0
        ? tr('• Booking Deposit ({percent}%): {amount}', {
            percent: quote.depositPercentage || settings.default_deposit_rate || 20,
            amount: `${sym}${Math.round(quote.depositAmount || 0).toLocaleString(intlLocale(undefined, docLang))}`,
          })
        : null,
      tr('• Valid Until: {date}', { date: validUntilStr }),
      pdfUrl ? `\n${tr('📄 View / Download Full PDF Quote:')}\n${pdfUrl}` : null,
      ``,
      tr('Please let us know if you have any questions or would like to tailor the package!'),
      tr('Best regards,'),
      settings.signer_name || bandName,
    ].filter((line): line is string => line !== null);

    return lines.join('\n');
  };

  const shareTitle = tr('{band} — Quote {ref}', { band: bandName, ref: quote.quoteNumber || '' }).trim();

  /** System share sheet with the PDF attached (Mail, WhatsApp, Files, AirDrop…). */
  const sharePdf = async (opts: { markAsSent: boolean; withText: boolean }) => {
    if (!pdfResult) return;
    try {
      const result = await shareFile(pdfResult.pdfBlob, pdfResult.fileName, {
        title: shareTitle,
        text: opts.withText ? buildShareText(uploadedUrl) : undefined,
      });
      if (result === 'cancelled') return;
      if (result === 'downloaded') flash(t('PDF downloaded'));
      else flash(opts.markAsSent ? t('Quote shared') : t('PDF ready'));
      if (opts.markAsSent) void markSent();
    } catch (err) {
      console.error('[QuoteShareModal] Share failed:', err);
      flash(t('Could not share the PDF. Try again.'), 'error');
    }
  };

  const handleNativeShare = () => sharePdf({ markAsSent: true, withText: true });

  /** Download = save the file on the device (Share opens the system sheet). */
  const handleDownload = async () => {
    if (!pdfResult) return;
    try {
      const { result, location } = await saveFile(pdfResult.pdfBlob, pdfResult.fileName);
      if (result === 'saved') flash(t('PDF saved to {location}', { location: String(location) }));
      else if (result === 'downloaded') flash(t('PDF downloaded'));
      else if (result === 'shared') flash(t('PDF ready'));
    } catch (err) {
      console.error('[QuoteShareModal] Save failed:', err);
      flash(t('Could not save the PDF. Try Share instead.'), 'error');
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
    const subject = tr('{band} — Event Quote {ref} ({event})', {
      band: bandName.toUpperCase(),
      ref: quote.quoteNumber || '',
      event: quote.eventName || quote.eventTitle || tr('Proposal'),
    });
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
      navigator.clipboard.writeText(text).then(done, () => flash(t('Could not copy. Use Share PDF instead.'), 'error'));
    } catch {
      flash(t('Could not copy. Use Share PDF instead.'), 'error');
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
      title: t('Share PDF document'),
      subtitle: t('Native share sheet'),
      icon: <Share2 />,
      onClick: handleNativeShare,
      disabled: isGenerating || !pdfResult,
    },
    {
      key: 'whatsapp',
      title: 'WhatsApp',
      subtitle: uploadedUrl ? t('Pre-filled message + PDF link') : t('Send the PDF file'),
      icon: isUploading ? <Loader2 className="animate-spin" /> : <MessageCircle />,
      onClick: handleWhatsAppShare,
      disabled: isGenerating || isUploading || !pdfResult,
    },
    {
      key: 'email',
      title: t('Email client'),
      subtitle: uploadedUrl ? t('Formal proposal + PDF link') : t('PDF as attachment'),
      icon: isUploading ? <Loader2 className="animate-spin" /> : <Mail />,
      onClick: handleEmailShare,
      disabled: isGenerating || isUploading || !pdfResult,
    },
    {
      key: 'download',
      title: t('Download PDF'),
      subtitle: Capacitor.isNativePlatform() ? t('Save a copy on this device') : t('Save to your computer'),
      icon: <Download />,
      onClick: handleDownload,
      disabled: isGenerating || !pdfResult,
    },
    {
      key: 'copy',
      title: copiedSummary ? t('Copied!') : t('Copy text & link'),
      subtitle: t('Paste anywhere'),
      icon: copiedSummary ? <Check className="text-success" /> : <Copy />,
      onClick: handleCopySummary,
      disabled: isGenerating || isUploading || !pdfResult,
    },
  ];

  const linkReady = !!link && !link.revoked && !isGenerating && !!pdfResult && !isUploading;
  const firstName = (quote.clientName || '').trim().split(/\s+/)[0];
  const linkChannels: typeof shareChannels = [
    {
      key: 'link-whatsapp',
      title: 'WhatsApp',
      subtitle: t('Message with the quote link'),
      icon: <MessageCircle />,
      onClick: () => sendLinkVia('whatsapp'),
      disabled: !linkReady,
    },
    {
      key: 'link-sms',
      title: t('Text message'),
      subtitle: t('Message with the quote link'),
      icon: <Smartphone />,
      onClick: () => sendLinkVia('sms'),
      disabled: !linkReady,
    },
    {
      key: 'link-email',
      title: t('Email'),
      subtitle: quote.clientEmail ? t('To {email}, with the PDF', { email: quote.clientEmail }) : t('Add the client’s email to the quote first.'),
      icon: emailing ? <Loader2 className="animate-spin" /> : <Mail />,
      onClick: () => void emailLink(),
      disabled: !linkReady || emailing || !quote.clientEmail,
    },
    {
      key: 'link-copy',
      title: copiedLink ? t('Copied!') : t('Copy message & link'),
      subtitle: t('Paste anywhere'),
      icon: copiedLink ? <Check className="text-success" /> : <Link />,
      onClick: () => sendLinkVia('copy'),
      disabled: !linkReady,
    },
  ];
  const pdfChannels = shareChannels.filter((c) => c.key === 'native' || c.key === 'download');
  const heading = kind === 'reminder' ? t('Remind client') : kind === 'updated' ? t('Send the update') : t('PDF ready');

  const renderChannel = (ch: (typeof shareChannels)[number]) => (
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
  );

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
      aria-label={t('Quote PDF ready')}
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
                  {quote.quoteNumber || t('Draft')} · {t('Official quote')}
                </p>
                <h1 className="bw-display-lg">{heading}</h1>
              </div>
              <RailCover pane />
              <HeaderAction pane label={t('Close')} variant="filled" railProminent={false} icon={<X />} onClick={onClose} />
            </div>
            <div className="flex items-center gap-2">
              {openBandSettings && (
                <PillButton
                  variant="outline"
                  size="sm"
                  fullWidth={false}
                  icon={<IconSettings className="w-3.5 h-3.5" />}
                  onClick={openBandSettings}
                  title={t('Configure band logo, signature & payment details')}
                >
                  {t('Branding & payment')}
                </PillButton>
              )}
              <IconButton
                label={t('Regenerate PDF preview')}
                size="sm"
                icon={<RefreshCw className={isGenerating ? 'animate-spin' : undefined} />}
                onClick={loadAndGenerate}
                disabled={isGenerating}
              />
            </div>
          </header>

          {autoSendEmail && (() => {
            const note =
              autoNote ??
              (linkError || generateError || !canLink
                ? { text: t('The quote could not be sent automatically. Pick a channel below.'), tone: 'error' as const }
                : null);
            return (
            <p
              role="status"
              aria-live="polite"
              className={`flex items-center gap-2 min-h-11 px-4 py-2 rounded-[16px] bw-body-sm ${
                note?.tone === 'error'
                  ? 'bg-destructive-solid text-white'
                  : note?.tone === 'ok'
                    ? 'bg-success text-success-foreground'
                    : 'bg-card text-muted-foreground'
              }`}
            >
              {note?.tone === 'error' ? (
                <AlertCircle className="w-4 h-4 shrink-0" />
              ) : note?.tone === 'ok' ? (
                <Check className="w-4 h-4 shrink-0" />
              ) : (
                <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
              )}
              <span className="min-w-0 [overflow-wrap:anywhere]">{note?.text ?? t('Preparing the quote…')}</span>
            </p>
            );
          })()}

          {/* A4 preview */}
          <section className="bg-card rounded-[24px] p-4 flex flex-col items-center gap-3">
            {pageCount > 1 && pdfResult && (
              <div className="w-full flex items-center gap-2">
                <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
                  {pdfResult.pageDataUrls.map((_, idx) => {
                    const isSummaryPage = idx === pageCount - 1 && pageCount > 1 && quote.includeProposalSummary;
                    return (
                      <Selector key={idx} selected={activePageIndex === idx} onClick={() => setActivePageIndex(idx)}>
                        {isSummaryPage ? t('Page {page} · Summary', { page: idx + 1 }) : t('Page {page}', { page: idx + 1 })}
                      </Selector>
                    );
                  })}
                </div>
                <IconButton
                  label={t('Previous page')}
                  size="sm"
                  variant="ghost"
                  icon={<ChevronLeft />}
                  onClick={() => setActivePageIndex((p) => Math.max(0, p - 1))}
                  disabled={activePageIndex === 0}
                />
                <IconButton
                  label={t('Next page')}
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
                  <p className="bw-body-sm">{t('The PDF could not be created.')}</p>
                  <PillButton variant="outline" size="sm" fullWidth={false} icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={loadAndGenerate}>
                    {t('Try again')}
                  </PillButton>
                </div>
              ) : isGenerating || !pdfResult ? (
                <div className="w-full max-w-[260px] aspect-[1/1.414] bg-white text-black rounded-[16px] flex flex-col items-center justify-center gap-3 p-6">
                  <Loader2 className="w-7 h-7 animate-spin" />
                  <p className="bw-label-xs text-black/60 text-center">{t('Rendering A4 PDF…')}</p>
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
                    alt={t('Quote PDF page {page}', { page: activePageIndex + 1 })}
                    className="max-h-[52vh] w-auto max-w-full object-contain rounded-[16px] bg-white"
                  />
                </AnimatePresence>
              )}
            </div>

            <p className="bw-label-xs text-muted-foreground text-center">
              {pdfResult
                ? t('A4 portrait · Page {page} of {count} · {size} KB', {
                    page: activePageIndex + 1,
                    count: pageCount,
                    size: (pdfResult.pdfBlob.size / 1024).toFixed(0),
                  })
                : t('A4 portrait · Preparing…')}
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
                <span className="bw-label-sm text-foreground">{t('Complete your band branding')}</span>
                <span className="bw-body-sm text-muted-foreground">
                  {!settings.band_logo_url
                    ? t('Add logo and signature to the PDF')
                    : t('Add your bank account to show transfer details on the quote.')}
                </span>
              </span>
              <ChevronRight className="w-5 h-5 shrink-0" aria-hidden />
            </button>
          )}

          <OnlineDepositLinks />

          <DocLanguagePicker value={docLang} onChange={changeDocLang} className="pt-2" />

          {canLink ? (
            <>
              {/* The client's link (099): accept, decline or discuss on /quote.html */}
              <section className="flex flex-col gap-2" aria-labelledby="send-to-client">
                <h2 id="send-to-client" className="bw-label-sm text-muted-foreground pt-2">{t('Send to client')}</h2>
                <p className="bw-body-sm text-muted-foreground">
                  {firstName
                    ? t('A personal link where {name} can accept the quote, decline it or ask you questions. You get a notification for each answer.', { name: firstName })
                    : t('A personal link where the client can accept the quote, decline it or ask you questions. You get a notification for each answer.')}
                </p>
                {link?.revoked ? (
                  <div className="flex flex-col gap-3 p-4 rounded-[16px] bg-card">
                    <p className="bw-body-sm">{t('The link of this quote is turned off.')}</p>
                    <PillButton variant="outline" size="sm" fullWidth={false} icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={() => void newLink()}>
                      {t('Create a new link')}
                    </PillButton>
                  </div>
                ) : linkError ? (
                  <p role="alert" className="bw-body-sm text-destructive">{t('The client link could not be prepared. Check your connection and reopen this screen.')}</p>
                ) : (
                  linkChannels.map(renderChannel)
                )}
              </section>
              <section className="flex flex-col gap-2">
                <h2 className="bw-label-sm text-muted-foreground pt-2">{t('PDF only')}</h2>
                {pdfChannels.map(renderChannel)}
              </section>
            </>
          ) : (
            <section className="flex flex-col gap-2">
              <h2 className="bw-label-sm text-muted-foreground pt-2">{t('Share quote via')}</h2>
              {shareChannels.map(renderChannel)}
            </section>
          )}

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
            {t('Done')}
          </PillButton>
        </div>
      </div>
    </motion.div>,
    document.body,
  );
};
