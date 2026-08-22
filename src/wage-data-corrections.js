/**
 * Corrections verified against the official Kemnaker 2025 wage appendix.
 * Kept separate so the compact city dataset stays easy to audit and update.
 */
import { CITY_WAGES_2025, COMPARE_WAGES_2025 } from './data/wages-2025.js';

const corrections = new Map([
  ['Kota Makassar', { value: 3880137, basis: 'UMK' }],
  ['Kota Jayapura', { value: 4285850, basis: 'UMP' }],
  ['Kota Sorong', { value: 3614000, basis: 'UMP' }],
]);

function apply(items) {
  for (const item of items) {
    const patch = corrections.get(item.name);
    if (!patch) continue;
    item.value = patch.value;
    item.basis = patch.basis;
    item.kind = patch.basis;
    item.annual = patch.value * 12;
    if (patch.basis === 'UMP') item.note = 'UMK tidak ditetapkan; UMP 2025 berlaku sebagai acuan';
  }
}

apply(CITY_WAGES_2025);
apply(COMPARE_WAGES_2025);
