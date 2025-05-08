import React from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Clipboard, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Instruction {
  step: number;
  content: string;
}

interface InstructionDisplayProps {
  title?: string;
  instructions?: Instruction[];
  isLoading?: boolean;
  error?: string;
}

const InstructionDisplay = ({
  title = "Simplified Instructions",
  instructions = [],
  isLoading = false,
  error = "",
}: InstructionDisplayProps) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopyToClipboard = () => {
    if (instructions.length === 0) return;

    const formattedInstructions = instructions
      .map((instruction) => `${instruction.step}. ${instruction.content}`)
      .join("\n\n");

    navigator.clipboard.writeText(formattedInstructions);
    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  return (
    <Card className="w-full max-w-3xl mx-auto bg-white shadow-md">
      <CardHeader className="border-b">
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl font-semibold text-gray-800">
            {title}
          </CardTitle>
          {instructions.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {instructions.length} steps
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-6 pb-2">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-full space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-start gap-3 animate-pulse">
                  <div className="h-6 w-6 rounded-full bg-gray-200 flex-shrink-0"></div>
                  <div className="w-full">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="py-8 text-center">
            <p className="text-red-500">{error}</p>
            <p className="text-sm text-gray-500 mt-2">
              Please try uploading your PDF again.
            </p>
          </div>
        ) : instructions.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-gray-500">No instructions available yet.</p>
            <p className="text-sm text-gray-400 mt-2">
              Upload a PDF manual to generate simplified instructions.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {instructions.map((instruction) => (
              <div key={instruction.step} className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 font-medium text-sm">
                  {instruction.step}
                </div>
                <p className="text-gray-700">{instruction.content}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {instructions.length > 0 && (
        <CardFooter className="border-t pt-4 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyToClipboard}
            className="flex items-center gap-2"
            disabled={copied}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Clipboard className="h-4 w-4" />
                <span>Copy to clipboard</span>
              </>
            )}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
};

export default InstructionDisplay;
