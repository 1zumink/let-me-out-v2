// «Отпусти» (этаж 8): читатель держит героя — герой висит под курсором или пальцем.
// Реплики идут по порядку; отпустить можно после «А теперь отпусти», кнопка «отпустить» дублирует.
// Первый круг — падение без крика и темнота; второй — герой садится на нижнюю кромку окна.
import { h } from '../dom';
import { bindHold } from '../input';
import { focus, motion } from '../a11y';
import { scope, type GameFactory } from './common';

const LONG_MS = 20000;

export const createLetgo: GameFactory = (ctx, onDone) => {
  const s = scope(ctx);
  const { hero, ui } = ctx;
  // поза у кромки стекла; запоминается на старте — место монтируется ещё до подъёма
  let home: [number, number] = [50, 50];
  let holding = false;
  let ready = false; // «А теперь отпусти» уже сказано
  let released = false;
  let holdTimer = 0;
  const hint = ctx.hint();

  const hands = s.own(h('div.grip.grip--hands', { role: 'button', tabindex: '0', 'aria-label': ui.letgoTarget, 'aria-pressed': 'false' }));
  const button = s.own(h('button.btn', { type: 'button' }, ui.letgo));

  // держит дальше — ещё две реплики по 20 секунд
  const armLong = () => {
    s.clear(holdTimer);
    holdTimer = s.after(LONG_MS, async () => {
      if (!holding || released) return;
      await ctx.say(ctx.lines('hold20'));
      holdTimer = s.after(LONG_MS, () => holding && !released && ctx.say(ctx.lines('hold40')));
    });
  };

  const follow = (e: PointerEvent) => {
    if (!holding || released) return;
    const r = ctx.el.getBoundingClientRect();
    // герой висит под указателем: его рука — в руке читателя
    hero.place(((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100, 'hands');
  };

  const fall = async () => {
    if (ctx.lap === 2) {
      // после второго круга падения нет: герой сидит на нижней кромке окна и смотрит на читателя
      hero.el.classList.remove('is-tracking');
      hero.set('sit');
      hero.place(50, 100);
      await ctx.wait(1200);
      return onDone();
    }
    // transform, а не translate: translate у героя занят якорем, и падение начиналось бы с рывка
    const anim = motion.reduced()
      ? hero.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' })
      : hero.el.animate(
          [
            { transform: 'translateY(0)', opacity: 1, offset: 0 },
            { transform: 'translateY(30vh)', opacity: 1, offset: 0.55 },
            { transform: 'translateY(90vh)', opacity: 0, offset: 1 },
          ],
          { duration: 1600, easing: 'cubic-bezier(.5,0,.9,.5)', fill: 'forwards' },
        );
    anim.finished.then(onDone, onDone);
  };

  const release = () => {
    if (released) return;
    released = true;
    hint.stop();
    s.clear(holdTimer);
    hands.remove();
    button.remove();
    hero.el.classList.remove('is-tracking');
    if (ctx.lap === 2) return void fall();
    // пальцы раскрываются — и падение; страховка, если последний кадр не наступит (пауза, сбой загрузки)
    let fell = false;
    const once = () => !fell && ((fell = true), fall());
    hero.set('letgo', once);
    s.after(1500, once);
  };

  return {
    start() {
      hint.poke();
      home = hero.position;
      hero.set('hang');
      hero.attach(hands);
      bindHold(
        hands,
        {
          onStart: () => {
            holding = true;
            hint.poke();
            hero.set('held');
            hands.setAttribute('aria-pressed', 'true');
            hands.classList.add('is-held');
            hero.el.classList.add('is-tracking');
            if (ready) armLong();
          },
          onEnd: () => {
            holding = false;
            hands.setAttribute('aria-pressed', 'false');
            hands.classList.remove('is-held');
            if (ready) return release();
            // отпустил раньше времени — герой снова висит на краю стекла
            hero.el.classList.remove('is-tracking');
            hero.set('hang');
            hero.place(home[0], home[1]);
          },
        },
        s.signal,
      );
      ctx.el.addEventListener('pointermove', follow, { signal: s.signal });
      hands.addEventListener('pointermove', follow, { signal: s.signal });
      button.addEventListener('click', release, { signal: s.signal });
      focus(hands);
      // реплики идут по порядку, держит читатель или нет
      ctx.say(ctx.lines('sequence')).then(() => {
        if (s.signal.aborted || released) return;
        ready = true;
        ctx.controls.append(button);
        if (holding) armLong();
        else focus(hands);
      });
    },
    stop() {
      hint.stop();
      hero.el.classList.remove('is-tracking');
      s.dispose();
    },
  };
};
