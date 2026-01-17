
import { GoogleGenAI, Type } from "@google/genai";
import { GeminiResponse } from "../types";

// The API key must be obtained exclusively from the environment variable process.env.API_KEY.
const API_KEY = process.env.API_KEY || "";

// Initialize AI lazily or handle empty key gracefully
const getAI = () => {
  if (!API_KEY) {
    console.warn("API_KEY is missing. Szuperanyu needs a key to work! 🌸");
  }
  return new GoogleGenAI({ apiKey: API_KEY });
};

const getTodayISO = () => new Date().toISOString().split('T')[0];
const getWeekday = () => new Intl.DateTimeFormat('hu-HU', { weekday: 'long' }).format(new Date());

const SYSTEM_INSTRUCTION = `
Te vagy "Szuperanyu Idő-Menedzser". Egy végtelenül türelmes, támogató és hatékony asszisztens vagy túlterhelt anyukák számára.

MAI DÁTUM: ${getTodayISO()} (${getWeekday()})

FELADATOD:
Alakítsd a felhasználó beszédét (ami gyakran kaotikus vagy félmondatos) strukturált adatokká. 
Ismerd fel az ISMÉTLŐDÉSEKET is!

LOGIKA:
1. ISMÉTLŐDÉS:
   - "minden nap" -> daily
   - "minden hétfőn/kedden/stb" -> weekly
   - "havonta egyszer" -> monthly
2. IDŐPONT: Ha van konkrét óra (pl. "délben", "fél ötkor"), akkor 'event'.
3. CSAK NAP: Ha csak nap van idő nélkül, akkor 'task'.

DÁTUM FORMÁTUM: YYYY-MM-DD vagy YYYY-MM-DDTHH:mm:ss.
VÁLASZ: Csak JSON, magyar textResponse-szal. Használj sok kedves emojit! 🌸✨💕
`;

export const processUserInput = async (input: string, context?: string): Promise<GeminiResponse> => {
  if (!API_KEY) {
    return {
      type: 'clarification',
      textResponse: "Szia! Úgy tűnik, még nem kaptam meg a titkos kulcsomat a működéshez (API_KEY hiányzik). Kérlek, szólj a fejlesztőnek! 🌸"
    };
  }

  try {
    const ai = getAI();
    const fullPrompt = context ? `KONTEXTUS: ${context}\n\nKÉRÉS: ${input}` : input;
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: fullPrompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING, enum: ['task', 'event', 'query', 'completion', 'email', 'clarification'] },
            textResponse: { type: Type.STRING },
            calendarData: {
              type: Type.OBJECT,
              properties: {
                summary: { type: Type.STRING },
                start: { type: Type.STRING },
                end: { type: Type.STRING },
                recurrence: { type: Type.STRING, enum: ['daily', 'weekly', 'monthly', 'none'] }
              },
              required: ["summary", "start"]
            },
            taskData: {
              type: Type.OBJECT,
              properties: {
                description: { type: Type.STRING },
                priority: { type: Type.STRING, enum: ['critical', 'high', 'medium', 'low'] },
                dueDate: { type: Type.STRING },
                recurrence: { type: Type.STRING, enum: ['daily', 'weekly', 'monthly', 'none'] }
              },
              required: ["description", "priority"]
            },
            emailData: {
              type: Type.OBJECT,
              properties: {
                subject: { type: Type.STRING },
                body: { type: Type.STRING }
              },
              required: ["subject", "body"]
            }
          },
          required: ["type", "textResponse"]
        }
      }
    });

    return JSON.parse(response.text.trim()) as GeminiResponse;
  } catch (error) {
    console.error("Gemini Error:", error);
    return {
      type: 'clarification',
      textResponse: "Hoppá, valami porszem került a gépezetbe... 🌸 Megismételnéd, kérlek? Itt vagyok és figyelek!"
    };
  }
};
