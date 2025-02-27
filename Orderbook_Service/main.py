from orderbook import OrderBook
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import json
import uvicorn
from decimal import Decimal
import time
order_books = {}  # Dictionary to store multiple order books, keyed by symbol
app = FastAPI()

# Add CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

@app.post("/api/register_order")
def register_order(payload: str = Form(...)):
    try:
        payload_json = json.loads(payload)
        symbol = "%s_%s" % (payload_json["baseAsset"], payload_json["quoteAsset"])

        if symbol not in order_books:
            order_books[symbol] = OrderBook()

        order_book = order_books[symbol]

        _order = {
            'type' : 'limit',
            'trade_id' : payload_json['account'],
            'account': payload_json['account'],
            'price' : Decimal(payload_json['price']),
            'quantity' : Decimal(payload_json['quantity']),
            'side' : payload_json['side'],
            'baseAsset' : payload_json['baseAsset'],
            'quoteAsset' : payload_json['quoteAsset']
        }

        process_result = order_book.process_order(_order, False, False)

        # Determine task id
        # Task 1: Order does not cross spread and is not best price
            # trades should be empty if we did not cross the spread
            # order should be None if it's not the best
        # Task 2: Order does not cross spread but is best price
            # trades should be empty if we did not cross the spread
            # order should equal what we passed in if it's the best
        # Task 3: Order crosses spread and partially fills best price
            # task id included in process order response
        # Task 4: Order crosses spread and completely fills best price (params: next best price order on opposite side)
            # task id included in process order response
            # next best included in process order response
        # Failure: Order crosses spread and fills more than best price (API call fails)

        # This is the Failure case
        if not process_result["success"]:
            return JSONResponse(content={
                "message": process_result["data"],
                "status_code": 0
            }, status_code=400)

        trades, order, task_id, next_best_order = process_result["data"]
        # Note: task_id only set for partial and complete order fills

        if not trades:
            assert task_id == 0

            # Did not cross the spread
            if order is None:
                # Order is not best price (TASK 1)
                task_id = 1
            else:
                # Order is best price (TASK 2)
                task_id = 2

        assert order is not None

        # Left as before, likely largely redundant
        converted_trades = []
        for trade in trades:
            # [trade_id, side, head_order.order_id, new_book_quantity]
            party1 = [
                trade['party1'][0],
                trade['party1'][1],
                int(trade['party1'][2]) if trade['party1'][2] is not None else None,
                float(trade['party1'][3]) if trade['party1'][3] is not None else None
            ]
            party2 = [
                trade['party2'][0],
                trade['party2'][1],
                int(trade['party2'][2]) if trade['party2'][2] is not None else None,
                float(trade['party2'][3]) if trade['party2'][3] is not None else None
            ]

            converted_trade = {
                'timestamp': int(trade['timestamp']),
                'price': float(trade['price']),
                'quantity': float(trade['quantity']),
                'time': int(trade['time']),
                'party1': party1,
                'party2': party2,
            }
            converted_trades.append(converted_trade)

        # Convert order to a serializable format
        # This should be the same info as _order
        order_dict = {
            'orderId': int(order['order_id']),
            'account': order['account'],
            'price': float(order['price']),
            'quantity': float(order['quantity']),
            'side': order['side'],
            'baseAsset': order['baseAsset'],
            'quoteAsset': order['quoteAsset'],
            'trade_id': order['trade_id'],
            'trades': converted_trades,
            'isValid': True, # What is this? Prev: True if order['order_id'] is not None else False
            'timestamp': order['timestamp']
        }

        return JSONResponse(content={
            "message": "Order registered successfully",
            "order": order_dict,
            "nextBest": next_best_order,
            "taskId": task_id,
            "status_code": 1
        }, status_code=200)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/cancel_order")
def cancel_order(payload: str = Form(...)):
    try:
        payload_json = json.loads(payload)
        order_id = payload_json['orderId']
        side = payload_json['side']
        symbol = "%s_%s" % (payload_json["baseAsset"], payload_json["quoteAsset"])

        order_book = order_books[symbol]
        order = order_book.bids.get_order(order_id) if order_id in order_book.bids.order_map else order_book.asks.get_order(order_id)
        order_book.cancel_order(side, order_id)

        # Convert order to a serializable format
        order_dict = {
            'orderId': int(order_id),
            'account': order['account'],
            'price': float(order['price']),
            'quantity': float(order['quantity']),
            'side': order['side'],
            'baseAsset': order['baseAsset'],
            'quoteAsset': order['quoteAsset'],
            # 'type': order['type'],
            'trade_id': order['trade_id'],
            'trades': [],
            'isValid': False,
            'timestamp': order['timestamp']
        }

        return JSONResponse(content={
            "message": "Order cancelled successfully",
            "order": order_dict,
            "status_code": 1
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/order")
def get_order(payload: str = Form(...)):
    try:
        payload_json = json.loads(payload)
        order_id = payload_json['orderId']
        symbol = "%s_%s" % (payload_json["baseAsset"], payload_json["quoteAsset"])

        order_book = order_books[symbol]
        order = order_book.bids.get_order(order_id) if order_id in order_book.bids.order_map else order_book.asks.get_order(order_id)

        if order is not None:
            order_dict = {
                'orderId': int(order['order_id']) if order['order_id'] is not None else None,
                'account': order['account'],
                'price': float(order['price']),
                'quantity': float(order['quantity']),
                'side': order['side'],
                'baseAsset': order['baseAsset'],
                'quoteAsset': order['quoteAsset'],
                'trade_id': order['trade_id'],
                'trades': [],
                'isValid': True if order['order_id'] is not None else False,
                'timestamp': order['timestamp']
            }

            return JSONResponse(content={
                "message": "Order retrieved successfully",
                "order": order_dict,
                "status_code": 1
            })
        else:
            return JSONResponse(content={
                "message": "Order not found",
                "order": None,
                "status_code": 0
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
        result = order_book.get_orderbook(payload_json['symbol'])
        
        return JSONResponse(content={
            "message": "Order book retrieved successfully",
            "orderbook": result,
            "status_code": 1
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/get_best_order")
def get_best_order(payload: str = Form(...)):
    try:
        payload_json = json.loads(payload)
        symbol = "%s_%s" % (payload_json["baseAsset"], payload_json["quoteAsset"])
        side = payload_json['side']

        if symbol not in order_books:
            raise HTTPException(status_code=404, detail="Order book not found")

        order_book = order_books[symbol]
        price = order_book.get_best_bid() if side == 'bid' else order_book.get_best_ask()
        if price is None:
            # no bid or ask order
            # fake content
            return JSONResponse(content={
                "message": "no bid or ask order",
                "order": {
                    'order_id': 1234567890,
                    'account': "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
                    'price': 0,
                    'quantity': 0,
                    'side': side,
                    'baseAsset': payload_json["baseAsset"],
                    'quoteAsset': payload_json["quoteAsset"],
                    'trade_id': None,
                    'trades': [],
                    'isValid': False,
                    'timestamp': int(time.time() * 1000)
                }
            })

        price_list = order_book.bids.price_map[price] if side == 'bid' else order_book.asks.price_map[price]
        current_order = price_list.head_order
        order_dict = {
            'order_id': int(current_order.order_id),
            'account': current_order.account,
            'price': float(current_order.price),
            'quantity': float(current_order.quantity),
            'side': current_order.side,
            'baseAsset': current_order.baseAsset,
            'quoteAsset': current_order.quoteAsset,
            'trade_id': current_order.trade_id,
            'trades': [],
            'isValid': True,
            'timestamp': current_order.timestamp
        }

        return JSONResponse(content={
            "message": "Best order retrieved successfully",
            "order": order_dict
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
