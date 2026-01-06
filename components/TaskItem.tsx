
import React from 'react';
import { Task } from '../types';

interface TaskItemProps {
  task: Task;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

const TaskItem: React.FC<TaskItemProps> = ({ task, onToggle, onDelete }) => {
  const priorityStyles = {
    critical: 'bg-red-500 text-white',
    high: 'bg-rose-100 text-rose-600',
    medium: 'bg-amber-100 text-amber-600',
    low: 'bg-emerald-100 text-emerald-600',
  };

  const getRecurrenceLabel = (r: Task['recurrence']) => {
    switch(r) {
      case 'daily': return 'Naponta';
      case 'weekly': return 'Hetente';
      case 'monthly': return 'Havonta';
      default: return null;
    }
  };

  return (
    <div className={`flex items-center justify-between p-4 mb-3 bg-white rounded-[24px] shadow-sm border-l-4 transition-all ${task.completed ? 'opacity-50 grayscale border-gray-200' : task.priority === 'critical' ? 'border-red-500' : 'border-pink-300'}`}>
      <div className="flex items-center gap-3">
        <button 
          onClick={() => onToggle(task.id)}
          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${task.completed ? 'bg-pink-500 border-pink-500' : 'border-pink-100 hover:border-pink-300'}`}
        >
          {task.completed && <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
        </button>
        <div>
          <p className={`text-sm font-semibold text-gray-800 ${task.completed ? 'line-through' : ''}`}>{task.description}</p>
          <div className="flex gap-2 mt-1 items-center">
            <span className={`text-[8px] uppercase font-black px-1.5 py-0.5 rounded-md ${priorityStyles[task.priority]}`}>{task.priority}</span>
            {task.recurrence && task.recurrence !== 'none' && (
              <span className="text-[9px] text-pink-500 font-bold flex items-center gap-1 bg-pink-50 px-1.5 py-0.5 rounded-md">
                🔄 {getRecurrenceLabel(task.recurrence)}
              </span>
            )}
            {task.dueDate && <span className="text-[9px] text-gray-400 font-medium">📅 {task.dueDate}</span>}
          </div>
        </div>
      </div>
      <button onClick={() => onDelete(task.id)} className="text-gray-200 hover:text-rose-400 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
      </button>
    </div>
  );
};

export default TaskItem;
