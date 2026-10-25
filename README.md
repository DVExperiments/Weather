# The Weather Bureau

The official weather of Pixel City: a live sky, forecasts, named storms, an almanac and records, all computed in the browser from the date. Part of the Pixel Universe; follows the Pixel Universe Shared Conventions.

Live at `https://dvexperiments.github.io/Weather/`. Test bench at `/Weather/test.html`.

## Files

Every file sits at the top level; there are no folders.

| File | What it does |
| --- | --- |
| `universe.js` | The climate layer and the forecaster. No DOM code; any site can load it. |
| `index.html` | The site. |
| `bureau.css` | Styles, built on Glacial's. |
| `sky.js` | The animated sky over Pixel City. Display only. |
| `bureau.js` | Every page, live updates and routing. |
| `test.html` | Self-checks and a climate report against target ranges. |

## Design

**A root of the universe.** The climate reads nothing but the time, and nothing it does ever touches a race. It begins at Glacial's epoch, 3 December 2025, so records go back to the first Daily Crawl.

**City time is UTC.** As on Glacial, the middle of the night is 00:00 UTC, so the sun is highest at 12:00. The site shows all times in city time.

**Seasons** follow the Southern Hemisphere: warmest in late summer (highs about 24°C), coldest in late winter (highs about 14°C), with day length from about 14.7 hours to 9.3. Rain is about 1,500 mm a year, wetter in winter.

**The Climate Reform.** From 00:00 UTC on 1 December 2026, when the universe adopts the Pixel Calendar, a full year of seasons passes every calendar month: summer peaks just after the Grand Prix on the 1st, winter around the 17th, and each season lasts about a real week. Before the Reform, summer peaked in late January and winter in late July; that history is unchanged. Weather systems, the day and night, the forecaster and the records all keep real time. Seasons begin on the first day of the twelfth, third, sixth and ninth pixel months, and the first frost is counted per Pixel Year. A `climate.reform` event marks the day.

**The Pixel Calendar.** The Bureau keeps the universe's calendars: the city's clock (`offsetAt`) and the Pixel Calendar (`climate.pixel`), which every site that counts ages or pixel dates reads from here. One Pixel Year passes every calendar month from 00:00 UTC on the 1st; December 2025 is Year 1, so 1 December 2026 opens Year 13; a Pixel Year has 360 pixel days in twelve months of 30. The life clock (`toLife`, `fromLife`) runs one 365.25-day year per calendar month from the adoption, and before it is the ordinary clock, so the census can measure lives on it without changing any history.

**Maths rule.** Seasons and daily cycles need a cosine, which the conventions don't allow in simulation code, so the climate uses Bhaskara's approximation (arithmetic only, accurate to 0.002). The test bench checks that the file uses only `Math.floor` and `Math.imul`.

**Weather systems** arrive one after another, each with an approach of up to two and a half days during which pressure falls and cloud builds:

| System | Effect |
| --- | --- |
| High pressure | Settled and sunny, cold clear nights, frost in winter |
| Warm northwesterly | Hot, dry and gusty |
| Cold front | Warm and windy, a band of rain, then cooler southwesterly showers |
| Low | Prolonged rain and strong winds; the deepest are named storms, in alphabetical order |
| Southerly change | Arrives suddenly; cold, gusty, showers, rarely snow |
| Moist northeasterly | Grey, muggy, drizzle and morning fog |

Summer favours highs and northwesterlies; winter favours lows, fronts and southerlies. There are about four or five named storms a year.

**The forecaster.** Isobar Fairweather issues a five-day forecast at 06:00 city time every day. Errors grow with each day ahead, and the forecaster leans slightly optimistic. Each day is scored against the forecast issued the morning before: a hit needs the right kind of day (fine, cloudy, wet or stormy) and a high within 2°C. Accuracy runs at about 70 to 75%.

**Events** use the shared format with source `weather`: storm watches (two days ahead), arrivals and clearances; sharp southerly changes and hot northwesterlies; records (hottest, coldest, wettest, windiest); heatwaves, cold snaps, dry spells and droughts; deluges, snow and the first frost; seasons beginning; and the forecaster's streaks, busts and weekly scorecard. Daily events are published at 23:59.

**Air quality** waits for the Ecosystem layer, which depends on the city.

## API

```html
<script src="https://dvexperiments.github.io/Weather/universe.js"></script>
```

| Function | Returns |
| --- | --- |
| `PixelUniverse.climate.sample(time)` | The weather at a moment: temperature, wind, gusts, direction, rain, cloud, humidity, pressure, condition, storm |
| `stateAt(time)` | The sample, today so far, season, normals, sunrise and sunset, systems in the outlook, and the latest forecast |
| `eventsBetween(from, to)` | Events in the shared format |
| `historyBetween(from, to)` | Daily summaries for every complete day |
| `forecastAt(time)`, `verify(day)`, `forecasterStats(time)` | The forecaster's work and record |
| `systemsBetween(from, to)` | Weather systems arriving in a range |
| `normals(time)` | Normal high, low and day length for the time of year |
| `pixel.time(t)` | The pixel date: `{ year, month, day, dayOfYear, yearStart, yearEnd }` |
| `pixel.date(t)`, `pixel.moment(year, dayOfYear)` | `'13-04-12'`, and the real moment a pixel day begins |
| `pixel.toLife(t)`, `pixel.fromLife(l)`, `pixel.add(t, span)`, `pixel.years(a, b)` | The life clock, on which ages are measured |
| `pixel.adopted`, `pixel.YEAR` | 1 December 2026, and the life clock's year (365.25 days) |

## Testing

Add `?at=` to watch any moment, for example `index.html?at=2026-07-14T13:00` for Storm Cache, or `?at=2026-01-20T23:30` for a stormy summer night. The test bench measures the climate by pixel month from the Reform onwards.

## Before connecting other sites

The Bureau can go live now, but its history becomes fixed once other sites start reading it (the city's power demand, the Senate's storm debates, crowds at Glacial). Set `VERSION` to `1.0.0` at that point.
