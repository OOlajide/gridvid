import { useEffect, useState } from "react";
import WalletConnector from "@/components/WalletConnector";
import WorkflowStepper from "@/components/WorkflowStepper";
import VideoGenerator from "@/components/VideoGenerator";
import PaymentSection from "@/components/PaymentSection";
import ProcessingSection from "@/components/ProcessingSection";
import ResultSection from "@/components/ResultSection";
import { useWorkflow } from "@/hooks/use-workflow";
import { Card } from "@/components/ui/card";

export default function Home() {
  const { 
    currentStep, 
    walletConnected, 
    paymentComplete, 
    contextAccounts, 
    allowedAccounts,
    videoResult,
    setStep
  } = useWorkflow();

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="px-4 py-4 shadow-lg bg-surface">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center">
            <span className="material-icons text-primary mr-2">movie_filter</span>
            <h1 className="font-display text-xl font-bold tracking-wide">
              <span className="text-primary">Grid</span>
              <span className="text-white">Vid</span>
            </h1>
          </div>
          
          <WalletConnector />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow px-4 py-8">
        <div className="container mx-auto max-w-5xl">
          
          {/* App Intro */}
          <div className="text-center mb-10">
            <h1 className="font-display text-4xl font-bold mb-3 bg-gradient-to-r from-primary to-secondary inline-block text-transparent bg-clip-text">
              GridVid AI Video Generator
            </h1>
            <p className="text-text-secondary max-w-2xl mx-auto">
              Generate stunning AI-powered videos from text on the Grid.
            </p>
          </div>

          {/* App workflow container */}
          <div className="relative z-10">
            <WorkflowStepper />

            {/* Workflow Sections */}
            <div className="workflow-container space-y-8">
              
              {/* Connect Wallet Section Removed */}

              {/* 2. Prompt Input Section */}
              {currentStep === 'prompt' && <VideoGenerator />}

              {/* 3. Payment Section */}
              {currentStep === 'payment' && <PaymentSection />}

              {/* 4. Processing Section */}
              {currentStep === 'processing' && <ProcessingSection />}

              {/* 5. Result Section */}
              {currentStep === 'result' && videoResult && (
                <ResultSection video={videoResult} onNewGeneration={() => setStep('prompt')} />
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto py-6 bg-background">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center">
              <span className="material-icons text-primary text-sm mr-1">movie_filter</span>
              <span className="text-text-secondary text-sm">GridVid | AI Video Generator</span>
            </div>
            <div className="flex space-x-4 mt-4 md:mt-0">
              <a 
                href="https://docs.lukso.tech/guides/universal-profile/browser-extension/" 
                target="_blank" 
                className="text-text-secondary hover:text-text-primary text-sm"
              >
                UP Extension Guide
              </a>
              <a 
                href="https://docs.lukso.tech/" 
                target="_blank" 
                className="text-text-secondary hover:text-text-primary text-sm"
              >
                LUKSO Docs
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
