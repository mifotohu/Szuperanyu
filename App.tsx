
import React, { useState, useEffect, useRef } from 'react';
import { Task, CalendarEvent, ChatMessage, GeminiResponse, GoogleAccount } from './types';
import { processUserInput } from './services/geminiService';
import TaskItem from './components/TaskItem';
import EventItem from './components/EventItem';

const STORAGE_KEY = 'supermom_v11_final';
const GOOGLE_ACCOUNTS_KEY = 'supermom_google_accounts';
const CLIENT_ID_KEY = 'supermom_client_id_config';

const App: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [googleAccounts, setGoogleAccounts] = useState<GoogleAccount[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'chat'>('dashboard');
  const [showAccountSelector, setShowAccountSelector] = useState(false);
  const [showConfigHelp, setShowConfigHelp] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  // Google Client ID state with expiry logic
  const [clientId, setClientId] = useState<string>('');
  const [clientIdExpiry, setClientIdExpiry] = useState<number | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load Client ID and check expiry
    const savedConfig = localStorage.getItem(CLIENT_ID_KEY);
    if (savedConfig) {
      try {
        const { value, expiry } = JSON.parse(savedConfig);
        if (Date.now() < expiry) {
          setClientId(value);
          setClientIdExpiry(expiry);
        } else {
          localStorage.removeItem(CLIENT_ID_KEY);
        }
      } catch (e) {
        localStorage.removeItem(CLIENT_ID_KEY);
      }
    }

    // Load tasks/events
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setTasks(parsed.tasks || []);
        setEvents(parsed.events || []);
      } catch (e) { console.error(e); }
    }
    
    // Load accounts
    const savedAccounts = localStorage.getItem(GOOGLE_ACCOUNTS_KEY);
    if (savedAccounts) {
      try {
        const parsed = JSON.parse(savedAccounts);
        setGoogleAccounts(parsed.filter((acc: GoogleAccount) => acc.expiresAt > Date.now()));
      } catch (e) { console.error(e); }
    }

    setMessages([{
      role: 'assistant',
      content: 'Szia! Szuperanyu asszisztens készen áll. Ha szeretnéd a Google Naptáradat is használni, ne felejtsd el beírni a kódot a felső mezőbe! ✨',
      timestamp: Date.now()
    }]);
  }, []);

  const saveClientId = (id: string) => {
    const expiry = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    setClientId(id);
    setClientIdExpiry(expiry);
    localStorage.setItem(CLIENT_ID_KEY, JSON.stringify({ value: id, expiry }));
  };

  const getTimeRemaining = () => {
    if (!clientIdExpiry) return null;
    const diff = clientIdExpiry - Date.now();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    return `${hours} óra`;
  };

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

  const addNewGoogleAccount = () => {
    if (!clientId) {
      alert("Kérlek, előbb add meg a Google kódot a felső mezőben!");
      return;
    }

    try {
      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/calendar.events',
        callback: async (response: any) => {
          if (response.access_token) {
            const email = prompt("Kérlek add meg a Google email címedet:") || "Ismeretlen";
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
    } catch (e) {
      alert("Hiba a csatlakozáskor. Ellenőrizd a kódot!");
      console.error(e);
    }
  };

  const exportToGoogle = async (account: GoogleAccount) => {
    setIsExporting(true);
    setShowAccountSelector(false);
    
    let successCount = 0;
    const allItems = [...events, ...tasks.filter(t => !t.completed).map(t => ({
      summary: t.description,
      start: `${t.dueDate}T09:00:00`,
      end: `${t.dueDate}T10:00:00`,
      recurrence: t.recurrence,
      isConfirmed: true,
      id: t.id
    }))];

    for (const item of allItems) {
      const eventResource = {
        summary: (item as any).summary || (item as any).description,
        start: { dateTime: (item as any).start.includes('T') ? (item as any).start + "Z" : `${(item as any).start}T09:00:00Z` },
        end: { dateTime: (item as any).end.includes('T') ? (item as any).end + "Z" : `${(item as any).end}T10:00:00Z` },
      };

      try {
        const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${account.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(eventResource)
        });
        if (response.ok) successCount++;
      } catch (e) { console.error(e); }
    }

    setIsExporting(false);
    alert(`${account.email} fiókba sikeresen exportálva! 🌸`);
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#fdf2f8] flex flex-col shadow-2xl relative overflow-hidden">
      {/* Top Google Config Bar */}
      <div className="bg-white border-b border-pink-100 p-3 shadow-sm z-[60]">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input 
              type="password"
              value={clientId}
              onChange={(e) => saveClientId(e.target.value)}
              placeholder="Google Client ID (pl. 23498...)"
              className="w-full text-[10px] p-2 pl-3 rounded-xl bg-pink-50/30 border border-pink-100 focus:outline-none focus:ring-1 focus:ring-pink-300 placeholder-pink-200 font-medium"
            />
            {clientId && (
              <span className="absolute right-2 top-1.5 text-[8px] font-bold text-green-500 bg-white px-1 rounded shadow-sm">
                Mentve: {getTimeRemaining()}
              </span>
            )}
          </div>
          <button 
            onClick={() => setShowConfigHelp(!showConfigHelp)}
            className="w-8 h-8 rounded-xl bg-pink-100 text-pink-500 flex items-center justify-center hover:bg-pink-200 transition-colors"
            title="Segítség a kód megszerzéséhez"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </button>
        </div>
        
        {/* Help Tooltip Content */}
        {showConfigHelp && (
          <div className="mt-2 p-3 bg-white rounded-xl border border-pink-100 shadow-xl animate-in fade-in slide-in-from-top-2 duration-300">
            <h4 className="text-[10px] font-black text-gray-800 uppercase mb-2 tracking-wider">Hogyan szerezzek kódot?</h4>
            <div className="text-[9px] text-gray-600 space-y-1.5 leading-relaxed">
              <p>1. Lépj be a <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-pink-500 underline font-bold">Google Cloud Console</a> oldalra.</p>
              <p>2. Hozz létre egy új projektet (pl. "Szuperanyu").</p>
              <p>3. Kapcsold be a <b>Google Calendar API</b>-t.</p>
              <p>4. Hozz létre egy <b>OAuth Client ID</b>-t (Web Application).</p>
              <p>5. Az 'Authorized JavaScript Origins' mezőbe add meg az oldal címét.</p>
              <p className="p-1.5 bg-pink-50 text-pink-500 rounded-lg font-bold border border-pink-100 italic">
                A kód biztonsági okokból 24 óra után automatikusan törlődik a böngésződből!
              </p>
            </div>
            <button 
              onClick={() => setShowConfigHelp(false)}
              className="mt-3 w-full py-1 text-[9px] font-black text-gray-400 hover:text-gray-600"
            >
              Értem, köszönöm!
            </button>
          </div>
        )}
      </div>

      <header className="bg-white/95 backdrop-blur-md p-4 border-b border-pink-100 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="bg-pink-500 w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-lg">🤱</div>
          <div>
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
          <div className="space-y-6">
            <section>
              <h2 className="text-[10px] font-black uppercase text-pink-500 mb-4 tracking-[0.2em] px-1">📅 Események</h2>
              {events.length === 0 ? <p className="text-xs text-pink-200 italic px-1">Nincsenek események...</p> : 
                events.map(e => <EventItem key={e.id} event={e} onDelete={(id) => setEvents(prev => prev.filter(ev => ev.id !== id))} />)
              }
            </section>
            <section>
              <h2 className="text-[10px] font-black uppercase text-pink-500 mb-4 tracking-[0.2em] px-1">✅ Teendők</h2>
              {tasks.length === 0 ? <p className="text-xs text-pink-200 italic px-1">Üres a lista...</p> : 
                tasks.map(t => <TaskItem key={t.id} task={t} onToggle={(id) => setTasks(prev => prev.map(tk => tk.id === id ? {...tk, completed: !tk.completed} : tk))} onDelete={(id) => setTasks(prev => prev.filter(tk => tk.id !== id))} />)
              }
            </section>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-4 rounded-3xl text-sm shadow-sm ${m.role === 'user' ? 'bg-gray-800 text-white rounded-tr-none' : 'bg-white text-gray-800 rounded-tl-none border border-pink-50'}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {isLoading && <div className="text-[10px] font-black text-pink-300 animate-pulse uppercase tracking-widest ml-2">Szuperanyu dolgozik... ✨</div>}
            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      {/* Floating Action Button */}
      {activeTab === 'dashboard' && (tasks.length > 0 || events.length > 0) && (
        <div className="fixed bottom-24 left-0 right-0 max-w-md mx-auto px-6 pointer-events-none">
          <button 
            onClick={() => clientId ? setShowAccountSelector(true) : alert("Kérlek add meg a kódot felül!")}
            disabled={isExporting}
            className={`w-full py-4 rounded-3xl shadow-2xl flex items-center justify-center gap-3 font-black text-[10px] uppercase tracking-wider pointer-events-auto active:scale-95 transition-all ${clientId ? 'bg-white border-2 border-pink-100 text-gray-700' : 'bg-pink-100 text-pink-300 cursor-not-allowed opacity-50'}`}
          >
            {isExporting ? "Szinkronizálás..." : "Mentés Google Naptárba"}
          </button>
        </div>
      )}

      {/* Account Selector Modal */}
      {showAccountSelector && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl">
            <h3 className="text-xl font-black text-gray-800 mb-6">Melyik fiókba?</h3>
            <div className="space-y-3">
              {googleAccounts.map(acc => (
                <button key={acc.email} onClick={() => exportToGoogle(acc)} className="w-full p-5 rounded-3xl border-2 border-pink-50 hover:border-pink-200 hover:bg-pink-50 transition-all text-left flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center text-sm font-black text-pink-500">{acc.email[0].toUpperCase()}</div>
                  <span className="text-xs font-black text-gray-700">{acc.email}</span>
                </button>
              ))}
              <button onClick={addNewGoogleAccount} className="w-full p-5 rounded-3xl border-2 border-dashed border-pink-100 hover:border-pink-300 flex items-center gap-4 text-gray-400">
                <div className="w-10 h-10 rounded-2xl bg-pink-50 flex items-center justify-center text-pink-400">+</div>
                <span className="text-xs font-black uppercase tracking-widest">Új fiók hozzáadása</span>
              </button>
            </div>
            <button onClick={() => setShowAccountSelector(false)} className="w-full mt-8 py-3 text-xs font-black text-gray-400 uppercase tracking-widest">Mégse</button>
          </div>
        </div>
      )}

      {/* Chat Input */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-5 bg-gradient-to-t from-[#fdf2f8] via-[#fdf2f8] to-transparent">
        <div className="bg-white p-2 rounded-[2rem] shadow-2xl flex items-center border border-pink-100 ring-4 ring-pink-50/50">
          <input 
            type="text" 
            value={inputValue} 
            onChange={e => setInputValue(e.target.value)} 
            onKeyPress={e => e.key === 'Enter' && handleSendMessage()} 
            placeholder="Mit rögzítsek? 🤱" 
            className="flex-1 bg-transparent px-5 py-2 text-sm font-medium focus:outline-none placeholder-pink-200"
          />
          <button onClick={() => handleSendMessage()} disabled={!inputValue.trim() || isLoading} className="bg-pink-500 text-white w-11 h-11 rounded-full flex items-center justify-center shadow-lg disabled:bg-pink-100 transition-all active:scale-90">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
