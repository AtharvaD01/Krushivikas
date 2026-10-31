import json
import urllib.request
from pathlib import Path
import pandas as pd

BASE_URL = "https://agmarknet.ceda.ashoka.edu.in"
OUT = Path(__file__).resolve().parent
START_DATE = "2025-10-01"
END_DATE = "2026-10-20"

def fetch(start, end):
    payload = {
        "state_id": 27,
        "commodity_id": 19,
        "district_id": 0,
        "calculation_type": "d",
        "start_date": start,
        "end_date": end,
    }
    req = urllib.request.Request(
        f"{BASE_URL}/api/prices",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as response:
        result = json.loads(response.read().decode())
    if "data" not in result:
        raise RuntimeError(f"Unexpected API response: {result}")
    return result["data"]

# Request monthly windows to avoid relying on a single large response.
records = []
start = pd.Timestamp(START_DATE)
end = pd.Timestamp(END_DATE)

while start <= end:
    month_end = min(start + pd.offsets.MonthEnd(0), end)
    batch = fetch(start.strftime("%Y-%m-%d"), month_end.strftime("%Y-%m-%d"))
    records.extend(batch)
    print(f"{start.date()} to {month_end.date()}: {len(batch)} records")
    start = month_end + pd.Timedelta(days=1)

if not records:
    raise SystemExit("No historical records returned; no CSV was created.")

df = pd.DataFrame(records)
df = df.rename(columns={
    "t": "date",
    "cmdty": "commodity",
    "p_min": "min_price",
    "p_max": "max_price",
    "p_modal": "modal_price",
})
df["date"] = pd.to_datetime(df["date"], errors="coerce")
for col in ["min_price", "max_price", "modal_price"]:
    df[col] = pd.to_numeric(df[col], errors="coerce")

df = df.dropna(subset=["date", "modal_price"])
df = df.sort_values("date").drop_duplicates(subset=["date"], keep="last")
df.to_csv(OUT / "maharashtra_banana_prices.csv", index=False)

print("\nSaved:", OUT / "maharashtra_banana_prices.csv")
print("Valid daily records:", len(df))
print("Date range:", df["date"].min().date(), "to", df["date"].max().date())
print("Missing calendar dates are not automatically filled.")
print(df[["date", "min_price", "max_price", "modal_price"]].tail(10).to_string(index=False))
