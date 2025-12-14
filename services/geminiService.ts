import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini
// NOTE: In a real production app, calls should go through a backend to protect the API Key.
// Per prompt instructions, we use process.env.API_KEY directly here.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const extractDrugData = async (base64Image: string): Promise<any[]> => {
  try {
    const modelId = "gemini-2.5-flash"; // Strong model for vision tasks

    const prompt = `
      You are an expert pharmaceutical data entry specialist. 
      Analyze the provided image (invoice, list, or handwritten note) and extract drug information into a structured JSON format.
      
      The required columns are:
      1. Agent Name (اسم الوكيل)
      2. Manufacturer (الشركة المصنعة)
      3. Trade Name (الإسم التجاري)
      4. Public Price (السعر للجمهور) - Number
      5. Agent Price (سعر الوكيل) - Number
      6. Price Before Discount (السعر قبل التخفيض) - Number
      7. Discount Percentage (نسبة التخفيض) - Number

      Rules:
      - Extract Arabic text EXACTLY as it appears (preserve punctuation, spaces).
      - Extract English text EXACTLY as it appears.
      - If a field is missing or cannot be inferred, use null.
      - If the image contains a table, process all rows.
      - Return ONLY the JSON array.
    `;

    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: base64Image } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              agentName: { type: Type.STRING },
              manufacturer: { type: Type.STRING },
              tradeName: { type: Type.STRING },
              publicPrice: { type: Type.NUMBER },
              agentPrice: { type: Type.NUMBER },
              priceBeforeDiscount: { type: Type.NUMBER },
              discountPercent: { type: Type.NUMBER },
            }
          }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    throw new Error("No data returned from AI");
  } catch (error) {
    console.error("OCR Extraction Error:", error);
    throw error;
  }
};
