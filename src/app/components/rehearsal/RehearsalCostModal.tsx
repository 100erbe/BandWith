import React, { useState } from 'react';
import { RehearsalModalWrapper } from './RehearsalModalWrapper';
import { DollarSign, CheckCircle2, Users } from 'lucide-react';
import { RehearsalState, RehearsalMember } from './types';
import { cn } from '@/app/components/ui/utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  data: RehearsalState;
  onUpdate: (updates: Partial<RehearsalState>) => void;
}

export const RehearsalCostModal: React.FC<Props> = ({ isOpen, onClose, data, onUpdate }) => {
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

  return (
    <RehearsalModalWrapper isOpen={isOpen} onClose={onClose} title="Room Cost & Split" icon={DollarSign}>
        <div className="space-y-8">
            
            {/* Total Cost Input */}
            <div>
               <label className="text-xs font-bold uppercase tracking-widest text-black/40 mb-2 block">Total Room Cost</label>
               <div className="flex items-center gap-2 border-b-2 border-black/10 py-2">
                  <span className="text-3xl font-black text-black">€</span>
                  <input 
                    type="number" 
                    value={totalCost}
                    onChange={e => setTotalCost(e.target.value)}
                    className="w-full bg-transparent text-3xl font-black text-black focus:outline-none"
                    placeholder="0"
                  />
               </div>
            </div>

            {/* Split Method */}
            <div>
               <label className="text-xs font-bold uppercase tracking-widest text-black/40 mb-3 block">Split Method</label>
               <div className="grid grid-cols-3 gap-3">
                  <button 
                    onClick={() => setSplitMethod('equal')}
                    className={cn(
                        "p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all",
                        splitMethod === 'equal' ? "bg-black border-black text-[#D4FB46]" : "bg-transparent border-black/10 text-black/40 hover:border-black/30"
                    )}
                  >
                     <Users className="w-6 h-6" />
                     <span className="text-[10px] font-bold uppercase">Split Equally</span>
                  </button>
                  <button 
                    onClick={() => setSplitMethod('custom')}
                    className={cn(
                        "p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all",
                        splitMethod === 'custom' ? "bg-black border-black text-[#D4FB46]" : "bg-transparent border-black/10 text-black/40 hover:border-black/30"
                    )}
                  >
                     <CheckCircle2 className="w-6 h-6" />
                     <span className="text-[10px] font-bold uppercase">Custom Split</span>
                  </button>
                  <button 
                    onClick={() => setSplitMethod('admin')}
                    className={cn(
                        "p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all",
                        splitMethod === 'admin' ? "bg-black border-black text-[#D4FB46]" : "bg-transparent border-black/10 text-black/40 hover:border-black/30"
                    )}
                  >
                     <DollarSign className="w-6 h-6" />
                     <span className="text-[10px] font-bold uppercase">Admin / Band</span>
                  </button>
               </div>
            </div>

            {/* Breakdown */}
            <div className="bg-black/5 rounded-2xl p-4">
               <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-3 block">Breakdown</label>
               <div className="space-y-3">
                  {data.members.map(member => (
                     <div key={member.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-black text-white text-[10px] font-bold flex items-center justify-center">
                              {member.initials}
                           </div>
                           <span className="text-sm font-bold text-black">{member.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                           <span className="text-sm font-bold text-black/40">€</span>
                           {splitMethod === 'custom' ? (
                              <input 
                                type="number"
                                value={customFees[member.id] || ''}
                                onChange={e => handleCustomFeeChange(member.id, e.target.value)}
                                className="w-16 bg-transparent border-b border-black/20 text-right font-bold focus:outline-none"
                              />
                           ) : (
                              <span className="font-black text-black">
                                 {splitMethod === 'equal' 
                                    ? (parseFloat(totalCost || '0') / data.members.length).toFixed(0) 
                                    : '0'}
                              </span>
                           )}
                        </div>
                     </div>
                  ))}
               </div>
            </div>

            <button 
               onClick={handleApply}
               className="w-full py-4 bg-black text-[#D4FB46] rounded-2xl font-black text-sm uppercase tracking-wider hover:scale-[1.02] transition-transform shadow-lg"
            >
               Save & Apply
            </button>
        </div>
    </RehearsalModalWrapper>
  );
};
