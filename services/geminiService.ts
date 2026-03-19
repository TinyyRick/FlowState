import { GoogleGenAI } from "@google/genai";

export const setCustomApiKey = (key: string) => {
  localStorage.setItem('flowstate_gemini_api_key', key);
};

export const getCustomApiKey = () => {
  return localStorage.getItem('flowstate_gemini_api_key') || '';
};

export const breakdownTask = async (task: string) => {
  const apiKey = getCustomApiKey() || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("No Gemini API key found.");
    return [];
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Break down this task into 3-5 small, actionable steps: "${task}". Return as a simple list of strings.`,
    });
    
    const text = response.text;
    if (!text) return [];
    
    return text.split('\n')
      .filter(line => line.trim())
      .map(line => line.replace(/^\d+\.\s*/, '').trim());
  } catch (error) {
    console.error("Error breaking down task:", error);
    return [];
  }
};
