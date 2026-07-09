# Deployment Guide

## Prerequisites

1. **Cloudflare Account**: Sign up at https://dash.cloudflare.com/
2. **Wrangler CLI**: `bun install -g wrangler`
3. **Alchemy Account**: Sign up at https://www.alchemy.com/
4. **Alchemy API Key**: Get your key from Alchemy dashboard

## Step 1: Create KV Namespace

```bash
wrangler kv:namespace create "PAIRS_KV"
```

Copy the returned `id` and update `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "PAIRS_KV"
id = "YOUR_KV_NAMESPACE_ID"  # Replace with actual ID
```

## Step 2: Set Alchemy API Key as Secret

```bash
wrangler secret put ALCHEMY_API_KEY
```

Paste your Alchemy API key when prompted.

## Step 3: Deploy Worker

```bash
wrangler deploy
```

Note the deployed URL (e.g., `https://fresh-markets-watch.your-subdomain.workers.dev`)

## Step 4: Configure Alchemy Notify Webhooks

### Ethereum Webhook

1. Go to Alchemy Dashboard → Notify → Create new webhook
2. **Webhook URL**: `https://fresh-markets-watch.your-subdomain.workers.dev/webhook`
3. **Network**: Ethereum Mainnet
4. **Event Type**: `PAIR_CREATED`
5. **Contract Addresses**:
   - Uniswap V2: `0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f`
   - Uniswap V3: `0x1F98431c8aD98523631AE4a59f267346ea31F984`

### BSC Webhook

1. Create another webhook in Alchemy Notify
2. **Webhook URL**: `https://fresh-markets-watch.your-subdomain.workers.dev/webhook`
3. **Network**: BSC Mainnet
4. **Event Type**: `PAIR_CREATED`
5. **Contract Addresses**:
   - PancakeSwap V2: `0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73`
   - PancakeSwap V3: `0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865`

## Step 5: Verify Deployment

### Health Check

```bash
curl https://fresh-markets-watch.your-subdomain.workers.dev/health
```

Expected response:
```json
{
  "status": "ok",
  "last_webhook": "",
  "last_cron": "",
  "pairs_cached": 0
}
```

### Test Cron Scanner

Wait 10 minutes for the first cron run, then check health again:

```bash
curl https://fresh-markets-watch.your-subdomain.workers.dev/health
```

The `last_cron` timestamp should be updated.

### Test Webhook

Check Alchemy Notify dashboard for successful webhook deliveries.

## Step 6: Validate Acceptance Criteria

See `VALIDATION.md` for the complete acceptance criteria checklist.

## Troubleshooting

### Worker not responding

```bash
wrangler tail
```

### KV namespace errors

Verify the KV namespace ID in `wrangler.toml` matches the one created in Step 1.

### Webhook not receiving events

1. Check Alchemy Notify dashboard for webhook status
2. Verify webhook URL is correct
3. Check Worker logs with `wrangler tail`

### Cron not running

1. Verify cron schedule in `wrangler.toml`: `*/10 * * * *`
2. Check Worker logs with `wrangler tail`
