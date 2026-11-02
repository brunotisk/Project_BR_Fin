import { useCallback, useMemo, useState } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../theme'
import { formatCurrency } from '../utils/formatCurrency'
import { notify } from '../utils/notify'
import {
  carregarCashoutsPoker,
  carregarLancamentosPoker,
  carregarLocaisPoker,
  carregarTaxaPadraoPoker,
  CashoutPorLocal,
  CashoutsPokerMap,
  LANCAMENTOS_POKER_INICIAIS,
  obterTotalCashoutSessao,
  salvarCashoutsDaSessao,
  salvarLancamentosPoker,
  salvarLocaisPoker,
  salvarTaxaPadraoPoker
} from '../services/planilhasService'
import { LancamentoPoker } from '../types'

export function PokerScreen() {
  const [lancamentos, setLancamentos] = useState<LancamentoPoker[]>(LANCAMENTOS_POKER_INICIAIS)
  const [cashouts, setCashouts] = useState<CashoutsPokerMap>({})
  const [taxaPadraoPercentual, setTaxaPadraoPercentual] = useState<number>(5)
  const [locaisCadastrados, setLocaisCadastrados] = useState<string[]>(['MonteCarlo', 'H2'])
  const [cartoesCadastrados, setCartoesCadastrados] = useState<string[]>(['Nubank', 'PicPay', 'BTG'])

  const [mesFiltro, setMesFiltro] = useState<string>('Novembro')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Modal para Nova Entrada / Edição de Linha
  const [modalNovoVisible, setModalNovoVisible] = useState(false)
  const [itemEditando, setItemEditando] = useState<LancamentoPoker | null>(null)

  // Modal para Dropdown Verde (Local ou Cartão)
  const [modalDropdownVisible, setModalDropdownVisible] = useState(false)
  const [dropdownConfig, setDropdownConfig] = useState<{
    itemId: string
    tipo: 'cartao' | 'local'
    opcoes: string[]
  } | null>(null)
  const [novoItemCadastroTexto, setNovoItemCadastroTexto] = useState('')

  // Modal para Editar CASHout por Local
  const [modalCashoutVisible, setModalCashoutVisible] = useState(false)
  const [cashoutDataAlvo, setCashoutDataAlvo] = useState('')
  const [cashoutInputsPorLocal, setCashoutInputsPorLocal] = useState<Record<string, string>>({})

  // Modal para Editar Taxa %
  const [modalTaxaVisible, setModalTaxaVisible] = useState(false)
  const [taxaInputVal, setTaxaInputVal] = useState('5')

  // Formulário de Nova Entrada
  const [formMesBase, setFormMesBase] = useState('Novembro')
  const [formDataCartao, setFormDataCartao] = useState('31/out')
  const [formCartao, setFormCartao] = useState('')
  const [formLocal, setFormLocal] = useState('MonteCarlo')
  const [formValor, setFormValor] = useState('')
  const [formTaxa, setFormTaxa] = useState('')
  const [manterAberto, setManterAberto] = useState(false)

  const carregar = useCallback(async () => {
    try {
      const data = await carregarLancamentosPoker()
      setLancamentos(data)
      setCashouts(carregarCashoutsPoker())
      setTaxaPadraoPercentual(carregarTaxaPadraoPoker())
      setLocaisCadastrados(carregarLocaisPoker())
    } catch (err) {
      console.warn('Erro ao carregar Poker:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      carregar()
    }, [carregar])
  )

  // Filtrar lançamentos por mês
  const lancamentosFiltrados = useMemo(() => {
    return lancamentos.filter((item) => {
      if (mesFiltro === 'Todos') return true
      return item.mes_base.toLowerCase() === mesFiltro.toLowerCase()
    })
  }, [lancamentos, mesFiltro])

  // Agrupar por data da sessão (ex: '31/out', '30/out', '28/out')
  const sessoesAgrupadas = useMemo(() => {
    const map = new Map<string, LancamentoPoker[]>()
    lancamentosFiltrados.forEach((item) => {
      const data = item.data_cartao || 'Sem Data'
      if (!map.has(data)) map.set(data, [])
      map.get(data)!.push(item)
    })
    return Array.from(map.entries())
  }, [lancamentosFiltrados])

  // Totais Gerais
  const totalSacadoGeral = useMemo(() => {
    return lancamentosFiltrados.reduce((acc, it) => acc + (Number(it.valor) || 0), 0)
  }, [lancamentosFiltrados])

  const totalTaxaGeral = useMemo(() => {
    return lancamentosFiltrados.reduce((acc, it) => acc + (Number(it.taxa) || 0), 0)
  }, [lancamentosFiltrados])

  const totalCashoutGeral = useMemo(() => {
    return sessoesAgrupadas.reduce((acc, [dataKey]) => {
      return acc + obterTotalCashoutSessao(cashouts[dataKey])
    }, 0)
  }, [sessoesAgrupadas, cashouts])

  const totalNetGeral = totalCashoutGeral - totalSacadoGeral - totalTaxaGeral

  // ==========================================
  // HANDLERS CASHOUT POR LOCAL
  // ==========================================
  const abrirModalCashout = (dataCartao: string, itensDaSessao: LancamentoPoker[]) => {
    setCashoutDataAlvo(dataCartao)

    // Identificar todos os locais da sessão, garantindo que MonteCarlo e H2 estejam disponíveis
    const locaisDaSessao = Array.from(
      new Set([
        ...itensDaSessao.map((it) => it.local).filter(Boolean),
        ...locaisCadastrados
      ])
    )

    const valoresSalvos = cashouts[dataCartao] || {}
    const inputsIniciais: Record<string, string> = {}

    locaisDaSessao.forEach((loc) => {
      const v = valoresSalvos[loc]
      inputsIniciais[loc] = v && v > 0 ? v.toString() : ''
    })

    setCashoutInputsPorLocal(inputsIniciais)
    setModalCashoutVisible(true)
  }

  const handleAlterarInputLocal = (local: string, valorStr: string) => {
    setCashoutInputsPorLocal((prev) => ({
      ...prev,
      [local]: valorStr
    }))
  }

  // Soma automática dos inputs em tempo real no modal
  const somaCashoutModal = useMemo(() => {
    return Object.values(cashoutInputsPorLocal).reduce((acc, valStr) => {
      const num = parseFloat((valStr || '').replace(',', '.')) || 0
      return acc + num
    }, 0)
  }, [cashoutInputsPorLocal])

  const salvarCashoutsModal = async () => {
    const mapaSalvar: CashoutPorLocal = {}
    for (const [loc, valStr] of Object.entries(cashoutInputsPorLocal)) {
      const num = parseFloat((valStr || '').replace(',', '.')) || 0
      mapaSalvar[loc] = num
    }

    await salvarCashoutsDaSessao(cashoutDataAlvo, mapaSalvar, mesFiltro)
    setCashouts((prev) => ({ ...prev, [cashoutDataAlvo]: mapaSalvar }))
    setModalCashoutVisible(false)
    notify('CASHout Salvo', `Total de ${formatCurrency(somaCashoutModal)} para ${cashoutDataAlvo}.`)
  }

  // ==========================================
  // HANDLERS DROPDOWN VERDE
  // ==========================================
  const abrirDropdown = (itemId: string, tipo: 'cartao' | 'local') => {
    const opcoes = tipo === 'cartao' ? cartoesCadastrados : locaisCadastrados
    setDropdownConfig({ itemId, tipo, opcoes })
    setNovoItemCadastroTexto('')
    setModalDropdownVisible(true)
  }

  const selecionarOpcaoDropdown = async (valorSelecionado: string) => {
    if (!dropdownConfig) return

    const listaAtualizada = lancamentos.map((it) => {
      if (it.id !== dropdownConfig.itemId) return it
      if (dropdownConfig.tipo === 'cartao') {
        return { ...it, cartao_nome: valorSelecionado }
      } else {
        let novaTaxa = it.taxa
        if (valorSelecionado === 'H2' && it.taxa === 0 && it.valor > 0) {
          novaTaxa = Math.round(((it.valor * (taxaPadraoPercentual / 100)) / (1 + taxaPadraoPercentual / 100)) * 100) / 100
        }
        return { ...it, local: valorSelecionado, taxa: novaTaxa }
      }
    })

    setLancamentos(listaAtualizada)
    setModalDropdownVisible(false)
    setDropdownConfig(null)
    await salvarLancamentosPoker(listaAtualizada)
  }

  const cadastrarNovoNoDropdown = () => {
    if (!novoItemCadastroTexto.trim() || !dropdownConfig) return
    const novo = novoItemCadastroTexto.trim()

    if (dropdownConfig.tipo === 'cartao') {
      if (!cartoesCadastrados.includes(novo)) {
        setCartoesCadastrados([...cartoesCadastrados, novo])
      }
    } else {
      if (!locaisCadastrados.includes(novo)) {
        const novosLocais = [...locaisCadastrados, novo]
        setLocaisCadastrados(novosLocais)
        salvarLocaisPoker(novosLocais)
      }
    }

    selecionarOpcaoDropdown(novo)
  }

  // ==========================================
  // HANDLERS TAXA % PADRÃO
  // ==========================================
  const salvarTaxaModal = () => {
    const t = parseFloat(taxaInputVal.replace(',', '.')) || 5
    setTaxaPadraoPercentual(t)
    salvarTaxaPadraoPoker(t)
    setModalTaxaVisible(false)
    notify('Taxa Padrão', `Taxa padrão definida para ${t}%`)
  }

  // ==========================================
  // HANDLERS ENTRADAS (BUY-IN)
  // ==========================================
  const abrirModalNovo = (dataSessaoSugerida?: string) => {
    setItemEditando(null)
    setFormMesBase(mesFiltro === 'Todos' ? 'Novembro' : mesFiltro)
    setFormDataCartao(dataSessaoSugerida || '31/out')
    setFormCartao('')
    setFormLocal('MonteCarlo')
    setFormValor('')
    setFormTaxa('')
    setModalNovoVisible(true)
  }

  const abrirModalEditar = (item: LancamentoPoker) => {
    setItemEditando(item)
    setFormMesBase(item.mes_base)
    setFormDataCartao(item.data_cartao)
    setFormCartao(item.cartao_nome)
    setFormLocal(item.local)
    setFormValor(item.valor > 0 ? item.valor.toString() : '')
    setFormTaxa(item.taxa > 0 ? item.taxa.toString() : '')
    setModalNovoVisible(true)
  }

  const handleMudarValor = (valStr: string) => {
    setFormValor(valStr)
    const v = parseFloat(valStr.replace(',', '.')) || 0
    if (formLocal === 'H2' && v > 0) {
      const calculada = Math.round((v * (taxaPadraoPercentual / 100)) * 100) / 100
      setFormTaxa(calculada.toString())
    }
  }

  const salvarEntrada = async () => {
    const v = parseFloat(formValor.replace(',', '.')) || 0
    const tx = parseFloat(formTaxa.replace(',', '.')) || 0

    if (v <= 0) {
      notify('Atenção', 'Informe um valor válido.')
      return
    }

    const itemSalvo: LancamentoPoker = {
      id: itemEditando ? itemEditando.id : `p-${Date.now()}`,
      mes_base: formMesBase.trim() || 'Novembro',
      data_cartao: formDataCartao.trim() || '31/out',
      cartao_nome: formCartao.trim(),
      local: formLocal.trim() || 'MonteCarlo',
      valor: v,
      taxa: tx
    }

    let listaAtualizada: LancamentoPoker[]
    if (itemEditando) {
      listaAtualizada = lancamentos.map((it) => (it.id === itemEditando.id ? itemSalvo : it))
    } else {
      listaAtualizada = [...lancamentos, itemSalvo]
    }

    setLancamentos(listaAtualizada)
    await salvarLancamentosPoker(listaAtualizada)

    if (manterAberto) {
      setFormValor('')
      setFormTaxa('')
      notify('Adicionado', 'Entrada salva! Pode continuar digitando.')
    } else {
      setModalNovoVisible(false)
      notify('Sucesso', 'Entrada salva com sucesso!')
    }
  }

  const excluirEntrada = async (id: string) => {
    const lista = lancamentos.filter((it) => it.id !== id)
    setLancamentos(lista)
    setModalNovoVisible(false)
    await salvarLancamentosPoker(lista)
    notify('Excluído', 'Entrada removida.')
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar() }} />}
      >
        {/* Topo / Título & Botão Nova Entrada */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Poker</Text>
            <Text style={styles.subtitle}>Sessões, Buy-ins, Taxas e Cash Out</Text>
          </View>
          <TouchableOpacity style={styles.btnNovoTopo} onPress={() => abrirModalNovo()}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.btnNovoTopoTexto}>Nova Entrada</Text>
          </TouchableOpacity>
        </View>

        {/* ======================================================== */}
        {/* CARDS SUPERIORES EXATOS DA PLANILHA (ValorSacado, Taxa) */}
        {/* ======================================================== */}
        <View style={styles.kpiRow}>
          {/* Card ValorSacado */}
          <View style={[styles.kpiCard, { flex: 1.4, borderLeftColor: '#0284C7' }]}>
            <Text style={styles.kpiLabel}>ValorSacado</Text>
            <Text style={[styles.kpiValue, { color: '#0369A1' }]}>
              {formatCurrency(totalSacadoGeral)}
            </Text>
            <Text style={styles.kpiHint}>Total Buy-ins do Mês</Text>
          </View>

          {/* Card ValorTaxa */}
          <View style={[styles.kpiCard, { flex: 1.3, borderLeftColor: '#D97706' }]}>
            <Text style={styles.kpiLabel}>ValorTaxa</Text>
            <Text style={[styles.kpiValue, { color: '#B45309' }]}>
              {formatCurrency(totalTaxaGeral)}
            </Text>
            <Text style={styles.kpiHint}>Taxas acumuladas</Text>
          </View>

          {/* Campo Amarelo: Taxa % Padrão */}
          <TouchableOpacity
            style={[styles.taxaBoxAmarela, { flex: 1 }]}
            onPress={() => { setTaxaInputVal(taxaPadraoPercentual.toString()); setModalTaxaVisible(true) }}
          >
            <Text style={styles.taxaBoxLabel}>Taxa %</Text>
            <View style={styles.taxaValorWrapper}>
              <Text style={styles.taxaBoxValor}>{taxaPadraoPercentual}%</Text>
              <Ionicons name="pencil" size={13} color="#854D0E" />
            </View>
            <Text style={styles.taxaBoxHint}>Toque p/ editar</Text>
          </TouchableOpacity>
        </View>

        {/* Resumo Consolidado (NET Geral do Mês) */}
        <View style={styles.netGeralCard}>
          <View style={styles.netCol}>
            <Text style={styles.netMiniLabel}>CASH OUT TOTAL</Text>
            <Text style={styles.netMiniVal}>{formatCurrency(totalCashoutGeral)}</Text>
          </View>
          <View style={styles.netDivider} />
          <View style={styles.netCol}>
            <Text style={styles.netMiniLabel}>LÍQUIDO (NET)</Text>
            <Text
              style={[
                styles.netDestaqueVal,
                { color: totalNetGeral >= 0 ? '#15803D' : '#DC2626' }
              ]}
            >
              {totalNetGeral >= 0 ? `+${formatCurrency(totalNetGeral)}` : formatCurrency(totalNetGeral)}
            </Text>
          </View>
        </View>

        {/* Filtro de Mês */}
        <View style={styles.filtrosRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {['Novembro', 'Outubro', 'Todos'].map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.filtroChip, mesFiltro === m && styles.filtroChipActive]}
                onPress={() => setMesFiltro(m)}
              >
                <Text style={[styles.filtroChipText, mesFiltro === m && styles.filtroChipTextActive]}>
                  {m}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Legenda dos campos */}
        <View style={styles.legendaRow}>
          <View style={styles.legendaItem}>
            <View style={[styles.legendaCor, { backgroundColor: '#FEF08A' }]} />
            <Text style={styles.legendaTexto}>Amarelo = Entradas (Valor / CASHout / Taxa)</Text>
          </View>
          <View style={styles.legendaItem}>
            <View style={[styles.legendaCor, { backgroundColor: '#DCFCE7' }]} />
            <Text style={styles.legendaTexto}>Verde = Dropdown (Local / Cartão)</Text>
          </View>
        </View>

        {/* ======================================================== */}
        {/* SESSÕES POR DIA COM BOX DE RESUMO NO TOPO DA SESSÃO */}
        {/* ======================================================== */}
        {sessoesAgrupadas.map(([dataSessao, itens]) => {
          const buyInSessao = itens.reduce((s, it) => s + (Number(it.valor) || 0), 0)
          const taxaSessao = itens.reduce((s, it) => s + (Number(it.taxa) || 0), 0)
          const cashoutsDoDia = cashouts[dataSessao] || {}
          const cashoutTotalSessao = obterTotalCashoutSessao(cashoutsDoDia)
          const netSessao = cashoutTotalSessao - buyInSessao - taxaSessao

          // Detalhes dos locais para exibir abaixo do CASHout (ex: MonteCarlo: R$ 0 | H2: R$ 14.655)
          const detalhesLocais = Object.entries(cashoutsDoDia)
            .filter(([, val]) => val > 0)
            .map(([loc, val]) => `${loc}: ${formatCurrency(val)}`)
            .join(' + ')

          return (
            <View key={dataSessao} style={styles.sessaoCard}>
              {/* CABEÇALHO DO DIA */}
              <View style={styles.sessaoTopBar}>
                <View style={styles.sessaoBadgeDia}>
                  <Ionicons name="calendar-outline" size={15} color="#0284C7" />
                  <Text style={styles.sessaoDiaTexto}>Sessão: {dataSessao}</Text>
                </View>
                <Text style={styles.sessaoEntradasBadge}>
                  {itens.length} {itens.length === 1 ? 'entrada' : 'entradas'}
                </Text>
              </View>

              {/* ======================================================== */}
              {/* BOX DE RESUMO DA SESSÃO (EM CIMA DO DIA DO LANÇAMENTO!) */}
              {/* ======================================================== */}
              <View style={styles.resumoSessaoEmCimaContainer}>
                <View style={styles.resumoGridCards}>
                  {/* Card BuyIN */}
                  <View style={styles.resumoMiniBox}>
                    <Text style={styles.resumoMiniLabel}>BuyIN</Text>
                    <Text style={styles.resumoMiniValor}>{formatCurrency(buyInSessao)}</Text>
                  </View>

                  {/* Card Taxa */}
                  <View style={styles.resumoMiniBox}>
                    <Text style={styles.resumoMiniLabel}>Taxa</Text>
                    <Text style={[styles.resumoMiniValor, { color: '#B45309' }]}>
                      {formatCurrency(taxaSessao)}
                    </Text>
                  </View>

                  {/* Card CASHout (CAMPO AMARELO - SOMA DOS LOCAIS) */}
                  <TouchableOpacity
                    style={styles.cashoutMiniBoxAmarelo}
                    onPress={() => abrirModalCashout(dataSessao, itens)}
                  >
                    <View style={styles.cashoutMiniTop}>
                      <Text style={styles.cashoutMiniLabel}>CASHout</Text>
                      <Ionicons name="pencil" size={12} color="#854D0E" />
                    </View>
                    <Text style={styles.cashoutMiniValor}>
                      {formatCurrency(cashoutTotalSessao)}
                    </Text>
                    {detalhesLocais ? (
                      <Text numberOfLines={1} style={styles.cashoutDetalhesTexto}>
                        {detalhesLocais}
                      </Text>
                    ) : (
                      <Text style={styles.cashoutDetalhesTexto}>Toque p/ editar por local</Text>
                    )}
                  </TouchableOpacity>

                  {/* Card NET (Resultado da Sessão) */}
                  <View
                    style={[
                      styles.resumoMiniBox,
                      {
                        borderLeftWidth: 3,
                        borderLeftColor: netSessao >= 0 ? '#16A34A' : '#DC2626'
                      }
                    ]}
                  >
                    <Text style={styles.resumoMiniLabel}>NET</Text>
                    <Text
                      style={[
                        styles.resumoMiniValor,
                        { color: netSessao >= 0 ? '#15803D' : '#DC2626' }
                      ]}
                    >
                      {netSessao >= 0 ? `+${formatCurrency(netSessao)}` : formatCurrency(netSessao)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* ======================================================== */}
              {/* TABELA DE ENTRADAS (LINHAS UNIFORMES, SEM DISTORÇÃO) */}
              {/* ======================================================== */}
              <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.tableScroll}>
                <View style={[styles.tableContainer, { minWidth: 580 }]}>
                  {/* Header da Tabela */}
                  <View style={styles.tableHeader}>
                    <Text style={[styles.th, { width: 90 }]}>MesBase</Text>
                    <Text style={[styles.th, { width: 85 }]}>DataCartão</Text>
                    <Text style={[styles.th, { width: 100 }]}>Cartão</Text>
                    <Text style={[styles.th, { width: 110 }]}>Local</Text>
                    <Text style={[styles.th, styles.thRight, { width: 100 }]}>Valor</Text>
                    <Text style={[styles.th, styles.thRight, { width: 85 }]}>Taxa</Text>
                  </View>

                  {/* Linhas Uniformes de Entradas */}
                  {itens.map((item, idx) => (
                    <View key={item.id} style={[styles.tr, idx % 2 === 1 && styles.trAlt]}>
                      {/* MesBase */}
                      <Text style={[styles.td, { width: 90 }]}>{item.mes_base}</Text>

                      {/* DataCartão */}
                      <Text style={[styles.tdMuted, { width: 85 }]}>{item.data_cartao}</Text>

                      {/* Cartão (DROPDOWN VERDE) */}
                      <TouchableOpacity
                        style={[styles.tdDropdownVerde, { width: 100 }]}
                        onPress={() => abrirDropdown(item.id, 'cartao')}
                      >
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.tdDropdownTexto,
                            !item.cartao_nome && { color: '#94A3B8', fontStyle: 'italic' }
                          ]}
                        >
                          {item.cartao_nome || 'Selecione'}
                        </Text>
                        <Ionicons name="chevron-down" size={12} color="#15803D" />
                      </TouchableOpacity>

                      {/* Local (DROPDOWN VERDE) */}
                      <TouchableOpacity
                        style={[styles.tdDropdownVerde, { width: 110 }]}
                        onPress={() => abrirDropdown(item.id, 'local')}
                      >
                        <Text numberOfLines={1} style={styles.tdDropdownTexto}>
                          {item.local}
                        </Text>
                        <Ionicons name="chevron-down" size={12} color="#15803D" />
                      </TouchableOpacity>

                      {/* Valor (CAMPO AMARELO - ENTRADA) */}
                      <TouchableOpacity
                        style={[styles.tdEntradaAmarela, { width: 100 }]}
                        onPress={() => abrirModalEditar(item)}
                      >
                        <Text style={styles.tdEntradaValor}>
                          {formatCurrency(item.valor)}
                        </Text>
                        <Ionicons name="pencil" size={11} color="#854D0E" />
                      </TouchableOpacity>

                      {/* Taxa */}
                      <TouchableOpacity
                        style={[styles.tdTaxaWrapper, { width: 85 }]}
                        onPress={() => abrirModalEditar(item)}
                      >
                        <Text style={styles.tdTaxa}>
                          {item.taxa > 0 ? formatCurrency(item.taxa) : '-'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </ScrollView>

              {/* Barra inferior com botão para adicionar entrada na sessão */}
              <View style={styles.sessaoBottomBar}>
                <TouchableOpacity
                  style={styles.btnAdicionarNaSessao}
                  onPress={() => abrirModalNovo(dataSessao)}
                >
                  <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
                  <Text style={styles.btnAdicionarNaSessaoTexto}>
                    + Adicionar entrada em {dataSessao}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )
        })}

        {sessoesAgrupadas.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Nenhuma sessão encontrada para este mês.</Text>
          </View>
        )}
      </ScrollView>

      {/* ======================================================== */}
      {/* MODAL CASHOUT POR LOCAL (ABRE UMA LINHA POR LOCAL E SOMA) */}
      {/* ======================================================== */}
      <Modal visible={modalCashoutVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitulo}>CASHout - Sessão {cashoutDataAlvo}</Text>
                <Text style={styles.modalSub}>
                  Informe o valor retirado em cada local (a soma será o CASHout total):
                </Text>
              </View>
              <TouchableOpacity onPress={() => setModalCashoutVisible(false)}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>

            {/* Inputs por Local */}
            <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
              {Object.keys(cashoutInputsPorLocal).map((localNome) => (
                <View key={localNome} style={styles.localCashoutItemRow}>
                  <View style={styles.localCashoutLabelCol}>
                    <View style={styles.localDot} />
                    <Text style={styles.localCashoutLabelText}>{localNome}</Text>
                  </View>

                  <TextInput
                    style={[styles.input, styles.inputCashoutLocal]}
                    placeholder="0,00"
                    keyboardType="numeric"
                    value={cashoutInputsPorLocal[localNome]}
                    onChangeText={(v) => handleAlterarInputLocal(localNome, v)}
                  />
                </View>
              ))}
            </ScrollView>

            {/* SOMA TOTAL DOS INPUTS EM TEMPO REAL */}
            <View style={styles.somaCashoutCard}>
              <Text style={styles.somaCashoutLabel}>Total CASHout da Sessão:</Text>
              <Text style={styles.somaCashoutValor}>
                {formatCurrency(somaCashoutModal)}
              </Text>
            </View>

            <View style={styles.modalBotoes}>
              <TouchableOpacity
                style={styles.btnCancelar}
                onPress={() => setModalCashoutVisible(false)}
              >
                <Text style={styles.btnCancelarTexto}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.btnSalvar} onPress={salvarCashoutsModal}>
                <Text style={styles.btnSalvarTexto}>Confirmar CASHout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL DROPDOWN (CAMPOS VERDES: LOCAL OU CARTÃO) */}
      {/* ======================================================== */}
      <Modal visible={modalDropdownVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitulo}>
                Selecionar {dropdownConfig?.tipo === 'cartao' ? 'Cartão' : 'Local'}
              </Text>
              <TouchableOpacity onPress={() => setModalDropdownVisible(false)}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 240 }} showsVerticalScrollIndicator={false}>
              {dropdownConfig?.tipo === 'cartao' && (
                <TouchableOpacity
                  style={styles.dropdownOption}
                  onPress={() => selecionarOpcaoDropdown('')}
                >
                  <Text style={[styles.dropdownOptionText, { fontStyle: 'italic', color: colors.muted }]}>
                    (Nenhum / Em branco)
                  </Text>
                </TouchableOpacity>
              )}

              {dropdownConfig?.opcoes.map((op) => (
                <TouchableOpacity
                  key={op}
                  style={styles.dropdownOption}
                  onPress={() => selecionarOpcaoDropdown(op)}
                >
                  <Text style={styles.dropdownOptionText}>{op}</Text>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#15803D" />
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.novoCadastroSection}>
              <Text style={styles.inputLabel}>Cadastrar novo:</Text>
              <View style={styles.novoCadastroRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder={dropdownConfig?.tipo === 'cartao' ? 'Nome do cartão...' : 'Nome do local...'}
                  value={novoItemCadastroTexto}
                  onChangeText={setNovoItemCadastroTexto}
                />
                <TouchableOpacity style={styles.btnCadastrarNovo} onPress={cadastrarNovoNoDropdown}>
                  <Text style={styles.btnCadastrarNovoTexto}>Adicionar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL TAXA % PADRÃO */}
      {/* ======================================================== */}
      <Modal visible={modalTaxaVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>Taxa Padrão (%)</Text>
            <Text style={styles.modalSub}>Informe o percentual padrão da taxa (ex: 5%):</Text>

            <TextInput
              style={[styles.input, styles.inputAmareloGrande]}
              placeholder="5"
              keyboardType="numeric"
              value={taxaInputVal}
              onChangeText={setTaxaInputVal}
              autoFocus
            />

            <View style={styles.modalBotoes}>
              <TouchableOpacity
                style={styles.btnCancelar}
                onPress={() => setModalTaxaVisible(false)}
              >
                <Text style={styles.btnCancelarTexto}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.btnSalvar} onPress={salvarTaxaModal}>
                <Text style={styles.btnSalvarTexto}>Salvar Taxa</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL NOVA ENTRADA / EDITAR ENTRADA */}
      {/* ======================================================== */}
      <Modal visible={modalNovoVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitulo}>
                {itemEditando ? 'Editar Entrada de Poker' : 'Nova Entrada de Poker'}
              </Text>
              <TouchableOpacity onPress={() => setModalNovoVisible(false)}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.formRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Mês Base:</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="ex: Novembro"
                    value={formMesBase}
                    onChangeText={setFormMesBase}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Data Cartão:</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="ex: 31/out"
                    value={formDataCartao}
                    onChangeText={setFormDataCartao}
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Cartão (Opcional):</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="ex: Nubank, PicPay"
                    value={formCartao}
                    onChangeText={setFormCartao}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Local:</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="ex: MonteCarlo, H2"
                    value={formLocal}
                    onChangeText={setFormLocal}
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Valor Buy-in (R$):</Text>
                  <TextInput
                    style={[styles.input, styles.inputAmarelo]}
                    placeholder="0,00"
                    keyboardType="numeric"
                    value={formValor}
                    onChangeText={handleMudarValor}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Taxa (R$):</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0,00"
                    keyboardType="numeric"
                    value={formTaxa}
                    onChangeText={setFormTaxa}
                  />
                </View>
              </View>

              {!itemEditando && (
                <TouchableOpacity
                  style={styles.checkContinuar}
                  onPress={() => setManterAberto(!manterAberto)}
                >
                  <Ionicons
                    name={manterAberto ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={colors.primary}
                  />
                  <Text style={styles.checkContinuarTexto}>
                    Continuar adicionando entradas sem fechar
                  </Text>
                </TouchableOpacity>
              )}

              <View style={styles.modalBotoes}>
                {itemEditando && (
                  <TouchableOpacity
                    style={styles.btnExcluir}
                    onPress={() => excluirEntrada(itemEditando.id)}
                  >
                    <Ionicons name="trash-outline" size={16} color="#DC2626" />
                    <Text style={styles.btnExcluirTexto}>Excluir</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.btnCancelar}
                  onPress={() => setModalNovoVisible(false)}
                >
                  <Text style={styles.btnCancelarTexto}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.btnSalvar} onPress={salvarEntrada}>
                  <Text style={styles.btnSalvarTexto}>Salvar Entrada</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text
  },
  subtitle: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 2
  },
  btnNovoTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4
  },
  btnNovoTopoTexto: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12
  },
  kpiCard: {
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '900',
    marginVertical: 2
  },
  kpiHint: {
    fontSize: 10,
    color: colors.muted
  },
  taxaBoxAmarela: {
    backgroundColor: '#FEF08A',
    borderColor: '#FACC15',
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2
  },
  taxaBoxLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#854D0E'
  },
  taxaValorWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginVertical: 2
  },
  taxaBoxValor: {
    fontSize: 18,
    fontWeight: '900',
    color: '#713F12'
  },
  taxaBoxHint: {
    fontSize: 9,
    color: '#A16207',
    fontWeight: '600'
  },
  netGeralCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: 12
  },
  netCol: {
    alignItems: 'center'
  },
  netDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border
  },
  netMiniLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.muted,
    letterSpacing: 0.5
  },
  netMiniVal: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    marginTop: 2
  },
  netDestaqueVal: {
    fontSize: 17,
    fontWeight: '900',
    marginTop: 2
  },
  filtrosRow: {
    marginBottom: 10
  },
  filtroChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border
  },
  filtroChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  filtroChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted
  },
  filtroChipTextActive: {
    color: '#fff'
  },
  legendaRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
    flexWrap: 'wrap'
  },
  legendaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  legendaCor: {
    width: 12,
    height: 12,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#CBD5E1'
  },
  legendaTexto: {
    fontSize: 11,
    color: colors.textSecondary
  },
  sessaoCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3
  },
  sessaoTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  sessaoBadgeDia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  sessaoDiaTexto: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text
  },
  sessaoEntradasBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border
  },
  resumoSessaoEmCimaContainer: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  resumoGridCards: {
    flexDirection: 'row',
    gap: 8
  },
  resumoMiniBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: colors.border
  },
  resumoMiniLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase'
  },
  resumoMiniValor: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
    marginTop: 2
  },
  cashoutMiniBoxAmarelo: {
    flex: 1.3,
    backgroundColor: '#FEF08A',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1.5,
    borderColor: '#FACC15'
  },
  cashoutMiniTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  cashoutMiniLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#713F12',
    textTransform: 'uppercase'
  },
  cashoutMiniValor: {
    fontSize: 13,
    fontWeight: '900',
    color: '#713F12',
    marginTop: 2
  },
  cashoutDetalhesTexto: {
    fontSize: 9,
    color: '#854D0E',
    marginTop: 2,
    fontWeight: '600'
  },
  tableScroll: {
    marginHorizontal: 1
  },
  tableContainer: {
    backgroundColor: '#FFFFFF'
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  th: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary
  },
  thRight: {
    textAlign: 'right'
  },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  trAlt: {
    backgroundColor: '#FAFAFA'
  },
  td: {
    fontSize: 12,
    color: colors.text
  },
  tdMuted: {
    fontSize: 12,
    color: colors.muted
  },
  tdDropdownVerde: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
    marginRight: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  tdDropdownTexto: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
    flex: 1
  },
  tdEntradaAmarela: {
    backgroundColor: '#FEF08A',
    borderColor: '#FACC15',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
    marginRight: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4
  },
  tdEntradaValor: {
    fontSize: 12,
    fontWeight: '800',
    color: '#713F12'
  },
  tdTaxaWrapper: {
    alignItems: 'flex-end',
    paddingRight: 6
  },
  tdTaxa: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D97706'
  },
  sessaoBottomBar: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  btnAdicionarNaSessao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  btnAdicionarNaSessaoTexto: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center'
  },
  emptyText: {
    fontSize: 13,
    color: colors.muted
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14
  },
  modalTitulo: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text
  },
  modalSub: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2
  },
  localCashoutItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  localCashoutLabelCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1
  },
  localDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16A34A'
  },
  localCashoutLabelText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text
  },
  inputCashoutLocal: {
    width: 140,
    backgroundColor: '#FEF08A',
    borderColor: '#FACC15',
    fontWeight: '800',
    color: '#713F12',
    textAlign: 'right'
  },
  somaCashoutCard: {
    backgroundColor: '#FEF08A',
    borderColor: '#FACC15',
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 12,
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  somaCashoutLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#713F12'
  },
  somaCashoutValor: {
    fontSize: 17,
    fontWeight: '900',
    color: '#713F12'
  },
  dropdownOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  dropdownOptionText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text
  },
  novoCadastroSection: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  novoCadastroRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center'
  },
  btnCadastrarNovo: {
    backgroundColor: '#15803D',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8
  },
  btnCadastrarNovoTexto: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text
  },
  inputAmarelo: {
    backgroundColor: '#FEF08A',
    borderColor: '#FACC15',
    fontWeight: '800',
    color: '#713F12'
  },
  inputAmareloGrande: {
    backgroundColor: '#FEF08A',
    borderColor: '#FACC15',
    fontSize: 20,
    fontWeight: '900',
    color: '#713F12',
    textAlign: 'center',
    marginVertical: 10
  },
  checkContinuar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    marginBottom: 16
  },
  checkContinuarTexto: {
    fontSize: 12,
    color: colors.textSecondary
  },
  modalBotoes: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    alignItems: 'center',
    marginTop: 14
  },
  btnExcluir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    marginRight: 'auto'
  },
  btnExcluirTexto: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626'
  },
  btnCancelar: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border
  },
  btnCancelarTexto: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted
  },
  btnSalvar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.primary
  },
  btnSalvarTexto: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff'
  }
})
