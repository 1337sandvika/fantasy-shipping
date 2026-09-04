export const BRANDS = [
  "Nordia",
  "Fjordia",
  "Stellara",
  "Tokai",
  "Riverford",
  "Alpen Motor",
  "Hanseong",
  "Loire",
  "Viking Volt",
  "Pampas",
  "Sirocco Coach",
  "Nimbus",
  "TundraWorks",
  "Helios Kart",
  "Baltic Mule",
  "Orkney Auto",
  "Costa Luna",
  "Sahel Motors",
  "Kattegat Kit",
  "Polaris Van",
  "Mackerel Motors",
  "FjellGoat",
  "Lampyris",
  "Kelp Kart",
  "Fjord Fiesta",
  "Troll Auto",
  "Herring Haul",
  "Biscuit Van",
  "Glacier Golf",
  "North Sea Sofa",
];

export const MIX = [
  { id: "mixed", labelKey: "brandMix.mixed" },
  { id: "import", labelKey: "brandMix.import" },
  { id: "remarket", labelKey: "brandMix.remarket" },
];

export type OddLot = {
  brand: string;
  kind: "cars" | "vans" | "trucks" | "hh";
  note: string;
  ceu: [number, number];
  hh: [number, number];
};

/** Odd, funny one-off parcels. note is an i18n suffix under lot.note.* */
export const ODD: OddLot[] = [
  { brand: "Helios Kart", kind: "cars", note: "golf", ceu: [60, 140], hh: [0, 0] },
  { brand: "Nimbus", kind: "hh", note: "circus", ceu: [180, 320], hh: [28, 52] },
  { brand: "TundraWorks", kind: "hh", note: "wind", ceu: [240, 480], hh: [64, 110] },
  { brand: "Costa Luna", kind: "cars", note: "yellow", ceu: [80, 220], hh: [0, 0] },
  { brand: "Baltic Mule", kind: "vans", note: "goat", ceu: [90, 260], hh: [0, 4] },
  { brand: "Sirocco Coach", kind: "trucks", note: "band", ceu: [220, 640], hh: [8, 22] },
  { brand: "Orkney Auto", kind: "cars", note: "left", ceu: [70, 180], hh: [0, 0] },
  { brand: "Pampas", kind: "hh", note: "harvest", ceu: [200, 420], hh: [48, 96] },
  { brand: "Kattegat Kit", kind: "hh", note: "mayor", ceu: [140, 280], hh: [20, 40] },
  { brand: "Polaris Van", kind: "vans", note: "ikea", ceu: [160, 520], hh: [0, 6] },
  { brand: "Viking Volt", kind: "cars", note: "recall", ceu: [200, 900], hh: [0, 0] },
  { brand: "Sahel Motors", kind: "trucks", note: "sand", ceu: [280, 1100], hh: [10, 28] },
  { brand: "Glacier Golf", kind: "hh", note: "snowcat", ceu: [160, 360], hh: [24, 48] },
  { brand: "Herring Haul", kind: "vans", note: "chips", ceu: [80, 240], hh: [0, 2] },
  { brand: "Biscuit Van", kind: "vans", note: "ice", ceu: [70, 200], hh: [0, 0] },
  { brand: "North Sea Sofa", kind: "hh", note: "sofa", ceu: [120, 280], hh: [16, 40] },
  { brand: "Lampyris", kind: "cars", note: "film", ceu: [90, 260], hh: [0, 0] },
  { brand: "Fjord Fiesta", kind: "cars", note: "wedding", ceu: [40, 120], hh: [0, 0] },
  { brand: "Troll Auto", kind: "cars", note: "museum", ceu: [50, 160], hh: [0, 4] },
  { brand: "Kelp Kart", kind: "cars", note: "inflatable", ceu: [30, 90], hh: [0, 0] },
  { brand: "Mackerel Motors", kind: "cars", note: "embassy", ceu: [60, 180], hh: [0, 0] },
  { brand: "FjellGoat", kind: "vans", note: "hearse", ceu: [40, 110], hh: [0, 2] },
  { brand: "Nimbus", kind: "hh", note: "penguin", ceu: [200, 380], hh: [32, 70] },
  { brand: "Costa Luna", kind: "cars", note: "spare", ceu: [80, 200], hh: [0, 0] },
];

/** Extra flavour notes that can stick to an otherwise ordinary lot. */
export const LOT_FLAVOUR = ["wet", "sticker", "radio", "spare", "rice"];

export const SHIP_NAMES = [
  "Rustproof",
  "Clipboard",
  "Envelope",
  "Polar Bear",
  "Deck Four",
  "Maybe Declared",
  "Quiet Quay",
  "Late Invoice",
  "Ice Class-ish",
  "The Accountant",
  "Salty Receipt",
  "No Lions",
  "Peaked Cap",
  "Wet Paint",
  "Good Enough",
  "Second Coffee",
  "Harbour Dog",
  "Thin Story",
  "Thick Envelope",
  "Off Hire",
  "Ladle",
  "Flamingo",
  "Tape Measure",
  "Not a Forklift",
];

export const TC_DESKS = [
  "Clipboard Partners",
  "Quiet Quay Ltd",
  "Envelope Holdings",
  "Fjord Fiesta Hire",
  "The Desk",
  "Baltic Mule TC",
  "Peaked Cap Charters",
  "Second Coffee Tonnage",
  "Polar Bear Pool",
  "Wet Paint Shipping",
];
