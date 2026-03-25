import type { Accessory } from '../types';

/** POC catalog: compact set of popular, visually obvious items per category */
export const accessories: Accessory[] = [
  // Exterior
  { id: 'acc-2', name: 'Sport Front Bumper', category: 'exterior', price: 499, compatibleWith: ['all'] },
  { id: 'acc-3', name: 'Fender Flares', category: 'exterior', price: 349, compatibleWith: ['all'] },
  { id: 'acc-4', name: 'Running Boards', category: 'exterior', price: 279, compatibleWith: ['all'] },
  { id: 'acc-18', name: 'Bull Bar', category: 'exterior', price: 329, compatibleWith: ['all'] },
  { id: 'acc-19', name: 'Brush Guard', category: 'exterior', price: 399, compatibleWith: ['all'] },
  { id: 'acc-24', name: 'Tool Box', category: 'exterior', price: 449, compatibleWith: ['all'] },
  { id: 'acc-27', name: 'Cargo Net', category: 'exterior', price: 49, compatibleWith: ['all'] },
  { id: 'acc-28', name: 'Mud Flaps', category: 'exterior', price: 79, compatibleWith: ['all'] },
  { id: 'acc-39', name: 'Grille Guard', category: 'exterior', price: 249, compatibleWith: ['all'] },

  // Wheels & Tires
  { id: 'acc-5', name: 'Alloy Wheels 18"', category: 'wheels', price: 899, compatibleWith: ['all'] },
  { id: 'acc-6', name: 'Off-Road Tires', category: 'wheels', price: 649, compatibleWith: ['all'] },
  { id: 'acc-7', name: 'Lift Kit 3"', category: 'wheels', price: 799, compatibleWith: ['all'] },
  { id: 'acc-41', name: 'Alloy Wheels 20"', category: 'wheels', price: 1199, compatibleWith: ['all'] },
  { id: 'acc-45', name: 'All-Terrain Tires', category: 'wheels', price: 749, compatibleWith: ['all'] },
  { id: 'acc-48', name: 'Lift Kit 2"', category: 'wheels', price: 599, compatibleWith: ['all'] },
  { id: 'acc-51', name: 'Leveling Kit', category: 'wheels', price: 299, compatibleWith: ['all'] },

  // Interior
  { id: 'acc-9', name: 'Seat Covers', category: 'interior', price: 199, compatibleWith: ['all'] },
  { id: 'acc-10', name: 'Floor Mats', category: 'interior', price: 89, compatibleWith: ['all'] },
  { id: 'acc-11', name: 'LED Interior Kit', category: 'interior', price: 129, compatibleWith: ['all'] },
  { id: 'acc-12', name: 'Dash Camera', category: 'interior', price: 249, compatibleWith: ['all'] },
  { id: 'acc-61', name: 'All-Weather Floor Mats', category: 'interior', price: 149, compatibleWith: ['all'] },
  { id: 'acc-74', name: 'Wireless Charger', category: 'interior', price: 79, compatibleWith: ['all'] },
  { id: 'acc-80', name: 'Backup Camera', category: 'interior', price: 199, compatibleWith: ['all'] },

  // Performance
  { id: 'acc-13', name: 'Cold Air Intake', category: 'performance', price: 379, compatibleWith: ['all'] },
  { id: 'acc-14', name: 'Exhaust Upgrade', category: 'performance', price: 599, compatibleWith: ['all'] },
  { id: 'acc-15', name: 'Suspension Kit', category: 'performance', price: 849, compatibleWith: ['all'] },
  { id: 'acc-16', name: 'Tow Package', category: 'performance', price: 449, compatibleWith: ['all'] },
  { id: 'acc-87', name: 'Performance Chip', category: 'performance', price: 299, compatibleWith: ['all'] },
  { id: 'acc-92', name: 'Cat-Back Exhaust', category: 'performance', price: 799, compatibleWith: ['all'] },
  { id: 'acc-110', name: 'Brake Upgrade Kit', category: 'performance', price: 799, compatibleWith: ['all'] },
];
