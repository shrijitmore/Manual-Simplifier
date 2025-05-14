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
  title: string;
  instructions: Instruction[];
  prerequisites?: string[];
  warnings?: string[];
}

const InstructionDisplay = ({
  title,
  instructions,
  prerequisites = [],
  warnings = [],
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
        {instructions.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-gray-500">No instructions available yet.</p>
            <p className="text-sm text-gray-400 mt-2">
              Upload a PDF manual to generate simplified instructions.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {prerequisites.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-medium text-gray-700">Prerequisites:</h3>
                <ul className="list-disc list-inside space-y-1">
                  {prerequisites.map((item, index) => (
                    <li key={index} className="text-gray-600">{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {warnings.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-medium text-red-600">Important Warnings:</h3>
                <ul className="list-disc list-inside space-y-1">
                  {warnings.map((warning, index) => (
                    <li key={index} className="text-red-500">{warning}</li>
                  ))}
                </ul>
              </div>
            )}

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
