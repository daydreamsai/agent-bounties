import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeBytecode } from '../src/scanner.js';

test('bytecode analysis ignores PUSH data when detecting dangerous opcodes', () => {
  const findings = analyzeBytecode('0x63fff4ff005600' as `0x${string}`);
  assert.deepEqual(findings, []);
});

test('bytecode analysis detects real SELFDESTRUCT and DELEGATECALL opcodes', () => {
  const findings = analyzeBytecode('0x5af4ff' as `0x${string}`);
  assert.ok(findings.some((finding) => finding.id === 'bytecode_delegatecall_opcode'));
  assert.ok(findings.some((finding) => finding.id === 'bytecode_selfdestruct_opcode'));
});
