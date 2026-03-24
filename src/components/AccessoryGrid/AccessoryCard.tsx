import type { Accessory } from '../../types';

interface Props {
  accessory: Accessory;
  selected: boolean;
  onToggle: () => void;
  referenceImageUrl?: string;
  isUploading?: boolean;
  onUploadReference: (file: File) => void;
  onRemoveReference: () => void;
}

export default function AccessoryCard({
  accessory,
  selected,
  onToggle,
  referenceImageUrl,
  isUploading = false,
  onUploadReference,
  onRemoveReference,
}: Props) {
  return (
    <div
      onClick={onToggle}
      className={`relative bg-white rounded-xl p-3 border cursor-pointer transition-all flex flex-col items-center text-center
        ${selected ? 'border-yellow-400 border-2 bg-yellow-50' : 'border-gray-200 hover:border-gray-300'}`}
    >
      {/* Absolute positioned checkbox */}
      <div className={`absolute top-2 right-2 w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold
        ${selected ? 'bg-yellow-400 border-yellow-400 text-gray-900' : 'border-gray-300 bg-white'}`}>
        {selected ? '✓' : ''}
      </div>

      <div className="w-12 h-12 bg-gray-50 rounded-lg flex items-center justify-center text-2xl mb-2 mt-1">
        🔧
      </div>
      
      <div className="text-xs font-bold text-gray-800 leading-tight mb-1 min-h-[32px] flex items-center">
        {accessory.name}
      </div>
      <div className="text-xs text-yellow-600 font-black">${accessory.price}</div>

      {selected ? (
        <div
          className="mt-2 w-full border-t border-slate-200 pt-2"
          onClick={e => e.stopPropagation()}
        >
          {isUploading ? (
            <div className="text-[10px] text-slate-500 font-semibold mb-1">Uploading...</div>
          ) : null}
          <input
            type="file"
            accept="image/*"
            disabled={isUploading}
            onChange={e => {
              const file = e.target.files?.[0];
              if (!file) return;
              onUploadReference(file);
              e.target.value = '';
            }}
            className="w-full text-[10px] text-gray-500 file:mr-1 file:py-1 file:px-2 file:rounded file:border-0 file:text-[9px] file:font-bold file:bg-slate-200 file:text-slate-800 disabled:opacity-50"
          />
          {referenceImageUrl ? (
            <div className="relative w-14 h-14 rounded-md overflow-hidden border border-slate-300 bg-slate-50 mt-2 mx-auto">
              <img
                src={referenceImageUrl}
                alt=""
                className="w-full h-full object-contain"
              />
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  onRemoveReference();
                }}
                className="absolute top-0 right-0 bg-red-500 text-white text-[10px] w-4 h-4 leading-4 text-center rounded-bl"
              >
                x
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
