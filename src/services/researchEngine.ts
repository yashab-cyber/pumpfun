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
  private static readonly TECH_KEYWORDS = [
    'ai', 'agent', 'bot', 'llm', 'neural', 'compute', 'depin', 'autonomous',
    'python', 'api', 'framework', 'model', 'swarm', 'code', 'tech', 'robot',
    'terminal', 'claude', 'gpt', 'deepseek', 'solana-agent', 'mcp', 'sdk',
    'quantum', 'cuda', 'gpu', 'algo', 'node', 'protocol', 'indexer'
  ];

  private static readonly MEME_KEYWORDS = [
    'pepe', 'doge', 'cat', 'wojak', 'chad', 'giga', 'based', 'moon', 'cult',
    'shib', 'inu', 'bonk', 'wif', 'popcat', 'goat', 'fart', 'brainrot',
    'pnut', 'chill', 'moodeng', 'retard', 'kermit', 'frog', 'smudge'
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
   * Deep research on a token: analyzes metadata URI, categorizes narrative, checks tech docs/socials
   */
  public async conductResearch(token: TokenCreationEvent): Promise<ResearchReport> {
    let metaDescription = '';
    let hasGithubOrDocs = false;

    // 1. Fetch IPFS / Arweave Metadata if available
    if (token.uri && (token.uri.startsWith('http') || token.uri.startsWith('ipfs://'))) {
      try {
        const httpUrl = token.uri.startsWith('ipfs://')
          ? `https://ipfs.io/ipfs/${token.uri.replace('ipfs://', '')}`
          : token.uri;

        const res = await axios.get(httpUrl, { timeout: 3000 });
        if (res.data) {
          metaDescription = res.data.description || '';
          const fullText = JSON.stringify(res.data).toLowerCase();
          hasGithubOrDocs = fullText.includes('github.com') || fullText.includes('gitbook.io') || fullText.includes('docs.') || fullText.includes('whitepaper');
        }
      } catch {
        // Fallback gracefully if IPFS gateway is slow
      }
    }

    const combinedText = `${token.name} ${token.symbol} ${metaDescription} ${token.website || ''}`.toLowerCase();

    // 2. Classify Token Narrative Category
    const category = this.classifyCategory(combinedText);
    const tags: string[] = [category];

    // 3. Score Token Research Metrics
    let score = 40; // baseline

    // Social & Tech Documentation checks
    const hasTwitter = Boolean(token.twitter && token.twitter.length > 3);
    const hasTelegram = Boolean(token.telegram && token.telegram.length > 3);
    const hasWebsite = Boolean(token.website && token.website.length > 3);

    if (hasWebsite) { score += 15; tags.push('Website'); }
    if (hasTwitter) { score += 10; tags.push('Twitter/X'); }
    if (hasTelegram) { score += 10; tags.push('Telegram'); }
    if (hasGithubOrDocs) { score += 20; tags.push('Tech Docs/GitHub'); }

    // Dev Initial Buy Quality
    const devBuy = token.initialBuy > 1e6 ? token.initialBuy / 1e9 : token.initialBuy;
    if (devBuy >= 0.2 && devBuy <= 2.5) {
      score += 15; // Optimal skin-in-the-game
      tags.push('Optimal Dev Buy');
    }

    // Category Specific Bonuses
    if (category === 'TECH_AI') {
      score += 10; // Tech/AI narrative premium
      tags.push('AI Agent Meta');
    } else if (category === 'VIRAL_MEME') {
      score += 5;
      tags.push('Viral Meme Meta');
    }

    const finalScore = Math.min(100, Math.max(0, score));

    let verdict: 'STRONG_BUY' | 'SPECULATIVE_BUY' | 'NEUTRAL' | 'AVOID' = 'NEUTRAL';
    if (finalScore >= 75) verdict = 'STRONG_BUY';
    else if (finalScore >= 55) verdict = 'SPECULATIVE_BUY';
    else if (finalScore < 35) verdict = 'AVOID';

    const report: ResearchReport = {
      mint: token.mint,
      symbol: token.symbol,
      name: token.name,
      category,
      researchScore: finalScore,
      summary: `${category} narrative scored ${finalScore}/100. ${tags.join(', ')}.`,
      narrativeTags: tags,
      hasWebsite,
      hasTwitter,
      hasTelegram,
      hasGithubOrDocs,
      metaDescription: metaDescription.substring(0, 150),
      categoryMomentumScore: this.getCategoryMomentum(category),
      verdict
    };

    this.sectorStats[category].totalEvaluated++;
    return report;
  }

  private classifyCategory(text: string): TokenCategory {
    let techHits = 0;
    let memeHits = 0;
    let politicalHits = 0;
    let gamingHits = 0;

    for (const k of ResearchEngine.TECH_KEYWORDS) { if (text.includes(k)) techHits++; }
    for (const k of ResearchEngine.MEME_KEYWORDS) { if (text.includes(k)) memeHits++; }
    for (const k of ResearchEngine.POLITICAL_KEYWORDS) { if (text.includes(k)) politicalHits++; }
    for (const k of ResearchEngine.GAMING_KEYWORDS) { if (text.includes(k)) gamingHits++; }

    if (techHits >= 1 && techHits >= memeHits && techHits >= politicalHits) return 'TECH_AI';
    if (politicalHits >= 1 && politicalHits >= memeHits) return 'POLITICAL';
    if (gamingHits >= 1 && gamingHits >= memeHits) return 'GAMING';
    if (memeHits >= 1) return 'VIRAL_MEME';

    return text.includes('app') || text.includes('tool') || text.includes('swap') ? 'UTILITY' : 'VIRAL_MEME';
  }

  public recordSectorOutcome(category: TokenCategory, isWin: boolean, pnlSol: number): void {
    if (this.sectorStats[category]) {
      if (isWin) this.sectorStats[category].totalWins++;
      this.sectorStats[category].totalPnlSol += pnlSol;
    }
  }

  public getCategoryMomentum(category: TokenCategory): number {
    const s = this.sectorStats[category];
    if (!s || s.totalEvaluated === 0) return 50;
    const winRate = (s.totalWins / s.totalEvaluated) * 100;
    return Math.min(100, Math.max(0, Math.floor(winRate + (s.totalPnlSol * 10))));
  }

  public getSectorSummary(): Record<TokenCategory, { evaluated: number; winRate: number; pnlSol: number }> {
    const result: any = {};
    for (const [cat, s] of Object.entries(this.sectorStats)) {
      const winRate = s.totalEvaluated > 0 ? (s.totalWins / s.totalEvaluated) * 100 : 0;
      result[cat] = {
        evaluated: s.totalEvaluated,
        winRate: Math.round(winRate),
        pnlSol: s.totalPnlSol
      };
    }
    return result;
  }
}
