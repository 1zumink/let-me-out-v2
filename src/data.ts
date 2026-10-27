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

/** Действие актёра перед репликой: slip — сорвался, wave — машет и отстаёт, ledge — перебрался на выступ,
 * out — вылез из банки, beam-off — фонарь погас, answer — трубку сняли. */
export type SceneAct = 'slip' | 'wave' | 'ledge' | 'out' | 'beam-off' | 'answer';

export type SceneStep =
  | { who: string; text: string; small?: boolean; pale?: boolean; delayMs?: number; act?: SceneAct }
  | { choice: { label: string; effect?: string; act?: SceneAct; steps: SceneStep[] }[]; otherwise?: SceneStep[] };

/** Кто появляется в сцене. Человечки — экземпляры героя, голоса — точка у края, вещи — вырезки. */
export interface SceneActor {
  kind: 'stick' | 'creature' | 'cutout' | 'sign' | 'note' | 'voice';
  /** stick: поза; creature: snail | bird */
  pose?: string;
  creature?: string;
  src?: string;
  alt?: string;
  /** где: напротив героя или у его стороны; y — в процентах игровой области */
  side?: 'opposite' | 'same';
  y?: number;
  w?: number;
  anchor?: 'feet' | 'hands';
  /** voice: откуда звучит */
  from?: 'top' | 'bottom';
  enter?: 'climb-in' | 'appear';
  rope?: boolean;
  ledge?: boolean;
  tiny?: boolean;
  hidden?: boolean;
  ring?: boolean;
  beam?: boolean;
  path?: 'crawl' | 'dive';
}

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
  /** постановка: актёры по id; в шагах who — id актёра или hero */
  stage: { actors: Record<string, SceneActor> };
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
