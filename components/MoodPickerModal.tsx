import React from 'react';
import { X, Smile, Zap, Meh, Coffee, Frown } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const moodOptions = [
  { score: 90, label: '超顺', icon: Smile, accent: 'text-emerald-700', dot: 'bg-emerald-400' },
  { score: 70, label: '不错', icon: Zap, accent: 'text-indigo-700', dot: 'bg-indigo-400' },
  { score: 50, label: '一般', icon: Meh, accent: 'text-slate-700', dot: 'bg-slate-400' },
  { score: 30, label: '疲惫', icon: Coffee, accent: 'text-amber-700', dot: 'bg-amber-400' },
  { score: 10, label: '崩溃', icon: Frown, accent: 'text-rose-700', dot: 'bg-rose-400' },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  summaryMoodScore: number;
  onSelect: (score: number) => void;
}

export const MoodPickerModal: React.FC<Props> = ({ isOpen, onClose, summaryMoodScore, onSelect }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-6 bg-slate-900/45 backdrop-blur-md animate-in fade-in pointer-events-auto"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white/70 backdrop-blur-2xl w-full max-w-md rounded-[2.5rem] p-7 shadow-[0_24px_90px_rgba(15,23,42,0.4)] relative border border-white/60">
        <button onClick={onClose} className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/30 border border-white/60 hover:bg-white/50 transition-colors flex items-center justify-center text-slate-600"><X size={18}/></button>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-white/35 border border-white/60 flex items-center justify-center text-indigo-600 shadow-sm">
            <Smile size={18} />
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">选择心情</div>
            <div className="text-lg font-bold text-slate-800">今天感觉如何？</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {moodOptions.map((m) => {
            const Icon = m.icon;
            const isSelected = m.score === summaryMoodScore;
            return (
              <button
                key={m.score}
                onClick={() => {
                  onSelect(m.score);
                  onClose();
                }}
                className={cn(
                  "rounded-3xl p-4 bg-white/30 border border-white/60 hover:bg-white/55 transition-colors flex items-center gap-3 text-left",
                  isSelected && "ring-2 ring-indigo-400/70 bg-white/60"
                )}
              >
                <div className={cn("w-12 h-12 rounded-3xl bg-white/35 border border-white/60 flex items-center justify-center shadow-sm", m.accent)}>
                  <Icon size={20} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-800">{m.label}</div>
                  <div className="text-[10px] font-mono font-bold text-slate-600 uppercase tracking-wider">分数 {m.score}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
