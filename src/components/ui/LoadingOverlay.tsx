interface Props {
  loadingMsg: string;
  progress: number;
}

export default function LoadingOverlay({ loadingMsg, progress }: Props) {
  const clamped = Math.min(100, Math.max(0, progress));
  const barWidth = clamped <= 0 ? 0 : Math.max(clamped, 5);
  const showPulse = clamped >= 82 && clamped < 100;

  return (
    <div className="fixed inset-0 bg-black/55 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl p-8 text-center w-full max-w-sm shadow-2xl border border-gray-100">
        <div className="relative w-16 h-16 mx-auto mb-4">
          <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36" aria-hidden>
            <circle
              cx="18"
              cy="18"
              r="15.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className="text-gray-200"
            />
            <circle
              cx="18"
              cy="18"
              r="15.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${(clamped / 100) * 97.4} 97.4`}
              className="text-yellow-400 transition-[stroke-dasharray] duration-300 ease-out"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-700 tabular-nums">
            {Math.round(clamped)}%
          </span>
        </div>

        <div className="font-bold text-lg mb-1 text-gray-800">Generating preview</div>
        <p
          className={`text-sm text-gray-600 mb-4 min-h-11 leading-snug ${showPulse ? 'animate-pulse' : ''}`}
        >
          {loadingMsg}
        </p>

        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-[width] duration-200 ease-out ${
              showPulse ? 'bg-linear-to-r from-yellow-400 via-amber-300 to-yellow-400 animate-pulse' : 'bg-yellow-400'
            }`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
        <p className="text-[10px] text-gray-400 mt-2">
          {clamped >= 100 ? 'Almost done…' : 'Request is active — slow steps are normal for cloud generation.'}
        </p>
      </div>
    </div>
  );
}
