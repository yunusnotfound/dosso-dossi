import type { Locale } from "@/lib/site";
export type StationId =
  "entrance" | "coffee" | "thermos" | "counter" | "window";
export type SceneAction = "menu" | "story" | "branches" | "checkout";
export type SceneApi = {
  goTo: (id: StationId) => void;
  pause: (paused: boolean) => void;
  dispose: () => void;
};
export const stations: {
  id: StationId;
  label: Record<Locale, string>;
  position: [number, number, number];
  look: [number, number, number];
  mobileLook?: [number, number, number];
}[] = [
  {
    id: "entrance",
    label: { tr: "Genel görünüm", en: "Welcome" },
    position: [0, 1.72, 6.2],
    look: [0, 2.35, 0],
  },
  {
    id: "coffee",
    label: { tr: "Kahve seçkisi", en: "Coffee collection" },
    position: [-3.7, 1.65, -1.6],
    look: [-6.1, 1.6, -2],
  },
  {
    id: "thermos",
    label: { tr: "Termos duvarı", en: "Thermos wall" },
    position: [3.7, 1.65, -0.9],
    look: [6.1, 1.65, -1.2],
  },
  {
    id: "counter",
    label: { tr: "Kahve barı", en: "Coffee bar" },
    position: [0, 1.8, -2.15],
    look: [0, 2.35, -6.7],
    mobileLook: [0, 2.35, -6.7],
  },
  {
    id: "window",
    label: { tr: "Dinlenme köşesi", en: "Lounge corner" },
    position: [2.8, 1.65, 4.4],
    look: [5.8, 1.25, 2.9],
  },
];
export type ScenePin = {
  id: string;
  position: [number, number, number];
  label: Record<Locale, string>;
  productId?: string;
  action?: SceneAction;
};
