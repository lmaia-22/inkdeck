import Replicate from 'replicate'

let client: Replicate | null = null

export function getReplicateClient(): Replicate {
  if (!client) {
    client = new Replicate({ auth: process.env.REPLICATE_API_TOKEN! })
  }
  return client
}
