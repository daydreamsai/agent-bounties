import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeFunctionData, getAddress } from 'viem';
import { erc20RevokeTx, erc721TokenRevokeTx, maxUint256, operatorRevokeTx } from '../src/calldata.js';
import { isLikelyHighValue } from '../src/risk.js';

const token = getAddress('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
const spender = getAddress('0x000000000022D473030F116dDEE9F6B43aC78BA3');

test('ERC20 unlimited allowance revoke calldata is approve(spender, 0)', () => {
  const tx = erc20RevokeTx('ethereum', token, spender);
  assert.equal(tx.to, token);
  assert.equal(tx.value, '0');
  assert.equal(tx.method, 'approve(address,uint256)');
  assert.match(tx.data, /^0x095ea7b3/);
  assert.equal(isLikelyHighValue('USDC', maxUint256, 0n, 6), true);
});

test('ERC20 finite allowance revoke calldata still approves zero', () => {
  const tx = erc20RevokeTx('base', token, spender);
  const decoded = decodeFunctionData({
    abi: [{
      type: 'function',
      name: 'approve',
      inputs: [
        { name: 'spender', type: 'address' },
        { name: 'amount', type: 'uint256' }
      ],
      outputs: [{ name: '', type: 'bool' }],
      stateMutability: 'nonpayable'
    }],
    data: tx.data
  });
  assert.equal(decoded.functionName, 'approve');
  assert.equal(decoded.args[0], spender);
  assert.equal(decoded.args[1], 0n);
});

test('ERC721 token approval revoke calldata is approve(address(0), tokenId)', () => {
  const tx = erc721TokenRevokeTx('polygon', token, 12345n);
  const decoded = decodeFunctionData({
    abi: [{
      type: 'function',
      name: 'approve',
      inputs: [
        { name: 'to', type: 'address' },
        { name: 'tokenId', type: 'uint256' }
      ],
      outputs: [],
      stateMutability: 'nonpayable'
    }],
    data: tx.data
  });
  assert.equal(decoded.functionName, 'approve');
  assert.equal(decoded.args[0], '0x0000000000000000000000000000000000000000');
  assert.equal(decoded.args[1], 12345n);
});

test('ERC721/ERC1155 operator revoke calldata is setApprovalForAll(operator, false)', () => {
  const tx = operatorRevokeTx('arbitrum', token, spender);
  const decoded = decodeFunctionData({
    abi: [{
      type: 'function',
      name: 'setApprovalForAll',
      inputs: [
        { name: 'operator', type: 'address' },
        { name: 'approved', type: 'bool' }
      ],
      outputs: [],
      stateMutability: 'nonpayable'
    }],
    data: tx.data
  });
  assert.equal(decoded.functionName, 'setApprovalForAll');
  assert.equal(decoded.args[0], spender);
  assert.equal(decoded.args[1], false);
});
