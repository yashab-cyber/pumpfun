import dotenv from 'dotenv';
import { AgentConfig, TradingMode } from './types';
import { StrategyType } from './strategies';

dotenv.config();

export function loadConfig(): AgentConfig {
  const tradingMode = (process.env.TRADING_MODE?.toLowerCase() === 'live' ? 'live' : 'paper') as TradingMode;
  const rawStrat = (process.env.ACTIVE_STRATEGY?.toUpperCase() || 'SNIPER') as StrategyType;
  const validStrats: StrategyType[] = ['SNIPER', 'MIGRATION_KOTH', 'MOMENTUM_SCALP', 'COPY_WHALE'];
  const activeStrategy = validStrats.includes(rawStrat) ? rawStrat : 'SNIPER';

  return {
    rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    privateKey: process.env.SOLANA_PRIVATE_KEY || '',
    tradingMode: tradingMode,
    activeStrategy: activeStrategy,
    solPerTrade: parseFloat(process.env.SOL_PER_TRADE || '0.01'),
    maxActivePositions: parseInt(process.env.MAX_ACTIVE_POSITIONS || '3', 10),
    slippagePercent: parseFloat(process.env.SLIPPAGE_PERCENT || '15'),
    priorityFeeLamports: parseInt(process.env.PRIORITY_FEE_LAMPORTS || '1000000', 10),
    webPort: parseInt(process.env.WEB_PORT || '3000', 10),

    // Profit Auto-Vault & Compounding Rules
    enableProfitVault: process.env.ENABLE_PROFIT_VAULT !== 'false',
    baseBankrollSol: parseFloat(process.env.BASE_BANKROLL_SOL || '0.01'), // e.g. 0.01 SOL ($2 base capital)
    profitVaultThresholdSol: parseFloat(process.env.PROFIT_VAULT_THRESHOLD_SOL || '0.5'), // e.g. 0.5 SOL (~$100 vault milestone)
    vaultDestinationWallet: process.env.VAULT_DESTINATION_WALLET || '',

    // AI Brain & Memory
    aiProvider: process.env.AI_PROVIDER || 'copilot',
    aiModel: process.env.AI_MODEL || 'gpt-4o',
    minAiConfidence: parseInt(process.env.MIN_AI_CONFIDENCE || '60', 10),

    // Jito MEV Bundle
    enableJito: process.env.ENABLE_JITO === 'true',
    jitoTipLamports: parseInt(process.env.JITO_TIP_LAMPORTS || '1000000', 10),

    // Strategy & Risk Management
    takeProfit1Percent: parseFloat(process.env.TP1_PERCENT || '50'),
    takeProfit1SellRatio: parseFloat(process.env.TP1_SELL_RATIO || '0.5'),
    takeProfit2Percent: parseFloat(process.env.TP2_PERCENT || '100'),
    takeProfit2SellRatio: parseFloat(process.env.TP2_SELL_RATIO || '0.5'),
    takeProfit3Percent: parseFloat(process.env.TP3_PERCENT || '300'),

    stopLossPercent: parseFloat(process.env.STOP_LOSS_PERCENT || '-20'),
    trailingStopTriggerPercent: parseFloat(process.env.TRAILING_STOP_TRIGGER_PERCENT || '30'),
    trailingStopDistancePercent: parseFloat(process.env.TRAILING_STOP_DISTANCE_PERCENT || '15'),

    maxHoldTimeSeconds: parseInt(process.env.MAX_HOLD_TIME_SECONDS || '300', 10),
    maxDailyLossSol: parseFloat(process.env.MAX_DAILY_LOSS_SOL || '0.5'),

    // Anti-Rug & Safety Filters
    minDevInitialBuySol: parseFloat(process.env.MIN_DEV_BUY_SOL || '0.05'),
    maxDevInitialBuySol: parseFloat(process.env.MAX_DEV_BUY_SOL || '4.0'),
    requireSocials: process.env.REQUIRE_SOCIALS === 'true',
    blacklistedWords: (process.env.BLACKLISTED_WORDS || 'presale,fairlaunch,scam,test,rug,airdrop,honeypot')
      .toLowerCase()
      .split(',')
      .map(w => w.trim())
      .filter(Boolean),
    minViralityScore: parseInt(process.env.MIN_VIRALITY_SCORE || '45', 10)
  };
}
