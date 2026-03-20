import type { Vehicle } from '../types';

export const vehicles: Vehicle[] = [
  { id: 'ford-f150-2024', make: 'Ford', model: 'F-150', year: '2024', variant: 'XL Base', baseImageUrl: '' },
  { id: 'ford-f150-2024-sport', make: 'Ford', model: 'F-150', year: '2024', variant: 'Sport Edition', baseImageUrl: '' },
  { id: 'ford-bronco-2024', make: 'Ford', model: 'Bronco', year: '2024', variant: 'Base', baseImageUrl: '' },
  { id: 'toyota-tundra-2024', make: 'Toyota', model: 'Tundra', year: '2024', variant: 'SR Base', baseImageUrl: '' },
  { id: 'toyota-tacoma-2024', make: 'Toyota', model: 'Tacoma', year: '2024', variant: 'SR', baseImageUrl: '' },
  { id: 'jeep-wrangler-2024', make: 'Jeep', model: 'Wrangler', year: '2024', variant: 'Sport', baseImageUrl: '' },
];

export const makes = ['Ford', 'Toyota', 'Jeep'];

export const modelsByMake: Record<string, string[]> = {
  Ford: ['F-150', 'Bronco', 'Ranger'],
  Toyota: ['Tundra', 'Tacoma', '4Runner'],
  Jeep: ['Wrangler', 'Gladiator', 'Cherokee'],
};

export const years = ['2026', '2025', '2024', '2023'];
