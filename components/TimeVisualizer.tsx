import React, { useEffect, useState } from 'react';

interface TimeVisualizerProps {
  totalMinutes: number;
  elapsedMinutes: number;
  label: string;
}

export const TimeVisualizer: React.FC<TimeVisualizerProps> = ({ totalMinutes, elapsedMinutes, label }) => {
  const percentage = Math.min(100, (elapsedMinutes / totalMinutes) * 100);
  
  // Color shifts based on urgency
  const getColor = () => {
    if (percentage < 50) return 'bg-emerald-400';
    if (percentage < 80) return 'bg-amber-400';
    return 'bg-rose-500';
  };

  return (
    <div className="w-full flex flex-col gap-2">
      <div className="flex justify-between text-xs font-medium text-secondary uppercase tracking-wider">
        <span>{label}</span>
        <span>{Math.round(totalMinutes - elapsedMinutes)}m left</span>
      </div>
      <div className="h-4 w-full bg-zinc-100 rounded-full overflow-hidden relative shadow-inner">
        {/* Background grid for "Time Blocks" feel */}
        <div className="absolute inset-0 grid grid-cols-12 opacity-20 pointer-events-none">
           {Array.from({ length: 12 }).map((_, i) => (
             <div key={i} className="border-r border-zinc-400 h-full" />
           ))}
        </div>
        
        {/* The Fluid Bar */}
        <div 
          className={`h-full ${getColor()} transition-all duration-1000 ease-linear`}
          style={{ width: `${percentage}%` }}
        />
        
        {/* Pulse effect if urgent */}
        {percentage > 80 && (
          <div className="absolute inset-0 bg-rose-500 animate-ping opacity-20" style={{ width: `${percentage}%` }} />
        )}
      </div>
    </div>
  );
};
