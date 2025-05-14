import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';
import { ChromaClient } from 'chromadb';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';

// Constants
const GEMINI_MODEL = "gemini-2.0-flash";
const CHUNK_SIZE = 2000; // Keep the chunk size as is
const CHUNK_OVERLAP = 200;
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds
const RATE_LIMIT_DELAY = 5000; // Increase to 5 seconds between requests
const BATCH_SIZE = 2; // Reduce to 2 chunks at a time
 
// Initialize ChromaDB client
const chromaClient = new ChromaClient();

// Initialize PDF.js worker with font configuration
pdfjsLib.GlobalWorkerOptions.workerSrc = path.resolve(
  process.cwd(),
  'node_modules/pdfjs-dist/legacy/build/pdf.worker.js'
);

// Configure PDF.js font loading
const pdfjsOptions = {
  standardFontDataUrl: path.resolve(
    process.cwd(),
    'node_modules/pdfjs-dist/standard_fonts/'
  ),
};

// Try multiple locations for .env file
const envPath = path.resolve(process.cwd(), '.env');
console.log('Attempting to load .env from:', envPath);

if (fs.existsSync(envPath)) {
  console.log('.env file exists at:', envPath);
  const result = dotenv.config({ path: envPath });
  if (result.error) {
    console.error('Error loading .env file:', result.error);
  } else {
    console.log('Successfully loaded .env file');
  }
} else {
  console.error('.env file not found at:', envPath);
}

// Log environment variables
console.log('Environment variables:', {
  NODE_ENV: process.env.NODE_ENV,
  VITE_GEMINI_API_KEY: process.env.VITE_GEMINI_API_KEY ? 'Set' : 'Not set',
});

const app = express();
const port = 3001;

// Configure multer for handling file uploads
const upload = multer({ storage: multer.memoryStorage() });

const vectorStore = {}; // Simple in-memory store

// Function to generate embeddings (placeholder)
const generateEmbedding = (text) => {
  // Implement your embedding logic here
  return text.split(' ').map(word => word.length); // Dummy embedding
};

app.use(cors());
app.use(express.json());

// Function to split text into chunks
const splitTextIntoChunks = async (text) => {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
  });
  return await splitter.splitText(text);
};

// Utility function for delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Function to process chunks in batches
const processChunksInBatches = async (chunks, apiKey) => {
  const processedChunks = [];
  const totalBatches = Math.ceil(chunks.length / BATCH_SIZE);

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    console.log(`Processing batch ${batchIndex + 1}/${totalBatches}`);
    
    const batchStart = batchIndex * BATCH_SIZE;
    const batchEnd = Math.min(batchStart + BATCH_SIZE, chunks.length);
    const batch = chunks.slice(batchStart, batchEnd);

    // Process each chunk in the batch
    const batchPromises = batch.map(async (chunk, index) => {
      let retries = 0;
      let success = false;

      while (retries < MAX_RETRIES && !success) {
        try {
          // Add delay between requests
          await delay(RATE_LIMIT_DELAY);

          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      {
                        text: `Analyze this section of a technical manual and extract key information:
                        ${chunk}
                        
                        Format your response as a JSON object with this structure:
                        {
                          "key_points": ["Point 1", "Point 2", ...],
                          "warnings": ["Warning 1", "Warning 2", ...],
                          "steps": ["Step 1", "Step 2", ...]
                        }`
                      },
                    ],
                  },
                ],
              }),
            }
          );

          if (response.status === 429) {
            console.log(`Rate limit hit for chunk ${batchStart + index + 1}, retrying after ${RETRY_DELAY}ms...`);
            await delay(RETRY_DELAY * (retries + 1)); // Exponential backoff
            retries++;
            continue;
          }

          const responseText = await response.text();
          console.log(`Raw response for chunk ${batchStart + index + 1}:`, responseText);

          if (!response.ok) {
            throw new Error(`Gemini API error: ${response.statusText}`);
          }

          // Parse the Gemini API response first
          const geminiResponse = JSON.parse(responseText);
          
          // Get the text content from the response
          const textContent = geminiResponse.candidates[0].content.parts[0].text;
          
          // Extract JSON from code block
          const match = textContent.match(/```json\s*([\s\S]*?)\s*```/);
          if (!match || match.length < 2) {
            console.error('Failed to extract JSON from response:', textContent);
            throw new Error('Failed to extract JSON from response');
          }
          
          const jsonString = match[1].trim();
          console.log(`Extracted JSON string for chunk ${batchStart + index + 1}:`, jsonString);
          
          const data = JSON.parse(jsonString);
          console.log(`Successfully processed chunk ${batchStart + index + 1}/${chunks.length}`);
          success = true;
          return data;

        } catch (error) {
          console.error(`Error processing chunk ${batchStart + index + 1}, attempt ${retries + 1}:`, error);
          retries++;
          
          if (retries === MAX_RETRIES) {
            throw new Error(`Failed to process chunk after ${MAX_RETRIES} attempts: ${error.message}`);
          }
          
          await delay(RETRY_DELAY * Math.pow(2, retries)); // Exponential backoff
        }
      }
    });

    // Wait for all chunks in the batch to complete
    const batchResults = await Promise.all(batchPromises);
    processedChunks.push(...batchResults.filter(Boolean));

    // Add delay between batches
    if (batchIndex < totalBatches - 1) {
      console.log(`Waiting ${RATE_LIMIT_DELAY}ms before processing next batch...`);
      await delay(RATE_LIMIT_DELAY * 2);
    }
  }

  return processedChunks;
};

// Function to merge processed chunks with progress tracking
const mergeProcessedChunks = (processedChunks) => {
  console.log(`Merging ${processedChunks.length} processed chunks...`);
  
  const merged = {
    title: "Technical Manual Summary",
    prerequisites: [],
    warnings: [],
    steps: []
  };

  processedChunks.forEach((chunk, index) => {
    console.log(`Processing chunk ${index + 1}/${processedChunks.length}`);
    if (chunk.key_points) merged.prerequisites.push(...chunk.key_points);
    if (chunk.warnings) merged.warnings.push(...chunk.warnings);
    if (chunk.steps) merged.steps.push(...chunk.steps);
  });

  // Remove duplicates
  merged.prerequisites = [...new Set(merged.prerequisites)];
  merged.warnings = [...new Set(merged.warnings)];
  merged.steps = [...new Set(merged.steps)];

  console.log('Merge completed successfully');
  return merged;
};

app.post('/upload', upload.single('pdf'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No PDF file uploaded' });
  }

  try {
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(req.file.buffer) }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n';
    }

    // Generate embeddings
    const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 200 });
    const chunks = await splitter.splitText(fullText);

    // Store embeddings in vectorStore
    chunks.forEach((chunk, index) => {
      const embedding = generateEmbedding(chunk);
      vectorStore[index] = { chunk, embedding };
    });

    res.json({ message: 'PDF processed and embeddings stored' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to process PDF', details: error.message });
  }
});

app.post('/api/gemini', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    const apiKey = process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      console.error('VITE_GEMINI_API_KEY is not set in environment variables');
      return res.status(500).json({ 
        error: 'API key not configured',
        details: 'Please check your .env file and ensure VITE_GEMINI_API_KEY is set'
      });
    }

    try {
      const pdf = await pdfjsLib.getDocument({ 
        data: new Uint8Array(req.file.buffer),
        ...pdfjsOptions
      }).promise;
      
      let fullText = '';

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n';
      }

      console.log('PDF text extracted, length:', fullText.length);

      if (!fullText || fullText.trim().length === 0) {
        return res.status(400).json({ 
          error: 'No text content found in PDF',
          details: 'The PDF appears to be empty or contains no extractable text'
        });
      }

      // Split text into chunks
      const chunks = await splitTextIntoChunks(fullText);
      console.log(`Split PDF into ${chunks.length} chunks`);

      // Process chunks in batches
      const processedChunks = await processChunksInBatches(chunks, apiKey);
      
      // Merge processed chunks
      const finalResult = mergeProcessedChunks(processedChunks);

      res.json(finalResult);

    } catch (pdfError) {
      console.error('Error processing PDF:', pdfError);
      return res.status(400).json({ 
        error: 'Failed to process PDF',
        details: pdfError.message
      });
    }
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message
    });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
}); 