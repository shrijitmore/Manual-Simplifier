/**
 * Service for interacting with the Gemini API
 */

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
console.log('Environment variables:', import.meta.env);
console.log('API Key loaded:', GEMINI_API_KEY ? 'Yes' : 'No');
console.log('API Key length:', GEMINI_API_KEY?.length);

const GEMINI_MODEL = "gemini-pro";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/${GEMINI_MODEL}:generateContent`;

export interface GeminiResponse {
  title: string;
  prerequisites: string[];
  warnings: string[];
  steps: string[];
}

interface InstructionResponse {
  title: string;
  prerequisites: string[];
  warnings: string[];
  steps: string[];
}

/**
 * Extracts instructions from a PDF manual using Gemini API
 * @param pdfFile - The PDF file to process
 * @returns Promise with the simplified instructions
 */
export const extractInstructionsFromPDF = async (file: File): Promise<InstructionResponse> => {
  console.log('Preparing to upload PDF...');
  
  const formData = new FormData();
  formData.append('pdf', file);

  try {
    const response = await fetch('http://localhost:3001/api/gemini', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.details || errorData.error || 'Failed to process PDF');
    }

    const data = await response.json();
    
    // Validate the response format
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid response format from Gemini API');
    }

    // Ensure all required fields are present
    const validatedResponse: InstructionResponse = {
      title: data.title || 'Manual Instructions',
      prerequisites: Array.isArray(data.prerequisites) ? data.prerequisites : [],
      warnings: Array.isArray(data.warnings) ? data.warnings : [],
      steps: Array.isArray(data.steps) ? data.steps : [],
    };

    // Check if we have any actual content
    if (validatedResponse.steps.length === 0 && 
        validatedResponse.prerequisites.length === 0 && 
        validatedResponse.warnings.length === 0) {
      throw new Error('No valid instructions could be extracted from the PDF');
    }

    return validatedResponse;

  } catch (error) {
    console.error('Error extracting instructions:', error);
    throw new Error(
      error instanceof Error 
        ? `Gemini API error: ${error.message}`
        : 'Failed to process PDF'
    );
  }
};
