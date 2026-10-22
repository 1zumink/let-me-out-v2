// Все тексты живут в data/*.json; здесь только типы и импорт.
import floorsJson from '../data/floors.json';
import scenesJson from '../data/scenes.json';
import quotesJson from '../data/quotes.json';
import creditsJson from '../data/credits.json';
import webringJson from '../data/webring.json';
import heroJson from '../data/hero.json';
import uiJson from '../data/ui.json';
import type { HeroSpec } from './hero/hero';

export type GameType = 'hold' | 'breathe' | 'remove' | 'flap' | 'ghost' | 'letgo';

export interface Lines {
  enter: string[];
  done: string[];
  [key: string]: string[];
}

export interface CollageItem {
  id: string;
  label: string;
  src: string;
  alt?: string;
  x: number;
  y: number;
  w: number;
  rot?: number;
}

export interface FloorData {
  id: number;
  module: string;
  game: GameType | null;
  final?: boolean;
  hint?: string;
  quote?: string | null;
  collage?: CollageItem[];
  lines: { lap1: Lines; lap2: Lines };
}

export interface Scene {
  id: string;
  text: string;
  laps: number[];
  pairOf?: string | null;
}

export interface Quote {
  id: string;
  text: string;
  author: string;
  source: string;
  translator?: string;
  page?: string;
  strike?: string;
}

export interface Credit {
  role: string;
  names: string[];
}

export interface Webring {
  prev: { title: string; url: string };
  next: { title: string; url: string };
}

export type Ui = typeof uiJson;

export const floors = floorsJson as FloorData[];
export const scenes = scenesJson as Scene[];
export const quotes = quotesJson as Quote[];
export const credits = creditsJson as Credit[];
export const webring = webringJson as Webring;
export const heroSpec = heroJson as HeroSpec;
export const ui: Ui = uiJson;
