export interface MpcClientConfig {
  apiKey: string
  baseUrl: string
}

export function getMpcConfig(): MpcClientConfig {
  return {
    apiKey: process.env.MPC_API_KEY ?? '',
    baseUrl: process.env.MPC_BASE_URL ?? 'https://api.makeplayingcards.com',
  }
}
