import { readFileSync, writeFileSync } from "node:fs";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { CLUB_ABI, CLUB_BYTECODE } from "../src/lib/stockclub/club-bytecode.ts";
import { BASE_RPC, BASE_USDC } from "../src/lib/stockclub/chain.ts";

const keyFile = new URL("../.deploy/devnet.json", import.meta.url);
const secret = JSON.parse(readFileSync(keyFile, "utf8"));
const account = privateKeyToAccount(secret.privateKey);
const publicClient = createPublicClient({ chain: baseSepolia, transport: http(BASE_RPC) });
const wallet = createWalletClient({ account, chain: baseSepolia, transport: http(BASE_RPC) });

const balance = await publicClient.getBalance({ address: account.address });
console.log(JSON.stringify({ address: account.address, wei: balance.toString() }));
if (balance === 0n) {
  console.error("No Base Sepolia ETH yet.");
  process.exit(2);
}

const hash = await wallet.deployContract({
  abi: CLUB_ABI,
  bytecode: CLUB_BYTECODE,
  args: [BASE_USDC],
  account,
  chain: baseSepolia,
});
const receipt = await publicClient.waitForTransactionReceipt({ hash });
if (receipt.status !== "success" || !receipt.contractAddress) {
  console.error("Deploy failed", hash);
  process.exit(1);
}
const address = receipt.contractAddress;
secret.registry = address;
secret.deployTx = hash;
writeFileSync(keyFile, `${JSON.stringify(secret, null, 2)}\n`);
const chainPath = new URL("../src/lib/stockclub/chain.ts", import.meta.url);
const chain = readFileSync(chainPath, "utf8").replace(
  /export const CLUB_REGISTRY: string \| null = .*?;/,
  `export const CLUB_REGISTRY: string | null = "${address}";`,
);
writeFileSync(chainPath, chain);
console.log(JSON.stringify({ registry: address, tx: hash }));
