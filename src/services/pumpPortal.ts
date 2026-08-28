import WebSocket from 'ws';
import axios from 'axios';
import chalk from 'chalk';
import { VersionedTransaction } from '@solana/web3.js';
import { SolanaService } from './solana';
import { TokenCreationEvent, TradeEvent } from '../types';

export class PumpPortalService {
  private wsUrl: string = 'wss://pumpportal.fun/api/data';
  private apiUrl: string = 'https://pumpportal.fun/api/trade-local';
  private ws: WebSocket | null = null;
  private isConnected: boolean = false;
  private reconnectInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private activeSubscriptions: Set<string> = new Set();

  private onNewTokenCallback?: (token: TokenCreationEvent) => void;
  private onTokenTradeCallback?: (trade: TradeEvent) => void;

  constructor(private solanaService: SolanaService) {}

  public connect(
    onNewToken: (token: TokenCreationEvent) => void,
    onTokenTrade: (trade: TradeEvent) => void
  ): void {
    this.onNewTokenCallback = onNewToken;
    this.onTokenTradeCallback = onTokenTrade;
    this.initWebSocket();
  }

  private initWebSocket(): void {
    console.log(chalk.cyan(`[PumpPortal] Connecting to WebSocket: ${this.wsUrl}...`));
    this.ws = new WebSocket(this.wsUrl);

    this.ws.on('open', () => {
      this.isConnected = true;
      console.log(chalk.green(`[PumpPortal] Connected successfully to stream!`));

      this.subscribeNewTokens();

      if (this.activeSubscriptions.size > 0) {
        this.subscribeTokenTrades(Array.from(this.activeSubscriptions));
      }

      if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = setInterval(() => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.ping();
        }
      }, 20000);
    });

    this.ws.on('message', (data: WebSocket.RawData) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(message);
      } catch {
        // Ignore malformed frames
      }
    });

    this.ws.on('close', () => {
      this.isConnected = false;
      if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
      console.log(chalk.yellow(`[PumpPortal] WebSocket disconnected. Reconnecting in 3s...`));
      this.scheduleReconnect();
    });

    this.ws.on('error', (err: any) => {
      console.error(chalk.red(`[PumpPortal] WebSocket error: ${err.message}`));
      if (this.ws) {
        this.ws.close();
      }
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectInterval) return;
    this.reconnectInterval = setTimeout(() => {
      this.reconnectInterval = null;
      this.initWebSocket();
    }, 3000);
  }

  private handleMessage(msg: any): void {
    if (!msg) return;

    if (msg.txType === 'create' || (msg.mint && msg.name && msg.symbol && !msg.tokenAmount)) {
      const tokenEvent: TokenCreationEvent = {
        signature: msg.signature || '',
        mint: msg.mint,
        traderPublicKey: msg.traderPublicKey || '',
        txType: 'create',
        initialBuy: msg.initialBuy || msg.solAmount || 0,
        bondingCurveKey: msg.bondingCurveKey,
        vTokensInBondingCurve: msg.vTokensInBondingCurve,
        vSolInBondingCurve: msg.vSolInBondingCurve,
        marketCapSol: msg.marketCapSol,
        name: msg.name || 'Unknown',
        symbol: msg.symbol || 'UNKNOWN',
        uri: msg.uri || '',
        twitter: msg.twitter,
        telegram: msg.telegram,
        website: msg.website,
        timestamp: Date.now()
      };
      this.onNewTokenCallback?.(tokenEvent);
      return;
    }

    if (msg.txType === 'buy' || msg.txType === 'sell') {
      const tradeEvent: TradeEvent = {
        signature: msg.signature || '',
        mint: msg.mint,
        traderPublicKey: msg.traderPublicKey || '',
        txType: msg.txType,
        tokenAmount: msg.tokenAmount || 0,
        solAmount: msg.solAmount || 0,
        newTokenBalance: msg.newTokenBalance,
        bondingCurveKey: msg.bondingCurveKey,
        vTokensInBondingCurve: msg.vTokensInBondingCurve,
        vSolInBondingCurve: msg.vSolInBondingCurve,
        marketCapSol: msg.marketCapSol,
        timestamp: Date.now()
      };
      this.onTokenTradeCallback?.(tradeEvent);
      return;
    }
  }

  public subscribeNewTokens(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const payload = { method: 'subscribeNewToken' };
    this.ws.send(JSON.stringify(payload));
  }

  public subscribeTokenTrades(mints: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || mints.length === 0) return;
    for (const m of mints) {
      this.activeSubscriptions.add(m);
    }
    const payload = {
      method: 'subscribeTokenTrade',
      keys: mints
    };
    this.ws.send(JSON.stringify(payload));
  }

  public unsubscribeTokenTrades(mints: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || mints.length === 0) return;
    for (const m of mints) {
      this.activeSubscriptions.delete(m);
    }
    const payload = {
      method: 'unsubscribeTokenTrade',
      keys: mints
    };
    this.ws.send(JSON.stringify(payload));
  }

  public async executeLiveTrade(params: {
    action: 'buy' | 'sell';
    mint: string;
    amount: number;
    denominatedInSol: boolean;
    slippagePercent?: number;
    priorityFeeSol?: number;
    pool?: 'pump' | 'raydium' | 'auto';
  }): Promise<{ success: boolean; signature?: string; error?: string }> {
    const keypair = this.solanaService.getKeypair();
    if (!keypair) {
      return { success: false, error: 'No keypair configured for live trading' };
    }

    try {
      const response = await axios.post(
        this.apiUrl,
        {
          publicKey: keypair.publicKey.toBase58(),
          action: params.action,
          mint: params.mint,
          amount: params.amount,
          denominatedInSol: params.denominatedInSol.toString(),
          slippage: params.slippagePercent || 15,
          priorityFee: params.priorityFeeSol || 0.001,
          pool: params.pool || 'pump'
        },
        {
          responseType: 'arraybuffer',
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        }
      );

      if (response.status !== 200) {
        return { success: false, error: `API status ${response.status}` };
      }

      const txBuffer = Buffer.from(response.data);
      const tx = VersionedTransaction.deserialize(txBuffer);
      tx.sign([keypair]);

      const connection = this.solanaService.getConnection();
      const signature = await connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3
      });

      console.log(chalk.green(`[PumpPortal] Live ${params.action.toUpperCase()} submitted! Tx: ${signature}`));
      return { success: true, signature };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  public disconnect(): void {
    if (this.reconnectInterval) clearInterval(this.reconnectInterval);
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.ws) {
      this.ws.close();
    }
  }
}
