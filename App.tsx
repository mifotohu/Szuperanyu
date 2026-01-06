
import React, { useState, useEffect, useRef } from 'react';
import { Task, CalendarEvent, ChatMessage, GeminiResponse, GoogleAccount } from './types';
import { processUserInput } from './services/geminiService';
import TaskItem from './components/TaskItem';
import EventItem from './components/EventItem';

const STORAGE_KEY = 'supermom_v9_real_google';
const GOOGLE_ACCOUNTS_KEY = 'supermom_google_accounts';
// MEGJEGYZÉS: Valós környezetben ehhez a Google Cloud Console-ban be kell állítani az authorized origin-t!
const CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com"; 

const App: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [googleAccounts, setGoogleAccounts] = useState<GoogleAccount[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'chat'>('dashboard');
  const [showAccountSelector, setShowAccountSelector] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    // Adatok betöltése
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setTasks(parsed.tasks || []);
        setEvents(parsed.events || []);
      } catch (e) { console.error(e); }
    }
    
    const savedAccounts = localStorage.getItem(GOOGLE_ACCOUNTS_KEY);
    if (savedAccounts) {
      try {
        const parsed = JSON.parse(savedAccounts);
        // Csak a nem lejárt tokeneket tartjuk meg
        setGoogleAccounts(parsed.filter((acc: GoogleAccount) => acc.expiresAt > Date.now()));
      } catch (e) { console.error(e); }
    }

    setMessages([{
      role: 'assistant',
      content: 'Szia! Szuperanyu asszisztens készen áll. Most már elmenthetem a dolgaidat a valódi Google Naptáradba is! Próbáld ki: "Minden kedden 8-kor úszás". ✨',
      timestamp: Date.now()
    }]);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks, events }));
  }, [tasks, events]);

  useEffect(() => {
    localStorage.setItem(GOOGLE_ACCOUNTS_KEY, JSON.stringify(googleAccounts));
  }, [googleAccounts]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (text?: string) => {
    const msg = text || inputValue;
    if (!msg.trim() || isLoading) return;
    if (!text) {
      setMessages(prev => [...prev, { role: 'user', content: msg, timestamp: Date.now() }]);
      setInputValue('');
    }
    setIsLoading(true);

    try {
      const res = await processUserInput(msg, `MA: ${todayStr}`);
      setMessages(prev => [...prev, { role: 'assistant', content: res.textResponse, timestamp: Date.now(), data: res }]);

      if (res.type === 'task' && res.taskData) {
        setTasks(prev => [{
          id: Math.random().toString(36).substr(2, 9),
          description: res.taskData!.description,
          completed: false,
          priority: res.taskData!.priority || 'medium',
          dueDate: res.taskData!.dueDate,
          recurrence: res.taskData!.recurrence,
          createdAt: Date.now()
        }, ...prev]);
      }

      if (res.type === 'event' && res.calendarData) {
        setEvents(prev => [...prev, {
          id: Math.random().toString(36).substr(2, 9),
          summary: res.calendarData!.summary,
          start: res.calendarData!.start,
          end: res.calendarData!.end || res.calendarData!.start,
          recurrence: res.calendarData!.recurrence,
          isConfirmed: true
        }].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()));
      }
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  const getRecurrenceRule = (freq?: string) => {
    if (!freq || freq === 'none') return null;
    if (freq === 'daily') return ["RRULE:FREQ=DAILY"];
    if (freq === 'weekly') return ["RRULE:FREQ=WEEKLY"];
    if (freq === 'monthly') return ["RRULE:FREQ=MONTHLY"];
    return null;
  };

  const addNewGoogleAccount = () => {
    if (CLIENT_ID === "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com") {
      alert("Kérlek, add meg a Google Client ID-t az index.tsx fájlban a valós integrációhoz! (Google Cloud Console -> APIs -> Credentials)");
      // Demonstrációs célból egy fake fiókot hozzáadunk, ha nincs beállítva ID
      const fakeAccount: GoogleAccount = {
        email: 'demo@szuperanyu.hu',
        accessToken: 'fake_token',
        expiresAt: Date.now() + 3600000
      };
      setGoogleAccounts(prev => [...prev, fakeAccount]);
      return;
    }

    const client = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/calendar.events',
      callback: async (response: any) => {
        if (response.access_token) {
          // Itt le kellene kérni az emailt a userinfo API-val, de az egyszerűség kedvéért most egy promptot kérünk
          const email = prompt("Kérlek add meg a Google email címedet az azonosításhoz:") || "Ismeretlen";
          const newAccount: GoogleAccount = {
            email: email,
            accessToken: response.access_token,
            expiresAt: Date.now() + (response.expires_in * 1000)
          };
          setGoogleAccounts(prev => [...prev, newAccount]);
        }
      },
    });
    client.requestAccessToken();
  };

  const exportToGoogle = async (account: GoogleAccount) => {
    setIsExporting(true);
    setShowAccountSelector(false);
    
    let successCount = 0;
    const allItems = [...events.map(e => ({ ...e, type: 'event' })), ...tasks.map(t => ({ ...t, type: 'task' }))];

    for (const item of allItems) {
      const isTask = 'description' in item;
      const rrule = getRecurrenceRule(item.recurrence);
      
      const eventResource = {
        summary: isTask ? (item as any).description : (item as any).summary,
        description: isTask ? `Szuperanyu teendő (Prioritás: ${(item as any).priority})` : 'Szuperanyu naptári esemény',
        start: {
          dateTime: isTask ? `${(item as any).dueDate}T09:00:00Z` : (item as any).start.includes('T') ? (item as any).start + "Z" : `${(item as any).start}T09:00:00Z`,
          timeZone: 'Europe/Budapest',
        },
        end: {
          dateTime: isTask ? `${(item as any).dueDate}T10:00:00Z` : (item as any).end.includes('T') ? (item as any).end + "Z" : `${(item as any).end}T10:00:00Z`,
          timeZone: 'Europe/Budapest',
        },
        recurrence: rrule ? rrule : undefined
      };

      try {
        if (account.accessToken === 'fake_token') {
            await new Promise(r => setTimeout(r, 200));
            successCount++;
            continue;
        }

        const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${account.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(eventResource)
        });

        if (response.ok) successCount++;
      } catch (e) { console.error("Export error", e); }
    }

    setIsExporting(false);
    alert(`${account.email} fiókba sikeresen exportálva ${successCount} elem! 🎉`);
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#fdf2f8] flex flex-col shadow-2xl relative overflow-hidden">
      <header className="bg-white/95 backdrop-blur-md p-4 border-b border-pink-100 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="bg-pink-500 w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 2a1 1 0 00-1 1v1a1 1 0 002 0V3a1 1 0 00-1-1zM4 4h3a3 3 0 006 0h3a2 2 0 012 2v9a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zm2.5 7a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm2.45 4a2.5 2.5 0 104.9 0h-4.9z" clipRule="evenodd" /></svg>
          </div>
          <div className="leading-tight">
            <h1 className="font-black text-gray-800 text-xs uppercase tracking-tight">Szuperanyu</h1>
            <p className="text-[8px] text-pink-400 font-bold uppercase tracking-widest">Digital Assistant</p>
          </div>
        </div>
        <div className="flex gap-1 bg-pink-50 p-1 rounded-2xl">
          <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all ${activeTab === 'dashboard' ? 'bg-white text-pink-600 shadow-sm' : 'text-pink-300'}`}>LISTA</button>
          <button onClick={() => setActiveTab('chat')} className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all ${activeTab === 'chat' ? 'bg-white text-pink-600 shadow-sm' : 'text-pink-300'}`}>CHAT</button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 pb-48">
        {activeTab === 'dashboard' ? (
          <div className="space-y-6 animate-in fade-in duration-500">
            <section>
              <h2 className="text-[10px] font-black uppercase text-pink-500 mb-4 tracking-[0.2em] px-1 flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-pink-500 rounded-full"></div> Események
              </h2>
              {events.length === 0 ? <p className="text-xs text-pink-200 italic px-1">Nincsenek események...</p> : 
                events.map(e => <EventItem key={e.id} event={e} onDelete={(id) => setEvents(prev => prev.filter(ev => ev.id !== id))} />)
              }
            </section>
            <section>
              <h2 className="text-[10px] font-black uppercase text-pink-500 mb-4 tracking-[0.2em] px-1 flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-pink-500 rounded-full"></div> Teendők
              </h2>
              {tasks.length === 0 ? <p className="text-xs text-pink-200 italic px-1">Üres a lista...</p> : 
                tasks.map(t => <TaskItem key={t.id} task={t} onToggle={(id) => setTasks(prev => prev.map(tk => tk.id === id ? {...tk, completed: !tk.completed} : tk))} onDelete={(id) => setTasks(prev => prev.filter(tk => tk.id !== id))} />)
              }
            </section>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2`}>
                <div className={`max-w-[85%] p-4 rounded-3xl text-sm shadow-sm ${m.role === 'user' ? 'bg-gray-800 text-white rounded-tr-none' : 'bg-white text-gray-800 rounded-tl-none border border-pink-50'}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {isLoading && <div className="text-[10px] font-black text-pink-300 animate-pulse uppercase tracking-widest ml-2">Szuperanyu gondolkodik... ✨</div>}
            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      {/* Floating Action Button for Export */}
      {activeTab === 'dashboard' && (tasks.length > 0 || events.length > 0) && (
        <div className="fixed bottom-24 left-0 right-0 max-w-md mx-auto px-6 pointer-events-none">
          <button 
            onClick={() => setShowAccountSelector(true)}
            disabled={isExporting}
            className="w-full bg-white border border-pink-100 text-gray-700 py-4 rounded-3xl shadow-2xl flex items-center justify-center gap-3 font-black text-[10px] uppercase tracking-wider pointer-events-auto active:scale-95 transition-all hover:bg-pink-50 ring-4 ring-pink-50/50"
          >
            {isExporting ? (
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 border-2 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
                Szinkronizálás...
              </div>
            ) : (
              <>
                <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-sm">
                  <img src="https://www.google.com/favicon.ico" className="w-3 h-3" alt="G" />
                </div>
                Mentés Google Naptárba
              </>
            )}
          </button>
        </div>
      )}

      {/* Modern Chat Input Bar */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-5 bg-gradient-to-t from-[#fdf2f8] via-[#fdf2f8]/90 to-transparent">
        <div className="bg-white p-2 rounded-[2rem] shadow-2xl flex items-center border border-pink-100 ring-4 ring-pink-50/50">
          <input 
            type="text" 
            value={inputValue} 
            onChange={e => setInputValue(e.target.value)} 
            onKeyPress={e => e.key === 'Enter' && handleSendMessage()} 
            placeholder="Mit rögzítsek? 🤱" 
            className="flex-1 bg-transparent px-5 py-2 text-sm font-medium focus:outline-none placeholder-pink-200"
          />
          <button 
            onClick={() => handleSendMessage()} 
            disabled={!inputValue.trim() || isLoading} 
            className="bg-pink-500 text-white w-11 h-11 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all disabled:bg-pink-100"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
          </button>
        </div>
      </div>

      {/* Account Selector Modal */}
      {showAccountSelector && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center p-4 overflow-hidden">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl animate-in slide-in-from-bottom-10 duration-500">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-black text-gray-800">Google Fiókok</h3>
                <p className="text-[10px] text-pink-400 font-bold uppercase mt-1">Válassz célállomást</p>
              </div>
              <button onClick={() => setShowAccountSelector(false)} className="text-gray-300 hover:text-gray-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
              {googleAccounts.map(acc => (
                <button 
                  key={acc.email}
                  onClick={() => exportToGoogle(acc)}
                  className="w-full p-5 rounded-3xl border-2 border-pink-50 hover:border-pink-200 hover:bg-pink-50 transition-all text-left flex items-center justify-between group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center text-sm font-black text-pink-500 border border-pink-100">
                      {acc.email.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span className="block text-xs font-black text-gray-800">{acc.email}</span>
                      <span className="text-[9px] text-green-500 font-bold uppercase tracking-widest">Aktív Token</span>
                    </div>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-pink-200 group-hover:text-pink-400 transition-colors" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                </button>
              ))}

              <button 
                onClick={addNewGoogleAccount}
                className="w-full p-5 rounded-3xl border-2 border-dashed border-pink-100 hover:border-pink-300 hover:bg-pink-50 transition-all flex items-center gap-4 group"
              >
                <div className="w-10 h-10 rounded-2xl bg-pink-100 flex items-center justify-center text-pink-500 group-hover:bg-pink-500 group-hover:text-white transition-all">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                </div>
                <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Új fiók hozzáadása</span>
              </button>
            </div>

            <p className="mt-8 text-[9px] text-gray-300 text-center leading-relaxed">
              Az adataidat közvetlenül a Google szervereire küldjük.<br/>Szuperanyu vigyáz a privát szférádra! 🌸
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
