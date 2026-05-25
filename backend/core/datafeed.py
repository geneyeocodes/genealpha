import yfinance as yf
import pandas as pd
from typing import Optional


def fetch_historical_data(
    symbol: str,
    start_date: str,
    end_date: str,
    interval: str = "1d",
) -> Optional[pd.DataFrame]:
    try:
        ticker = yf.Ticker(symbol)
        df = ticker.history(start=start_date, end=end_date, interval=interval)
        if df.empty:
            return None
        df.columns = [c.lower().replace(" ", "_") for c in df.columns]
        return df
    except Exception:
        return None


def fetch_latest_price(symbol: str) -> Optional[float]:
    try:
        ticker = yf.Ticker(symbol)
        data = ticker.history(period="1d", interval="1m")
        if data.empty:
            return None
        return float(data["Close"].iloc[-1])
    except Exception:
        return None


def fetch_intraday_data(symbol: str, period: str = "5d", interval: str = "15m") -> Optional[pd.DataFrame]:
    try:
        ticker = yf.Ticker(symbol)
        df = ticker.history(period=period, interval=interval)
        if df.empty:
            return None
        df.columns = [c.lower().replace(" ", "_") for c in df.columns]
        return df
    except Exception:
        return None
