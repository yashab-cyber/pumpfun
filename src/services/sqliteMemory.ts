import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import chalk from 'chalk';
import { Position, VaultCycle } from '../types';

export interface DBTrade {
  id: string;
  mint: string;
  symbol: string;
  name: string;
  strategy: string;
  entryPriceSol: number;
  exitPriceSol: number;
  investedSol: number;
  returnedSol: number;
  pnlSol: number;
  pnlPercent: number;
  reason: string;
  aiConfidence?: number;
  aiReasoning?: string;
  holdSeconds: number;
  timestamp: number;
}

export interface DevReputation {
  devPubkey: string;
  totalTokensCreated: number;
  profitableTokens: number;
  ruggedTokens: number;
  rugRate: number;
  reputationScore: number;
  isBlacklisted: boolean;
}

export class SQLiteMemory {
  private db: Database | null = null;
  private dbPath: string = path.join(__dirname, '../../data/memory.sqlite');

  public async init(): Promise<void> {
    this.db = await open({
      filename: this.dbPath,
      driver: sqlite3.Database
    });

    // Create persistent tables
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS trades (
        id TEXT PRIMARY KEY,
        mint TEXT NOT NULL,
        symbol TEXT NOT NULL,
        name TEXT NOT NULL,
        strategy TEXT NOT NULL,
        entry_price REAL NOT NULL,
        exit_price REAL NOT NULL,
        invested_sol REAL NOT NULL,
        returned_sol REAL NOT NULL,
        pnl_sol REAL NOT NULL,
        pnl_percent REAL NOT NULL,
        reason TEXT NOT NULL,
        ai_confidence REAL,
        ai_reasoning TEXT,
        hold_seconds INTEGER NOT NULL,
        timestamp INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp);
      CREATE INDEX IF NOT EXISTS idx_trades_mint ON trades(mint);

      -- Active open positions table for 100% crash recovery & uninterrupted memory
      CREATE TABLE IF NOT EXISTS active_positions (
        mint TEXT PRIMARY KEY,
        symbol TEXT NOT NULL,
        name TEXT NOT NULL,
        strategy TEXT NOT NULL,
        tags TEXT,
        entry_price_sol REAL NOT NULL,
        current_price_sol REAL NOT NULL,
        token_amount REAL NOT NULL,
        original_token_amount REAL NOT NULL,
        invested_sol REAL NOT NULL,
        highest_price_sol REAL NOT NULL,
        buy_timestamp INTEGER NOT NULL,
        pnl_percent REAL NOT NULL,
        pnl_sol REAL NOT NULL,
        tp1_triggered INTEGER NOT NULL DEFAULT 0,
        tp2_triggered INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'OPEN',
        close_reason TEXT,
        tx_signature TEXT,
        bonding_curve_progress REAL DEFAULT 0,
        ai_confidence REAL,
        ai_reasoning TEXT
      );

      -- Key-value persistent state
      CREATE TABLE IF NOT EXISTS agent_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      -- Vault Profit Cycles table
      CREATE TABLE IF NOT EXISTS vault_cycles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cycle_number INTEGER NOT NULL,
        amount_vaulted_sol REAL NOT NULL,
        total_vaulted_sol REAL NOT NULL,
        tx_signature TEXT,
        timestamp INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS dev_memory (
        dev_pubkey TEXT PRIMARY KEY,
        total_tokens_created INTEGER DEFAULT 1,
        profitable_tokens INTEGER DEFAULT 0,
        rugged_tokens INTEGER DEFAULT 0,
        avg_peak_multiplier REAL DEFAULT 1.0,
        last_seen INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS ai_decisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mint TEXT NOT NULL,
        symbol TEXT NOT NULL,
        decision TEXT NOT NULL,
        confidence REAL NOT NULL,
        reasoning TEXT NOT NULL,
        tags TEXT,
        timestamp INTEGER NOT NULL
      );
    `);

    console.log(chalk.green(`[SQLite Memory] 🧠 Persistent Database online at ${this.dbPath}`));
  }

  // --- Active Position Crash Recovery & Persistence ---

  public async saveActivePosition(position: Position): Promise<void> {
    if (!this.db) return;
    await this.db.run(
      `INSERT OR REPLACE INTO active_positions (
        mint, symbol, name, strategy, tags, entry_price_sol, current_price_sol,
        token_amount, original_token_amount, invested_sol, highest_price_sol,
        buy_timestamp, pnl_percent, pnl_sol, tp1_triggered, tp2_triggered,
        status, close_reason, tx_signature, bonding_curve_progress, ai_confidence, ai_reasoning
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        position.mint,
        position.symbol,
        position.name,
        position.strategy || 'SNIPER',
        (position.tags || []).join(','),
        position.entryPriceSol,
        position.currentPriceSol,
        position.tokenAmount,
        position.originalTokenAmount,
        position.investedSol,
        position.highestPriceSol,
        position.buyTimestamp,
        position.pnlPercent,
        position.pnlSol,
        position.tp1Triggered ? 1 : 0,
        position.tp2Triggered ? 1 : 0,
        position.status,
        position.closeReason || null,
        position.txSignature || null,
        position.bondingCurveProgress || 0,
        position.aiConfidence || null,
        position.aiReasoning || null
      ]
    );
  }

  public async removeActivePosition(mint: string): Promise<void> {
    if (!this.db) return;
    await this.db.run(`DELETE FROM active_positions WHERE mint = ?`, [mint]);
  }

  public async loadActivePositions(): Promise<Position[]> {
    if (!this.db) return [];
    const rows = await this.db.all(`SELECT * FROM active_positions WHERE status = 'OPEN'`);
    return rows.map(r => ({
      mint: r.mint,
      symbol: r.symbol,
      name: r.name,
      strategy: r.strategy,
      tags: r.tags ? r.tags.split(',') : [],
      entryPriceSol: r.entry_price_sol,
      currentPriceSol: r.current_price_sol,
      tokenAmount: r.token_amount,
      originalTokenAmount: r.original_token_amount,
      investedSol: r.invested_sol,
      highestPriceSol: r.highest_price_sol,
      buyTimestamp: r.buy_timestamp,
      pnlPercent: r.pnl_percent,
      pnlSol: r.pnl_sol,
      tp1Triggered: Boolean(r.tp1_triggered),
      tp2Triggered: Boolean(r.tp2_triggered),
      status: 'OPEN',
      closeReason: r.close_reason,
      txSignature: r.tx_signature,
      bondingCurveProgress: r.bonding_curve_progress,
      aiConfidence: r.ai_confidence,
      aiReasoning: r.ai_reasoning
    }));
  }

  // --- Key-Value State Persistence ---

  public async saveState(key: string, value: any): Promise<void> {
    if (!this.db) return;
    await this.db.run(
      `INSERT OR REPLACE INTO agent_state (key, value) VALUES (?, ?)`,
      [key, JSON.stringify(value)]
    );
  }

  public async loadState<T>(key: string, defaultValue: T): Promise<T> {
    if (!this.db) return defaultValue;
    const row = await this.db.get(`SELECT value FROM agent_state WHERE key = ?`, [key]);
    if (!row || !row.value) return defaultValue;
    try {
      return JSON.parse(row.value) as T;
    } catch {
      return defaultValue;
    }
  }

  // --- Vault Cycles & Profit Bankroll Storage ---

  public async recordVaultCycle(cycleNumber: number, amountVaultedSol: number, totalVaultedSol: number, txSignature?: string): Promise<void> {
    if (!this.db) return;
    await this.db.run(
      `INSERT INTO vault_cycles (cycle_number, amount_vaulted_sol, total_vaulted_sol, tx_signature, timestamp)
       VALUES (?, ?, ?, ?, ?)`,
      [cycleNumber, amountVaultedSol, totalVaultedSol, txSignature || null, Date.now()]
    );
  }

  public async getVaultCycles(): Promise<VaultCycle[]> {
    if (!this.db) return [];
    const rows = await this.db.all(`SELECT * FROM vault_cycles ORDER BY timestamp DESC`);
    return rows.map(r => ({
      id: r.id,
      cycleNumber: r.cycle_number,
      amountVaultedSol: r.amount_vaulted_sol,
      totalVaultedSol: r.total_vaulted_sol,
      timestamp: r.timestamp,
      txSignature: r.tx_signature
    }));
  }

  // --- Trade History & Dev Memory ---

  public async recordTrade(trade: DBTrade): Promise<void> {
    if (!this.db) return;
    await this.db.run(
      `INSERT OR REPLACE INTO trades (
        id, mint, symbol, name, strategy, entry_price, exit_price,
        invested_sol, returned_sol, pnl_sol, pnl_percent, reason,
        ai_confidence, ai_reasoning, hold_seconds, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        trade.id,
        trade.mint,
        trade.symbol,
        trade.name,
        trade.strategy,
        trade.entryPriceSol,
        trade.exitPriceSol,
        trade.investedSol,
        trade.returnedSol,
        trade.pnlSol,
        trade.pnlPercent,
        trade.reason,
        trade.aiConfidence || null,
        trade.aiReasoning || null,
        trade.holdSeconds,
        trade.timestamp
      ]
    );
  }

  public async updateDevReputation(devPubkey: string, isProfitable: boolean, isRug: boolean): Promise<void> {
    if (!this.db || !devPubkey) return;
    const now = Date.now();
    const existing = await this.db.get(`SELECT * FROM dev_memory WHERE dev_pubkey = ?`, [devPubkey]);

    if (existing) {
      await this.db.run(
        `UPDATE dev_memory SET
          total_tokens_created = total_tokens_created + 1,
          profitable_tokens = profitable_tokens + ?,
          rugged_tokens = rugged_tokens + ?,
          last_seen = ?
        WHERE dev_pubkey = ?`,
        [isProfitable ? 1 : 0, isRug ? 1 : 0, now, devPubkey]
      );
    } else {
      await this.db.run(
        `INSERT INTO dev_memory (dev_pubkey, total_tokens_created, profitable_tokens, rugged_tokens, last_seen)
         VALUES (?, 1, ?, ?, ?)`,
        [devPubkey, isProfitable ? 1 : 0, isRug ? 1 : 0, now]
      );
    }
  }

  public async getDevReputation(devPubkey: string): Promise<DevReputation> {
    if (!this.db || !devPubkey) {
      return {
        devPubkey,
        totalTokensCreated: 0,
        profitableTokens: 0,
        ruggedTokens: 0,
        rugRate: 0,
        reputationScore: 50,
        isBlacklisted: false
      };
    }

    const row = await this.db.get(`SELECT * FROM dev_memory WHERE dev_pubkey = ?`, [devPubkey]);
    if (!row) {
      return {
        devPubkey,
        totalTokensCreated: 0,
        profitableTokens: 0,
        ruggedTokens: 0,
        rugRate: 0,
        reputationScore: 50,
        isBlacklisted: false
      };
    }

    const total = row.total_tokens_created || 1;
    const rugs = row.rugged_tokens || 0;
    const profits = row.profitable_tokens || 0;
    const rugRate = rugs / total;

    let score = 50 + (profits * 15) - (rugs * 25);
    score = Math.max(0, Math.min(100, score));

    return {
      devPubkey,
      totalTokensCreated: total,
      profitableTokens: profits,
      ruggedTokens: rugs,
      rugRate,
      reputationScore: score,
      isBlacklisted: rugs >= 3 && rugRate >= 0.75
    };
  }

  public async recordAIDecision(
    mint: string,
    symbol: string,
    decision: string,
    confidence: number,
    reasoning: string,
    tags: string[] = []
  ): Promise<void> {
    if (!this.db) return;
    await this.db.run(
      `INSERT INTO ai_decisions (mint, symbol, decision, confidence, reasoning, tags, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [mint, symbol, decision, confidence, reasoning, tags.join(','), Date.now()]
    );
  }

  public async getRecentSuccessfulPatterns(limit: number = 5): Promise<{ tag: string; wins: number; pnl: number }[]> {
    if (!this.db) return [];
    try {
      const rows = await this.db.all(
        `SELECT tags, pnl_sol FROM trades WHERE pnl_sol > 0 ORDER BY timestamp DESC LIMIT ?`,
        [limit * 2]
      );
      const tagStats: Record<string, { wins: number; pnl: number }> = {};
      for (const r of rows) {
        if (r.tags) {
          const tags = r.tags.split(',');
          for (const t of tags) {
            const clean = t.trim();
            if (!clean) continue;
            if (!tagStats[clean]) tagStats[clean] = { wins: 0, pnl: 0 };
            tagStats[clean].wins++;
            tagStats[clean].pnl += r.pnl_sol;
          }
        }
      }
      return Object.entries(tagStats)
        .map(([tag, stat]) => ({ tag, wins: stat.wins, pnl: stat.pnl }))
        .sort((a, b) => b.pnl - a.pnl)
        .slice(0, limit);
    } catch {
      return [];
    }
  }

  public async getAllTrades(): Promise<DBTrade[]> {
    if (!this.db) return [];
    const rows = await this.db.all(`SELECT * FROM trades ORDER BY timestamp DESC`);
    return rows.map(r => ({
      id: r.id,
      mint: r.mint,
      symbol: r.symbol,
      name: r.name,
      strategy: r.strategy,
      entryPriceSol: r.entry_price,
      exitPriceSol: r.exit_price,
      investedSol: r.invested_sol,
      returnedSol: r.returned_sol,
      pnlSol: r.pnl_sol,
      pnlPercent: r.pnl_percent,
      reason: r.reason,
      aiConfidence: r.ai_confidence,
      aiReasoning: r.ai_reasoning,
      holdSeconds: r.hold_seconds,
      timestamp: r.timestamp
    }));
  }
}
