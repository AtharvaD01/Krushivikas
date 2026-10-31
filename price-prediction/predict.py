from pathlib import Path
import json
import joblib
import pandas as pd

BASE = Path(__file__).resolve().parent
data = pd.read_csv(BASE / "maharashtra_banana_prices.csv", parse_dates=["date"])
bundle = joblib.load(BASE / "banana_price_model.joblib")
model = bundle["model"]
features = bundle["features"]

data = data.dropna(subset=["date", "modal_price"]).sort_values("date")
prices = data["modal_price"].astype(float).tolist()
dates = data["date"]

if len(prices) < 4:
    raise SystemExit("At least four observed prices are required.")

latest = prices[-1]
recent = prices[-3:]
next_date = dates.iloc[-1] + pd.Timedelta(days=1)

row = {
    "lag_1": prices[-1],
    "lag_2": prices[-2],
    "lag_3": prices[-3],
    "rolling_mean_3": sum(recent) / 3,
    "day_of_week": next_date.dayofweek,
}
prediction = max(0.0, float(model.predict(pd.DataFrame([row], columns=features))[0]))

result = {
    "commodity": "Banana",
    "region": "Maharashtra",
    "last_observed_date": str(dates.iloc[-1].date()),
    "last_observed_modal_price": round(latest, 2),
    "forecast_date": str(next_date.date()),
    "experimental_forecast": round(prediction, 2),
    "source": "CEDA Agmarknet API",
    "observations": len(prices),
    "warning": "Experimental estimate based on only one month of historical observations. Not a reliable market guarantee.",
}
print(json.dumps(result, indent=2))
