/**
 * Derive province from district name for Rwanda administrative geography.
 * Used when API clients omit `province` on case create (e.g. CHW flow).
 */

const KIGALI_DISTRICTS = new Set(['Gasabo', 'Kicukiro', 'Nyarugenge']);
const NORTHERN_DISTRICTS = new Set([
  'Burera',
  'Gakenke',
  'Gicumbi',
  'Musanze',
  'Rulindo',
]);
const SOUTHERN_DISTRICTS = new Set([
  'Kamonyi',
  'Muhanga',
  'Ruhango',
  'Nyanza',
  'Huye',
  'Gisagara',
  'Nyaruguru',
  'Nyamagabe',
]);
const EASTERN_DISTRICTS = new Set([
  'Bugesera',
  'Gatsibo',
  'Kayonza',
  'Kirehe',
  'Ngoma',
  'Nyagatare',
  'Rwamagana',
]);
const WESTERN_DISTRICTS = new Set([
  'Karongi',
  'Ngororero',
  'Nyabihu',
  'Nyamasheke',
  'Rubavu',
  'Rusizi',
  'Rutsiro',
]);

export function provinceFromDistrict(district: string | undefined | null): string {
  const d = (district ?? '').trim();
  if (!d) return 'Southern Province';
  if (KIGALI_DISTRICTS.has(d)) return 'Kigali City';
  if (NORTHERN_DISTRICTS.has(d)) return 'Northern Province';
  if (SOUTHERN_DISTRICTS.has(d)) return 'Southern Province';
  if (EASTERN_DISTRICTS.has(d)) return 'Eastern Province';
  if (WESTERN_DISTRICTS.has(d)) return 'Western Province';
  return 'Southern Province';
}
