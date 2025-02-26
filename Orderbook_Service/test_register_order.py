import requests
import json

url = 'http://0.0.0.0:8000/api/register_order'

orderBook = dict(
    baseAsset="WETH",
    quoteAsset="USDC",
    lastTradePrice=95362.08,
    priceChangeIndicator="up",
    asks=[
        {
            "price": 95520.40,
            "amount": 0.00186,
            "total": 177.66794
        },
        {
            "price": 95500.00,
            "amount": 0.00063,
            "total": 60.16500
        },
        {
            "price": 95468.86,
            "amount": 0.01534,
            "total": 1464.49231
        },
        {
            "price": 95452.25,
            "amount": 0.00078,
            "total": 74.45275
        },
        {
            "price": 95451.93,
            "amount": 0.01569,
            "total": 1497.64078
        },
        {
            "price": 95416.10,
            "amount": 0.00186,
            "total": 177.47395
        },
        {
            "price": 95362.25,
            "amount": 0.00078,
            "total": 74.38255
        },
        {
            "price": 95362.09,
            "amount": 0.96831,
            "total": 92340.06537
        },
        {
            "price": 95362.08,
            "amount": 0.58338,
            "total": 55632.33023
        }
    ],
    bids=[
        {
            "price": 95260.33,
            "amount": 0.00131,
            "total": 124.79103
        },
        {
            "price": 95260.32,
            "amount": 1.88091,
            "total": 179176.08849
        },
        {
            "price": 95260.31,
            "amount": 0.00095,
            "total": 90.49729
        },
        {
            "price": 95260.29,
            "amount": 0.00104,
            "total": 99.07070
        },
        {
            "price": 95260.27,
            "amount": 0.00002,
            "total": 1.90521
        },
        {
            "price": 95260.26,
            "amount": 0.00002,
            "total": 1.90521
        },
        {
            "price": 95251.44,
            "amount": 0.00002,
            "total": 1.90503
        },
        {
            "price": 95249.92,
            "amount": 0.00369,
            "total": 351.47220
        },
        {
            "price": 95244.73,
            "amount": 0.01538,
            "total": 1464.86395
        }
    ]
)

for ask in orderBook["asks"]:
    payloadString = json.dumps({
        "account": "0x1234567890123456789012345678901234567890",
        "price": ask["price"],
        "quantity": ask["amount"],
        "side": "ask",
        "baseAsset": orderBook["baseAsset"],
        "quoteAsset": orderBook["quoteAsset"]
    })

    payload = {"payload": payloadString}
    resp = requests.post(url=url, data=payload)

    print(resp.json())

for bid in orderBook["bids"]:
    payloadString = json.dumps({
        "account": "0x1234567890123456789012345678901234567890",
        "price": bid["price"],
        "quantity": bid["amount"],
        "side": "bid",
        "baseAsset": orderBook["baseAsset"],
        "quoteAsset": orderBook["quoteAsset"]
    })

    payload = {"payload": payloadString}
    resp = requests.post(url=url, data=payload)

    print(resp.json())
