import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Music, Clock, Users, ArrowRight, Share2, Calendar } from 'lucide-react';
import { cn } from '@/app/components/ui/utils';

interface Props {
  onClose: () => void;
}

export const RehearsalPostView: React.FC<Props> = ({ onClose }) => {
  return (
    <div 
      className="fixed inset-0 z-[200] bg-[#F7F7F5] text-black flex flex-col font-sans overflow-y-auto"
      style={{ 
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
        <div className="p-6 pb-32 max-w-md mx-auto w-full">
            
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span className="text-xs font-bold uppercase tracking-widest text-green-600">Rehearsal Completed</span>
                </div>
                <h1 className="text-3xl font-black leading-none mb-1">Weekly Band Practice</h1>
                <p className="text-sm font-bold text-stone-500">Monday, Jan 27, 2026 • 2h 15m</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 mb-8">
                <div className="bg-white p-4 rounded-2xl shadow-sm text-center">
                    <span className="block text-2xl font-black">4</span>
                    <span className="text-[9px] font-bold uppercase text-stone-400">Songs Played</span>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm text-center">
                    <span className="block text-2xl font-black text-orange-500">2</span>
                    <span className="text-[9px] font-bold uppercase text-stone-400">Need Work</span>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm text-center">
                    <span className="block text-2xl font-black text-red-500">1</span>
                    <span className="text-[9px] font-bold uppercase text-stone-400">Problem</span>
                </div>
            </div>

            {/* Feedback List */}
            <div className="space-y-4 mb-8">
                <h3 className="text-xs font-bold uppercase text-stone-400 tracking-widest">Feedback Summary</h3>
                
                <div className="bg-white p-4 rounded-2xl border-l-4 border-green-500 shadow-sm">
                    <div className="flex justify-between items-start mb-1">
                        <h4 className="font-black text-sm">Sweet Child O' Mine</h4>
                        <span className="text-[9px] font-bold uppercase bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Nailed It</span>
                    </div>
                    <p className="text-xs text-stone-600 font-medium">"Intro solo was perfect today"</p>
                </div>

                <div className="bg-white p-4 rounded-2xl border-l-4 border-orange-500 shadow-sm">
                    <div className="flex justify-between items-start mb-1">
                        <h4 className="font-black text-sm">Bohemian Rhapsody</h4>
                        <span className="text-[9px] font-bold uppercase bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">Needs Work</span>
                    </div>
                    <p className="text-xs text-stone-600 font-medium">"Timing issue in the bridge"</p>
                </div>

                <div className="bg-white p-4 rounded-2xl border-l-4 border-red-500 shadow-sm">
                    <div className="flex justify-between items-start mb-1">
                        <h4 className="font-black text-sm">Hotel California</h4>
                        <span className="text-[9px] font-bold uppercase bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Problems</span>
                    </div>
                    <p className="text-xs text-stone-600 font-medium">"Wrong key - need to transpose"</p>
                </div>
            </div>

            {/* Attendance */}
             <div className="mb-8">
                <h3 className="text-xs font-bold uppercase text-stone-400 tracking-widest mb-3">Attendance</h3>
                <div className="bg-white rounded-2xl overflow-hidden divide-y divide-stone-100 border border-stone-100">
                    {[
                        { id: '1', name: 'Gianluca', status: 'ok', time: '21:00' },
                        { id: '2', name: 'Centerbe', status: 'ok', time: '21:05' },
                        { id: '3', name: 'Marco', status: 'ok', time: '21:02' },
                        { id: '4', name: 'Luca', status: 'late', time: '21:20' },
                    ].map(m => (
                         <div key={m.id} className="p-3 flex items-center justify-between">
                             <div className="flex items-center gap-3">
                                 <CheckCircle2 className={cn("w-4 h-4", m.status === 'late' ? "text-orange-500" : "text-green-500")} />
                                 <span className="text-sm font-bold">{m.name}</span>
                             </div>
                             <div className="text-right">
                                 <div className="text-xs font-mono text-stone-500">Arrived {m.time}</div>
                                 {m.status === 'late' && <div className="text-[9px] font-bold uppercase text-orange-500">Late</div>}
                             </div>
                         </div>
                    ))}
                </div>
             </div>

            {/* Next Rehearsal Suggestion */}
            <div className="bg-[#1C1C1E] text-white p-6 rounded-[2rem] relative overflow-hidden shadow-xl">
                 <div className="relative z-10">
                     <div className="flex items-center gap-2 mb-4 opacity-60">
                         <Calendar className="w-4 h-4" />
                         <span className="text-[10px] font-bold uppercase tracking-widest">Next Session</span>
                     </div>
                     <h3 className="text-2xl font-black mb-1">Monday, Feb 3</h3>
                     <p className="text-sm font-bold text-stone-400 mb-6">Rehearsal Studios XYZ • 21:00</p>
                     
                     <div className="space-y-3 mb-6">
                         <p className="text-[10px] font-bold uppercase text-stone-500">Suggested Focus:</p>
                         <ul className="space-y-2 text-xs font-bold">
                             <li className="flex gap-2"><span className="text-[#D4FB46]">•</span> Bohemian Rhapsody (Bridge)</li>
                             <li className="flex gap-2"><span className="text-[#D4FB46]">•</span> Purple Rain (Modulation)</li>
                             <li className="flex gap-2"><span className="text-[#D4FB46]">•</span> Superstition (New!)</li>
                         </ul>
                     </div>

                     <button onClick={onClose} className="w-full py-3 bg-[#D4FB46] text-black rounded-xl font-black uppercase text-xs hover:scale-[1.02] transition-transform">
                         Schedule Next
                     </button>
                 </div>
            </div>

            <button onClick={onClose} className="w-full mt-6 py-4 text-stone-400 font-bold uppercase text-xs hover:text-black">
                Close Summary
            </button>
        </div>
    </div>
  );
};
