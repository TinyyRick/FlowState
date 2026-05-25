import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, Play, Pause, Maximize2, X, Activity, 
  Calendar as CalendarIcon, Globe, Zap, CheckCircle2,
  Lock, AlertTriangle, Clock, Flame, Lightbulb,
  Layout, ChevronUp, ChevronDown, RotateCcw, Trash2, History, Maximize, Hourglass, Power, Save, Archive, Box, ArrowRight, XCircle,
  Coffee, Moon, Sun, Smile, Meh, Frown, MessageSquare, Check
} from 'lucide-react';
import { AppMode, TaskSession, STATUS_MATRIX, StatusLog, BrowserSession, StickyNote, StickyType, NoteStatus, ColorLabel, WorkSession, DailySummary } from './types';
import { format, addDays, eachDayOfInterval, isSameDay, endOfMonth, startOfMonth, subMonths, addMonths, startOfDay, endOfDay } from 'date-fns';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { SpatialBoard } from './components/SpatialBoard';
import { useLocalStorage } from './hooks/useLocalStorage';
import { StateWordPickerModal } from './components/StateWordPickerModal';
import { MoodPickerModal, moodOptions } from './components/MoodPickerModal';
import { SummaryModal } from './components/SummaryModal';

// --- Utility ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Helper to communicate with Electron
const setWindowInteractable = (interactable: boolean) => {
  if (window.electron && window.electron.setIgnoreMouseEvents) {
    if (interactable) {
      window.electron.setIgnoreMouseEvents(false);
    } else {
      window.electron.setIgnoreMouseEvents(true, { forward: true });
    }
  }
};

// --- Components ---

// --- Main Application ---

export default function App() {
  // --- State ---
  const [mode, setMode] = useState<AppMode>(AppMode.DASHBOARD);
  const today = new Date();
  const todayKey = format(today, 'yyyy-MM-dd');
  const todayStartTimestamp = startOfDay(today).getTime();
  
  // Data
  const [notes, setNotes] = useLocalStorage<StickyNote[]>('flowstate_notes', [
    { 
      id: '1', 
      content: '给妈妈打电话', 
      type: StickyType.TASK, 
      status: NoteStatus.ACTIVE,
      createdAt: Date.now(), 
      totalDuration: 0, 
      timeLeft: 0,
      width: 224,
      height: 192,
      zIndex: 1,
      x: 100, y: 150,
      colorLabelId: 'red'
    }
  ]);
  const [colorLabels, setColorLabels] = useLocalStorage<ColorLabel[]>('flowstate_labels', [
    { id: 'red', color: '#ef4444', name: '紧急' },
    { id: 'orange', color: '#f97316', name: '重要' },
    { id: 'yellow', color: '#eab308', name: '待办' },
    { id: 'green', color: '#22c55e', name: '个人' },
    { id: 'blue', color: '#3b82f6', name: '工作' },
    { id: 'purple', color: '#a855f7', name: '创意' },
    { id: 'gray', color: '#94a3b8', name: '默认' },
  ]);
  const [archivedIdeas, setArchivedIdeas] = useLocalStorage<StickyNote[]>('flowstate_archived', []);
  const [archivedTasks, setArchivedTasks] = useLocalStorage<StickyNote[]>('flowstate_taskbox', []);
  const [statusLogs, setStatusLogs] = useLocalStorage<StatusLog[]>('flowstate_logs', []);
  const [completedTasks, setCompletedTasks] = useLocalStorage<TaskSession[]>('flowstate_completed', []);
  const [lostTasks, setLostTasks] = useState<StickyNote[]>([]);
  
  // Work & Summary State
  const [workSessions, setWorkSessions] = useLocalStorage<WorkSession[]>('flowstate_work_sessions', []);
  const [dailySummaries, setDailySummaries] = useLocalStorage<DailySummary[]>('flowstate_summaries', []);
  
  // UI State
  const [isStatusSelectorOpen, setIsStatusSelectorOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(false);
  const [calendarViewDate, setCalendarViewDate] = useState(new Date());
  const [reviewNote, setReviewNote] = useState<StickyNote | null>(null);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [isMoodPickerOpen, setIsMoodPickerOpen] = useState(false);
  const [isStateWordPickerOpen, setIsStateWordPickerOpen] = useState(false);
  
  // Summary Form State
  const [summaryMoodScore, setSummaryMoodScore] = useState(50);
  const [summaryNote, setSummaryNote] = useState('');
  
  // Interaction State
  const [isDragIdeaActive, setIsDragIdeaActive] = useState(false); // Sidebar Interaction
  const [isDragTaskActive, setIsDragTaskActive] = useState(false);
  const [isIdeaBoxOpen, setIsIdeaBoxOpen] = useState(false); // Modal for archived ideas
  const [isTaskBoxOpen, setIsTaskBoxOpen] = useState(false);
  const [statusSelectionAnim, setStatusSelectionAnim] = useState<string | null>(null); // ID of status being selected
  const [taskBoxPendingComplete, setTaskBoxPendingComplete] = useState<Record<string, boolean>>({});
  const [taskBoxDeleteConfirmId, setTaskBoxDeleteConfirmId] = useState<string | null>(null);
  const taskBoxCompleteTimersRef = useRef<Record<string, number>>({});
  const [logDeleteConfirmId, setLogDeleteConfirmId] = useState<string | null>(null);

  // Active Mission
  const [activeTask, setActiveTask] = useLocalStorage<TaskSession | null>('flowstate_active_task', null);
  const [timer, setTimer] = useLocalStorage<number>('flowstate_timer', 0);
  const [activeTaskNoteId, setActiveTaskNoteId] = useLocalStorage<string | null>('flowstate_active_task_note_id', null);
  const timerRef = useRef(timer);

  // Focus Browser
  const [browserUrl, setBrowserUrl] = useState('');
  const [isBrowserSetupOpen, setIsBrowserSetupOpen] = useState(false);
  const [browserTimeLimit, setBrowserTimeLimit] = useState(0);
  
  // --- Global Interaction Control ---
  // Combine all modal states to force interactable mode when any overlay is visible
  const isAnyModalOpen = useMemo(() => {
    return (
      isStatusSelectorOpen || 
      selectedDate !== null || 
      isCalendarExpanded || 
      reviewNote !== null || 
      isIdeaBoxOpen || 
      isTaskBoxOpen ||
      isBrowserSetupOpen || 
      isSummaryModalOpen || 
      isMoodPickerOpen ||
      isStateWordPickerOpen ||
      mode === AppMode.BROWSER
    );
  }, [
    isStatusSelectorOpen, selectedDate, isCalendarExpanded, 
    reviewNote, isIdeaBoxOpen, isTaskBoxOpen, isBrowserSetupOpen, 
    isSummaryModalOpen, isMoodPickerOpen, isStateWordPickerOpen, mode
  ]);

  // Precision mouse-event control: detect if mouse is over an interactive element
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      const isInteractive = !!(
        target.closest('.pointer-events-auto') || 
        target.closest('[data-electron-widget]')
      );

      // Only set to false if NO modal is open
      if (!isInteractive && !isAnyModalOpen) {
        setWindowInteractable(false);
      } else if (isInteractive) {
        setWindowInteractable(true);
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    return () => window.removeEventListener('mousemove', handleGlobalMouseMove);
  }, [isAnyModalOpen]);

  useEffect(() => {
    if (isAnyModalOpen) {
      setWindowInteractable(true);
    }
  }, [isAnyModalOpen]);

  // --- Global Timer Logic ---
  useEffect(() => {
    const interval = setInterval(() => {
      if (activeTask?.status === 'active') setTimer(t => t + 1);
      if (mode === AppMode.BROWSER) {
        setBrowserTimeLimit(prev => {
          if (prev <= 1) {
            setMode(AppMode.DASHBOARD);
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [mode, activeTask]); 

  useEffect(() => {
    timerRef.current = timer;
  }, [timer]);

  useEffect(() => {
    // Close leftover open work sessions from previous days on startup.
    setWorkSessions(prev => {
      let hasChanges = false;
      const nextSessions = prev.map(session => {
        if (session.endTime || session.startTime >= todayStartTimestamp) {
          return session;
        }

        hasChanges = true;
        return {
          ...session,
          endTime: endOfDay(new Date(session.startTime)).getTime(),
        };
      });

      return hasChanges ? nextSessions : prev;
    });
  }, [setWorkSessions, todayStartTimestamp]);

  // --- Computed ---
  const currentStatus = useMemo(() => {
    if (statusLogs.length === 0) return null;
    return STATUS_MATRIX.find(s => s.id === statusLogs[statusLogs.length - 1].statusId);
  }, [statusLogs]);

  const activeWorkSession = useMemo(() => {
    return workSessions.find(s => !s.endTime && s.startTime >= todayStartTimestamp);
  }, [todayStartTimestamp, workSessions]);

  const todayCompletedTasks = useMemo(() => {
    return completedTasks.filter(task => format(task.createdAt, 'yyyy-MM-dd') === todayKey);
  }, [completedTasks, todayKey]);

  // --- Actions ---

  const handleCreateNote = (type: StickyType, x: number, y: number) => {
     const newNote: StickyNote = {
       id: crypto.randomUUID(),
       content: '',
       type,
       status: NoteStatus.DRAFT,
       createdAt: Date.now(),
       totalDuration: 0,
       timeLeft: 0,
       width: 224,
       height: 192,
       zIndex: 1,
       x, y
     };
     setNotes(prev => [...prev, newNote]);
  };

  const handleCommitDraft = (note: StickyNote) => {
     if (!note.content.trim()) {
        setNotes(prev => prev.filter(n => n.id !== note.id));
        return;
     }

     setNotes(prev => prev.map(n => n.id === note.id ? { ...n, status: NoteStatus.ACTIVE } : n));
  };

  const handleSetBudget = (note: StickyNote, minutes: number) => {
     // No longer used for board notes, but kept for task sessions if needed
  };

  const handleUpdateNote = (updatedNote: StickyNote) => {
    setNotes(prev => prev.map(n => n.id === updatedNote.id ? updatedNote : n));
  };

  const handleDeleteNote = (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  const handleArchiveIdea = (note: StickyNote) => {
     setArchivedIdeas(prev => [note, ...prev]);
     handleDeleteNote(note.id);
     setIsDragIdeaActive(false); // Reset visual state
  };

  const handleArchiveTask = (note: StickyNote) => {
    if (activeTaskNoteId === note.id) return;
    setArchivedTasks(prev => [note, ...prev]);
    handleDeleteNote(note.id);
    setIsDragTaskActive(false);
  };

  useEffect(() => {
    return () => {
      const timers = taskBoxCompleteTimersRef.current;
      for (const key of Object.keys(timers)) {
        window.clearTimeout(timers[key]);
      }
      taskBoxCompleteTimersRef.current = {};
    };
  }, []);

  const completeTaskFromTaskBox = (task: StickyNote) => {
    setArchivedTasks(prev => prev.filter(t => t.id !== task.id));
    const session: TaskSession = {
      id: crypto.randomUUID(),
      originalGoal: task.content,
      aiReformulatedGoal: task.content,
      steps: [{
        id: crypto.randomUUID(),
        text: task.content,
        estimatedMinutes: 25,
        isCompleted: true
      }],
      currentStepIndex: 0,
      createdAt: Date.now(),
      status: 'completed',
      originalX: task.x,
      originalY: task.y,
      originalType: task.type
    };
    setCompletedTasks(prev => [...prev, session]);
  };

  const scheduleTaskBoxComplete = (task: StickyNote) => {
    const existing = taskBoxCompleteTimersRef.current[task.id];
    if (existing) window.clearTimeout(existing);

    setTaskBoxPendingComplete(prev => ({ ...prev, [task.id]: true }));
    const timerId = window.setTimeout(() => {
      completeTaskFromTaskBox(task);
      setTaskBoxPendingComplete(prev => {
        const next = { ...prev };
        delete next[task.id];
        return next;
      });
      delete taskBoxCompleteTimersRef.current[task.id];
    }, 2500);

    taskBoxCompleteTimersRef.current[task.id] = timerId;
  };

  const cancelTaskBoxComplete = (taskId: string) => {
    const existing = taskBoxCompleteTimersRef.current[taskId];
    if (existing) window.clearTimeout(existing);
    delete taskBoxCompleteTimersRef.current[taskId];
    setTaskBoxPendingComplete(prev => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
  };

  const handleStartTaskDirect = (note: StickyNote) => {
    if (activeTask && activeTaskNoteId !== note.id) return;
    if (activeTask && activeTaskNoteId === note.id && activeTask.status === 'paused') {
      setActiveTask({ ...activeTask, status: 'active' });
      return;
    }
    if (!note.content) return;
    const newTask: TaskSession = {
      id: crypto.randomUUID(),
      originalGoal: note.content,
      aiReformulatedGoal: note.content,
      steps: [{ 
         id: crypto.randomUUID(), 
         text: note.content, 
         estimatedMinutes: 25, 
         isCompleted: false 
      }],
      currentStepIndex: 0,
      createdAt: Date.now(),
      status: 'active',
      originalX: note.x,
      originalY: note.y,
      originalType: note.type
    };

    setActiveTask(newTask);
    setActiveTaskNoteId(note.id);
    setTimer(0);
  };

  const handlePauseTask = () => {
    if (activeTask) {
      setActiveTask({ ...activeTask, status: 'paused' });
    }
  };

  const handleCompleteActiveTask = () => {
    if (!activeTask || !activeTaskNoteId) return;
    
    setCompletedTasks([...completedTasks, { ...activeTask, status: 'completed', createdAt: Date.now() }]);
    handleDeleteNote(activeTaskNoteId);
    
    setActiveTask(null);
    setActiveTaskNoteId(null);
    setTimer(0);
  };

  const handleStopActiveTask = () => {
    setActiveTask(null);
    setActiveTaskNoteId(null);
    setTimer(0);
  };

  const handleBreakdownTask = async (note: StickyNote) => {
    // Removed AI breakdown
  };

  const handleRestoreTask = () => {
    if (!activeTask) { setMode(AppMode.DASHBOARD); return; }
    const restoredNote: StickyNote = {
      id: crypto.randomUUID(),
      content: activeTask.originalGoal,
      type: activeTask.originalType || StickyType.TASK,
      status: NoteStatus.ACTIVE,
      createdAt: activeTask.createdAt,
      totalDuration: 900, 
      timeLeft: 900,
      x: activeTask.originalX || 150,
      y: activeTask.originalY || 150
    };
    setNotes(prev => [...prev, restoredNote]);
    setActiveTask(null);
    setMode(AppMode.DASHBOARD);
  };

  const handleCompleteStep = () => {
    if (!activeTask) return;
    const newSteps = [...activeTask.steps];
    newSteps[activeTask.currentStepIndex].isCompleted = true;
    if (activeTask.currentStepIndex + 1 >= activeTask.steps.length) {
      setCompletedTasks([...completedTasks, { ...activeTask, status: 'completed', createdAt: Date.now() }]);
      setActiveTask(null);
      setActiveTaskNoteId(null);
      setMode(AppMode.DASHBOARD);
    } else {
      setActiveTask({ ...activeTask, steps: newSteps, currentStepIndex: activeTask.currentStepIndex + 1 });
    }
  };
  
  const startBrowserSession = (minutes: number) => {
    setBrowserTimeLimit(minutes * 60);
    setMode(AppMode.BROWSER);
    setIsBrowserSetupOpen(false);
  };

  const handleStatusSelect = (statusId: string) => {
      // 1. Start Animation
      setStatusSelectionAnim(statusId);
      
      const statusObj = STATUS_MATRIX.find(s => s.id === statusId);
      const score = statusObj?.score || 50;

      // 2. Commit after delay
      setTimeout(() => {
          setStatusLogs(prev => [...prev, { 
            timestamp: Date.now(), 
            statusId,
            score 
          }]);
          setStatusSelectionAnim(null);
          setIsStatusSelectorOpen(false);
      }, 700);
  };

  const handleClockIn = () => {
    if (activeWorkSession) return;
    const now = Date.now();
    const newSession: WorkSession = {
      id: crypto.randomUUID(),
      startTime: now,
      endTime: null,
    };
    setWorkSessions(prev => [...prev, newSession]);
  };

  const handleClockOut = () => {
    if (!activeWorkSession) return;
    setIsSummaryModalOpen(true);
  };

  const handleConfirmClockOut = () => {
    const now = Date.now();
    setWorkSessions(prev => prev.map(s => s.id === activeWorkSession?.id ? { ...s, endTime: now } : s));
    
    const summary: DailySummary = {
      date: format(new Date(), 'yyyy-MM-dd'),
      moodScore: summaryMoodScore,
      note: summaryNote,
      workSessionId: activeWorkSession?.id || ''
    };
    
    setDailySummaries(prev => {
      const filtered = prev.filter(s => s.date !== summary.date);
      return [...filtered, summary];
    });
    
    setIsSummaryModalOpen(false);
    setSummaryNote('');
    setSummaryMoodScore(50);
  };

  // --- Render Sections ---

  const categoryMap: Record<string, string> = { 'FOCUS': '专注', 'ENERGY': '能量', 'BODY': '身体', 'EMOTION': '情绪' };

  const renderStatusSelector = () => (
    <>
      {isStatusSelectorOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-md pointer-events-auto" 
          onClick={() => {
              if (!statusSelectionAnim) setIsStatusSelectorOpen(false)
          }}
        />
      )}
      <div 
         className={cn(
         "absolute right-6 top-24 z-50 w-80 max-h-[80vh] overflow-y-auto custom-scrollbar bg-white/45 backdrop-blur-2xl rounded-2xl shadow-[0_12px_40px_rgba(15,23,42,0.18)] border border-white/55 p-3.5 transition-all duration-300 origin-top-right",
         isStatusSelectorOpen ? "opacity-100 scale-100 pointer-events-auto translate-y-0" : "opacity-0 scale-95 pointer-events-none -translate-y-4"
      )}>
         {['FOCUS', 'ENERGY', 'BODY', 'EMOTION'].map(cat => (
            <div key={cat} className="mb-6 last:mb-0">
               <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-2 sticky top-0 bg-white/30 backdrop-blur-2xl py-1">{categoryMap[cat] || cat}</div>
               <div className="grid grid-cols-1 gap-1">
                  {STATUS_MATRIX.filter(s => s.category === cat).map(status => {
                     const isSelected = statusSelectionAnim === status.id;
                     return (
                        <button
                        key={status.id}
                        disabled={!!statusSelectionAnim}
                        onClick={() => handleStatusSelect(status.id)}
                        className={cn(
                            "relative flex items-center gap-3 p-2.5 rounded-xl transition-all duration-300 text-left group border overflow-hidden",
                            isSelected ? "bg-indigo-600/95 border-indigo-500/60 scale-[1.02] shadow-[0_8px_22px_rgba(99,102,241,0.35)] z-10" : "hover:bg-white/35 border-transparent hover:border-white/60"
                        )}
                        >
                            <span className={cn("text-xl transition-transform", !isSelected && "group-hover:scale-110")}>{status.icon}</span>
                            <div className="flex-1">
                                <div className={cn("text-sm font-semibold transition-colors", isSelected ? "text-white" : "text-slate-800")}>{status.label}</div>
                            </div>
                            {isSelected && (
                                <div className="absolute right-4 animate-in fade-in zoom-in duration-300">
                                    <CheckCircle2 className="text-white" size={20} />
                                </div>
                            )}
                        </button>
                     )
                  })}
               </div>
            </div>
         ))}
      </div>
    </>
  );

  const renderFullCalendarModal = () => {
     if (!isCalendarExpanded) return null;
     const monthStart = startOfMonth(calendarViewDate);
     const monthEnd = endOfMonth(calendarViewDate);
     const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
     
     // Pad days to start from Sunday
     const firstDayOfWeek = monthStart.getDay();
     const paddingDays = Array.from({ length: firstDayOfWeek }).map((_, i) => null);

     const selectedKey = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;
     const selectedDayLogs = selectedKey ? statusLogs.filter(l => format(l.timestamp, 'yyyy-MM-dd') === selectedKey) : [];
     const selectedDaySummary = selectedKey ? dailySummaries.find(s => s.date === selectedKey) : null;
     const selectedDayWorkSessions = selectedKey ? workSessions.filter(s => format(s.startTime, 'yyyy-MM-dd') === selectedKey) : [];
     const selectedDayTasks = selectedKey
        ? completedTasks
            .filter(t => format(t.createdAt, 'yyyy-MM-dd') === selectedKey)
            .map(t => ({ id: t.id, text: t.originalGoal, startTime: format(t.createdAt, 'HH:mm'), duration: 25 }))
        : [];
     const stateTrendData = selectedDayLogs.map(l => ({
        time: format(l.timestamp, 'HH:mm'),
        score: Math.max(0, Math.min(100, l.score)),
        label: l.statusId,
     }));

     return (
        <div
           className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-md animate-in fade-in pointer-events-auto"
           onMouseDown={(e) => {
             if (e.target === e.currentTarget) {
               setIsCalendarExpanded(false);
               setSelectedDate(null);
             }
           }}
        >
           <div className="bg-white/65 backdrop-blur-2xl w-full max-w-4xl rounded-3xl p-7 shadow-[0_20px_70px_rgba(15,23,42,0.35)] border border-white/60 relative">
              <button onClick={() => { setIsCalendarExpanded(false); setSelectedDate(null); }} className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/30 border border-white/60 hover:bg-white/50 transition-colors flex items-center justify-center text-slate-600"><X size={18}/></button>
              
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/35 border border-white/60 flex items-center justify-center text-indigo-600 shadow-sm">
                    <CalendarIcon size={18} />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">时光机</div>
                    <h2 className="text-2xl font-bold text-slate-800 leading-tight">{format(calendarViewDate, 'yyyy年 M月')}</h2>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-center gap-2 mb-6">
                <button 
                  onClick={() => setCalendarViewDate(prev => subMonths(prev, 1))}
                  className="w-10 h-10 rounded-full bg-white/25 border border-white/60 hover:bg-white/45 transition-colors flex items-center justify-center text-slate-600"
                  aria-label="上一月"
                >
                  <ChevronDown className="rotate-90" size={20}/>
                </button>
                <button 
                  onClick={() => setCalendarViewDate(new Date())}
                  className="px-4 h-10 rounded-full bg-white/35 border border-white/60 hover:bg-white/55 transition-colors text-slate-700 text-sm font-bold"
                >
                  今天
                </button>
                <button 
                  onClick={() => setCalendarViewDate(prev => addMonths(prev, 1))}
                  className="w-10 h-10 rounded-full bg-white/25 border border-white/60 hover:bg-white/45 transition-colors flex items-center justify-center text-slate-600"
                  aria-label="下一月"
                >
                  <ChevronUp className="rotate-90" size={20}/>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[1fr_360px] gap-6">
                <div className="bg-white/25 border border-white/55 rounded-3xl p-5">
                  <div className="grid grid-cols-7 gap-3">
                    {['日', '一', '二', '三', '四', '五', '六'].map(d => (
                      <div key={d} className="text-center text-[10px] font-bold text-slate-600 uppercase tracking-wider">{d}</div>
                    ))}
                    {paddingDays.map((_, i) => <div key={`pad-${i}`} className="aspect-square" />)}
                    {days.map((day, i) => {
                      const dateKey = format(day, 'yyyy-MM-dd');
                      const hasLogs = statusLogs.some(l => format(l.timestamp, 'yyyy-MM-dd') === dateKey);
                      const daySummary = dailySummaries.find(s => s.date === dateKey) || null;
                      const hasTasks = completedTasks.some(t => format(t.createdAt, 'yyyy-MM-dd') === dateKey);
                      const isToday = isSameDay(day, new Date());
                      const isSelected = selectedKey === dateKey;
                      const moodDot = daySummary
                        ? daySummary.moodScore >= 80
                          ? "bg-emerald-400"
                          : daySummary.moodScore >= 60
                            ? "bg-indigo-400"
                            : daySummary.moodScore >= 40
                              ? "bg-slate-400"
                              : daySummary.moodScore >= 20
                                ? "bg-amber-400"
                                : "bg-rose-400"
                        : null;

                      return (
                        <button
                          key={i}
                          onClick={() => setSelectedDate(day)}
                          className={cn(
                            "aspect-square rounded-2xl flex flex-col items-center justify-center relative border transition-all group",
                            isToday ? "bg-indigo-600/95 text-white border-indigo-500/70 shadow-[0_10px_30px_rgba(99,102,241,0.35)]" : "bg-white/35 border-white/55 hover:border-indigo-200/70 hover:bg-white/50",
                            isSelected && "ring-2 ring-indigo-400/70"
                          )}
                        >
                          <span className={cn("text-sm font-bold tabular-nums", !isToday && "text-slate-800 group-hover:text-slate-900")}>{format(day, 'd')}</span>
                          <div className="absolute bottom-2 flex items-center gap-1">
                            {hasLogs && (
                              <div className={cn("w-1.5 h-1.5 rounded-full", isToday ? "bg-white/90" : "bg-indigo-400")} />
                            )}
                            {moodDot && (
                              <div className={cn("w-1.5 h-1.5 rounded-full", isToday ? "bg-white/90" : moodDot)} />
                            )}
                            {hasTasks && (
                              <div className={cn("w-1.5 h-1.5 rounded-full", isToday ? "bg-white/90" : "bg-amber-400")} />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-white/25 border border-white/55 rounded-3xl p-5 flex flex-col min-h-[420px]">
                  {selectedDate ? (
                    <>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">日详情</div>
                          <div className="text-lg font-bold text-slate-800">{format(selectedDate, 'M月d日')}</div>
                        </div>
                      </div>

                      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-4">
                        {stateTrendData.length > 0 ? (
                          <div className="p-4 rounded-2xl bg-white/35 border border-white/60">
                            <div className="flex items-center justify-between mb-3">
                              <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">状态变化</div>
                              <div className="px-2 py-0.5 rounded-full bg-white/35 border border-white/60 text-slate-800 text-[10px] font-mono font-bold">
                                {stateTrendData[stateTrendData.length - 1].score}
                              </div>
                            </div>
                            <div className="h-28 w-full bg-white/25 rounded-2xl p-3 border border-white/55">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={stateTrendData}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                  <XAxis dataKey="time" hide />
                                  <YAxis hide domain={[0, 100]} />
                                  <Tooltip
                                    content={({ active, payload }) => {
                                      if (active && payload && payload.length) {
                                        return (
                                          <div className="bg-white/70 backdrop-blur-2xl p-2 rounded-xl shadow-2xl border border-white/60">
                                            <div className="text-[10px] font-bold text-slate-600">{payload[0].payload.time}</div>
                                            <div className="text-xs font-bold text-slate-800">{payload[0].payload.label}</div>
                                            <div className="text-[10px] font-mono font-bold text-slate-600 tabular-nums">
                                              {payload[0].value}
                                            </div>
                                          </div>
                                        );
                                      }
                                      return null;
                                    }}
                                  />
                                  <Line
                                    type="monotone"
                                    dataKey="score"
                                    stroke="#6366f1"
                                    strokeWidth={2}
                                    dot={(props: any) => {
                                      const { cx, cy, payload } = props;
                                      if (typeof cx !== 'number' || typeof cy !== 'number') return null;
                                      return (
                                        <g>
                                          <circle cx={cx} cy={cy} r={3} fill="#6366f1" stroke="#ffffff" strokeWidth={1} />
                                          <text x={cx} y={cy - 8} textAnchor="middle" fontSize="8" fill="#334155" fontWeight="700">
                                            {payload.label}
                                          </text>
                                        </g>
                                      );
                                    }}
                                  />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 rounded-2xl bg-white/20 border border-white/55 text-slate-600 text-sm">
                            暂无状态记录
                          </div>
                        )}

                        {selectedDaySummary ? (
                          <div className="p-4 rounded-2xl bg-white/35 border border-white/60">
                            <div className="flex items-center justify-between mb-3">
                              <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">当日总结</div>
                              <div className="text-sm font-bold text-slate-800">{selectedDaySummary.moodScore}</div>
                            </div>
                            <p className="text-sm text-slate-700 leading-relaxed italic">"{selectedDaySummary.note}"</p>
                          </div>
                        ) : (
                          <div className="p-4 rounded-2xl bg-white/20 border border-white/55 text-slate-600 text-sm">
                            暂无总结
                          </div>
                        )}

                        {selectedDayTasks.length > 0 ? (
                          <div className="space-y-2">
                            <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">完成任务</div>
                            <div className="space-y-2">
                              {selectedDayTasks.map(t => (
                                <div key={t.id} className="p-3 rounded-2xl bg-white/30 border border-white/60 flex items-start gap-3">
                                  <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                                  <div className="min-w-0">
                                    <div className="text-sm font-semibold text-slate-800 leading-relaxed">{t.text}</div>
                                    <div className="mt-1 text-[10px] font-mono font-bold text-slate-600 uppercase tracking-wider">{t.startTime}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 rounded-2xl bg-white/20 border border-white/55 text-slate-600 text-sm">
                            暂无完成任务
                          </div>
                        )}

                        {selectedDayWorkSessions.length > 0 && (
                          <div className="space-y-2">
                            <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">工作时段</div>
                            <div className="space-y-2">
                              {selectedDayWorkSessions.map(session => (
                                <div key={session.id} className="p-3 rounded-2xl bg-white/30 border border-white/60 flex items-center justify-between">
                                  <div className="flex items-center gap-2 text-slate-700">
                                    <Clock size={14} />
                                    <span className="text-xs font-bold">{format(session.startTime, 'HH:mm')} - {session.endTime ? format(session.endTime, 'HH:mm') : '进行中'}</span>
                                  </div>
                                  {session.endTime && (
                                    <span className="text-[10px] font-bold text-slate-600">
                                      {Math.floor((session.endTime - session.startTime) / 1000 / 60)}m
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {selectedDayLogs.length === 0 && !selectedDaySummary && selectedDayTasks.length === 0 && selectedDayWorkSessions.length === 0 && (
                          <div className="flex flex-col items-center justify-center py-10 text-slate-600">
                            <Activity size={24} className="opacity-60 mb-2" />
                            <div className="text-sm font-semibold">这一天还很干净</div>
                            <div className="text-xs text-slate-500 mt-1">没有状态、总结或完成记录</div>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-600">
                      <div className="w-12 h-12 rounded-3xl bg-white/30 border border-white/60 flex items-center justify-center text-indigo-600 shadow-sm mb-3">
                        <History size={20} />
                      </div>
                      <div className="text-sm font-semibold">点选任意日期</div>
                      <div className="text-xs text-slate-500 mt-1">在右侧查看当天总结与完成记录</div>
                    </div>
                  )}
                </div>
              </div>
           </div>
        </div>
     );
  };

  const renderHistoryModal = () => {
     if (!selectedDate) return null;
     
     const dateKey = format(selectedDate, 'yyyy-MM-dd');
     const dayLogs = statusLogs.filter(l => format(l.timestamp, 'yyyy-MM-dd') === dateKey);
     const daySummary = dailySummaries.find(s => s.date === dateKey);
     const dayWorkSessions = workSessions.filter(s => format(s.startTime, 'yyyy-MM-dd') === dateKey);
     
     const chartData = dayLogs.map(l => ({
        time: format(l.timestamp, 'HH:mm'),
        score: l.score,
        label: STATUS_MATRIX.find(s => s.id === l.statusId)?.label || ''
     }));

     const displayTasks = completedTasks
        .filter(t => format(t.createdAt, 'yyyy-MM-dd') === dateKey)
        .map(t => ({ 
           id: t.id, 
           text: t.originalGoal, 
           status: 'completed', 
           startTime: format(t.createdAt, 'HH:mm'), 
           duration: 25, // Mock or calculate if stored
           tag: 'TASK' 
        }));

     return (
        <div 
           className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-slate-900/45 backdrop-blur-md animate-in fade-in pointer-events-auto"
        >
           <div className="bg-white/65 backdrop-blur-2xl w-full max-w-2xl rounded-3xl p-7 shadow-[0_20px_70px_rgba(15,23,42,0.35)] border border-white/60 relative overflow-hidden flex flex-col max-h-[90vh]">
              <button onClick={() => setSelectedDate(null)} className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/30 border border-white/60 hover:bg-white/50 transition-colors flex items-center justify-center text-slate-600"><X size={18}/></button>
              <div className="flex-shrink-0 mb-6">
                  <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-white/35 border border-white/60 flex items-center justify-center text-indigo-600 shadow-sm">
                          <History size={20}/>
                      </div>
                      {format(selectedDate, 'M月d日')} · 时光机
                  </h2>
              </div>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-8">
                  {dayLogs.length === 0 && displayTasks.length === 0 ? (
                     <div className="flex flex-col items-center justify-center h-48 text-slate-600 border border-white/55 bg-white/25 rounded-2xl">
                        <Activity size={32} className="mb-2 opacity-50"/>
                        <p>该日期无记录</p>
                     </div>
                  ) : (
                     <>
                      {/* Mood Trend Chart */}
                      {dayLogs.length > 0 && (
                          <div className="space-y-3">
                            <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">情绪趋势</div>
                            <div className="h-48 w-full bg-white/30 rounded-2xl p-4 border border-white/55">
                              <ResponsiveContainer width="100%" height="100%">
                                  <LineChart data={chartData}>
                                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                      <XAxis 
                                        dataKey="time" 
                                        hide 
                                      />
                                      <YAxis hide domain={[0, 100]} />
                                      <Tooltip 
                                          content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                              return (
                                                <div className="bg-white/70 backdrop-blur-2xl p-3 rounded-2xl shadow-2xl border border-white/60">
                                                  <p className="text-[10px] font-bold text-slate-600 mb-1">{payload[0].payload.time}</p>
                                                  <p className="text-sm font-bold text-indigo-700">{payload[0].payload.label}</p>
                                                  <p className="text-xs text-slate-600">分值: {payload[0].value}</p>
                                                </div>
                                              );
                                            }
                                            return null;
                                          }}
                                      />
                                      <Line 
                                        type="monotone" 
                                        dataKey="score" 
                                        stroke="#6366f1" 
                                        strokeWidth={3} 
                                        dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
                                        activeDot={{ r: 6, strokeWidth: 0 }}
                                      />
                                  </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                      )}

                      {/* Summary Section */}
                      {daySummary && (
                        <div className="p-6 rounded-2xl bg-white/30 border border-white/55">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <div className="text-2xl">
                                {daySummary.moodScore >= 80 ? '🤩' : daySummary.moodScore >= 60 ? '😊' : daySummary.moodScore >= 40 ? '😐' : daySummary.moodScore >= 20 ? '😔' : '😫'}
                              </div>
                              <div>
                                <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">当日总结</div>
                                <div className="text-sm font-bold text-slate-800">综合评分: {daySummary.moodScore}</div>
                              </div>
                            </div>
                            <MessageSquare size={16} className="text-slate-400" />
                          </div>
                          <p className="text-sm text-slate-700 leading-relaxed italic">
                            "{daySummary.note}"
                          </p>
                        </div>
                      )}

                      {/* Work Sessions */}
                      {dayWorkSessions.length > 0 && (
                        <div className="space-y-3">
                          <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">工作时段</div>
                          <div className="grid grid-cols-1 gap-2">
                            {dayWorkSessions.map(session => (
                              <div key={session.id} className="flex items-center justify-between p-3 bg-white/25 rounded-2xl border border-white/55">
                                <div className="flex items-center gap-2 text-slate-600">
                                  <Clock size={14} />
                                  <span className="text-xs font-bold">{format(session.startTime, 'HH:mm')} - {session.endTime ? format(session.endTime, 'HH:mm') : '进行中'}</span>
                                </div>
                                {session.endTime && (
                                  <span className="text-[10px] font-bold text-slate-600">
                                    时长: {Math.floor((session.endTime - session.startTime) / 1000 / 60)} 分钟
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Timeline */}
                      <div className="space-y-3">
                        <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">活动记录</div>
                        <div className="relative pl-2">
                            <div className="absolute top-2 bottom-4 left-[5.5rem] w-0.5 bg-white/60"></div>
                            <div className="space-y-6">
                                {displayTasks.map((t: any) => (
                                      <div key={t.id} className="flex group">
                                          <div className="w-16 pt-3 text-right text-xs font-mono font-medium text-slate-600 mr-8 flex-shrink-0">
                                              {t.startTime}
                                          </div>
                                          <div className="flex-1 relative">
                                              <div className="absolute -left-[1.3rem] top-4 w-3 h-3 rounded-full border-2 border-white shadow-sm z-10 bg-indigo-500"></div>
                                              <div className="p-4 rounded-2xl border bg-white/40 backdrop-blur-2xl border-white/60 transition-all duration-300 hover:shadow-lg">
                                                  <div className="flex justify-between items-start mb-2">
                                                      <span className="font-bold text-base text-slate-800">{t.text}</span>
                                                      <CheckCircle2 size={16} className="text-emerald-500 mt-1"/>
                                                  </div>
                                                  <div className="flex items-center gap-3 text-xs">
                                                      <span className="px-2 py-0.5 rounded-md bg-white/35 border border-white/60 text-slate-600 font-mono flex items-center gap-1">
                                                          <Hourglass size={10}/> {t.duration}m
                                                      </span>
                                                  </div>
                                              </div>
                                          </div>
                                      </div>
                                ))}
                            </div>
                        </div>
                      </div>
                     </>
                  )}
              </div>
           </div>
        </div>
     );
  };

  const renderIdeaBoxModal = () => {
     if (!isIdeaBoxOpen) return null;
     return (
        <div 
           className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-md animate-in fade-in pointer-events-auto"
        >
           <div className="bg-white/65 backdrop-blur-2xl w-full max-w-lg rounded-3xl p-6 shadow-[0_20px_70px_rgba(15,23,42,0.35)] border border-white/60 relative max-h-[80vh] flex flex-col">
              <button onClick={() => setIsIdeaBoxOpen(false)} className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/30 border border-white/60 hover:bg-white/50 transition-colors flex items-center justify-center text-slate-600"><X size={18}/></button>
              <div className="flex items-center gap-3 mb-6">
                 <div className="w-10 h-10 rounded-2xl bg-white/35 border border-white/60 flex items-center justify-center text-amber-600 shadow-sm">
                    <Box size={18} />
                 </div>
                 <h2 className="text-xl font-bold text-slate-800">想法收纳盒</h2>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 p-1">
                 {archivedIdeas.length === 0 && (
                    <div className="text-center text-slate-600 py-10 flex flex-col items-center gap-2 border border-white/55 bg-white/25 rounded-2xl">
                       <Lightbulb size={22} className="opacity-60"/>
                       <p className="text-sm">拖拽想法贴到归档按钮即可收纳</p>
                    </div>
                 )}
                 {archivedIdeas.map(idea => (
                    <div key={idea.id} className="bg-yellow-50/70 backdrop-blur border border-yellow-200/70 p-4 rounded-2xl shadow-sm rotate-0 hover:rotate-1 transition-transform relative group">
                        <p className="text-slate-800 font-medium leading-relaxed">{idea.content}</p>
                        <div className="mt-3 text-[10px] text-yellow-800/70 font-bold uppercase flex justify-between items-center">
                            {format(idea.createdAt, 'yyyy/MM/dd HH:mm')}
                            <button 
                               onClick={() => {
                                  setArchivedIdeas(prev => prev.filter(i => i.id !== idea.id));
                                  setNotes(prev => [...prev, { ...idea, x: 150, y: 150 }]);
                                  setIsIdeaBoxOpen(false);
                               }}
                               className="opacity-0 group-hover:opacity-100 text-yellow-900 hover:text-yellow-950 transition-opacity"
                            >
                               取出
                            </button>
                        </div>
                    </div>
                 ))}
              </div>
           </div>
        </div>
     );
  };

  const renderTaskBoxModal = () => {
    if (!isTaskBoxOpen) return null;
    return (
      <div 
        className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-md animate-in fade-in pointer-events-auto"
        onMouseDown={() => setTaskBoxDeleteConfirmId(null)}
      >
        <div
          className="bg-white/65 backdrop-blur-2xl w-full max-w-lg rounded-3xl p-6 shadow-[0_20px_70px_rgba(15,23,42,0.35)] border border-white/60 relative max-h-[80vh] flex flex-col"
          onMouseDown={() => setTaskBoxDeleteConfirmId(null)}
        >
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => {
              setIsTaskBoxOpen(false);
              setTaskBoxDeleteConfirmId(null);
            }}
            className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/30 border border-white/60 hover:bg-white/50 transition-colors flex items-center justify-center text-slate-600"
          >
            <X size={18}/>
          </button>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-white/35 border border-white/60 flex items-center justify-center text-indigo-600 shadow-sm">
              <Archive size={18} />
            </div>
            <h2 className="text-xl font-bold text-slate-800">任务收纳盒</h2>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 p-1">
            {archivedTasks.length === 0 && (
              <div className="text-center text-slate-600 py-10 flex flex-col items-center gap-2 border border-white/55 bg-white/25 rounded-2xl">
                <Archive size={22} className="opacity-60"/>
                <p className="text-sm">拖拽任务贴到归档按钮即可收纳</p>
              </div>
            )}
            {archivedTasks.map(task => (
              <div key={task.id} className={cn("bg-white/60 backdrop-blur border border-white/60 p-4 rounded-2xl shadow-sm transition-transform relative group", taskBoxPendingComplete[task.id] && "opacity-70")}>
                <p className="text-slate-800 font-medium leading-relaxed">{task.content}</p>
                <div className="mt-3 text-[10px] text-slate-600/80 font-bold uppercase flex justify-between items-center gap-3">
                  <span className="font-mono">{format(task.createdAt, 'yyyy/MM/dd HH:mm')}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={() => {
                        if (taskBoxPendingComplete[task.id]) cancelTaskBoxComplete(task.id);
                        else scheduleTaskBoxComplete(task);
                      }}
                      className={cn(
                        "w-7 h-7 rounded-full border flex items-center justify-center transition-all shadow-sm hover:scale-110",
                        taskBoxPendingComplete[task.id]
                          ? "bg-emerald-500 border-emerald-400 text-white"
                          : "bg-white/40 border-white/70 text-slate-500 hover:bg-white/70 hover:ring-2 hover:ring-emerald-300"
                      )}
                      title={taskBoxPendingComplete[task.id] ? "取消完成" : "完成任务"}
                    >
                      {taskBoxPendingComplete[task.id] ? <Check size={14} strokeWidth={3} /> : null}
                    </button>

                    <div
                      data-delete-scope={task.id}
                      className="relative flex items-center"
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => {
                          setTaskBoxDeleteConfirmId(prev => (prev === task.id ? null : task.id));
                        }}
                        className="w-7 h-7 rounded-full bg-white/40 border border-white/70 text-slate-500 hover:bg-white/70 flex items-center justify-center shadow-sm transition-all"
                        title="删除任务"
                      >
                        <X size={14} />
                      </button>

                      {taskBoxDeleteConfirmId === task.id && (
                        <button
                          onClick={() => {
                            cancelTaskBoxComplete(task.id);
                            setArchivedTasks(prev => prev.filter(t => t.id !== task.id));
                            setTaskBoxDeleteConfirmId(null);
                          }}
                          className="absolute right-full mr-2 px-2 py-1 rounded-full bg-rose-600 text-white text-[10px] font-bold shadow-lg border border-rose-500"
                        >
                          删除
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderReviewModal = () => {
    if (!reviewNote) return null;
    return (
       <div 
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-md pointer-events-auto"
       >
          <div className="bg-white/70 backdrop-blur-2xl w-full max-w-md rounded-3xl p-6 shadow-[0_20px_70px_rgba(15,23,42,0.35)] border border-white/60">
             <div className="flex flex-col items-center text-center mb-6">
                <div className="w-12 h-12 bg-white/30 border border-white/60 rounded-full flex items-center justify-center text-red-500 mb-4"><AlertTriangle size={22} /></div>
                <h2 className="text-xl font-bold text-slate-800">时间破产</h2>
             </div>
             <div className="grid grid-cols-2 gap-3">
                <button onClick={() => { setNotes(prev => prev.map(n => n.id === reviewNote.id ? { ...n, status: NoteStatus.ACTIVE, timeLeft: 900 } : n)); setReviewNote(null); }} className="p-4 rounded-2xl bg-white/35 border border-white/60 text-indigo-700 font-bold hover:bg-white/55 transition-colors">重试</button>
                <button onClick={() => { setLostTasks(prev => [...prev, { ...reviewNote, status: NoteStatus.LOST }]); setNotes(prev => prev.filter(n => n.id !== reviewNote.id)); setReviewNote(null); }} className="p-4 rounded-2xl bg-white/25 border border-white/60 text-slate-700 font-bold hover:bg-white/45 transition-colors">归档</button>
             </div>
          </div>
       </div>
    );
  };
  
  const renderBrowserSetupModal = () => {
    if (!isBrowserSetupOpen) return null;
    return (
      <div 
         className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md pointer-events-auto"
      >
         <div className="bg-white/70 backdrop-blur-2xl w-full max-w-sm rounded-3xl p-6 shadow-[0_20px_70px_rgba(15,23,42,0.35)] border border-white/60">
            <h3 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2"><Globe size={18} className="text-indigo-600"/> 浏览预算</h3>
            <div className="grid grid-cols-2 gap-3 mb-4 mt-4">
               {[10, 20, 30, 45].map(min => <button key={min} onClick={() => startBrowserSession(min)} className="p-3 bg-white/35 hover:bg-white/55 border border-white/60 rounded-2xl text-slate-700 font-bold transition-colors">{min}分钟</button>)}
            </div>
            <button onClick={() => setIsBrowserSetupOpen(false)} className="w-full py-3 text-sm font-bold text-slate-600 hover:text-slate-800 transition-colors">取消</button>
         </div>
      </div>
    )
  };

  const selectedMood = moodOptions.find(m => m.score === summaryMoodScore) || moodOptions[2];

  useEffect(() => {
    if (!isTaskBoxOpen) {
      setTaskBoxDeleteConfirmId(null);
      return;
    }
    const handler = (e: MouseEvent) => {
      if (!taskBoxDeleteConfirmId) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const scope = target.closest?.(`[data-delete-scope="${taskBoxDeleteConfirmId}"]`);
      if (scope) return;
      setTaskBoxDeleteConfirmId(null);
    };
    window.addEventListener('mousedown', handler, true);
    return () => window.removeEventListener('mousedown', handler, true);
  }, [isTaskBoxOpen, taskBoxDeleteConfirmId]);

  return (
    <div 
      className="flex flex-row-reverse h-screen w-screen overflow-hidden font-sans text-slate-700 selection:bg-indigo-100 selection:text-indigo-900 bg-transparent pointer-events-none"
    >
      {renderStatusSelector()}
      {renderFullCalendarModal()}
      <StateWordPickerModal 
        isOpen={isStateWordPickerOpen} 
        onClose={() => setIsStateWordPickerOpen(false)} 
        onSelect={(log) => setStatusLogs(prev => [...prev, log])} 
      />
      <MoodPickerModal 
        isOpen={isMoodPickerOpen} 
        onClose={() => setIsMoodPickerOpen(false)} 
        summaryMoodScore={summaryMoodScore} 
        onSelect={setSummaryMoodScore} 
      />
      <SummaryModal
        isOpen={isSummaryModalOpen}
        onClose={() => setIsSummaryModalOpen(false)}
        summaryMoodScore={summaryMoodScore}
        summaryNote={summaryNote}
        setSummaryNote={setSummaryNote}
        onConfirm={handleConfirmClockOut}
        onOpenMoodPicker={() => setIsMoodPickerOpen(true)}
        selectedMood={selectedMood}
      />
      {renderReviewModal()}
      {renderBrowserSetupModal()}
      {renderIdeaBoxModal()}
      {renderTaskBoxModal()}

      {/* --- SIDEBAR (Liquid Glass Dock) --- */}
      <div 
         data-electron-widget="sidebar"
         className={cn(
            "fixed right-6 z-20 pointer-events-auto transition-all duration-500 ease-out shadow-[0_8px_32px_0_rgba(31,38,135,0.1)] backdrop-blur-2xl border border-white/40",
            mode === AppMode.IMMERSIVE && activeTask 
              ? "top-6 bottom-6 w-80 rounded-[2rem] bg-white/40 p-6 flex flex-col" 
              : "top-1/2 -translate-y-1/2 w-16 flex flex-col items-center gap-4 py-6 px-2 rounded-full bg-white/20"
         )}
      >
        {mode === AppMode.IMMERSIVE && activeTask ? (
          <div className="flex flex-col h-full animate-in fade-in duration-500">
            <div className="flex items-center justify-between mb-8">
              <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-[0.2em]">专注模式</div>
              <button 
                onClick={handleRestoreTask} 
                className="p-2 hover:bg-white/50 rounded-full text-slate-500 hover:text-slate-800 transition-colors"
                title="退出专注"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 flex flex-col gap-8">
              <div className="space-y-2">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">正在进行</div>
                <h2 className="text-2xl font-bold text-slate-800 leading-tight">
                  {activeTask.steps[activeTask.currentStepIndex].text}
                </h2>
              </div>

              <div className="flex flex-col items-center justify-center py-12 bg-white/30 rounded-3xl border border-white/50 shadow-inner">
                <div className="text-5xl font-mono font-light text-slate-800 tabular-nums mb-2">
                  {new Date(timer * 1000).toISOString().substr(14, 5)}
                </div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">已专注时间</div>
              </div>

              <div className="space-y-4">
                <button 
                  onClick={handleCompleteStep} 
                  className="w-full py-4 bg-indigo-600/90 backdrop-blur text-white rounded-2xl text-sm font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-2 border border-indigo-400/50"
                >
                  <CheckCircle2 size={18} />
                  完成当前步骤
                </button>
                
                <div className="p-4 rounded-2xl bg-white/30 border border-white/50">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">任务目标</div>
                  <p className="text-xs text-slate-700 leading-relaxed italic">
                    "{activeTask.originalGoal}"
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-auto pt-6 border-t border-white/30">
              <div className="flex items-center gap-2 text-slate-500">
                <Flame size={14} className="text-orange-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider">保持心流状态</span>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Dock Top: Status & Clock In/Out */}
            <div className="flex flex-col items-center gap-3">
              <div className="group relative">
                {!activeWorkSession ? (
                  <button 
                    onClick={handleClockIn}
                    className="w-12 h-12 rounded-full bg-white/40 hover:bg-emerald-100/80 border border-white/60 shadow-sm flex items-center justify-center text-slate-500 hover:text-emerald-600 transition-all"
                  >
                    <Sun size={20} />
                  </button>
                ) : (
                  <button 
                    onClick={handleClockOut}
                    className="w-12 h-12 rounded-full bg-slate-800/80 backdrop-blur hover:bg-slate-900 border border-slate-700 shadow-md flex items-center justify-center text-white transition-all"
                  >
                    <Moon size={20} />
                  </button>
                )}
                <div className="absolute right-full mr-4 top-1/2 -translate-y-1/2 px-2 py-1 bg-slate-800/90 backdrop-blur text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg">
                  {!activeWorkSession ? '上班 (打卡)' : '下班 (总结)'}
                </div>
              </div>

              <div className="group relative">
                <button 
                  onClick={() => setIsStateWordPickerOpen(true)}
                  className="w-10 h-10 rounded-full bg-white/40 hover:bg-orange-100/80 border border-white/60 shadow-sm flex items-center justify-center text-orange-600 hover:scale-110 transition-all"
                >
                  <Flame size={18} />
                </button>
                <div className="absolute right-full mr-4 top-1/2 -translate-y-1/2 px-2 py-1 bg-slate-800/90 backdrop-blur text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg">
                  记录状态
                </div>
              </div>

            </div>

            <div className="w-8 h-px bg-white/30 my-1" />

            {/* Dock Middle: Creation & Tools */}
            <div className="flex flex-col items-center gap-3">
              <div className="group relative">
                <button 
                  onClick={() => handleCreateNote(StickyType.TASK, window.innerWidth / 2, window.innerHeight / 2)}
                  className="w-10 h-10 rounded-full bg-white/40 hover:bg-rose-100/80 border border-white/60 shadow-sm flex items-center justify-center text-rose-500 hover:scale-110 transition-all"
                >
                  <Plus size={20} />
                </button>
                <div className="absolute right-full mr-4 top-1/2 -translate-y-1/2 px-2 py-1 bg-slate-800/90 backdrop-blur text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg">
                  新建任务贴
                </div>
              </div>

              <div className="group relative">
                <button 
                  onClick={() => handleCreateNote(StickyType.IDEA, window.innerWidth / 2, window.innerHeight / 2)}
                  className="w-10 h-10 rounded-full bg-white/40 hover:bg-yellow-100/80 border border-white/60 shadow-sm flex items-center justify-center text-yellow-600 hover:scale-110 transition-all"
                >
                  <Lightbulb size={18} />
                </button>
                <div className="absolute right-full mr-4 top-1/2 -translate-y-1/2 px-2 py-1 bg-slate-800/90 backdrop-blur text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg">
                  记录想法贴
                </div>
              </div>
            </div>

            <div className="w-8 h-px bg-white/30 my-1" />

            {/* Dock Bottom: Apps & Archive */}
            <div className="flex flex-col items-center gap-3">
              <div className="group relative">
                <button 
                  onClick={() => setIsCalendarExpanded(true)}
                  className="w-10 h-10 rounded-full bg-white/40 hover:bg-indigo-100/80 border border-white/60 shadow-sm flex items-center justify-center text-indigo-500 hover:scale-110 transition-all"
                >
                  <CalendarIcon size={18} />
                </button>
                <div className="absolute right-full mr-4 top-1/2 -translate-y-1/2 px-2 py-1 bg-slate-800/90 backdrop-blur text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg">
                  时光机 (日历)
                </div>
              </div>

              <div className="group relative">
                <button 
                  onClick={() => setIsTaskBoxOpen(true)}
                  className={cn(
                    "w-10 h-10 rounded-full border shadow-sm flex items-center justify-center transition-all duration-300",
                    isDragTaskActive 
                      ? "bg-indigo-100/90 border-indigo-300 text-indigo-600 scale-125 shadow-indigo-200/50" 
                      : "bg-white/40 hover:bg-indigo-100/80 border-white/60 text-indigo-600 hover:scale-110"
                  )}
                >
                  <Archive size={18} className={cn("transition-transform duration-300", isDragTaskActive ? "-translate-y-0.5 rotate-[-10deg]" : "")}/>
                  {archivedTasks.length > 0 && !isDragTaskActive && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border border-white shadow-sm">
                      {archivedTasks.length}
                    </span>
                  )}
                </button>
                <div className="absolute right-full mr-4 top-1/2 -translate-y-1/2 px-2 py-1 bg-slate-800/90 backdrop-blur text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg">
                  {isDragTaskActive ? '拖入归档' : '任务收纳'}
                </div>
              </div>

              <div className="group relative">
                <button 
                  onClick={() => setIsIdeaBoxOpen(true)}
                  className={cn(
                    "w-10 h-10 rounded-full border shadow-sm flex items-center justify-center transition-all duration-300",
                    isDragIdeaActive 
                      ? "bg-amber-100/90 border-amber-300 text-amber-600 scale-125 shadow-amber-200/50" 
                      : "bg-white/40 hover:bg-amber-100/80 border-white/60 text-amber-600 hover:scale-110"
                  )}
                >
                  <Box size={18} className={cn("transition-transform duration-300", isDragIdeaActive ? "-translate-y-0.5 rotate-[-10deg]" : "")}/>
                  {archivedIdeas.length > 0 && !isDragIdeaActive && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border border-white shadow-sm">
                      {archivedIdeas.length}
                    </span>
                  )}
                </button>
                <div className="absolute right-full mr-4 top-1/2 -translate-y-1/2 px-2 py-1 bg-slate-800/90 backdrop-blur text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg">
                  {isDragIdeaActive ? '拖入归档' : '想法收纳'}
                </div>
              </div>

              <div className="group relative">
                <button 
                  onClick={() => setIsLogOpen(!isLogOpen)}
                  className="w-10 h-10 rounded-full bg-white/40 hover:bg-emerald-100/80 border border-white/60 shadow-sm flex items-center justify-center text-emerald-600 hover:scale-110 transition-all"
                >
                  <CheckCircle2 size={18} />
                  {todayCompletedTasks.length > 0 && (
                    <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border border-white shadow-sm">
                      {todayCompletedTasks.length}
                    </span>
                  )}
                </button>
                <div className="absolute right-full mr-4 top-1/2 -translate-y-1/2 px-2 py-1 bg-slate-800/90 backdrop-blur text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg">
                  今日完成日志
                </div>

                {/* Popover for Logs */}
                {isLogOpen && (
                  <div 
                    className="absolute right-full mr-4 top-1/2 -translate-y-1/2 w-64 bg-white/80 backdrop-blur-2xl border border-white/60 rounded-2xl p-4 shadow-2xl animate-in slide-in-from-right-4 fade-in z-50"
                    onMouseDown={(e) => {
                      const target = e.target as HTMLElement;
                      if (!target.closest('[data-log-delete-scope]')) setLogDeleteConfirmId(null);
                    }}
                  >
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-bold text-emerald-700 uppercase">今日日志</span>
                      <button onClick={() => setIsLogOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={14}/></button>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                      {todayCompletedTasks.length === 0 && <span className="text-xs text-emerald-500 italic">暂无任务</span>}
                      {todayCompletedTasks.map(t => (
                        <div key={t.id} className="flex items-center justify-between gap-2 text-xs text-slate-700 p-2 bg-white/50 rounded-lg border border-white/60">
                          <div className="flex items-start gap-2">
                            <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5"/>
                            <span className="leading-relaxed">{t.originalGoal}</span>
                          </div>
                          <div 
                            data-log-delete-scope
                            className="relative flex items-center"
                          >
                            <button
                              onClick={() => setLogDeleteConfirmId(prev => prev === t.id ? null : t.id)}
                              className="w-6 h-6 rounded-full bg-white/50 border border-white/70 text-slate-500 hover:bg-rose-100 flex items-center justify-center shadow-sm transition-all"
                              title="删除记录"
                            >
                              <X size={12} />
                            </button>
                            {logDeleteConfirmId === t.id && (
                              <button
                                onClick={() => {
                                  setLogDeleteConfirmId(null);
                                  const idx = completedTasks.findIndex(ct => ct.id === t.id);
                                  if (idx >= 0) {
                                    const next = [...completedTasks];
                                    next.splice(idx, 1);
                                    setCompletedTasks(next);
                                  }
                                }}
                                className="absolute right-full mr-2 px-2 py-1 rounded-full bg-rose-600 text-white text-[10px] font-bold shadow-lg border border-rose-500"
                              >
                                删除
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-auto flex flex-col gap-3">
              <div className="group relative">
                <button 
                  onClick={() => window.electron?.quitApp?.()}
                  className="w-10 h-10 rounded-full bg-white/20 hover:bg-red-100 border border-white/30 hover:border-red-200 shadow-sm flex items-center justify-center text-slate-400 hover:text-red-500 hover:scale-110 transition-all"
                >
                  <Power size={18} />
                </button>
                <div className="absolute right-full mr-4 top-1/2 -translate-y-1/2 px-2 py-1 bg-red-600/90 backdrop-blur text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg">
                  退出应用
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* --- CANVAS (The Action Zone) --- */}
      <div className="flex-1 relative flex flex-col z-30 pointer-events-none">
         {/* Background pattern - Removed for transparency */}
         {/* <div className="absolute inset-0 z-0 opacity-[0.3]" style={{ backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)', backgroundSize: '32px 32px' }} /> */}

         {/* Immersive Overlay - Removed from here as it's now in the sidebar */}

         {/* Browser Overlay - Make Interactable */}
         {mode === AppMode.BROWSER && (
             <div 
                className="absolute inset-0 z-50 bg-white flex flex-col animate-in slide-in-from-bottom-10 duration-300 pointer-events-auto"
             >
                <div className={cn("h-14 border-b flex items-center justify-between px-6 transition-colors", browserTimeLimit < 60 ? "bg-red-50 border-red-200" : "bg-white border-slate-200")}>
                   <div className="flex items-center gap-4">
                      <div className={cn("w-2 h-2 rounded-full animate-pulse", browserTimeLimit < 60 ? "bg-red-500" : "bg-emerald-500")} />
                      <span className="flex items-center gap-2 text-xs font-mono text-slate-500 uppercase tracking-widest"><Lock size={12}/> 安全容器</span>
                   </div>
                   <div className={cn("flex items-center gap-2 font-mono text-2xl font-light tabular-nums", browserTimeLimit < 60 ? "text-red-600 font-bold scale-110" : "text-slate-800")}>{new Date(browserTimeLimit * 1000).toISOString().substr(14, 5)}</div>
                   <button onClick={() => setMode(AppMode.DASHBOARD)} className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-red-600 transition-colors"><Power size={14} /> 强制退出</button>
                </div>
                <iframe src={browserUrl.startsWith('http') ? browserUrl : `https://${browserUrl}`} className="flex-1 w-full border-0"/>
             </div>
         )}

         {/* Main Spatial Board */}
         <SpatialBoard 
           notes={mode === AppMode.IMMERSIVE ? notes.filter(n => n.type === StickyType.IDEA) : notes}
            colorLabels={colorLabels}
            onUpdateNote={handleUpdateNote}
            onDeleteNote={handleDeleteNote}
            onStartTask={handleStartTaskDirect}
            onBreakdownTask={handleBreakdownTask}
            onReviewTask={setReviewNote}
            onCreateNote={handleCreateNote}
            onCommitDraft={handleCommitDraft}
            onSetBudget={handleSetBudget}
            // New Props
            onArchiveIdea={handleArchiveIdea}
            onDragChange={setIsDragIdeaActive}
            onArchiveTask={handleArchiveTask}
            onDragTaskChange={setIsDragTaskActive}
            onUpdateColorLabel={(id, name) => {
              setColorLabels(prev => prev.map(l => l.id === id ? { ...l, name } : l));
            }}
           activeTaskNoteId={activeTaskNoteId}
           activeTaskStatus={activeTask?.status}
           activeTimerRef={timerRef}
           onPauseTask={handlePauseTask}
           onCompleteTask={handleCompleteActiveTask}
           onStopTask={handleStopActiveTask}
            disabled={mode !== AppMode.DASHBOARD}
            className="w-full h-full z-10"
         />

      </div>
    </div>
  );
}
