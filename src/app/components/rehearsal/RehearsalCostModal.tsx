import React, { useState } from 'react';
import { Check } from '@/app/components/icons';
import { RehearsalState } from './types';
import { BwSheet, PillButton } from '@/app/components/bw';
import { cn } from '@/app/components/ui/utils';
import { useBand } from '@/lib/BandContext';
import { getActiveSymbol as sym, useCurrency } from '@/lib/currency';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  data: RehearsalState;
  onUpdate: (updates: Partial<RehearsalState>) => void;
}

export const RehearsalCostModal: React.FC<Props> = ({ isOpen, onClose, data, onUpdate }) => {
  useCurrency(); // re-render money labels when the band currency changes
  const { isAdmin } = useBand();
  const [totalCost, setTotalCost] = useState(data.totalCost);
  const [splitMethod, setSplitMethod] = useState(data.splitMethod);
  const [customFees, setCustomFees] = useState<Record<string, string>>(
    data.members.reduce((acc, m) => ({ ...acc, [m.id]: m.fee }), {})
  );

  const handleApply = () => {
    let newMembers = [...data.members];
    
    if (splitMethod === 'equal') {
      const perPerson = (parseFloat(totalCost) / newMembers.length).toFixed(0);
      newMembers = newMembers.map(m => ({ ...m, fee: perPerson }));
    } else if (splitMethod === 'custom') {
      newMembers = newMembers.map(m => ({ ...m, fee: customFees[m.id] || '0' }));
    } else if (splitMethod === 'admin') {
       // Assuming user is admin, they pay all? Or band pays? Let's assume admin pays all for now or handled elsewhere
       // Usually 'Band' pays means 0 for members.
       newMembers = newMembers.map(m => ({ ...m, fee: '0' }));
    }

    onUpdate({ 
      totalCost, 
      splitMethod, 
      members: newMembers,
      showCost: true 
    });
    onClose();
  };

  const handleCustomFeeChange = (id: string, val: string) => {
    setCustomFees(prev => ({ ...prev, [id]: val }));
  };

  const memberCount = Math.max(data.members.length, 1);
  const equalShare = (parseFloat(totalCost || '0') / memberCount).toFixed(0);

  return (
    <BwSheet
      open={isOpen}
      onClose={onClose}
      overline="Studio cost"
      title="Room cost & split"
      zIndex={110}
      footer={
        <div className="dark">
          <PillButton onClick={handleApply} icon={<Check className="w-[18px] h-[18px]" />}>
            Save &amp; apply
          </PillButton>
        </div>
      }
    >
      <div className="dark flex flex-col gap-5">
        {/* Total cost */}
        <label className="flex flex-col gap-2 p-4 rounded-[24px] bg-white/[0.08]">
          <span className="bw-label-sm text-sheet-foreground/70">Total room cost</span>
          <span className="flex items-baseline gap-2">
            <span className="bw-value-lg">{sym()}</span>
            <input
              type="number"
              value={totalCost}
              onChange={(e) => setTotalCost(e.target.value)}
              className="w-full min-w-0 bg-transparent outline-none bw-value-lg text-sheet-foreground placeholder:text-sheet-foreground/30"
              placeholder="0"
            />
          </span>
        </label>

        {/* Split method */}
        {isAdmin && (
          <fieldset className="flex flex-col gap-2">
            <legend className="bw-label-sm text-sheet-foreground/70 mb-2">Split method</legend>
            <div role="tablist" aria-label="Split method" className="flex p-1 gap-1 rounded-full bg-white/[0.08]">
              {([
                ['equal', 'Equally'],
                ['custom', 'Custom'],
                ['admin', 'Band pays'],
              ] as const).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={splitMethod === m}
                  onClick={() => setSplitMethod(m)}
                  className={cn(
                    'flex-1 h-9 px-2 rounded-full bw-button-sm transition-colors',
                    splitMethod === m ? 'bg-accent text-accent-foreground' : 'text-sheet-foreground/70'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {/* Breakdown */}
        {isAdmin && (
          <section className="flex flex-col gap-2">
            <h3 className="bw-label-sm text-sheet-foreground/70">Breakdown</h3>
            {data.members.map((member) => (
              <div key={member.id} className="flex items-center gap-3 px-4 py-3 rounded-[16px] bg-white/[0.08]">
                <span className="w-8 h-8 rounded-full border border-sheet-foreground/40 bw-label-xs flex items-center justify-center shrink-0">
                  {member.initials}
                </span>
                <span className="flex-1 min-w-0 bw-body-lg truncate">{member.name}</span>
                <span className="flex items-baseline gap-1 shrink-0">
                  <span className="bw-body-sm text-sheet-foreground/60">{sym()}</span>
                  {splitMethod === 'custom' ? (
                    <input
                      type="number"
                      aria-label={`Fee for ${member.name}`}
                      value={customFees[member.id] || ''}
                      onChange={(e) => handleCustomFeeChange(member.id, e.target.value)}
                      className="w-16 bg-transparent border-b border-sheet-foreground/40 focus:border-sheet-foreground text-right bw-label-md outline-none"
                    />
                  ) : (
                    <span className="bw-label-md">{splitMethod === 'equal' ? equalShare : '0'}</span>
                  )}
                </span>
              </div>
            ))}
          </section>
        )}
      </div>
    </BwSheet>
  );
};
