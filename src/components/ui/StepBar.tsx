interface Props { currentStep: number; }

const steps = ['Vehicle', 'Configure'];

export default function StepBar({ currentStep }: Props) {
  return (
    <div className="bg-[#1a1a1a] border-b border-[#2a2a2a] px-6 py-3 flex items-center gap-2 w-full">
      {steps.map((label, i) => {
        const num = i + 1;
        const done = num < currentStep;
        const active = num === currentStep;
        return (
          <div key={label} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold
              ${done ? 'bg-white text-gray-900' : active ? 'border-2 border-white text-white' : 'border border-gray-600 text-gray-500'}`}>
              {done ? '✓' : num}
            </div>
            <span className={`text-xs font-medium ${active ? 'text-white' : done ? 'text-white' : 'text-gray-500'}`}>
              {label}
            </span>
            {i < steps.length - 1 && <span className="text-gray-600 mx-1">›</span>}
          </div>
        );
      })}
    </div>
  );
}
