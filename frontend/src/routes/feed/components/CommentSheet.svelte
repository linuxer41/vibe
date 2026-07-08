<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from '$lib/icon/Icon.svelte';
  import { avatarUrl } from '$lib/helpers';
  import type { PostComment, User, Post } from '$lib/types';
  import { emit } from '$lib/socket';

  let {
    post,
    sk,
    onclose,
    oncommentadded,
  }: {
    post: Post;
    sk: any;
    onclose?: () => void;
    oncommentadded?: () => void;
  } = $props();

  let comments = $state<PostComment[]>([]);
  let commentInput = $state('');
  let replyTo = $state<{ commentId: number; username: string } | null>(null);
  let mentionQuery = $state('');
  let mentionResults = $state<User[]>([]);
  let mentionActive = $state(false);
  let mentionIndex = $state(-1);

  interface CommentNode { comment: PostComment; depth: number; parentName?: string }

  function buildTree(list: PostComment[]): CommentNode[] {
    const roots = list.filter(c => !c.parent_id);
    roots.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const out: CommentNode[] = [];
    function walk(c: PostComment, depth: number, parentName?: string) {
      out.push({ comment: c, depth, parentName });
      const children = list.filter(x => x.parent_id === c.id);
      children.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      const nextDepth = depth < 3 ? depth + 1 : depth;
      for (const ch of children) walk(ch, nextDepth, c.display_name || c.username);
    }
    for (const r of roots) walk(r, 0);
    return out;
  }

  function renderText(text: string): string {
    return text.replace(/@(\w+)/g, '<span class="mention">@$1</span>');
  }

  async function onCommentInput(e: Event) {
    const el = e.target as HTMLInputElement;
    const val = el.value;
    commentInput = val;
    const atIdx = val.lastIndexOf('@');
    if (atIdx !== -1 && (atIdx === 0 || val[atIdx - 1] === ' ')) {
      const q = val.slice(atIdx + 1);
      if (q && !q.includes(' ')) {
        mentionQuery = q;
        const res = await emit<User[]>('search_users', { query: q });
        mentionResults = res || [];
        mentionActive = (res || []).length > 0;
        mentionIndex = -1;
        return;
      }
    }
    mentionActive = false;
    mentionResults = [];
  }

  function selectMention(user: User) {
    const atIdx = commentInput.lastIndexOf('@' + mentionQuery);
    if (atIdx !== -1) {
      const before = commentInput.slice(0, atIdx);
      const after = commentInput.slice(atIdx + mentionQuery.length + 1);
      commentInput = before + '@' + user.username + ' ' + after;
    }
    mentionActive = false;
    mentionResults = [];
    mentionQuery = '';
  }

  function onMentionKeydown(e: KeyboardEvent) {
    if (!mentionActive) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); mentionIndex = Math.min(mentionIndex + 1, mentionResults.length - 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); mentionIndex = Math.max(mentionIndex - 1, 0); }
    else if (e.key === 'Enter' && mentionIndex >= 0 && mentionResults[mentionIndex]) {
      e.preventDefault();
      selectMention(mentionResults[mentionIndex]);
    } else if (e.key === 'Escape') { mentionActive = false; mentionResults = []; }
  }

  function startReply(commentId: number, displayName: string) {
    replyTo = { commentId, username: displayName };
    commentInput = '';
  }

  function cancelReply() {
    replyTo = null;
    commentInput = '';
  }

  async function sendComment(parentId?: number) {
    const txt = commentInput.trim();
    if (!txt) return;
    const payload: any = { postId: post.id, text: txt };
    if (parentId) payload.parentId = parentId;
    const res = await emit('add_post_comment', payload);
    if (res?.ok) {
      commentInput = '';
      if (parentId) replyTo = null;
      const list = [...comments];
      list.unshift(res.comment);
      comments = list;
      oncommentadded?.();
    }
  }

  onMount(async () => {
    const list = await emit<PostComment[]>('get_post_comments', { postId: post.id });
    comments = list || [];
  });
</script>

<div class="comment-sheet" onclick={(e) => e.stopPropagation()}>
  <div class="comment-header-bar">
    <span class="comment-sheet-title">Comentarios</span>
    <button class="comment-close-btn" onclick={onclose}>✕</button>
  </div>
  <div class="comment-list-scroll">
    {#each buildTree(comments) as node}
      <div class="comment-item" style="margin-left: {node.depth * 18}px; border-left: {node.depth > 0 && node.depth <= 3 ? '2px solid rgba(255,255,255,0.1)' : 'none'}; padding-left: {node.depth > 0 && node.depth <= 3 ? '8px' : '0'};">
        <img src={avatarUrl(node.comment.user_id, node.comment.avatar)} alt="" class="comment-avatar" />
        <div class="comment-body">
          <div class="comment-header">
            <span class="comment-author">{node.comment.display_name || node.comment.username || 'Anónimo'}</span>
            {#if node.comment.user_id === post.user_id}
              <span class="author-badge">Autor</span>
            {/if}
            {#if node.parentName}
              <span class="reply-indicator">↪ <strong>{node.parentName}</strong></span>
            {/if}
          </div>
          <span class="comment-text">{@html renderText(node.comment.text)}</span>
          <button class="reply-btn" onclick={() => startReply(node.comment.id, node.comment.display_name || node.comment.username)}>{node.depth < 3 ? 'Responder' : 'Comentar'}</button>
          {#if replyTo && replyTo.commentId === node.comment.id}
            <div class="inline-reply">
              <input type="text" bind:value={commentInput} placeholder="Escribe tu respuesta..." class="comment-input" oninput={onCommentInput} onkeydown={(e) => { onMentionKeydown(e); if (e.key === 'Enter' && !mentionActive) sendComment(node.comment.id); }} />
              <button class="small-btn" onclick={() => sendComment(node.comment.id)}>Enviar</button>
              <button class="cancel-reply-btn" onclick={cancelReply}>✕</button>
              {#if mentionActive}
                <div class="mention-dropdown">
                  {#each mentionResults as u, idx}
                    <button class="mention-item {idx === mentionIndex ? 'active' : ''}" type="button" onmousedown={() => selectMention(u)}>{u.display_name || u.username} <span class="mention-username">@{u.username}</span></button>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
        </div>
      </div>
    {/each}
    {#if !comments.length}
      <p class="no-comments">Sin comentarios</p>
    {/if}
  </div>
  <div class="comment-input-area">
    <div class="input-row">
      <input type="text" bind:value={commentInput} placeholder="Comentar..." class="comment-input" oninput={onCommentInput} onkeydown={(e) => { onMentionKeydown(e); if (e.key === 'Enter' && !mentionActive) sendComment(); }} />
      <button class="small-btn" onclick={() => sendComment()}>Enviar</button>
      {#if mentionActive}
        <div class="mention-dropdown">
          {#each mentionResults as u, idx}
            <button class="mention-item {idx === mentionIndex ? 'active' : ''}" type="button" onmousedown={() => selectMention(u)}>{u.display_name || u.username} <span class="mention-username">@{u.username}</span></button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .comment-sheet {
    position: absolute; bottom: 0; left: 0; right: 0; z-index: 10;
    background: var(--bg-2); backdrop-filter: blur(12px);
    border-radius: 16px 16px 0 0;
    max-height: 50vh; display: flex; flex-direction: column;
    animation: slideUp 0.25s ease-out;
  }
  @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
  .comment-header-bar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 16px; border-bottom: 1px solid var(--border);
  }
  .comment-sheet-title { font-size: 15px; font-weight: 700; color: var(--text); }
  .comment-close-btn { background: none; border: none; color: var(--text); font-size: 18px; cursor: pointer; padding: 4px; }
  .comment-list-scroll { flex: 1; overflow-y: auto; padding: 8px 16px; }
  .comment-item { display: flex; gap: 8px; align-items: flex-start; margin-bottom: 10px; }
  .comment-avatar { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
  .comment-body { display: flex; flex-direction: column; gap: 1px; }
  .comment-header { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .comment-author { font-size: 12px; font-weight: 600; color: var(--accent); }
  .author-badge { font-size: 9px; font-weight: 700; color: var(--bg); background: var(--accent); padding: 1px 6px; border-radius: 4px; }
  .reply-indicator { font-size: 10px; color: var(--text-3); }
  .inline-reply { display: flex; gap: 6px; margin-top: 6px; }
  .cancel-reply-btn { background: none; border: none; color: var(--text-3); font-size: 14px; cursor: pointer; padding: 4px; }
  .comment-text { font-size: 13px; color: var(--text); }
  .reply-btn { background: none; border: none; color: var(--text-3); font-size: 11px; cursor: pointer; padding: 0; width: fit-content; font-family: inherit; }
  .reply-btn:hover { color: var(--accent); }
  .no-comments { font-size: 12px; color: var(--text-3); text-align: center; padding: 20px 0; }
  .comment-input-area { padding: 8px 16px; border-top: 1px solid var(--border); }
  .comment-input-area .input-row { display: flex; gap: 8px; }
  .comment-input { flex: 1; padding: 8px 12px; border-radius: 8px; border: none; background: var(--bg-3); color: var(--text); font-size: 13px; outline: none; }
  .comment-input::placeholder { color: var(--text-3); }
  .mention { color: var(--accent); font-weight: 600; }
  .mention-dropdown { position: absolute; bottom: 100%; left: 0; right: 0; background: var(--bg-2); border: 1px solid var(--border); border-radius: 8px; max-height: 160px; overflow-y: auto; z-index: 10; }
  .mention-item { display: flex; align-items: center; gap: 6px; width: 100%; padding: 8px 12px; background: none; border: none; color: var(--text); font-size: 13px; cursor: pointer; text-align: left; font-family: inherit; }
  .mention-item.active { background: var(--bg-3); }
  .mention-username { color: var(--accent); font-size: 11px; }
  .small-btn { padding: 8px 16px; background: var(--accent); color: var(--bg); font-weight: 600; border: none; border-radius: 8px; font-size: 13px; cursor: pointer; white-space: nowrap; }
</style>
