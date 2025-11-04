import { InMemoryWatcherStore } from "./storage/in-memory";
import { MonitoringService } from "./services/monitoring";

const store = new InMemoryWatcherStore();
const monitoringService = new MonitoringService(store, {
  defaultPollingIntervalMs: 12_000,
});

export { store, monitoringService };
