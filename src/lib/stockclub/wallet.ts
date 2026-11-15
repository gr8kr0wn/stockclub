import {
  createWalletClient,
  custom,
  encodeFunctionData,
  keccak256,
  toBytes,
  type Address,
  type Hex,
} from "viem";
import { baseSepolia } from "viem/chains";
import { CLUB_ABI, CLUB_BYTECODE } from "./club-bytecode";
import { BASE_CHAIN_HEX, BASE_EXPLORER, BASE_NAME, BASE_RPC, BASE_USDC } from "./chain";

type Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  isCoinbaseWallet?: boolean;
  isMetaMask?: boolean;
  providers?: Provider[];
};

const USDC_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

function injected(): Provider | null {
  if (typeof window === "undefined") return null;
  const eth = (window as Window & { ethereum?: Provider }).ethereum;
  return eth ?? null;
}

export function pickProvider(kind: "browser" | "coinbase"): Provider | null {
  const eth = injected();
  if (!eth) return null;
  const list = eth.providers?.length ? eth.providers : [eth];
  if (kind === "coinbase") return list.find((item) => item.isCoinbaseWallet) ?? null;
  return list.find((item) => item.isMetaMask) ?? eth;
}

async function onBase(provider: Provider): Promise<void> {
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: BASE_CHAIN_HEX }] });
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (code !== 4902) throw error;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: BASE_CHAIN_HEX,
          chainName: BASE_NAME,
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: [BASE_RPC],
          blockExplorerUrls: [BASE_EXPLORER],
        },
      ],
    });
  }
}

export async function connectAccount(kind: "browser" | "coinbase"): Promise<{ provider: Provider; address: Address }> {
  const provider = pickProvider(kind);
  if (!provider) {
    throw new Error(kind === "coinbase" ? "Coinbase Wallet is not installed in this browser." : "No browser wallet found.");
  }
  await onBase(provider);
  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
  const address = accounts[0];
  if (!address) throw new Error("The wallet did not share an address.");
  return { provider, address: address as Address };
}

export async function signIn(provider: Provider, address: Address, message: string): Promise<Hex> {
  const client = createWalletClient({ account: address, chain: baseSepolia, transport: custom(provider) });
  return client.signMessage({ account: address, message });
}

export async function deployTreasury(provider: Provider, address: Address): Promise<Hex> {
  const client = createWalletClient({ account: address, chain: baseSepolia, transport: custom(provider) });
  return client.deployContract({
    abi: CLUB_ABI,
    bytecode: CLUB_BYTECODE,
    args: [BASE_USDC],
    account: address,
    chain: baseSepolia,
  });
}

export async function depositUsdc(
  provider: Provider,
  address: Address,
  registry: Address,
  ticker: string,
  dollars: number,
): Promise<Hex> {
  const client = createWalletClient({ account: address, chain: baseSepolia, transport: custom(provider) });
  const units = BigInt(dollars) * 1_000_000n;
  const clubId = keccak256(toBytes(ticker));
  const approve = encodeFunctionData({
    abi: USDC_ABI,
    functionName: "approve",
    args: [registry, units],
  });
  await client.sendTransaction({ account: address, chain: baseSepolia, to: BASE_USDC, data: approve });
  const deposit = encodeFunctionData({
    abi: CLUB_ABI,
    functionName: "deposit",
    args: [clubId, units],
  });
  return client.sendTransaction({ account: address, chain: baseSepolia, to: registry, data: deposit });
}
