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
import { encode } from 'gpt-3-encoder';
import similarity from 'compute-cosine-similarity';

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

// Modified vector store implementation
const vectorStore = {
  chunks: [],
  embeddings: [],
  metadata: {
    currentFileName: '',
    pageCount: 0,
    totalChunks: 0
  },
  addChunk: function(chunk, embedding, pageNum) {
    this.chunks.push({
      text: chunk,
      page: pageNum,
      embedding: embedding
    });
    this.embeddings.push(embedding);
  },
  clear: function() {
    this.chunks = [];
    this.embeddings = [];
    this.metadata = {
      currentFileName: '',
      pageCount: 0,
      totalChunks: 0
    };
    console.log('Vector store cleared');
  },
  search: function(query, topK = 5) {
    const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 2);
    
    // Score each chunk based on multiple criteria
    const scoredChunks = this.chunks.map(chunk => {
      const text = chunk.text.toLowerCase();
      let score = 0;
      
      // Term frequency scoring
      searchTerms.forEach(term => {
        const termCount = (text.match(new RegExp(term, 'g')) || []).length;
        score += termCount;
      });
      
      // Boost score for chunks containing multiple search terms
      const uniqueTermsFound = searchTerms.filter(term => text.includes(term)).length;
      score *= (uniqueTermsFound / searchTerms.length);
      
      // Context window scoring - check surrounding chunks
      const chunkIndex = this.chunks.indexOf(chunk);
      if (chunkIndex > 0) {
        const prevChunk = this.chunks[chunkIndex - 1].text.toLowerCase();
        searchTerms.forEach(term => {
          if (prevChunk.includes(term)) score += 0.5;
        });
      }
      
      return {
        chunk: chunk.text,
        page: chunk.page,
        score: score
      };
    });

    // Filter and sort results
    return scoredChunks
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(item => ({
        text: item.chunk,
        page: item.page,
        score: item.score
      }));
  }
};

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
    // Clear existing vector store before processing new PDF
    vectorStore.clear();
    
    const pdf = await pdfjsLib.getDocument({ 
      data: new Uint8Array(req.file.buffer),
      ...pdfjsOptions
    }).promise;
    
    vectorStore.metadata.currentFileName = req.file.originalname;
    vectorStore.metadata.pageCount = pdf.numPages;
    
    // Process each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map(item => item.str)
        .join(' ')
        .replace(/\s+/g, ' ');

      // Split page text into meaningful chunks
      const pageChunks = pageText
        .split(/(?<=[.!?])\s+(?=[A-Z])/)
        .filter(chunk => chunk.trim().length > 50)
        .map(chunk => chunk.trim());

      // Store chunks with page number
      pageChunks.forEach(chunk => {
        const tokens = encode(chunk);
        const embedding = tokens.map(t => t / tokens.length);
        vectorStore.addChunk(chunk, embedding, pageNum);
      });
    }

    vectorStore.metadata.totalChunks = vectorStore.chunks.length;
    console.log(`Processed PDF: ${vectorStore.metadata.totalChunks} chunks stored from ${pdf.numPages} pages`);
    
    res.json({ 
      message: 'PDF processed and embeddings stored', 
      metadata: vectorStore.metadata
    });
  } catch (error) {
    console.error('Error processing PDF:', error);
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

// Search endpoint
app.post('/search', async (req, res) => {
  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'No search query provided' });
  }

  try {
    if (vectorStore.chunks.length === 0) {
      return res.status(400).json({ 
        error: 'No manual content available',
        details: 'Please upload a manual first'
      });
    }

    // Get relevant chunks using improved search
    const searchResults = vectorStore.search(query);

    if (searchResults.length === 0) {
      return res.json({
        answer: "I couldn't find any relevant information about that in the manual. Please try rephrasing your question or using different keywords.",
        relevantSections: [],
        confidence: 0
      });
    }

    // Create an improved prompt with context
    const prompt = `Based on these sections from the manual (with page numbers):
    ${searchResults.map(result => `[Page ${result.page}]: ${result.text}`).join('\n\n')}
    
    Question: ${query}
    
    Please provide a comprehensive answer that:
    1. Directly addresses the question
    2. Includes specific details from the manual
    3. Lists any steps in order (if applicable)
    4. Mentions relevant warnings or prerequisites (if any)
    5. Cites the page numbers when referring to specific information
    
    Format the response in a clear, easy-to-read manner.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.VITE_GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }]
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (!result.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('Invalid or empty response from Gemini API');
    }

    const answer = result.candidates[0].content.parts[0].text;

    res.json({
      answer: answer.trim(),
      relevantSections: searchResults.map(result => ({
        text: result.text,
        page: result.page,
        confidence: result.score
      })),
      metadata: {
        totalPages: vectorStore.metadata.pageCount,
        pagesSearched: [...new Set(searchResults.map(r => r.page))],
        fileName: vectorStore.metadata.currentFileName
      }
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ 
      error: 'Failed to search the manual', 
      details: error.message 
    });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
}); 