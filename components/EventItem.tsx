
import React from 'react';
import { CalendarEvent } from '../types';

interface EventItemProps {
  event: CalendarEvent;
  onDelete: (id: string) => void;
}

const EventItem: React.FC<EventItemProps> = ({ event, onDelete }) => {
  const formatTime = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      return date.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
    } catch { return isoStr; }
  };

  const getRecurrenceLabel = (r: CalendarEvent['recurrence']) => {
    switch(r) {
      case 'daily': return 'Minden nap';
      case 'weekly': return 'Hetente';
      case 'monthly': return 'Havonta';
      default: return null;
    }
  };

  return (
    <div className="flex items-center gap-3 p-4 mb-3 bg-white border border-pink-100 rounded-[24px] shadow-sm">
      <div className="bg-pink-500 text-white p-2.5 rounded-xl shadow-pink-100 shadow-lg">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-gray-800 text-sm truncate">{event.summary}</h4>
        <div className="flex items-center gap-2">
          <p className="text-xs text-pink-500 font-bold">{formatTime(event.start)}</p>
          {event.recurrence && event.recurrence !== 'none' && (
            <span className="text-[10px] text-pink-300 font-bold bg-pink-50/50 px-2 py-0.5 rounded-full flex items-center gap-1">
              🔄 {getRecurrenceLabel(event.recurrence)}
            </span>
          )}
        </div>
      </div>
      <button onClick={() => onDelete(event.id)} className="text-gray-200 hover:text-rose-400 p-1">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
      </button>
    </div>
  );
};

export default EventItem;
