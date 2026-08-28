import { StrategyType } from './strategies';

export type TradingMode = 'paper' | 'live';

export interface TokenCreationEvent {
  signature: string;
  mint: string;
  traderPublicKey: string;
  txType: 'create';
  initialBuy: number;
  bondingCurveKey?: string;
  vTokensInBondingCurve?: number;
  vSolInBondingCurve?: number;
  marketCapSol?: number;
  name: string;
  symbol: string;
  uri: string;
  twitter?: string;
  telegram?: string;
  website?: string;
  timestamp: number;
}

export interface TradeEvent {
  signature: string;
  mint: string;
  traderPublicKey: string;
  txType: 'buy' | 'sell';
  tokenAmount: number;
  solAmount: number;
  newTokenBalance?: number;
  bondingCurveKey?: string;
  vTokensInBondingCurve?: number;
  vSolInBondingCurve?: number;
  marketCapSol?: number;
  timestamp: number;
}

export interface Position {
  mint: string;
  symbol: string;
  name: string;
  strategy: string;
  category?: string;
  tags: string[];
  entryPriceSol: number;
  currentPriceSol: number;
  tokenAmount: number;
  originalTokenAmount: number;
  investedSol: number;
  highestPriceSol: number;
  buyTimestamp: number;
  pnlPercent: number;
  pnlSol: number;
  tp1Triggered: boolean;
  tp2Triggered: boolean;
  status: 'OPEN' | 'CLOSING' | 'CLOSED';
  closeReason?: string;
  txSignature?: string;
  bondingCurveProgress?: number;
  aiConfidence?: number;
  aiReasoning?: string;
  researchScore?: number;
}

export interface VaultCycle {
  id: number;
  cycleNumber: number;
  amountVaultedSol: number;
  totalVaultedSol: number;
  timestamp: number;
  txSignature?: string;
}

export interface AgentConfig {
  rpcUrl: string;
  privateKey: string;
  tradingMode: TradingMode;
  activeStrategy: StrategyType;
  solPerTrade: number;
  maxActivePositions: number;
  slippagePercent: number;
  priorityFeeLamports: number;
  webPort: number;

  // Profit Auto-Vault & Compounding Rules
  enableProfitVault: boolean;
  baseBankrollSol: number;
  profitVaultThresholdSol: number;
  vaultDestinationWallet?: string;

  // AI Brain & Memory
  aiProvider: string;
  aiModel: string;
  minAiConfidence: number;

  // Jito MEV Bundle
  enableJito: boolean;
  jitoTipLamports: number;

  // Strategy & Risk Management
  takeProfit1Percent: number;
  takeProfit1SellRatio: number;
  takeProfit2Percent: number;
  takeProfit2SellRatio: number;
  takeProfit3Percent: number;

  stopLossPercent: number;
  trailingStopTriggerPercent: number;
  trailingStopDistancePercent: number;

  maxHoldTimeSeconds: number;
  maxDailyLossSol: number;

  // Anti-Rug & Safety Filters
  minDevInitialBuySol: number;
  maxDevInitialBuySol: number;
  requireSocials: boolean;
  blacklistedWords: string[];
  minViralityScore: number;
}
