import { Connection } from '@solana/web3.js';
import chalk from 'chalk';

export interface RpcNode {
  url: string;
  latencyMs: number;
  emaLatencyMs: number;
  isHealthy: boolean;
  errorCount: number;
  connection: Connection;
}

export class RpcFailoverManager {
  private nodes: RpcNode[] = [];
  private activeIndex: number = 0;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(primaryRpcUrl: string, fallbackUrls: string[] = []) {
    const allUrls = [primaryRpcUrl, ...fallbackUrls, 'https://api.mainnet-beta.solana.com'];
    const unique = Array.from(new Set(allUrls.filter(u => u && u.startsWith('http'))));

    this.nodes = unique.map(url => ({
      url,
      latencyMs: 999,
      emaLatencyMs: 999,
      isHealthy: true,
      errorCount: 0,
      connection: new Connection(url, 'confirmed')
    }));

    this.startHealthCheck();
  }

  public getActiveConnection(): Connection {
    const activeNode = this.nodes[this.activeIndex] || this.nodes[0];
    return activeNode.connection;
  }

  public getActiveUrl(): string {
    return this.nodes[this.activeIndex]?.url || this.nodes[0].url;
  }

  public markError(): void {
    if (this.nodes[this.activeIndex]) {
      this.nodes[this.activeIndex].errorCount++;
      if (this.nodes[this.activeIndex].errorCount >= 3) {
        this.nodes[this.activeIndex].isHealthy = false;
        this.failoverToNextHealthy();
      }
    }
  }

  private onFailoverCallback?: (node: RpcNode) => void;

  public setOnFailover(callback: (node: RpcNode) => void): void {
    this.onFailoverCallback = callback;
  }

  private failoverToNextHealthy(): void {
    const nextIndex = this.nodes.findIndex(n => n.isHealthy);
    if (nextIndex !== -1 && nextIndex !== this.activeIndex) {
      console.log(
        chalk.yellow.bold(
          `\n[RPC Failover] ⚡ RPC Latency/RateLimit trigger. Swapping connection: ${this.nodes[this.activeIndex].url} ➔ ${this.nodes[nextIndex].url}\n`
        )
      );
      this.activeIndex = nextIndex;
      this.onFailoverCallback?.(this.nodes[this.activeIndex]);
    }
  }

  private async checkNode(node: RpcNode): Promise<void> {
    const start = Date.now();
    try {
      await node.connection.getSlot();
      const instantLatency = Date.now() - start;
      node.latencyMs = instantLatency;
      node.emaLatencyMs = Number((instantLatency * 0.4 + node.emaLatencyMs * 0.6).toFixed(0));

      const wasUnhealthy = !node.isHealthy;
      node.isHealthy = true;
      node.errorCount = 0;

      if (wasUnhealthy) {
        console.log(chalk.green(`[RPC Failover] 🟢 RPC Node Recovered: ${node.url} (${node.emaLatencyMs}ms)`));
      }
    } catch {
      node.latencyMs = 9999;
      node.errorCount++;
      if (node.errorCount >= 2) node.isHealthy = false;
    }
  }

  public async raceFastestNode(): Promise<void> {
    await Promise.all(this.nodes.map(n => this.checkNode(n)));
    const healthyNodes = this.nodes
      .map((n, idx) => ({ ...n, idx }))
      .filter(n => n.isHealthy)
      .sort((a, b) => a.emaLatencyMs - b.emaLatencyMs);

    if (healthyNodes.length > 0 && healthyNodes[0].idx !== this.activeIndex) {
      this.activeIndex = healthyNodes[0].idx;
    }
  }

  private startHealthCheck(): void {
    this.raceFastestNode();
    this.checkInterval = setInterval(() => {
      this.raceFastestNode();
    }, 25000);
  }

  public stop(): void {
    if (this.checkInterval) clearInterval(this.checkInterval);
  }
}
