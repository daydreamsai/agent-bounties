from flask import Flask, jsonify
from fresh_markets_watch import FreshMarketsWatch

app = Flask(__name__)

# Configuration
API_URL = 'https://api.example.com'
MARKET_ADDRESSES = ['0x123...', '0x456...', '0x789...']

# Initialize the FreshMarketsWatch instance
fresh_markets_watch = FreshMarketsWatch(API_URL, MARKET_ADDRESSES)

@app.route('/market_data', methods=['GET'])
def get_market_data():
    market_data = []
    for address in MARKET_ADDRESSES:
        data = fresh_markets_watch.fetch_market_data(address)
        if data:
            market_data.append(data)
    return jsonify(market_data)

@app.route('/start_monitoring', methods=['POST'])
def start_monitoring():
    fresh_markets_watch.watch_markets()
    return jsonify({'status': 'Monitoring started'}), 200

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)