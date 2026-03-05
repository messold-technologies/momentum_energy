import { Check } from 'lucide-react';

interface Step {
  label: string;
  description?: string;
}

interface StepperProps {
  steps: Step[];
  currentStep: number;
}

export default function Stepper({ steps, currentStep }: StepperProps) {
  return (
    <nav className="mb-8">
      <ol className="flex items-center">
        {steps.map((step, index) => {
          const isComplete = index < currentStep;
          const isCurrent = index === currentStep;

          return (
            <li
              key={step.label}
              className={`flex items-center ${index < steps.length - 1 ? 'flex-1' : ''}`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 transition-colors ${
                    isComplete
                      ? 'bg-primary-600 text-white'
                      : isCurrent
                        ? 'bg-primary-100 text-primary-700 ring-2 ring-primary-600'
                        : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {isComplete ? <Check className="w-4 h-4" /> : index + 1}
                </div>
                <div className="hidden sm:block">
                  <p
                    className={`text-sm font-medium ${isCurrent ? 'text-primary-700' : isComplete ? 'text-gray-900' : 'text-gray-500'}`}
                  >
                    {step.label}
                  </p>
                  {step.description && (
                    <p className="text-xs text-gray-500">{step.description}</p>
                  )}
                </div>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`flex-1 h-px mx-4 ${isComplete ? 'bg-primary-600' : 'bg-gray-200'}`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
