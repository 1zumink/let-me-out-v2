# Let me out

Интерактивная история в браузере: человечек поднимается по этажам ямы (0–8), финал — стекло и «отпусти», потом второй круг.

## Запуск

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # статичный dist/ (проверяет data/*.json, падает на цитате без source)
npm run preview    # посмотреть сборку
npm test           # vitest: стейт-машина, сид, сцены, хранилище, валидатор
```

Параметры URL:
- `?seed=123` — сид рандома (сайд-сцены, наклоны надписей, клочки), чтобы баги повторялись;
- `?floor=5` — начать с этажа 5;
- `?motion=reduce` — режим reduced motion без настройки ОС.

## Где что лежит

- `data/floors.json` — этажи, игры, реплики `lines.lap1/lap2` (`enter`, `done` и особые: `empty`, `throat`, `out`, `back`), подсказки, коллаж комнаты.
- `data/scenes.json` — сайд-сцены S1–S12: `laps`, `pairOf`, необязательное `creature` (`bird` / `snail`).
- `data/quotes.json` — цитаты: `id`, `text`, `author`, `source`, `translator`, `page`, необязательное `strike` (зачёркнутое слово). Этаж ссылается на цитату полем `quote`.
- `data/credits.json`, `data/webring.json`, `data/ui.json` — кредиты, веб-ринг, подписи интерфейса.
- Сейчас все тексты истории — `TODO:`, ждут `docs/text-v2.md`.

## Спрайты героя

1. Сырые ленты из ChatGPT кладутся в `raw/hero/<state>.png`.
2. `npm run sprites:normalize` убирает нарисованную «шахматку», режет ленту на кадры (по связным компонентам, поэтому кадры могут стоять неровно), выравнивает героя и собирает `public/assets/hero/<state>.png|webp` — кадры 256×256, ноги на y=236. У висящих состояний (`"align": "top"` в `data/hero.json`) по линии y=16 выровнены руки.
3. `npm run sprites:check` проверяет ширину `frames × 256` и пишет, каких файлов не хватает. Если ленты нет, герой рисуется SVG-заглушкой.

## Коллаж

`public/assets/collage/*.svg` — временные вырезки-заглушки. Настоящие фото — WebP с альфой, тот же путь в `floors.json → collage[].src`. Ч/б, затемнение и белую обводку добавляет CSS.
