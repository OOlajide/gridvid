import { useWorkflow } from "@/hooks/use-workflow";

interface Step {
  id: string;
  label: string;
  icon: string;
}

const steps: Step[] = [
  { id: 'prompt', label: 'Prompt', icon: 'palette' },
  { id: 'payment', label: 'Payment', icon: 'payments' },
  { id: 'processing', label: 'Processing', icon: 'autorenew' },
  { id: 'result', label: 'Result', icon: 'movie' }
];

export default function WorkflowStepper() {
  const { 
    currentStep, 
    walletConnected, 
    paymentComplete, 
    isProcessing, 
    hasResult 
  } = useWorkflow();

  const getStepStatus = (stepId: string) => {
    // Current step
    if (stepId === currentStep) {
      return {
        classes: "bg-primary glow",
        iconClasses: "",
      };
    }
    
    // Completed steps
    if (
      (stepId === 'prompt' && currentStep !== 'prompt') ||
      (stepId === 'payment' && paymentComplete) ||
      (stepId === 'processing' && hasResult)
    ) {
      return {
        classes: "bg-secondary",
        iconClasses: "",
      };
    }
    
    // Not reached yet
    return {
      classes: "bg-background-lighter",
      iconClasses: "",
    };
  };

  return (
    <div className="hidden md:flex justify-between items-center mb-8 relative">
      <div className="absolute h-1 bg-background-lighter rounded-full w-full -z-10"></div>
      
      {steps.map((step) => {
        const status = getStepStatus(step.id);
        
        return (
          <div key={step.id} className="flex flex-col items-center">
            <div 
              data-step={step.id} 
              className={`step-indicator w-8 h-8 rounded-full flex items-center justify-center ${status.classes}`}
            >
              <span className={`material-icons text-sm ${status.iconClasses}`}>{step.icon}</span>
            </div>
            <span className={`text-xs mt-2 ${
              step.id === currentStep ? 'text-text-primary' : 'text-text-secondary'
            } font-medium`}>
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
