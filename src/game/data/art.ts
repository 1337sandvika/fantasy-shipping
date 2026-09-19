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
    nightdeal: "/game/events/grey.jpg",
    snitch: "/game/events/customs.jpg",
    rumor: "/game/events/customs.jpg",
    probe: "/game/events/arrest.jpg",
    verdict: "/game/events/arrest.jpg",
    stash: "/game/events/lash.jpg",
    ribdrop: "/game/events/cutter.jpg",
    hhdeal: "/game/events/hh.jpg",
    arrest: "/game/events/arrest.jpg",
    pilot: "/game/events/pilot.jpg",
    union: "/game/events/union.jpg",
    cook: "/game/events/cook.jpg",
    lngbarge: "/game/events/fuel.jpg",
    brandaward: "/game/events/award.jpg",
    greengrant: "/game/events/grant.jpg",
    streak: "/game/events/award.jpg",
    ceumark: "/game/events/award.jpg",
  };
  const src = map[id];
  return src ? `${src}?v=3` : null;
}

export function hullArt(id: string): string {
  return `/game/hulls/${id}.jpg?v=4`;
}

/** Top-down RoRo used on the atlas and in the harbor helm view (bow to the right). */
export function shipTopArt(): string {
  return "/game/ship-top.png?v=3";
}
