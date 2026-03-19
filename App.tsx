import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, Play, Pause, Maximize2, X, Activity, 
  Calendar as CalendarIcon, Globe, Zap, CheckCircle2,
  Lock, AlertTriangle, Clock, Flame, Lightbulb,
  Layout, ChevronUp, ChevronDown, RotateCcw, Trash2, History, Maximize, Hourglass, Power, Settings, Save, Archive, Box, ArrowRight, XCircle,
  Coffee, Moon, Sun, Smile, Meh, Frown, MessageSquare
} from 'lucide-react';
import { AppMode, TaskSession, STATUS_MATRIX, StatusLog, BrowserSession, StickyNote, StickyType, NoteStatus, ColorLabel, WorkSession, DailySummary } from './types';
import { breakdownTask, setCustomApiKey, getCustomApiKey } from './services/geminiService';
import { format, addDays, eachDayOfInterval, isSameDay, endOfMonth, startOfMonth, subMonths, addMonths, startOfDay, endOfDay } from 'date-fns';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { SpatialBoard } from './components/SpatialBoard';

// --- Utility ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Electron Bridge Utility ---
// Defined globally or via context normally, but local helper here for App.tsx widgets
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

const SidebarCard = ({ children, className = "", onClick }: any) => (
  <div 
    onClick={onClick}
    className={cn(
      "rounded-2xl p-4 border border-slate-100 bg-white/50 backdrop-blur-sm transition-all duration-300",
      className
    )}
  >
    {children}
  </div>
);

// Helper to wrap interactive modals/menus to ensure they catch mouse events
const InteractiveWrapper = ({ children }: { children: React.ReactNode }) => (
  <div 
    onMouseEnter={() => setWindowInteractable(true)}
    onMouseLeave={() => setWindowInteractable(false)}
    className="contents" 
  >
    {children}
  </div>
);

// --- Main Application ---

export default function App() {
  // --- State ---
  const [mode, setMode] = useState<AppMode>(AppMode.DASHBOARD);
  const today = new Date();
  
  // Data
  const [notes, setNotes] = useState<StickyNote[]>(() => {
    const saved = localStorage.getItem('flowstate_notes');
    return saved ? JSON.parse(saved) : [
      { 
        id: '1', 
        content: '给妈妈打电话', 
        type: StickyType.TASK, 
        status: NoteStatus.ACTIVE,
        createdAt: Date.now(), 
        totalDuration: 0, 
        timeLeft: 0,
        x: 100, y: 150,
        colorLabelId: 'red'
      }
    ];
  });
  const [colorLabels, setColorLabels] = useState<ColorLabel[]>(() => {
    const saved = localStorage.getItem('flowstate_labels');
    return saved ? JSON.parse(saved) : [
      { id: 'red', color: '#ef4444', name: '紧急' },
      { id: 'orange', color: '#f97316', name: '重要' },
      { id: 'yellow', color: '#eab308', name: '待办' },
      { id: 'green', color: '#22c55e', name: '个人' },
      { id: 'blue', color: '#3b82f6', name: '工作' },
      { id: 'purple', color: '#a855f7', name: '创意' },
      { id: 'gray', color: '#94a3b8', name: '默认' },
    ];
  });
  const [archivedIdeas, setArchivedIdeas] = useState<StickyNote[]>(() => {
    const saved = localStorage.getItem('flowstate_archived');
    return saved ? JSON.parse(saved) : [];
  });
  const [statusLogs, setStatusLogs] = useState<StatusLog[]>(() => {
    const saved = localStorage.getItem('flowstate_logs');
    return saved ? JSON.parse(saved) : [];
  });
  const [completedTasks, setCompletedTasks] = useState<TaskSession[]>(() => {
    const saved = localStorage.getItem('flowstate_completed');
    return saved ? JSON.parse(saved) : [];
  });
  const [lostTasks, setLostTasks] = useState<StickyNote[]>([]);
  
  // Work & Summary State
  const [workSessions, setWorkSessions] = useState<WorkSession[]>(() => {
    const saved = localStorage.getItem('flowstate_work_sessions');
    return saved ? JSON.parse(saved) : [];
  });
  const [dailySummaries, setDailySummaries] = useState<DailySummary[]>(() => {
    const saved = localStorage.getItem('flowstate_summaries');
    return saved ? JSON.parse(saved) : [];
  });
  
  // UI State
  const [isStatusSelectorOpen, setIsStatusSelectorOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(false);
  const [calendarViewDate, setCalendarViewDate] = useState(new Date());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [reviewNote, setReviewNote] = useState<StickyNote | null>(null);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  
  // Summary Form State
  const [summaryMoodScore, setSummaryMoodScore] = useState(50);
  const [summaryNote, setSummaryNote] = useState('');
  
  // Interaction State
  const [isDragIdeaActive, setIsDragIdeaActive] = useState(false); // Sidebar Interaction
  const [isIdeaBoxOpen, setIsIdeaBoxOpen] = useState(false); // Modal for archived ideas
  const [statusSelectionAnim, setStatusSelectionAnim] = useState<string | null>(null); // ID of status being selected

  // Active Mission
  const [activeTask, setActiveTask] = useState<TaskSession | null>(null);
  const [timer, setTimer] = useState(0);

  // Focus Browser
  const [browserUrl, setBrowserUrl] = useState('');
  const [isBrowserSetupOpen, setIsBrowserSetupOpen] = useState(false);
  const [browserTimeLimit, setBrowserTimeLimit] = useState(0);
  
  // Settings
  const [apiKeyInput, setApiKeyInput] = useState(getCustomApiKey());

  // --- Initial Electron Setup ---
  useEffect(() => {
    // Start in pass-through mode
    setWindowInteractable(false);
  }, []);

  // --- Persistence ---
  useEffect(() => {
    localStorage.setItem('flowstate_notes', JSON.stringify(notes));
  }, [notes]);
  useEffect(() => {
    localStorage.setItem('flowstate_logs', JSON.stringify(statusLogs));
  }, [statusLogs]);
  useEffect(() => {
    localStorage.setItem('flowstate_completed', JSON.stringify(completedTasks));
  }, [completedTasks]);
  useEffect(() => {
    localStorage.setItem('flowstate_archived', JSON.stringify(archivedIdeas));
  }, [archivedIdeas]);
  useEffect(() => {
    localStorage.setItem('flowstate_work_sessions', JSON.stringify(workSessions));
  }, [workSessions]);
  useEffect(() => {
    localStorage.setItem('flowstate_summaries', JSON.stringify(dailySummaries));
  }, [dailySummaries]);

  // --- Global Timer Logic ---
  useEffect(() => {
    const interval = setInterval(() => {
      if (mode === AppMode.IMMERSIVE) setTimer(t => t + 1);

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
  }, [mode]); 

  // --- Computed ---
  const currentStatus = useMemo(() => {
    if (statusLogs.length === 0) return null;
    return STATUS_MATRIX.find(s => s.id === statusLogs[statusLogs.length - 1].statusId);
  }, [statusLogs]);

  const activeWorkSession = useMemo(() => {
    return workSessions.find(s => !s.endTime);
  }, [workSessions]);

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

  const handleStartTaskDirect = (note: StickyNote) => {
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

    handleDeleteNote(note.id);
    setActiveTask(newTask);
    setTimer(0);
    setMode(AppMode.IMMERSIVE);
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
    
    // Also log current status if any, or default to a neutral one
    if (!currentStatus) {
      handleStatusSelect('focus_normal');
    } else {
      // Re-log current status to mark the start of work in the chart
      setStatusLogs(prev => [...prev, { 
        timestamp: now, 
        statusId: currentStatus.id,
        score: currentStatus.score
      }]);
    }
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

  const handleSaveSettings = () => {
    setCustomApiKey(apiKeyInput.trim());
    setIsSettingsOpen(false);
  };

  // --- Render Sections ---

  const categoryMap: Record<string, string> = { 'FOCUS': '专注', 'ENERGY': '能量', 'BODY': '身体', 'EMOTION': '情绪' };

  const renderStatusSelector = () => (
    <InteractiveWrapper>
      {isStatusSelectorOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-[1px]" 
          onClick={() => {
              if (!statusSelectionAnim) setIsStatusSelectorOpen(false)
          }}
        />
      )}
      <div className={cn(
         "absolute right-6 top-24 z-50 w-80 max-h-[80vh] overflow-y-auto custom-scrollbar bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 transition-all duration-300 origin-top-right",
         isStatusSelectorOpen ? "opacity-100 scale-100 pointer-events-auto translate-y-0" : "opacity-0 scale-95 pointer-events-none -translate-y-4"
      )}>
         {['FOCUS', 'ENERGY', 'BODY', 'EMOTION'].map(cat => (
            <div key={cat} className="mb-6 last:mb-0">
               <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 sticky top-0 bg-white py-1">{categoryMap[cat] || cat}</div>
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
                            isSelected ? "bg-indigo-600 border-indigo-600 scale-105 shadow-md z-10" : "hover:bg-slate-50 border-transparent hover:border-slate-100"
                        )}
                        >
                            <span className={cn("text-xl transition-transform", !isSelected && "group-hover:scale-110")}>{status.icon}</span>
                            <div className="flex-1">
                                <div className={cn("text-sm font-semibold transition-colors", isSelected ? "text-white" : "text-slate-700")}>{status.label}</div>
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
    </InteractiveWrapper>
  );

  const renderFullCalendarModal = () => {
     if (!isCalendarExpanded) return null;
     const monthStart = startOfMonth(calendarViewDate);
     const monthEnd = endOfMonth(calendarViewDate);
     const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
     
     // Pad days to start from Sunday
     const firstDayOfWeek = monthStart.getDay();
     const paddingDays = Array.from({ length: firstDayOfWeek }).map((_, i) => null);

     return (
        <InteractiveWrapper>
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
           <div className="bg-white w-full max-w-3xl rounded-3xl p-8 shadow-2xl relative">
              <button onClick={() => setIsCalendarExpanded(false)} className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full"><X size={20}/></button>
              
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                  <CalendarIcon className="text-indigo-500"/> 
                  {format(calendarViewDate, 'yyyy年 M月')}
                </h2>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setCalendarViewDate(prev => subMonths(prev, 1))}
                    className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors"
                  >
                    <ChevronDown className="rotate-90" size={20}/>
                  </button>
                  <button 
                    onClick={() => setCalendarViewDate(new Date())}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 text-sm font-bold transition-colors"
                  >
                    今天
                  </button>
                  <button 
                    onClick={() => setCalendarViewDate(prev => addMonths(prev, 1))}
                    className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors"
                  >
                    <ChevronUp className="rotate-90" size={20}/>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-4">
                 {['日', '一', '二', '三', '四', '五', '六'].map(d => <div key={d} className="text-center text-xs font-bold text-slate-400 uppercase">{d}</div>)}
                 {paddingDays.map((_, i) => <div key={`pad-${i}`} className="aspect-square" />)}
                 {days.map((day, i) => {
                    const dateKey = format(day, 'yyyy-MM-dd');
                    const hasLogs = statusLogs.some(l => format(l.timestamp, 'yyyy-MM-dd') === dateKey);
                    const isToday = isSameDay(day, new Date());
                    
                    return (
                      <button 
                        key={i} 
                        onClick={() => { setSelectedDate(day); setIsCalendarExpanded(false); }} 
                        className={cn(
                          "aspect-square rounded-2xl flex flex-col items-center justify-center relative border transition-all hover:scale-105 group", 
                          isToday ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100" : "bg-white border-slate-100 hover:border-indigo-200"
                        )}
                      >
                        <span className="text-sm font-bold">{format(day, 'd')}</span>
                        {hasLogs && !isToday && (
                          <div className="absolute bottom-2 w-1.5 h-1.5 rounded-full bg-indigo-400 group-hover:bg-indigo-500" />
                        )}
                      </button>
                    );
                 })}
              </div>
           </div>
        </div>
        </InteractiveWrapper>
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
        <InteractiveWrapper>
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
           <div className="bg-white w-full max-w-2xl rounded-3xl p-8 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
              <button onClick={() => setSelectedDate(null)} className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full"><X size={20}/></button>
              <div className="flex-shrink-0 mb-6">
                  <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                          <History size={20}/>
                      </div>
                      {format(selectedDate, 'M月d日')} · 时光机
                  </h2>
              </div>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-8">
                  {dayLogs.length === 0 && displayTasks.length === 0 ? (
                     <div className="flex flex-col items-center justify-center h-48 text-slate-400 border-2 border-dashed border-slate-100 rounded-2xl">
                        <Activity size={32} className="mb-2 opacity-50"/>
                        <p>该日期无记录</p>
                     </div>
                  ) : (
                     <>
                      {/* Mood Trend Chart */}
                      {dayLogs.length > 0 && (
                          <div className="space-y-3">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">情绪趋势</div>
                            <div className="h-48 w-full bg-slate-50 rounded-2xl p-4 border border-slate-100">
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
                                                <div className="bg-white p-3 rounded-xl shadow-xl border border-slate-100">
                                                  <p className="text-[10px] font-bold text-slate-400 mb-1">{payload[0].payload.time}</p>
                                                  <p className="text-sm font-bold text-indigo-600">{payload[0].payload.label}</p>
                                                  <p className="text-xs text-slate-500">分值: {payload[0].value}</p>
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
                        <div className="p-6 rounded-2xl bg-indigo-50/50 border border-indigo-100">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <div className="text-2xl">
                                {daySummary.moodScore >= 80 ? '🤩' : daySummary.moodScore >= 60 ? '😊' : daySummary.moodScore >= 40 ? '😐' : daySummary.moodScore >= 20 ? '😔' : '😫'}
                              </div>
                              <div>
                                <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">当日总结</div>
                                <div className="text-sm font-bold text-indigo-900">综合评分: {daySummary.moodScore}</div>
                              </div>
                            </div>
                            <MessageSquare size={16} className="text-indigo-300" />
                          </div>
                          <p className="text-sm text-indigo-800 leading-relaxed italic">
                            "{daySummary.note}"
                          </p>
                        </div>
                      )}

                      {/* Work Sessions */}
                      {dayWorkSessions.length > 0 && (
                        <div className="space-y-3">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">工作时段</div>
                          <div className="grid grid-cols-1 gap-2">
                            {dayWorkSessions.map(session => (
                              <div key={session.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <div className="flex items-center gap-2 text-slate-600">
                                  <Clock size={14} />
                                  <span className="text-xs font-bold">{format(session.startTime, 'HH:mm')} - {session.endTime ? format(session.endTime, 'HH:mm') : '进行中'}</span>
                                </div>
                                {session.endTime && (
                                  <span className="text-[10px] font-bold text-slate-400">
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
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">活动记录</div>
                        <div className="relative pl-2">
                            <div className="absolute top-2 bottom-4 left-[5.5rem] w-0.5 bg-slate-100"></div>
                            <div className="space-y-6">
                                {displayTasks.map((t: any) => (
                                      <div key={t.id} className="flex group">
                                          <div className="w-16 pt-3 text-right text-xs font-mono font-medium text-slate-400 mr-8 flex-shrink-0">
                                              {t.startTime}
                                          </div>
                                          <div className="flex-1 relative">
                                              <div className="absolute -left-[1.3rem] top-4 w-3 h-3 rounded-full border-2 border-white shadow-sm z-10 bg-indigo-500"></div>
                                              <div className="p-4 rounded-2xl border bg-white border-slate-100 transition-all duration-300 hover:shadow-md">
                                                  <div className="flex justify-between items-start mb-2">
                                                      <span className="font-bold text-base text-slate-700">{t.text}</span>
                                                      <CheckCircle2 size={16} className="text-emerald-500 mt-1"/>
                                                  </div>
                                                  <div className="flex items-center gap-3 text-xs">
                                                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 font-mono flex items-center gap-1">
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
        </InteractiveWrapper>
     );
  };

  const renderIdeaBoxModal = () => {
     if (!isIdeaBoxOpen) return null;
     return (
        <InteractiveWrapper>
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
           <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl relative max-h-[80vh] flex flex-col">
              <button onClick={() => setIsIdeaBoxOpen(false)} className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full"><X size={20}/></button>
              <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                 <Box className="text-amber-500"/> 想法收纳盒
              </h2>
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 p-1">
                 {archivedIdeas.length === 0 && (
                    <div className="text-center text-slate-400 py-10 flex flex-col items-center gap-2 border-2 border-dashed border-slate-100 rounded-xl">
                       <Lightbulb size={24} className="opacity-50"/>
                       <p>拖拽黄色便利贴到右侧侧边栏以收纳</p>
                    </div>
                 )}
                 {archivedIdeas.map(idea => (
                    <div key={idea.id} className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl shadow-sm rotate-0 hover:rotate-1 transition-transform relative group">
                        <p className="text-slate-800 font-medium">{idea.content}</p>
                        <div className="mt-2 text-[10px] text-yellow-700/60 font-bold uppercase flex justify-between items-center">
                            {format(idea.createdAt, 'yyyy/MM/dd HH:mm')}
                            <button 
                               onClick={() => {
                                  setArchivedIdeas(prev => prev.filter(i => i.id !== idea.id));
                                  setNotes(prev => [...prev, { ...idea, x: 150, y: 150 }]);
                                  setIsIdeaBoxOpen(false);
                               }}
                               className="opacity-0 group-hover:opacity-100 text-yellow-800 hover:text-yellow-900 transition-opacity"
                            >
                               取出
                            </button>
                        </div>
                    </div>
                 ))}
              </div>
           </div>
        </div>
        </InteractiveWrapper>
     );
  };

  const renderReviewModal = () => {
    if (!reviewNote) return null;
    return (
       <InteractiveWrapper>
       <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-red-100">
             <div className="flex flex-col items-center text-center mb-6">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-500 mb-4 animate-bounce"><AlertTriangle size={24} /></div>
                <h2 className="text-xl font-bold text-slate-800">时间破产</h2>
             </div>
             <div className="grid grid-cols-2 gap-3">
                <button onClick={() => { setNotes(prev => prev.map(n => n.id === reviewNote.id ? { ...n, status: NoteStatus.ACTIVE, timeLeft: 900 } : n)); setReviewNote(null); }} className="p-4 rounded-xl bg-indigo-50 text-indigo-700 font-bold">重试</button>
                <button onClick={() => { setLostTasks(prev => [...prev, { ...reviewNote, status: NoteStatus.LOST }]); setNotes(prev => prev.filter(n => n.id !== reviewNote.id)); setReviewNote(null); }} className="p-4 rounded-xl bg-slate-50 text-slate-600 font-bold">归档</button>
             </div>
          </div>
       </div>
       </InteractiveWrapper>
    );
  };
  
  const renderBrowserSetupModal = () => {
    if (!isBrowserSetupOpen) return null;
    return (
      <InteractiveWrapper>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
         <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2"><Globe size={18} className="text-indigo-500"/> 浏览预算</h3>
            <div className="grid grid-cols-2 gap-3 mb-4 mt-4">
               {[10, 20, 30, 45].map(min => <button key={min} onClick={() => startBrowserSession(min)} className="p-3 bg-slate-50 hover:bg-indigo-50 border border-slate-100 rounded-xl text-slate-600 font-bold">{min}分钟</button>)}
            </div>
            <button onClick={() => setIsBrowserSetupOpen(false)} className="w-full py-3 text-sm font-medium text-slate-400">取消</button>
         </div>
      </div>
      </InteractiveWrapper>
    )
  };

  const renderSummaryModal = () => {
    if (!isSummaryModalOpen) return null;
    
    const moodEmoji = summaryMoodScore >= 80 ? '🤩' : summaryMoodScore >= 60 ? '😊' : summaryMoodScore >= 40 ? '😐' : summaryMoodScore >= 20 ? '😔' : '😫';
    const moodLabel = summaryMoodScore >= 80 ? '非常棒' : summaryMoodScore >= 60 ? '还不错' : summaryMoodScore >= 40 ? '一般般' : summaryMoodScore >= 20 ? '有点累' : '精疲力竭';

    return (
      <InteractiveWrapper>
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl relative border border-slate-100">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-indigo-50 text-indigo-600 mb-4">
                <Moon size={32} />
              </div>
              <h2 className="text-2xl font-bold text-slate-800">辛苦了，下班总结</h2>
              <p className="text-slate-400 text-sm mt-1">记录下今天的心情和感悟吧</p>
            </div>

            <div className="space-y-8">
              {/* Mood Slider */}
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">今日心情评分</span>
                  <div className="flex items-center gap-2">
                    <span className="text-3xl">{moodEmoji}</span>
                    <span className="text-lg font-bold text-slate-700">{summaryMoodScore}</span>
                  </div>
                </div>
                <div className="relative h-12 flex items-center">
                  <input 
                    type="range" 
                    min="0" max="100" 
                    value={summaryMoodScore} 
                    onChange={(e) => setSummaryMoodScore(parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                  <div className="absolute -bottom-6 left-0 right-0 flex justify-between text-[10px] font-bold text-slate-300 uppercase">
                    <span>精疲力竭</span>
                    <span>非常棒</span>
                  </div>
                </div>
                <div className="text-center pt-2">
                  <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold">{moodLabel}</span>
                </div>
              </div>

              {/* Note Input */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">今日感悟</label>
                <textarea 
                  value={summaryNote}
                  onChange={(e) => setSummaryNote(e.target.value)}
                  placeholder="今天有什么想记录的吗？"
                  className="w-full h-32 p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none text-slate-700 text-sm"
                />
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setIsSummaryModalOpen(false)}
                  className="flex-1 py-4 rounded-2xl bg-slate-100 text-slate-500 font-bold hover:bg-slate-200 transition-colors"
                >
                  取消
                </button>
                <button 
                  onClick={handleConfirmClockOut}
                  className="flex-[2] py-4 rounded-2xl bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
                >
                  确认下班
                </button>
              </div>
            </div>
          </div>
        </div>
      </InteractiveWrapper>
    );
  };

  const renderSettingsModal = () => {
    if (!isSettingsOpen) return null;
    return (
      <InteractiveWrapper>
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-6 bg-slate-900/50 backdrop-blur-sm">
         <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl relative">
            <button onClick={() => setIsSettingsOpen(false)} className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full text-slate-400"><X size={20}/></button>
            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Settings className="text-slate-600" /> API 配置</h2>
            <div className="mb-6">
               <input type="password" value={apiKeyInput} onChange={(e) => setApiKeyInput(e.target.value)} placeholder="sk-..." className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm"/>
            </div>
            <button onClick={handleSaveSettings} className="w-full p-3 bg-indigo-600 text-white rounded-xl font-bold">保存并应用</button>
         </div>
      </div>
      </InteractiveWrapper>
    );
  };

  return (
    <div className="flex flex-row-reverse h-screen overflow-hidden bg-transparent font-sans text-slate-700 selection:bg-indigo-100 selection:text-indigo-900">
      {renderStatusSelector()}
      {renderFullCalendarModal()}
      {renderHistoryModal()}
      {renderSummaryModal()}
      {renderReviewModal()}
      {renderBrowserSetupModal()}
      {renderSettingsModal()}
      {renderIdeaBoxModal()}

      {/* --- SIDEBAR (Now on Right due to flex-row-reverse) --- */}
      <InteractiveWrapper>
      <div 
         className="w-80 flex-shrink-0 flex flex-col gap-6 p-6 border-l border-slate-200 bg-white/90 backdrop-blur-xl z-20 h-full relative shadow-neu-out overflow-hidden"
      >
        {mode === AppMode.IMMERSIVE && activeTask ? (
          <div className="flex flex-col h-full animate-in slide-in-from-right duration-500">
            <div className="flex items-center justify-between mb-8">
              <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-[0.2em]">专注模式</div>
              <button 
                onClick={handleRestoreTask} 
                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                title="退出专注"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 flex flex-col gap-8">
              <div className="space-y-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">正在进行</div>
                <h2 className="text-2xl font-bold text-slate-800 leading-tight">
                  {activeTask.steps[activeTask.currentStepIndex].text}
                </h2>
              </div>

              <div className="flex flex-col items-center justify-center py-12 bg-slate-50 rounded-3xl border border-slate-100 shadow-inner">
                <div className="text-5xl font-mono font-light text-slate-800 tabular-nums mb-2">
                  {new Date(timer * 1000).toISOString().substr(14, 5)}
                </div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">已专注时间</div>
              </div>

              <div className="space-y-4">
                <button 
                  onClick={handleCompleteStep} 
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={18} />
                  完成当前步骤
                </button>
                
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">任务目标</div>
                  <p className="text-xs text-slate-600 leading-relaxed italic">
                    "{activeTask.originalGoal}"
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-auto pt-6 border-t border-slate-100">
              <div className="flex items-center gap-2 text-slate-400">
                <Flame size={14} className="text-orange-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider">保持心流状态</span>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* 1. Enhanced Status */}
            <div className="flex flex-col gap-4">
               <div className="flex items-center justify-between gap-2">
                 <h1 className="text-xl font-light tracking-tight text-slate-800 flex items-center gap-2 truncate min-w-0">
                   <Layout size={20} className="text-slate-400 shrink-0"/> <span className="truncate">FlowState</span>
                 </h1>
                 <div className="flex gap-1 shrink-0">
                    {!activeWorkSession ? (
                      <button 
                        onClick={handleClockIn}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-100 transition-all text-[10px] font-bold uppercase tracking-wider"
                      >
                        <Sun size={12} />
                        上班
                      </button>
                    ) : (
                      <button 
                        onClick={handleClockOut}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 text-white border border-slate-700 hover:bg-slate-900 transition-all text-[10px] font-bold uppercase tracking-wider shadow-lg shadow-slate-200"
                      >
                        <Moon size={12} />
                        下班
                      </button>
                    )}
                 </div>
               </div>
               
               <button 
                 onClick={() => setIsStatusSelectorOpen(!isStatusSelectorOpen)}
                 className="w-full p-2 rounded-2xl bg-white border border-slate-200 hover:border-indigo-300 shadow-sm flex items-center gap-3 transition-all group"
               >
                  <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-colors", currentStatus?.color || "bg-slate-100")}>
                     {currentStatus?.icon || <Activity size={20} className="text-slate-400"/>}
                  </div>
                  <div className="text-left flex-1">
                     <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">当前状态</div>
                     <div className="font-bold text-slate-700">{currentStatus?.label || "请选择..."}</div>
                  </div>
                  <ChevronDown size={16} className="text-slate-300 group-hover:text-slate-500"/>
               </button>
            </div>

            {/* 2. Calendar / Time Machine */}
            <SidebarCard className="bg-white group">
               <div className="flex items-center justify-between mb-3">
                 <div className="flex items-center gap-2 text-slate-400">
                   <CalendarIcon size={14} />
                   <span className="text-[10px] font-bold uppercase tracking-wider">时光机</span>
                 </div>
                 <button onClick={() => setIsCalendarExpanded(true)} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-indigo-500 transition-colors" title="全月视图">
                    <Maximize size={12} />
                 </button>
               </div>
               <div className="grid grid-cols-7 gap-1">
                 {eachDayOfInterval({ 
                     start: addDays(today, -today.getDay()), 
                     end: addDays(today, -today.getDay() + 6) 
                 }).map((day, i) => {
                   const dateKey = format(day, 'yyyy-MM-dd');
                   const hasData = completedTasks.some(t => format(t.createdAt, 'yyyy-MM-dd') === dateKey);
                   const dayIndex = day.getDay();
                   const dayLabel = ['日', '一', '二', '三', '四', '五', '六'][dayIndex];
                   return (
                     <button
                       key={i}
                       onClick={() => setSelectedDate(day)}
                       className={cn(
                         "flex flex-col items-center justify-center rounded-lg py-2 transition-all relative hover:bg-slate-50",
                         isSameDay(day, new Date()) ? "bg-indigo-50 text-indigo-600 font-bold" : "text-slate-500"
                       )}
                     >
                       <span className="text-[10px] opacity-60 mb-1">{dayLabel}</span>
                       <span className="text-sm">{format(day, 'd')}</span>
                       <div className="flex gap-0.5 mt-1 h-1">{hasData && <div className="w-1 h-1 rounded-full bg-emerald-400"/>}</div>
                     </button>
                   )
                 })}
               </div>
            </SidebarCard>

            {/* 4. Interactive Stats & Idea Box */}
            <div className="mt-auto flex flex-col gap-4">
               {/* Idea Box (Interactive Drop Zone) */}
               <SidebarCard 
                    onClick={() => setIsIdeaBoxOpen(true)}
                    className={cn(
                        "group cursor-pointer border-dashed relative overflow-hidden transition-all duration-300",
                        isDragIdeaActive ? "border-amber-400 bg-amber-50 scale-105 shadow-lg shadow-amber-100" : "hover:border-amber-300 hover:bg-amber-50/50"
                    )}
                >
                    {/* Lid Animation visual */}
                    <div className={cn(
                        "absolute top-0 left-0 w-full h-1 bg-amber-400 transition-all duration-300 origin-top",
                        isDragIdeaActive ? "h-2 opacity-100" : "h-0 opacity-0"
                    )} />
                    
                    <div className="flex items-center justify-between mb-3 relative z-10">
                        <div className="flex items-center gap-2 text-slate-400 group-hover:text-amber-600 transition-colors">
                            <Box size={14} className={cn("transition-transform duration-300", isDragIdeaActive ? "-translate-y-1 rotate-[-10deg]" : "")}/>
                            <span className="text-[10px] font-bold uppercase tracking-wider">想法收纳</span>
                        </div>
                        <div className="bg-slate-100 group-hover:bg-amber-100 text-slate-500 group-hover:text-amber-700 px-2 py-0.5 rounded-md text-xs font-bold transition-colors">
                            {archivedIdeas.length}
                        </div>
                    </div>
                    
                    <div className="h-16 flex items-center justify-center text-slate-300 group-hover:text-amber-400 transition-colors">
                        {isDragIdeaActive ? (
                            <div className="flex flex-col items-center animate-in fade-in zoom-in">
                                <ArrowRight className="rotate-90 text-amber-500" size={24} />
                                <span className="text-xs font-bold text-amber-600 mt-1">放入归档</span>
                            </div>
                        ) : (
                            <div className="flex gap-1">
                                <div className="w-8 h-10 bg-slate-100 rounded border border-slate-200 rotate-[-5deg]" />
                                <div className="w-8 h-10 bg-slate-100 rounded border border-slate-200 rotate-[5deg] -ml-4" />
                            </div>
                        )}
                    </div>
               </SidebarCard>

               <SidebarCard className="bg-emerald-50/50 border-emerald-100">
                  <div className="flex justify-between items-center mb-2">
                     <span className="text-xs font-bold text-emerald-700 uppercase">今日日志</span>
                     <span className="text-2xl font-light text-emerald-700">{completedTasks.length}</span>
                  </div>
                  <button onClick={() => setIsLogOpen(!isLogOpen)} className="w-full flex items-center justify-between text-xs text-emerald-600 font-medium hover:underline">
                     <span>查看已完成</span>
                     {isLogOpen ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                  </button>
                  {isLogOpen && (
                     <div className="mt-3 space-y-2 border-t border-emerald-200/50 pt-2 animate-in slide-in-from-top-2 max-h-32 overflow-y-auto custom-scrollbar">
                        {completedTasks.length === 0 && <span className="text-xs text-emerald-500 italic">暂无任务</span>}
                        {completedTasks.map(t => <div key={t.id} className="flex items-center gap-2 text-xs text-slate-600"><CheckCircle2 size={12} className="text-emerald-500 shrink-0"/><span className="truncate">{t.originalGoal}</span></div>)}
                     </div>
                  )}
               </SidebarCard>
               <button onClick={() => setIsSettingsOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors text-xs font-medium"><Settings size={14} /><span>系统设置</span></button>
            </div>
          </>
        )}
      </div>
      </InteractiveWrapper>

      {/* --- CANVAS (The Action Zone) --- */}
      <div className="flex-1 relative flex flex-col z-30 pointer-events-none">
         {/* Background pattern - Removed for transparency */}
         {/* <div className="absolute inset-0 z-0 opacity-[0.3]" style={{ backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)', backgroundSize: '32px 32px' }} /> */}

         {/* Immersive Overlay - Removed from here as it's now in the sidebar */}

         {/* Browser Overlay - Make Interactable */}
         {mode === AppMode.BROWSER && (
             <InteractiveWrapper>
             <div className="absolute inset-0 z-50 bg-white flex flex-col animate-in slide-in-from-bottom-10 duration-300 pointer-events-auto">
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
             </InteractiveWrapper>
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
            onUpdateColorLabel={(id, name) => {
              setColorLabels(prev => prev.map(l => l.id === id ? { ...l, name } : l));
            }}
            disabled={mode !== AppMode.DASHBOARD}
            className="w-full h-full z-10"
         />

      </div>
    </div>
  );
}