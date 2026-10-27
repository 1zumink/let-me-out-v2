// Все тексты живут в data/*.json (источник — docs/text-v2.md); здесь только типы и импорт.
import floorsJson from '../data/floors.json';
import scenesJson from '../data/scenes.json';
import quotesJson from '../data/quotes.json';
import creditsJson from '../data/credits.json';
import webringJson from '../data/webring.json';
import heroJson from '../data/hero.json';
import uiJson from '../data/ui.json';
import passagesJson from '../data/passages.json';
import type { PassagePool } from './route';
import type { HeroSpec } from './hero/hero';

export type GameType = 'hold' | 'breathe' | 'remove' | 'flap' | 'ghost' | 'letgo';

/** Реплика: строка — говорит герой; объект — кто угодно. «…» отдельной строкой — пауза. */
export type Line = string | { who?: string | null; text: string; pale?: boolean; small?: boolean; flash?: boolean };

export interface CollageItem {
  id: string;
  label: string;
  src: string;
  alt?: string;
  x: number;
  y: number;
  w: number;
  rot?: number;
  /** стоит на столе комнаты: x — в процентах ширины стола */
  on?: 'table';
  /** лежит на полу (ковёр): сплющен по вертикали, как в перспективе */
  flat?: boolean;
  /** раскладка для узких экранов (до 560 px) */
  xs?: { x: number; y: number; w: number };
}

export interface Place {
  id: string;
  kind: 'floor' | 'passage';
  label: string;
  module: string;
  game: GameType | null;
  final?: boolean;
  quote?: string | null;
  upLabel?: string;
  collage?: CollageItem[];
  params?: Record<string, unknown>;
  lines: { lap1: Record<string, unknown>; lap2?: Record<string, unknown> };
}

export type SceneStep =
  | { who?: string | null; text: string; small?: boolean; sign?: boolean; delayMs?: number }
  | { choice: { label: string; effect?: string; steps: SceneStep[] }[]; otherwise?: SceneStep[] };

export interface Scene {
  id: string;
  title: string;
  where: string[];
  laps: number[];
  pairOf?: string | null;
  /** вторая часть пары может прийти на следующем круге */
  crossLap?: boolean;
  /** вторая часть пары приходит сразу на следующей остановке */
  soon?: boolean;
  /** только после этого места */
  after?: string;
  creature?: string;
  /** коллажная вырезка в карточке сцены */
  image?: { src: string; alt: string };
  steps: SceneStep[];
}

export interface Quote {
  id: string;
  text: string;
  author: string;
  by?: string;
  source: string;
  translator?: string;
  page?: string;
  strike?: string;
  note?: string;
}

export interface Credit {
  role: string;
  names: string[];
}

export interface WebringLink {
  title: string;
  about?: string;
  url: string;
}
export interface Webring {
  prev: WebringLink;
  next: WebringLink;
}

export type Ui = typeof uiJson;

/** Этажи и тихий уступ; случайные проходы между ними добавляет route.ts на каждый круг. */
export const places = floorsJson as unknown as Place[];
export const passagePool = passagesJson as PassagePool;
export const scenes = scenesJson as unknown as Scene[];
export const quotes = quotesJson as Quote[];
export const credits = creditsJson as Credit[];
export const webring = webringJson as Webring;
export const heroSpec = heroJson as HeroSpec;
export const ui: Ui = uiJson;
