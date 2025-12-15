import { GoogleGenAI } from "@google/genai";

export const extractDrugData = async (base64Data: string, mimeType: string = "image/jpeg"): Promise<any[]> => {
  try {
    // Access environment variable safely for Vite
    let apiKey = '';
    if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
      apiKey = (import.meta as any).env.VITE_API_KEY || '';
    }
    
    // Fallback if defined elsewhere (though less likely in pure Vite)
    if (!apiKey && typeof process !== 'undefined' && process.env) {
        apiKey = process.env.API_KEY || '';
    }

    if (!apiKey) {
        throw new Error("مفتاح API غير متوفر. يرجى التأكد من إعداد المتغير VITE_API_KEY في Vercel.");
    }

    // Initialize the client
    const ai = new GoogleGenAI({ apiKey: apiKey });
    const modelId = "gemini-2.5-flash";

    const prompt = `
      You are a pharmaceutical data entry assistant.
      Analyze the image/PDF and extract drug/medicine items into a JSON Array.
      
      Focus on extracting this tabular data:
      - tradeName: The commercial name of the drug (English or Arabic).
      - agentName: The distributor or agent name.
      - manufacturer: The manufacturing company.
      - publicPrice: The price for the public (numeric value only, remove currency symbols).
      - agentPrice: The price for the pharmacy/agent (numeric value only).
      - discountPercent: The discount percentage (numeric value only).

      Rules:
      1. If the document contains a table, extract all rows.
      2. If a value is missing, use null or 0.
      3. Clean numeric fields (remove 'SAR', '$', 'ريال', etc.).
      4. Output ONLY the raw JSON array. Do not include markdown formatting like \`\`\`json.
    `;

    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType, data: base64Data } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json"
      }
    });

    let text = response.text || "[]";

    // Robust JSON extraction
    const startIndex = text.indexOf('[');
    const endIndex = text.lastIndexOf(']');
    
    if (startIndex !== -1 && endIndex !== -1) {
        text = text.substring(startIndex, endIndex + 1);
    }

    try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
            return parsed;
        } else if (typeof parsed === 'object' && parsed !== null) {
            return Object.values(parsed).find(val => Array.isArray(val)) as any[] || [];
        }
        return [];
    } catch (e) {
        console.error("JSON Parse Error:", text);
        return [];
    }

  } catch (error: any) {
    console.error("Gemini OCR Error:", error);
    if (error.message && (error.message.includes('API key') || error.message.includes('permission denied'))) {
        throw new Error("فشل الاتصال: مفتاح API غير صالح أو غير موجود.");
    }
    throw error;
  }
};