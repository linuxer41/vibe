/**
 * Vibe Recommendation Engine v3 — Advanced
 *
 * Arquitectura Two-Tower + MMR + Online Learning + Contextual Bandit
 *
 * ● Tower Usuario: embedding = weighted sum of interacted post embeddings
 * ● Tower Post: embedding TF-IDF sparse sobre tags + media_type
 * ● Scoring: dot product user_emb · post_emb + bias terms
 * ● Re-ranking: MMR (Maximum Marginal Relevance) para diversidad
 * ● Online Learning: SGD con momentum, cada interacción actualiza user_emb
 * ● Contextual Bandit: ε-greedy con ε decay basado en interacciones totales
 * ● Bias Correction: posición, popularidad, frescura (IPS)
 * ● Multi-objective: engagement corto plazo + valor largo plazo
 */

// --- CONSTANTES ---
const D = 64;                // dimensión del embedding (sparse → dense projection)
const LR = 0.05;             // learning rate para online learning
const MOMENTUM = 0.85;       // momentum
const EPSILON_INIT = 0.15;   // exploración inicial
const EPSILON_DECAY = 0.97;  // decay por cada 100 interacciones
const BANDIT_COOLDOWN = 5;   // slots entre exploraciones forzadas
const MMR_LAMBDA = 0.7;      // peso de relevancia vs diversidad en MMR
const FRESHNESS_WINDOW = 72; // horas
const LONG_TERM_DECAY = 0.9; // decaimiento diario de embedding largo plazo
const SESSION_DECAY = 0.95;  // decaimiento por paso en sesión actual

// Pesos multi-objetivo (engagement types)
const OBJ_WEIGHTS = {
  like: { short: 1.0, long: 0.3 },
  comment: { short: 0.8, long: 0.6 },
  share: { short: 1.2, long: 0.8 },
  dwell2: { short: 0.3, long: 0.1 },
  dwell10: { short: 0.6, long: 0.3 },
  dwell30: { short: 1.0, long: 0.7 },
  follow: { short: 0.5, long: 2.0 },
  negative: { short: -0.5, long: -1.0 },
};

// --- EXTRACCIÓN MEJORADA (incluye media_type como tag) ---
function extractTags(text, mediaType = 'text') {
  const tags = new Set();
  if (mediaType && mediaType !== 'text') tags.add(`__media_${mediaType}`);
  if (!text) return [...tags];

  // Hashtags exactos
  (text.match(/#[\wáéíóúüñ]+/gi) || []).forEach(h => tags.add(h.toLowerCase()));

  // Bigramas y unigramas significativos
  const words = text.toLowerCase()
    .replace(/[^a-záéíóúüña-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));

  words.forEach(w => tags.add(w));

  // Bigramas
  for (let i = 0; i < words.length - 1; i++) {
    tags.add(`${words[i]}_${words[i + 1]}`);
  }

  return [...tags];
}

// --- STOP WORDS (ES + EN) ---
const STOP_WORDS = new Set([
  'que','para','por','con','las','los','una','este','esta','como','más','pero',
  'sus','han','ella','ello','sido','tiene','tener','todo','muy','también','según',
  'entre','hasta','sobre','donde','cada','puede','dice','parte','caso','tanto',
  'luego','nunca','forma','lugar','medio','menos','gran','tipo','tema','cual',
  'cómo','qué','esto','what','when','where','which','that','this','with','from',
  'have','been','were','their','there','would','about','could','should','because',
  'when','then','them','than','some','also','other','only','into','your','more',
  'will','does','made','make','like','just','know','well','back','even','much',
  'such','here','very','over','still','before','after','while','most','many',
  'same','another','both','each','few','those','these','during','without',
  'through','against','within','down','out','off','above','below','under',
  'again','further','once','also','yet','shall','may','might','can','must',
]);

// --- KERNEL DE TIEMPO (Exponencial doble) ---
function temporalKernel(hoursAge, peakHour = 2) {
  const h = Math.max(0, hoursAge);
  return Math.exp(-0.5 * ((h - peakHour) / 8) ** 2) * (1 + 0.5 * Math.cos((h / 24) * Math.PI));
}

// --- BIAS CORRECTION: Inverse Propensity Scoring ---
function ipsWeight(globalPopularity, maxPop, position) {
  const popScore = maxPop ? Math.min(globalPopularity / maxPop, 1) : 0;
  const prop = 0.1 + 0.9 * (1 - popScore);  // menos probable de ver si es popular
  const posDebias = 1 + 0.2 * Math.max(0, 10 - position); // posición temprana sobrerrepresentada
  return (1 / prop) * posDebias;
}

// --- DOT PRODUCT USER-POST ---
function scoreUserPost(userEmb, postEmb, bias = 0) {
  if (!userEmb || !postEmb || userEmb.length !== postEmb.length) return 0;
  let dot = 0;
  for (let i = 0; i < userEmb.length; i++) {
    dot += userEmb[i] * postEmb[i];
  }
  return dot + bias;
}

// --- NORMALIZAR VECTOR ---
function normalize(v) {
  let mag = 0;
  for (let i = 0; i < v.length; i++) mag += v[i] * v[i];
  mag = Math.sqrt(mag) || 1;
  return v.map(x => x / mag);
}

// --- CONSTRUIR EMBEDDING DE POST (sparse → dense projection) ---
// Usa hashing trick para proyectar tags a vector denso D-dimensional
function buildPostEmbedding(tags, tagToIdx, embDim = D) {
  const emb = new Float64Array(embDim);
  for (const tag of tags) {
    let idx = tagToIdx[tag];
    if (idx === undefined) {
      idx = hashTag(tag, embDim);
    }
    emb[idx % embDim] += 1;
  }
  return normalize([...emb]);
}

// --- HASH TRICK para proyectar tags nuevos ---
function hashTag(tag, dim) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    const ch = tag.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash |= 0;
  }
  return Math.abs(hash) % dim;
}

// --- ONLINE LEARNING: actualizar user embedding con SGD + momentum ---
// userEmb = userEmb * (1 - LR) + postEmb * LR * weight + momentum
function updateUserEmbedding(userEmb, postEmb, weight, momentumBuf, lr = LR) {
  if (!userEmb || !postEmb || userEmb.length !== postEmb.length) return userEmb;
  const newEmb = [];
  for (let i = 0; i < userEmb.length; i++) {
    const grad = userEmb[i] - postEmb[i] * weight;
    momentumBuf[i] = MOMENTUM * momentumBuf[i] + lr * grad;
    newEmb[i] = userEmb[i] - momentumBuf[i];
  }
  return normalize(newEmb);
}

// --- ACTUALIZAR MOMENTUM (llamado ANTES de la inferencia) ---
function createMomentumBuffer(dim = D) {
  return new Float64Array(dim);
}

// --- MMR: Maximum Marginal Relevance para diversidad ---
function mmrSelect(candidates, relevanceScores, postEmbeddings, lambda = MMR_LAMBDA, topK = 10) {
  if (!candidates.length) return [];

  const selected = [];
  const selectedEmbs = [];
  const available = candidates.map((id, i) => i);

  for (let k = 0; k < Math.min(topK, candidates.length); k++) {
    let bestIdx = -1;
    let bestScore = -Infinity;

    for (const i of available) {
      const rel = relevanceScores[i];
      let maxSim = 0;
      for (const sEmb of selectedEmbs) {
        const sim = cosineSimilarityDense(postEmbeddings[i], sEmb);
        if (sim > maxSim) maxSim = sim;
      }
      const mmrScore = lambda * rel - (1 - lambda) * maxSim;
      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0) {
      selected.push(candidates[bestIdx]);
      selectedEmbs.push(postEmbeddings[bestIdx]);
      available.splice(available.indexOf(bestIdx), 1);
    }
  }

  return selected;
}

// --- COSINE SIMILARITY DENSE ---
function cosineSimilarityDense(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

// --- SCORE DE FRESCURA (kernel temporal) ---
function freshnessScore(hoursAge) {
  return temporalKernel(hoursAge, 2);
}

// --- CONTEXTUAL BANDIT: ε-greedy con decay ---
function shouldExplore(totalInteractions, slotCounter) {
  const eps = EPSILON_INIT * Math.pow(EPSILON_DECAY, Math.floor(totalInteractions / 100));
  return Math.random() < eps || (slotCounter % BANDIT_COOLDOWN === 0);
}

// --- SCORE MULTI-OBJETIVO ---
function multiObjectiveScore(shortTerm, longTerm, alpha = 0.6) {
  return alpha * shortTerm + (1 - alpha) * longTerm;
}

// --- INTERACTION WEIGHT MAP ---
function interactionWeight(type, value = 1) {
  const w = OBJ_WEIGHTS[type];
  if (!w) return value;
  return (w.short + w.long) / 2 * value;
}

// --- SCORE COMPUESTO COMPLETO (incluye bias correction + multi-objective) ---
function computeFinalScoreAdvanced({
  relevance,           // dot product user_emb · post_emb
  freshness,           // temporalKernel
  globalPop,           // popularidad global
  maxPop,              // max popularidad en candidatos
  position,            // posición en ranking inicial
  shortTerm,           // predicted short-term engagement
  longTerm,            // predicted long-term value
  creatorDiversity,    // 0..1 qué tan diverso es este creador
  tagNovelty,          // 0..1 qué tan nuevo es este tag-set
}) {
  const ips = ipsWeight(globalPop, maxPop, position);
  const fresh = freshness;
  const multObj = multiObjectiveScore(shortTerm, longTerm);
  const divBonus = 0.1 * creatorDiversity + 0.1 * tagNovelty;

  return (
    relevance * 0.30 * ips +
    fresh * 0.15 +
    multObj * 0.30 +
    divBonus * 0.15 +
    (globalPop > 0 ? Math.tanh(globalPop * 0.01) * 0.10 : 0)
  );
}

module.exports = {
  extractTags,
  temporalKernel,
  ipsWeight,
  scoreUserPost,
  normalize,
  buildPostEmbedding,
  hashTag,
  updateUserEmbedding,
  createMomentumBuffer,
  mmrSelect,
  cosineSimilarityDense,
  freshnessScore,
  shouldExplore,
  multiObjectiveScore,
  computeFinalScoreAdvanced,
  interactionWeight,
  OBJ_WEIGHTS,
  D,
  LR,
  MOMENTUM,
  STOP_WORDS,
};
