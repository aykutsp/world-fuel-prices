# Promotion playbook

A single place to collect *where* and *how* to announce new releases of this project, plus ready-to-copy post templates. None of this gets auto-posted — you run the copy-paste yourself from the relevant account.

> Replace `<LIVE_URL>`, `<REPO_URL>`, `<VERSION>` and `<HIGHLIGHT>` placeholders before posting. Vary the tone between channels so you don't look like a bot.

## Default placeholders

- `<LIVE_URL>` → https://aykutsp.github.io/world-fuel-prices/
- `<REPO_URL>` → https://github.com/aykutsp/world-fuel-prices
- `<HIGHLIGHT>` → the 1-line "what's new" for this release
- `<IMAGE>` → path to the screenshot you want to attach (e.g. `docs/screenshots/trip-istanbul-berlin.png`)

## Channels, ranked by effort / reward

| Channel | Effort | Typical reach | Notes |
|---|---|---|---|
| Hacker News (Show HN) | ⭐ Low | 🚀 Huge if front-paged | Posting window: weekday morning US Pacific. Only one Show HN per project allowed. |
| Reddit r/opensource, r/SideProject | ⭐ Low | 🟢 Moderate | Personal / builder tone works best. |
| Reddit r/webdev, r/reactjs, r/typescript | ⭐ Low | 🟢 Moderate | Only if the post brings technical value, not just a plug. |
| Reddit r/dataisbeautiful | ⭐⭐ Medium | 🟢 Moderate | Must be a picture of the choropleth with a caption. No self-links in title. |
| Dev.to article | ⭐⭐ Medium | 🟡 Growing | Doubles as SEO. Walk through an interesting design decision. |
| Twitter / X thread | ⭐ Low | 🟡 Variable | Lead with a screenshot + 1-liner; thread the rest. Pin the thread. |
| LinkedIn post | ⭐ Low | 🟢 Moderate | Professional framing ("I shipped an open data project…"). |
| Indie Hackers | ⭐⭐ Medium | 🟡 Niche | Focus on the build story. |
| Product Hunt | ⭐⭐⭐ High | 🚀 Big if launch day goes well | Only launch once, prepare gallery + tagline carefully. |
| Reddit r/flutterdev / r/golang / r/dotnet / r/python | ⭐ Low | 🟢 Moderate | Only after you publish each language's client library. |
| Hacker News (Ask HN / Show HN #2) | — | — | Don't re-submit. Second posts are flagged as spam. |

---

## Post templates

### 1. Show HN

**Title** *(max 80 chars, avoid clickbait)*:

> Show HN: World Fuel Prices – daily-refreshed choropleth + trip cost calculator

**Body** *(keep it short — first paragraph is what shows on the front page)*:

```
Hi HN,

I built a world map that colours every country by current retail gasoline /
diesel / LPG prices, refreshed once a day from open government feeds: the EU
Weekly Oil Bulletin, the US EIA, France data.economie.gouv.fr, Italy MIMIT,
Spain Minetur, the UK CMA fuel transparency scheme, and the World Bank
Global Fuel Prices Database for the rest of the world. No scraping of
private sources, only public data with CC BY / ODbL / OGL licences.

The UI also has a "trip" mode: enter two points (or click a preset like
Istanbul → Berlin), hit Calculate, and it draws the OSRM route on the map
and gives you a per-refuel cost breakdown assuming a 50 L / 900 km tank
refilled at 2% reserve in whatever country you're currently in.

Everything ships as a static site on GitHub Pages with an open JSON/XML/TXT
API at /api/v1/. A daily GitHub Actions cron rebuilds the dataset.

Client libraries for npm, PyPI, Go modules, Flutter (pub.dev) and NuGet are
in the repo under /libraries/, all wrapping the same static endpoints.

Live: <LIVE_URL>
Repo: <REPO_URL>

Happy to hear what breaks / what's missing.
```

### 2. Reddit r/opensource / r/SideProject

**Title**:

> Built an open-data world fuel price map + trip cost calculator — daily refresh, client libs for 5 languages

**Body**:

```
Weekend-ish project that grew into something useful. It pulls retail fuel
prices from official government feeds in FR, IT, ES, UK, US plus the EU
Weekly Oil Bulletin and the World Bank as global fallback, then paints a
choropleth world map coloured by local price.

The "trip" mode is the fun part: pick two cities (or use your current
location), it routes them through OSRM, figures out which country each
segment of the route crosses, and gives you a cost breakdown simulating
refuels at 2% reserve — so the receipt matches what you'd actually pay at
the pump.

Everything's MIT + open data. Live site: <LIVE_URL>
Repo: <REPO_URL>
```

### 3. Reddit r/dataisbeautiful (image post)

- Attach a **screenshot of the choropleth** (the Explore view, dark theme, Europe visible).
- **Title** format: `[OC] Retail gasoline prices around the world, pulled from government feeds [OC]`
- First comment: link to repo + explanation of the 7 data sources.

### 4. Dev.to article

**Title**:

> I built an open world map of fuel prices with a trip-cost calculator — here's how the pipeline works

**Outline**:

1. The idea (2 paragraphs)
2. Why existing solutions don't work (API keys, stale data, regional)
3. Sourcing strategy: station-level feeds > EU Bulletin > World Bank
4. The refuel-based trip cost model (with code snippets)
5. Shipping as a static site + daily GitHub Actions refresh
6. Client libraries for 5 languages
7. What I'd do differently next time
8. Links: live demo, repo, per-library install lines

Tag: `#opensource #webdev #typescript #react #dataviz`

### 5. Twitter / X thread

```
1/ Shipped v<VERSION> of world-fuel-prices — daily-refreshed choropleth of
retail gasoline, diesel and LPG prices around the world, built entirely on
open government data. 🧵

Live: <LIVE_URL>

2/ The map is coloured per-country by current pump price in USD/L, with
labels that flip to "country name + price" as you zoom in. Data refreshes
every morning via a GitHub Actions cron that hits 7 upstream feeds.

3/ The fun part: Trip mode. Pick two cities or tap "current location", add
intermediate stops if you want, hit Calculate. It routes through OSRM and
gives you a real per-refuel receipt — start with a full tank, refuel at 2%
reserve, each top-up priced at wherever you happen to be.

4/ <IMAGE> — Istanbul → Berlin, 2189 km, 3 refuels, $178 total.

5/ Everything's MIT, static JSON/XML/TXT API under /api/v1/, and client
libraries for npm, PyPI, Go, Flutter and NuGet live under /libraries/ in
the repo:

<REPO_URL>
```

### 6. LinkedIn

```
Shipped v<VERSION> of a side project I've been working on — an open,
daily-refreshed world map of retail fuel prices aggregated from
official government data (EU Commission, US EIA, French, Italian, Spanish
and UK government portals, World Bank).

It also has a trip cost calculator that uses OSRM to route between two
points and produces a per-country refuel receipt — useful for planning
cross-border road trips where prices can double between countries.

Built with React + TypeScript, shipped as a static site on GitHub Pages,
data rebuilt daily via GitHub Actions. Client libraries for JS, Python,
Go, Flutter and C# ship in the same repo.

Live demo: <LIVE_URL>
Source: <REPO_URL>

#opensource #opendata #typescript #dataviz
```

### 7. Indie Hackers

- **Category**: Open source
- **Headline**: "Turning a weekend choropleth into a daily-refreshed open data API"
- **Body**: Focus on the *build story* — deciding on data sources, the refuel cost model, publishing 5 language libraries. Keep it conversational.

### 8. Product Hunt

Only do this when the product feels "launch-ready" (polished screenshots, tagline, gallery of 4+ images, a 30-second demo video). Don't waste your one shot.

- **Tagline**: "Daily-refreshed world fuel prices with a trip cost calculator"
- **Topics**: Developer tools, Open source, Data viz, Travel
- **First comment**: thank voters, link to repo, answer questions quickly for the first 6 hours

---

## Cross-posting checklist (per release)

- [ ] Cut the GitHub Release with detailed notes
- [ ] Post on Twitter / X (thread) and pin it
- [ ] Post on LinkedIn
- [ ] Submit to r/opensource and r/SideProject
- [ ] If a new client library shipped: post to the matching language subreddit (r/flutterdev, r/golang, r/dotnet, r/python, r/javascript)
- [ ] Write a Dev.to article if the release includes a non-trivial feature
- [ ] Consider Hacker News (Show HN) *only* for the initial launch or a truly major release — not for every point version
- [ ] Add the release to Indie Hackers milestones
- [ ] Update the live demo's social preview / OG image if you added new screenshots

## Things that measurably help discoverability

- **Good repo topics** — already set via `gh repo edit`. Top topics by search volume for this project: `fuel-prices`, `open-data`, `data-visualization`, `react`, `typescript`, `choropleth`, `trip-planner`, `leaflet`.
- **Pin the repo on your profile** (`https://github.com/aykutsp` → Customize your pins).
- **Add a social preview image** — Settings → General → Social preview → upload a 1280×640 PNG showing the choropleth with the title.
- **Write release notes every time.** Empty tag pages don't get engagement; rich notes get re-shared.
- **Reply to every issue within 48 hours.** Active projects attract stars even if the traffic is modest.
- **Cross-link from your other projects' READMEs** — the cheapest backlink you'll ever get.
- **Ask friends** — the first 5 stars come from people you know, not strangers.

## Things that don't work

- Star exchange servers / "star swap" Discord channels — against GitHub ToS, your repo gets shadowbanned.
- Mass-tagging unrelated people on Twitter.
- Posting the same text verbatim to 10 subreddits in 10 minutes — mods will flag it.
- Begging for stars in issues.
