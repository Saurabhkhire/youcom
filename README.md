# 👻 GHOSTCAST: The Haunted Atlas

**The idea, in three sentences.** You tell us about a spooky place, like "thick fog, howling wind, old stone castle on a hill in Scotland". We figure out where it really is, read its true history and ghost stories, and check the real weather there right now. Then we draw you a Haunted Atlas page, piece by piece, and show whether tonight's weather matches the legend.

## Setup (3 steps)

1. `npm install`
2. Copy `.env.example` to `.env` and add `YDC_API_KEY` plus **either** OpenAI (`OPENAI_API_KEY`, `OPENAI_MODEL`) **or** Parasail (`PARASAIL_API_KEY`, `PARASAIL_MODEL`). **Skip this to run in Demo Mode.**
3. `npm start`, then open <http://localhost:3000>

Click an example chip and the whole Atlas builds itself. With keys added, untick **Demo mode** and type any place.

## Choosing the AI model: OpenAI or Parasail

Both use the same OpenAI-style API, so switching is only a setting. Set `LLM_PROVIDER=openai` or `LLM_PROVIDER=parasail` in `.env`. If you leave it unset, whichever provider has keys is used (Parasail first). On start the server prints which one is active and checks that your key and model work.

## How it works

```
browser  ⇄  WebSocket  ⇄  server.js  →  You.com (search + research)
                                      →  OpenAI or Parasail (JSON / tool calling)
                                      →  Open-Meteo (weather + geocoding, no key)
```

Pipeline events, streamed in order: `received → clues → place (or choices) → weather → history → legends → haunt_match → nearby → layout → done`. The page renders each component the moment its event arrives, so you watch it build. A "UI Architect" call then picks the final order.

- **Demo Mode** (no keys, or the toggle on): replays `public/demo-data.json` through the *same* stream with small delays. Weather in demo mode is a recorded spooky night, labelled "sample" (set `DEMO_LIVE_WEATHER=1` to use the real sky). The example chips always replay the demo.
- **Safety**: web text is treated as data. The Architect can only pick from the 9 components in the library, and the server fills each with verified data, so a model can never inject HTML. Every history event and legend must cite a URL that came from a You.com result, otherwise it is dropped. The browser only uses `textContent`.
- **Multi-user**: everyone viewing the same place shares a Reports feed. A new report that mentions different weather triggers a Haunt Match re-check for all viewers.
- **Errors**: any failing step shows an in-theme message ("The spirits are quiet…") and the rest of the page still renders.

## About the demo data

`public/demo-data.json` covers Edinburgh Castle, the Flannan Isles Lighthouse and Eastern State Penitentiary, each with 8 timeline events, 2 legends, coordinates and source URLs. Items are tagged `fact` or `legend`. It was researched from Wikipedia, NPR, Mercat Tours, Historic Environment Scotland and others. The You.com connector was not available when it was built, so it was gathered by hand with web search. Where a source gave no weather link for a legend, the `conditions` list is empty rather than invented, and "best night to visit" tips are labelled as suggestions.

## Notes

- You.com endpoints used: `GET api.you.com/v1/agents/search` (falls back to `ydc-index.io/v1/search`) and `POST api.you.com/v1/research`. Check <https://docs.you.com> if a field differs for your plan.
- Leaflet and map tiles load from a CDN, so the map needs internet.
- Tests: `node test-ws.js` (demo pipeline, run the server with `DEMO_DELAY=0`) and `node test-live-mock.js` (live pipeline against mocked APIs).
# youcom
