import chalk from 'chalk';
import { loadConfig } from './config';
import { PumpFunAgent } from './agent';
import { TradingMode } from './types';

function parseArgs(): { mode?: TradingMode } {
  const args = process.argv.slice(2);
  let mode: TradingMode | undefined;

  for (const arg of args) {
    if (arg.startsWith('--mode=')) {
      const val = arg.split('=')[1].toLowerCase();
      if (val === 'live' || val === 'paper') {
        mode = val;
      }
    }
  }
  return { mode };
}

async function main() {
  console.clear();
  console.log(chalk.magenta.bold(`
  ██████╗ ██╗   ██╗███╗   ███╗██████╗ ███████╗██╗   ██╗███╗   ██╗
  ██╔══██╗██║   ██║████╗ ████║██╔══██╗██╔════╝██║   ██║████╗  ██║
  ██████╔╝██║   ██║██╔████╔██║██████╔╝█████╗  ██║   ██║██╔██╗ ██║
  ██╔═══╝ ██║   ██║██║╚██╔╝██║██╔═══╝ ██╔══╝  ██║   ██║██║╚██╗██║
  ██║     ╚██████╔╝██║ ╚═╝ ██║██║     ██║     ╚██████╔╝██║ ╚████║
  ╚═╝      ╚═════╝ ╚═╝     ╚═╝╚═╝     ╚═╝      ╚═════╝ ╚═╝  ╚═══╝
               AUTONOMOUS TRADING AGENT v1.0.0
  `));

  const cliArgs = parseArgs();
  const config = loadConfig();

  if (cliArgs.mode) {
    config.tradingMode = cliArgs.mode;
  }

  const agent = new PumpFunAgent(config);

  const shutdown = () => {
    console.log(chalk.yellow('\n[System] Graceful shutdown signal received...'));
    agent.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    await agent.start();
  } catch (err: any) {
    console.error(chalk.red.bold(`[Fatal Error] ${err.message}`));
    process.exit(1);
  }
}

main();
