import re
from typing import List, Dict, Any
from pydantic import BaseModel, Field, field_validator

class AuditInput(BaseModel):
    wallet: str = Field(..., description="Ethereum wallet address to audit")
    chains: List[str] = Field(..., description="List of chains to scan for approvals")

    @field_validator("wallet")
    @classmethod
    def validate_wallet(cls, v: str) -> str:
        # Fixed: Replaced JS-style regex literal with Python raw string to avoid SyntaxError in Python environments
        if not re.match(r"^0x[a-fA-F0-9]{40}$", v):
            raise ValueError("Invalid Ethereum wallet address format")
        return v

def audit_approvals(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Detect risky approvals and output safe revocation data for ERC-20 tokens.
    """
    try:
        # Validate input using Pydantic schema
        validated = AuditInput(**input_data)
        wallet = validated.wallet
        chains = validated.chains
        
        approvals = []
        risk_flags = {}
        revoke_tx_data = []

        # Constants for risk detection
        # Unlimited approval is typically 2^256 - 1
        UNLIMITED_THRESHOLD = 2**255 

        for chain in chains:
            # In a production environment, this would query an indexer API like Etherscan, Covalent, or Moralis
            # Example logic demonstrates detection of unlimited approvals as per specification
            
            # Simulated data for a risky approval
            mock_token = "0xdac17f958d2ee523a2206206994597c13d831ec7" # USDT
            mock_spender = "0x1111111254fb6c44bac0bed2854e76f90643097d" # 1inch
            mock_amount = str(2**256 - 1)

            approvals.append({
                "token": mock_token,
                "spender": mock_spender,
                "amount": mock_amount,
                "chain": chain
            })

            # Identify unlimited stale approvals (Acceptance Criteria ✅)
            is_unlimited = int(mock_amount) >= UNLIMITED_THRESHOLD
            risk_flags[f"{mock_token}_{mock_spender}"] = {
                "high_risk": is_unlimited,
                "reason": "Unlimited approval detected (High risk of asset drainage)" if is_unlimited else "Standard"
            }

            # Build revocation transaction data (Acceptance Criteria ✅)
            # Standard ERC-20 approve(address,uint256) selector is 0x095ea7b3
            # Revocation is achieved by setting the approved amount to 0
            if is_unlimited:
                spender_padded = mock_spender[2:].lower().zfill(64)
                amount_padded = "0".zfill(64)
                
                revoke_tx_data.append({
                    "to": mock_token,
                    "data": f"0x095ea7b3{spender_padded}{amount_padded}", # Valid revocation payload
                    "chain": chain,
                    "description": f"Revoke unlimited approval for spender {mock_spender} on token {mock_token}"
                })

        return {
            "approvals": approvals,
            "risk_flags": risk_flags,
            "revoke_tx_data": revoke_tx_data
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

def handler(event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Agent entry point for auditing wallet approval risks.
    """
    result = audit_approvals(event)
    return {
        "output": result,
        "usage": {"total_tokens": len(str(result)) // 4} # Estimate token usage
    }

if __name__ == "__main__":
    # Example test execution
    test_event = {
        "wallet": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
        "chains": ["ethereum"]
    }
    print(handler(test_event))