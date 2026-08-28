import { Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';
import chalk from 'chalk';
import { loadConfig } from '../config';
import { SolanaService } from '../services/solana';

async function testWallet() {
  console.log(chalk.cyan.bold('\n--- Solana Wallet & RPC Connection Tester ---\n'));
  const config = loadConfig();

  console.log(chalk.gray(`RPC URL: ${config.rpcUrl}`));

  if (!config.privateKey) {
    console.log(chalk.yellow('No SOLANA_PRIVATE_KEY provided in .env.'));
    console.log(chalk.gray('Generating a new random Solana keypair for reference:'));
    const generated = Keypair.generate();
    console.log(chalk.green(`Public Key: ${generated.publicKey.toBase58()}`));
    console.log(chalk.green(`Private Key (Base58): ${bs58.encode(generated.secretKey)}`));
    console.log(chalk.yellow('\nTo use live trading, set SOLANA_PRIVATE_KEY in your .env and fund this address with SOL.'));
    return;
  }

  const solanaService = new SolanaService(config.rpcUrl, config.privateKey);
  const pubkey = solanaService.getPublicKey();

  if (!pubkey) {
    console.log(chalk.red('❌ Failed to parse private key. Make sure it is Base58 or JSON array format.'));
    return;
  }

  console.log(chalk.green(`✅ Wallet Public Key: ${pubkey.toBase58()}`));

  try {
    const balance = await solanaService.getBalance();
    console.log(chalk.green(`✅ Wallet SOL Balance: ${balance.toFixed(4)} SOL (${(balance * LAMPORTS_PER_SOL).toLocaleString()} Lamports)`));

    if (balance === 0) {
      console.log(chalk.yellow('⚠️ Balance is 0 SOL. Fund the wallet or use Paper Trading mode (--mode=paper).'));
    } else {
      console.log(chalk.cyan(`Ready for trading with trade size: ${config.solPerTrade} SOL`));
    }
  } catch (err: any) {
    console.error(chalk.red(`❌ Error contacting RPC: ${err.message}`));
  }
}

testWallet();
