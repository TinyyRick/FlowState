import React from 'react';
import { X, Flame } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { StatusLog } from '../types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const stateWords = [
  { label: '元气满满', score: 100 },
  { label: '心流中', score: 95 },
  { label: '灵感爆发', score: 95 },
  { label: '兴奋', score: 90 },
  { label: '干劲十足', score: 90 },
  { label: '收尾冲刺', score: 85 },
  { label: '掌控感强', score: 85 },
  { label: '在状态', score: 80 },
  { label: '满足', score: 75 },
  { label: '期待', score: 75 },
  { label: '平静', score: 70 },
  { label: '刚刚好', score: 70 },
  { label: '放松', score: 65 },
  { label: '偷得浮生', score: 65 },
  { label: '摸鱼中', score: 60 },
  { label: '放空中', score: 55 },
  { label: '一般', score: 50 },
  { label: '平淡', score: 50 },
  { label: '过渡中', score: 50 },
  { label: '说不上来', score: 45 },
  { label: '待机模式', score: 45 },
  { label: '拖延中', score: 40 },
  { label: '昏沉', score: 40 },
  { label: '空虚', score: 35 },
  { label: '麻木', score: 35 },
  { label: '无力感', score: 30 },
  { label: '勉强撑着', score: 30 },
  { label: '疲惫', score: 25 },
  { label: '沮丧', score: 25 },
  { label: '紧绷', score: 20 },
  { label: '卡壳了', score: 20 },
  { label: '纠结', score: 20 },
  { label: '焦虑', score: 15 },
  { label: '烦躁', score: 15 },
  { label: '易燃易爆', score: 10 },
  { label: '赶Deadline', score: 10 },
  { label: '崩溃边缘', score: 0 },
];

const getStateWordDot = (score: number) => {
  if (score >= 90) return 'bg-emerald-400';
  if (score >= 70) return 'bg-teal-400';
  if (score >= 50) return 'bg-indigo-400';
  if (score >= 30) return 'bg-sky-400';
  if (score >= 10) return 'bg-amber-400';
  return 'bg-red-500';
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (log: Omit<StatusLog, 'id'>) => void;
}

export const StateWordPickerModal: React.FC<Props> = ({ isOpen, onClose, onSelect }) => {
  if (!isOpen) return null;

  const sorted = [...stateWords].sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, 'zh'));

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-6 bg-slate-900/45 backdrop-blur-md animate-in fade-in pointer-events-auto"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white/70 backdrop-blur-2xl w-full max-w-lg rounded-[2.5rem] p-7 shadow-[0_24px_90px_rgba(15,23,42,0.4)] relative border border-white/60 max-h-[80vh] flex flex-col">
        <button onClick={onClose} className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/30 border border-white/60 hover:bg-white/50 transition-colors flex items-center justify-center text-slate-600"><X size={18}/></button>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-white/35 border border-white/60 flex items-center justify-center text-orange-600 shadow-sm">
            <Flame size={18} />
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">记录状态</div>
            <div className="text-lg font-bold text-slate-800">此刻的你是？</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
          <div className="grid grid-cols-2 gap-2">
            {sorted.map((w) => (
              <button
                key={w.label}
                onClick={() => {
                  onSelect({ timestamp: Date.now(), statusId: w.label, score: w.score });
                  onClose();
                }}
                className="p-3 rounded-2xl bg-white/30 border border-white/60 hover:bg-white/55 transition-colors text-left flex items-center gap-3"
              >
                <div className={cn("w-2.5 h-2.5 rounded-full", getStateWordDot(w.score))} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-slate-800 truncate">{w.label}</div>
                </div>
                <div className="text-[10px] font-mono font-bold text-slate-600 tabular-nums">
                  {w.score}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
