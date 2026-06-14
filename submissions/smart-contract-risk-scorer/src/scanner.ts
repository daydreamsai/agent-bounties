import {
  createPublicClient,
  getAddress,
  http,
  isAddress,
  parseAbi,
  type PublicClient
} from 'viem';
import { getChainConfig } from './chains.js';
import { analyzeSourcePatterns } from './patterns.js';
import { buildScoreCalculationEvidence, dedupeFindings, recommendationsFor, scoreFindings } from './risk.js';
import type {
  ContractInfo,
  ExternalCheck,
  ScoreInput,
  ScoreOutput,
  SecurityChecks,
  SupportedChain,
  Vulnerability
} from './types.js';

type AnyClient = PublicClient<any, any, any>;

const erc20Abi = parseAbi([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function owner() view returns (address)',
  'function getOwner() view returns (address)'
]);

const zeroAddress = '0x0000000000000000000000000000000000000000';
const deadAddress = '0x000000000000000000000000000000000000dEaD';
const eip1967ImplementationSlot = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';

export async function scoreContractRisk(input: ScoreInput): Promise<ScoreOutput> {
  const address = getAddress(input.contract_address);
  const chain = input.chain;
  const scanDepth = input.scan_depth || 'quick';
  const config = getChainConfig(chain);
  const client = createPublicClient({
    chain: config.viemChain,
    transport: http(config.rpcUrl, { timeout: 12_000 })
  }) as AnyClient;

  const externalChecks: ExternalCheck[] = [];
  const vulnerabilities: Vulnerability[] = [];
  const dataSources = new Set<string>();

  const [codeResult, tokenMeta, ownerAddress, implementationAddress] = await Promise.all([
    readCode(client, address, config.rpcFallbackUrls),
    readTokenMeta(client, address),
    readOwner(client, address),
    readImplementation(client, address)
  ]);
  const code = codeResult.code;
  externalChecks.push(codeResult.check);
  if (codeResult.check.status === 'ok') dataSources.add('rpc');

  const isContract = Boolean(code && code !== '0x');
  if (code === '0x') {
    vulnerabilities.push({
      id: 'rpc_not_contract',
      title: 'Address has no contract bytecode',
      severity: 'critical',
      evidence: 'eth_getCode returned empty bytecode',
      source: 'rpc'
    });
  }

  const bytecodeFindings = analyzeBytecode(code);
  vulnerabilities.push(...bytecodeFindings);

  const etherscan = await fetchEtherscanMetadata(chain, address, scanDepth);
  externalChecks.push(etherscan.check);
  if (etherscan.sourceCode) {
    dataSources.add('etherscan-v2');
    vulnerabilities.push(...analyzeSourcePatterns(etherscan.sourceCode));
  } else if (isContract) {
    vulnerabilities.push({
      id: 'source_unverified_or_unavailable',
      title: 'Verified source code unavailable',
      severity: etherscan.check.status === 'ok' ? 'high' : 'medium',
      evidence: etherscan.check.status === 'ok' ? 'Etherscan returned no SourceCode' : 'Etherscan source check unavailable',
      source: 'etherscan'
    });
  }

  const goPlus = await fetchGoPlus(config.chainId, address);
  externalChecks.push(goPlus.check);
  if (goPlus.check.status === 'ok') {
    dataSources.add('goplus');
    vulnerabilities.push(...goPlus.findings);
  }

  const tokenSniffer = await fetchTokenSniffer(chain, address);
  externalChecks.push(tokenSniffer.check);
  if (tokenSniffer.check.status === 'ok') {
    dataSources.add('tokensniffer');
    vulnerabilities.push(...tokenSniffer.findings);
  }

  const sourcePatterns = vulnerabilities.filter((item) => item.source === 'source').map((item) => item.id);
  const securityChecks: SecurityChecks = {
    is_contract: isContract,
    verified_source: Boolean(etherscan.sourceCode),
    proxy_detected: Boolean(implementationAddress || goPlus.flags.proxy),
    honeypot_detected: goPlus.flags.honeypot,
    owner_address: ownerAddress || goPlus.flags.ownerAddress,
    ownership_renounced: isRenounced(ownerAddress || goPlus.flags.ownerAddress),
    hidden_owner_detected: goPlus.flags.hiddenOwner,
    high_tax_detected: goPlus.flags.highTax,
    blacklist_detected: goPlus.flags.blacklist,
    mint_risk_detected: goPlus.flags.mintable,
    source_patterns: sourcePatterns,
    bytecode_patterns: bytecodeFindings.map((item) => item.id)
  };

  if (securityChecks.proxy_detected) {
    vulnerabilities.push({
      id: 'proxy_detected',
      title: 'Upgradeable proxy detected',
      severity: 'medium',
      evidence: implementationAddress ? `EIP-1967 implementation ${implementationAddress}` : 'GoPlus reports proxy=true',
      source: implementationAddress ? 'rpc' : 'goplus'
    });
  }

  if (ownerAddress && !securityChecks.ownership_renounced) {
    vulnerabilities.push({
      id: 'owner_not_renounced',
      title: 'Owner privileges are still active',
      severity: 'medium',
      evidence: `owner=${ownerAddress}`,
      source: 'rpc'
    });
  }

  const findings = dedupeFindings(vulnerabilities);
  const confidence = computeConfidence({ isContract, externalChecks, hasSource: Boolean(etherscan.sourceCode), scanDepth });
  const score = scoreFindings(findings, confidence);
  const recommendations = recommendationsFor(findings);

  return {
    ...score,
    vulnerabilities: findings,
    security_checks: securityChecks,
    external_checks: externalChecks,
    contract_info: {
      chain,
      chain_id: config.chainId,
      address,
      name: tokenMeta.name,
      symbol: tokenMeta.symbol,
      contract_name: etherscan.contractName,
      creator: etherscan.creator,
      created_tx_hash: etherscan.createdTxHash,
      compiler_version: etherscan.compilerVersion,
      code_size_bytes: code ? (code.length - 2) / 2 : 0,
      implementation_address: implementationAddress
    },
    recommendations,
    calculation_evidence: buildScoreCalculationEvidence(findings, confidence, recommendations),
    confidence,
    generated_at: new Date().toISOString(),
    scan_depth: scanDepth,
    data_sources: [...dataSources].sort()
  };
}

export function analyzeBytecode(code: `0x${string}` | undefined): Vulnerability[] {
  if (!code || code === '0x') return [];
  const findings: Vulnerability[] = [];
  const opcodes = bytecodeOpcodes(code);
  if (opcodes.has(0xff)) {
    findings.push({
      id: 'bytecode_selfdestruct_opcode',
      title: 'Bytecode contains SELFDESTRUCT opcode',
      severity: 'critical',
      evidence: 'Runtime bytecode contains opcode 0xff',
      source: 'bytecode'
    });
  }
  if (opcodes.has(0xf4)) {
    findings.push({
      id: 'bytecode_delegatecall_opcode',
      title: 'Bytecode contains DELEGATECALL opcode',
      severity: 'medium',
      evidence: 'Runtime bytecode contains opcode 0xf4',
      source: 'bytecode'
    });
  }
  return findings;
}

function bytecodeOpcodes(code: `0x${string}`): Set<number> {
  const hex = code.slice(2);
  const opcodes = new Set<number>();
  for (let i = 0; i < hex.length; i += 2) {
    const opcode = Number.parseInt(hex.slice(i, i + 2), 16);
    if (!Number.isFinite(opcode)) continue;
    opcodes.add(opcode);
    if (opcode >= 0x60 && opcode <= 0x7f) {
      i += (opcode - 0x5f) * 2;
    }
  }
  return opcodes;
}

async function readCode(client: AnyClient, address: `0x${string}`, fallbackUrls: string[]): Promise<{ code?: `0x${string}`; check: ExternalCheck }> {
  const errors: string[] = [];
  try {
    const code = await client.getCode({ address });
    return {
      code,
      check: {
        provider: 'rpc',
        status: 'ok',
        evidence: { method: 'eth_getCode', code_size_bytes: code ? (code.length - 2) / 2 : 0 }
      }
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  for (const url of fallbackUrls) {
    try {
      const code = await fetchRpcCode(url, address);
      return {
        code,
        check: {
          provider: 'rpc',
          status: 'ok',
          evidence: { method: 'eth_getCode', rpc_url: url, code_size_bytes: code ? (code.length - 2) / 2 : 0 }
        }
      };
    } catch (error) {
      errors.push(`${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    check: {
      provider: 'rpc',
      status: 'error',
      error: errors.slice(0, 4).join(' | ')
    }
  };
}

async function fetchRpcCode(url: string, address: `0x${string}`): Promise<`0x${string}`> {
  const json = await fetchJson<{ result?: string; error?: { message?: string } }>(url, {}, {
    jsonrpc: '2.0',
    method: 'eth_getCode',
    params: [address, 'latest'],
    id: 1
  });
  if (json.error) throw new Error(json.error.message || 'JSON-RPC error');
  if (typeof json.result !== 'string' || !json.result.startsWith('0x')) throw new Error('Invalid eth_getCode result');
  return json.result as `0x${string}`;
}

async function readTokenMeta(client: AnyClient, address: `0x${string}`): Promise<{ name?: string; symbol?: string }> {
  const [name, symbol] = await Promise.all([
    safeRead<string>(client, { address, abi: erc20Abi, functionName: 'name' }),
    safeRead<string>(client, { address, abi: erc20Abi, functionName: 'symbol' })
  ]);
  return { name, symbol };
}

async function readOwner(client: AnyClient, address: `0x${string}`): Promise<string | undefined> {
  const owner = await safeRead<`0x${string}`>(client, { address, abi: erc20Abi, functionName: 'owner' });
  if (owner) return getAddress(owner);
  const getOwner = await safeRead<`0x${string}`>(client, { address, abi: erc20Abi, functionName: 'getOwner' });
  return getOwner ? getAddress(getOwner) : undefined;
}

async function readImplementation(client: AnyClient, address: `0x${string}`): Promise<string | undefined> {
  try {
    const storage = await client.getStorageAt({ address, slot: eip1967ImplementationSlot });
    if (!storage || storage === '0x') return undefined;
    const hex = storage.replace(/^0x/, '').padStart(64, '0').slice(-40);
    const implementation = getAddress(`0x${hex}`);
    return implementation === zeroAddress ? undefined : implementation;
  } catch {
    return undefined;
  }
}

async function safeRead<T>(client: AnyClient, request: Parameters<AnyClient['readContract']>[0]): Promise<T | undefined> {
  try {
    return await client.readContract(request) as T;
  } catch {
    return undefined;
  }
}

async function fetchEtherscanMetadata(chain: SupportedChain, address: `0x${string}`, scanDepth: 'quick' | 'deep') {
  const config = getChainConfig(chain);
  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey) {
    return {
      check: { provider: 'etherscan', status: 'unavailable', error: 'ETHERSCAN_API_KEY not configured' } satisfies ExternalCheck
    };
  }

  try {
    const sourceUrl = `${config.explorerApiUrl}?chainid=${config.chainId}&module=contract&action=getsourcecode&address=${address}&apikey=${apiKey}`;
    const sourceJson = await fetchJson<{ result?: Array<Record<string, string>> }>(sourceUrl);
    const sourceRow = Array.isArray(sourceJson.result) ? sourceJson.result[0] : undefined;
    const sourceCode = sourceRow?.SourceCode && sourceRow.SourceCode !== 'Contract source code not verified' ? sourceRow.SourceCode : undefined;

    let creator: string | undefined;
    let createdTxHash: string | undefined;
    if (scanDepth === 'deep') {
      const creationUrl = `${config.explorerApiUrl}?chainid=${config.chainId}&module=contract&action=getcontractcreation&contractaddresses=${address}&apikey=${apiKey}`;
      const creationJson = await fetchJson<{ result?: Array<Record<string, string>> }>(creationUrl);
      const creation = Array.isArray(creationJson.result) ? creationJson.result[0] : undefined;
      creator = creation?.contractCreator ? getAddressSafe(creation.contractCreator) : undefined;
      createdTxHash = creation?.txHash;
    }

    return {
      check: {
        provider: 'etherscan',
        status: 'ok',
        evidence: {
          verified_source: Boolean(sourceCode),
          contract_name: sourceRow?.ContractName,
          compiler_version: sourceRow?.CompilerVersion,
          proxy: sourceRow?.Proxy
        }
      } satisfies ExternalCheck,
      sourceCode,
      contractName: sourceRow?.ContractName || undefined,
      compilerVersion: sourceRow?.CompilerVersion || undefined,
      creator,
      createdTxHash
    };
  } catch (error) {
    return {
      check: {
        provider: 'etherscan',
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      } satisfies ExternalCheck
    };
  }
}

async function fetchGoPlus(chainId: number, address: `0x${string}`): Promise<{
  check: ExternalCheck;
  findings: Vulnerability[];
  flags: {
    proxy?: boolean;
    honeypot?: boolean;
    hiddenOwner?: boolean;
    highTax?: boolean;
    blacklist?: boolean;
    mintable?: boolean;
    ownerAddress?: string;
  };
}> {
  try {
    const url = `https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${address}`;
    const json = await fetchJson<{ result?: Record<string, Record<string, string>> }>(url);
    const row = json.result?.[address.toLowerCase()] || json.result?.[address];
    if (!row) {
      return {
        check: { provider: 'goplus', status: 'unavailable', error: 'GoPlus returned no row for contract' },
        findings: [],
        flags: {}
      };
    }

    const findings: Vulnerability[] = [];
    const pushFlag = (id: string, title: string, severity: Vulnerability['severity'], key: string) => {
      if (isTrue(row[key])) findings.push({ id: `goplus_${id}`, title, severity, evidence: `${key}=${row[key]}`, source: 'goplus' });
    };

    pushFlag('honeypot', 'GoPlus reports honeypot risk', 'critical', 'is_honeypot');
    pushFlag('cannot_sell_all', 'GoPlus reports sell restriction', 'critical', 'cannot_sell_all');
    pushFlag('hidden_owner', 'Hidden owner detected', 'high', 'hidden_owner');
    pushFlag('blacklist', 'Blacklist function detected', 'high', 'is_blacklisted');
    pushFlag('whitelist', 'Whitelist function detected', 'medium', 'is_whitelisted');
    pushFlag('mintable', 'Mint risk detected', 'high', 'is_mintable');
    pushFlag('proxy', 'Proxy contract reported by GoPlus', 'medium', 'is_proxy');
    pushFlag('anti_whale', 'Anti-whale controls detected', 'medium', 'is_anti_whale');
    pushFlag('slippage_modifiable', 'Slippage or tax is modifiable', 'high', 'slippage_modifiable');
    pushFlag('transfer_pausable', 'Transfer pausing detected', 'medium', 'transfer_pausable');

    const buyTax = numeric(row.buy_tax);
    const sellTax = numeric(row.sell_tax);
    if ((buyTax ?? 0) >= 0.1 || (sellTax ?? 0) >= 0.1) {
      findings.push({
        id: 'goplus_high_tax',
        title: 'High buy/sell tax detected',
        severity: (buyTax ?? 0) >= 0.3 || (sellTax ?? 0) >= 0.3 ? 'critical' : 'high',
        evidence: `buy_tax=${row.buy_tax}, sell_tax=${row.sell_tax}`,
        source: 'goplus'
      });
    }

    const ownerAddress = row.owner_address && isAddress(row.owner_address) ? getAddress(row.owner_address) : undefined;
    return {
      check: {
        provider: 'goplus',
        status: 'ok',
        evidence: {
          is_open_source: row.is_open_source,
          is_honeypot: row.is_honeypot,
          buy_tax: row.buy_tax,
          sell_tax: row.sell_tax,
          owner_address: ownerAddress
        }
      },
      findings,
      flags: {
        proxy: isTrue(row.is_proxy),
        honeypot: isTrue(row.is_honeypot),
        hiddenOwner: isTrue(row.hidden_owner),
        highTax: (buyTax ?? 0) >= 0.1 || (sellTax ?? 0) >= 0.1,
        blacklist: isTrue(row.is_blacklisted),
        mintable: isTrue(row.is_mintable),
        ownerAddress
      }
    };
  } catch (error) {
    return {
      check: { provider: 'goplus', status: 'error', error: error instanceof Error ? error.message : String(error) },
      findings: [],
      flags: {}
    };
  }
}

async function fetchTokenSniffer(chain: SupportedChain, address: `0x${string}`): Promise<{ check: ExternalCheck; findings: Vulnerability[] }> {
  const key = process.env.TOKEN_SNIFFER_API_KEY;
  if (!key) {
    return {
      check: {
        provider: 'tokensniffer',
        status: 'unavailable',
        error: 'TOKEN_SNIFFER_API_KEY not configured'
      },
      findings: []
    };
  }

  try {
    const url = `https://tokensniffer.com/api/v2/tokens/${chain}/${address}`;
    const json = await fetchJson<Record<string, unknown>>(url, { 'x-api-key': key });
    const score = typeof json.score === 'number' ? json.score : typeof json.risk_score === 'number' ? json.risk_score : undefined;
    const findings: Vulnerability[] = [];
    if (score !== undefined && score < 60) {
      findings.push({
        id: 'tokensniffer_low_score',
        title: 'Token Sniffer score is low',
        severity: score < 25 ? 'critical' : 'high',
        evidence: `score=${score}`,
        source: 'tokensniffer'
      });
    }
    return {
      check: {
        provider: 'tokensniffer',
        status: 'ok',
        evidence: { score }
      },
      findings
    };
  } catch (error) {
    return {
      check: {
        provider: 'tokensniffer',
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      },
      findings: []
    };
  }
}

async function fetchJson<T>(url: string, headers: Record<string, string> = {}, body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json', 'user-agent': 'smart-contract-risk-scorer/0.1', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} from ${new URL(url).hostname}`);
    return await response.json() as T;
  } finally {
    clearTimeout(timeout);
  }
}

function isTrue(value: unknown): boolean {
  return value === true || value === '1' || value === 'true';
}

function numeric(value: unknown): number | undefined {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isRenounced(address?: string): boolean | undefined {
  if (!address) return undefined;
  const normalized = address.toLowerCase();
  return normalized === zeroAddress.toLowerCase() || normalized === deadAddress.toLowerCase();
}

function getAddressSafe(address: string): string | undefined {
  return isAddress(address) ? getAddress(address) : undefined;
}

function computeConfidence(args: {
  isContract: boolean;
  externalChecks: ExternalCheck[];
  hasSource: boolean;
  scanDepth: 'quick' | 'deep';
}): number {
  let confidence = args.isContract ? 0.35 : 0.2;
  if (args.hasSource) confidence += 0.25;
  confidence += args.externalChecks.filter((check) => check.status === 'ok').length * 0.12;
  if (args.scanDepth === 'deep') confidence += 0.08;
  return Math.min(0.98, Number(confidence.toFixed(2)));
}
