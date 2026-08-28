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

    // Enable high-performance concurrency pragmas
    await this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA cache_size = -64000;
    `);

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

    console.log(chalk.green(`[SQLite Memory] 🧠 Persistent Database online (WAL Mode) at ${this.dbPath}`));
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
    const rows = await this.db.all<any[]>(`SELECT * FROM active_positions WHERE status = 'OPEN'`);
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
      status: r.status,
      closeReason: r.close_reason,
      txSignature: r.tx_signature,
      bondingCurveProgress: r.bonding_curve_progress,
      aiConfidence: r.ai_confidence,
      aiReasoning: r.ai_reasoning
    }));
  }

  // --- Trade Recording & Pattern Learning ---

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

  public async getAllTrades(): Promise<DBTrade[]> {
    if (!this.db) return [];
    const rows = await this.db.all<any[]>(`SELECT * FROM trades ORDER BY timestamp DESC`);
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

  public async getRecentSuccessfulPatterns(limit: number = 5): Promise<{ tag: string; pnl: number }[]> {
    if (!this.db) return [];
    const rows = await this.db.all<any[]>(
      `SELECT t.reason, t.pnl_sol, d.tags
       FROM trades t
       LEFT JOIN ai_decisions d ON t.mint = d.mint
       WHERE t.pnl_sol > 0
       ORDER BY t.timestamp DESC LIMIT ?`,
      [limit]
    );
    const patterns: { tag: string; pnl: number }[] = [];
    for (const r of rows) {
      if (r.tags) {
        for (const tag of r.tags.split(',')) {
          patterns.push({ tag: tag.trim(), pnl: r.pnl_sol });
        }
      }
    }
    return patterns;
  }

  // --- Developer Reputation & Rug Memory ---

  public async updateDevReputation(devPubkey: string, isWin: boolean, isRug: boolean): Promise<void> {
    if (!this.db || !devPubkey) return;

    const existing = await this.db.get<any>(
      `SELECT * FROM dev_memory WHERE dev_pubkey = ?`,
      [devPubkey]
    );

    const now = Date.now();
    if (existing) {
      const total = existing.total_tokens_created + 1;
      const profitable = existing.profitable_tokens + (isWin ? 1 : 0);
      const rugged = existing.rugged_tokens + (isRug ? 1 : 0);

      await this.db.run(
        `UPDATE dev_memory SET
          total_tokens_created = ?,
          profitable_tokens = ?,
          rugged_tokens = ?,
          last_seen = ?
        WHERE dev_pubkey = ?`,
        [total, profitable, rugged, now, devPubkey]
      );
    } else {
      await this.db.run(
        `INSERT INTO dev_memory (
          dev_pubkey, total_tokens_created, profitable_tokens, rugged_tokens, last_seen
        ) VALUES (?, 1, ?, ?, ?)`,
        [devPubkey, isWin ? 1 : 0, isRug ? 1 : 0, now]
      );
    }
  }

  public async getDevReputation(devPubkey: string): Promise<DevReputation> {
    if (!this.db || !devPubkey) {
      return {
        devPubkey: devPubkey || 'UNKNOWN',
        totalTokensCreated: 0,
        profitableTokens: 0,
        ruggedTokens: 0,
        rugRate: 0,
        reputationScore: 50,
        isBlacklisted: false
      };
    }

    const row = await this.db.get<any>(
      `SELECT * FROM dev_memory WHERE dev_pubkey = ?`,
      [devPubkey]
    );

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
    const rugged = row.rugged_tokens || 0;
    const profitable = row.profitable_tokens || 0;
    const rugRate = rugged / total;

    // Reputation Score: 0 to 100
    let score = 50 + (profitable * 15) - (rugged * 30);
    score = Math.min(100, Math.max(0, score));

    const isBlacklisted = rugRate > 0.60 && total >= 2;

    return {
      devPubkey,
      totalTokensCreated: total,
      profitableTokens: profitable,
      ruggedTokens: rugged,
      rugRate,
      reputationScore: score,
      isBlacklisted
    };
  }

  // --- AI Decision Logging ---

  public async recordAIDecision(
    mint: string,
    symbol: string,
    decision: 'BUY' | 'SKIP',
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

  // --- Profit Vault Cycle Records ---

  public async recordVaultCycle(
    cycleNumber: number,
    amountVaultedSol: number,
    totalVaultedSol: number,
    txSignature?: string
  ): Promise<void> {
    if (!this.db) return;
    await this.db.run(
      `INSERT INTO vault_cycles (cycle_number, amount_vaulted_sol, total_vaulted_sol, tx_signature, timestamp)
       VALUES (?, ?, ?, ?, ?)`,
      [cycleNumber, amountVaultedSol, totalVaultedSol, txSignature || null, Date.now()]
    );
  }

  public async getVaultCycles(): Promise<VaultCycle[]> {
    if (!this.db) return [];
    const rows = await this.db.all<any[]>(`SELECT * FROM vault_cycles ORDER BY cycle_number DESC`);
    return rows.map(r => ({
      id: r.id,
      cycleNumber: r.cycle_number,
      amountVaultedSol: r.amount_vaulted_sol,
      totalVaultedSol: r.total_vaulted_sol,
      txSignature: r.tx_signature,
      timestamp: r.timestamp
    }));
  }

  // --- Generic Key-Value State Store ---

  public async saveState<T>(key: string, value: T): Promise<void> {
    if (!this.db) return;
    await this.db.run(
      `INSERT OR REPLACE INTO agent_state (key, value) VALUES (?, ?)`,
      [key, JSON.stringify(value)]
    );
  }

  public async loadState<T>(key: string, defaultValue: T): Promise<T> {
    if (!this.db) return defaultValue;
    const row = await this.db.get<any>(`SELECT value FROM agent_state WHERE key = ?`, [key]);
    if (row && row.value) {
      try {
        return JSON.parse(row.value) as T;
      } catch {
        return defaultValue;
      }
    }
    return defaultValue;
  }
}
