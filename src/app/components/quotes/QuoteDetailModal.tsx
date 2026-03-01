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

const QDotGrid: React.FC<{
  filled: number;
  total: number;
  cols?: number;
  rows?: number;
}> = ({ filled, total, cols = 6, rows = 2 }) => {
  const capped = Math.min(filled, total);
  return (
    <div
      className="grid w-full gap-[4px]"
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        height: rows * 15 + (rows - 1) * 4,
      }}
    >
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="rounded-[10px]"
          style={{ backgroundColor: i < capped ? 'white' : 'rgba(255,255,255,0.2)' }}
        />
      ))}
    </div>
  );
};

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

  const dp = quote.discount > 0 ? Math.round((quote.discount / quote.total) * 100) : 30;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[110]"
        style={{ backgroundColor: '#9A8878' }}
      />

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="fixed inset-0 z-[120] flex flex-col overflow-y-auto"
        style={{ backgroundColor: '#9A8878' }}
      >
        <div className="flex-1 flex flex-col gap-[40px] px-[16px] pt-[62px] pb-[200px]">
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
                  <span className="text-[12px] font-bold uppercase text-[#9A8878]">QUOTE</span>
                </div>
                <div className="rounded-[6px] px-[10px] py-[4px] bg-white">
                  <span className="text-[12px] font-bold uppercase text-[#9A8878]">
                    {quote.eventTitle?.split(' ')[0]?.toUpperCase() || 'EVENT'}
                  </span>
                </div>
              </div>
              <h2 className="text-[32px] font-bold text-white uppercase leading-tight">
                {quote.eventTitle || 'UNTITLED'}
              </h2>
              <div className="flex flex-col gap-[2px]">
                <div className="flex items-center gap-[8px]">
                  <span className="text-[16px] font-bold text-white uppercase">
                    {quote.clientName || 'TBD'}
                  </span>
                  <ArrowUpRight className="w-[18px] h-[18px] text-white" />
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end justify-between self-stretch shrink-0 gap-[4px]">
              <WeatherWidget
                eventDate={quote.eventDate}
                location={quote.clientName}
                textColor="white"
              />
              <div className="rounded-[10px] px-[10px] py-[10px]" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                <span className="text-[12px] font-bold text-white uppercase whitespace-nowrap">
                  START - 3:30 PM
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
              <span className="text-[42px] font-bold text-white leading-none">{year || '2028'}</span>
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
                        style={{ color: isEventDay ? '#9A8878' : 'white' }}
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
                <span className="text-[42px] font-bold text-white leading-none">
                  {(quote.clientName || 'MIA').split(' ')[0]?.toUpperCase()}
                </span>
                <span className="text-[22px] font-bold text-white leading-none">
                  {(quote.clientName || 'MIA CALIFA').split(' ').slice(1).join(' ')?.toUpperCase() || 'CALIFA'}
                </span>
              </div>
              <QDotGrid filled={6} total={40} cols={8} rows={5} />
            </div>

            <div className="flex flex-col gap-[8px]">
              <div className="flex flex-col">
                <div className="flex items-center gap-[6px]">
                  <span className="text-[12px] font-bold text-white uppercase">PRICING & FINANCE</span>
                  <ArrowUpRight className="w-[14px] h-[14px] text-white" />
                </div>
                <span className="text-[42px] font-bold text-white leading-none">
                  {formatBandTotal(quote.total)}
                </span>
                <span className="text-[22px] font-bold text-white leading-none">
                  DP{dp}%
                </span>
              </div>
              <QDotGrid filled={8} total={40} cols={8} rows={5} />
            </div>
          </div>

          {/* Guests */}
          <div className="flex flex-col gap-[20px]">
            <div className="flex flex-col">
              <div className="flex items-center gap-[6px]">
                <span className="text-[12px] font-bold text-white uppercase">GUESTS</span>
                <ArrowUpRight className="w-[14px] h-[14px] text-white" />
              </div>
              <span className="text-[42px] font-bold text-white leading-none">150</span>
            </div>
            <QDotGrid filled={150} total={200} cols={20} rows={10} />
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
                  {quote.lineItems?.length || 3}
                </span>
              </div>
              <QDotGrid filled={quote.lineItems?.length || 3} total={12} cols={6} rows={2} />
            </div>

            <div className="flex flex-col gap-[8px]">
              <div className="flex flex-col">
                <div className="flex items-center gap-[6px]">
                  <span className="text-[12px] font-bold text-white uppercase">MEMBERS</span>
                  <ArrowUpRight className="w-[14px] h-[14px] text-white" />
                </div>
                <span className="text-[42px] font-bold text-white leading-none">8</span>
              </div>
              <QDotGrid filled={8} total={12} cols={6} rows={2} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="fixed bottom-0 left-0 right-0 rounded-t-[26px] px-[16px] pt-[20px] pb-[30px] z-[130]"
          style={{ backgroundColor: '#9A8878', boxShadow: '0px -4px 20px rgba(0,0,0,0.15)' }}
        >
          <div className="flex flex-col gap-[20px] items-center">
            <div className="grid grid-cols-2 gap-[10px] w-full">
              <button
                onClick={() => canEdit && onEdit?.(quote)}
                className="rounded-[10px] py-[16px] flex items-center justify-center gap-[8px] bg-black"
              >
                <Plus className="w-[18px] h-[18px] text-white" />
                <span className="text-[16px] font-bold text-white uppercase">EDIT</span>
              </button>
              <button className="rounded-[10px] py-[16px] flex items-center justify-center gap-[8px] bg-black">
                <Plus className="w-[18px] h-[18px] text-white" />
                <span className="text-[16px] font-bold text-white uppercase">CONVERT</span>
              </button>
            </div>
            <button
              onClick={() => onDelete?.(quote)}
              className="text-[12px] font-medium text-[#FF7C7C] uppercase"
            >
              DELETE THIS QUOTE
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
};
