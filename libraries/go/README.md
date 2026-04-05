# world-fuel-prices (Go)

Standard-library-only Go client for the [world-fuel-prices](https://github.com/aykutsp/world-fuel-prices) open data API.

## Install

```bash
go get github.com/aykutsp/world-fuel-prices/libraries/go@latest
```

## Usage

```go
package main

import (
    "fmt"
    "log"

    fuelprices "github.com/aykutsp/world-fuel-prices/libraries/go"
)

func main() {
    client := fuelprices.New()

    de, err := client.GetCountry("DE")
    if err != nil {
        log.Fatal(err)
    }
    fmt.Printf("%s: $%.2f/L (source: %s)\n", de.Name, de.PricesUSD.Gasoline, de.Source)

    cheap, _ := client.Cheapest(fuelprices.FuelGasoline, 10)
    for _, r := range cheap {
        fmt.Printf("%-30s $%.2f\n", r.Name, r.PricesUSD.Gasoline)
    }

    avg, _ := client.GlobalAverage(fuelprices.FuelGasoline)
    fmt.Printf("World gasoline average: $%.2f/L\n", avg)

    trip, _ := client.GetTrip("istanbul-berlin")
    fmt.Printf("%s → %s: %.0f km, $%.2f across %d refuels\n",
        trip.From.Label, trip.To.Label, trip.TotalKm, trip.TotalCostUSD, len(trip.Refuels))
}
```

## License

MIT.
