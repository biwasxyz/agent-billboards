import { readFileSync } from 'fs';
import {
  makeContractDeploy,
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
} from '@stacks/transactions';
import { STACKS_TESTNET } from '@stacks/network';
import { generateWallet } from '@stacks/wallet-sdk';

const MNEMONIC = 'mercy damp cupboard profit minimum relax garden word furnace ugly route shiver diamond speed design trigger toddler glue midnight clutch arena main city fence';

async function deploy() {
  // Generate wallet from mnemonic
  const wallet = await generateWallet({ secretKey: MNEMONIC, password: '' });
  const account = wallet.accounts[0];
  const privateKey = account.stxPrivateKey;

  console.log('Deploying from:', account.stxAddress);

  // Read contract source
  const contractSource = readFileSync('contracts/agent-grades.clar', 'utf-8');

  // Create deployment transaction
  const txOptions = {
    contractName: 'agent-grades',
    codeBody: contractSource,
    senderKey: privateKey,
    network: STACKS_TESTNET,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Allow,
    fee: 100000n, // 0.1 STX
  };

  console.log('Building transaction...');
  const transaction = await makeContractDeploy(txOptions);

  console.log('Broadcasting transaction...');
  const broadcastResponse = await broadcastTransaction({ transaction, network: STACKS_TESTNET });

  if ('error' in broadcastResponse) {
    console.error('Broadcast failed:', broadcastResponse.error);
    console.error('Reason:', broadcastResponse.reason);
    process.exit(1);
  }

  console.log('Transaction broadcast successfully!');
  console.log('TX ID:', broadcastResponse.txid);
  console.log('Contract: ST3ZF4PK17V4JZ3STF4H4DCCX2EHP8XWC0MFJV4R6.agent-grades');
  console.log('Explorer: https://explorer.hiro.so/txid/' + broadcastResponse.txid + '?chain=testnet');
}

deploy().catch(console.error);
