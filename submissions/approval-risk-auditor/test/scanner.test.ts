import assert from 'node:assert/strict';
import test from 'node:test';
import { getAddress, keccak256, toBytes, type Log } from 'viem';
import { decodeApprovalLog, explorerLogToViemLog, latestEventByApproval } from '../src/scanner.js';

const owner = getAddress('0x0000000000000000000000000000000000000001');
const approved = getAddress('0x0000000000000000000000000000000000000002');
const token = getAddress('0x0000000000000000000000000000000000000003');
const tx = '0x1111111111111111111111111111111111111111111111111111111111111111' as const;
const approvalTopic = keccak256(toBytes('Approval(address,address,uint256)'));

function addressTopic(address: string): `0x${string}` {
  return `0x${getAddress(address).slice(2).toLowerCase().padStart(64, '0')}`;
}

function uintTopic(value: bigint): `0x${string}` {
  return `0x${value.toString(16).padStart(64, '0')}`;
}

function uintData(value: bigint): `0x${string}` {
  return `0x${value.toString(16).padStart(64, '0')}`;
}

test('ERC721 token Approval logs decode approved address and indexed tokenId', () => {
  const event = decodeApprovalLog('ethereum', {
    address: token,
    topics: [approvalTopic, addressTopic(owner), addressTopic(approved), uintTopic(12345n)],
    data: '0x',
    blockHash: null,
    blockNumber: 20n,
    logIndex: 0,
    transactionHash: tx,
    transactionIndex: 0,
    removed: false
  } satisfies Log, owner);

  assert.ok(event);
  assert.equal(event.owner, owner);
  assert.equal(event.spender, approved);
  assert.equal(event.token, token);
  assert.equal(event.tokenId, 12345n);
  assert.equal(event.value, undefined);
  assert.equal(event.transactionHash, tx);
});

test('Etherscan log rows preserve topics as array entries', () => {
  const log = explorerLogToViemLog({
    address: token,
    topics: [approvalTopic, addressTopic(owner), addressTopic(approved)],
    data: '0x' + '2a'.padStart(64, '0'),
    blockNumber: '42',
    logIndex: '0x7',
    transactionHash: tx
  });

  assert.equal(log.address, token);
  assert.deepEqual(log.topics, [approvalTopic, addressTopic(owner), addressTopic(approved)]);
  assert.equal(log.blockNumber, 42n);
  assert.equal(log.logIndex, 7);
  assert.equal(log.transactionHash, tx);
});

test('latest approval grouping uses logIndex for same-block explorer parity', () => {
  const older = decodeApprovalLog('ethereum', {
    address: token,
    topics: [approvalTopic, addressTopic(owner), addressTopic(approved)],
    data: uintData(0n),
    blockHash: null,
    blockNumber: 99n,
    logIndex: 3,
    transactionHash: tx,
    transactionIndex: 0,
    removed: false
  } satisfies Log, owner);

  const newer = decodeApprovalLog('ethereum', {
    address: token,
    topics: [approvalTopic, addressTopic(owner), addressTopic(approved)],
    data: uintData(100n),
    blockHash: null,
    blockNumber: 99n,
    logIndex: 4,
    transactionHash: tx,
    transactionIndex: 0,
    removed: false
  } satisfies Log, owner);

  assert.ok(older);
  assert.ok(newer);

  const grouped = latestEventByApproval([newer, older]);
  const [selected] = grouped.values();

  assert.equal(grouped.size, 1);
  assert.equal(selected.value, 100n);
  assert.equal(selected.logIndex, 4);
});
