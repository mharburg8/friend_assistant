import Anthropic from '@anthropic-ai/sdk'
import AnthropicBedrock from '@anthropic-ai/bedrock-sdk'

type ClaudeClient = Anthropic | AnthropicBedrock

let client: ClaudeClient | null = null

/**
 * Returns either a direct Anthropic client or a Bedrock client
 * based on the CLAUDE_PROVIDER env var.
 *
 * Set CLAUDE_PROVIDER=bedrock to use AWS Bedrock (HIPAA-compliant).
 * Default: direct Anthropic API.
 */
export function getClaudeClient(): ClaudeClient {
  if (!client) {
    if (process.env.CLAUDE_PROVIDER === 'bedrock') {
      client = new AnthropicBedrock({
        awsRegion: process.env.AWS_REGION || 'us-east-2',
        // Uses AWS credentials from environment:
        // AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
        // Or IAM role if running on EC2
      })
    } else {
      client = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY!,
      })
    }
  }
  return client
}

/**
 * Model IDs differ between direct API and Bedrock.
 * This maps our logical model names to the right IDs.
 */
export function getModelId(logical: 'sonnet' | 'haiku'): string {
  const isBedrock = process.env.CLAUDE_PROVIDER === 'bedrock'

  const models = {
    sonnet: isBedrock
      ? 'us.anthropic.claude-sonnet-4-6-20250415-v1:0'
      : 'claude-sonnet-4-6-20250415',
    haiku: isBedrock
      ? 'us.anthropic.claude-haiku-4-5-20251001-v1:0'
      : 'claude-haiku-4-5-20251001',
  }

  return models[logical]
}
