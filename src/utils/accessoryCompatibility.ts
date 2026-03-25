import type { Accessory, Vehicle } from '../types';

/**
 * Rules in `compatibleWith` (OR — any match shows the accessory):
 * - `all` — any vehicle
 * - exact `vehicle.id` — that catalog variant
 * - `make:Ford` — make equals string after prefix
 * - `model:F-150` — model equals string after prefix
 */
export function isAccessoryCompatibleWithVehicle(
  accessory: Accessory,
  vehicle: Vehicle | null
): boolean {
  if (!vehicle) return true;

  const rules = accessory.compatibleWith;
  if (rules.includes('all')) return true;
  if (rules.includes(vehicle.id)) return true;

  for (const rule of rules) {
    if (rule.startsWith('make:')) {
      if (vehicle.make === rule.slice(5)) return true;
      continue;
    }
    if (rule.startsWith('model:')) {
      if (vehicle.model === rule.slice(6)) return true;
    }
  }

  return false;
}
