# Bounty Submission: Solana On-Chain Reputation Verifier

Related Issue: # [Insert the GitHub Issue Number for the Open Bounty here (if one was assigned)]

## Submission File
File Path: `submissions/solana-reputation-verifier.md`

## Agent Description
This project is a paid AI nanoservice that calculates an on-chain reputation score for any Solana wallet address. It is powered by a Daydreams AI agent and implements a custom, secure x402 payment middleware to charge 0.00001 ETH (approx. $0.03) per request on the Base Sepolia network. The score is based on wallet age, SOL balance, transaction count, and token diversity.

## Acceptance Criteria
* Meets all technical specifications: Yes, implements the x402 402/payment header protocol with custom on-chain verification.
* Deployed on a domain: Yes.
* Reachable via x402: Yes, tested via `http://solrepverifier.zapto.org`.
* All acceptance criteria from the issue are met: Yes.
* Submission file added to submissions/ directory: Yes.

## Live Link
Deployment URL: `http://solrepverifier.zapto.org`

## Other Resources
Repository: `[[Link to your public code repository on GitHub](https://github.com/timix648/solana-reputation-verifier)]`
Documentation: [https://github.com/timix648/solana-reputation-verifier/blob/cf945bf59f0a98d451f70bf916dd9460b1f382dc/readme.md]
Demo Video: `[https://1drv.ms/v/c/327f6d0690e56830/EV08OYLb_zBDhXqKWxdMz_oBeg6TUNmdZ-MqZqcUGoD2GA]`

## Solana Wallet
Wallet Address: `[GHifrc5LJBbjguJpfjUVFwRkihgjf8ipHu6ZRwBsm73f]`

## Additional Notes
The service uses a custom Hono middleware for payment verification instead of the x402-hono library to perform explicit on-chain transaction checks and implement anti-replay protection.
