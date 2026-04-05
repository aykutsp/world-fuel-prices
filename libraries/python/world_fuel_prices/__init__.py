"""world-fuel-prices — daily-refreshed global fuel prices in pure Python.

Pulls from the static JSON endpoints published at
https://aykutsp.github.io/world-fuel-prices/api/v1/ — no auth, no rate limits.

Stdlib only; works on Python 3.9+.
"""

from __future__ import annotations

import json
import urllib.request
from dataclasses import dataclass
from typing import Iterable, List, Literal, Optional

__version__ = "1.0.0"
__all__ = [
    "WorldFuelPricesClient",
    "Region",
    "FuelPrices",
    "Trip",
    "TripRefuel",
    "FuelType",
]

DEFAULT_BASE = "https://aykutsp.github.io/world-fuel-prices/api/v1/"

FuelType = Literal["gasoline", "diesel", "lpg", "average"]


@dataclass
class FuelPrices:
    gasoline: float
    diesel: float
    lpg: float
    average: float


@dataclass
class Region:
    id: str
    name: str
    currency: str
    prices_usd: FuelPrices
    prices_local: FuelPrices
    lat: float
    lng: float
    iso3: Optional[str] = None
    source: Optional[str] = None

    @classmethod
    def from_dict(cls, d: dict) -> "Region":
        return cls(
            id=d["id"],
            name=d["name"],
            currency=d.get("currency", "USD"),
            prices_usd=FuelPrices(**d["pricesUSD"]),
            prices_local=FuelPrices(**d.get("pricesLocal", d["pricesUSD"])),
            lat=d.get("lat", 0.0),
            lng=d.get("lng", 0.0),
            iso3=d.get("iso3"),
            source=d.get("source"),
        )


@dataclass
class TripRefuel:
    country_id: str
    country_name: str
    at_km: float
    litres: float
    price_per_litre_usd: float
    cost_usd: float
    is_initial: bool
    source: Optional[str] = None

    @classmethod
    def from_dict(cls, d: dict) -> "TripRefuel":
        return cls(
            country_id=d["countryId"],
            country_name=d["countryName"],
            at_km=d["atKm"],
            litres=d["litres"],
            price_per_litre_usd=d["pricePerLitreUSD"],
            cost_usd=d["costUSD"],
            is_initial=d["isInitial"],
            source=d.get("source"),
        )


@dataclass
class Trip:
    slug: str
    from_label: str
    to_label: str
    total_km: float
    duration_minutes: float
    total_litres: float
    total_tanks: float
    total_cost_usd: float
    refuels: List[TripRefuel]

    @classmethod
    def from_dict(cls, d: dict) -> "Trip":
        return cls(
            slug=d["slug"],
            from_label=d["from"]["label"],
            to_label=d["to"]["label"],
            total_km=d["totalKm"],
            duration_minutes=d["durationMinutes"],
            total_litres=d["totalLitres"],
            total_tanks=d["totalTanks"],
            total_cost_usd=d["totalCostUSD"],
            refuels=[TripRefuel.from_dict(r) for r in d["refuels"]],
        )


class WorldFuelPricesClient:
    """Small HTTP client. All requests are stdlib urllib; no external deps."""

    def __init__(self, base_url: str = DEFAULT_BASE, timeout: float = 20.0):
        if not base_url.endswith("/"):
            base_url += "/"
        self.base_url = base_url
        self.timeout = timeout
        self._dataset: Optional[dict] = None

    # -- low level ----------------------------------------------------------

    def _get_json(self, path: str) -> dict:
        url = self.base_url + path.lstrip("/")
        req = urllib.request.Request(url, headers={"User-Agent": "world-fuel-prices-py/1.0"})
        with urllib.request.urlopen(req, timeout=self.timeout) as r:
            return json.load(r)

    # -- dataset ------------------------------------------------------------

    def get_prices(self, force: bool = False) -> dict:
        """Raw dataset (dict). Cached per instance."""
        if force or self._dataset is None:
            self._dataset = self._get_json("prices.json")
        return self._dataset

    def get_regions(self) -> List[Region]:
        return [Region.from_dict(r) for r in self.get_prices()["regions"]]

    def get_country(self, iso2: str) -> Optional[Region]:
        iso2 = iso2.upper()
        for r in self.get_prices()["regions"]:
            if r["id"].upper() == iso2:
                return Region.from_dict(r)
        return None

    def cheapest(self, fuel: FuelType = "gasoline", n: int = 10) -> List[Region]:
        regions = [r for r in self.get_regions() if getattr(r.prices_usd, fuel) > 0]
        return sorted(regions, key=lambda r: getattr(r.prices_usd, fuel))[:n]

    def most_expensive(self, fuel: FuelType = "gasoline", n: int = 10) -> List[Region]:
        regions = [r for r in self.get_regions() if getattr(r.prices_usd, fuel) > 0]
        return sorted(regions, key=lambda r: getattr(r.prices_usd, fuel), reverse=True)[:n]

    def global_average(self, fuel: FuelType = "gasoline") -> float:
        vals: Iterable[float] = (
            getattr(r.prices_usd, fuel) for r in self.get_regions() if getattr(r.prices_usd, fuel) > 0
        )
        vals = list(vals)
        return sum(vals) / len(vals) if vals else 0.0

    # -- trips --------------------------------------------------------------

    def list_trips(self) -> dict:
        return self._get_json("trips/index.json")

    def get_trip(self, slug: str) -> Trip:
        return Trip.from_dict(self._get_json(f"trips/{slug}.json"))
