# System overview

C4-model diagrams for world-fuel-prices.

## Level 1 — system context

```mermaid
flowchart LR
    User["👩‍💻 End user"]
    Dev["👨‍💻 API consumer<br/>(curl / jq / libraries)"]
    Bot["🤖 GitHub Actions cron"]

    System["<b>world-fuel-prices</b><br/>Static site + JSON API"]

    EC["EU Commission<br/>Weekly Oil Bulletin"]
    WB["World Bank<br/>Global Fuel Prices DB"]
    Etalab["data.economie.gouv.fr<br/>(France)"]
    MIMIT["MIMIT Osservaprezzi<br/>(Italy)"]
    Minetur["Minetur REST API<br/>(Spain)"]
    CMA["UK CMA<br/>retailer JSONs"]
    EIA["US EIA<br/>weekly retail"]
    NE["Natural Earth<br/>borders"]

    OSRM["OSRM public demo<br/>(routing)"]
    Nom["Nominatim<br/>(geocoding)"]

    User -->|HTTP| System
    Dev -->|HTTP / client libs| System
    Bot -->|cron| System

    System -->|daily| EC
    System -->|daily| WB
    System -->|daily| Etalab
    System -->|daily| MIMIT
    System -->|daily| Minetur
    System -->|daily| CMA
    System -->|daily| EIA
    System -->|weekly| NE

    User -.->|trip calc only| Nom
    User -.->|trip calc only| OSRM
```

## Level 2 — containers

```mermaid
flowchart TB
    subgraph Build["Build-time (GitHub Actions)"]
        Fetch["Per-source fetchers<br/>(Node.js + XLSX + fetch)"]
        Normalize["Normalizer<br/>ISO-keyed merge<br/>refuel pre-compute"]
        Validate["Schema validator<br/>prices.schema.json<br/>(fails build on drift)"]
        Write["Writer<br/>prices.json · prices.xml · prices.txt<br/>trips/*.json · health.json"]
    end

    subgraph Deploy["Deploy-time"]
        Pages["GitHub Pages<br/>api/v1/*"]
    end

    subgraph Runtime["Runtime (browser)"]
        SPA["React SPA<br/>Leaflet choropleth<br/>Trip calculator"]
        Libs["Client libraries<br/>npm · PyPI · Go · Flutter · NuGet"]
    end

    Upstream["7 open data sources"] -->|HTTPS| Fetch
    Fetch --> Normalize
    Normalize --> Validate
    Validate -->|pass| Write
    Validate -->|fail| Fail["❌ build fails, last-good stays live"]
    Write --> Pages
    Pages -->|HTTP| SPA
    Pages -->|HTTP| Libs
    SPA -.->|address| Nom["Nominatim"]
    SPA -.->|route| OSRM["OSRM"]
```

**Key invariants**:

- The pipeline is a pure function of the set of upstream URLs at time T.
- Schema validation is a gate. A broken build never reaches users.
- Nominatim and OSRM are only called from the browser, so the static site stays truly static.
