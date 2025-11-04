import {
  describe,
  it,
  expect,
  afterEach,
} from "bun:test";
import { MonitoringService } from "../src/services/monitoring";
import { InMemoryWatcherStore } from "../src/storage/in-memory";
import {
  listProtocolAdapters,
  setProtocolAdapters,
  type ProtocolAdapter,
} from "../src/protocols";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const originalAdapters = listProtocolAdapters();

afterEach(() => {
  // Restore the default adapter registry after each test case.
  setProtocolAdapters(originalAdapters);
});

describe("MonitoringService", () => {
  it("emits deltas and alerts when metrics breach percent thresholds", async () => {
    const sequence = [
      { block: 1n, tvl: 1_000, apy: 4.5 },
      { block: 2n, tvl: 1_500, apy: 4.4 },
    ];
    let index = 0;

    const mockAdapter: ProtocolAdapter = {
      id: "mock-protocol",
      supports: {
        protocolIds: ["mock-protocol"],
        chains: [1],
      },
      async fetchLatestMetrics(pool, context) {
        const cursor = Math.min(index, sequence.length - 1);
        const point = sequence[cursor];
        index += 1;

        return {
          protocolId: pool.protocolId,
          poolId: pool.id,
          chainId: pool.chainId,
          address: pool.address as `0x${string}`,
          blockNumber: point.block,
          timestamp: context.timestamp ?? Date.now(),
          apy: point.apy,
          tvl: point.tvl,
          raw: { cursor },
        };
      },
    };

    setProtocolAdapters([mockAdapter]);

    const store = new InMemoryWatcherStore();
    const service = new MonitoringService(store, {
      defaultPollingIntervalMs: 1_000,
    });

    service.configure({
      protocolIds: ["mock-protocol"],
      pools: [
        {
          id: "mock-pool",
          protocolId: "mock-protocol",
          chainId: 1,
          address: ZERO_ADDRESS,
        },
      ],
      thresholdRules: [
        {
          id: "rule-tvl-spike",
          metric: "tvl",
          change: {
            type: "percent",
            direction: "increase",
            amount: 10,
          },
          window: {
            type: "blocks",
            value: 1,
          },
        },
      ],
    });

    await service.runOnce();
    expect(service.getMetrics()).toHaveLength(1);
    expect(service.getAlerts()).toHaveLength(0);
    expect(service.getDeltas()).toHaveLength(0);

    await service.runOnce();
    const deltas = service.getDeltas();
    const tvlDelta = deltas.find((delta) => delta.metric === "tvl");
    expect(tvlDelta).toBeDefined();
    expect(tvlDelta?.absoluteChange ?? 0).toBeCloseTo(500);
    expect(tvlDelta?.percentChange ?? 0).toBeCloseTo(50);

    const alerts = service.getAlerts();
    expect(alerts).toHaveLength(1);
    expect(alerts[0].ruleId).toBe("rule-tvl-spike");
    expect(alerts[0].changeDirection).toBe("increase");
  });
});
