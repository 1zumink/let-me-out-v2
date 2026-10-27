# UI-кит «Let me out»

Figma: https://www.figma.com/design/i4uRPBcycOr9ApTBXw6Wmp

Страницы:
- «UI-кит · Обложка»;
- «Основы»;
- «Компоненты»;
- «Экраны из компонентов»;
- снимки живого сайта (мобилка, десктоп);
- «Ассеты».

Источник правды — код. Если что-то разошлось, верен код (`src/styles/base.css`, `layers.css`, `games.css`).

## Айдентика
- **Словесный знак** «LET ME OUT»: Neucha, разрядка 0.06em, цвет `--line`.
- **Иконка** — `public/favicon.svg`: голова героя в профиль, взгляд вправо, наружу.
- **Мир:** силуэт и темнота, свет ведёт взгляд. Коллаж — ч/б вырезки из фото с белой «ножничной» обводкой.
- **Единственный цветной акцент** — ржавый `--rust`: шапка и шарф другого человечка.
- **Иллюстрации** сделаны в ChatGPT по промптам автора (`docs/image-prompts.md`).

## Цвет
| Токен (CSS) | Значение | Где |
|---|---|---|
| `--ink` | #0b0b0c | фон страницы, текст на светлом |
| `--ink-2` | #1a1a1c | низ градиента фона |
| `--wall` | #050505 | стены-силуэт, док |
| `--line` | #e8e4dc | основной текст, линия героя, облачко (≈ 16:1 на `--ink`) |
| `--muted` | #b9b4aa | подсказки, статус (≈ 9.5:1) |
| `--light` | #f2e6c9 | свет, нажатая кнопка, фокус, шкалы |
| `--rust` | #a5543a | единственный акцент |
| бумага | #d6d0c3, текст #1f1d1a, второстепенный #59554d | сайд-сцены (`.scene`) |
| стекло | #f4f1ea | 8-й этаж |

В Figma цвета заведены переменными: `Primitives/palette/*` и смысловые `Color/*` (`bg/page`, `text/primary`, `border/default`…) с кодовыми именами `var(--…)`.

## Шрифты
Все шрифты лежат в `src/assets/fonts`, внешних запросов нет.

| Шрифт | Роль |
|---|---|
| Neucha | голос героя и интерфейс: кнопки 20, облачко 21, текст 18, заголовок clamp(40px, 10vw, 84px) |
| Pangolin | надписи мелом на стенах: clamp(22px, 16px + 1.2vw, 26px), длинные 20–23; телефон SE — 19 / 17 |
| JetBrains Mono | служебное: статус этажа 14, подписи в титрах 14, имя говорящего 12 |
| Caveat | запасной рукописный (`--font-quote`) |
| Inter | только веб-ринг курса (общий шаблон): заголовок 20 Semi Bold, ссылки 16 |

## Размеры
- **Зона нажатия** не меньше 44×44, рука на теле героя — 56.
- **Отступ от края** — `--gutter`: не меньше 12 px, с учётом safe-area.
- **Док** — минимум 72 px. Игра кончается над доком (`--dock-space`), а на телефоне лёжа начинается под шапкой (`--hud-space`).
- **Герой** — clamp(120px, 26vmin, 220px), лёжа — от 84 px. Кадр ленты 256×256, ноги на y = 236.
- **Рисованная рамка** — `--sketch-radius`; в Figma упрощена до 18 px.

## Компоненты (Figma → код)
| Figma | Код | Состояния |
|---|---|---|
| Button | `.btn`, `.btn--small` | Surface Dark/Paper × Size × Default/Pressed (`aria-pressed`)/Focus (`:focus-visible`) |
| Speech bubble | `.bubble`, `src/ui/SpeechBubble.ts` | Default / Pale (призрак) / Small (эхо) × хвостик вниз/вверх |
| Wall quote | `.wall-quote`, `src/ui/WallQuote.ts` | Normal / Long; «*» — сноска с источником |
| Scene note | `.scene`, `.scene-note` | бумажка сцены |
| HUD | `.hud` | Desktop / Mobile (в две строки) |
| Dock | `.dock` | Hold / Breath / Choices |
| Meter, Breaths | `.meter`, `.breaths` | 0 / 50 / 100; 0–3 вдоха |
| Grip zone | `.grip` | Idle / Held (рука сверху) |
| Hero | `src/hero/hero.ts`, `data/hero.json` | позы героя и другого человечка |
| Collage cutout | `.cutout`, `.room-item__img` | ч/б, затемнение, белая обводка |
| Course webring | `footer.course-webring` | Desktop / Mobile |
