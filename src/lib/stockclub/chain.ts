export const BASE_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
export const BASE_CHAIN_ID = 84532;
export const BASE_CHAIN_HEX = "0x14a34";
export const BASE_RPC = "https://sepolia.base.org";
export const BASE_EXPLORER = "https://sepolia.basescan.org";
export const BASE_NAME = "Base Sepolia";
export const CLUB_REGISTRY: string | null = "0xb3449DfdF07BA1caBD62aF17db49670D08a12d7d";

export function signInMessage(address: string, nonce: string): string {
  return `StockClub\nSign in on Base Sepolia\n${address}\n${nonce}`;
}
