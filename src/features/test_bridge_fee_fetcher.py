import unittest
from src.features.bridge_fee_fetcher import BridgeFeeFetcher

class TestBridgeFeeFetcher(unittest.TestCase):
    def setUp(self):
        self.fetcher = BridgeFeeFetcher(api_url='https://api.example.com/bridge/fee')

    def test_fetch_bridge_fee_success(self):
        fee, eta = self.fetcher.fetch_bridge_fee()
        self.assertIsNotNone(fee)
        self.assertIsNotNone(eta)

    def test_verify_fee_within_range(self):
        fee = 0.5
        self.assertTrue(self.fetcher.verify_fee(fee, (0.1, 1.0)))

    def test_verify_fee_out_of_range(self):
        fee = 1.5
        self.assertFalse(self.fetcher.verify_fee(fee, (0.1, 1.0)))

    def test_verify_eta_within_limit(self):
        eta = 120
        self.assertTrue(self.fetcher.verify_eta(eta, 180))

    def test_verify_eta_out_of_limit(self):
        eta = 200
        self.assertFalse(self.fetcher.verify_eta(eta, 180))

if __name__ == '__main__':
    unittest.main()