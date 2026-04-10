export enum AppMode {
  DASHBOARD = 'DASHBOARD',
  IMMERSIVE = 'IMMERSIVE',
  BROWSER = 'BROWSER'
}

// Add global declaration for Electron bridge
declare global {
  interface Window {
    electron?: {
      setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => void;
      quitApp: () => void;
    };
  }
}

export interface StatusCategory {
  id: string;
  label: string;
  icon: string;
  category: 'FOCUS' | 'ENERGY' | 'EMOTION' | 'BODY';
  score: number; // 0-100 score for the chart
  color: string;
}

export interface StatusLog {
  timestamp: number;
  statusId: string;
  score: number; // Captured score at the time
  note?: string;
}

export interface WorkSession {
  id: string;
  startTime: number;
  endTime: number | null;
}

export interface DailySummary {
  date: string; // YYYY-MM-DD
  moodScore: number;
  note: string;
  workSessionId: string;
}

export interface MicroStep {
  id: string;
  text: string;
  estimatedMinutes: number;
  isCompleted: boolean;
}

export interface TaskSession {
  id: string;
  originalGoal: string;
  aiReformulatedGoal: string;
  steps: MicroStep[];
  currentStepIndex: number;
  createdAt: number;
  deadline?: number;
  status: 'active' | 'completed' | 'paused';
  // Restore Data
  originalX?: number;
  originalY?: number;
  originalType?: StickyType;
}

export interface BrowserSession {
  url: string;
  isActive: boolean;
  timeLimit: number; // minutes
}

export enum StickyType {
  TASK = 'TASK',
  IDEA = 'IDEA',
}

export enum NoteStatus {
  DRAFT = 'DRAFT',         // 1. User is typing
  ACTIVE = 'ACTIVE',       // 2. Visible on board
  LOST = 'LOST'            // 3. Deleted or archived
}

export interface ColorLabel {
  id: string;
  color: string; // hex or tailwind class
  name: string;
}

export interface StickyNote {
  id: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  zIndex?: number;
  content: string;
  type: StickyType;
  createdAt: number;
  
  // Lifecycle Props
  status: NoteStatus;
  totalDuration: number; // seconds
  timeLeft: number; // seconds
  colorLabelId?: string;
}

// EXPANDED STATUS MATRIX
export const STATUS_MATRIX: StatusCategory[] = [
  // High Focus (80-100)
  { id: 'flow', label: '心流', icon: '🚀', category: 'FOCUS', score: 100, color: 'text-indigo-600 bg-indigo-50' },
  { id: 'deep', label: '深度工作', icon: '🧠', category: 'FOCUS', score: 90, color: 'text-blue-600 bg-blue-50' },
  { id: 'fire', label: '极度专注', icon: '🔥', category: 'FOCUS', score: 95, color: 'text-orange-600 bg-orange-50' },
  { id: 'sharp', label: '敏锐', icon: '🔪', category: 'FOCUS', score: 85, color: 'text-teal-600 bg-teal-50' },
  { id: 'productive', label: '高效', icon: '📈', category: 'FOCUS', score: 80, color: 'text-emerald-600 bg-emerald-50' },
  
  // Energy / Body (40-70)
  { id: 'recharge', label: '充电中', icon: '🔋', category: 'ENERGY', score: 60, color: 'text-emerald-600 bg-emerald-50' },
  { id: 'neutral', label: '平静', icon: '😐', category: 'EMOTION', score: 50, color: 'text-slate-500 bg-slate-50' },
  { id: 'calm', label: '放松', icon: '😌', category: 'EMOTION', score: 70, color: 'text-sky-600 bg-sky-50' },
  { id: 'excited', label: '兴奋', icon: '🤩', category: 'EMOTION', score: 85, color: 'text-yellow-500 bg-yellow-50' },
  { id: 'medicated', label: '已服药', icon: '💊', category: 'BODY', score: 65, color: 'text-purple-600 bg-purple-50' },
  { id: 'rested', label: '精力充沛', icon: '✨', category: 'ENERGY', score: 80, color: 'text-amber-500 bg-amber-50' },

  // Low Energy / Negative (0-40)
  { id: 'sluggish', label: '迟缓', icon: '🐌', category: 'ENERGY', score: 30, color: 'text-yellow-600 bg-yellow-50' },
  { id: 'tired', label: '疲惫', icon: '🛌', category: 'ENERGY', score: 20, color: 'text-slate-600 bg-slate-50' },
  { id: 'hungry', label: '饿了', icon: '🍔', category: 'BODY', score: 35, color: 'text-orange-500 bg-orange-50' },
  { id: 'pain', label: '疼痛', icon: '🤕', category: 'BODY', score: 10, color: 'text-red-800 bg-red-50' },
  { id: 'anxious', label: '焦虑', icon: '😰', category: 'EMOTION', score: 25, color: 'text-rose-600 bg-rose-50' },
  { id: 'overwhelmed', label: '过载', icon: '🌪️', category: 'EMOTION', score: 15, color: 'text-gray-600 bg-gray-50' },
  { id: 'paralysis', label: '僵住', icon: '🧊', category: 'EMOTION', score: 5, color: 'text-cyan-800 bg-cyan-50' },
  { id: 'bored', label: '无聊', icon: '🥱', category: 'EMOTION', score: 40, color: 'text-zinc-500 bg-zinc-100' },
  { id: 'guilty', label: '内疚', icon: '😔', category: 'EMOTION', score: 20, color: 'text-indigo-900 bg-indigo-50' },
  { id: 'chaos', label: '捣蛋鬼', icon: '👺', category: 'EMOTION', score: 55, color: 'text-pink-600 bg-pink-50' },
  { id: 'distracted', label: '分心', icon: '🦋', category: 'FOCUS', score: 45, color: 'text-purple-400 bg-purple-50' },
];
