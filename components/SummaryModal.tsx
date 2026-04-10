import React from 'react';
import { Moon, MessageSquare } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  summaryMoodScore: number;
  summaryNote: string;
  setSummaryNote: (note: string) => void;
  onConfirm: () => void;
  onOpenMoodPicker: () => void;
  selectedMood: any;
}

export const SummaryModal: React.FC<Props> = ({ 
  isOpen, onClose, summaryMoodScore, summaryNote, setSummaryNote, onConfirm, onOpenMoodPicker, selectedMood 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-6 bg-slate-900/45 backdrop-blur-md animate-in fade-in pointer-events-auto">
      <div className="bg-white/70 backdrop-blur-2xl w-full max-w-md rounded-[2.5rem] p-8 shadow-[0_24px_90px_rgba(15,23,42,0.4)] relative border border-white/60">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-white/35 border border-white/60 text-indigo-600 mb-4 shadow-sm">
            <Moon size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">辛苦了，下班总结</h2>
          <p className="text-slate-600 text-sm mt-1">记录下今天的心情和感悟吧</p>
        </div>

        <div className="space-y-8">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">今日心情</span>
              <button
                onClick={onOpenMoodPicker}
                className="h-9 px-3 rounded-full bg-white/30 border border-white/60 hover:bg-white/55 transition-colors flex items-center gap-2 text-slate-800 font-bold"
              >
                <div className={cn("w-2 h-2 rounded-full", selectedMood.dot)} />
                <span className="text-xs">{selectedMood.label}</span>
                <span className="text-[10px] font-mono font-bold text-slate-600">({summaryMoodScore})</span>
              </button>
            </div>
            <div className="text-xs text-slate-600">
              点击右侧按钮选择心情分数
            </div>
          </div>

          {/* Note Input */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">今日感悟</label>
            <textarea 
              value={summaryNote}
              onChange={(e) => setSummaryNote(e.target.value)}
              placeholder="今天有什么想记录的吗？"
              className="w-full h-32 p-4 bg-white/35 border border-white/60 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none text-slate-800 text-sm placeholder:text-slate-500"
            />
          </div>

          <div className="flex gap-3">
            <button 
              onClick={onClose}
              className="flex-1 py-4 rounded-2xl bg-white/30 border border-white/60 text-slate-700 font-bold hover:bg-white/55 transition-colors"
            >
              取消
            </button>
            <button 
              onClick={onConfirm}
              className="flex-[2] py-4 rounded-2xl bg-indigo-600/90 border border-indigo-400/60 text-white font-bold shadow-[0_12px_36px_rgba(99,102,241,0.35)] hover:bg-indigo-700 transition-all active:scale-95"
            >
              确认下班
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
