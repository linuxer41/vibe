# Vibe Recommendation Engine v3 — Advanced Two-Tower + MMR + Online Learning + Contextual Bandit

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        RECOMMENDATION PIPELINE                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  USER ACTS ──► recordInteraction() ──► Online Learning (SGD)       │
│  (like/dwell/                            │                          │
│   comment/etc)                           ▼                          │
│                                    User Embedding                   │
│                                    (updated w/ momentum)            │
│                                                                     │
│  POST CREATED ──► storePostTags() ──► Post Embedding (hash trick)   │
│                                         │                           │
│                                         ▼                           │
│                                    global_embeddings table          │
│                                                                     │
│  USER OPENS ──► getRecommendedPosts()                                │
│  /for-you            │                                              │
│                      ▼                                              │
│              1. CANDIDATE SELECTION                                 │
│                 • global_embeddings (all posts with embeddings)     │
│                 • Exclude seen + interacted posts                   │
│                 • Limit 300                                         │
│                      │                                              │
│                      ▼                                              │
│              2. SCORING (6 factors per candidate)                    │
│                 • relevance (dot product user_emb · post_emb)       │
│                 • freshness (temporal kernel)                       │
│                 • short-term engagement (24h interactions)          │
│                 • long-term value (text length, creator quality)    │
│                 • creator diversity (avoid same creator spam)       │
│                 • tag novelty (explore new topics)                  │
│                      │                                              │
│                      ▼                                              │
│              3. COLD START BLEND                                    │
│                 • If interactions < 5: blend coldScore + normalScore│
│                 • coldScore favors freshness (35%) + novelty (20%)  │
│                 • Decays smoothly as user interacts                 │
│                      │                                              │
│                      ▼                                              │
│              4. MMR RE-RANKING                                      │
│                 • λ=0.65 normal / λ=0.40 cold start                 │
│                 • Penalizes similarity between selected posts       │
│                 • Ensures diverse results                           │
│                      │                                              │
│                      ▼                                              │
│              5. CONTEXTUAL BANDIT                                   │
│                 • ε-greedy with ε=0.15, decay 0.97/100 interactions │
│                 • Force exploration every 5 slots                   │
│                 • Cold start: picks fresh posts for exploration     │
│                      │                                              │
│                      ▼                                              │
│              6. RETURN TOP N                                        │
│                 • Strip embeddings from response                    │
│                 • Include matched_interests for UI                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Core Constants

| Constant | Value | Meaning |
|---|---|---|
| `D` | 64 | Embedding dimension |
| `LR` | 0.05 | SGD learning rate |
| `MOMENTUM` | 0.85 | SGD momentum |
| `EPSILON_INIT` | 0.15 | Initial exploration rate |
| `EPSILON_DECAY` | 0.97 | Decay per 100 interactions |
| `BANDIT_COOLDOWN` | 5 | Force exploration every N slots |
| `MMR_LAMBDA` | 0.65 / 0.40 | Relevance vs diversity (normal / cold start) |
| `FRESHNESS_WINDOW` | 72h | Temporal kernel peak |

## Tables (007_recommendations.sql)

### `post_tags`
- `post_id`, `tag`, `UNIQUE(post_id, tag)`
- Stores extracted keywords per post (hashtags, unigrams, bigrams)

### `post_interactions`
- `user_id`, `post_id`, `interaction_type` (like/comment/share/dwell/negative), `weight`
- `UNIQUE(user_id, post_id, interaction_type)`
- Raw interaction log used for collaborative filtering and engagement computation

### `user_interests`
- `user_id`, `keyword`, `score`
- Aggregated interest keywords with decay (0.85 per interaction)
- Used for tag novelty scoring and UI display

### `user_embeddings`
- `user_id`, `embedding` (JSONB), `momentum` (JSONB), `total_interactions`, `slot_counter`
- Persisted online learning state per user
- Cold start: built from `bio` + `display_name` + `@username`

### `global_embeddings`
- `post_id`, `embedding` (JSONB), `tags` (TEXT[])
- Cached post embeddings built at post creation time

## Scoring Details

### `computeFinalScoreAdvanced`

```javascript
score = relevance * 0.30 * IPS + freshness * 0.15 + multiObjective * 0.30
      + diversityBonus * 0.15 + popularityBonus * 0.10
```

### Bias Correction (IPS)

```javascript
// Inverse Propensity Scoring — corrects for popularity bias
propensity = 0.1 + 0.9 * (1 - popularity / maxPop)
positionDebias = 1 + 0.2 * max(0, 10 - position)
ipsWeight = (1 / propensity) * positionDebias
```

Popular posts get lower propensity → lower IPS weight → fairer chance for less popular content.

### Multi-Objective Scoring

```javascript
alpha = 0.6  // short-term vs long-term weight
score = alpha * shortTerm + (1 - alpha) * longTerm
```

Short-term: likes, comments, shares, dwell time (next-hour engagement prediction)
Long-term: follows, return rate, content depth (>50 char text = 0.6 vs 0.3)

### Temporal Kernel

```javascript
freshness = exp(-0.5 * ((hoursAge - 2) / 8)²) * (1 + 0.5 * cos((hoursAge / 24) * π))
```

Peaks at 2 hours, oscillates daily. Posts get a boost when they're fresh and at the same time of day.

### Interaction Weights

| Type | Short-term | Long-term |
|---|---|---|
| `like` | 1.0 | 0.3 |
| `comment` | 0.8 | 0.6 |
| `share` | 1.2 | 0.8 |
| `dwell2` (2s) | 0.3 | 0.1 |
| `dwell10` (10s) | 0.6 | 0.3 |
| `dwell30` (30s+) | 1.0 | 0.7 |
| `follow` | 0.5 | 2.0 |
| `negative` (skip/hide) | -0.5 | -1.0 |

## Online Learning (SGD + Momentum)

```javascript
// At each interaction:
gradient = userEmb[i] - postEmb[i] * weight
momentum[i] = MOMENTUM * momentum[i] + LR * gradient
userEmb[i] = userEmb[i] - momentum[i]
normalize(userEmb)
```

- Positive interactions pull user embedding toward post embedding
- Negative interactions (skip, hide) push user away
- Momentum accelerates convergence in consistent directions
- Embedding is L2-normalized after each update

## Cold Start Strategy

When `totalInteractions < 3`:

1. **Profile embedding**: scan `bio`, `display_name`, `@username` for tags → build initial embedding
2. **Cold blend ratio**: `coldRatio = max(0, 1 - totalInteractions / 5)` → smooth decay to 0 after 5 interactions
3. **Cold score**: `freshness*0.35 + novelty*0.20 + diversity*0.15 + popularity*0.20 + relevance*0.10`
4. **MMR λ=0.40**: more diversity, less weight on weak relevance signal

## MMR (Maximum Marginal Relevance)

```javascript
mmrScore = λ * relevance(i) - (1 - λ) * max_similarity(i, selected)
```

Greedy selection: at each step, pick the candidate that maximizes relevance while minimizing similarity to already-selected posts. Similarity = cosine distance between post embeddings.

## Contextual Bandit (ε-greedy)

```javascript
ε = 0.15 * 0.97 ^ floor(totalInteractions / 100)
explore = random() < ε || (slotCounter % 5 === 0)
```

When exploring:
- Pick a random fresh post (< 2h old) from the candidate pool
- If none available, pick any non-selected candidate
- This ensures the model discovers new content even for high-interaction users

## Frontend Integration (`/for-you`)

- **TikTok-style scroll snap**: vertical feed, one post per full screen
- **Auto-play video**: IntersectionObserver at 60% threshold triggers play
- **Double-tap like**: heart animation (heartPop keyframes)
- **Dwell tracking**: 3s timer → `record_interaction('dwell', 10)`
- **Interaction recording**: view, like, comment, share, dwell → all fed back into the engine

## File Reference

| File | Role |
|---|---|
| `backend-node/lib/recommend.js` | Core algorithm: scoring, MMR, bandit, online learning |
| `backend-node/db/init.js` | DB integration: `recordInteraction`, `getRecommendedPosts`, `getOrCreateUserEmbedding` |
| `backend-node/db/007_recommendations.sql` | Schema: post_tags, post_interactions, user_interests, user_embeddings, global_embeddings |
| `backend-node/server.js` | Socket handlers: `record_interaction`, `get_recommended_posts`, `get_trending_tags` |
| `frontend/src/routes/(app)/for-you/+page.svelte` | TikTok-style feed UI |
| `backend-node/tests/handlers.test.js` | Unit tests (snowflake, sanitize, healthcheck) |
