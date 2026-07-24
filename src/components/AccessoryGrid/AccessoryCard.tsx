import { useRef } from 'react';
import { Check, FolderOpen, Loader2 } from 'lucide-react';
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  function openFilePicker(e: React.MouseEvent) {
    if (!selected || isUploading) return;
    e.stopPropagation();
    fileInputRef.current?.click();
  }

  const displayUrl =
    (referenceImageUrl && referenceImageUrl.trim()) ||
    (accessory.imageUrl && accessory.imageUrl.trim()) ||
    '';
  const hasUserReference = Boolean(referenceImageUrl?.trim());

  return (
    <div
      onClick={onToggle}
      className={`relative bg-white rounded-xl p-3 border cursor-pointer transition-all flex flex-col items-center text-center
        ${selected ? 'border-yellow-400 border-2 bg-yellow-50' : 'border-gray-200 hover:border-gray-300'}`}
    >
      <div className={`absolute top-2 right-2 w-5 h-5 rounded-full border flex items-center justify-center
        ${selected ? 'bg-yellow-400 border-yellow-400 text-gray-900' : 'border-gray-300 bg-white'}`}>
        {selected ? <Check className="h-3 w-3" strokeWidth={3} aria-hidden /> : null}
      </div>

      <div
        role={selected ? 'button' : undefined}
        tabIndex={selected ? 0 : undefined}
        onClick={openFilePicker}
        onKeyDown={(e) => {
          if (!selected || isUploading) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            fileInputRef.current?.click();
          }
        }}
        className={`relative mb-2 mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border bg-gray-50 text-gray-600
          ${selected ? 'cursor-pointer border-slate-200 hover:border-yellow-400 hover:bg-yellow-50/80' : 'border-transparent'}`}
        aria-label={
          selected
            ? hasUserReference
              ? 'Replace or remove custom reference image'
              : displayUrl
                ? 'Replace reference image'
                : 'Browse for reference image'
            : undefined
        }
      >
        {displayUrl ? (
          <>
            <img
              src={displayUrl}
              alt=""
              className="h-full w-full rounded-md object-contain"
            />
            {selected && hasUserReference ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveReference();
                }}
                className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-bl bg-red-500 text-[10px] font-bold leading-none text-white hover:bg-red-600"
                aria-label="Remove custom image (restore default)"
              >
                ×
              </button>
            ) : null}
          </>
        ) : isUploading && selected ? (
          <Loader2 className="h-6 w-6 animate-spin text-slate-500" strokeWidth={2} aria-hidden />
        ) : (
          <FolderOpen className="h-6 w-6" strokeWidth={2} aria-hidden />
        )}
      </div>

      {selected ? (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          disabled={isUploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            onUploadReference(file);
            e.target.value = '';
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : null}

      <div className="text-xs font-bold text-gray-800 leading-tight mb-1 min-h-[32px] flex items-center">
        {accessory.name}
      </div>
      <div className="text-xs text-yellow-600 font-black">${accessory.price}</div>
    </div>
  );
}
