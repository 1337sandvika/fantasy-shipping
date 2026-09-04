export type Port = {
  id: string;
  name: string;
  country: string;
  lon: number;
  lat: number;
  hub: boolean;
  yard: boolean;
  bunker: number;
  lng: boolean;
};

export const PORTS: Port[] = [
  { id: "zeebrugge", name: "Zeebrugge", country: "be", lon: 3.2, lat: 51.33, hub: true, yard: true, bunker: 620, lng: true },
  { id: "flushing", name: "Flushing", country: "nl", lon: 3.59, lat: 51.45, hub: true, yard: true, bunker: 610, lng: true },
  { id: "cuxhaven", name: "Cuxhaven", country: "de", lon: 8.7, lat: 53.87, hub: true, yard: false, bunker: 640, lng: false },
  { id: "bremerhaven", name: "Bremerhaven", country: "de", lon: 8.58, lat: 53.54, hub: true, yard: true, bunker: 635, lng: true },
  { id: "emden", name: "Emden", country: "de", lon: 7.21, lat: 53.36, hub: false, yard: false, bunker: 630, lng: false },
  { id: "southampton", name: "Southampton", country: "gb", lon: -1.4, lat: 50.9, hub: false, yard: false, bunker: 680, lng: false },
  { id: "tyne", name: "Tyne", country: "gb", lon: -1.43, lat: 55.01, hub: false, yard: false, bunker: 670, lng: false },
  { id: "lehavre", name: "Le Havre", country: "fr", lon: 0.11, lat: 49.49, hub: true, yard: false, bunker: 655, lng: true },
  { id: "dublin", name: "Dublin", country: "ie", lon: -6.21, lat: 53.34, hub: false, yard: false, bunker: 690, lng: false },
  { id: "esbjerg", name: "Esbjerg", country: "dk", lon: 8.44, lat: 55.47, hub: false, yard: false, bunker: 650, lng: false },
  { id: "goteborg", name: "Göteborg", country: "se", lon: 11.94, lat: 57.7, hub: true, yard: false, bunker: 660, lng: true },
  { id: "malmo", name: "Malmö", country: "se", lon: 13.0, lat: 55.61, hub: false, yard: false, bunker: 655, lng: false },
  { id: "drammen", name: "Drammen", country: "no", lon: 10.23, lat: 59.74, hub: false, yard: false, bunker: 700, lng: false },
  { id: "gdansk", name: "Gdańsk", country: "pl", lon: 18.67, lat: 54.38, hub: false, yard: false, bunker: 610, lng: false },
  { id: "paldiski", name: "Paldiski", country: "ee", lon: 24.05, lat: 59.35, hub: false, yard: false, bunker: 640, lng: false },
  { id: "helsinki", name: "Helsinki", country: "fi", lon: 25.2, lat: 60.16, hub: false, yard: false, bunker: 680, lng: false },
  { id: "vigo", name: "Vigo", country: "es", lon: -8.72, lat: 42.24, hub: true, yard: false, bunker: 600, lng: false },
  { id: "setubal", name: "Setúbal", country: "pt", lon: -8.89, lat: 38.52, hub: false, yard: false, bunker: 590, lng: false },
  { id: "sagunto", name: "Sagunto", country: "es", lon: -0.22, lat: 39.65, hub: false, yard: false, bunker: 610, lng: false },
  { id: "barcelona", name: "Barcelona", country: "es", lon: 2.17, lat: 41.35, hub: true, yard: false, bunker: 625, lng: true },
  { id: "fos", name: "Fos-sur-Mer", country: "fr", lon: 4.86, lat: 43.42, hub: false, yard: false, bunker: 640, lng: false },
  { id: "livorno", name: "Livorno", country: "it", lon: 10.3, lat: 43.55, hub: true, yard: false, bunker: 630, lng: false },
  { id: "koper", name: "Koper", country: "si", lon: 13.74, lat: 45.55, hub: false, yard: false, bunker: 615, lng: false },
  { id: "piraeus", name: "Piraeus", country: "gr", lon: 23.64, lat: 37.94, hub: true, yard: false, bunker: 620, lng: false },
  { id: "derince", name: "Derince", country: "tr", lon: 29.83, lat: 40.75, hub: false, yard: false, bunker: 580, lng: false },
  { id: "tangier", name: "Tanger Med", country: "ma", lon: -5.5, lat: 35.88, hub: true, yard: false, bunker: 560, lng: true },
  { id: "portsaid", name: "Port Said", country: "eg", lon: 32.31, lat: 31.26, hub: true, yard: false, bunker: 540, lng: false },
  { id: "baltimore", name: "Baltimore", country: "us", lon: -76.58, lat: 39.25, hub: true, yard: true, bunker: 710, lng: true },
  { id: "jacksonville", name: "Jacksonville", country: "us", lon: -81.55, lat: 30.39, hub: true, yard: false, bunker: 700, lng: false },
  { id: "veracruz", name: "Veracruz", country: "mx", lon: -96.13, lat: 19.2, hub: false, yard: false, bunker: 580, lng: false },
  { id: "santos", name: "Santos", country: "br", lon: -46.3, lat: -23.96, hub: true, yard: true, bunker: 560, lng: false },
  { id: "buenosaires", name: "Buenos Aires", country: "ar", lon: -58.37, lat: -34.6, hub: false, yard: false, bunker: 590, lng: false },
  { id: "longbeach", name: "Long Beach", country: "us", lon: -118.22, lat: 33.75, hub: true, yard: true, bunker: 740, lng: true },
  { id: "vancouver", name: "Vancouver", country: "ca", lon: -123.08, lat: 49.31, hub: false, yard: false, bunker: 720, lng: false },
  { id: "capetown", name: "Cape Town", country: "za", lon: 18.43, lat: -33.91, hub: true, yard: false, bunker: 600, lng: false },
  { id: "durban", name: "Durban", country: "za", lon: 31.05, lat: -29.87, hub: true, yard: true, bunker: 595, lng: false },
  { id: "jeddah", name: "Jeddah", country: "sa", lon: 39.16, lat: 21.49, hub: false, yard: false, bunker: 520, lng: false },
  { id: "jebelali", name: "Jebel Ali", country: "ae", lon: 55.03, lat: 24.98, hub: true, yard: false, bunker: 530, lng: true },
  { id: "mumbai", name: "Nhava Sheva", country: "in", lon: 72.95, lat: 18.95, hub: true, yard: false, bunker: 545, lng: false },
  { id: "singapore", name: "Singapore", country: "sg", lon: 103.84, lat: 1.26, hub: true, yard: true, bunker: 580, lng: true },
  { id: "laemchabang", name: "Laem Chabang", country: "th", lon: 100.88, lat: 13.08, hub: false, yard: false, bunker: 575, lng: false },
  { id: "shanghai", name: "Shanghai", country: "cn", lon: 121.55, lat: 31.37, hub: true, yard: false, bunker: 560, lng: true },
  { id: "busan", name: "Busan", country: "kr", lon: 129.04, lat: 35.1, hub: true, yard: false, bunker: 590, lng: true },
  { id: "yokohama", name: "Yokohama", country: "jp", lon: 139.64, lat: 35.44, hub: true, yard: true, bunker: 730, lng: true },
  { id: "melbourne", name: "Melbourne", country: "au", lon: 144.92, lat: -37.84, hub: true, yard: false, bunker: 680, lng: false },
  { id: "auckland", name: "Auckland", country: "nz", lon: 174.79, lat: -36.84, hub: false, yard: false, bunker: 700, lng: false },
];

const BY_ID = Object.fromEntries(PORTS.map((p) => [p.id, p]));

export function getPort(id: string): Port {
  return BY_ID[id] ?? PORTS[0]!;
}

export function portName(id: string): string {
  return getPort(id).name;
}

/** EEA countries in this atlas — EU ETS maritime scope. UK is out. */
const EEA = new Set(["be", "nl", "de", "fr", "ie", "dk", "se", "pl", "ee", "fi", "es", "pt", "it", "si", "gr", "no"]);

export function inEeaCountry(country: string): boolean {
  return EEA.has(country);
}

export function inEeaPort(id: string): boolean {
  return inEeaCountry(getPort(id).country);
}

/** Intra-EEA 100%, EEA–outside 50%, fully outside 0%. */
export function etsShare(fromId: string, toId: string): number {
  const a = inEeaPort(fromId);
  const b = inEeaPort(toId);
  if (a && b) return 1;
  if (a || b) return 0.5;
  return 0;
}

export type EtsLabel = "ets.intra" | "ets.extra" | "ets.outside";

export function etsLabelKey(fromId: string, toId: string): EtsLabel {
  const s = etsShare(fromId, toId);
  if (s >= 1) return "ets.intra";
  if (s > 0) return "ets.extra";
  return "ets.outside";
}

export function lngPorts(): Port[] {
  return PORTS.filter((p) => p.lng);
}

export const CUSTOMS_HUBS = new Set([
  "zeebrugge",
  "flushing",
  "lehavre",
  "barcelona",
  "tangier",
  "piraeus",
  "southampton",
  "livorno",
  "bremerhaven",
  "portsaid",
  "baltimore",
  "longbeach",
  "santos",
  "singapore",
  "yokohama",
  "jebelali",
]);
