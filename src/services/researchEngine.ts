import axios from 'axios';
import chalk from 'chalk';
import { TokenCreationEvent } from '../types';

export type TokenCategory = 'TECH_AI' | 'VIRAL_MEME' | 'POLITICAL' | 'GAMING' | 'UTILITY' | 'UNKNOWN';

export interface ResearchReport {
  mint: string;
  symbol: string;
  name: string;
  category: TokenCategory;
  researchScore: number; // 0 to 100
  summary: string;
  narrativeTags: string[];
  hasWebsite: boolean;
  hasTwitter: boolean;
  hasTelegram: boolean;
  hasGithubOrDocs: boolean;
  metaDescription?: string;
  categoryMomentumScore: number;
  verdict: 'STRONG_BUY' | 'SPECULATIVE_BUY' | 'NEUTRAL' | 'AVOID';
}

export class ResearchEngine {
  private static readonly IPFS_GATEWAYS = [
    'https://ipfs.io/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://gateway.pinata.cloud/ipfs/'
  ];

  private static readonly TECH_KEYWORDS = [
    'ai', 'agent', 'bot', 'llm', 'neural', 'compute', 'depin', 'autonomous',
    'python', 'api', 'framework', 'model', 'swarm', 'code', 'tech', 'robot',
    'terminal', 'claude', 'gpt', 'deepseek', 'solana-agent', 'mcp', 'sdk',
    'quantum', 'cuda', 'gpu', 'algo', 'node', 'protocol', 'indexer'
  ];

  private static readonly MEME_KEYWORDS = [
    'pepe', 'doge', 'cat', 'wojak', 'chad', 'giga', 'based', 'moon', 'cult',
    'shib', 'inu', 'bonk', 'wif', 'popcat', 'goat', 'fart', 'brainrot',
    'pnut', 'chill', 'moodeng', 'kermit', 'frog', 'smudge'
  ];

  private static readonly POLITICAL_KEYWORDS = [
    'trump', 'elon', 'maga', 'election', 'doge', 'vivek', 'whitehouse',
    'kamala', 'biden', 'putin', 'fed', 'powell', 'sec', 'gensler'
  ];

  private static readonly GAMING_KEYWORDS = [
    'game', 'play', 'quest', 'arcade', 'vr', 'metaverse', 'rpg', 'pvp',
    'nft', 'steam', 'unreal', 'unity', 'pixel', 'craft'
  ];

  // Sector Performance Memory
  private sectorStats: Record<TokenCategory, { totalEvaluated: number; totalWins: number; totalPnlSol: number }> = {
    TECH_AI: { totalEvaluated: 0, totalWins: 0, totalPnlSol: 0 },
    VIRAL_MEME: { totalEvaluated: 0, totalWins: 0, totalPnlSol: 0 },
    POLITICAL: { totalEvaluated: 0, totalWins: 0, totalPnlSol: 0 },
    GAMING: { totalEvaluated: 0, totalWins: 0, totalPnlSol: 0 },
    UTILITY: { totalEvaluated: 0, totalWins: 0, totalPnlSol: 0 },
    UNKNOWN: { totalEvaluated: 0, totalWins: 0, totalPnlSol: 0 }
  };

  /**
   * Deep research on a token: analyzes metadata URI with multi-gateway racing, categorizes narrative, checks tech docs/socials
   */
  public async conductResearch(token: TokenCreationEvent): Promise<ResearchReport> {
    let metaDescription = '';
    let hasGithubOrDocs = false;

    // 1. Fetch IPFS / Arweave Metadata with Multi-Gateway Racing
    if (token.uri && (token.uri.startsWith('http') || token.uri.startsWith('ipfs://'))) {
      const cid = token.uri.replace('ipfs://', '').replace(/https?:\/\/[^\/]+\/ipfs\//, '');
      
      const fetchPromises = ResearchEngine.IPFS_GATEWAYS.map(gateway =>
        axios.get(`${gateway}${cid}`, { timeout: 2500 })
      );

      try {
        const res = await Promise.any(fetchPromises);
        if (res.data) {
          metaDescription = res.data.description || '';
          const fullText = JSON.stringify(res.data).toLowerCase();
          hasGithubOrDocs = fullText.includes('github.com') || fullText.includes('gitbook.io') || fullText.includes('docs.') || fullText.includes('whitepaper');
        }
      } catch {
        // Fallback gracefully if all gateways fail/timeout
      }
    }

    const combinedText = `${token.name} ${token.symbol} ${metaDescription} ${token.website || ''}`.toLowerCase();

    // 2. Classify Token Narrative Category
    const category = this.classifyCategory(combinedText);
    const tags: string[] = [category];

    // 3. Score Token Research Metrics
    let score = 40; // baseline

    const hasTwitter = Boolean(token.twitter && token.twitter.length > 3);
    const hasTelegram = Boolean(token.telegram && token.telegram.length > 3);
    const hasWebsite = Boolean(token.website && token.website.length > 3);

    if (hasWebsite) { score += 15; tags.push('Website'); }
    if (hasTwitter) { score += 10; tags.push('Twitter/X'); }
    if (hasTelegram) { score += 10; tags.push('Telegram'); }
    if (hasGithubOrDocs) { score += 25; tags.push('Tech Docs/GitHub'); }

    // Dev Initial Buy skin-in-the-game bonus
    const devBuySol = token.initialBuy > 1e6 ? token.initialBuy / 1e9 : token.initialBuy;
    if (devBuySol >= 0.5 && devBuySol <= 2.5) {
      score += 15;
      tags.push('Skin-in-the-game');
    } else if (devBuySol > 5.0) {
      score -= 20;
      tags.push('High Dev Concentration');
    }

    // Historical sector performance multiplier
    const sector = this.sectorStats[category];
    let categoryMomentumScore = 50;
    if (sector && sector.totalEvaluated >= 3) {
      const winRate = (sector.totalWins / sector.totalEvaluated) * 100;
      categoryMomentumScore = winRate;
      if (winRate >= 70) score += 10;
      else if (winRate < 40) score -= 10;
    }

    const finalScore = Math.min(100, Math.max(0, score));

    let verdict: 'STRONG_BUY' | 'SPECULATIVE_BUY' | 'NEUTRAL' | 'AVOID' = 'NEUTRAL';
    if (finalScore >= 80) verdict = 'STRONG_BUY';
    else if (finalScore >= 65) verdict = 'SPECULATIVE_BUY';
    else if (finalScore < 45) verdict = 'AVOID';

    return {
      mint: token.mint,
      symbol: token.symbol,
      name: token.name,
      category,
      researchScore: finalScore,
      summary: `[${category}] Research score: ${finalScore}/100. Docs: ${hasGithubOrDocs}, Socials: ${hasTwitter || hasTelegram}.`,
      narrativeTags: tags,
      hasWebsite,
      hasTwitter,
      hasTelegram,
      hasGithubOrDocs,
      metaDescription,
      categoryMomentumScore,
      verdict
    };
  }

  private classifyCategory(text: string): TokenCategory {
    let techCount = 0;
    let memeCount = 0;
    let poliCount = 0;
    let gameCount = 0;

    for (const kw of ResearchEngine.TECH_KEYWORDS) {
      if (text.includes(kw)) techCount++;
    }
    for (const kw of ResearchEngine.MEME_KEYWORDS) {
      if (text.includes(kw)) memeCount++;
    }
    for (const kw of ResearchEngine.POLITICAL_KEYWORDS) {
      if (text.includes(kw)) poliCount++;
    }
    for (const kw of ResearchEngine.GAMING_KEYWORDS) {
      if (text.includes(kw)) gameCount++;
    }

    if (techCount >= 2 || (techCount > memeCount && techCount > poliCount)) return 'TECH_AI';
    if (poliCount >= 2) return 'POLITICAL';
    if (gameCount >= 2) return 'GAMING';
    if (memeCount >= 1) return 'VIRAL_MEME';

    return 'TECH_AI'; // Default meta
  }

  public recordSectorOutcome(category: TokenCategory, isWin: boolean, pnlSol: number): void {
    if (!this.sectorStats[category]) {
      this.sectorStats[category] = { totalEvaluated: 0, totalWins: 0, totalPnlSol: 0 };
    }
    this.sectorStats[category].totalEvaluated++;
    if (isWin) this.sectorStats[category].totalWins++;
    this.sectorStats[category].totalPnlSol += pnlSol;
  }

  public getSectorSummary(): Record<string, { evaluated: number; winRate: number; pnlSol: number }> {
    const summary: Record<string, { evaluated: number; winRate: number; pnlSol: number }> = {};
    for (const [cat, data] of Object.entries(this.sectorStats)) {
      const winRate = data.totalEvaluated > 0 ? (data.totalWins / data.totalEvaluated) * 100 : 0;
      summary[cat] = {
        evaluated: data.totalEvaluated,
        winRate: Number(winRate.toFixed(1)),
        pnlSol: Number(data.totalPnlSol.toFixed(3))
      };
    }
    return summary;
  }
}
