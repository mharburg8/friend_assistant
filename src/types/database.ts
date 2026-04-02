export type Mode = 'alab' | 'work' | 'jobsearch' | 'school' | 'personal' | 'dev'
export type MessageRole = 'user' | 'assistant' | 'system'
export type MemoryType = 'summary' | 'fact' | 'sentiment' | 'profile_update'
export type ActionStatus = 'pending' | 'completed' | 'failed' | 'rejected'

export interface Project {
  id: string
  user_id: string
  name: string
  description: string | null
  color: string
  created_at: string
  updated_at: string
  archived_at: string | null
}

export interface Conversation {
  id: string
  user_id: string
  title: string | null
  mode: Mode | null
  project_id: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
}

export interface Message {
  id: string
  conversation_id: string
  role: MessageRole
  content: string
  model_used: string | null
  tokens_in: number | null
  tokens_out: number | null
  created_at: string
}

export interface MemoryNode {
  id: string
  user_id: string
  type: MemoryType
  content: string
  summary: string | null
  sentiment: string | null
  source_conversation_id: string | null
  embedding: number[] | null
  created_at: string
}

export interface UserProfile {
  id: string
  user_id: string
  profile_json: Record<string, unknown>
  updated_at: string
}

export interface ActionLog {
  id: string
  user_id: string
  action: string
  reasoning: string | null
  status: ActionStatus
  metadata: Record<string, unknown>
  created_at: string
}

export interface Priority {
  id: string
  user_id: string
  week_of: string
  priority_text: string
  rank: number
  completed: boolean
  created_at: string
}

export interface Attachment {
  id: string
  message_id: string | null
  conversation_id: string
  user_id: string
  file_name: string
  file_type: string
  file_size: number
  s3_key: string
  created_at: string
  inline_data?: string
}
