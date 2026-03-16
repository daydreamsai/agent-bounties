import time
import requests

class FreshMarketsWatch:
    def __init__(self, api_url, market_addresses, delay=5, max_retries=3):
        self.api_url = api_url
        self.market_addresses = market_addresses
        self.delay = delay
        self.max_retries = max_retries
        self.retries = 0

    def fetch_market_data(self, market_address):
        try:
            response = requests.get(f'{self.api_url}/market/{market_address}')
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f'Error fetching data for {market_address}: {e}')
            return None

    def watch_markets(self):
        while self.retries < self.max_retries:
            for address in self.market_addresses:
                market_data = self.fetch_market_data(address)
                if market_data:
                    self.process_data(market_data)
            time.sleep(self.delay)
            self.retries += 1
            print(f'Attempt {self.retries}/{self.max_retries} complete. Retrying...')

    def process_data(self, market_data):
        # Implement specific logic for processing market data
        # For example, checking for anomalies or new price changes
        print(f'Processing data: {market_data}')

if __name__ == '__main__':
    api_url = 'https://api.example.com'
    market_addresses = ['0x123...', '0x456...', '0x789...']
    fresh_markets_watch = FreshMarketsWatch(api_url, market_addresses)
    fresh_markets_watch.watch_markets()