import type { Fuel, UpgradeId } from "../types";

export type Hull = {
  id: string;
  name: string;
  year: number;
  ceu: number;
  hhCap: number;
  burn: number;
  fuel: Fuel;
  ice: boolean;
  speed: number;
  opex: number;
  price: number;
  bunkerCap: number;
};

export const HULLS: Hull[] = [
  { id: "nordfjord", name: "Nordfjord", year: 1998, ceu: 1800, hhCap: 24, burn: 0.145, fuel: "mgo", ice: false, speed: 16.5, opex: 9200, price: 2_150_000, bunkerCap: 420 },
  { id: "skagerrak", name: "Skagerrak", year: 2004, ceu: 2200, hhCap: 60, burn: 0.125, fuel: "mgo", ice: false, speed: 17.5, opex: 9800, price: 2_850_000, bunkerCap: 480 },
  { id: "kattegat", name: "Kattegat", year: 2012, ceu: 2800, hhCap: 120, burn: 0.11, fuel: "mgo", ice: false, speed: 18.5, opex: 10500, price: 3_900_000, bunkerCap: 540 },
  { id: "atlas", name: "Fantasy Atlas", year: 2016, ceu: 2400, hhCap: 320, burn: 0.132, fuel: "mgo", ice: false, speed: 17.8, opex: 11200, price: 4_250_000, bunkerCap: 560 },
  { id: "aurora", name: "Fantasy Aurora", year: 2019, ceu: 3100, hhCap: 180, burn: 0.09, fuel: "lng", ice: false, speed: 19, opex: 9100, price: 5_600_000, bunkerCap: 600 },
  { id: "dawn", name: "Fantasy Dawn", year: 2021, ceu: 3600, hhCap: 90, burn: 0.082, fuel: "lng", ice: false, speed: 19.5, opex: 8800, price: 6_400_000, bunkerCap: 620 },
  { id: "polar", name: "Fantasy Polar", year: 2024, ceu: 4200, hhCap: 110, burn: 0.078, fuel: "lng", ice: true, speed: 20, opex: 9400, price: 8_200_000, bunkerCap: 680 },
  { id: "titan", name: "Fantasy Titan", year: 2018, ceu: 6500, hhCap: 260, burn: 0.088, fuel: "lng", ice: false, speed: 19.2, opex: 13200, price: 9_600_000, bunkerCap: 980 },
  { id: "horizon", name: "Fantasy Horizon", year: 2023, ceu: 8000, hhCap: 150, burn: 0.068, fuel: "lng", ice: false, speed: 20.8, opex: 12100, price: 12_800_000, bunkerCap: 1180 },
];

export type UpgradeDef = { id: UpgradeId; cost: number; hhBonus?: number };

export const UPGRADES: UpgradeDef[] = [
  { id: "scrubber", cost: 420000 },
  { id: "prop", cost: 280000 },
  { id: "ice", cost: 510000 },
  { id: "lashing", cost: 190000 },
  { id: "fuelopt", cost: 320000 },
  { id: "tankcoat", cost: 240000 },
  { id: "hhdeck", cost: 410000, hhBonus: 90 },
];

export function hullById(id: string): Hull | undefined {
  return HULLS.find((h) => h.id === id);
}
