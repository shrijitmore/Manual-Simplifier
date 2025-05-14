import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import PDFUploader from "./PDFUploader";
import ProcessingIndicator from "./ProcessingIndicator";
import InstructionDisplay from "./InstructionDisplay";
import { extractInstructionsFromPDF } from "@/services/geminiService";

type ProcessingStatus = "idle" | "processing" | "completed" | "error";

interface Instruction {
  title: string;
  prerequisites: string[];
  warnings: string[];
  steps: string[];
}

export default function Home() {
  const [status, setStatus] = useState<ProcessingStatus>("idle");
  const [fileName, setFileName] = useState<string>("");
  const [instructions, setInstructions] = useState<Instruction | null>(null);
  const [error, setError] = useState<string>("");

  const handleFileUpload = async (file: File) => {
    setFileName(file.name);
    setStatus("processing");
    setError("");

    try {
      // Send to Gemini API through our proxy server
      const result = await extractInstructionsFromPDF(file);

      // Update state with the response
      setInstructions(result);
      setStatus("completed");
    } catch (err) {
      console.error("Error processing PDF:", err);
      setStatus("error");
      setError(
        err instanceof Error
          ? err.message
          : "Failed to process the PDF. Please try again.",
      );
    }
  };

  const handleReset = () => {
    setStatus("idle");
    setFileName("");
    setInstructions(null);
    setError("");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b py-4">
        <div className="container mx-auto px-4">
          <h1 className="text-2xl font-bold text-primary">
            PDF Manual Simplifier
          </h1>
          <p className="text-muted-foreground">
            Upload a manual and get simplified step-by-step instructions
          </p>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8">
        <Card className="w-full max-w-4xl mx-auto bg-card">
          <CardHeader>
            <CardTitle>Simplify Your Manual</CardTitle>
            <CardDescription>
              Upload a PDF manual and our AI will generate simplified
              step-by-step instructions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {status === "idle" && (
              <PDFUploader onFileUpload={handleFileUpload} />
            )}

            {status === "processing" && (
              <ProcessingIndicator isProcessing={true} stage="Analyzing PDF..." />
            )}

            {status === "completed" && instructions && (
              <InstructionDisplay
                title={instructions.title}
                instructions={instructions.steps.map((step, index) => ({
                  step: index + 1,
                  content: step,
                }))}
              />
            )}

            {status === "error" && (
              <div className="p-4 border border-destructive rounded-md bg-destructive/10 text-destructive">
                <p>{error}</p>
              </div>
            )}
          </CardContent>

          {(status === "completed" || status === "error") && (
            <CardFooter>
              <Button onClick={handleReset}>Upload Another PDF</Button>
            </CardFooter>
          )}
        </Card>
      </main>

      <footer className="border-t py-4 mt-auto">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>PDF Manual Simplifier powered by Gemini AI</p>
        </div>
      </footer>
    </div>
  );
}
