import React from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Progress } from "./ui/progress";
import { Card, CardContent } from "./ui/card";

interface ProcessingIndicatorProps {
  isProcessing?: boolean;
  progress?: number;
  stage?: string;
}

const ProcessingIndicator = ({
  isProcessing = false,
  progress = 0,
  stage = "Analyzing PDF...",
}: ProcessingIndicatorProps) => {
  if (!isProcessing) return null;

  const stages = [
    "Analyzing PDF...",
    "Extracting content...",
    "Identifying key steps...",
    "Simplifying instructions...",
    "Finalizing results...",
  ];

  const currentStageIndex =
    stages.indexOf(stage) !== -1 ? stages.indexOf(stage) : 0;

  return (
    <Card className="w-full max-w-3xl mx-auto bg-background border shadow-sm">
      <CardContent className="p-6">
        <div className="flex flex-col items-center space-y-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="text-primary"
          >
            <Loader2 size={40} />
          </motion.div>

          <h3 className="text-lg font-medium text-center">{stage}</h3>

          <Progress value={progress} className="w-full h-2" />

          <div className="w-full flex justify-between text-xs text-muted-foreground mt-1">
            {stages.map((s, i) => (
              <div
                key={i}
                className={`flex flex-col items-center ${i <= currentStageIndex ? "text-primary" : "text-muted-foreground"}`}
              >
                <div
                  className={`w-3 h-3 rounded-full mb-1 ${i <= currentStageIndex ? "bg-primary" : "bg-muted"}`}
                />
                <span className="hidden sm:inline text-[10px]">
                  {s.split("...")[0]}
                </span>
              </div>
            ))}
          </div>

          <p className="text-sm text-muted-foreground text-center">
            Please wait while Gemini AI processes your PDF manual. This may take
            a few moments depending on the file size.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProcessingIndicator;
