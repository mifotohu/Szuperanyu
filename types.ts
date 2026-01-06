
export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'none';

export interface GoogleAccount {
  email: string;
  accessToken: string;
  expiresAt: number;
}

export interface Task {
  id: string;
  description: string;
  completed: boolean;
  dueDate?: string;
  recurrence?: RecurrenceFrequency;
  priority: 'critical' | 'high' | 'medium' | 'low';
  createdAt: number;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  recurrence?: RecurrenceFrequency;
  isConfirmed: boolean;
}

export interface GeminiResponse {
  type: 'task' | 'event' | 'query' | 'completion' | 'email' | 'clarification';
  textResponse: string;
  calendarData?: {
    summary: string;
    start: string;
    end: string;
    recurrence?: RecurrenceFrequency;
  };
  taskData?: {
    description: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    dueDate?: string;
    recurrence?: RecurrenceFrequency;
  };
  emailData?: {
    subject: string;
    body: string;
  };
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  data?: GeminiResponse;
}
