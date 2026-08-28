import express from 'express';
import http from 'http';
import path from 'path';
import cors from 'cors';
import { Server as SocketIOServer } from 'socket.io';
import chalk from 'chalk';
import { TradeJournal } from './db';
import { StrategyType } from '../strategies';

export class WebServer {
  private app: express.Application;
  private server: http.Server;
  private io: SocketIOServer;
  private port: number = parseInt(process.env.WEB_PORT || '3000', 10);
  private onPanicSellCallback?: () => void;
  private onSellPositionCallback?: (mint: string) => void;
  private onStrategyChangeCallback?: (strat: StrategyType) => void;
  private onConfigUpdateCallback?: (newConfig: any) => void;
  private journal?: TradeJournal;

  constructor(journal?: TradeJournal) {
    this.journal = journal;
    this.app = express();
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, '../public')));
    this.app.use(express.static(path.join(__dirname, '../../src/public')));

    this.server = http.createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: { origin: '*' }
    });

    this.setupRoutes();
    this.setupSocketEvents();
  }

  private setupRoutes(): void {
    this.app.get('/api/export-csv', (req, res) => {
      if (!this.journal) {
        return res.status(404).send('Journal not available');
      }
      const csv = this.journal.exportCsv();
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="pumpfun_trade_journal.csv"');
      res.send(csv);
    });

    this.app.get('/api/analytics', (req, res) => {
      if (!this.journal) {
        return res.json({});
      }
      res.json(this.journal.getAnalytics());
    });
  }

  private setupSocketEvents(): void {
    this.io.on('connection', (socket) => {
      socket.on('panic_sell_all', () => {
        console.log(chalk.red.bold('[WebUI] 🚨 Received PANIC SELL ALL command from web dashboard!'));
        this.onPanicSellCallback?.();
      });

      socket.on('sell_position', (data: { mint: string }) => {
        if (data && data.mint) {
          console.log(chalk.red.bold(`[WebUI] Received SELL command for mint: ${data.mint}`));
          this.onSellPositionCallback?.(data.mint);
        }
      });

      socket.on('change_strategy', (data: { strategy: StrategyType }) => {
        if (data && data.strategy) {
          console.log(chalk.cyan.bold(`[WebUI] Switching active strategy to: ${data.strategy}`));
          this.onStrategyChangeCallback?.(data.strategy);
        }
      });

      socket.on('update_config', (data: any) => {
        if (data) {
          console.log(chalk.cyan(`[WebUI] Received live configuration update`));
          this.onConfigUpdateCallback?.(data);
        }
      });
    });
  }

  public registerActionHandlers(
    onPanicSell: () => void,
    onSellPosition: (mint: string) => void,
    onStrategyChange?: (strat: StrategyType) => void,
    onConfigUpdate?: (newConfig: any) => void
  ): void {
    this.onPanicSellCallback = onPanicSell;
    this.onSellPositionCallback = onSellPosition;
    this.onStrategyChangeCallback = onStrategyChange;
    this.onConfigUpdateCallback = onConfigUpdate;
  }

  public broadcastState(data: any): void {
    this.io.emit('state_update', data);
  }

  public broadcastNewToken(token: any): void {
    this.io.emit('new_token', token);
  }

  public broadcastLog(message: string): void {
    this.io.emit('log', message);
  }

  public start(): Promise<void> {
    return new Promise((resolve) => {
      const tryListen = (portToTry: number) => {
        this.server.removeAllListeners('error');
        this.server.on('error', (err: any) => {
          if (err.code === 'EADDRINUSE') {
            console.log(chalk.yellow(`[WebUI] Port ${portToTry} in use, trying port ${portToTry + 1}...`));
            tryListen(portToTry + 1);
          } else {
            console.error(chalk.red(`[WebUI] Server error: ${err.message}`));
            resolve();
          }
        });

        this.server.listen(portToTry, () => {
          this.port = portToTry;
          console.log(chalk.green.bold(`\n[WebUI] 🌐 Web Dashboard is live at: http://localhost:${this.port}\n`));
          resolve();
        });
      };

      tryListen(this.port);
    });
  }

  public stop(): void {
    this.server.close();
  }
}
