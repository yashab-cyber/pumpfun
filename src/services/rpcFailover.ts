import { Connection } from '@solana/web3.js';
import chalk from 'chalk';

export interface RpcNode {
  url: string;
  latencyMs: number;
  isHealthy: boolean;
  errorCount: number;
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
      isHealthy: true,
      errorCount: 0
    }));

    this.startHealthCheck();
  }

  public getActiveConnection(): Connection {
    const activeNode = this.nodes[this.activeIndex] || this.nodes[0];
    return new Connection(activeNode.url, 'confirmed');
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

  private failoverToNextHealthy(): void {
    const nextIndex = this.nodes.findIndex(n => n.isHealthy);
    if (nextIndex !== -1 && nextIndex !== this.activeIndex) {
      console.log(
        chalk.yellow.bold(
          `\n[RPC Failover] ⚡ RPC Latency/RateLimit trigger. Swapping connection: ${this.nodes[this.activeIndex].url} ➔ ${this.nodes[nextIndex].url}\n`
        )
      );
      this.activeIndex = nextIndex;
    }
  }

  private async checkNode(node: RpcNode): Promise<void> {
    const start = Date.now();
    try {
      const conn = new Connection(node.url, 'confirmed');
      await conn.getSlot();
      node.latencyMs = Date.now() - start;
      node.isHealthy = true;
      node.errorCount = 0;
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
      .sort((a, b) => a.latencyMs - b.latencyMs);

    if (healthyNodes.length > 0 && healthyNodes[0].idx !== this.activeIndex) {
      this.activeIndex = healthyNodes[0].idx;
    }
  }

  private startHealthCheck(): void {
    this.raceFastestNode();
    this.checkInterval = setInterval(() => {
      this.raceFastestNode();
    }, 30000);
  }

  public stop(): void {
    if (this.checkInterval) clearInterval(this.checkInterval);
  }
}
