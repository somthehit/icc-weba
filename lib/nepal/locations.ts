// lib/nepal/locations.ts
//
// Nepal administrative hierarchy: Province → District → Municipality/Rural Municipality → Ward count.
//
// Used by the address form for cascading dropdowns. Sudurpashchim Province has
// full detail (all municipalities and wards); other provinces have districts
// listed so the dropdowns still work for nationwide expansion.

export interface Municipality {
  name: string;
  /** Number of wards in this municipality / rural municipality. */
  wards: number;
  type: 'metropolitan' | 'sub-metropolitan' | 'municipality' | 'rural-municipality';
}

export interface District {
  name: string;
  municipalities: Municipality[];
}

export interface Province {
  code: string;
  label: string;
  districts: District[];
}

// ────────────────────────────────────────────────────────────────────────────
// Sudurpashchim Province — full detail (primary delivery region)
// ────────────────────────────────────────────────────────────────────────────

const SUDURPASHCHIM: District[] = [
  {
    name: 'Kailali',
    municipalities: [
      { name: 'Dhangadhi Sub-Metropolitan City', wards: 19, type: 'sub-metropolitan' },
      { name: 'Tikapur Municipality', wards: 15, type: 'municipality' },
      { name: 'Godawari Municipality', wards: 14, type: 'municipality' },
      { name: 'Lamki Chuha Municipality', wards: 14, type: 'municipality' },
      { name: 'Bhajani Municipality', wards: 9, type: 'municipality' },
      { name: 'Bardagoriya Rural Municipality', wards: 9, type: 'rural-municipality' },
      { name: 'Ghodaghodi Municipality', wards: 9, type: 'municipality' },
      { name: 'Attariya Municipality', wards: 9, type: 'municipality' },
      { name: 'Chure Rural Municipality', wards: 7, type: 'rural-municipality' },
      { name: 'Jonpur Rural Municipality', wards: 7, type: 'rural-municipality' },
      { name: 'Mohanpur Rural Municipality', wards: 7, type: 'rural-municipality' },
      { name: 'Sukkhad Rural Municipality', wards: 7, type: 'rural-municipality' },
    ],
  },
  {
    name: 'Kanchanpur',
    municipalities: [
      { name: 'Bhimdatta Municipality', wards: 13, type: 'municipality' },
      { name: 'Mahendranagar Municipality', wards: 11, type: 'municipality' },
      { name: 'Belauri Municipality', wards: 9, type: 'municipality' },
      { name: 'Punarbas Municipality', wards: 9, type: 'municipality' },
      { name: 'Shuklaphanta Municipality', wards: 9, type: 'municipality' },
      { name: 'Chandani Chaur Municipality', wards: 9, type: 'municipality' },
      { name: 'Bedkot Municipality', wards: 9, type: 'municipality' },
      { name: 'Kanchanpur Municipality', wards: 9, type: 'municipality' },
      { name: 'LaLIKhan Rural Municipality', wards: 7, type: 'rural-municipality' },
      { name: 'Dhangadhi Sub-Metropolitan City (Kanchanpur ward share)', wards: 5, type: 'sub-metropolitan' },
    ],
  },
  {
    name: 'Dadeldhura',
    municipalities: [
      { name: 'Amargadhi Municipality', wards: 10, type: 'municipality' },
      { name: 'Jayaprithvi Municipality', wards: 10, type: 'municipality' },
      { name: 'Aesham Rural Municipality', wards: 8, type: 'rural-municipality' },
      { name: 'Bhageshwor Rural Municipality', wards: 6, type: 'rural-municipality' },
      { name: 'Gankhet Rural Municipality', wards: 6, type: 'rural-municipality' },
      { name: 'Nawadurga Rural Municipality', wards: 6, type: 'rural-municipality' },
      { name: 'Parshuram Municipality', wards: 8, type: 'municipality' },
    ],
  },
  {
    name: 'Doti',
    municipalities: [
      { name: 'Dipayal Silgadhi Municipality', wards: 11, type: 'municipality' },
      { name: 'Shikhar Municipality', wards: 10, type: 'municipality' },
      { name: 'Bogatan Phudsil Rural Municipality', wards: 8, type: 'rural-municipality' },
      { name: 'Durgathali Rural Municipality', wards: 7, type: 'rural-municipality' },
      { name: 'Kapidada Rural Municipality', wards: 7, type: 'rural-municipality' },
      { name: 'Sailpur Rural Municipality', wards: 7, type: 'rural-municipality' },
      { name: 'Thantikandh Rural Municipality', wards: 6, type: 'rural-municipality' },
    ],
  },
  {
    name: 'Baitadi',
    municipalities: [
      { name: 'Dasharathchand Municipality', wards: 10, type: 'municipality' },
      { name: 'Patan Municipality', wards: 10, type: 'municipality' },
      { name: 'Purchaudi Municipality', wards: 8, type: 'municipality' },
      { name: 'Melauli Municipality', wards: 8, type: 'municipality' },
      { name: 'Sigas Rural Municipality', wards: 7, type: 'rural-municipality' },
      { name: 'Surnaya Rural Municipality', wards: 6, type: 'rural-municipality' },
      { name: 'Dogadakedar Rural Municipality', wards: 7, type: 'rural-municipality' },
    ],
  },
  {
    name: 'Achham',
    municipalities: [
      { name: 'Mangalsen Municipality', wards: 11, type: 'municipality' },
      { name: 'Sanfebagar Municipality', wards: 10, type: 'municipality' },
      { name: 'Kamalbadi Municipality', wards: 9, type: 'municipality' },
      { name: 'Narayan Municipality', wards: 9, type: 'municipality' },
      { name: 'Chaurpati Rural Municipality', wards: 7, type: 'rural-municipality' },
      { name: 'Dhakari Rural Municipality', wards: 7, type: 'rural-municipality' },
      { name: 'Rimet Rural Municipality', wards: 7, type: 'rural-municipality' },
      { name: 'Sarkikot Rural Municipality', wards: 7, type: 'rural-municipality' },
    ],
  },
  {
    name: 'Bajhang',
    municipalities: [
      { name: 'Jayaprithvi Municipality', wards: 10, type: 'municipality' },
      { name: 'Baiteshwor Rural Municipality', wards: 8, type: 'rural-municipality' },
      { name: 'Chhabis Pathibhara Rural Municipality', wards: 8, type: 'rural-municipality' },
      { name: 'Durgathali Rural Municipality', wards: 7, type: 'rural-municipality' },
      { name: 'Jaya Prithvi Rural Municipality', wards: 7, type: 'rural-municipality' },
      { name: 'Khatiwada Rural Municipality', wards: 7, type: 'rural-municipality' },
      { name: 'Masta Rural Municipality', wards: 7, type: 'rural-municipality' },
      { name: 'Thuli Rural Municipality', wards: 7, type: 'rural-municipality' },
    ],
  },
  {
    name: 'Bajura',
    municipalities: [
      { name: 'Badimalika Municipality', wards: 10, type: 'municipality' },
      { name: 'Triveni Municipality', wards: 9, type: 'municipality' },
      { name: 'Budhinanda Municipality', wards: 8, type: 'municipality' },
      { name: 'Himali Rural Municipality', wards: 6, type: 'rural-municipality' },
      { name: 'Jagannath Rural Municipality', wards: 7, type: 'rural-municipality' },
      { name: 'Naugad Rural Municipality', wards: 7, type: 'rural-municipality' },
      { name: 'Panikot Rural Municipality', wards: 6, type: 'rural-municipality' },
    ],
  },
  {
    name: 'Darchula',
    municipalities: [
      { name: 'Darchula Municipality', wards: 10, type: 'municipality' },
      { name: 'Mahakali Municipality', wards: 9, type: 'municipality' },
      { name: 'Shailyashikhar Municipality', wards: 9, type: 'municipality' },
      { name: 'Badhuwari Rural Municipality', wards: 6, type: 'rural-municipality' },
      { name: 'Bhageshwor Rural Municipality', wards: 6, type: 'rural-municipality' },
      { name: 'Dunai Rural Municipality', wards: 6, type: 'rural-municipality' },
      { name: 'Lekam Rural Municipality', wards: 6, type: 'rural-municipality' },
      { name: 'Marma Rural Municipality', wards: 6, type: 'rural-municipality' },
      { name: 'Naugad Rural Municipality', wards: 6, type: 'rural-municipality' },
    ],
  },
];

// ────────────────────────────────────────────────────────────────────────────
// Other provinces — districts only (municipalities will be added as the store
// expands nationwide)
// ────────────────────────────────────────────────────────────────────────────

const OTHER_PROVINCES: Province[] = [
  {
    code: 'koshi',
    label: 'Koshi Province',
    districts: [
      { name: 'Bhojpur', municipalities: [] },
      { name: 'Dhankuta', municipalities: [] },
      { name: 'Ilam', municipalities: [] },
      { name: 'Jhapa', municipalities: [] },
      { name: 'Khotang', municipalities: [] },
      { name: 'Morang', municipalities: [] },
      { name: 'Okhaldhunga', municipalities: [] },
      { name: 'Panchthar', municipalities: [] },
      { name: 'Sankhuwasabha', municipalities: [] },
      { name: 'Solukhumbu', municipalities: [] },
      { name: 'Sunsari', municipalities: [] },
      { name: 'Taplejung', municipalities: [] },
      { name: 'Terhathum', municipalities: [] },
      { name: 'Udayapur', municipalities: [] },
    ],
  },
  {
    code: 'madhesh',
    label: 'Madhesh Province',
    districts: [
      { name: 'Parsa', municipalities: [] },
      { name: 'Bara', municipalities: [] },
      { name: 'Rautahat', municipalities: [] },
      { name: 'Sarlahi', municipalities: [] },
      { name: 'Mahottari', municipalities: [] },
      { name: 'Dhanusha', municipalities: [] },
      { name: 'Siraha', municipalities: [] },
    ],
  },
  {
    code: 'bagmati',
    label: 'Bagmati Province',
    districts: [
      { name: 'Kathmandu', municipalities: [] },
      { name: 'Bhaktapur', municipalities: [] },
      { name: 'Lalitpur', municipalities: [] },
      { name: 'Kavrepalanchok', municipalities: [] },
      { name: 'Nuwakot', municipalities: [] },
      { name: 'Rasuwa', municipalities: [] },
      { name: 'Dhading', municipalities: [] },
      { name: 'Makwanpur', municipalities: [] },
      { name: 'Chitwan', municipalities: [] },
      { name: 'Bara', municipalities: [] },
      { name: 'Parsa', municipalities: [] },
    ],
  },
  {
    code: 'gandaki',
    label: 'Gandaki Province',
    districts: [
      { name: 'Gorkha', municipalities: [] },
      { name: 'Lamjung', municipalities: [] },
      { name: 'Tanahu', municipalities: [] },
      { name: 'Nawalparasi East', municipalities: [] },
      { name: 'Syangja', municipalities: [] },
      { name: 'Kaski', municipalities: [] },
      { name: 'Manang', municipalities: [] },
      { name: 'Mustang', municipalities: [] },
      { name: 'Myagdi', municipalities: [] },
      { name: 'Parbat', municipalities: [] },
      { name: 'Baglung', municipalities: [] },
      { name: 'Palpa', municipalities: [] },
    ],
  },
  {
    code: 'lumbini',
    label: 'Lumbini Province',
    districts: [
      { name: 'Kapilvastu', municipalities: [] },
      { name: 'Rupandehi', municipalities: [] },
      { name: 'Nawalparasi West', municipalities: [] },
      { name: 'Rolpa', municipalities: [] },
      { name: 'Eastern Rukum', municipalities: [] },
      { name: 'Gulmi', municipalities: [] },
      { name: 'Arghakhanchi', municipalities: [] },
      { name: 'Pyuthan', municipalities: [] },
      { name: 'Dang', municipalities: [] },
      { name: 'Banke', municipalities: [] },
      { name: 'Bardiya', municipalities: [] },
    ],
  },
  {
    code: 'karnali',
    label: 'Karnali Province',
    districts: [
      { name: 'Humla', municipalities: [] },
      { name: 'Mugu', municipalities: [] },
      { name: 'Jumla', municipalities: [] },
      { name: 'Dolpa', municipalities: [] },
      { name: 'Kalikot', municipalities: [] },
      { name: 'Jajarkot', municipalities: [] },
      { name: 'Dailekh', municipalities: [] },
      { name: 'Surkhet', municipalities: [] },
      { name: 'Western Rukum', municipalities: [] },
    ],
  },
];

// ────────────────────────────────────────────────────────────────────────────
// Combined dataset
// ────────────────────────────────────────────────────────────────────────────

export const NEPAL_PROVINCES: Province[] = [
  {
    code: 'sudurpashchim',
    label: 'Sudurpashchim Province',
    districts: SUDURPASHCHIM,
  },
  ...OTHER_PROVINCES,
];

/**
 * Look up a province by its enum code (e.g. `'sudurpashchim'`).
 * Returns `undefined` if the code is unknown.
 */
export function findProvince(code: string): Province | undefined {
  return NEPAL_PROVINCES.find((p) => p.code === code);
}

/**
 * Get districts for a province code. Returns an empty array for unknown provinces.
 */
export function getDistrictsForProvince(provinceCode: string): District[] {
  return findProvince(provinceCode)?.districts ?? [];
}

/**
 * Get municipalities for a district within a province.
 * Returns an empty array if the province or district is unknown.
 */
export function getMunicipalitiesForDistrict(provinceCode: string, districtName: string): Municipality[] {
  const province = findProvince(provinceCode);
  if (!province) return [];
  const district = province.districts.find(
    (d) => d.name.toLowerCase() === districtName.toLowerCase(),
  );
  return district?.municipalities ?? [];
}

/**
 * Get the ward count for a municipality. Returns 0 if not found.
 */
export function getWardCount(provinceCode: string, districtName: string, municipalityName: string): number {
  const municipalities = getMunicipalitiesForDistrict(provinceCode, districtName);
  const municipality = municipalities.find(
    (m) => m.name.toLowerCase() === municipalityName.toLowerCase(),
  );
  return municipality?.wards ?? 0;
}

/**
 * Generate ward number options for a given count.
 * Returns `['1', '2', …, 'N']`.
 */
export function wardOptions(count: number): string[] {
  return Array.from({ length: count }, (_, i) => String(i + 1));
}
