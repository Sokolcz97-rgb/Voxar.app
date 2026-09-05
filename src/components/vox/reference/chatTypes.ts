export interface CommunityAttachment {
  url: string;
  name: string;
  mime: string;
  size: number;
  kind: "image" | "video" | "file";
}

export interface CommunityMessage {
  id: string;
  channel_id: string;
  author_id: string;
  content: string;
  created_at: string;
  edited_at: string | null;
  attachments?: CommunityAttachment[] | null;
}

export interface CommunityProfileLite {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
}
