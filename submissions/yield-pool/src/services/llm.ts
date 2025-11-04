import OpenAI from "openai";

interface LLMServiceConfig {
  provider: "openai" | "disabled";
  model: string;
  maxTokens: number;
}

export class LLMService {
  private readonly config: LLMServiceConfig;
  private readonly client: OpenAI | null;

  constructor() {
    const provider = (process.env.LLM_PROVIDER ?? "openai").toLowerCase();
    if (provider !== "openai") {
      console.warn(
        `[llm] Unsupported provider "${provider}". LLM functionality disabled.`
      );
      this.client = null;
      this.config = {
        provider: "disabled",
        model: "n/a",
        maxTokens: 800,
      };
      return;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn(
        "[llm] OPENAI_API_KEY is not set. Summaries will fall back to heuristic output."
      );
      this.client = null;
      this.config = {
        provider: "disabled",
        model: "n/a",
        maxTokens: 800,
      };
      return;
    }

    const baseURL = process.env.OPENAI_BASE_URL;
    this.client = new OpenAI({
      apiKey,
      baseURL,
    });
    this.config = {
      provider: "openai",
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      maxTokens: Number(process.env.OPENAI_MAX_TOKENS ?? 800),
    };
  }

  isEnabled(): boolean {
    return this.client !== null;
  }

  get provider(): string {
    return this.config.provider;
  }

  get model(): string {
    return this.config.model;
  }

  async summarizeWatcher(data: unknown): Promise<string> {
    if (!this.client) {
      throw new Error("LLM client not configured.");
    }

    const systemPrompt =
      "You are a DeFi analyst. Craft concise, user-friendly summaries of watcher preferences and recent yield/tvl changes.";

    const userPrompt = [
      "Summarize the user's watcher preferences and key changes over the requested timeframe.",
      "Highlight:",
      "1. Pools being monitored and why (threshold rules, change.amount).",
      "2. Notable changes in APY and TVL over the last 24 hours.",
      "3. Any alerts triggered and what they signify.",
      "4. Suggestions for the user (optional).",
      "",
      "Use short paragraphs or bullet points and keep under 220 words.",
      "",
      "JSON data:",
      "```json",
      JSON.stringify(data, null, 2),
      "```",
    ].join("\n");

    const response = await this.client.chat.completions.create({
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      temperature: 0.4,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const completion = response.choices?.[0]?.message?.content?.trim();
    if (!completion) {
      throw new Error("Received empty response from LLM.");
    }
    return completion;
  }
}
