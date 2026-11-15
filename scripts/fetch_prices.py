"""本物のBTC・ETH・SOLの過去30日の円建て価格（1日1点）をCoinGeckoから取り、prices.json に書く。
練習所の値動きはこれを写す。取れなかった日は、前の prices.json をそのまま残す。"""
import json, sys, time, urllib.request
from datetime import datetime, timezone

IDS = {"BTC": "bitcoin", "ETH": "ethereum", "SOL": "solana"}

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "kasou-shisan", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

def main():
    out = {"source": "CoinGecko", "currency": "jpy", "as_of": datetime.now(timezone.utc).strftime("%Y-%m-%d"), "coins": {}}
    for sym, cid in IDS.items():
        d = get(f"https://api.coingecko.com/api/v3/coins/{cid}/market_chart?vs_currency=jpy&days=30&interval=daily")
        px = [round(p[1]) for p in d.get("prices", []) if p and p[1]]
        if len(px) < 30:
            sys.exit(f"{sym}: only {len(px)} points, keeping the old file")
        out["coins"][sym] = px[-30:]
        time.sleep(3)
    with open("prices.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print("prices.json updated", out["as_of"])

if __name__ == "__main__":
    main()
