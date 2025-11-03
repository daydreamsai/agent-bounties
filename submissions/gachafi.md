# GachaFi - AI Gacha Token Launcher

## Agent Description

GachaFi is an AI-powered "gacha pull" style token launcher that creates completely random, AI-generated meme coins on Raydium's LaunchLab platform. Users pay $5 USDC (on Solana or Base) and receive a fully deployed meme token with an AI-generated name, symbol, description, and unique logo image - all deployed automatically to Solana.

This combines the excitement of gacha-style randomness with DeFi token launching, powered by cutting-edge AI for concept generation (Claude) and image creation (Flux Schnell).

## Features

- **AI-Powered Token Generation** - Claude AI creates completely random meme token concepts with creative names, symbols, and descriptions
- **AI Image Generation** - Replicate's Flux Schnell model generates unique, one-of-a-kind logo artwork for each token
- **Permanent IPFS Storage** - All metadata and images stored on IPFS via Pinata for permanent decentralized hosting
- **Automatic Deployment** - Tokens are automatically minted and deployed to Raydium LaunchLab on Solana mainnet
- **Dual Payment Networks** - Accept payments on both Solana and Base networks via x402 protocol
- **Metaplex Metadata Standard** - Full compliance with Solana token metadata standards
- **x402 Protocol Integration** - Paywalled access with micropayment support
- **Zero User Input Required** - Complete "gacha" experience - just pay and receive a random token
- **Instant Explorer Links** - Returns Solscan URLs for immediate token verification

## Live Deployment

**URL:** https://api.gacha.fi/

## Related Bounty

This submission is an **optional/creative entry** - a novel application of AI and DeFi that showcases the x402 payment protocol in a fun, engaging way. While it doesn't match a specific bounty category, it demonstrates:

- Creative use of x402 for paywalled AI services
- Multi-chain payment support (Solana + Base)
- Integration of multiple AI services (LLMs + image generation)
- Real-world DeFi utility (token deployment)
- Novel user experience (gacha-style randomness)

## API Endpoints

- `POST /gachapull` - Gacha pull with USDC payment on Solana (paywalled via x402)
- `POST /gachapull-base` - Gacha pull with USDC payment on Base (paywalled via x402)

## Example Usage

### Gacha Pull (Solana Payment)
```bash
curl -X POST https://api.gacha.fi/gachapull \
  -H "Content-Type: application/json" \
  -H "X-PAYMENT: <payment_header>" \
  -d '{}'
```

### Gacha Pull (Base Payment)
```bash
curl -X POST https://api.gacha.fi/gachapull-base \
  -H "Content-Type: application/json" \
  -H "X-PAYMENT: <payment_header>" \
  -d '{}'
```

### Response
```json
{
  "success": true,
  "tokenName": "Cyberpunk Sloths",
  "tokenSymbol": "SLOTH",
  "mintAddress": "8FjXqN2vK3hGZm4qW7pR5dYnE9sT1cU6bV4xL2mA7zK9",
  "explorer": "https://solscan.io/token/8FjXqN2vK3hGZm4qW7pR5dYnE9sT1cU6bV4xL2mA7zK9",
  "paymentNetwork": "Solana"
}
```

### Example AI-Generated Tokens

The AI generates completely random, creative meme coin concepts such as:
- **Degen Raccoons** - Trash pandas raiding the DeFi dumpsters
- **Space Hamsters** - Cosmic rodents running the wheel of fortune
- **Ninja Penguins** - Stealth birds sliding into your wallet
- **Time-Traveling Toasters** - Breakfast appliances from the future
- **Cyberpunk Sloths** - Slow but steady in the metaverse

Each token gets a unique AI-generated logo image created specifically for its concept.

## Technical Implementation

- **Framework:** Express.js with x402-express middleware
- **Runtime:** Bun (JavaScript runtime)
- **AI Services:**
  - Anthropic Claude Haiku 4.5 for token concept generation
  - Replicate (Flux Schnell model) for image generation
- **Blockchain Integration:**
  - @raydium-io/raydium-sdk-v2 for LaunchLab token deployment
  - @solana/web3.js for Solana blockchain interactions
  - @solana/spl-token for token standard compliance
- **Storage:** Pinata IPFS for permanent decentralized storage
- **Payment Networks:** Solana and Base (via x402 protocol)
- **Hosting:** Railway
- **Facilitator:** https://facilitator.payai.network/

## AI Generation Pipeline

1. **Token Concept Generation**
   - Claude AI generates random meme token concept
   - Outputs: name, symbol, description, and image generation prompt
   - Examples: "Ninja Penguins", "Space Hamsters", "Cyberpunk Sloths"

2. **Image Generation**
   - Replicate runs Flux Schnell model with AI-generated prompt
   - Creates unique logo artwork in PNG format (1:1 aspect ratio)
   - Optimized for cryptocurrency mascot/logo style

3. **IPFS Storage**
   - Image uploaded to Pinata IPFS (permanent storage)
   - Metadata JSON created (Metaplex standard)
   - Metadata uploaded to IPFS with image reference

4. **Token Deployment**
   - Raydium SDK creates token on LaunchLab
   - Metadata URI points to IPFS JSON
   - Token minted on Solana mainnet

5. **Response**
   - Returns token mint address
   - Provides Solscan explorer link
   - Confirms payment network used

## Payment Information

### Pricing
- **Price per Gacha Pull:** $5 USDC (5,000,000 units, 6 decimals)
- **Solana Payment:** USDC token `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- **Base Payment:** USDC token `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

### Input Parameters
- **None required** - Empty JSON body `{}` (true gacha experience!)
- The entire token concept and artwork is AI-generated randomly

### Output Fields
- `success`: Boolean indicating whether token was created successfully
- `tokenName`: AI-generated token name (e.g., "Cyberpunk Sloths")
- `tokenSymbol`: AI-generated token symbol/ticker (e.g., "SLOTH")
- `mintAddress`: Solana mint address of the created token
- `explorer`: Solscan explorer URL for immediate verification
- `paymentNetwork`: Network used for payment (Solana or Base)
- `error`: Error message if creation failed (only on failure)

## Supported Networks

- **Token Deployment:** Solana Mainnet (via Raydium LaunchLab)
- **Payment Options:**
  - Solana (USDC)
  - Base (USDC)

## Metadata Standards

All tokens comply with:
- **Metaplex Metadata Standard** for Solana tokens
- **IPFS permanent storage** for decentralization
- **JSON metadata format:**
  ```json
  {
    "name": "Token Name",
    "symbol": "SYMBOL",
    "description": "AI-generated description",
    "image": "https://ipfs.io/ipfs/{CID}",
    "attributes": [
      {
        "trait_type": "AI Generated",
        "value": "true"
      },
      {
        "trait_type": "Created",
        "value": "2025-11-03T..."
      }
    ]
  }
  ```

## Use Cases

- **Entertainment** - Fun way to create random meme tokens
- **Community Engagement** - Launch surprise tokens for communities
- **AI Experimentation** - Showcase AI creativity in DeFi
- **Token Art** - Collect unique AI-generated token artwork
- **Gacha Gaming** - DeFi meets gacha mechanics

## Why GachaFi?

GachaFi represents a novel intersection of:
- **AI Innovation** - Leveraging Claude and Flux for creative token generation
- **DeFi Utility** - Real tokens deployed on Raydium's established platform
- **User Experience** - Zero-friction gacha-style randomness
- **Multi-Chain Payments** - x402 enables seamless payment across networks
- **Permanent Storage** - IPFS ensures token metadata lives forever

It's a fun, experimental showcase of what's possible when you combine cutting-edge AI with blockchain infrastructure and micropayment protocols.

## Bounty Payment Wallet

**Solana Wallet Address:** `65erknJyjgixYifm6vfQTkPGUmARMjfuatWQyoYSswFv`

## Additional Resources

- **Live Service:** https://api.gacha.fi/
- **Payment Protocol:** x402 (Solana + Base support)
- **Token Platform:** Raydium LaunchLab (Solana)
- **AI Models:** Claude Haiku 4.5, Flux Schnell
- **Storage:** Pinata IPFS
- **Price:** $5 USDC per gacha pull
