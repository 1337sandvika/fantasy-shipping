export function eventArt(id: string): string | null {
  const map: Record<string, string> = {
    customs: "/game/events/customs.jpg",
    patrol: "/game/events/cutter.jpg",
    coastguard: "/game/events/cutter.jpg",
    storm: "/game/events/storm.jpg",
    ice: "/game/events/ice.jpg",
    engine: "/game/events/engine.jpg",
    fuelcontam: "/game/events/fuel.jpg",
    lash: "/game/events/lash.jpg",
    hhshift: "/game/events/hh.jpg",
    fog: "/game/events/fog.jpg",
    radio: "/game/events/grey.jpg",
    hhdeal: "/game/events/hh.jpg",
    arrest: "/game/events/arrest.jpg",
    pilot: "/game/events/pilot.jpg",
    union: "/game/events/union.jpg",
    cook: "/game/events/cook.jpg",
  };
  const src = map[id];
  return src ? `${src}?v=3` : null;
}

export function hullArt(id: string): string {
  return `/game/hulls/${id}.jpg?v=4`;
}
