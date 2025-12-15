import { GoogleGenAI } from "@google/genai";

export const extractDrugData = async (base64Data: string, mimeType: string = "image/jpeg"): Promise<any[]> => {
  try {
    // Check if API KEY is available before attempting to connect
    // @ts-ignore
    const apiKey = typeof process !== "undefined" && process.env ? process.env.API_KEY : null;

    if (!apiKey) {
        throw new Error("مفتاح API غير متوفر. يرجى التأكد من إعدادات النظام.");
    }

    // Initialize the client inside the function to ensure we use the latest env state
    const ai = new GoogleGenAI({ apiKey: apiKey });
    const modelId = "gemini-2.5-flash";

    // We remove the strict Schema and rely on the prompt + JSON MIME type for flexibility.
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

    // Robust JSON extraction: Find the first '[' and last ']'
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
            // Sometimes it wraps in { "items": [...] }
            return Object.values(parsed).find(val => Array.isArray(val)) as any[] || [];
        }
        return [];
    } catch (e) {
        console.error("JSON Parse Error:", text);
        return [];
    }

  } catch (error: any) {
    console.error("Gemini OCR Error:", error);
    
    // Provide a more user-friendly error message if possible
    if (error.message && (error.message.includes('API key') || error.message.includes('permission denied'))) {
        throw new Error("فشل الاتصال: مفتاح API غير صالح أو غير موجود.");
    }
    
    throw error;
  }
};