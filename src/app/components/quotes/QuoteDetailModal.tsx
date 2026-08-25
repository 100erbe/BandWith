import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, ArrowUpRight, Plus } from 'lucide-react';
import { Quote } from '@/app/data/quotes';
import { WeatherWidget } from '@/app/components/ui/WeatherWidget';

interface QuoteDetailModalProps {
  quote: Quote;
  onClose: () => void;
  onEdit?: (quote: Quote) => void;
  onSend?: (quote: Quote) => void;
  onDuplicate?: (quote: Quote) => void;
  onDelete?: (quote: Quote) => void;
}

const formatBandTotal = (total: number): string => {
  if (total >= 1000) return `€${(total / 1000).toFixed(total % 1000 === 0 ? 0 : 1)}K`;
  return `€${total}`;
};

export const QuoteDetailModal: React.FC<QuoteDetailModalProps> = ({
  quote,
  onClose,
  onEdit,
  onDelete,
}) => {
  const canEdit = quote.status === 'DRAFT';
  const eventDate = quote.eventDate ? new Date(quote.eventDate) : null;
  const year = eventDate ? eventDate.getFullYear() : '';
  const monthDay = eventDate
    ? `${eventDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()} ${eventDate.getDate()}`
    : 'TBD';

  const miniCal = eventDate ? (() => {
    const y = eventDate.getFullYear();
    const m = eventDate.getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const firstDay = (new Date(y, m, 1).getDay() + 6) % 7;
    return { daysInMonth, firstDay, eventDay: eventDate.getDate() };
  })() : null;

  const dp = (quote.discount ?? 0) > 0 ? Math.round(((quote.discount ?? 0) / (quote.total || 1)) * 100) : 30;

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
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="fixed inset-0 z-[120] flex flex-col overflow-y-auto"
        style={{ backgroundColor: 'var(--accent-quote)' }}
      >
        <div className="flex-1 flex flex-col gap-10 px-4 pt-16 pb-52">
          {/* Header */}
          <div className="flex items-center gap-5">
            <button
              onClick={onClose}
              className="w-12 h-12 rounded-full bg-muted flex items-center justify-center border-2 border-border"
            >
              <ArrowLeft className="w-6 h-6 text-accent-foreground" />
            </button>
            <span className="text-3xl font-bold text-accent-foreground uppercase">QUOTE</span>
          </div>

          {/* Event Info */}
          <div className="flex gap-5 items-start">
            <div className="flex-1 flex flex-col gap-1 min-w-0">
              <div className="flex gap-1 items-center flex-wrap">
                <div className="rounded-full px-2.5 py-1 bg-card">
                  <span className="text-xs font-bold uppercase text-accent-quote">QUOTE</span>
                </div>
                <div className="rounded-full px-2.5 py-1 bg-card">
                  <span className="text-xs font-bold uppercase text-accent-quote">
                    {quote.eventTitle?.split(' ')[0]?.toUpperCase() || 'EVENT'}
                  </span>
                </div>
              </div>
              <h2 className="text-3xl font-bold text-accent-foreground uppercase leading-tight">
                {quote.eventTitle || 'UNTITLED'}
              </h2>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-accent-foreground uppercase">
                    {quote.clientName || 'TBD'}
                  </span>
                  <ArrowUpRight className="w-4.5 h-4.5 text-accent-foreground" />
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end justify-between self-stretch shrink-0 gap-1">
              <WeatherWidget
                eventDate={quote.eventDate}
                location={quote.clientName}
                textColor="white"
              />
              <div className="rounded-xl px-2.5 py-2.5" style={{ backgroundColor: 'var(--dot-inactive)' }}>
                <span className="text-xs font-bold text-accent-foreground uppercase whitespace-nowrap">
                  START - 3:30 PM
                </span>
              </div>
            </div>
          </div>

          {/* Year + Date */}
          <div className="flex gap-5">
            <div className="flex-1 flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-accent-foreground uppercase">YEAR</span>
              </div>
              <span className="text-4xl font-bold text-accent-foreground leading-tight">{year || '2028'}</span>
            </div>
            <div className="flex-1 flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-accent-foreground uppercase">DATE</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-accent-foreground" />
              </div>
              <span className="text-4xl font-bold text-accent-foreground leading-tight">{monthDay}</span>
            </div>
          </div>

          {/* Mini Calendar */}
          {miniCal && (
            <div className="flex flex-col gap-1">
              <div className="flex">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                  <div key={i} className="flex-1 text-center">
                    <span className="text-xs font-bold text-accent-foreground">{d}</span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {Array.from({ length: miniCal.firstDay }).map((_, i) => (
                  <div key={`e-${i}`} className="h-6" />
                ))}
                {Array.from({ length: miniCal.daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const isEventDay = day === miniCal.eventDay;
                  return (
                    <div
                      key={day}
                      className="h-6 flex items-center justify-center rounded-full"
                      style={{ backgroundColor: isEventDay ? 'white' : 'transparent' }}
                    >
                      <span
                        className="text-xs font-medium"
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
          <div className="grid grid-cols-2 gap-5">
            <div className="flex flex-col gap-2">
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-accent-foreground uppercase">CLIENT</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-accent-foreground" />
                </div>
                <span className="text-4xl font-bold text-accent-foreground leading-tight">
                  {(quote.clientName || 'MIA').split(' ')[0]?.toUpperCase()}
                </span>
                <span className="text-xl font-bold text-accent-foreground leading-tight">
                  {(quote.clientName || 'MIA CALIFA').split(' ').slice(1).join(' ')?.toUpperCase() || 'CALIFA'}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-accent-foreground uppercase">PRICING & FINANCE</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-accent-foreground" />
                </div>
                <span className="text-4xl font-bold text-accent-foreground leading-tight">
                  {formatBandTotal(quote.total)}
                </span>
                <span className="text-xl font-bold text-accent-foreground leading-tight">
                  DP{dp}%
                </span>
              </div>
            </div>
          </div>

          {/* Guests */}
          <div className="flex flex-col gap-5">
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-accent-foreground uppercase">GUESTS</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-accent-foreground" />
              </div>
              <span className="text-4xl font-bold text-accent-foreground leading-tight">150</span>
            </div>
          </div>

          {/* Music Moments + Members */}
          <div className="grid grid-cols-2 gap-5">
            <div className="flex flex-col gap-2">
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-accent-foreground uppercase">MUSIC MOMENTS</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-accent-foreground" />
                </div>
                <span className="text-4xl font-bold text-accent-foreground leading-tight">
                  {quote.lineItems?.length || 3}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-accent-foreground uppercase">MEMBERS</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-accent-foreground" />
                </div>
                <span className="text-4xl font-bold text-accent-foreground leading-tight">8</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="fixed bottom-0 left-0 right-0 rounded-t-3xl px-4 pt-5 pb-8 z-[130]"
          style={{ backgroundColor: 'var(--accent-quote)', boxShadow: '0px -4px 20px var(--dot-inactive)' }}
        >
          <div className="flex flex-col gap-5 items-center">
            <div className="grid grid-cols-2 gap-2.5 w-full">
              <button
                onClick={() => canEdit && onEdit?.(quote)}
                className="rounded-xl py-4 flex items-center justify-center gap-2 bg-surface-inverse"
              >
                <Plus className="w-4.5 h-4.5 text-accent-foreground" />
                <span className="text-base font-bold text-accent-foreground uppercase">EDIT</span>
              </button>
              <button className="rounded-xl py-4 flex items-center justify-center gap-2 bg-surface-inverse">
                <Plus className="w-4.5 h-4.5 text-accent-foreground" />
                <span className="text-base font-bold text-accent-foreground uppercase">CONVERT</span>
              </button>
            </div>
            <button
              onClick={() => onDelete?.(quote)}
              className="text-xs font-medium text-destructive uppercase"
            >
              DELETE THIS QUOTE
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
};
