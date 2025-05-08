/**
 * Utility functions for handling PDF files
 */

/**
 * Converts a PDF file to base64 string
 * @param file - The PDF file to convert
 * @returns Promise with the base64 string
 */
export async function convertPDFToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        // Get the base64 string (remove the data URL prefix)
        const base64String = reader.result.split(",")[1];
        resolve(base64String);
      } else {
        reject(new Error("Failed to convert file to base64"));
      }
    };

    reader.onerror = () => {
      reject(new Error("Error reading file"));
    };

    reader.readAsDataURL(file);
  });
}
