import React, { useState, useRef, useEffect } from 'react';
import { StickyNote, StickyType, NoteStatus, ColorLabel } from '../types';
import { X, Play, Pause, Square, AlertOctagon, Lightbulb, MousePointer2, Clock, Check, Plus, Loader2, CornerDownLeft, ArrowRight, Sparkles, BrainCircuit, Tag, Edit2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ActiveTaskTimer = React.memo(
  ({ timerRef, status }: { timerRef?: React.MutableRefObject<number>; status?: 'active' | 'paused' | 'completed' }) => {
    const [value, setValue] = useState(() => timerRef?.current ?? 0);

    useEffect(() => {
      setValue(timerRef?.current ?? 0);
    }, [timerRef, status]);

    useEffect(() => {
      if (!timerRef) return;
      if (status !== 'active') return;
      const interval = setInterval(() => {
        setValue(timerRef.current);
      }, 1000);
      return () => clearInterval(interval);
    }, [timerRef, status]);

    return <>{new Date(value * 1000).toISOString().substr(14, 5)}</>;
  }
);

interface SpatialBoardProps {
  notes: StickyNote[];
  colorLabels: ColorLabel[];
  onUpdateNote: (note: StickyNote) => void;
  onDeleteNote: (id: string) => void;
  onStartTask: (note: StickyNote) => void;
  onBreakdownTask: (note: StickyNote) => void;
  onReviewTask: (note: StickyNote) => void;
  onCreateNote: (type: StickyType, x: number, y: number) => void;
  onCommitDraft: (note: StickyNote) => void; 
  onSetBudget: (note: StickyNote, minutes: number) => void;
  onArchiveIdea: (note: StickyNote) => void;
  onDragChange: (isDraggingIdea: boolean) => void;
  onArchiveTask?: (note: StickyNote) => void;
  onDragTaskChange?: (isDraggingTask: boolean) => void;
  onUpdateColorLabel: (id: string, name: string) => void;
  onInteractableChange?: (interactable: boolean) => void;
  activeTaskNoteId?: string | null;
  activeTaskStatus?: 'active' | 'paused' | 'completed';
  activeTimerRef?: React.MutableRefObject<number>;
  onPauseTask?: () => void;
  onCompleteTask?: () => void;
  onStopTask?: () => void;
  className?: string;
  disabled?: boolean;
}

export const SpatialBoard: React.FC<SpatialBoardProps> = ({ 
  notes, colorLabels, onUpdateNote, onDeleteNote, onStartTask, onBreakdownTask, onReviewTask, onCreateNote, onCommitDraft, onSetBudget, 
  onArchiveIdea, onDragChange, onArchiveTask, onDragTaskChange, onUpdateColorLabel, onInteractableChange,
  activeTaskNoteId, activeTaskStatus, activeTimerRef, onPauseTask, onCompleteTask, onStopTask,
  className, disabled 
}) => {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [showColorPicker, setShowColorPicker] = useState<string | null>(null);
  const [resizing, setResizing] = useState<{
    id: string;
    dir: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    ratio: number;
  } | null>(null);
  
  // Track mouse position in viewport coordinates for Fixed positioning
  const [mousePos, setMousePos] = useState<{x: number, y: number} | null>(null);
  
  // Ref for the board container to calculate relative coordinates on drop
  const boardRef = useRef<HTMLDivElement>(null);
  
  // Ref to store the offset from the mouse to the top-left of the dragged note
  const dragOffsetRef = useRef<{ x: number, y: number }>({ x: 0, y: 0 });

  const getSidebarRect = () => {
    const el = document.querySelector('[data-electron-widget="sidebar"]') as HTMLElement | null;
    return el ? el.getBoundingClientRect() : null;
  };

  const isPointInRect = (x: number, y: number, rect: DOMRect) => {
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  };

  const getMaxZIndex = () => {
    let max = 0;
    for (const n of notes) {
      const z = n.zIndex ?? 0;
      if (z > max) max = z;
    }
    return max;
  };

  const bringToFront = (note: StickyNote) => {
    if (disabled) return;
    const maxZ = getMaxZIndex();
    const current = note.zIndex ?? 0;
    if (current > maxZ) return;
    if (current === maxZ) {
      const hasAnotherAtTop = notes.some(n => n.id !== note.id && (n.zIndex ?? 0) === maxZ);
      if (!hasAnotherAtTop) return;
    }
    onUpdateNote({ ...note, zIndex: maxZ + 1 });
  };

  const startResize = (e: React.MouseEvent, note: StickyNote, dir: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw') => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    bringToFront(note);

    const startWidth = note.width ?? 224;
    const startHeight = note.height ?? 192;
    const ratio = startWidth / startHeight;

    setResizing({
      id: note.id,
      dir,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: note.x,
      startY: note.y,
      startWidth,
      startHeight,
      ratio,
    });
    onInteractableChange?.(true);
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (draggingId && !disabled) {
        e.preventDefault();
        setMousePos({ x: e.clientX, y: e.clientY });
      }
    };

    const handleMouseUpWithEvent = (e: MouseEvent) => {
       if (draggingId && boardRef.current) {
         const note = notes.find(n => n.id === draggingId);
         const { x: offsetX, y: offsetY } = dragOffsetRef.current;
         const boardRect = boardRef.current.getBoundingClientRect();
         
         // Calculate Final Relative Position
         const finalX = e.clientX - offsetX - boardRect.left;
         const finalY = e.clientY - offsetY - boardRect.top;

         if (note) {
            // Check for Archive Drop (Right Sidebar Area)
            const sidebarRect = getSidebarRect();
            if (sidebarRect && isPointInRect(e.clientX, e.clientY, sidebarRect)) {
                if (note.type === StickyType.IDEA) {
                  onArchiveIdea(note);
                } else if (note.type === StickyType.TASK) {
                  onArchiveTask?.(note);
                } else {
                  onUpdateNote({
                     ...note,
                     x: finalX,
                     y: finalY
                  });
                }
            } else {
                onUpdateNote({
                   ...note,
                   x: finalX,
                   y: finalY
                });
            }
         }
         
         // Cleanup
         setDraggingId(null);
         setMousePos(null);
         onDragChange(false);
         onDragTaskChange?.(false);
         
         // Safety Reset: Drag ended. Assume we want to pass-through unless mouse is moved.
         // This prevents the "stuck in capture mode" bug if you drag fast and drop outside the note.
         // Since 'forward: true' is set, if we are still hovering the note, a slight mouse move will re-trigger onMouseEnter.
         onInteractableChange?.(false);
       }
    }

    if (draggingId) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleMouseUpWithEvent);
      // Force interactive during drag to prevent losing the mouse context
      onInteractableChange?.(true);
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleMouseUpWithEvent);
    };
  }, [draggingId, notes, disabled, onUpdateNote, onArchiveIdea, onDragChange]);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!resizing || disabled) return;
      e.preventDefault();

      const note = notes.find(n => n.id === resizing.id);
      if (!note) return;

      const dx = e.clientX - resizing.startClientX;
      const dy = e.clientY - resizing.startClientY;
      const baseMinWidth = 200;
      const baseMinHeight = 170;
      const minWidth = Math.max(baseMinWidth, baseMinHeight * resizing.ratio);
      const minHeight = minWidth / resizing.ratio;

      let nextX = resizing.startX;
      let nextY = resizing.startY;
      let nextW = resizing.startWidth;
      let nextH = resizing.startHeight;

      const widthFromDx = (dir: string) => {
        if (dir.includes('e')) return resizing.startWidth + dx;
        if (dir.includes('w')) return resizing.startWidth - dx;
        return resizing.startWidth;
      };

      const heightFromDy = (dir: string) => {
        if (dir.includes('s')) return resizing.startHeight + dy;
        if (dir.includes('n')) return resizing.startHeight - dy;
        return resizing.startHeight;
      };

      const isCorner = resizing.dir.length === 2;

      if (isCorner) {
        const candidateWFromDx = widthFromDx(resizing.dir);
        const candidateHFromDy = heightFromDy(resizing.dir);
        const candidateWFromDy = candidateHFromDy * resizing.ratio;

        const useDx = Math.abs(candidateWFromDx - resizing.startWidth) >= Math.abs(candidateWFromDy - resizing.startWidth);
        const rawW = useDx ? candidateWFromDx : candidateWFromDy;
        const clampedW = Math.max(minWidth, rawW);

        nextW = clampedW;
        nextH = clampedW / resizing.ratio;

        if (resizing.dir.includes('w')) {
          nextX = resizing.startX + (resizing.startWidth - nextW);
        }
        if (resizing.dir.includes('n')) {
          nextY = resizing.startY + (resizing.startHeight - nextH);
        }
      } else if (resizing.dir === 'e' || resizing.dir === 'w') {
        const rawW = widthFromDx(resizing.dir);
        const clampedW = Math.max(minWidth, rawW);
        nextW = clampedW;
        nextH = clampedW / resizing.ratio;
        if (resizing.dir === 'w') {
          nextX = resizing.startX + (resizing.startWidth - nextW);
        }
      } else if (resizing.dir === 's' || resizing.dir === 'n') {
        const rawH = heightFromDy(resizing.dir);
        const clampedH = Math.max(minHeight, rawH);
        nextH = clampedH;
        nextW = clampedH * resizing.ratio;
        if (resizing.dir === 'n') {
          nextY = resizing.startY + (resizing.startHeight - nextH);
        }
      }

      onUpdateNote({
        ...note,
        x: nextX,
        y: nextY,
        width: nextW,
        height: nextH,
      });
    };

    const handleUp = () => {
      if (!resizing) return;
      setResizing(null);
      onInteractableChange?.(false);
    };

    if (resizing) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [resizing, disabled, notes, onUpdateNote, onInteractableChange]);

  const handleMouseDown = (e: React.MouseEvent, note: StickyNote) => {
    if (disabled || note.status === NoteStatus.DRAFT) return;
    if (resizing) return;
    
    e.preventDefault(); 
    e.stopPropagation();
    
    // Calculate offset from mouse to note top-left
    const rect = e.currentTarget.getBoundingClientRect();
    dragOffsetRef.current = {
       x: e.clientX - rect.left,
       y: e.clientY - rect.top
    };

    setDraggingId(note.id);
    setMousePos({ x: e.clientX, y: e.clientY });

    if (note.type === StickyType.IDEA) {
        onDragChange(true);
    } else if (note.type === StickyType.TASK) {
        onDragTaskChange?.(true);
    }
  };

  return (
    <div ref={boardRef} className={cn("relative w-full h-full touch-none select-none pointer-events-none", className)}>
      {notes.map(note => {
        const isTask = note.type === StickyType.TASK;
        const isIdea = note.type === StickyType.IDEA;
        const isDraft = note.status === NoteStatus.DRAFT;
        const isDragging = draggingId === note.id;
        const baseWidth = note.width ?? 224;
        const baseHeight = note.height ?? 192;

        const activeLabel = isTask ? colorLabels.find(l => l.id === note.colorLabelId) : null;

        // Visual Styling
        let containerStyle = "bg-white border-slate-200 shadow-sm";
        if (isIdea) containerStyle = "bg-yellow-50 border-yellow-200 text-yellow-900 shadow-sm rotate-1";
        else if (isDraft) containerStyle = "bg-white border-slate-300 shadow-xl scale-110 z-50 ring-4 ring-indigo-50/50";
        
        // Position Logic
        const style: React.CSSProperties = isDragging && mousePos 
          ? {
              position: 'fixed',
              left: mousePos.x - dragOffsetRef.current.x,
              top: mousePos.y - dragOffsetRef.current.y,
              zIndex: 9999, 
              width: baseWidth,
              height: baseHeight,
              pointerEvents: 'auto' 
            }
          : {
              position: 'absolute',
              left: note.x,
              top: note.y,
              width: baseWidth,
              height: baseHeight,
              zIndex: note.zIndex ?? (isDraft ? 50 : 1),
              pointerEvents: 'auto' 
            };

        // Visual feedback if dragging idea towards sidebar (Right side)
        const sidebarRect = isDragging ? getSidebarRect() : null;
        const isHoveringSidebar = !!(isDragging && mousePos && sidebarRect && isPointInRect(mousePos.x, mousePos.y, sidebarRect));
        const isFading = isDragging && (isIdea || isTask) && isHoveringSidebar;

        return (
          <div
            key={note.id}
            data-electron-widget="note"
            onMouseEnter={() => onInteractableChange?.(true)}
            onMouseLeave={() => !draggingId && onInteractableChange?.(false)}
            onMouseDownCapture={() => bringToFront(note)}
            className={cn(
              "relative p-4 rounded-2xl flex flex-col border-2 pointer-events-auto group overflow-hidden", 
              containerStyle,
              isDragging ? "scale-105 shadow-2xl cursor-grabbing" : "transition-all duration-300 ease-out", 
              disabled && "opacity-50 blur-[1px]",
              isDraft ? "cursor-default" : "cursor-grab",
              isFading && "opacity-60 scale-90 rotate-[5deg]"
            )}
            style={style}
            onMouseDown={(e) => handleMouseDown(e, note)}
          >
            <div
              onMouseDown={(e) => startResize(e, note, 'n')}
              className="absolute -top-1 left-2 right-2 h-3 cursor-ns-resize pointer-events-auto"
            />
            <div
              onMouseDown={(e) => startResize(e, note, 's')}
              className="absolute -bottom-1 left-2 right-2 h-3 cursor-ns-resize pointer-events-auto"
            />
            <div
              onMouseDown={(e) => startResize(e, note, 'w')}
              className="absolute -left-1 top-2 bottom-2 w-3 cursor-ew-resize pointer-events-auto"
            />
            <div
              onMouseDown={(e) => startResize(e, note, 'e')}
              className="absolute -right-1 top-2 bottom-2 w-3 cursor-ew-resize pointer-events-auto"
            />
            <div
              onMouseDown={(e) => startResize(e, note, 'nw')}
              className="absolute -left-1 -top-1 w-4 h-4 cursor-nwse-resize pointer-events-auto"
            />
            <div
              onMouseDown={(e) => startResize(e, note, 'ne')}
              className="absolute -right-1 -top-1 w-4 h-4 cursor-nesw-resize pointer-events-auto"
            />
            <div
              onMouseDown={(e) => startResize(e, note, 'sw')}
              className="absolute -left-1 -bottom-1 w-4 h-4 cursor-nesw-resize pointer-events-auto"
            />
            <div
              onMouseDown={(e) => startResize(e, note, 'se')}
              className="absolute -right-1 -bottom-1 w-4 h-4 cursor-nwse-resize pointer-events-auto"
            />
            {/* Header */}
            <div className="flex justify-between items-start mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 opacity-40">
                {isIdea ? <Lightbulb size={12}/> : <Tag size={12}/>}
                {isIdea ? "想法" : "任务"}
              </span>
              
              {!isDraft && (
                <button 
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => onDeleteNote(note.id)}
                  className={cn("text-slate-400 hover:text-red-500 transition-colors", isDragging && "pointer-events-auto")} 
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Color Labels for Tasks */}
            {isTask && (
              <div className="relative mb-3">
                <div className="flex items-center gap-2">
                  <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowColorPicker(note.id === showColorPicker ? null : note.id);
                    }}
                    className={cn(
                      "w-5 h-5 rounded-full border-2 border-white shadow-sm transition-transform hover:scale-110",
                      !note.colorLabelId && "bg-slate-200"
                    )}
                    style={{ backgroundColor: activeLabel?.color }}
                  />
                  {activeLabel && (
                    <div className="flex items-center gap-1.5 group">
                      <span className="text-[10px] font-bold text-slate-500 truncate max-w-[100px]">
                        {activeLabel.name}
                      </span>
                      <button 
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          const newName = prompt("修改标签名称", activeLabel.name);
                          if (newName !== null) onUpdateColorLabel(activeLabel.id, newName);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-slate-100 rounded transition-all"
                      >
                        <Edit2 size={8} className="text-slate-400" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Pop-up Color Picker */}
                {showColorPicker === note.id && (
                  <div 
                    className="absolute top-full left-0 mt-2 p-2 bg-white rounded-xl shadow-xl border border-slate-100 z-50 flex gap-1.5 animate-in zoom-in-95 duration-200"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    {colorLabels.map(label => (
                      <button
                        key={label.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateNote({ ...note, colorLabelId: label.id });
                          setShowColorPicker(null);
                        }}
                        className={cn(
                          "w-4 h-4 rounded-full border border-black/5 transition-all hover:scale-125",
                          note.colorLabelId === label.id ? "ring-2 ring-offset-1 ring-slate-400 scale-110" : "opacity-60 hover:opacity-100"
                        )}
                        style={{ backgroundColor: label.color }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* Content Area */}
            {isDraft ? (
              <div className="flex flex-col h-full min-h-0">
                <textarea 
                   autoFocus
                   className="w-full flex-1 min-h-0 bg-transparent resize-none outline-none text-lg font-medium placeholder:text-slate-300 leading-snug cursor-text pointer-events-auto"
                   placeholder={isTask ? "例如：洗碗、写报告..." : "例如：一个新点子..."}
                   value={note.content}
                   onChange={(e) => onUpdateNote({ ...note, content: e.target.value })}
                   onKeyDown={(e) => {
                     // 如果正在使用输入法组合（比如中文输入），不触发保存
                     if (e.nativeEvent.isComposing) return;
                     
                     if (e.key === 'Enter' && !e.shiftKey) {
                       e.preventDefault();
                       onCommitDraft(note);
                     }
                   }}
                />
                <div className="mt-2 flex items-center justify-between animate-in fade-in slide-in-from-bottom-2">
                   <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                      <CornerDownLeft size={10}/> 保存
                   </span>
                   <button 
                      onClick={() => onCommitDraft(note)}
                      disabled={!note.content.trim()}
                      className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition-colors pointer-events-auto"
                   >
                      <ArrowRight size={14} />
                   </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-auto relative mb-2 pr-1">
                 <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{note.content}</p>
              </div>
            )}

            {/* Footer */}
            {!isDraft && isTask && (
              <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between flex-shrink-0">
                  {activeTaskNoteId === note.id ? (
                    <div className="flex items-center justify-between w-full pointer-events-auto gap-2">
                      <div className={cn("px-2 py-1 rounded-lg border font-mono text-xs tabular-nums flex items-center gap-1", activeTaskStatus === 'active' ? "bg-indigo-50 border-indigo-100 text-indigo-700" : "bg-slate-50 border-slate-200 text-slate-500")}>
                        <Clock size={12} />
                        <ActiveTaskTimer timerRef={activeTimerRef} status={activeTaskStatus} />
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={() => activeTaskStatus === 'active' ? onPauseTask?.() : onStartTask(note)}
                          className={cn("w-7 h-7 rounded-full flex items-center justify-center shadow transition-all", activeTaskStatus === 'active' ? "bg-amber-100 text-amber-700 hover:bg-amber-200" : "bg-slate-900 text-white hover:scale-105 active:scale-95")}
                          title={activeTaskStatus === 'active' ? "暂停" : "继续"}
                        >
                          {activeTaskStatus === 'active' ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" className="ml-0.5" />}
                        </button>
                        <button
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={() => onStopTask?.()}
                          className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shadow hover:bg-slate-200 transition-all"
                          title="退出(恢复原状)"
                        >
                          <Square size={10} fill="currentColor" />
                        </button>
                        <button
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={() => onCompleteTask?.()}
                          className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shadow hover:bg-emerald-200 transition-all"
                          title="完成任务"
                        >
                          <Check size={14} strokeWidth={3} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full flex justify-end">
                      <button 
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={() => onStartTask(note)}
                          disabled={!!activeTaskNoteId}
                          className={cn("w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all group pointer-events-auto disabled:opacity-40 disabled:cursor-not-allowed", isDragging && "pointer-events-auto")}
                          title="开始执行"
                      >
                          <Play size={16} fill="white" className="group-hover:ml-0.5 transition-all" />
                      </button>
                    </div>
                  )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
