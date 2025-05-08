/**
 * Service for interacting with the Gemini API
 */

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_MODEL = "models/gemini-pro";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1/${GEMINI_MODEL}:generateContent`;

export interface GeminiResponse {
  title: string;
  steps: string[];
}

/**
 * Extracts instructions from a PDF manual using Gemini API
 * @param pdfContent - Base64 encoded PDF content
 * @returns Promise with the simplified instructions
 */
export async function extractInstructionsFromPDF(
  pdfContent: string,
): Promise<GeminiResponse> {
  try {
    // Create the prompt for Gemini
    const prompt = `
      I have a PDF manual that I need simplified instructions from.
      Please analyze this content and provide:
      1. A clear title for the instructions
      2. A numbered list of simplified steps to follow
      
      Format your response as a JSON object with the following structure:
      {
        "title": "Title of the instructions",
        "steps": ["Step 1", "Step 2", "Step 3", ...]
      }
      
      Keep the steps concise, clear, and easy to follow.
      Here's the content: ${pdfContent.substring(0, 1000)}...
    `;

    // Call the Gemini API
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Gemini API error: ${errorData.error?.message || response.statusText}`,
      );
    }

    const data = await response.json();

    // Extract the response text from Gemini
    const responseText = data.candidates[0].content.parts[0].text;

    // Parse the JSON from the response
    // The response might contain markdown or other formatting, so we need to extract just the JSON part
    const jsonMatch = responseText.match(/\{[\s\S]*\}/); // Find JSON object in the response

    if (!jsonMatch) {
      throw new Error("Could not parse instructions from Gemini response");
    }

    const parsedInstructions = JSON.parse(jsonMatch[0]);

    return {
      title: parsedInstructions.title || "Simplified Instructions",
      steps: parsedInstructions.steps || [],
    };
  } catch (error) {
    console.error("Error extracting instructions:", error);
    throw error;
  }
}
