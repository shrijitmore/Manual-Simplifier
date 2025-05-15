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
import { ManualSearch } from "./ManualSearch";
import { manualService } from "@/services/geminiService";

type ProcessingStatus = "idle" | "processing" | "completed" | "error";

export default function Home() {
  const [status, setStatus] = useState<ProcessingStatus>("idle");
  const [fileName, setFileName] = useState<string>("");
  const [error, setError] = useState<string>("");

  const handleFileUpload = async (file: File) => {
    setFileName(file.name);
    setStatus("processing");
    setError("");

    try {
      await manualService.uploadManual(file);
      setStatus("completed");
    } catch (err) {
      console.error("Error processing PDF:", err);
      setStatus("error");
      setError(
        err instanceof Error
          ? err.message
          : "Failed to process the PDF. Please try again."
      );
    }
  };

  const handleReset = () => {
    setStatus("idle");
    setFileName("");
    setError("");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b py-4">
        <div className="container mx-auto px-4">
          <h1 className="text-2xl font-bold text-primary">
            Manual Search Assistant
          </h1>
          <p className="text-muted-foreground">
            Upload a manual and ask questions about specific tasks
          </p>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8">
        <Card className="w-full max-w-4xl mx-auto bg-card">
          <CardHeader>
            <CardTitle>Search Your Manual</CardTitle>
            <CardDescription>
              Upload a PDF manual and ask questions to get specific instructions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {status === "idle" && (
              <PDFUploader onFileUpload={handleFileUpload} isProcessing={false} />
            )}

            {status === "processing" && (
              <ProcessingIndicator isProcessing={true} stage="Processing manual..." />
            )}

            {status === "error" && (
              <div className="p-4 border border-destructive rounded-md bg-destructive/10 text-destructive">
                <p className="font-medium">Error Processing PDF</p>
                <p className="mt-1 text-sm">{error}</p>
              </div>
            )}

            {status === "completed" && (
              <>
                <div className="text-sm text-muted-foreground">
                  Manual uploaded: {fileName}
                </div>
                <ManualSearch isEnabled={true} />
              </>
            )}
          </CardContent>

          {(status === "completed" || status === "error") && (
            <CardFooter>
              <Button onClick={handleReset}>Upload Another Manual</Button>
            </CardFooter>
          )}
        </Card>
      </main>

      <footer className="border-t py-4 mt-auto">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Manual Search Assistant powered by Gemini AI</p>
        </div>
      </footer>
    </div>
  );
}
