import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../theme'
import {
  CardData,
  getCardData,
  getRequiredCardCount,
  PlayerResult,
  PokerGameVariant,
  RANKS,
  runEquitySimulation,
  SUIT_COLORS,
  SUIT_SYMBOLS,
  SUITS
} from '../utils/ploEquity'

interface PlayerState {
  id: string
  name: string
  color: string
  cards: (number | null)[]
}

const PLAYER_COLORS = [
  '#2563EB', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4'  // Cyan
]

type TargetSlot =
  | { type: 'player'; playerIndex: number; cardIndex: number }
  | { type: 'board'; cardIndex: number }
  | null

const VARIANTS: { id: PokerGameVariant; label: string; sub: string }[] = [
  { id: 'holdem', label: "Hold'em", sub: '2 cartas' },
  { id: 'plo4', label: 'PLO 4', sub: '4 cartas' },
  { id: 'plo5', label: 'PLO 5', sub: '5 cartas' },
  { id: 'plo6', label: 'PLO 6', sub: '6 cartas' }
]

export function PloCalculator() {
  const [variant, setVariant] = useState<PokerGameVariant>('holdem')

  // Jogadores (inicia com 2 jogadores, cada um com a quantidade de cartas da variante)
  const [players, setPlayers] = useState<PlayerState[]>([
    { id: 'p1', name: 'Jogador 1', color: PLAYER_COLORS[0], cards: [null, null] },
    { id: 'p2', name: 'Jogador 2', color: PLAYER_COLORS[1], cards: [null, null] }
  ])

  // Board (5 cartas: Flop 1, 2, 3, Turn, River)
  const [board, setBoard] = useState<(number | null)[]>([null, null, null, null, null])

  // Resultados da simulação
  const [results, setResults] = useState<PlayerResult[] | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [simInfo, setSimInfo] = useState<{ total: number; timeMs: number } | null>(null)

  // Card Picker Modal
  const [pickerVisible, setPickerVisible] = useState(false)
  const [activeSlot, setActiveSlot] = useState<TargetSlot>(null)

  const reqCardCount = getRequiredCardCount(variant)

  // Atualiza quantidade de cartas dos jogadores ao mudar a variante
  const handleSelectVariant = (newVariant: PokerGameVariant) => {
    setVariant(newVariant)
    const newCount = getRequiredCardCount(newVariant)
    setPlayers((prev) =>
      prev.map((player) => {
        const newCards = new Array(newCount).fill(null)
        for (let i = 0; i < Math.min(player.cards.length, newCount); i++) {
          newCards[i] = player.cards[i]
        }
        return { ...player, cards: newCards }
      })
    )
    setResults(null)
  }

  // Conjunto de cartas já em uso no baralho
  const usedCardsSet = useMemo(() => {
    const set = new Set<number>()
    players.forEach((p) => p.cards.forEach((c) => { if (c !== null) set.add(c) }))
    board.forEach((c) => { if (c !== null) set.add(c) })
    return set
  }, [players, board])

  // Executa o cálculo de equidade
  const calcularEquidade = useCallback(() => {
    setIsCalculating(true)
    setTimeout(() => {
      try {
        const boardCards = board.filter((c): c is number => c !== null)

        const validPlayersInput = players.map((p) => ({
          id: p.id,
          name: p.name,
          color: p.color,
          cards: p.cards.filter((c): c is number => c !== null)
        }))

        const sim = runEquitySimulation(variant, validPlayersInput, boardCards, 2500)
        setResults(sim.players)
        setSimInfo({ total: sim.totalSimulations, timeMs: sim.timeMs })
      } finally {
        setIsCalculating(false)
      }
    }, 15)
  }, [players, board, variant])

  // Recalcula automaticamente sempre que todos os jogadores têm mãos completas
  useEffect(() => {
    const allHaveFullHands = players.every((p) => p.cards.length === reqCardCount && p.cards.every((c) => c !== null))
    if (allHaveFullHands && players.length >= 2) {
      calcularEquidade()
    }
  }, [players, board, reqCardCount, calcularEquidade])

  // Adicionar Jogador (máximo 6)
  const adicionarJogador = () => {
    if (players.length >= 6) return
    const idx = players.length
    const novoPlayer: PlayerState = {
      id: `p${idx + 1}-${Date.now()}`,
      name: `Jogador ${idx + 1}`,
      color: PLAYER_COLORS[idx % PLAYER_COLORS.length],
      cards: new Array(reqCardCount).fill(null)
    }
    setPlayers((prev) => [...prev, novoPlayer])
  }

  // Remover Jogador (mínimo 2)
  const removerJogador = (playerIndex: number) => {
    if (players.length <= 2) return
    setPlayers((prev) => prev.filter((_, i) => i !== playerIndex))
    setResults(null)
  }

  // Limpar mão de um jogador
  const limparMaoJogador = (playerIndex: number) => {
    setPlayers((prev) =>
      prev.map((p, idx) => (idx === playerIndex ? { ...p, cards: new Array(reqCardCount).fill(null) } : p))
    )
    setResults(null)
  }

  // Limpar Board
  const limparBoard = () => {
    setBoard([null, null, null, null, null])
    setResults(null)
  }

  // Limpar Tudo (Reset)
  const limparTudo = () => {
    setPlayers((prev) =>
      prev.map((p) => ({ ...p, cards: new Array(reqCardCount).fill(null) }))
    )
    setBoard([null, null, null, null, null])
    setResults(null)
    setSimInfo(null)
  }

  // Abrir Picker para um slot específico
  const abrirPicker = (slot: TargetSlot) => {
    setActiveSlot(slot)
    setPickerVisible(true)
  }

  // Encontra o próximo slot vazio para avanço automático
  const encontrarProximoSlotVazio = (currentSlot: TargetSlot): TargetSlot => {
    if (!currentSlot) return null

    if (currentSlot.type === 'player') {
      const pIdx = currentSlot.playerIndex
      const cIdx = currentSlot.cardIndex

      // Próxima carta do mesmo jogador
      if (cIdx + 1 < reqCardCount) {
        return { type: 'player', playerIndex: pIdx, cardIndex: cIdx + 1 }
      }
      // Próximo jogador
      if (pIdx + 1 < players.length) {
        return { type: 'player', playerIndex: pIdx + 1, cardIndex: 0 }
      }
      // Avança para o board
      return { type: 'board', cardIndex: 0 }
    }

    if (currentSlot.type === 'board') {
      if (currentSlot.cardIndex + 1 < 5) {
        return { type: 'board', cardIndex: currentSlot.cardIndex + 1 }
      }
      return null
    }

    return null
  }

  // Selecionar carta no Picker
  const selecionarCarta = (cardId: number) => {
    if (!activeSlot) return

    if (activeSlot.type === 'player') {
      setPlayers((prev) =>
        prev.map((p, pIdx) => {
          if (pIdx !== activeSlot.playerIndex) return p
          const newCards = [...p.cards]
          newCards[activeSlot.cardIndex] = cardId
          return { ...p, cards: newCards }
        })
      )
    } else if (activeSlot.type === 'board') {
      setBoard((prev) => {
        const next = [...prev]
        next[activeSlot.cardIndex] = cardId
        return next
      })
    }

    // Auto-advance para o próximo slot
    const proximo = encontrarProximoSlotVazio(activeSlot)
    setActiveSlot(proximo)
  }

  // Remover carta do slot ativo
  const limparCartaSlotAtivo = () => {
    if (!activeSlot) return

    if (activeSlot.type === 'player') {
      setPlayers((prev) =>
        prev.map((p, pIdx) => {
          if (pIdx !== activeSlot.playerIndex) return p
          const newCards = [...p.cards]
          newCards[activeSlot.cardIndex] = null
          return { ...p, cards: newCards }
        })
      )
    } else if (activeSlot.type === 'board') {
      setBoard((prev) => {
        const next = [...prev]
        next[activeSlot.cardIndex] = null
        return next
      })
    }
  }

  // Renderizador de um slot de carta individual
  const renderCardSlot = (
    cardId: number | null,
    onPress: () => void,
    isSelected: boolean,
    size: 'normal' | 'small' = 'normal'
  ) => {
    if (cardId === null) {
      return (
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.7}
          style={[
            styles.cardSlotEmpty,
            size === 'small' && styles.cardSlotEmptySmall,
            isSelected && styles.cardSlotSelected
          ]}
        >
          <Ionicons name="add" size={size === 'small' ? 14 : 18} color="#94A3B8" />
        </TouchableOpacity>
      )
    }

    const card = getCardData(cardId)
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={[
          styles.cardSlotFilled,
          size === 'small' && styles.cardSlotFilledSmall,
          isSelected && styles.cardSlotSelected
        ]}
      >
        <Text style={[styles.cardRank, size === 'small' && styles.cardRankSmall, { color: card.color }]}>
          {card.rank}
        </Text>
        <Text style={[styles.cardSymbol, size === 'small' && styles.cardSymbolSmall, { color: card.color }]}>
          {card.symbol}
        </Text>
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      {/* ======================================================== */}
      {/* HEADER DA CALCULADORA */}
      {/* ======================================================== */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="calculator" size={20} color={colors.primary} />
            <Text style={styles.title}>Calculadora de Equidade</Text>
          </View>
          <Text style={styles.subtitle}>
            {variant === 'holdem'
              ? "Texas Hold'em (2 cartas) • Heads-up e Multiway"
              : `Pot-Limit Omaha (${reqCardCount} cartas) • Heads-up e Multiway`}
          </Text>
        </View>

        <TouchableOpacity onPress={limparTudo} style={styles.btnReset} activeOpacity={0.7}>
          <Ionicons name="refresh-outline" size={15} color="#DC2626" />
          <Text style={styles.btnResetTexto}>Reset</Text>
        </TouchableOpacity>
      </View>

      {/* ======================================================== */}
      {/* SELETOR DE MODALIDADE: HOLD'EM / PLO 4 / PLO 5 / PLO 6 */}
      {/* ======================================================== */}
      <View style={styles.settingsRow}>
        <View style={styles.variantGroup}>
          {VARIANTS.map((v) => (
            <TouchableOpacity
              key={v.id}
              onPress={() => handleSelectVariant(v.id)}
              style={[styles.variantTab, variant === v.id && styles.variantTabActive]}
              activeOpacity={0.7}
            >
              <Text style={[styles.variantTabText, variant === v.id && styles.variantTabTextActive]}>
                {v.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ======================================================== */}
      {/* BOARD (MESA COMUNITÁRIA) */}
      {/* ======================================================== */}
      <View style={styles.boardCard}>
        <View style={styles.boardHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="albums-outline" size={16} color={colors.primary} />
            <Text style={styles.boardTitle}>Board (Mesa Comunitária)</Text>
          </View>

          <TouchableOpacity onPress={limparBoard} style={styles.btnLimparPequeno}>
            <Text style={styles.btnLimparPequenoTexto}>Limpar mesa</Text>
          </TouchableOpacity>
        </View>

        {/* Slots de cartas do Board: Flop (3), Turn (1), River (1) */}
        <View style={styles.boardCardsRow}>
          <View style={styles.flopGroup}>
            {[0, 1, 2].map((idx) => {
              const isSelected = activeSlot?.type === 'board' && activeSlot.cardIndex === idx
              return (
                <View key={idx}>
                  {renderCardSlot(board[idx], () => abrirPicker({ type: 'board', cardIndex: idx }), isSelected)}
                </View>
              )
            })}
          </View>

          <View style={styles.boardSeparator} />

          {/* Turn */}
          <View>
            {renderCardSlot(board[3], () => abrirPicker({ type: 'board', cardIndex: 3 }), activeSlot?.type === 'board' && activeSlot.cardIndex === 3)}
          </View>

          <View style={styles.boardSeparator} />

          {/* River */}
          <View>
            {renderCardSlot(board[4], () => abrirPicker({ type: 'board', cardIndex: 4 }), activeSlot?.type === 'board' && activeSlot.cardIndex === 4)}
          </View>
        </View>

        <View style={styles.boardLabelsRow}>
          <Text style={[styles.boardLabelItem, { width: 140, textAlign: 'center' }]}>Flop</Text>
          <Text style={[styles.boardLabelItem, { width: 44, textAlign: 'center' }]}>Turn</Text>
          <Text style={[styles.boardLabelItem, { width: 44, textAlign: 'center' }]}>River</Text>
        </View>
      </View>

      {/* ======================================================== */}
      {/* JOGADORES & EQUIDADES */}
      {/* ======================================================== */}
      <View style={styles.playersContainer}>
        {players.map((player, pIdx) => {
          const res = results?.find((r) => r.id === player.id)
          const equityValue = res ? res.equity : 0
          const winPct = res ? res.winPct : 0
          const tiePct = res ? res.tiePct : 0
          const bestHand = res ? res.bestHandName : '-'

          return (
            <View key={player.id} style={[styles.playerCard, { borderLeftColor: player.color }]}>
              {/* Topo do Jogador */}
              <View style={styles.playerHeader}>
                <View style={styles.playerNameCol}>
                  <View style={[styles.playerBadgeDot, { backgroundColor: player.color }]} />
                  <Text style={styles.playerName}>{player.name}</Text>
                  {bestHand !== '-' && (
                    <View style={styles.handBadge}>
                      <Text numberOfLines={1} style={styles.handBadgeText}>{bestHand}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.playerActions}>
                  <TouchableOpacity
                    onPress={() => limparMaoJogador(pIdx)}
                    style={styles.playerActionBtn}
                    accessibilityLabel="Limpar mão"
                  >
                    <Ionicons name="trash-outline" size={14} color={colors.muted} />
                  </TouchableOpacity>

                  {players.length > 2 && (
                    <TouchableOpacity
                      onPress={() => removerJogador(pIdx)}
                      style={styles.playerActionBtn}
                      accessibilityLabel="Remover jogador"
                    >
                      <Ionicons name="close-circle-outline" size={16} color="#DC2626" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Cartas do Jogador */}
              <View style={[styles.playerCardsRow, variant === 'holdem' && { justifyContent: 'flex-start', paddingLeft: 6 }]}>
                {player.cards.map((cardId, cIdx) => {
                  const isSelected = activeSlot?.type === 'player' && activeSlot.playerIndex === pIdx && activeSlot.cardIndex === cIdx
                  return (
                    <View key={cIdx} style={{ marginHorizontal: 3 }}>
                      {renderCardSlot(cardId, () => abrirPicker({ type: 'player', playerIndex: pIdx, cardIndex: cIdx }), isSelected, 'normal')}
                    </View>
                  )
                })}
              </View>

              {/* Barra de Equidade e Estatísticas */}
              <View style={styles.equityArea}>
                <View style={styles.equityHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                    <Text style={[styles.equityNumber, { color: player.color }]}>
                      {equityValue.toFixed(1)}%
                    </Text>
                    <Text style={styles.equityLabel}>Equidade</Text>
                  </View>

                  <Text style={styles.equityStats}>
                    Win: <Text style={{ fontWeight: '700', color: colors.text }}>{winPct.toFixed(1)}%</Text> • Tie: <Text style={{ fontWeight: '700', color: colors.text }}>{tiePct.toFixed(1)}%</Text>
                  </Text>
                </View>

                {/* Barra de progresso visual */}
                <View style={styles.equityTrack}>
                  <View
                    style={[
                      styles.equityBarFill,
                      { width: `${Math.max(2, Math.min(100, equityValue))}%`, backgroundColor: player.color }
                    ]}
                  />
                </View>
              </View>
            </View>
          )
        })}

        {/* Botão Adicionar Jogador (até 6) */}
        {players.length < 6 && (
          <TouchableOpacity onPress={adicionarJogador} style={styles.btnAddPlayer} activeOpacity={0.7}>
            <Ionicons name="person-add-outline" size={16} color={colors.primary} />
            <Text style={styles.btnAddPlayerText}>Adicionar Jogador ({players.length + 1}º)</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Botão de Ação: Calcular / Recalcular */}
      <View style={styles.footerCalcArea}>
        <TouchableOpacity
          onPress={calcularEquidade}
          disabled={isCalculating}
          style={[styles.btnCalcular, isCalculating && { opacity: 0.7 }]}
          activeOpacity={0.8}
        >
          {isCalculating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="flash" size={18} color="#fff" />
          )}
          <Text style={styles.btnCalcularTexto}>
            {isCalculating ? 'Calculando equidades...' : 'Calcular Equidade'}
          </Text>
        </TouchableOpacity>

        {simInfo && (
          <Text style={styles.simInfoText}>
            Simulação Monte Carlo: {simInfo.total.toLocaleString()} cenários • {simInfo.timeMs}ms
          </Text>
        )}
      </View>

      {/* ======================================================== */}
      {/* MODAL CARD PICKER (DECK 52 CARTAS) */}
      {/* ======================================================== */}
      <Modal visible={pickerVisible} transparent animationType="fade">
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerCard}>
            {/* Topo do Picker */}
            <View style={styles.pickerHeader}>
              <View>
                <Text style={styles.pickerTitle}>Selecionar Carta</Text>
                <Text style={styles.pickerSub}>
                  {activeSlot?.type === 'player'
                    ? `${players[activeSlot.playerIndex]?.name} • Carta ${activeSlot.cardIndex + 1}`
                    : `Mesa • Carta ${(activeSlot?.cardIndex || 0) + 1}`}
                </Text>
              </View>

              <TouchableOpacity onPress={() => setPickerVisible(false)} style={styles.pickerCloseBtn}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Ações rápidas no modal */}
            <View style={styles.pickerActionsRow}>
              <TouchableOpacity onPress={limparCartaSlotAtivo} style={styles.btnLimparCartaSlot}>
                <Ionicons name="backspace-outline" size={15} color="#DC2626" />
                <Text style={styles.btnLimparCartaSlotTexto}>Limpar Carta</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setPickerVisible(false)} style={styles.btnConcluirPicker}>
                <Text style={styles.btnConcluirPickerTexto}>Concluir</Text>
              </TouchableOpacity>
            </View>

            {/* Matriz 52 Cartas (4 naipes x 13 ranks) */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 6 }}>
              <View style={styles.deckGrid}>
                {SUITS.map((suit) => {
                  return (
                    <View key={suit} style={styles.suitRow}>
                      {/* Símbolo do Naipe na lateral */}
                      <View style={[styles.suitIndicator, { backgroundColor: SUIT_COLORS[suit] + '15' }]}>
                        <Text style={[styles.suitIndicatorSymbol, { color: SUIT_COLORS[suit] }]}>
                          {SUIT_SYMBOLS[suit]}
                        </Text>
                      </View>

                      {/* 13 Cartas do Naipe (A down to 2) */}
                      {[...RANKS].reverse().map((rank) => {
                        const rIdx = RANKS.indexOf(rank)
                        const sIdx = SUITS.indexOf(suit)
                        const cardId = (rIdx << 2) | sIdx
                        const isUsed = usedCardsSet.has(cardId)

                        return (
                          <TouchableOpacity
                            key={cardId}
                            disabled={isUsed}
                            onPress={() => selecionarCarta(cardId)}
                            style={[
                              styles.deckCardBtn,
                              isUsed && styles.deckCardBtnUsed
                            ]}
                            activeOpacity={0.6}
                          >
                            <Text
                              style={[
                                styles.deckCardRank,
                                { color: isUsed ? '#CBD5E1' : SUIT_COLORS[suit] }
                              ]}
                            >
                              {rank}
                            </Text>
                            <Text
                              style={[
                                styles.deckCardSuit,
                                { color: isUsed ? '#CBD5E1' : SUIT_COLORS[suit] }
                              ]}
                            >
                              {SUIT_SYMBOLS[suit]}
                            </Text>
                          </TouchableOpacity>
                        )
                      })}
                    </View>
                  )
                })}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 40
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text
  },
  subtitle: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2
  },
  btnReset: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8
  },
  btnResetTexto: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626'
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  variantGroup: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    padding: 3,
    gap: 3
  },
  variantTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 8
  },
  variantTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2
  },
  variantTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted
  },
  variantTabTextActive: {
    color: colors.primary
  },

  /* Board Area */
  boardCard: {
    backgroundColor: '#1E293B', // Feltro poker escuro
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155'
  },
  boardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  boardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E2E8F0'
  },
  btnLimparPequeno: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.1)'
  },
  btnLimparPequenoTexto: {
    fontSize: 10,
    fontWeight: '600',
    color: '#CBD5E1'
  },
  boardCardsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4
  },
  flopGroup: {
    flexDirection: 'row',
    gap: 4
  },
  boardSeparator: {
    width: 1,
    height: 36,
    backgroundColor: '#475569',
    marginHorizontal: 3
  },
  boardLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 6,
    gap: 8
  },
  boardLabelItem: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8'
  },

  /* Slots de Cartas */
  cardSlotEmpty: {
    width: 44,
    height: 58,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: '#475569',
    borderStyle: 'dashed',
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center'
  },
  cardSlotEmptySmall: {
    width: 38,
    height: 50
  },
  cardSlotFilled: {
    width: 44,
    height: 58,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3
  },
  cardSlotFilledSmall: {
    width: 38,
    height: 50
  },
  cardSlotSelected: {
    borderColor: '#FACC15',
    borderWidth: 2,
    transform: [{ scale: 1.06 }]
  },
  cardRank: {
    fontSize: 17,
    fontWeight: '900',
    lineHeight: 20
  },
  cardRankSmall: {
    fontSize: 15,
    lineHeight: 18
  },
  cardSymbol: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 18
  },
  cardSymbolSmall: {
    fontSize: 14,
    lineHeight: 16
  },

  /* Players */
  playersContainer: {
    gap: 10,
    marginBottom: 14
  },
  playerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2
  },
  playerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  playerNameCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1
  },
  playerBadgeDot: {
    width: 10,
    height: 10,
    borderRadius: 5
  },
  playerName: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text
  },
  handBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  handBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary
  },
  playerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  playerActionBtn: {
    padding: 4
  },
  playerCardsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    marginBottom: 8
  },

  /* Equity Bar */
  equityArea: {
    marginTop: 2
  },
  equityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 4
  },
  equityNumber: {
    fontSize: 20,
    fontWeight: '900'
  },
  equityLabel: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: '600'
  },
  equityStats: {
    fontSize: 11,
    color: colors.textSecondary
  },
  equityTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden'
  },
  equityBarFill: {
    height: '100%',
    borderRadius: 3
  },

  btnAddPlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed'
  },
  btnAddPlayerText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary
  },

  footerCalcArea: {
    marginTop: 6,
    alignItems: 'center',
    gap: 8
  },
  btnCalcular: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 13,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3
  },
  btnCalcularTexto: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  simInfoText: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: '500'
  },

  /* Picker Modal */
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12
  },
  pickerCard: {
    width: '100%',
    maxWidth: 580,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text
  },
  pickerSub: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 1
  },
  pickerCloseBtn: {
    padding: 4
  },
  pickerActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0'
  },
  btnLimparCartaSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FEE2E2'
  },
  btnLimparCartaSlotTexto: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626'
  },
  btnConcluirPicker: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8
  },
  btnConcluirPickerTexto: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  deckGrid: {
    gap: 6
  },
  suitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  suitIndicator: {
    width: 28,
    height: 38,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2
  },
  suitIndicatorSymbol: {
    fontSize: 18,
    fontWeight: '900'
  },
  deckCardBtn: {
    width: 36,
    height: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1
  },
  deckCardBtnUsed: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
    opacity: 0.35
  },
  deckCardRank: {
    fontSize: 14,
    fontWeight: '800'
  },
  deckCardSuit: {
    fontSize: 13,
    fontWeight: '700'
  }
})
