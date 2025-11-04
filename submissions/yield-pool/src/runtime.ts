import { MonitoringService } from "./services/monitoring";
import { LLMService } from "./services/llm";
import { PostgresWatcherRepository } from "./storage/postgres";

const watcherRepository = new PostgresWatcherRepository();
const monitoringService = new MonitoringService(watcherRepository, {
  defaultPollingIntervalMs: 12_000,
});
const llmService = new LLMService();

export { watcherRepository, monitoringService, llmService };
