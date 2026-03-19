import React, { useState, useRef, useEffect } from 'react';
import { StickyNote, StickyType, NoteStatus, ColorLabel } from '../types';
import { X, Play, AlertOctagon, Lightbulb, MousePointer2, Clock, Check, Plus, Loader2, CornerDownLeft, ArrowRight, Sparkles, BrainCircuit, Tag, Edit2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Helper to communicate with Electron
// setWindowInteractable(true)  -> 鼠标被应用捕获 (可以点击应用)
// setWindowInteractable(false) -> 鼠标穿透应用 (点击桌面)
const setWindowInteractable = (interactable: boolean) => {
  if (window.electron && window.electron.setIgnoreMouseEvents) {
    if (interactable) {
      window.electron.setIgnoreMouseEvents(false);
    } else {
      // forward: true 让鼠标移动事件依然能传给 React，这样我们才能再次触发 onMouseEnter
      window.electron.setIgnoreMouseEvents(true, { forward: true });
    }
  }
};

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
  onUpdateColorLabel: (id: string, name: string) => void;
  className?: string;
  disabled?: boolean;
}

export const SpatialBoard: React.FC<SpatialBoardProps> = ({ 
  notes, colorLabels, onUpdateNote, onDeleteNote, onStartTask, onBreakdownTask, onReviewTask, onCreateNote, onCommitDraft, onSetBudget, 
  onArchiveIdea, onDragChange, onUpdateColorLabel,
  className, disabled 
}) => {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [showColorPicker, setShowColorPicker] = useState<string | null>(null);
  
  // Track mouse position in viewport coordinates for Fixed positioning
  const [mousePos, setMousePos] = useState<{x: number, y: number} | null>(null);
  
  // Ref for the board container to calculate relative coordinates on drop
  const boardRef = useRef<HTMLDivElement>(null);
  
  // Ref to store the offset from the mouse to the top-left of the dragged note
  const dragOffsetRef = useRef<{ x: number, y: number }>({ x: 0, y: 0 });

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
            // Sidebar is approx 320px (w-80) on the right side of the screen
            if (note.type === StickyType.IDEA && e.clientX > (window.innerWidth - 340)) {
                onArchiveIdea(note);
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
         
         // Safety Reset: Drag ended. Assume we want to pass-through unless mouse is moved.
         // This prevents the "stuck in capture mode" bug if you drag fast and drop outside the note.
         // Since 'forward: true' is set, if we are still hovering the note, a slight mouse move will re-trigger onMouseEnter.
         setWindowInteractable(false);
       }
    }

    if (draggingId) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleMouseUpWithEvent);
      // Force interactive during drag to prevent losing the mouse context
      setWindowInteractable(true);
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleMouseUpWithEvent);
    };
  }, [draggingId, notes, disabled, onUpdateNote, onArchiveIdea, onDragChange]);

  const handleMouseDown = (e: React.MouseEvent, note: StickyNote) => {
    if (disabled || note.status === NoteStatus.DRAFT) return;
    
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
    }
  };

  return (
    <div ref={boardRef} className={cn("relative w-full h-full touch-none select-none pointer-events-none", className)}>
      {notes.map(note => {
        const isTask = note.type === StickyType.TASK;
        const isIdea = note.type === StickyType.IDEA;
        const isDraft = note.status === NoteStatus.DRAFT;
        const isDragging = draggingId === note.id;

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
              minHeight: '12rem',
              width: '14rem', 
              pointerEvents: 'auto' 
            }
          : {
              position: 'absolute',
              left: note.x,
              top: note.y,
              minHeight: '12rem',
              zIndex: 10,
              pointerEvents: 'auto' 
            };

        // Visual feedback if dragging idea towards sidebar (Right side)
        const isHoveringSidebar = isDragging && mousePos && mousePos.x > (window.innerWidth - 340);
        const isFading = isDragging && isIdea && isHoveringSidebar;

        return (
          <div
            key={note.id}
            onMouseEnter={() => setWindowInteractable(true)}
            onMouseLeave={() => !draggingId && setWindowInteractable(false)}
            className={cn(
              "w-56 p-4 rounded-2xl flex flex-col border-2 pointer-events-auto", 
              containerStyle,
              isDragging ? "scale-105 shadow-2xl cursor-grabbing" : "transition-all duration-300 ease-out", 
              disabled && "opacity-50 blur-[1px]",
              isDraft ? "cursor-default" : "cursor-grab",
              isFading && "opacity-60 scale-90 rotate-[5deg]"
            )}
            style={style}
            onMouseDown={(e) => handleMouseDown(e, note)}
          >
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
              <div className="flex flex-col h-full">
                <textarea 
                   autoFocus
                   className="w-full flex-1 bg-transparent resize-none outline-none text-lg font-medium placeholder:text-slate-300 leading-snug cursor-text pointer-events-auto"
                   placeholder={isTask ? "例如：洗碗、写报告..." : "例如：一个新点子..."}
                   value={note.content}
                   onChange={(e) => onUpdateNote({ ...note, content: e.target.value })}
                   onKeyDown={(e) => {
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
              <div className="flex-grow relative mb-2">
                 <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{note.content}</p>
              </div>
            )}

            {/* Footer */}
            {!isDraft && isTask && (
              <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-end">
                  <button 
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={() => onStartTask(note)}
                      className={cn("w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all group pointer-events-auto", isDragging && "pointer-events-auto")}
                      title="开始执行"
                  >
                      <Play size={16} fill="white" className="group-hover:ml-0.5 transition-all" />
                  </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Floating Action Orbs - Wrap in pointer-events-auto and handle mouse events */}
      <div 
         onMouseEnter={() => setWindowInteractable(true)}
         onMouseLeave={() => setWindowInteractable(false)}
         className="absolute bottom-8 left-8 flex flex-col gap-4 z-50 pointer-events-auto"
      >
         <div className="group flex flex-row-reverse items-center gap-4 justify-end">
            <span className="bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg">想法贴</span>
            <button 
               onClick={() => onCreateNote(StickyType.IDEA, window.innerWidth / 2, window.innerHeight / 2)}
               className="w-12 h-12 rounded-full bg-yellow-400 text-yellow-900 shadow-lg hover:scale-110 active:scale-95 transition-all flex items-center justify-center border-2 border-yellow-200"
            >
               <Lightbulb size={24} />
            </button>
         </div>
         <div className="group flex flex-row-reverse items-center gap-4 justify-end">
            <span className="bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg">任务贴</span>
            <button 
               onClick={() => onCreateNote(StickyType.TASK, window.innerWidth / 2, window.innerHeight / 2)}
               className="w-14 h-14 rounded-full bg-rose-500 text-white shadow-xl shadow-rose-200 hover:scale-110 active:scale-95 transition-all flex items-center justify-center border-2 border-rose-400"
            >
               <Plus size={32} />
            </button>
         </div>
      </div>
      
      {notes.length === 0 && !disabled && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
           <div className="flex flex-col items-center gap-2">
              <MousePointer2 size={32} />
              <p className="font-medium">点击左下角按钮开始</p>
           </div>
        </div>
      )}
    </div>
  );
};