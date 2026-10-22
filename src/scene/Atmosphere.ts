// Слои позади мира: градиент, туман, зерно; и SVG-фильтры для кипения и призрака.
import { h } from '../dom';
import { BOIL_VARIANTS } from './boil';

const SVG_NS = 'http://www.w3.org/2000/svg';

export function Atmosphere() {
  return h(
    'div.atmo',
    { 'aria-hidden': 'true' },
    h('div.atmo__bg'),
    h('div.fog.fog--1'),
    h('div.fog.fog--2'),
    h('div.fog.fog--3'),
  );
}

export function Grain() {
  return h('div.grain', { 'aria-hidden': 'true' });
}

/** Невидимый <svg> с фильтрами: boil-0..2 (дрожание линии) и ghost (пунктир). */
export function FilterDefs() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'defs');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const boil = Array.from(
    { length: BOIL_VARIANTS },
    (_, i) => `
    <filter id="boil-${i}" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="${i * 7 + 3}" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="3.2" xChannelSelector="R" yChannelSelector="G"/>
    </filter>`,
  ).join('');
  svg.innerHTML = `<defs>${boil}
    <filter id="ghost" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.22" numOctaves="1" seed="11" result="n"/>
      <feComponentTransfer in="n" result="dots">
        <feFuncA type="discrete" tableValues="0 0 1 1 0 1"/>
      </feComponentTransfer>
      <feComposite in="SourceGraphic" in2="dots" operator="in"/>
    </filter>
    <filter id="edge" x="-2%" y="-2%" width="104%" height="104%">
      <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="3" seed="5" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="6" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
  </defs>`;
  return svg;
}
