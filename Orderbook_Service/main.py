from orderbook import OrderBook
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.responses import JSONResponse
import json
import uvicorn

order_books = {}  # Dictionary to store multiple order books, keyed by symbol
app = FastAPI()
app.counter = 0

@app.post("/api/register_order")
def register_order(payload: str = Form(...)):
    try:
        payload_json = json.loads(payload)
        symbol = payload_json['symbol']

        if symbol not in order_books:
            order_books[symbol] = OrderBook()

        order_book = order_books[symbol]

        _order = {
            'type' : 'limit',
            'side' : payload_json['side'], 
            'quantity' : payload_json['quantity'],
            'price' : payload_json['price'],
            'trade_id' : app.counter
        }
        trades, order = order_book.process_order(_order, False, False)
        app.counter += 1

        # Convert order to a serializable format
        order_dict = {
            'type': order['type'],
            'side': order['side'],
            'quantity': float(order['quantity']),
            'price': float(order['price']),
            'trade_id': int(order['trade_id'])
        }

        return JSONResponse(content={
            "message": "Order registered successfully",
            "order": order_dict
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/orderbook")
def get_orderbook(payload: str = Form(...)):
    try:
        payload_json = json.loads(payload)
        symbol = payload_json['symbol']

        if symbol not in order_books:
            raise HTTPException(status_code=404, detail="Order book not found")

        order_book = order_books[symbol]

        return order_book.get_orderbook(payload_json['symbol'])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
