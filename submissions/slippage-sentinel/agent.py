"""
Slippage Sentinel Agent
Estimates safe slippage for DEX swap routes based on liquidity and trade size.
"""

import os
from typing import Dict, Any, Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn

app = FastAPI(title="Slippage Sentinel")


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "healthy", "service": "slippage-sentinel"}


@app.post("/estimate")
async def estimate_slippage_post(route: SwapRoute) -> SlippageEstimate:
    """
    POST endpoint to estimate slippage for a swap route.
    """
    if route.amount_in <= 0:
        raise HTTPException(status_code=400, detail="amount_in must be positive")
    if route.pool_liquidity <= 0:
        raise HTTPException(status_code=400, detail="pool_liquidity must be positive")
    
    return estimate_slippage(route)


@app.get("/estimate")
async def estimate_slippage_get(
    token_in: str,
    token_out: str,
    amount_in: float,
    pool_liquidity: float,
    dex: Optional[str] = "uniswap_v3",
    price_impact_factor: Optional[float] = 0.003,
) -> SlippageEstimate:
    """
    GET endpoint for x402 compatibility to estimate slippage.
    """
    route = SwapRoute(
        token_in=token_in,
        token_out=token_out,
        amount_in=amount_in,
        pool_liquidity=pool_liquidity,
        dex=dex,
        price_impact_factor=price_impact_factor,
    )
    
    if route.amount_in <= 0:
        raise HTTPException(status_code=400, detail="amount_in must be positive")
    if route.pool_liquidity <= 0:
        raise HTTPException(status_code=400, detail="pool_liquidity must be positive")
    
    return estimate_slippage(route)


class SwapRoute(BaseModel):
    """Input parameters for slippage estimation."""
    token_in: str
    token_out: str
    amount_in: float
    pool_liquidity: float
    price_impact_factor: Optional[float] = 0.003
    dex: Optional[str] = "uniswap_v3"
    
    class Config:
        json_schema_extra = {
            "example": {
                "token_in": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                "token_out": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
                "amount_in": 1000,
                "pool_liquidity": 5000000,
                "dex": "uniswap_v3"
            }
        }


class SlippageEstimate(BaseModel):
    """Output slippage estimation."""
    estimated_slippage_bps: float
    recommended_slippage_bps: float
    price_impact_bps: float
    liquidity_utilization: float
    risk_level: str
    route: Dict[str, Any]
    min_safe_slip_bps: float
    pool_depths: Dict[str, float]
    recent_trade_size_p95: float


def calculate_price_impact(amount_in: float, pool_liquidity: float, price_impact_factor: float = 0.003) -> float:
    """
    Calculate price impact based on trade size relative to pool liquidity.
    Uses a simplified constant product formula approximation.
    """
    if pool_liquidity <= 0:
        return 100.0
    
    liquidity_util = amount_in / pool_liquidity
    price_impact = liquidity_util * price_impact_factor * 10000
    return min(price_impact, 10000)


def calculate_volatility_buffer(dex: str, recent_trade_size_p95: float) -> float:
    """
    Calculate additional slippage buffer based on volatility and DEX type.
    """
    base_buffer = 0.15
    
    dex_multipliers = {
        "uniswap_v3": 1.0,
        "uniswap_v2": 1.2,
        "sushiswap": 1.15,
        "curve": 0.8,
        "balancer": 1.1,
        "pancakeswap": 1.25,
    }
    
    multiplier = dex_multipliers.get(dex.lower(), 1.2)
    volatility_adjustment = min(recent_trade_size_p95 / 100000, 0.5)
    
    return base_buffer * multiplier * (1 + volatility_adjustment)


def determine_risk_level(recommended_slippage_bps: float) -> str:
    """
    Determine risk level based on recommended slippage.
    """
    if recommended_slippage_bps < 50:
        return "low"
    elif recommended_slippage_bps < 200:
        return "medium"
    elif recommended_slippage_bps < 500:
        return "high"
    else:
        return "extreme"


def estimate_pool_depths(pool_liquidity: float, dex: str) -> Dict[str, float]:
    """
    Estimate liquidity depths at different price tiers.
    """
    depth_tiers = {
        "tier_1_percent": pool_liquidity * 0.01,
        "tier_5_percent": pool_liquidity * 0.05,
        "tier_10_percent": pool_liquidity * 0.10,
        "total_liquidity": pool_liquidity,
    }
    
    if dex.lower() == "uniswap_v3":
        depth_tiers["concentrated_liquidity"] = pool_liquidity * 0.6
    
    return depth_tiers


def estimate_recent_trade_p95(pool_liquidity: float, dex: str) -> float:
    """
    Estimate 95th percentile of recent trade sizes based on pool characteristics.
    """
    base_trade_size = pool_liquidity * 0.001
    
    dex_adjustments = {
        "uniswap_v3": 1.2,
        "uniswap_v2": 0.9,
        "sushiswap": 0.85,
        "curve": 1.5,
        "balancer": 1.1,
        "pancakeswap": 0.95,
    }
    
    adjustment = dex_adjustments.get(dex.lower(), 1.0)
    return base_trade_size * adjustment


def estimate_slippage(route: SwapRoute) -> SlippageEstimate:
    """
    Core slippage estimation logic.
    Calculates safe slippage tolerance based on pool depth, trade size, and volatility.
    """
    price_impact_bps = calculate_price_impact(
        route.amount_in,
        route.pool_liquidity,
        route.price_impact_factor
    )
    
    liquidity_utilization = route.amount_in / route.pool_liquidity if route.pool_liquidity > 0 else 1.0
    
    recent_trade_size_p95 = estimate_recent_trade_p95(route.pool_liquidity, route.dex)
    
    volatility_buffer = calculate_volatility_buffer(route.dex, recent_trade_size_p95)
    
    estimated_slippage_bps = price_impact_bps * (1 + volatility_buffer)
    
    safety_margin = 1.5
    recommended_slippage_bps = estimated_slippage_bps * safety_margin
    
    min_safe_slip_bps = estimated_slippage_bps
    
    pool_depths = estimate_pool_depths(route.pool_liquidity, route.dex)
    
    risk_level = determine_risk_level(recommended_slippage_bps)
    
    return SlippageEstimate(
        estimated_slippage_bps=round(estimated_slippage_bps, 2),
        recommended_slippage_bps=round(recommended_slippage_bps, 2),
        price_impact_bps=round(price_impact_bps, 2),
        liquidity_utilization=round(liquidity_utilization, 6),
        risk_level=risk_level,
        route={
            "token_in": route.token_in,
            "token_out": route.token_out,
            "dex": route.dex,
            "amount_in": route.amount_in,
        },
        min_safe_slip_bps=round(min_safe_slip_bps, 2),
        pool_depths=pool_depths,
        recent_trade_size_p95=round(recent_trade_size_p95, 2),
    )ion: float
    risk_level: str
    route: Dict[str, Any]


def calculate_price_impact(amount_in: float, liquidity: float) -> float:
    """
    Calculate price impact using constant product formula approximation.
    Price impact ≈ amount_in / (2 * liquidity)
    """
    if liquidity <= 0:
        return float('inf')
    return (amount_in / (2 * liquidity)) * 10000  # Return in basis points


def determine_risk_level(recommended_slippage_bps: float) -> str:
    """
    Determine risk level based on recommended slippage.
    
    - low: <50 bps
    - medium: 50-200 bps
    - high: 200-500 bps
    - extreme: >500 bps
    """
    if recommended_slippage_bps < 50:
        return "low"
    elif recommended_slippage_bps < 200:
        return "medium"
    elif recommended_slippage_bps < 500:
        return "high"
    else:
        return "extreme"


def estimate_slippage(route: SwapRoute) -> SlippageEstimate:
    """
    Estimate safe slippage for a given swap route.
    
    Considers:
    - Pool liquidity vs trade size
    - DEX-specific factors
    - Market volatility buffer
    """
    # Calculate base price impact
    price_impact_bps = calculate_price_impact(route.amount_in, route.pool_liquidity)
    
    # Calculate liquidity utilization
    liquidity_utilization = route.amount_in / route.pool_liquidity if route.pool_liquidity > 0 else float('inf')
    
    # DEX-specific adjustment factors
    dex_factors = {
        "uniswap_v3": 1.0,
        "uniswap_v2": 1.2,
        "sushiswap": 1.15,
        "pancakeswap": 1.1,
        "curve": 0.8,
    }
    dex_factor = dex_factors.get(route.dex, 1.0)
    
    # Calculate estimated slippage (price impact + volatility buffer)
    volatility_buffer = route.price_impact_factor * 10000  # Convert to bps
    estimated_slippage_bps = price_impact_bps * dex_factor + volatility_buffer
    
    # Recommended slippage includes safety margin (50% buffer on estimated)
    recommended_slippage_bps = estimated_slippage_bps * 1.5
    
    # Determine risk level
    risk_level = determine_risk_level(recommended_slippage_bps)
    
    # Build route info
    route_info = {
        "token_in": route.token_in,
        "token_out": route.token_out,
        "dex": route.dex,
        "amount_in": route.amount_in,
        "pool_liquidity": route.pool_liquidity,
    }
    
    return SlippageEstimate(
        estimated_slippage_bps=round(estimated_slippage_bps, 2),
        recommended_slippage_bps=round(recommended_slippage_bps, 2),
        price_impact_bps=round(price_impact_bps, 2),
        liquidity_utilization=round(liquidity_utilization, 4),
        risk_level=risk_level,
        route=route_info,
    )
    
    # Calculate liquidity utilization percentage
    liquidity_utilization = (route.amount_in / route.pool_liquidity) * 100 if route.pool_liquidity > 0 else 100
    
    # DEX-specific multipliers
    dex_multipliers = {
        "uniswap_v3": 1.0,
        "uniswap_v2": 1.2,
        "sushiswap": 1.15,
        "curve": 0.8,
        "balancer": 1.1,
        "pancakeswap": 1.25
    }
    dex_multiplier = dex_multipliers.get(route.dex.lower(), 1.2)
    
    # Calculate estimated slippage (price impact + buffer)
    base_slippage = price_impact_bps * dex_multiplier
    volatility_buffer = route.price_impact_factor * 100  # Convert to bps
    estimated_slippage_bps = base_slippage + volatility_buffer
    
    # Recommended slippage with safety margin
    safety_margin = 1.5 if liquidity_utilization < 5 else 2.0
    recommended_slippage_bps = estimated_slippage_bps * safety_margin
    
    # Determine risk level
    if recommended_slippage_bps < 50:
        risk_level = "low"
    elif recommended_slippage_bps < 200:
        risk_level = "medium"
    elif recommended_slippage_bps < 500:
        risk_level = "high"
    else:
        risk_level = "extreme"
    
    return SlippageEstimate(
        estimated_slippage_bps=round(estimated_slippage_bps, 2),
        recommended_slippage_bps=round(recommended_slippage_bps, 2),
        price_impact_bps=round(price_impact_bps, 2),
        liquidity_utilization=round(liquidity_utilization, 4),
        risk_level=risk_level,
        route={
            "token_in": route.token_in,
            "token_out": route.token_out,
            "amount_in": route.amount_in,
            "pool_liquidity": route.pool_liquidity,
            "dex": route.dex
        }
    )


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "slippage-sentinel"}


@app.post("/estimate", response_model=SlippageEstimate)
async def estimate_swap_slippage(route: SwapRoute):
    """
    Estimate safe slippage for a DEX swap route.
    
    Args:
        route: SwapRoute containing token addresses, amount, and liquidity info
    
    Returns:
        SlippageEstimate with recommended slippage settings
    """
    # Validate inputs
    if route.amount_in <= 0:
        raise HTTPException(status_code=400, detail="amount_in must be positive")
    if route.pool_liquidity <= 0:
        raise HTTPException(status_code=400, detail="pool_liquidity must be positive")
    if not route.token_in or not route.token_out:
        raise HTTPException(status_code=400, detail="token addresses required")
    
    return estimate_slippage(route)


@app.get("/estimate")
async def estimate_slippage_get(
    token_in: str,
    token_out: str,
    amount_in: float,
    pool_liquidity: float,
    dex: str = "uniswap_v3"
):
    """GET endpoint for slippage estimation (x402 compatible)."""
    route = SwapRoute(
        token_in=token_in,
        token_out=token_out,
        amount_in=amount_in,
        pool_liquidity=pool_liquidity,
        dex=dex
    )
    return estimate_slippage(route)


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
