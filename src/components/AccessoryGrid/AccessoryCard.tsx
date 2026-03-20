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
      className={`bg-white rounded-xl p-3 border cursor-pointer transition-all flex gap-3 items-start
        ${selected ? 'border-yellow-400 border-2 bg-yellow-50' : 'border-gray-200 hover:border-gray-400'}`}
    >
      <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-xl flex-shrink-0">
        🔧
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-800">{accessory.name}</div>
        <div className="text-xs text-yellow-500 font-semibold">${accessory.price}</div>
      </div>
      <div className={`w-5 h-5 rounded-full border flex items-center justify-center text-xs flex-shrink-0 mt-0.5
        ${selected ? 'bg-yellow-400 border-yellow-400 text-white' : 'border-gray-300'}`}>
        {selected ? '✓' : ''}
      </div>
    </div>
  );
}
