// Package fuelprices is a tiny Go client for the world-fuel-prices open data
// API. It reads the daily-refreshed JSON artifacts published at
// https://aykutsp.github.io/world-fuel-prices/api/v1/ and exposes a few
// convenience helpers on top of them. Standard library only.
package fuelprices

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"
)

// DefaultBaseURL is where the daily-refreshed dataset lives.
const DefaultBaseURL = "https://aykutsp.github.io/world-fuel-prices/api/v1/"

// FuelType selects which column of the pricing data you care about.
type FuelType string

const (
	FuelGasoline FuelType = "gasoline"
	FuelDiesel   FuelType = "diesel"
	FuelLPG      FuelType = "lpg"
	FuelAverage  FuelType = "average"
)

// FuelPrices holds the four price columns the dataset publishes per country.
type FuelPrices struct {
	Gasoline float64 `json:"gasoline"`
	Diesel   float64 `json:"diesel"`
	LPG      float64 `json:"lpg"`
	Average  float64 `json:"average"`
}

// Get returns the price for a given fuel type.
func (p FuelPrices) Get(t FuelType) float64 {
	switch t {
	case FuelDiesel:
		return p.Diesel
	case FuelLPG:
		return p.LPG
	case FuelAverage:
		return p.Average
	default:
		return p.Gasoline
	}
}

// Region is one country in the dataset.
type Region struct {
	ID          string     `json:"id"`
	ISO3        string     `json:"iso3,omitempty"`
	Name        string     `json:"name"`
	Currency    string     `json:"currency"`
	Source      string     `json:"source,omitempty"`
	PricesUSD   FuelPrices `json:"pricesUSD"`
	PricesLocal FuelPrices `json:"pricesLocal"`
	Lat         float64    `json:"lat"`
	Lng         float64    `json:"lng"`
}

// Dataset is the full payload of /api/v1/prices.json.
type Dataset struct {
	LastUpdated      string   `json:"lastUpdated"`
	Sources          []string `json:"sources"`
	GlobalAverageUSD float64  `json:"globalAverageUSD"`
	Regions          []Region `json:"regions"`
}

// Trip matches /api/v1/trips/<slug>.json.
type Trip struct {
	Slug          string       `json:"slug"`
	LastUpdated   string       `json:"lastUpdated"`
	From          GeoPoint     `json:"from"`
	To            GeoPoint     `json:"to"`
	TotalKm       float64      `json:"totalKm"`
	DurationMin   float64      `json:"durationMinutes"`
	Polyline      [][]float64  `json:"polyline"`
	TotalLitres   float64      `json:"totalLitres"`
	TotalTanks    float64      `json:"totalTanks"`
	TotalCostUSD  float64      `json:"totalCostUSD"`
	Refuels       []TripRefuel `json:"refuels"`
}

// GeoPoint is a simple labelled coordinate.
type GeoPoint struct {
	Label string  `json:"label"`
	Lat   float64 `json:"lat"`
	Lng   float64 `json:"lng"`
}

// TripRefuel represents a single refuelling event along a trip.
type TripRefuel struct {
	CountryID         string  `json:"countryId"`
	CountryName       string  `json:"countryName"`
	AtKm              float64 `json:"atKm"`
	Litres            float64 `json:"litres"`
	PricePerLitreUSD  float64 `json:"pricePerLitreUSD"`
	CostUSD           float64 `json:"costUSD"`
	Source            string  `json:"source,omitempty"`
	IsInitial         bool    `json:"isInitial"`
}

// TripIndexEntry is one row in /api/v1/trips/index.json.
type TripIndexEntry struct {
	Slug         string  `json:"slug"`
	From         string  `json:"from"`
	To           string  `json:"to"`
	TotalKm      float64 `json:"totalKm"`
	TotalCostUSD float64 `json:"totalCostUSD"`
	RefuelStops  int     `json:"refuelStops"`
	URL          string  `json:"url"`
}

// TripIndex is the full payload of /api/v1/trips/index.json.
type TripIndex struct {
	LastUpdated string           `json:"lastUpdated"`
	Description string           `json:"description"`
	Trips       []TripIndexEntry `json:"trips"`
}

// Client is the single entry point of the library.
type Client struct {
	BaseURL string
	HTTP    *http.Client

	mu      sync.Mutex
	dataset *Dataset
}

// New creates a client pointed at the default public endpoint.
func New() *Client {
	return &Client{
		BaseURL: DefaultBaseURL,
		HTTP:    &http.Client{Timeout: 20 * time.Second},
	}
}

// GetPrices returns the full dataset. Subsequent calls return a cached copy.
func (c *Client) GetPrices(force bool) (*Dataset, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if !force && c.dataset != nil {
		return c.dataset, nil
	}
	var out Dataset
	if err := c.getJSON("prices.json", &out); err != nil {
		return nil, err
	}
	c.dataset = &out
	return c.dataset, nil
}

// GetCountry fetches one country by ISO 3166-1 alpha-2. Returns (nil, nil)
// when the country isn't tracked.
func (c *Client) GetCountry(iso2 string) (*Region, error) {
	data, err := c.GetPrices(false)
	if err != nil {
		return nil, err
	}
	iso2 = strings.ToUpper(iso2)
	for i := range data.Regions {
		if strings.ToUpper(data.Regions[i].ID) == iso2 {
			return &data.Regions[i], nil
		}
	}
	return nil, nil
}

// Cheapest returns the n cheapest countries for the given fuel type.
func (c *Client) Cheapest(fuel FuelType, n int) ([]Region, error) {
	return c.sortedTopN(fuel, n, true)
}

// MostExpensive returns the n most expensive countries for the given fuel type.
func (c *Client) MostExpensive(fuel FuelType, n int) ([]Region, error) {
	return c.sortedTopN(fuel, n, false)
}

func (c *Client) sortedTopN(fuel FuelType, n int, ascending bool) ([]Region, error) {
	data, err := c.GetPrices(false)
	if err != nil {
		return nil, err
	}
	rows := make([]Region, 0, len(data.Regions))
	for _, r := range data.Regions {
		if r.PricesUSD.Get(fuel) > 0 {
			rows = append(rows, r)
		}
	}
	sort.SliceStable(rows, func(i, j int) bool {
		a, b := rows[i].PricesUSD.Get(fuel), rows[j].PricesUSD.Get(fuel)
		if ascending {
			return a < b
		}
		return a > b
	})
	if n > len(rows) {
		n = len(rows)
	}
	return rows[:n], nil
}

// GlobalAverage computes the mean price for one fuel type across every
// tracked country that publishes that column.
func (c *Client) GlobalAverage(fuel FuelType) (float64, error) {
	data, err := c.GetPrices(false)
	if err != nil {
		return 0, err
	}
	var sum float64
	var count int
	for _, r := range data.Regions {
		v := r.PricesUSD.Get(fuel)
		if v > 0 {
			sum += v
			count++
		}
	}
	if count == 0 {
		return 0, nil
	}
	return sum / float64(count), nil
}

// ListTrips returns the pre-computed trip index.
func (c *Client) ListTrips() (*TripIndex, error) {
	var out TripIndex
	if err := c.getJSON("trips/index.json", &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// GetTrip fetches one pre-computed trip by slug (e.g. "istanbul-berlin").
func (c *Client) GetTrip(slug string) (*Trip, error) {
	var out Trip
	if err := c.getJSON("trips/"+slug+".json", &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) getJSON(path string, v any) error {
	url := strings.TrimRight(c.BaseURL, "/") + "/" + path
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", "world-fuel-prices-go/1.0")
	res, err := c.HTTP.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode >= 400 {
		return fmt.Errorf("HTTP %d from %s", res.StatusCode, url)
	}
	return json.NewDecoder(res.Body).Decode(v)
}
