import { BondingCurveCalculator } from '../services/bondingCurve';
import { FilterEngine } from '../services/filterEngine';
import { PositionSizer } from '../services/positionSizer';
import { RugCheckService } from '../services/rugCheck';
import { SocialSentimentAnalyzer } from '../services/socialSentiment';
import { SQLiteMemory } from '../services/sqliteMemory';
import { Backtester } from '../services/backtester';
import { loadConfig } from '../config';

async function runTests() {
  console.log('--- RUNNING PUMPFUN TRADING AGENT VERIFICATION TESTS ---');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${msg}`);
      failed++;
    }
  }

  // 1. BondingCurveCalculator Spot Price Test
  const spotPrice1 = BondingCurveCalculator.calculateSpotPriceSol(30 * 1e9, 1073000000 * 1e6);
  const spotPrice2 = BondingCurveCalculator.calculateSpotPriceSol(30, 1073000000);
  assert(Math.abs(spotPrice1 - spotPrice2) < 1e-12, 'Spot price handles both lamport and SOL units consistently');
  assert(spotPrice1 > 0 && spotPrice1 < 0.0001, 'Spot price is in reasonable SOL range');

  // 2. FilterEngine Blacklist Whole-Word Test
  const config = loadConfig();
  const filterEngine = new FilterEngine(config);
  
  const tokenGretest: any = {
    mint: 'So11111111111111111111111111111111111111112',
    name: 'The Greatest Token',
    symbol: 'GREATEST',
    initialBuy: 0.1,
    twitter: 'https://x.com/greatest'
  };
  const resGreatest = filterEngine.evaluateToken(tokenGretest);
  assert(resGreatest.passed, 'FilterEngine allows "GREATEST" without false-flagging on "test"');

  const tokenScam: any = {
    mint: 'So11111111111111111111111111111111111111112',
    name: 'Scam Token',
    symbol: 'SCAM',
    initialBuy: 0.1
  };
  const resScam = filterEngine.evaluateToken(tokenScam);
  assert(!resScam.passed, 'FilterEngine rejects "SCAM" keyword');

  // 3. PositionSizer Scoring Test
  const sizer = new PositionSizer(config);
  const safeSize = sizer.calculateTradeSize(80, 60, 90, 1.0); // devRep 90
  const riskySize = sizer.calculateTradeSize(80, 60, 20, 1.0); // devRep 20
  assert(safeSize > riskySize, `Safe dev reputation gets higher allocation (${safeSize} SOL vs ${riskySize} SOL)`);

  // 4. Social Sentiment Analyzer
  const socialAnalyzer = new SocialSentimentAnalyzer();
  const sentiment = socialAnalyzer.analyzeToken({
    signature: 'sig',
    mint: 'mint12345678901234567890123456789012',
    traderPublicKey: 'dev12345678901234567890123456789012',
    txType: 'create',
    initialBuy: 0.5,
    name: 'Pepe AI Agent',
    symbol: 'PEPEAI',
    uri: 'https://ipfs.io/ipfs/test',
    twitter: 'https://x.com/pepeai',
    telegram: 'https://t.me/pepeai',
    timestamp: Date.now()
  });
  assert(sentiment.viralityScore >= 60, `Viral meme AI token scores high virality (${sentiment.viralityScore}/100)`);

  // 5. SQLiteMemory & Backtester
  const memory = new SQLiteMemory();
  await memory.init();
  const backtester = new Backtester(memory);
  const btRes = await backtester.runBacktest(1.0, 0.01, 50, -20);
  assert(btRes !== null && typeof btRes.winRate === 'number', 'Backtester runs cleanly on SQLite memory');

  console.log(`\nTEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
