export interface ZoneCoverage {
  provinces: string | null;
  districts: string | null;
  municipalities: string | null;
}

const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+province$/, '');
const list = (value: string | null) => (value ?? '').split(',').map(normalize).filter(Boolean);

export function zoneCoversAddress(zone: ZoneCoverage, address: { province: string; district: string; municipality: string }) {
  const provinces = list(zone.provinces);
  const districts = list(zone.districts);
  const municipalities = list(zone.municipalities);
  const province = normalize(address.province);
  const district = normalize(address.district);
  const municipality = normalize(address.municipality);

  if (!provinces.includes(province)) return false;
  if (districts.length > 0 && !districts.includes(district)) return false;
  if (municipalities.length > 0 && !municipalities.includes(municipality)) return false;
  return true;
}
