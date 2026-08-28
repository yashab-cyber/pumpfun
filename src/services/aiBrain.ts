import axios from 'axios';
import chalk from 'chalk';
import { SQLiteMemory, DevReputation, DBTrade } from './sqliteMemory';
import { TokenCreationEvent } from '../types';
import { ResearchReport } from './researchEngine';

export type AIProvider = 'copilot' | 'anthropic' | 'gemini' | 'ollama' | 'openai' | 'openrouter' | 'builtin';

export interface AIBrainDecision {
  shouldBuy: boolean;
  confidenceScore: number;
  suggestedTpPercent: number;
  suggestedSlPercent: number;
  reasoning: string;
  riskFactors: string[];
  tags: string[];
  category: string;
  providerUsed: string;
  convictionTier?: 'SUPER_SNIPE' | 'HIGH_CONVICTION' | 'STANDARD' | 'SPECULATIVE';
}

export class AIBrain {
  private provider: AIProvider;
  private modelName: string;
  private memory: SQLiteMemory;
  private enableConsensus: boolean = false;

  constructor(memory: SQLiteMemory) {
    this.memory = memory;
    this.provider = (process.env.AI_PROVIDER || 'builtin').toLowerCase() as AIProvider;
    this.modelName = this.getDefaultModelForProvider(this.provider);
    this.enableConsensus = process.env.AI_CONSENSUS === 'true';

    console.log(chalk.magenta.bold(`[AI Brain] 🧠 QUANTUM REASONING MATRIX ONLINE | Provider: ${this.provider.toUpperCase()} (Model: ${this.modelName})`));
  }

  private getDefaultModelForProvider(provider: AIProvider): string {
    if (process.env.AI_MODEL) return process.env.AI_MODEL;
    switch (provider) {
      case 'copilot':
        return 'gpt-4o';
      case 'anthropic':
        return 'claude-3-5-haiku-20241022';
      case 'gemini':
        return 'gemini-1.5-flash';
      case 'ollama':
        return 'deepseek-r1';
      case 'openrouter':
        return 'meta-llama/llama-3.3-70b-instruct';
      case 'openai':
      default:
        return 'gpt-4o-mini';
    }
  }

  public async evaluateOpportunity(
    token: TokenCreationEvent,
    research: ResearchReport,
    strategy: string,
    bondingCurveProgress: number = 0,
    topHoldersConcentration: number = 0
  ): Promise<AIBrainDecision> {
    // 1. Fetch Developer Memory & Reputation from SQLite
    const devRep = await this.memory.getDevReputation(token.traderPublicKey);
    if (devRep.isBlacklisted) {
      return {
        shouldBuy: false,
        confidenceScore: 0,
        suggestedTpPercent: 50,
        suggestedSlPercent: -20,
        reasoning: `Dev is blacklisted in SQLite Memory (Rug rate: ${(devRep.rugRate * 100).toFixed(0)}%)`,
        riskFactors: ['Known Serial Rugger'],
        tags: ['Blacklisted Dev'],
        category: research.category,
        providerUsed: 'SQLite Memory Gatekeeper',
        convictionTier: 'SPECULATIVE'
      };
    }

    // 2. Fetch recent winning & losing patterns for Dynamic Few-Shot Learning
    const winningPatterns = await this.memory.getRecentSuccessfulPatterns(4);
    const patternTags = winningPatterns.map(p => `${p.tag} (+${p.pnl.toFixed(2)} SOL)`).join(', ');
    const allTrades: DBTrade[] = await this.memory.getAllTrades();
    const recentWins = allTrades.filter(t => t.pnlSol > 0).slice(0, 3);
    const recentLosses = allTrades.filter(t => t.pnlSol < 0).slice(0, 2);

    // 3. Route to selected AI Provider
    try {
      let decision: AIBrainDecision | null = null;
      switch (this.provider) {
        case 'copilot':
          decision = await this.queryCopilot(token, research, devRep, patternTags, strategy, bondingCurveProgress, recentWins, recentLosses);
          break;
        case 'anthropic':
          decision = await this.queryAnthropic(token, research, devRep, patternTags, strategy, bondingCurveProgress, recentWins, recentLosses);
          break;
        case 'gemini':
          decision = await this.queryGemini(token, research, devRep, patternTags, strategy, bondingCurveProgress, recentWins, recentLosses);
          break;
        case 'ollama':
          decision = await this.queryOllama(token, research, devRep, patternTags, strategy, bondingCurveProgress, recentWins, recentLosses);
          break;
        case 'openai':
          decision = await this.queryOpenAI(token, research, devRep, patternTags, strategy, bondingCurveProgress, recentWins, recentLosses);
          break;
        case 'openrouter':
          decision = await this.queryOpenRouter(token, research, devRep, patternTags, strategy, bondingCurveProgress, recentWins, recentLosses);
          break;
      }

      if (decision) {
        // Tag conviction tier
        if (decision.confidenceScore >= 90) {
          decision.convictionTier = 'SUPER_SNIPE';
        } else if (decision.confidenceScore >= 80) {
          decision.convictionTier = 'HIGH_CONVICTION';
        } else if (decision.confidenceScore >= 65) {
          decision.convictionTier = 'STANDARD';
        } else {
          decision.convictionTier = 'SPECULATIVE';
        }
        return decision;
      }
    } catch (err: any) {
      console.error(chalk.yellow(`[AI Brain] ${this.provider.toUpperCase()} query failed (${err.message}). Falling back to Neural Heuristic engine.`));
    }

    // 4. Built-in Deep Neural Heuristic Pattern Brain (Fallback or Default)
    return this.evaluateBuiltinBrain(token, research, devRep, winningPatterns, strategy, bondingCurveProgress, topHoldersConcentration);
  }

  private async queryCopilot(
    token: TokenCreationEvent,
    research: ResearchReport,
    devRep: DevReputation,
    patternTags: string,
    strategy: string,
    progress: number,
    wins: DBTrade[],
    losses: DBTrade[]
  ): Promise<AIBrainDecision> {
    const prompt = this.buildPrompt(token, research, devRep, patternTags, strategy, progress, wins, losses);
    
    let endpoint = process.env.COPILOT_URL || process.env.COPILOT_ENDPOINT || 'http://localhost:4141/v1/chat/completions';
    if (!endpoint.includes('/chat/completions')) {
      endpoint = endpoint.replace(/\/+$/, '') + '/v1/chat/completions';
    }

    const tokenKey = process.env.COPILOT_API_KEY || process.env.GITHUB_TOKEN || 'dummy-key';
    const response = await axios.post(
      endpoint,
      {
        model: this.modelName,
        messages: [
          { role: 'system', content: 'You are an elite quantitative crypto trading AI specializing in Solana memecoins and tech tokens on Pump.fun. Respond strictly in JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2
      },
      {
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenKey}` },
        timeout: 6000
      }
    );

    const rawContent = response.data?.choices?.[0]?.message?.content || '';
    return this.parseJsonResponse(rawContent, research.narrativeTags, research.category, `Copilot (${this.modelName})`);
  }

  private async queryAnthropic(
    token: TokenCreationEvent,
    research: ResearchReport,
    devRep: DevReputation,
    patternTags: string,
    strategy: string,
    progress: number,
    wins: DBTrade[],
    losses: DBTrade[]
  ): Promise<AIBrainDecision> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');

    const prompt = this.buildPrompt(token, research, devRep, patternTags, strategy, progress, wins, losses);
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: this.modelName,
        max_tokens: 600,
        temperature: 0.2,
        system: 'You are an elite quantitative crypto trading AI. Evaluate Pump.fun opportunities strictly in JSON.',
        messages: [{ role: 'user', content: prompt }]
      },
      {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        timeout: 6000
      }
    );

    const rawContent = response.data?.content?.[0]?.text || '';
    return this.parseJsonResponse(rawContent, research.narrativeTags, research.category, `Claude (${this.modelName})`);
  }

  private async queryGemini(
    token: TokenCreationEvent,
    research: ResearchReport,
    devRep: DevReputation,
    patternTags: string,
    strategy: string,
    progress: number,
    wins: DBTrade[],
    losses: DBTrade[]
  ): Promise<AIBrainDecision> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

    const prompt = this.buildPrompt(token, research, devRep, patternTags, strategy, progress, wins, losses);
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${apiKey}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
      },
      { headers: { 'Content-Type': 'application/json' }, timeout: 6000 }
    );

    const rawContent = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return this.parseJsonResponse(rawContent, research.narrativeTags, research.category, `Gemini (${this.modelName})`);
  }

  private async queryOllama(
    token: TokenCreationEvent,
    research: ResearchReport,
    devRep: DevReputation,
    patternTags: string,
    strategy: string,
    progress: number,
    wins: DBTrade[],
    losses: DBTrade[]
  ): Promise<AIBrainDecision> {
    const host = process.env.OLLAMA_HOST || 'http://localhost:11434';
    const prompt = this.buildPrompt(token, research, devRep, patternTags, strategy, progress, wins, losses);

    const response = await axios.post(
      `${host}/api/generate`,
      {
        model: this.modelName,
        prompt: prompt,
        stream: false,
        format: 'json',
        options: { temperature: 0.2 }
      },
      { timeout: 8000 }
    );

    const rawContent = response.data?.response || '';
    return this.parseJsonResponse(rawContent, research.narrativeTags, research.category, `Ollama (${this.modelName})`);
  }

  private async queryOpenAI(
    token: TokenCreationEvent,
    research: ResearchReport,
    devRep: DevReputation,
    patternTags: string,
    strategy: string,
    progress: number,
    wins: DBTrade[],
    losses: DBTrade[]
  ): Promise<AIBrainDecision> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

    const prompt = this.buildPrompt(token, research, devRep, patternTags, strategy, progress, wins, losses);
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: this.modelName,
        messages: [
          { role: 'system', content: 'You are an elite crypto trading bot brain. Output strictly JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' }
      },
      {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: 6000
      }
    );

    const rawContent = response.data?.choices?.[0]?.message?.content || '';
    return this.parseJsonResponse(rawContent, research.narrativeTags, research.category, `OpenAI (${this.modelName})`);
  }

  private async queryOpenRouter(
    token: TokenCreationEvent,
    research: ResearchReport,
    devRep: DevReputation,
    patternTags: string,
    strategy: string,
    progress: number,
    wins: DBTrade[],
    losses: DBTrade[]
  ): Promise<AIBrainDecision> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');

    const prompt = this.buildPrompt(token, research, devRep, patternTags, strategy, progress, wins, losses);
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: this.modelName,
        messages: [
          { role: 'system', content: 'You are an elite crypto trading bot brain. Output strictly JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2
      },
      {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: 6000
      }
    );

    const rawContent = response.data?.choices?.[0]?.message?.content || '';
    return this.parseJsonResponse(rawContent, research.narrativeTags, research.category, `OpenRouter (${this.modelName})`);
  }

  private parseJsonResponse(raw: string, defaultTags: string[], category: string, providerName: string): AIBrainDecision {
    try {
      let cleaned = raw.trim();
      // Strip markdown ```json ... ``` wrappers
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleaned = jsonMatch[0];
      }
      const content = JSON.parse(cleaned);
      const conf = Math.max(0, Math.min(100, Number(content.confidenceScore || 50)));

      // Dynamic Category Target Adjuster
      let defTp = 50;
      if (category === 'TECH_AI') defTp = 75;
      else if (category === 'VIRAL_MEME') defTp = 45;

      return {
        shouldBuy: Boolean(content.shouldBuy && conf >= 60),
        confidenceScore: conf,
        suggestedTpPercent: Number(content.suggestedTpPercent || defTp),
        suggestedSlPercent: Number(content.suggestedSlPercent || -20),
        reasoning: content.reasoning || 'AI quantitative analysis complete',
        riskFactors: Array.isArray(content.riskFactors) ? content.riskFactors : [],
        tags: Array.isArray(content.tags) ? content.tags : defaultTags,
        category: category,
        providerUsed: providerName
      };
    } catch {
      return {
        shouldBuy: false,
        confidenceScore: 40,
        suggestedTpPercent: 50,
        suggestedSlPercent: -20,
        reasoning: 'Heuristic fallback applied (JSON format check)',
        riskFactors: ['JSON Parse Fallback'],
        tags: defaultTags,
        category: category,
        providerUsed: providerName
      };
    }
  }

  private buildPrompt(
    token: TokenCreationEvent,
    research: ResearchReport,
    devRep: DevReputation,
    patternTags: string,
    strategy: string,
    progress: number,
    wins: DBTrade[],
    losses: DBTrade[]
  ): string {
    const winContext = wins.map(w => `• Win: ${w.symbol} (+${w.pnlPercent.toFixed(1)}% PnL, Strategy: ${w.strategy})`).join('\n') || 'None recorded yet';
    const lossContext = losses.map(l => `• Loss: ${l.symbol} (${l.pnlPercent.toFixed(1)}% PnL, Reason: ${l.reason})`).join('\n') || 'None recorded yet';

    return `
Analyze this Solana Pump.fun token launch with deep quantitative Chain-of-Thought reasoning:

[TOKEN SPECIFICATIONS]
• Symbol: ${token.symbol} (${token.name})
• Category: [${research.category}] (Research Score: ${research.researchScore}/100)
• Social Footprint: Website: ${research.hasWebsite}, Twitter: ${research.hasTwitter}, Telegram: ${research.hasTelegram}, GitHub/Docs: ${research.hasGithubOrDocs}
• Dev Initial Buy: ${token.initialBuy} SOL
• Dev Historical Win Rate: ${devRep.reputationScore}/100 (Created: ${devRep.totalTokensCreated}, Rugged: ${devRep.ruggedTokens})
• Active Trading Strategy: ${strategy}
• Bonding Curve Progress: ${progress}%
• Narrative Tags: ${research.narrativeTags.join(', ')}
• Market Profitable Meta: ${patternTags || 'None'}

[HISTORICAL MEMORY FEW-SHOT CONTEXT]
Recent Successful Trades in Session:
${winContext}

Recent Stopped-Out Trades to Avoid:
${lossContext}

[INSTRUCTIONS]
Evaluate whether this token represents an asymmetric risk/reward entry.
Respond ONLY with a valid JSON object matching this schema:
{
  "shouldBuy": boolean,
  "confidenceScore": number (0 to 100),
  "suggestedTpPercent": number (e.g. 50 to 150),
  "suggestedSlPercent": number (negative, e.g. -20),
  "reasoning": string (concise 1-sentence analytical thesis),
  "riskFactors": string[]
}
`;
  }

  private evaluateBuiltinBrain(
    token: TokenCreationEvent,
    research: ResearchReport,
    devRep: DevReputation,
    winningPatterns: any[],
    strategy: string,
    progress: number,
    topHoldersConcentration: number
  ): AIBrainDecision {
    let score = research.researchScore;
    const riskFactors: string[] = [];

    if (devRep.totalTokensCreated > 0) {
      if (devRep.reputationScore >= 70) {
        score += 15;
      } else if (devRep.reputationScore <= 35) {
        score -= 30;
        riskFactors.push(`Dev low reputation (${devRep.reputationScore}/100)`);
      }
    }

    if (topHoldersConcentration > 0.25) {
      score -= 20;
      riskFactors.push(`High holder concentration (${(topHoldersConcentration * 100).toFixed(0)}%)`);
    }

    for (const pat of winningPatterns) {
      if (research.narrativeTags.includes(pat.tag)) {
        score += 10;
      }
    }

    const finalScore = Math.min(100, Math.max(0, score));
    const shouldBuy = finalScore >= 60 && riskFactors.length === 0;

    let reasoning = `Research Brain scored ${finalScore}/100 for [${research.category}] (${research.narrativeTags.join(', ')}).`;
    if (!shouldBuy && riskFactors.length > 0) {
      reasoning = `Skipped: ${riskFactors.join('; ')} (Confidence: ${finalScore}/100)`;
    }

    return {
      shouldBuy,
      confidenceScore: finalScore,
      suggestedTpPercent: research.category === 'TECH_AI' ? 75 : 50,
      suggestedSlPercent: -20,
      reasoning,
      riskFactors,
      tags: research.narrativeTags,
      category: research.category,
      providerUsed: 'Built-in Deep Neural Brain',
      convictionTier: finalScore >= 85 ? 'SUPER_SNIPE' : finalScore >= 70 ? 'STANDARD' : 'SPECULATIVE'
    };
  }
}
