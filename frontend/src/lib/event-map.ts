import { MessageType } from './message-types'

export type EmitMode = 'request' | 'send'

export interface EventEntry {
  type: MessageType
  mode: EmitMode
}

const EVENTS: Record<string, EventEntry> = {
  // Auth
  restore_session: { type: MessageType.AuthRestore, mode: 'request' },
  send_code: { type: MessageType.AuthSendCode, mode: 'request' },
  verify_code: { type: MessageType.AuthVerifyCode, mode: 'request' },

  // Chat
  send_message: { type: MessageType.ChatSend, mode: 'request' },
  get_chats: { type: MessageType.ChatGetChats, mode: 'request' },
  get_messages: { type: MessageType.ChatGetMessages, mode: 'request' },
  mark_read: { type: MessageType.ChatMarkRead, mode: 'request' },
  typing: { type: MessageType.ChatTyping, mode: 'send' },
  stop_typing: { type: MessageType.ChatStopTyping, mode: 'send' },
  message_delivered: { type: MessageType.ChatMessageDelivered, mode: 'send' },
  delete_message: { type: MessageType.ChatDelete, mode: 'request' },
  edit_message: { type: MessageType.ChatEdit, mode: 'request' },
  forward_message: { type: MessageType.ChatForward, mode: 'send' },
  create_private: { type: MessageType.ChatCreatePrivate, mode: 'request' },
  get_or_create_private_chat: { type: MessageType.ChatCreatePrivate, mode: 'request' },
  create_group: { type: MessageType.ChatCreateGroup, mode: 'request' },
  search_messages: { type: MessageType.SearchMessages, mode: 'request' },
  delete_chat: { type: MessageType.ChatDelete, mode: 'request' },
  clear_chat: { type: MessageType.ChatDelete, mode: 'request' },
  pin_chat: { type: MessageType.ChatPin, mode: 'send' },
  join_chat: { type: MessageType.ChatSend, mode: 'send' },
  leave_chat: { type: MessageType.ChatSend, mode: 'send' },

  // Call / WebRTC
  start_call: { type: MessageType.CallStart, mode: 'request' },
  accept_call: { type: MessageType.CallAccept, mode: 'send' },
  reject_call: { type: MessageType.CallReject, mode: 'send' },
  end_call: { type: MessageType.CallEnd, mode: 'send' },
  signal_data: { type: MessageType.CallIce, mode: 'send' },
  get_calls: { type: MessageType.CallGetHistory, mode: 'request' },
  log_call: { type: MessageType.CallLog, mode: 'send' },

  // Post / Feed
  create_post: { type: MessageType.PostCreate, mode: 'request' },
  get_posts: { type: MessageType.PostGet, mode: 'request' },
  like_post: { type: MessageType.PostLike, mode: 'send' },
  unlike_post: { type: MessageType.PostLike, mode: 'send' },
  add_post_comment: { type: MessageType.PostComment, mode: 'send' },
  get_post_comments: { type: MessageType.PostGet, mode: 'request' },
  get_recommended_posts: { type: MessageType.PostGetRecommended, mode: 'request' },
  search_posts: { type: MessageType.PostSearch, mode: 'request' },
  join_post: { type: MessageType.PostJoin, mode: 'send' },
  leave_post: { type: MessageType.PostLeave, mode: 'send' },

  // Live
  start_live: { type: MessageType.LiveStart, mode: 'request' },
  end_live: { type: MessageType.LiveEnd, mode: 'send' },
  get_active_lives: { type: MessageType.LiveGetActive, mode: 'request' },
  join_live: { type: MessageType.LiveJoin, mode: 'send' },
  leave_live: { type: MessageType.LiveLeave, mode: 'send' },
  add_live_comment: { type: MessageType.LiveComment, mode: 'send' },
  add_live_reaction: { type: MessageType.LiveReaction, mode: 'send' },
  send_live_gift: { type: MessageType.LiveGift, mode: 'send' },
  get_live_comments: { type: MessageType.LiveGetComments, mode: 'request' },
  get_live_reactions: { type: MessageType.LiveGetReactions, mode: 'request' },
  get_live_gifts: { type: MessageType.LiveGetGifts, mode: 'request' },
  get_user_stars: { type: MessageType.LiveGetUserStars, mode: 'request' },

  // Contact
  get_contacts: { type: MessageType.ContactGet, mode: 'request' },
  add_contact: { type: MessageType.ContactAdd, mode: 'request' },
  search_users: { type: MessageType.ContactSearch, mode: 'request' },
  get_suggested_users: { type: MessageType.ContactGetSuggested, mode: 'request' },

  // Profile
  update_profile: { type: MessageType.ProfileUpdate, mode: 'request' },

  // Notification
  get_notifications: { type: MessageType.NotifGetList, mode: 'request' },
  mark_notification_read: { type: MessageType.NotifMarkRead, mode: 'send' },

  // Channel
  get_channels: { type: MessageType.ChannelGetList, mode: 'request' },
  create_channel: { type: MessageType.ChannelCreate, mode: 'request' },
  get_channel_posts: { type: MessageType.ChannelGetPosts, mode: 'request' },
  create_channel_post: { type: MessageType.ChannelCreatePost, mode: 'request' },
  subscribe_channel: { type: MessageType.ChannelSubscribe, mode: 'send' },
  unsubscribe_channel: { type: MessageType.ChannelUnsubscribe, mode: 'send' },

  // Community
  get_communities: { type: MessageType.CommunityGetList, mode: 'request' },
  create_community: { type: MessageType.CommunityCreate, mode: 'request' },
  join_community: { type: MessageType.CommunityJoin, mode: 'send' },
  leave_community: { type: MessageType.CommunityLeave, mode: 'send' },

  // Shop
  get_products: { type: MessageType.ShopGetProducts, mode: 'request' },
  create_product: { type: MessageType.ShopCreateProduct, mode: 'request' },
  buy_product: { type: MessageType.ShopBuyProduct, mode: 'request' },
  add_to_wishlist: { type: MessageType.ShopAddToWishlist, mode: 'send' },
  create_wishlist: { type: MessageType.ShopCreateWishlist, mode: 'request' },
  get_flash_deals: { type: MessageType.ShopGetFlashDeals, mode: 'request' },
  get_my_orders: { type: MessageType.ShopGetOrders, mode: 'request' },
  get_wishlists: { type: MessageType.ShopGetWishlists, mode: 'request' },

  // Game
  get_games: { type: MessageType.GameGetList, mode: 'request' },
  create_game: { type: MessageType.GameCreate, mode: 'request' },
  join_game: { type: MessageType.GameJoin, mode: 'send' },
  game_action: { type: MessageType.GameAction, mode: 'send' },

  // Watch Together
  create_watch_session: { type: MessageType.WatchCreate, mode: 'request' },
  sync_watch: { type: MessageType.WatchSync, mode: 'send' },
  get_watch_session: { type: MessageType.WatchGet, mode: 'request' },

  // Story
  create_story: { type: MessageType.StoryCreate, mode: 'request' },
  get_stories: { type: MessageType.StoryGet, mode: 'request' },

  // Task
  get_tasks: { type: MessageType.TaskGetList, mode: 'request' },
  create_task: { type: MessageType.TaskCreate, mode: 'request' },
  complete_task: { type: MessageType.TaskComplete, mode: 'send' },
  delete_task: { type: MessageType.TaskDelete, mode: 'send' },

  // Note
  get_note: { type: MessageType.NoteGet, mode: 'request' },
  save_note: { type: MessageType.NoteSave, mode: 'request' },

  // Focus
  start_focus: { type: MessageType.FocusStart, mode: 'request' },
  end_focus: { type: MessageType.FocusEnd, mode: 'send' },

  // Meme
  get_memes: { type: MessageType.MemeGetList, mode: 'request' },
  create_meme: { type: MessageType.MemeCreate, mode: 'request' },
  like_meme: { type: MessageType.MemeLike, mode: 'send' },

  // Sticker
  get_sticker_packs: { type: MessageType.StickerGetPacks, mode: 'request' },
  get_my_stickers: { type: MessageType.StickerGetMy, mode: 'request' },
  get_stickers: { type: MessageType.StickerGetAll, mode: 'request' },
  purchase_sticker: { type: MessageType.StickerPurchase, mode: 'request' },

  // Vibe Balance
  get_vibe_balance: { type: MessageType.VibeBalanceGet, mode: 'request' },
  record_interaction: { type: MessageType.RecordInteraction, mode: 'send' },

  // Sessions
  get_sessions: { type: MessageType.SessionGetList, mode: 'request' },
  terminate_session: { type: MessageType.SessionTerminate, mode: 'send' },
  terminate_other_sessions: { type: MessageType.SessionTerminateAll, mode: 'send' },

  // Privacy
  get_privacy_settings: { type: MessageType.PrivacyGet, mode: 'request' },
  update_privacy_settings: { type: MessageType.PrivacyUpdate, mode: 'request' },

  // Blocked
  get_blocked_users: { type: MessageType.BlockedGetList, mode: 'request' },
  unblock_user: { type: MessageType.BlockedUnblock, mode: 'send' },

  // Account
  get_account_deletion: { type: MessageType.AccountGetDeletion, mode: 'request' },
  schedule_account_deletion: { type: MessageType.AccountScheduleDelete, mode: 'request' },
  cancel_account_deletion: { type: MessageType.AccountCancelDelete, mode: 'send' },

  // TwoStep
  get_two_step_status: { type: MessageType.TwoStepGetStatus, mode: 'request' },
  set_two_step: { type: MessageType.TwoStepSet, mode: 'request' },
  disable_two_step: { type: MessageType.TwoStepDisable, mode: 'send' },

  // Upload
  upload_start: { type: MessageType.UploadStart, mode: 'request' },
  upload_chunk: { type: MessageType.UploadChunk, mode: 'request' },
  upload_cancel: { type: MessageType.UploadCancel, mode: 'send' },

  // Presence
  update_presence: { type: MessageType.PresenceStatus, mode: 'send' },
}

export const PUSH_EVENTS: Record<string, number> = {
  new_message: MessageType.ChatNewMessage,
  message_status: MessageType.ChatMessageStatus,
  new_chat: MessageType.ChatNewChat,
  contact_status: MessageType.ContactStatus,
  new_post: MessageType.PostNew,
  typing: MessageType.ChatTyping,
  stop_typing: MessageType.ChatStopTyping,
  new_notification: MessageType.NotifNew,
  new_live_comment: MessageType.LiveNewComment,
  new_live_reaction: MessageType.LiveNewReaction,
  new_live_gift: MessageType.LiveNewGift,
  new_story: MessageType.StoryNew,
  new_meme: MessageType.MemeNew,
  new_task: MessageType.TaskNew,
  focus_started: MessageType.FocusStarted,
  focus_ended: MessageType.FocusEnded,
  note_updated: MessageType.NoteUpdated,
  watch_synced: MessageType.WatchSynced,
  session_updated: MessageType.WatchSessionUpdated,
  game_update: MessageType.GameUpdate,
  live_started: MessageType.LiveStart,
  live_ended: MessageType.LiveEnd,
  call_ended: MessageType.CallEnd,
  post_liked: MessageType.PostLike,
  new_post_comment: MessageType.PostComment,
}

export function getEventEntry(event: string): EventEntry | undefined {
  return EVENTS[event]
}

export function getPushType(event: string): number | undefined {
  return PUSH_EVENTS[event]
}
