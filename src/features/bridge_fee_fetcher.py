import requests

class BridgeFeeFetcher:
    def __init__(self, api_url):
        self.api_url = api_url

    def fetch_bridge_fee(self):
        try:
            response = requests.get(self.api_url)
            response.raise_for_status()
            data = response.json()
            return data['fee'], data['eta']
        except requests.exceptions.RequestException as e:
            print(f'Error fetching bridge fee: {e}')
            return None, None

    def verify_fee(self, fee, expected_fee_range):
        if fee and expected_fee_range[0] <= fee <= expected_fee_range[1]:
            return True
        return False

    def verify_eta(self, eta, max_eta):
        if eta <= max_eta:
            return True
        return False
