import { Quote, QuotePackageOption } from '@/app/data/quotes';
import { builtinText } from '@/lib/i18n/builtins';
import { BandPricingSettings, DEFAULT_BAND_PRICING, DEFAULT_QUOTE_DISCLAIMER, bankAccountLine, bankDetailParts, hasBankAccount } from '@/lib/services/pricing';
import { supabase } from '@/lib/supabase';
import { formatDistance } from '@/lib/units';
import {
  formatQuoteMoney,
  totalsForQuote,
  calculateDepositAmount,
  DEFAULT_DEPOSIT_RATE,
  DEFAULT_SET_MINUTES,
  DEFAULT_SETS,
  DEFAULT_VAT_RATE,
} from '@/lib/services/quoteMath';
import { ONLINE_DEPOSITS_ENABLED } from './pricing';
import { intlLocale, translate, type Locale, type TranslateVars } from '@/lib/i18n';

export interface QuotePdfGenerationResult {
  pdfBlob: Blob;
  pdfFile: File;
  pageDataUrls: string[];
  fileName: string;
}

const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;
const CANVAS_W = 1654; // 200 DPI A4 width
const CANVAS_H = 2339; // 200 DPI A4 height

const getCurrencySymbol = (currency?: string): string => {
  if (currency === 'USD') return '$';
  if (currency === 'GBP') return '£';
  if (currency === 'CHF') return 'CHF ';
  return '€';
};

// Same formatting as the wizard (whole amounts without decimals, otherwise cents).
// The document is written in the client's language (`lang`); English output is unchanged.
const moneyIn = (lang: Locale) => (amount: number, sym = '€'): string =>
  formatQuoteMoney(amount || 0, sym, intlLocale('en-US', lang));

const trIn = (lang: Locale) => (source: string, vars?: TranslateVars) => translate(lang, source, vars);

const formatFormalEventDate = (dateStr: string | undefined, lang: Locale): string => {
  if (!dateStr) return translate(lang, 'Date TBD');
  const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const d = new Date(`${clean}T00:00:00`);
  if (isNaN(d.getTime())) return dateStr;
  if (lang !== 'en') return d.toLocaleDateString(intlLocale(undefined, lang), { day: 'numeric', month: 'long', year: 'numeric' });
  const day = d.getDate();
  const month = d.toLocaleDateString('en-GB', { month: 'long' });
  const year = d.getFullYear();
  return `${day} ${month}, ${year}`;
};

const formatIssueDateDMY = (dateStr: string | undefined, lang: Locale): string => {
  const parsed = dateStr ? new Date(dateStr) : new Date();
  if (lang !== 'en') {
    const day = isNaN(parsed.getTime()) ? new Date() : parsed;
    return day.toLocaleDateString(intlLocale(undefined, lang), { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  const d = parsed;
  if (isNaN(d.getTime())) {
    const now = new Date();
    return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  }
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

const loadImageSafe = (url?: string): Promise<HTMLImageElement | null> => {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    if (!url.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
};

const wrapTextLines = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] => {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
};

const drawBandLogoOrWordmark = (
  ctx: CanvasRenderingContext2D,
  logoImg: HTMLImageElement | null,
  bandName: string
) => {
  const rightEdge = CANVAS_W - 180;
  const topY = 175;

  if (logoImg && logoImg.width > 0 && logoImg.height > 0) {
    const maxW = 280;
    const maxH = 130;
    const ratio = Math.min(maxW / logoImg.width, maxH / logoImg.height);
    const drawW = logoImg.width * ratio;
    const drawH = logoImg.height * ratio;
    ctx.drawImage(logoImg, rightEdge - drawW, topY, drawW, drawH);
  } else {
    ctx.save();
    ctx.fillStyle = '#6e6a7c';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    // Shrink the wordmark to fit instead of cutting the band name.
    const display = (bandName || 'BAND').toUpperCase();
    const maxW = 900;
    let size = 86;
    ctx.font = `300 ${size}px Georgia, "Times New Roman", serif`;
    while (size > 36 && ctx.measureText(display).width > maxW) {
      size -= 4;
      ctx.font = `300 ${size}px Georgia, "Times New Roman", serif`;
    }
    ctx.fillText(display, rightEdge, topY + 10, maxW);
    ctx.restore();
  }
};

interface SingleQuotePageParams {
  quote: Partial<Quote>;
  bandName: string;
  settings: BandPricingSettings;
  logoImg: HTMLImageElement | null;
  signatureImg: HTMLImageElement | null;
  optionOverride?: QuotePackageOption;
  lang: Locale;
}

const renderSingleOptionQuotePage = (params: SingleQuotePageParams): string => {
  const { quote, bandName, settings, logoImg, signatureImg, optionOverride, lang } = params;
  const tr = trIn(lang);
  const formatMoney = moneyIn(lang);
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d')!;

  // White A4 background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  const sym = getCurrencySymbol(quote.currency || settings.currency);
  const leftMargin = 145;
  const rightMargin = CANVAS_W - 145;
  const contentWidth = rightMargin - leftMargin;

  // 1. Top-Right Logo
  drawBandLogoOrWordmark(ctx, logoImg, bandName);

  // 2. "Event Quote" Title
  ctx.fillStyle = '#111111';
  ctx.font = '400 68px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(tr('Event Quote'), leftMargin, 310);

  // 3. Metadata Block (Description, Client, Event Date)
  let y = 520;
  const labelX = leftMargin;
  const valueX = leftMargin + 345;

  const venueDisplay = [quote.venueName, quote.venueCity].filter(Boolean).join(', ');
  const descriptionText =
    quote.quoteDescription?.trim() ||
    (venueDisplay && venueDisplay !== 'TBD'
      ? tr('Formal quote for an event in {venue}', { venue: venueDisplay })
      : quote.eventName || quote.eventTitle || tr('Formal event performance quote'));

  const metaRows = [
    { label: tr('Description:'), value: descriptionText },
    {
      label: tr('Client:'),
      value: [quote.clientName || tr('Client TBD'), quote.clientCompany].filter(Boolean).join(' — '),
    },
    { label: tr('Event Date:'), value: formatFormalEventDate(quote.eventDate, lang) },
  ];

  for (const row of metaRows) {
    ctx.font = '700 24px "Inter", "Helvetica Neue", Arial, sans-serif';
    ctx.fillStyle = '#7a7a7a';
    ctx.fillText(row.label, labelX, y);

    ctx.font = '700 24px Georgia, "Times New Roman", serif';
    ctx.fillStyle = '#111111';
    ctx.fillText(row.value, valueX, y);
    y += 42;
  }

  // 4. Validity Disclaimer Paragraph
  y += 45;
  const validityDays = quote.validityDays || settings.default_validity_days || 30;
  const bandDisclaimer = quote.customDisclaimer?.trim() || settings.default_quote_disclaimer;
  // The built-in text follows the document language; text the band wrote is used as written.
  const rawDisclaimer =
    !bandDisclaimer || bandDisclaimer === DEFAULT_QUOTE_DISCLAIMER ? tr(DEFAULT_QUOTE_DISCLAIMER) : bandDisclaimer;
  const formattedDisclaimer = `( ${rawDisclaimer.replace(/\{days\}/g, String(validityDays))} )`;

  ctx.font = '400 22px Georgia, "Times New Roman", serif';
  ctx.fillStyle = '#222222';
  const disclaimerLines = wrapTextLines(ctx, formattedDisclaimer, contentWidth);
  for (const line of disclaimerLines) {
    ctx.fillText(line, leftMargin, y);
    y += 32;
  }

  // 5. Service Description Table Header
  y += 58;
  const colServiceX = leftMargin;
  const colDetailsX = leftMargin + 1090;
  const colPriceRightX = rightMargin;

  ctx.font = '700 23px "Inter", "Helvetica Neue", Arial, sans-serif';
  ctx.fillStyle = '#4f6b82';
  ctx.textAlign = 'left';
  ctx.fillText(tr('Service Description'), colServiceX, y);
  ctx.fillText(tr('Details'), colDetailsX, y);
  ctx.textAlign = 'right';
  ctx.fillText(tr('Price'), colPriceRightX, y);
  ctx.textAlign = 'left';

  y += 34;

  // Determine Main Band details (either from optionOverride or quote)
  const musiciansList = quote.musicians || [];
  const musiciansCount =
    optionOverride?.musiciansCount ||
    (musiciansList.length > 0 ? musiciansList.length : settings.core_members_count || 6);

  const instrumentsList = musiciansList
    .map((m) => m.instrument)
    .filter(Boolean);
  const defaultInstrumentsText =
    instrumentsList.length > 0
      ? tr('(e.g. {list})', { list: instrumentsList.join(', ') })
      : tr('(e.g. Drums, Bass, Keys, Guitar, Vocals)');
  const instrumentsDetail = builtinText(optionOverride?.instrumentsDetail, lang) || defaultInstrumentsText;

  const numSets = quote.numberOfSets || DEFAULT_SETS;
  const setDur = quote.setDuration || DEFAULT_SET_MINUTES;
  const setsDescription =
    numSets === 1
      ? tr('(Includes 1 set of {minutes} minutes or equivalent)', { minutes: setDur })
      : tr('(Includes {count} sets of {minutes} minutes or equivalent)', { count: numSets, minutes: setDur });

  const mainBandFee =
    optionOverride?.grossFee ??
    (quote.baseFee && quote.baseFee > 0 ? quote.baseFee : quote.subtotal || 0);

  // Helper to draw a shaded service row + sub-details
  const drawServiceItem = (
    title: string,
    detailsLabel: string,
    priceLabel: string,
    leftSubLines: string[],
    rightSubLines: string[]
  ) => {
    // Shaded bar
    ctx.fillStyle = '#f3f3f3';
    ctx.fillRect(leftMargin - 6, y - 6, contentWidth + 12, 42);

    ctx.fillStyle = '#111111';
    ctx.font = '700 22px "Inter", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(title, colServiceX, y + 4);

    ctx.font = '700 22px Georgia, "Times New Roman", serif';
    if (lang !== 'en') {
      // Translations can be longer than the English label: shrink it so it never runs into the price.
      const room = colPriceRightX - ctx.measureText(priceLabel).width - 14 - colDetailsX;
      let size = 22;
      while (size > 15 && ctx.measureText(detailsLabel).width > room) {
        size -= 1;
        ctx.font = `700 ${size}px Georgia, "Times New Roman", serif`;
      }
    }
    ctx.fillText(detailsLabel, colDetailsX, y + 4);

    ctx.font = '700 22px Georgia, "Times New Roman", serif';
    ctx.textAlign = 'right';
    ctx.fillText(priceLabel, colPriceRightX, y + 4);
    ctx.textAlign = 'left';

    y += 44;

    const maxSubRows = Math.max(leftSubLines.length, rightSubLines.length);
    let leftY = y;
    let rightY = y;

    ctx.font = '400 19px "Inter", "Helvetica Neue", Arial, sans-serif';
    ctx.fillStyle = '#555555';
    for (const lLine of leftSubLines) {
      ctx.fillText(lLine, colServiceX, leftY);
      leftY += 26;
    }

    ctx.font = '400 19px Georgia, "Times New Roman", serif';
    ctx.fillStyle = '#555555';
    for (const rLine of rightSubLines) {
      ctx.fillText(rLine, colDetailsX, rightY);
      rightY += 25;
    }

    y = Math.max(leftY, rightY, maxSubRows > 0 ? y + 10 : y) + 18;
  };

  // Row 1: MAIN BAND
  const wrappedInstruments = wrapTextLines(ctx, instrumentsDetail, 240);
  drawServiceItem(
    tr('MAIN BAND'),
    optionOverride?.lineupLabel || tr('{count}pc band', { count: musiciansCount }),
    formatMoney(mainBandFee, sym),
    [setsDescription],
    wrappedInstruments
  );

  // Row 2: MUSICAL PRODUCTION (if not 'none')
  const prodTier = quote.productionTier || 'standard';
  if (prodTier !== 'none') {
    const tierName =
      prodTier === 'pro' ? tr('( Pro Production )') : prodTier === 'custom' ? tr('( Custom )') : tr('( Standard )');
    const isProdIncluded =
      quote.soundIncluded !== false && (!quote.soundFee || quote.soundFee === 0);
    const prodPriceText = isProdIncluded
      ? tr('included')
      : formatMoney((quote.soundFee || 0) + (quote.lightsFee || 0), sym);

    const guestsLabel = quote.guestCount || 150;
    const defaultBullets =
      prodTier === 'pro'
        ? [
            tr('• High-output PA system for {guests}+ guests', { guests: guestsLabel }),
            tr('• Full stage lighting show & sound engineer'),
          ]
        : [
            tr('• Sound equipment up to {guests} guests', { guests: guestsLabel }),
            tr('• Standard lighting'),
          ];
    const bullets =
      quote.productionBullets && quote.productionBullets.length > 0
        ? quote.productionBullets.map((b) => (b.startsWith('•') ? b : `• ${b}`))
        : defaultBullets;

    drawServiceItem(tr('MUSICAL PRODUCTION'), tierName, prodPriceText, bullets, []);
  }

  // Row 3+: Selected Musical Moments
  if (quote.selectedMoments && quote.selectedMoments.length > 0) {
    for (const mom of quote.selectedMoments) {
      const momDetails = tr('{count}pc ({minutes}m)', { count: mom.musicians, minutes: mom.duration });
      const momPrice = mom.included || mom.price === 0 ? tr('included') : formatMoney(mom.price, sym);
      const subLeft = mom.description ? [`(${builtinText(mom.description, lang)})`] : [];
      const subRight =
        mom.instruments && mom.instruments.length > 0
          ? wrapTextLines(ctx, `(${mom.instruments.join(', ')})`, 240)
          : [];
      drawServiceItem(builtinText(mom.name, lang).toUpperCase(), momDetails, momPrice, subLeft, subRight);
    }
  }

  // Row 4+: Custom Items / Extra Services
  if (quote.customItems && quote.customItems.length > 0) {
    for (const item of quote.customItems) {
      const itemPrice = (item.price ?? item.amount ?? 0) * (item.quantity || 1);
      const itemLabel = (builtinText(item.name || item.description, lang) || tr('EXTRA SERVICE')).toUpperCase();
      const qtyDetail = item.quantity && item.quantity > 1 ? `× ${item.quantity}` : tr('( Add-on )');
      drawServiceItem(
        itemLabel,
        qtyDetail,
        itemPrice > 0 ? formatMoney(itemPrice, sym) : tr('included'),
        item.description && item.name && item.description !== item.name ? [builtinText(item.description, lang)] : [],
        []
      );
    }
  }

  // Row 5+: Separate Travel / Accommodation / Meals Fees (when itemized)
  if (!quote.travelIncluded && (quote.travelFee || 0) > 0) {
    // The quote keeps the one-way distance; the fee covers the round trip.
    const distNote = quote.travelDistanceKm
      ? tr('{distance} round trip', { distance: formatDistance(quote.travelDistanceKm * 2) })
      : tr('Transport & mileage');
    drawServiceItem(
      tr('TRAVEL & LOGISTICS'),
      distNote,
      formatMoney(quote.travelFee || 0, sym),
      [tr('(Transport, fuel & mileage expenses)')],
      []
    );
  }

  if (quote.accommodationNeeded && (quote.accommodationFee || 0) > 0) {
    const roomsNote = quote.accommodationRooms
      ? tr('{count} rooms', { count: quote.accommodationRooms })
      : tr('Hotel & lodging');
    drawServiceItem(
      tr('ACCOMMODATION'),
      roomsNote,
      formatMoney(quote.accommodationFee || 0, sym),
      [tr('(Overnight accommodation for band & crew)')],
      []
    );
  }

  if (quote.mealsIncluded === false && (quote.mealsFee || 0) > 0) {
    drawServiceItem(
      tr('CATERING / MEALS'),
      tr('{count} persons', { count: musiciansCount }),
      formatMoney(quote.mealsFee || 0, sym),
      [tr('(Artist hospitality & hot meals)')],
      []
    );
  }

  // 6. Totals Block
  y = Math.max(y + 40, 1110);

  // Totals always come from the shared quote math (src/lib/services/quoteMath.ts), so the
  // PDF shows exactly what the wizard / detail modal show (clamped discount, cents rounding).
  const vatRate = optionOverride ? optionOverride.vatRate : quote.vatRate ?? settings.default_vat_rate ?? DEFAULT_VAT_RATE;
  const quoteTotals = totalsForQuote(
    {
      subtotal: quote.subtotal,
      lineItems: quote.lineItems,
      discountType: quote.discountType,
      discountValue: quote.discountValue,
      discountAmount: quote.discountAmount,
      vatRate,
      vatExempt: quote.vatExempt,
      reverseCharge: quote.reverseCharge,
    },
    { subtotal: mainBandFee }
  );
  const grossSubtotal = optionOverride ? optionOverride.grossFee : quoteTotals.subtotal;
  const discountAmount = optionOverride
    ? optionOverride.discountAmount
    : quoteTotals.discount;
  const discountPct = optionOverride
    ? optionOverride.discountPercent
    : quote.discountType === 'percentage'
      ? Math.min(100, Math.max(0, quote.discountValue || 0))
      : grossSubtotal > 0 && discountAmount > 0
        ? Math.round((discountAmount / grossSubtotal) * 100)
        : 0;
  const hasDiscount = discountAmount > 0;
  const netTotal = optionOverride ? optionOverride.netSubtotal : quoteTotals.net;
  const vatAmount = optionOverride ? optionOverride.vatAmount : quoteTotals.vat;
  const totalWithVat = optionOverride ? optionOverride.totalWithVat : quoteTotals.total;
  const depositPct = optionOverride
    ? optionOverride.depositPercentage
    : quote.depositPercentage ?? settings.default_deposit_rate ?? DEFAULT_DEPOSIT_RATE;
  const depositAmount = optionOverride
    ? optionOverride.depositAmount
    : calculateDepositAmount(totalWithVat, depositPct);

  // TOTAL Row
  ctx.font = '700 23px "Inter", "Helvetica Neue", Arial, sans-serif';
  ctx.fillStyle = '#111111';
  ctx.textAlign = 'left';
  ctx.fillText(tr('TOTAL:'), leftMargin, y);

  const grossText = formatMoney(grossSubtotal, sym);
  ctx.font = '700 23px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'right';
  ctx.fillText(grossText, rightMargin, y);

  // Strikethrough if discounted
  if (hasDiscount) {
    const grossWidth = ctx.measureText(grossText).width;
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(rightMargin - grossWidth - 4, y + 12);
    ctx.lineTo(rightMargin + 4, y + 12);
    ctx.stroke();
  }
  ctx.textAlign = 'left';

  y += 32;
  ctx.strokeStyle = '#d4d4d4';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(leftMargin, y);
  ctx.lineTo(rightMargin, y);
  ctx.stroke();
  y += 22;

  // DISCOUNTED TOTAL Row (if discounted)
  if (hasDiscount) {
    ctx.font = '700 23px "Inter", "Helvetica Neue", Arial, sans-serif';
    ctx.fillStyle = '#111111';
    ctx.fillText(tr('DISCOUNTED TOTAL:'), leftMargin, y);

    ctx.font = '700 23px Georgia, "Times New Roman", serif';
    ctx.textAlign = 'right';
    ctx.fillText(formatMoney(netTotal, sym), rightMargin, y);
    ctx.textAlign = 'left';
    y += 46;
  }

  // VAT Row
  const vatLabel = quote.vatExempt
    ? tr('VAT (Exempt):')
    : quote.reverseCharge
      ? tr('VAT (Reverse Charge 0%):')
      : tr('VAT {rate}%:', { rate: vatRate });
  ctx.font = '400 23px Georgia, "Times New Roman", serif';
  ctx.fillStyle = '#111111';
  ctx.fillText(vatLabel, leftMargin, y);
  ctx.textAlign = 'right';
  ctx.fillText(formatMoney(vatAmount, sym), rightMargin, y);
  ctx.textAlign = 'left';
  y += 44;

  // Package Discount Applied note
  if (hasDiscount) {
    const discNote =
      discountPct > 0
        ? tr('Package Discount Applied ({amount})', { amount: `${discountPct}%` })
        : tr('Package Discount Applied ({amount})', { amount: formatMoney(discountAmount, sym) });
    ctx.font = 'italic 22px Georgia, "Times New Roman", serif';
    ctx.fillStyle = '#111111';
    ctx.fillText(discNote, leftMargin, y);
    const noteW = ctx.measureText(discNote).width;
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(leftMargin, y + 26);
    ctx.lineTo(leftMargin + noteW, y + 26);
    ctx.stroke();
    y += 56;
  }

  // Travel & Accommodation notes
  const inclusionNotes: string[] = [];
  if (quote.travelMode === 'included' || (quote.travelIncluded && (quote.travelFee || 0) === 0)) {
    inclusionNotes.push(tr('(This quote includes travel expenses.)'));
  } else if (quote.travelMode === 'client_provided') {
    inclusionNotes.push(tr('(Travel & transport to be arranged by the client.)'));
  }
  if (quote.accommodationMode === 'included') {
    inclusionNotes.push(tr('(This quote includes accommodation expenses.)'));
  } else if (quote.accommodationMode === 'client_provided') {
    inclusionNotes.push(tr('(Accommodation to be provided by the client if required.)'));
  }

  for (const note of inclusionNotes) {
    ctx.font = 'italic 22px "Inter", "Helvetica Neue", Arial, sans-serif';
    ctx.fillStyle = '#222222';
    ctx.fillText(note, leftMargin, y);
    y += 34;
  }

  y += 36;

  // TOTAL (VAT INCLUDED)
  ctx.font = '700 26px "Inter", "Helvetica Neue", Arial, sans-serif';
  ctx.fillStyle = '#111111';
  ctx.fillText(tr('TOTAL (VAT INCLUDED):'), leftMargin, y);

  ctx.textAlign = 'right';
  ctx.fillText(formatMoney(totalWithVat, sym), rightMargin, y);
  ctx.textAlign = 'left';

  y += 66;
  ctx.font = '400 21px "Inter", "Helvetica Neue", Arial, sans-serif';
  ctx.fillStyle = '#222222';
  ctx.fillText(tr('(for a {count}-piece band)', { count: musiciansCount }), leftMargin, y);

  // Initial Payment / Deposit line (Right-aligned)
  if (quote.depositRequired !== false && depositPct > 0) {
    y += 85;
    ctx.textAlign = 'right';
    ctx.font = '400 23px "Inter", "Helvetica Neue", Arial, sans-serif';
    ctx.fillStyle = '#111111';
    const depText = tr('Initial Payment: {percent}% = {amount} (to be paid in advance.)', { percent: depositPct, amount: formatMoney(depositAmount, sym) });
    ctx.fillText(depText, rightMargin, y);
    // Online deposit links (Stripe / PayPal): off for the whole alpha.
    const payLinks = ONLINE_DEPOSITS_ENABLED
      ? [settings.stripe_payment_link && tr('Card: {link}', { link: settings.stripe_payment_link }), settings.paypal_link && `PayPal: ${settings.paypal_link}`].filter(Boolean)
      : [];
    if (payLinks.length) {
      y += 34;
      ctx.font = '400 19px "Inter", "Helvetica Neue", Arial, sans-serif';
      ctx.fillStyle = '#444444';
      ctx.fillText(tr('Pay the deposit online · {links}', { links: payLinks.join('  ·  ') }), rightMargin, y);
    }
    ctx.textAlign = 'left';
  }

  // Optional Payment / Bank Details Block
  const hasBankDetails = hasBankAccount(settings);
  if (quote.showBankDetailsOnPdf !== false && hasBankDetails) {
    y += 52;
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.5;
    const boxH = 104;
    ctx.fillRect(leftMargin, y, contentWidth, boxH);
    ctx.strokeRect(leftMargin, y, contentWidth, boxH);

    ctx.font = '700 18px "Inter", "Helvetica Neue", Arial, sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText(tr('PAYMENT & BANK TRANSFER DETAILS'), leftMargin + 24, y + 20);

    const bankParts = bankDetailParts(settings, lang);

    ctx.font = '400 19px "Inter", "Helvetica Neue", Arial, sans-serif';
    ctx.fillStyle = '#475569';
    // Two lines max, so longer US / international details still fit the box.
    const bankLines = wrapTextLines(ctx, bankParts.join('   •   '), contentWidth - 48);
    bankLines.slice(0, 2).forEach((line, i) => ctx.fillText(line, leftMargin + 24, y + 54 + i * 28));
  }

  // Client Notes (if present)
  if (quote.clientNotes?.trim()) {
    y += 46;
    ctx.font = 'italic 19px Georgia, "Times New Roman", serif';
    ctx.fillStyle = '#475569';
    const noteLines = wrapTextLines(ctx, tr('Note: {note}', { note: quote.clientNotes.trim() }), contentWidth);
    for (const line of noteLines.slice(0, 2)) {
      ctx.fillText(line, leftMargin, y);
      y += 26;
    }
  }

  // 7. Footer: Issue Date (Bottom-Left) + Signature & Signer Contact (Bottom-Right)
  const footerBaseY = 1860;

  // Issue date on left
  ctx.font = 'italic 22px Georgia, "Times New Roman", serif';
  ctx.fillStyle = '#a3a3a3';
  ctx.textAlign = 'left';
  ctx.fillText(formatIssueDateDMY(quote.createdAt, lang), leftMargin, footerBaseY);

  // Signature & Signer info on right
  const sigBlockX = leftMargin + 945;
  if (signatureImg && signatureImg.width > 0 && signatureImg.height > 0) {
    const maxSigW = 340;
    const maxSigH = 115;
    const ratio = Math.min(maxSigW / signatureImg.width, maxSigH / signatureImg.height);
    const drawW = signatureImg.width * ratio;
    const drawH = signatureImg.height * ratio;
    ctx.drawImage(signatureImg, sigBlockX - 20, footerBaseY - drawH + 15, drawW, drawH);
  } else if (settings.signer_name || bandName) {
    // Stylized cursive signature fallback
    ctx.save();
    ctx.font = 'italic 52px Georgia, "Times New Roman", serif';
    ctx.fillStyle = '#2c2c2c';
    ctx.fillText(settings.signer_name || bandName, sigBlockX - 10, footerBaseY - 48);
    ctx.restore();
  }

  let contactY = footerBaseY + 22;
  const signerName = settings.signer_name || bandName;
  const signerRole = settings.signer_role || tr('Musical Director and Musician');
  const contactEmail = settings.contact_email || quote.clientEmail || '';
  const contactPhone = settings.contact_phone || '';

  if (signerName) {
    ctx.font = '400 20px Georgia, "Times New Roman", serif';
    ctx.fillStyle = '#737373';
    ctx.fillText(signerName, sigBlockX, contactY);
    contactY += 25;
  }
  if (signerRole) {
    ctx.font = '400 19px Georgia, "Times New Roman", serif';
    ctx.fillStyle = '#9a9a9a';
    ctx.fillText(signerRole, sigBlockX, contactY);
    contactY += 25;
  }
  if (contactEmail) {
    ctx.font = '400 19px Georgia, "Times New Roman", serif';
    ctx.fillStyle = '#9a9a9a';
    ctx.fillText(contactEmail, sigBlockX, contactY);
    contactY += 25;
  }
  if (contactPhone) {
    ctx.font = '400 19px Georgia, "Times New Roman", serif';
    ctx.fillStyle = '#9a9a9a';
    ctx.fillText(contactPhone, sigBlockX, contactY);
    contactY += 25;
  }
  if (settings.tax_vat_id) {
    ctx.font = '400 17px "Inter", "Helvetica Neue", Arial, sans-serif';
    ctx.fillStyle = '#adadad';
    ctx.fillText(tr('VAT / Tax ID: {id}', { id: settings.tax_vat_id }), sigBlockX, contactY);
  }

  return canvas.toDataURL('image/jpeg', 0.94);
};

interface ProposalSummaryPageParams {
  quote: Partial<Quote>;
  bandName: string;
  settings: BandPricingSettings;
  logoImg: HTMLImageElement | null;
  options: QuotePackageOption[];
  lang: Locale;
}

const renderProposalSummaryPage = (params: ProposalSummaryPageParams): string => {
  const { quote, bandName, settings, logoImg, options, lang } = params;
  const tr = trIn(lang);
  const formatMoney = moneyIn(lang);
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  const sym = getCurrencySymbol(quote.currency || settings.currency);
  const leftMargin = 140;
  const rightMargin = CANVAS_W - 140;
  const tableWidth = rightMargin - leftMargin;

  // 1. Top-Right Logo
  drawBandLogoOrWordmark(ctx, logoImg, bandName);

  // 2. Title: "Event Proposal Summary"
  ctx.fillStyle = '#111111';
  ctx.font = '700 46px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(tr('Event Proposal Summary'), leftMargin, 340);

  // 3. Client & Event Date
  let y = 495;
  ctx.font = '700 22px "Inter", "Helvetica Neue", Arial, sans-serif';
  ctx.fillStyle = '#555555';
  ctx.fillText(tr('Client:'), leftMargin, y);
  ctx.font = '400 22px Georgia, "Times New Roman", serif';
  ctx.fillStyle = '#111111';
  ctx.fillText(quote.clientName || tr('Client TBD'), leftMargin + 330, y);

  y += 38;
  ctx.font = '700 22px "Inter", "Helvetica Neue", Arial, sans-serif';
  ctx.fillStyle = '#555555';
  ctx.fillText(tr('Event Date:'), leftMargin, y);
  ctx.font = '400 22px Georgia, "Times New Roman", serif';
  ctx.fillStyle = '#111111';
  ctx.fillText(formatFormalEventDate(quote.eventDate, lang), leftMargin + 330, y);

  // 4. Multi-Option Comparison Table
  y += 58;
  const labelColW = 325;
  const optCount = Math.max(1, options.length);
  const optColW = (tableWidth - labelColW) / optCount;

  // Header Row (Navy Blue #2b547e)
  const headerH = 56;
  ctx.fillStyle = '#2b547e';
  ctx.fillRect(leftMargin, y, tableWidth, headerH);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 22px "Inter", "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(tr('Package Overview'), leftMargin + 14, y + 17);

  options.forEach((opt, idx) => {
    const colCenterX = leftMargin + labelColW + idx * optColW + optColW / 2;
    ctx.textAlign = 'center';
    ctx.fillText(builtinText(opt.label, lang), colCenterX, y + 17);
  });
  ctx.textAlign = 'left';
  y += headerH;

  const drawCompRow = (
    label: string,
    values: string[],
    opts: {
      rowH?: number;
      bgColor?: string;
      labelBold?: boolean;
      valueFont?: string;
      valueColor?: string;
      topBorderColor?: string;
      bottomBorderColor?: string;
      borderWidth?: number;
    } = {}
  ) => {
    const rowH = opts.rowH || 48;
    if (opts.bgColor) {
      ctx.fillStyle = opts.bgColor;
      ctx.fillRect(leftMargin, y, tableWidth, rowH);
    }

    // Cell borders
    ctx.strokeStyle = '#d6d6d6';
    ctx.lineWidth = 1;
    ctx.strokeRect(leftMargin, y, labelColW, rowH);
    options.forEach((_, idx) => {
      ctx.strokeRect(leftMargin + labelColW + idx * optColW, y, optColW, rowH);
    });

    if (opts.topBorderColor) {
      ctx.strokeStyle = opts.topBorderColor;
      ctx.lineWidth = opts.borderWidth || 2.5;
      ctx.beginPath();
      ctx.moveTo(leftMargin, y);
      ctx.lineTo(rightMargin, y);
      ctx.stroke();
    }

    // Label
    ctx.fillStyle = '#111111';
    ctx.font = opts.labelBold
      ? '700 20px "Inter", "Helvetica Neue", Arial, sans-serif'
      : '400 20px "Inter", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, leftMargin + 14, y + rowH / 2 - 10);

    // Option values
    ctx.fillStyle = opts.valueColor || '#111111';
    ctx.font = opts.valueFont || '400 20px Georgia, "Times New Roman", serif';
    ctx.textAlign = 'center';
    values.forEach((val, idx) => {
      const colCenterX = leftMargin + labelColW + idx * optColW + optColW / 2;
      const lines = wrapTextLines(ctx, val, optColW - 24);
      if (lines.length <= 1) {
        ctx.fillText(val, colCenterX, y + rowH / 2 - 10);
      } else {
        ctx.fillText(lines[0], colCenterX, y + rowH / 2 - 22);
        ctx.fillText(lines.slice(1).join(' '), colCenterX, y + rowH / 2 + 4);
      }
    });
    ctx.textAlign = 'left';

    if (opts.bottomBorderColor) {
      ctx.strokeStyle = opts.bottomBorderColor;
      ctx.lineWidth = opts.borderWidth || 2.5;
      ctx.beginPath();
      ctx.moveTo(leftMargin, y + rowH);
      ctx.lineTo(rightMargin, y + rowH);
      ctx.stroke();
    }

    y += rowH;
  };

  drawCompRow(
    tr('Band Lineup'),
    options.map((o) => tr('{count} Musicians', { count: o.musiciansCount })),
    { rowH: 52, labelBold: true }
  );
  drawCompRow(
    tr('Instrumentation'),
    options.map((o) => o.instrumentsSummary),
    { rowH: 66, labelBold: true }
  );

  // Spacer gap between lineup & financials
  y += 22;

  const vatRate = quote.vatRate ?? settings.default_vat_rate ?? DEFAULT_VAT_RATE;
  const depositPct = quote.depositPercentage ?? settings.default_deposit_rate ?? DEFAULT_DEPOSIT_RATE;

  drawCompRow(
    tr('Gross Fee'),
    options.map((o) => formatMoney(o.grossFee, sym)),
    { rowH: 46, labelBold: true }
  );
  drawCompRow(
    tr('Package Discount'),
    options.map((o) => (o.discountAmount > 0 ? `(${formatMoney(o.discountAmount, sym)})` : '—')),
    {
      rowH: 46,
      labelBold: true,
      valueColor: '#1e7e34',
      valueFont: '400 20px Georgia, "Times New Roman", serif',
    }
  );
  drawCompRow(
    tr('Net Subtotal'),
    options.map((o) => formatMoney(o.netSubtotal, sym)),
    { rowH: 46, labelBold: true }
  );
  drawCompRow(
    tr('VAT ({rate}%)', { rate: vatRate }),
    options.map((o) => formatMoney(o.vatAmount, sym)),
    { rowH: 46, labelBold: true }
  );
  drawCompRow(
    tr('TOTAL (VAT INCLUDED)'),
    options.map((o) => formatMoney(o.totalWithVat, sym)),
    {
      rowH: 56,
      bgColor: '#d9e6f2',
      labelBold: true,
      valueFont: '700 23px "Inter", "Helvetica Neue", Arial, sans-serif',
      topBorderColor: '#2b547e',
      bottomBorderColor: '#2b547e',
      borderWidth: 3,
    }
  );
  drawCompRow(
    tr('Advance Deposit ({percent}%)', { percent: depositPct }),
    options.map((o) => formatMoney(o.depositAmount, sym)),
    {
      rowH: 50,
      labelBold: false,
      bottomBorderColor: '#2b547e',
      borderWidth: 2.5,
    }
  );

  // 5. Included Services & Terms of Agreement Table
  y += 28;
  const termsHeaderH = 48;
  ctx.fillStyle = '#e8eff7';
  ctx.fillRect(leftMargin, y, tableWidth, termsHeaderH);
  ctx.strokeStyle = '#c5d3e0';
  ctx.lineWidth = 1;
  ctx.strokeRect(leftMargin, y, tableWidth, termsHeaderH);

  ctx.fillStyle = '#1f3f60';
  ctx.font = '700 20px "Inter", "Helvetica Neue", Arial, sans-serif';
  ctx.fillText(tr('Included Services & Terms of Agreement'), leftMargin + 14, y + 14);
  y += termsHeaderH;

  const numSets = quote.numberOfSets || DEFAULT_SETS;
  const setDur = quote.setDuration || DEFAULT_SET_MINUTES;
  const guestsLabel = quote.guestCount || 150;
  const validityDays = quote.validityDays || settings.default_validity_days || 30;
  const bandTerms = quote.paymentTermsText || settings.default_payment_terms;
  // The built-in default follows the document language; terms the band wrote are used as written.
  const paymentTerms =
    (bandTerms && bandTerms === DEFAULT_BAND_PRICING.default_payment_terms ? tr(bandTerms) : bandTerms) ||
    tr('{deposit}% initial deposit upon booking; {balance}% balance due before event', { deposit: depositPct, balance: 100 - depositPct });

  const travelSummary =
    quote.travelMode === 'separate' && (quote.travelFee || 0) > 0
      ? quote.accommodationNeeded
        ? tr('Travel expenses: {amount} + Accommodation', { amount: formatMoney(quote.travelFee || 0, sym) })
        : tr('Travel expenses: {amount}', { amount: formatMoney(quote.travelFee || 0, sym) })
      : tr('Complete travel expenses included');

  const contactLine = [
    settings.contact_email || quote.clientEmail || '',
    settings.website ? tr('Website: {url}', { url: settings.website }) : '',
    hasBankAccount(settings) && quote.showBankDetailsOnPdf !== false
      ? bankAccountLine(settings, lang)
      : '',
  ]
    .filter(Boolean)
    .join('          ');

  const termsRows = [
    {
      label: tr('Live Performance:'),
      value: tr('{count} dynamic sets of {minutes} minutes (or custom equivalent schedule)', { count: numSets, minutes: setDur }),
    },
    {
      label: tr('Audio & Production:'),
      value: tr('High-end sound system for up to {guests} guests and stage lighting', { guests: guestsLabel }),
    },
    { label: tr('Logistics & Travel:'), value: travelSummary },
    { label: tr('Payment Terms:'), value: paymentTerms },
    { label: tr('Date:'), value: formatIssueDateDMY(quote.createdAt, lang) },
    { label: tr('Validity:'), value: tr('Quote valid for {days} days', { days: validityDays }) },
    { label: tr('Client:'), value: quote.clientName || tr('Client TBD') },
    { label: tr('Contact:'), value: contactLine || bandName },
  ];

  for (const row of termsRows) {
    const rowH = 44;
    ctx.strokeStyle = '#d6d6d6';
    ctx.lineWidth = 1;
    ctx.strokeRect(leftMargin, y, tableWidth, rowH);

    ctx.fillStyle = '#444444';
    ctx.font = '700 18px "Inter", "Helvetica Neue", Arial, sans-serif';
    ctx.fillText(row.label, leftMargin + 14, y + 13);

    ctx.fillStyle = '#222222';
    ctx.font = '400 18px Georgia, "Times New Roman", serif';
    ctx.fillText(row.value, leftMargin + 335, y + 13);
    y += rowH;
  }

  return canvas.toDataURL('image/jpeg', 0.94);
};

/**
 * Packs an array of JPEG Data URLs into a standards-compliant multi-page PDF 1.4 Blob.
 */
export const buildPdfBlobFromJpegDataUrls = (jpegDataUrls: string[]): Blob => {
  const pageImages = jpegDataUrls.map((dataUrl) => {
    const base64 = dataUrl.split(',')[1] || '';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  });

  const chunks: (string | Uint8Array)[] = [];
  const offsets: number[] = [];
  let byteLength = 0;

  const pushStr = (str: string) => {
    chunks.push(str);
    byteLength += str.length;
  };

  const pushBytes = (bytes: Uint8Array) => {
    chunks.push(bytes);
    byteLength += bytes.byteLength;
  };

  const startObj = (id: number) => {
    offsets[id] = byteLength;
    pushStr(`${id} 0 obj\n`);
  };

  const endObj = () => {
    pushStr('\nendobj\n');
  };

  pushStr('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');

  // Object 1: Catalog
  startObj(1);
  pushStr('<< /Type /Catalog /Pages 2 0 R >>');
  endObj();

  // Each page uses 3 objects: Page (3 + i*3), ContentStream (4 + i*3), ImageXObject (5 + i*3)
  const pageObjIds = pageImages.map((_, i) => 3 + i * 3);

  // Object 2: Pages
  startObj(2);
  pushStr(`<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageImages.length} >>`);
  endObj();

  pageImages.forEach((imgBytes, i) => {
    const pageId = 3 + i * 3;
    const contentId = 4 + i * 3;
    const imageId = 5 + i * 3;
    const imgName = `/Im${i + 1}`;

    // Page object
    startObj(pageId);
    pushStr(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_WIDTH_PT} ${A4_HEIGHT_PT}] /Resources << /XObject << ${imgName} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`
    );
    endObj();

    // Content stream drawing the full-bleed A4 image
    const contentStream = `q\n${A4_WIDTH_PT} 0 0 ${A4_HEIGHT_PT} 0 0 cm\n${imgName} Do\nQ`;
    startObj(contentId);
    pushStr(`<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`);
    endObj();

    // Image XObject
    startObj(imageId);
    pushStr(
      `<< /Type /XObject /Subtype /Image /Width ${CANVAS_W} /Height ${CANVAS_H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imgBytes.byteLength} >>\nstream\n`
    );
    pushBytes(imgBytes);
    pushStr('\nendstream');
    endObj();
  });

  const totalObjs = 2 + pageImages.length * 3;
  const xrefOffset = byteLength;

  pushStr(`xref\n0 ${totalObjs + 1}\n`);
  pushStr('0000000000 65535 f \n');
  for (let id = 1; id <= totalObjs; id++) {
    const offsetStr = String(offsets[id] || 0).padStart(10, '0');
    pushStr(`${offsetStr} 00000 n \n`);
  }

  pushStr(`trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  const blobParts = chunks.map((chunk) => {
    if (typeof chunk === 'string') {
      const arr = new Uint8Array(chunk.length);
      for (let i = 0; i < chunk.length; i++) {
        arr[i] = chunk.charCodeAt(i) & 0xff;
      }
      return arr;
    }
    return chunk;
  });

  return new Blob(blobParts as BlobPart[], { type: 'application/pdf' });
};

/**
 * Generates the complete Event Quote PDF (1 page for single-option quotes, or N+1 pages for multi-option quotes with Proposal Summary).
 */
export async function generateQuotePdf(
  quote: Partial<Quote>,
  bandName: string,
  settings: BandPricingSettings,
  /** Language the client reads (default English, as before). */
  lang: Locale = 'en'
): Promise<QuotePdfGenerationResult> {
  const [logoImg, signatureImg] = await Promise.all([
    loadImageSafe(settings.band_logo_url),
    loadImageSafe(settings.signature_url),
  ]);

  const pageDataUrls: string[] = [];
  const options = quote.quoteOptions && quote.quoteOptions.length > 0 ? quote.quoteOptions : [];

  if (quote.includeProposalSummary && options.length > 0) {
    // Render one formal Event Quote page per package option
    for (const opt of options) {
      pageDataUrls.push(
        renderSingleOptionQuotePage({
          quote,
          bandName,
          settings,
          logoImg,
          signatureImg,
          optionOverride: opt,
          lang,
        })
      );
    }
    // Render the final Event Proposal Summary comparison page
    pageDataUrls.push(
      renderProposalSummaryPage({
        quote,
        bandName,
        settings,
        logoImg,
        options,
        lang,
      })
    );
  } else {
    // Render single Event Quote page
    pageDataUrls.push(
      renderSingleOptionQuotePage({
        quote,
        bandName,
        settings,
        logoImg,
        signatureImg,
        lang,
      })
    );
  }

  const pdfBlob = buildPdfBlobFromJpegDataUrls(pageDataUrls);
  const safeBand = (bandName || 'Band').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeClient = (quote.clientName || 'Client').replace(/[^a-zA-Z0-9_-]/g, '_');
  const docWord = translate(lang, 'Quote').normalize('NFD').replace(/[^a-zA-Z0-9_-]/g, '');
  const fileName = `${docWord || 'Quote'}_${safeBand}_${safeClient}.pdf`;
  const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });

  return {
    pdfBlob,
    pdfFile,
    pageDataUrls,
    fileName,
  };
}

/** 16 random bytes as hex (32 chars) so shared PDF URLs cannot be guessed. */
const randomHexToken = (bytes = 16): string => {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Uploads the generated PDF to the Supabase Storage `quotes` bucket and returns a public share URL.
 * The path is `quotes/<bandId>/<quoteNumber>_<randomToken>_<fileName>`: the folder layout is what the
 * storage RLS checks (folder[1] = 'quotes', folder[2] = bandId, uploader must be an active band admin),
 * and the random token makes the public URL unguessable. There is deliberately no fallback bucket.
 */
export async function uploadQuotePdfForSharing(
  bandId: string,
  quoteNumber: string,
  pdfBlob: Blob,
  fileName: string
): Promise<string | null> {
  if (!bandId || bandId === 'default') return null;
  const safeNum = (quoteNumber || `Q-${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_');
  const storagePath = `quotes/${bandId}/${safeNum}_${randomHexToken()}_${fileName}`;

  try {
    const { error: qErr } = await supabase.storage
      .from('quotes')
      .upload(storagePath, pdfBlob, { contentType: 'application/pdf', upsert: false });

    if (!qErr) {
      const { data } = supabase.storage.from('quotes').getPublicUrl(storagePath);
      if (data?.publicUrl) return data.publicUrl;
    } else {
      console.warn('[QuotePDF] Could not upload PDF to the quotes bucket:', qErr);
    }
  } catch (err) {
    console.warn('[QuotePDF] Could not upload PDF to storage bucket:', err);
  }
  return null;
}
