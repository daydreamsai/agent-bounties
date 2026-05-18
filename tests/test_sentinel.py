import unittest
import sys
import os

class TestLiquidationSentinel(unittest.TestCase):
    def test_logic_import(self):
        # Basic check to see if the structure exists
        self.assertTrue(os.path.exists("examples/liquidation-sentinel/liquidation_sentinel.ts"))
        self.assertTrue(os.path.exists("examples/liquidation-sentinel/server.ts"))

if __name__ == "__main__":
    unittest.main()
