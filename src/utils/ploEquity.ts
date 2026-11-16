// Evaluator e Simulador de Equidade para Texas Hold'em e Pot-Limit Omaha (PLO 4, 5 e 6 cartas)

export type PokerGameVariant = 'holdem' | 'plo4' | 'plo5' | 'plo6'

export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] as const
export const SUITS = ['s', 'h', 'd', 'c'] as const // Spades, Hearts, Diamonds, Clubs

export const SUIT_SYMBOLS: Record<string, string> = {
  s: '♠',
  h: '♥',
  d: '♦',
  c: '♣'
}

export const SUIT_NAMES: Record<string, string> = {
  s: 'Espadas',
  h: 'Copas',
  d: 'Ouros',
  c: 'Paus'
}

// 4-Color deck oficial para máxima legibilidade
export const SUIT_COLORS: Record<string, string> = {
  s: '#0F172A', // Preto / Slate escuro
  h: '#DC2626', // Vermelho
  d: '#2563EB', // Azul
  c: '#16A34A'  // Verde
}

export const SUIT_BG_COLORS: Record<string, string> = {
  s: '#F1F5F9',
  h: '#FEF2F2',
  d: '#EFF6FF',
  c: '#F0FDF4'
}

export const HAND_CATEGORY_NAMES = [
  'Carta Alta',
  'Um Par',
  'Dois Pares',
  'Trinca',
  'Sequência',
  'Flush',
  'Full House',
  'Quadra',
  'Straight Flush'
]

export interface CardData {
  id: number // 0 a 51
  rankIndex: number // 0 (2) a 12 (A)
  suitIndex: number // 0 (s), 1 (h), 2 (d), 3 (c)
  rank: string
  suit: string
  symbol: string
  color: string
  bgColor: string
}

export function getCardData(cardId: number): CardData {
  const rankIndex = cardId >> 2
  const suitIndex = cardId & 3
  const rank = RANKS[rankIndex]
  const suit = SUITS[suitIndex]
  return {
    id: cardId,
    rankIndex,
    suitIndex,
    rank,
    suit,
    symbol: SUIT_SYMBOLS[suit],
    color: SUIT_COLORS[suit],
    bgColor: SUIT_BG_COLORS[suit]
  }
}

export function getRequiredCardCount(variant: PokerGameVariant): number {
  switch (variant) {
    case 'holdem':
      return 2
    case 'plo4':
      return 4
    case 'plo5':
      return 5
    case 'plo6':
      return 6
  }
}

// Avaliação rápida de 5 cartas
export function evaluate5Cards(c: number[]): number {
  const ranks = [c[0] >> 2, c[1] >> 2, c[2] >> 2, c[3] >> 2, c[4] >> 2]
  const suits = [c[0] & 3, c[1] & 3, c[2] & 3, c[3] & 3, c[4] & 3]
  const isFlush = suits[0] === suits[1] && suits[0] === suits[2] && suits[0] === suits[3] && suits[0] === suits[4]

  const counts: Record<number, number> = {}
  for (let i = 0; i < 5; i++) {
    const r = ranks[i]
    counts[r] = (counts[r] || 0) + 1
  }

  const uniqueRanks = Object.keys(counts)
    .map(Number)
    .sort((a, b) => counts[b] - counts[a] || b - a)

  let isStraight = false
  let straightHigh = -1

  if (uniqueRanks.length === 5) {
    const s = [...ranks].sort((a, b) => b - a)
    if (s[0] - s[4] === 4) {
      isStraight = true
      straightHigh = s[0]
    } else if (s[0] === 12 && s[1] === 3 && s[2] === 2 && s[3] === 1 && s[4] === 0) {
      isStraight = true
      straightHigh = 3 // Wheel (A-2-3-4-5)
    }
  }

  if (isFlush && isStraight) return (8 << 20) | straightHigh
  if (counts[uniqueRanks[0]] === 4) return (7 << 20) | (uniqueRanks[0] << 4) | uniqueRanks[1]
  if (counts[uniqueRanks[0]] === 3 && counts[uniqueRanks[1]] === 2) return (6 << 20) | (uniqueRanks[0] << 4) | uniqueRanks[1]
  if (isFlush) {
    return (5 << 20) | (uniqueRanks[0] << 16) | (uniqueRanks[1] << 12) | (uniqueRanks[2] << 8) | (uniqueRanks[3] << 4) | uniqueRanks[4]
  }
  if (isStraight) return (4 << 20) | straightHigh
  if (counts[uniqueRanks[0]] === 3) return (3 << 20) | (uniqueRanks[0] << 8) | (uniqueRanks[1] << 4) | uniqueRanks[2]
  if (counts[uniqueRanks[0]] === 2 && counts[uniqueRanks[1]] === 2) return (2 << 20) | (uniqueRanks[0] << 8) | (uniqueRanks[1] << 4) | uniqueRanks[2]
  if (counts[uniqueRanks[0]] === 2) return (1 << 20) | (uniqueRanks[0] << 12) | (uniqueRanks[1] << 8) | (uniqueRanks[2] << 4) | uniqueRanks[3]
  return (0 << 20) | (uniqueRanks[0] << 16) | (uniqueRanks[1] << 12) | (uniqueRanks[2] << 8) | (uniqueRanks[3] << 4) | uniqueRanks[4]
}

export function getHandCategory(score: number): number {
  return score >> 20
}

export function getHandCategoryName(score: number): string {
  const cat = getHandCategory(score)
  return HAND_CATEGORY_NAMES[cat] || 'Carta Alta'
}

// Combinações de 3 cartas do Board de 5 para Omaha
export const BOARD_TRIPLETS: [number, number, number][] = [
  [0, 1, 2], [0, 1, 3], [0, 1, 4], [0, 2, 3], [0, 2, 4],
  [0, 3, 4], [1, 2, 3], [1, 2, 4], [1, 3, 4], [2, 3, 4]
]

// 21 combinações de 5 cartas de um conjunto de 7 para Texas Hold'em
export const COMBINATIONS_7_CHOOSE_5: [number, number, number, number, number][] = [
  [0, 1, 2, 3, 4], [0, 1, 2, 3, 5], [0, 1, 2, 3, 6],
  [0, 1, 2, 4, 5], [0, 1, 2, 4, 6], [0, 1, 2, 5, 6],
  [0, 1, 3, 4, 5], [0, 1, 3, 4, 6], [0, 1, 3, 5, 6],
  [0, 1, 4, 5, 6],
  [0, 2, 3, 4, 5], [0, 2, 3, 4, 6], [0, 2, 3, 5, 6],
  [0, 2, 4, 5, 6],
  [0, 3, 4, 5, 6],
  [1, 2, 3, 4, 5], [1, 2, 3, 4, 6], [1, 2, 3, 5, 6],
  [1, 2, 4, 5, 6],
  [1, 3, 4, 5, 6],
  [2, 3, 4, 5, 6]
]

// Gera pares de cartas da mão para Omaha (exatamente 2 cartas da mão!)
export function getHandPairs(numCards: number): [number, number][] {
  const pairs: [number, number][] = []
  for (let i = 0; i < numCards; i++) {
    for (let j = i + 1; j < numCards; j++) {
      pairs.push([i, j])
    }
  }
  return pairs
}

export const PAIRS_MAP: Record<number, [number, number][]> = {
  4: getHandPairs(4),
  5: getHandPairs(5),
  6: getHandPairs(6)
}

// Avalia a melhor mão Omaha de um jogador em um board (3 a 5 cartas)
export function evaluateOmahaHand(holeCards: number[], board: number[], pairs: [number, number][]): number {
  if (board.length < 3) return 0
  const triplets: [number, number, number][] =
    board.length === 3
      ? [[0, 1, 2]]
      : board.length === 4
      ? [
          [0, 1, 2],
          [0, 1, 3],
          [0, 2, 3],
          [1, 2, 3]
        ]
      : BOARD_TRIPLETS

  let best = -1
  const five = [0, 0, 0, 0, 0]

  for (let p = 0; p < pairs.length; p++) {
    five[0] = holeCards[pairs[p][0]]
    five[1] = holeCards[pairs[p][1]]

    for (let b = 0; b < triplets.length; b++) {
      five[2] = board[triplets[b][0]]
      five[3] = board[triplets[b][1]]
      five[4] = board[triplets[b][2]]

      const score = evaluate5Cards(five)
      if (score > best) best = score
    }
  }

  return best
}

// Avalia a melhor mão Texas Hold'em de um jogador (2 cartas da mão + 3 a 5 do board)
export function evaluateHoldemHand(holeCards: number[], board: number[]): number {
  const pool = [...holeCards, ...board]
  if (pool.length < 5) return 0
  if (pool.length === 5) return evaluate5Cards(pool)

  let best = -1
  const five = [0, 0, 0, 0, 0]

  if (pool.length === 6) {
    for (let skip = 0; skip < 6; skip++) {
      let idx = 0
      for (let i = 0; i < 6; i++) {
        if (i !== skip) five[idx++] = pool[i]
      }
      const score = evaluate5Cards(five)
      if (score > best) best = score
    }
    return best
  }

  // pool de 7 cartas
  for (let c = 0; c < 21; c++) {
    const combo = COMBINATIONS_7_CHOOSE_5[c]
    five[0] = pool[combo[0]]
    five[1] = pool[combo[1]]
    five[2] = pool[combo[2]]
    five[3] = pool[combo[3]]
    five[4] = pool[combo[4]]
    const score = evaluate5Cards(five)
    if (score > best) best = score
  }

  return best
}

export interface PlayerInput {
  id: string
  name: string
  cards: (number | null)[]
  color: string
}

export interface PlayerResult {
  id: string
  name: string
  color: string
  equity: number // Porcentagem de 0 a 100
  winPct: number
  tiePct: number
  bestHandName: string
  categoryCounts: number[]
}

export interface SimulationResult {
  players: PlayerResult[]
  totalSimulations: number
  timeMs: number
}

// Embaralhamento rápido de Fisher-Yates
function shuffle(array: number[], rng: () => number) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const temp = array[i]
    array[i] = array[j]
    array[j] = temp
  }
}

// Simulador Monte Carlo de Equidade para Hold'em e Omaha
export function runEquitySimulation(
  variant: PokerGameVariant,
  playersInput: { id: string; name: string; cards: number[]; color: string }[],
  board: number[],
  targetSimulations = 2500
): SimulationResult {
  const startTime = Date.now()
  const reqCards = getRequiredCardCount(variant)

  const validPlayers = playersInput.filter((p) => p.cards.length === reqCards)
  if (validPlayers.length < 2) {
    return {
      players: playersInput.map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        equity: 0,
        winPct: 0,
        tiePct: 0,
        bestHandName: '-',
        categoryCounts: new Array(9).fill(0)
      })),
      totalSimulations: 0,
      timeMs: 0
    }
  }

  // Prepara o baralho excluindo cartas já em jogo
  const usedCards = new Set<number>()
  validPlayers.forEach((p) => p.cards.forEach((c) => usedCards.add(c)))
  board.forEach((c) => usedCards.add(c))

  const remainingDeck: number[] = []
  for (let c = 0; c < 52; c++) {
    if (!usedCards.has(c)) {
      remainingDeck.push(c)
    }
  }

  const numPlayers = validPlayers.length
  const isHoldem = variant === 'holdem'
  const pairsList = isHoldem ? [] : validPlayers.map((p) => PAIRS_MAP[p.cards.length] || getHandPairs(p.cards.length))

  const wins = new Array(numPlayers).fill(0)
  const ties = new Array(numPlayers).fill(0)
  const categoryCounts = validPlayers.map(() => new Array(9).fill(0))

  const boardNeeded = 5 - board.length
  const isExactSingleRunout = boardNeeded === 0
  const iterations = isExactSingleRunout ? 1 : targetSimulations

  const fullBoard = [...board, 0, 0, 0, 0, 0].slice(0, 5)
  const deckCopy = [...remainingDeck]
  const scores = new Array(numPlayers).fill(0)

  // Pseudo-RNG rápido
  let seed = 123456789
  const fastRng = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }

  const pool7 = [0, 0, 0, 0, 0, 0, 0]
  const five = [0, 0, 0, 0, 0]

  for (let iter = 0; iter < iterations; iter++) {
    if (boardNeeded > 0) {
      shuffle(deckCopy, fastRng)
      let deckIdx = 0
      for (let i = board.length; i < 5; i++) {
        fullBoard[i] = deckCopy[deckIdx++]
      }
    }

    let bestScore = -1

    for (let p = 0; p < numPlayers; p++) {
      let score = -1
      if (isHoldem) {
        pool7[0] = validPlayers[p].cards[0]
        pool7[1] = validPlayers[p].cards[1]
        pool7[2] = fullBoard[0]
        pool7[3] = fullBoard[1]
        pool7[4] = fullBoard[2]
        pool7[5] = fullBoard[3]
        pool7[6] = fullBoard[4]

        let holdemBest = -1
        for (let c = 0; c < 21; c++) {
          const combo = COMBINATIONS_7_CHOOSE_5[c]
          five[0] = pool7[combo[0]]
          five[1] = pool7[combo[1]]
          five[2] = pool7[combo[2]]
          five[3] = pool7[combo[3]]
          five[4] = pool7[combo[4]]
          const s = evaluate5Cards(five)
          if (s > holdemBest) holdemBest = s
        }
        score = holdemBest
      } else {
        score = evaluateOmahaHand(validPlayers[p].cards, fullBoard, pairsList[p])
      }

      scores[p] = score
      categoryCounts[p][getHandCategory(score)]++
      if (score > bestScore) bestScore = score
    }

    let numWinners = 0
    for (let p = 0; p < numPlayers; p++) {
      if (scores[p] === bestScore) numWinners++
    }

    if (numWinners === 1) {
      for (let p = 0; p < numPlayers; p++) {
        if (scores[p] === bestScore) wins[p]++
      }
    } else {
      for (let p = 0; p < numPlayers; p++) {
        if (scores[p] === bestScore) ties[p] += 1 / numWinners
      }
    }
  }

  const timeMs = Date.now() - startTime

  // Calcula nome da mão atual (se houver pelo menos 3 cartas no board)
  const bestNames = validPlayers.map((p, idx) => {
    if (board.length >= 3) {
      if (isHoldem) {
        return getHandCategoryName(evaluateHoldemHand(p.cards, board))
      } else {
        return getHandCategoryName(evaluateOmahaHand(p.cards, board, pairsList[idx]))
      }
    }
    return '-'
  })

  const results: PlayerResult[] = validPlayers.map((p, idx) => {
    const winRate = (wins[idx] / iterations) * 100
    const tieRate = (ties[idx] / iterations) * 100
    const equity = winRate + tieRate

    return {
      id: p.id,
      name: p.name,
      color: p.color,
      equity: Math.round(equity * 10) / 10,
      winPct: Math.round(winRate * 10) / 10,
      tiePct: Math.round(tieRate * 10) / 10,
      bestHandName: bestNames[idx],
      categoryCounts: categoryCounts[idx]
    }
  })

  // Mapeia de volta para todos os jogadores do input original
  const fullResults = playersInput.map((inputP) => {
    const res = results.find((r) => r.id === inputP.id)
    if (res) return res
    return {
      id: inputP.id,
      name: inputP.name,
      color: inputP.color,
      equity: 0,
      winPct: 0,
      tiePct: 0,
      bestHandName: '-',
      categoryCounts: new Array(9).fill(0)
    }
  })

  return {
    players: fullResults,
    totalSimulations: iterations,
    timeMs
  }
}

// Alias para compatibilidade anterior
export function runPloSimulation(
  playersInput: { id: string; name: string; cards: number[]; color: string }[],
  board1: number[],
  _board2?: number[] | null,
  targetSimulations = 2500
): SimulationResult {
  const firstLen = playersInput[0]?.cards.length || 4
  const variant: PokerGameVariant = firstLen === 2 ? 'holdem' : firstLen === 5 ? 'plo5' : firstLen === 6 ? 'plo6' : 'plo4'
  return runEquitySimulation(variant, playersInput, board1, targetSimulations)
}
