import type { Accessory } from '../../types';

interface Props {
  accessory: Accessory;
  selected: boolean;
  onToggle: () => void;
}

export default function AccessoryCard({ accessory, selected, onToggle }: Props) {
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
    </div>
  );
}
