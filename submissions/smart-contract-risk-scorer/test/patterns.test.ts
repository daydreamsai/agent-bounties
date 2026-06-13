import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeSourcePatterns, maliciousSourcePatterns } from '../src/patterns.js';

test('source analysis includes at least 50 malicious and risky patterns', () => {
  assert.ok(maliciousSourcePatterns.length >= 50);
});

test('source analysis flags honeypot-style controls', () => {
  const findings = analyzeSourcePatterns(`
    contract RiskyToken is Ownable {
      mapping(address => bool) public isBlacklisted;
      bool public tradingEnabled;
      uint256 public sellTax;
      function setSellFee(uint256 value) external onlyOwner { sellTax = value; }
      function mint(address to, uint256 amount) external onlyOwner { _mint(to, amount); }
      function _transfer(address from, address to, uint256 amount) internal {
        require(!isBlacklisted[from], "blacklisted");
      }
    }
  `);

  const ids = findings.map((finding) => finding.id);
  assert.ok(ids.includes('source_blacklist'));
  assert.ok(ids.includes('source_trading-toggle'));
  assert.ok(ids.includes('source_set-fee'));
  assert.ok(ids.includes('source_mint'));
});
