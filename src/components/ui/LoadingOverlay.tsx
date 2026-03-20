interface Props {
  loadingMsg: string;
  progress: number;
}

export default function LoadingOverlay({ loadingMsg, progress }: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 text-center w-72">
        <div className="w-10 h-10 border-4 border-gray-200 border-t-yellow-400 rounded-full animate-spin mx-auto mb-4" />
        <div className="font-bold text-lg mb-1">Generating Preview</div>
        <div className="text-sm text-gray-500 mb-4">{loadingMsg}</div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-yellow-400 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
}
