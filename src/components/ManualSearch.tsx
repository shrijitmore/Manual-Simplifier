import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SearchResponse, manualService } from '@/services/geminiService';

interface ManualSearchProps {
  isEnabled: boolean;
}

interface RelevantSection {
  text: string;
  page: number;
  confidence: number;
}

interface SearchMetadata {
  totalPages: number;
  pagesSearched: number[];
  fileName: string;
}

interface SearchResult {
  answer: string;
  relevantSections: RelevantSection[];
  metadata?: SearchMetadata;
}

// Add new types for better formatting
interface FormattedText {
  type: 'text' | 'bold' | 'bullet' | 'subbullet' | 'heading';
  content: string;
  level?: number;
}

// Improved helper function to parse formatted text
const parseFormattedText = (text: string): FormattedText[] => {
  const parts: FormattedText[] = [];
  let currentText = '';
  let isBold = false;

  const lines = text.split('\n');
  
  lines.forEach(line => {
    let trimmedLine = line.trim();
    
    // Skip empty lines
    if (!trimmedLine) {
      parts.push({ type: 'text', content: '\n' });
      return;
    }

    // Handle bullet points with different levels
    let bulletLevel = 0;
    while (trimmedLine.startsWith('* ') || trimmedLine.startsWith('• ')) {
      bulletLevel++;
      trimmedLine = trimmedLine.substring(2).trim();
    }

    // Process the line for bold text and other formatting
    let segments = trimmedLine.split(/(\*\*.*?\*\*)/g);
    segments.forEach(segment => {
      if (segment.startsWith('**') && segment.endsWith('**')) {
        // Bold text
        const boldText = segment.slice(2, -2);
        if (boldText) {
          parts.push({ 
            type: 'bold',
            content: boldText,
            level: bulletLevel
          });
        }
      } else {
        // Regular text or bullet points
        if (segment.trim()) {
          parts.push({
            type: bulletLevel > 0 ? (bulletLevel > 1 ? 'subbullet' : 'bullet') : 'text',
            content: segment.trim(),
            level: bulletLevel
          });
        }
      }
    });

    // Add newline if not the last line
    if (lines.indexOf(line) < lines.length - 1) {
      parts.push({ type: 'text', content: '\n' });
    }
  });

  return parts;
};

// Updated component to render formatted text
const FormattedContent: React.FC<{ content: string }> = ({ content }) => {
  const parts = parseFormattedText(content);
  
  return (
    <div className="space-y-2">
      {parts.map((part, index) => {
        switch (part.type) {
          case 'bold':
            return (
              <strong key={index} className="font-bold">
                {part.level > 0 && (
                  <span className="inline-block mr-2">
                    {part.level > 1 ? '  •' : '•'}
                  </span>
                )}
                {part.content}
              </strong>
            );
          
          case 'bullet':
            return (
              <div key={index} className="flex items-start space-x-2">
                <span className="mt-1">•</span>
                <span>{part.content}</span>
              </div>
            );
          
          case 'subbullet':
            return (
              <div key={index} className="flex items-start space-x-2 ml-4">
                <span className="mt-1">•</span>
                <span>{part.content}</span>
              </div>
            );
          
          case 'text':
            return part.content === '\n' ? (
              <br key={index} />
            ) : (
              <span key={index}>{part.content}</span>
            );
          
          default:
            return <span key={index}>{part.content}</span>;
        }
      })}
    </div>
  );
};

export function ManualSearch({ isEnabled }: ManualSearchProps) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string>('');

  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsSearching(true);
    setError('');
    setSearchResult(null);

    try {
      if (!manualService.isManualLoaded()) {
        throw new Error('Please upload a manual first');
      }

      const result = await manualService.searchManual(query);
      setSearchResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search manual');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Ask a question about the manual..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={!isEnabled || isSearching}
        />
        <Button 
          onClick={handleSearch}
          disabled={!isEnabled || isSearching || !query.trim()}
        >
          Search
        </Button>
      </div>

      {isSearching && (
        <div className="text-center text-muted-foreground">
          Searching manual...
        </div>
      )}

      {error && (
        <div className="p-4 border border-destructive rounded-md bg-destructive/10 text-destructive">
          {error}
        </div>
      )}

      {searchResult && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div>
                <h3 className="font-medium">Answer:</h3>
                <div className="mt-1 text-muted-foreground">
                  <FormattedContent content={searchResult.answer} />
                </div>
              </div>
              
              {searchResult.relevantSections && searchResult.relevantSections.length > 0 && (
                <div>
                  <h3 className="font-medium">Relevant Sections:</h3>
                  <ul className="mt-1 list-disc pl-4 text-sm text-muted-foreground">
                    {searchResult.relevantSections.map((section, index) => (
                      <li key={index} className="mt-2">
                        <p>
                          <span className="font-medium">Page {section.page}:</span>{' '}
                          <FormattedContent content={section.text} />
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {searchResult.metadata && (
                <div className="text-xs text-muted-foreground mt-4">
                  <p>Source: {searchResult.metadata.fileName}</p>
                  <p>Pages searched: {searchResult.metadata.pagesSearched.join(', ')} of {searchResult.metadata.totalPages}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
