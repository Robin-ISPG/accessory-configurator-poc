interface Props { currentStep: number; }

const steps = ['Vehicle', 'Accessories', 'Preview'];

export default function StepBar({ currentStep }: Props) {
  return (
    <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-2">
      {steps.map((label, i) => {
        const num = i + 1;
        const done = num < currentStep;
        const active = num === currentStep;
        return (
          <div key={label} className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
              ${done ? 'bg-yellow-400 text-gray-900' : active ? 'border-2 border-gray-900 text-gray-900' : 'border border-gray-300 text-gray-400'}`}>
              {done ? '✓' : num}
            </div>
            <span className={`text-xs font-medium ${active ? 'text-gray-900' : done ? 'text-yellow-500' : 'text-gray-400'}`}>
              {label}
            </span>
            {i < steps.length - 1 && <span className="text-gray-300 mx-1">›</span>}
          </div>
        );
      })}
    </div>
  );
}
