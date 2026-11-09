import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, ArrowUpRight, Plus, Share2 } from '@/app/components/icons';
import { Quote } from '@/app/data/quotes';
import { WeatherWidget } from '@/app/components/ui/WeatherWidget';
import { usePeekingScroll } from '@/app/components/ui/PeekingScrollContainer';
import { useBand } from '@/lib/BandContext';
import { QuoteShareModal } from './QuoteShareModal';
import { totalsForQuote } from '@/lib/services/quoteMath';
import { parseLocalDate } from '@/lib/dates';

interface QuoteDetailModalProps {
  quote: Quote;
  onClose: () => void;
  onEdit?: (quote: Quote) => void;
  onSend?: (quote: Quote) => void;
  onDuplicate?: (quote: Quote) => void;
  onDelete?: (quote: Quote) => void;
  onOpenBandSettings?: () => void;
}

const getCurrencySym = (currency?: string): string => {
  if (currency === 'USD') return '$';
  if (currency === 'GBP') return '£';
  if (currency === 'CHF') return 'CHF ';
  return '€';
};

const formatBandTotal = (total: number, currency?: string): string => {
  const sym = getCurrencySym(currency);
  if (total >= 1000) return `${sym}${(total / 1000).toFixed(total % 1000 === 0 ? 0 : 1)}K`;
  return `${sym}${Math.round(total)}`;
};

export const QuoteDetailModal: React.FC<QuoteDetailModalProps> = ({
  quote,
  onClose,
  onEdit,
  onDelete,
  onOpenBandSettings,
}) => {
  const { selectedBand } = useBand();
  const [isShareOpen, setIsShareOpen] = useState(false);
  const canEdit = quote.status === 'DRAFT' || quote.status === 'SENT';
  const eventDate = quote.eventDate ? parseLocalDate(quote.eventDate) : null;
  // Same shared math as the wizard and the PDF, so the amounts always agree
  // (falls back to the stored total only for legacy rows without a subtotal / line items)
  const displayTotal =
    (quote.subtotal || 0) > 0 || (quote.lineItems?.length || 0) > 0
      ? totalsForQuote(quote).total
      : quote.total || 0;
  const year = eventDate && !isNaN(eventDate.getTime()) ? eventDate.getFullYear() : '';
  const monthDay = eventDate && !isNaN(eventDate.getTime())
    ? `${eventDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()} ${eventDate.getDate()}`
    : 'TBD';

  const clientDisplayName = (quote.clientName || 'Client TBD').trim();
  const clientParts = clientDisplayName.split(/\s+/);
  const clientPrimary = clientParts[0]?.toUpperCase() || 'CLIENT';
  const clientSecondary = clientParts.slice(1).join(' ')?.toUpperCase() || '';
  const displayTitle = quote.eventTitle || quote.eventName || 'UNTITLED';
  const setsAndExtrasCount =
    (quote.selectedMoments?.length || 0) + (quote.customItems?.length || 0) ||
    quote.lineItems?.length ||
    quote.numberOfSets ||
    1;

  const miniCal = eventDate && !isNaN(eventDate.getTime()) ? (() => {
    const y = eventDate.getFullYear();
    const m = eventDate.getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const firstDay = (new Date(y, m, 1).getDay() + 6) % 7;
    return { daysInMonth, firstDay, eventDay: eventDate.getDate() };
  })() : null;

  const dp = quote.depositPercentage || 30;
  const { containerRef, maskStyle } = usePeekingScroll<HTMLDivElement>({ fadeHeight: 60 });

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[110]"
        style={{ backgroundColor: 'var(--accent-quote)' }}
      />

      <motion.div
        ref={containerRef}
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="fixed inset-0 z-[120] flex flex-col overflow-y-auto"
        style={{
          backgroundColor: 'var(--accent-quote)',
          ...maskStyle,
        }}
      >
        <div
          className="flex-1 flex flex-col gap-[40px] px-[16px]"
          style={{
            paddingTop: 'calc(var(--wizard-header-pt, max(env(safe-area-inset-top, 0px), 56px)) + 12px)',
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 140px)',
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-[20px]">
            <button
              onClick={onClose}
              className="w-[50px] h-[50px] rounded-full flex items-center justify-center border-2 border-white"
              style={{ backgroundColor: 'rgba(216,216,216,0.2)' }}
            >
              <ArrowLeft className="w-[24px] h-[24px] text-white" />
            </button>
            <span className="text-[32px] font-bold text-white uppercase">QUOTE</span>
          </div>

          {/* Event Info */}
          <div className="flex gap-[20px] items-start">
            <div className="flex-1 flex flex-col gap-[4px] min-w-0">
              <div className="flex gap-[4px] items-center flex-wrap">
                <div className="rounded-[6px] px-[10px] py-[4px] bg-white">
                  <span className="text-[12px] font-bold uppercase text-accent-quote">QUOTE</span>
                </div>
                <div className="rounded-[6px] px-[10px] py-[4px] bg-white">
                  <span className="text-[12px] font-bold uppercase text-accent-quote">
                    {(quote.eventType || displayTitle.split(' ')[0] || 'EVENT').toUpperCase()}
                  </span>
                </div>
              </div>
              <h2 className="text-[32px] font-bold text-white uppercase leading-tight">
                {displayTitle}
              </h2>
              <div className="flex flex-col gap-[2px]">
                <div className="flex items-center gap-[8px]">
                  <span className="text-[16px] font-bold text-white uppercase">
                    {quote.clientName || 'Client TBD'}
                  </span>
                  <ArrowUpRight className="w-[18px] h-[18px] text-white" />
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end justify-between self-stretch shrink-0 gap-[4px]">
              <WeatherWidget
                eventDate={quote.eventDate}
                location={quote.venueCity || quote.venueName}
                textColor="white"
              />
              <div className="rounded-[10px] px-[10px] py-[10px]" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                <span className="text-[12px] font-bold text-white uppercase whitespace-nowrap">
                  START - {quote.eventTimeStart || '20:00'}
                </span>
              </div>
            </div>
          </div>

          {/* Year + Date */}
          <div className="flex gap-[20px]">
            <div className="flex-1 flex flex-col">
              <div className="flex items-center gap-[6px]">
                <span className="text-[12px] font-bold text-white uppercase">YEAR</span>
              </div>
              <span className="text-[42px] font-bold text-white leading-none">{year || new Date().getFullYear()}</span>
            </div>
            <div className="flex-1 flex flex-col">
              <div className="flex items-center gap-[6px]">
                <span className="text-[12px] font-bold text-white uppercase">DATE</span>
                <ArrowUpRight className="w-[14px] h-[14px] text-white" />
              </div>
              <span className="text-[42px] font-bold text-white leading-none">{monthDay}</span>
            </div>
          </div>

          {/* Mini Calendar */}
          {miniCal && (
            <div className="flex flex-col gap-[4px]">
              <div className="flex">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                  <div key={i} className="flex-1 text-center">
                    <span className="text-[10px] font-bold text-white">{d}</span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-[2px]">
                {Array.from({ length: miniCal.firstDay }).map((_, i) => (
                  <div key={`e-${i}`} className="h-[24px]" />
                ))}
                {Array.from({ length: miniCal.daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const isEventDay = day === miniCal.eventDay;
                  return (
                    <div
                      key={day}
                      className="h-[24px] flex items-center justify-center rounded-[6px]"
                      style={{ backgroundColor: isEventDay ? 'white' : 'transparent' }}
                    >
                      <span
                        className="text-[12px] font-medium"
                        style={{ color: isEventDay ? 'var(--accent-quote)' : 'white' }}
                      >
                        {day}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Client + Pricing */}
          <div className="grid grid-cols-2 gap-[20px]">
            <div className="flex flex-col gap-[8px]">
              <div className="flex flex-col">
                <div className="flex items-center gap-[6px]">
                  <span className="text-[12px] font-bold text-white uppercase">CLIENT</span>
                  <ArrowUpRight className="w-[14px] h-[14px] text-white" />
                </div>
                <span className="text-[42px] font-bold text-white leading-none truncate">
                  {clientPrimary}
                </span>
                {clientSecondary && (
                  <span className="text-[22px] font-bold text-white leading-none truncate">
                    {clientSecondary}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-[8px]">
              <div className="flex flex-col">
                <div className="flex items-center gap-[6px]">
                  <span className="text-[12px] font-bold text-white uppercase">PRICING & FINANCE</span>
                  <ArrowUpRight className="w-[14px] h-[14px] text-white" />
                </div>
                <span className="text-[42px] font-bold text-white leading-none">
                  {formatBandTotal(displayTotal, quote.currency)}
                </span>
                <span className="text-[22px] font-bold text-white leading-none">
                  DP{dp}%
                </span>
              </div>
            </div>
          </div>

          {/* Guests */}
          <div className="flex flex-col gap-[20px]">
            <div className="flex flex-col">
              <div className="flex items-center gap-[6px]">
                <span className="text-[12px] font-bold text-white uppercase">GUESTS</span>
                <ArrowUpRight className="w-[14px] h-[14px] text-white" />
              </div>
              <span className="text-[42px] font-bold text-white leading-none">
                {quote.guestCount || 'TBD'}
              </span>
            </div>
          </div>

          {/* Music Moments + Members */}
          <div className="grid grid-cols-2 gap-[20px]">
            <div className="flex flex-col gap-[8px]">
              <div className="flex flex-col">
                <div className="flex items-center gap-[6px]">
                  <span className="text-[12px] font-bold text-white uppercase">MUSIC MOMENTS</span>
                  <ArrowUpRight className="w-[14px] h-[14px] text-white" />
                </div>
                <span className="text-[42px] font-bold text-white leading-none">
                  {setsAndExtrasCount}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-[8px]">
              <div className="flex flex-col">
                <div className="flex items-center gap-[6px]">
                  <span className="text-[12px] font-bold text-white uppercase">MEMBERS</span>
                  <ArrowUpRight className="w-[14px] h-[14px] text-white" />
                </div>
                <span className="text-[42px] font-bold text-white leading-none">
                  {quote.musicians?.length || quote.musicianCount || 1}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="fixed bottom-0 left-0 right-0 rounded-t-[26px] px-[16px] pt-[20px] z-[130]"
          style={{
            backgroundColor: 'var(--accent-quote)',
            boxShadow: '0px -4px 20px rgba(0,0,0,0.15)',
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)',
          }}
        >
          <div className="flex flex-col gap-[16px] items-center">
            <div className="grid grid-cols-2 gap-[10px] w-full">
              <button
                onClick={() => canEdit && onEdit?.(quote)}
                className="rounded-[10px] py-[16px] flex items-center justify-center gap-[8px] bg-black/80 hover:bg-black transition-colors"
              >
                <Plus className="w-[18px] h-[18px] text-white" />
                <span className="text-[15px] font-bold text-white uppercase">EDIT</span>
              </button>
              <button
                onClick={() => setIsShareOpen(true)}
                className="rounded-[10px] py-[16px] flex items-center justify-center gap-[8px] bg-black hover:bg-black/90 transition-colors"
              >
                <Share2 className="w-[18px] h-[18px] text-[#D5FB46]" />
                <span className="text-[15px] font-bold text-white uppercase">SHARE QUOTE</span>
              </button>
            </div>
            <button
              onClick={() => onDelete?.(quote)}
              className="text-[12px] font-medium text-[var(--destructive)] uppercase"
            >
              DELETE THIS QUOTE
            </button>
          </div>
        </div>
      </motion.div>

      <QuoteShareModal
        isOpen={isShareOpen}
        quote={quote}
        bandId={selectedBand?.id}
        bandName={selectedBand?.name}
        onClose={() => setIsShareOpen(false)}
        onOpenBandSettings={onOpenBandSettings}
      />
    </>
  );
};
