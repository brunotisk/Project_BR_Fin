import { useCallback, useMemo, useState } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
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
import { hojeISO } from '../utils/datas'
import {
  carregarCashoutsPoker,
  carregarDiasPokerBloqueados,
  carregarLancamentosPoker,
  carregarLocaisPoker,
  carregarTaxaPadraoPoker,
  CashoutPorLocal,
  CashoutsPokerMap,
  LANCAMENTOS_POKER_INICIAIS,
  obterTotalCashoutSessao,
  excluirLancamentoPoker,
  definirDiaPokerBloqueado,
  gerarUuidPoker,
  salvarCashoutsDaSessao,
  salvarLancamentosPoker,
  salvarLocaisPoker,
  salvarTaxaPadraoPoker
} from '../services/planilhasService'
import { LancamentoPoker } from '../types'

const MESES_ABREVIADOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const MES_NUMERO: Record<string, number> = { jan: 1, janeiro: 1, fev: 2, fevereiro: 2, mar: 3, março: 3, abr: 4, abril: 4, mai: 5, maio: 5, jun: 6, junho: 6, jul: 7, julho: 7, ago: 8, agosto: 8, set: 9, setembro: 9, out: 10, outubro: 10, nov: 11, novembro: 11, dez: 12, dezembro: 12 }

function dataPokerOrdenacao(data: string) {
  const m = data.trim().toLowerCase().match(/^(\d{1,2})[\/-]([a-zç]+)(?:[\/-](\d{2,4}))?$/i)
  if (!m) return 0
  const dia = Number(m[1])
  const mes = MES_NUMERO[m[2]] || 0
  const ano = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : 0
  return ano * 10000 + mes * 100 + dia
}

function compararLancamentosRecentes(a: LancamentoPoker, b: LancamentoPoker) {
  const porData = dataPokerOrdenacao(b.data_cartao) - dataPokerOrdenacao(a.data_cartao)
  if (porData) return porData
  const porOrdem = (Number(b.ordem) || 0) - (Number(a.ordem) || 0)
  return porOrdem || String(b.criado_em || b.id).localeCompare(String(a.criado_em || a.id))
}

function dataPokerHoje() {
  const [, mes, dia] = hojeISO().split('-').map(Number)
  return `${dia}/${MESES_ABREVIADOS[mes - 1]}`
}

function mesBaseHojeKey() {
  return hojeISO().slice(0, 7)
}

function proximoMesBaseKey() {
  const [ano, mes] = hojeISO().slice(0, 7).split('-').map(Number)
  const indice = ano * 12 + mes
  const anoSeguinte = Math.floor(indice / 12)
  const mesSeguinte = (indice % 12) + 1
  return `${anoSeguinte}-${String(mesSeguinte).padStart(2, '0')}`
}

function decomporMesBase(valor: string): { ano: number | null; mes: number } | null {
  const normalizado = valor.trim().toLowerCase()
  const iso = normalizado.match(/^(\d{4})-(\d{1,2})$/)
  if (iso) return { ano: Number(iso[1]), mes: Number(iso[2]) }
  const texto = normalizado.match(/^([a-zç]+)(?:\s+(?:de\s+)?(\d{4}))?$/i)
  if (!texto) return null
  const mes = MES_NUMERO[texto[1]]
  return mes ? { ano: texto[2] ? Number(texto[2]) : null, mes } : null
}

function normalizarMesBase(valor: string): string | null {
  const partes = decomporMesBase(valor)
  if (!partes) return null
  let ano = partes.ano
  if (!ano) {
    const [anoAtual, mesAtual] = mesBaseHojeKey().split('-').map(Number)
    ano = partes.mes > mesAtual ? anoAtual - 1 : anoAtual
  }
  return `${ano}-${String(partes.mes).padStart(2, '0')}`
}

function rotuloMesBase(valor: string) {
  const chave = normalizarMesBase(valor)
  if (!chave) return valor
  const [ano, mes] = chave.split('-').map(Number)
  const rotulo = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(ano, mes - 1, 1))
  return rotulo.charAt(0).toLocaleUpperCase('pt-BR') + rotulo.slice(1)
}

export function PokerScreen() {
  const [lancamentos, setLancamentos] = useState<LancamentoPoker[]>(LANCAMENTOS_POKER_INICIAIS)
  const [cashouts, setCashouts] = useState<CashoutsPokerMap>({})
  const [diasBloqueados, setDiasBloqueados] = useState<Record<string, boolean>>({})
  const [taxaPadraoPercentual, setTaxaPadraoPercentual] = useState<number>(5)
  const [locaisCadastrados, setLocaisCadastrados] = useState<string[]>(['MonteCarlo', 'H2'])
  const [cartoesCadastrados, setCartoesCadastrados] = useState<string[]>(['Nubank', 'PicPay', 'BTG'])

  const [mesFiltro, setMesFiltro] = useState<string>('Todos')
  const [filtroMesAberto, setFiltroMesAberto] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Modal para Nova Entrada / Edição de Linha
  const [modalNovoVisible, setModalNovoVisible] = useState(false)
  const [itemEditando, setItemEditando] = useState<LancamentoPoker | null>(null)
  const [itemExcluirConfirmar, setItemExcluirConfirmar] = useState<LancamentoPoker | null>(null)

  // Modal para Dropdown Verde (Local ou Cartão)
  const [modalDropdownVisible, setModalDropdownVisible] = useState(false)
  const [formDropdownAberto, setFormDropdownAberto] = useState<'mesBase' | 'cartao' | 'local' | null>(null)
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
  const [formMesBase, setFormMesBase] = useState(mesBaseHojeKey())
  const [formDataCartao, setFormDataCartao] = useState('31/out')
  const [formCartao, setFormCartao] = useState('')
  const [formLocal, setFormLocal] = useState('MonteCarlo')
  const [formValor, setFormValor] = useState('')
  const [formTaxa, setFormTaxa] = useState('')
  const [aplicarTaxa, setAplicarTaxa] = useState(true)
  const [manterAberto, setManterAberto] = useState(false)

  const carregar = useCallback(async () => {
    try {
      const data = await carregarLancamentosPoker()
      setLancamentos(data)
      setCashouts(carregarCashoutsPoker())
      setDiasBloqueados(await carregarDiasPokerBloqueados())
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
      return normalizarMesBase(item.mes_base) === normalizarMesBase(mesFiltro)
    })
  }, [lancamentos, mesFiltro])

  const opcoesMesBase = useMemo(() => [mesBaseHojeKey(), proximoMesBaseKey()].map((valor) => ({ valor, label: rotuloMesBase(valor) })), [])
  const opcoesFiltroMesBase = useMemo(() => Array.from(new Set(
    lancamentos.map((item) => normalizarMesBase(item.mes_base)).filter((valor): valor is string => Boolean(valor))
  )).sort((a, b) => b.localeCompare(a)).map((valor) => ({ valor, label: rotuloMesBase(valor) })), [lancamentos])

  // Agrupar por data da sessão (ex: '31/out', '30/out', '28/out')
  const sessoesAgrupadas = useMemo(() => {
    const map = new Map<string, LancamentoPoker[]>()
    lancamentosFiltrados.forEach((item) => {
      const data = item.data_cartao || 'Sem Data'
      if (!map.has(data)) map.set(data, [])
      map.get(data)!.push(item)
    })
    return Array.from(map.entries())
      .map(([data, itens]) => [data, [...itens].sort(compararLancamentosRecentes)] as [string, LancamentoPoker[]])
      .sort((a, b) => compararLancamentosRecentes(a[1][0], b[1][0]))
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

  const abrirDropdownFormulario = (tipo: 'cartao' | 'local') => {
    setFormDropdownAberto((aberto) => aberto === tipo ? null : tipo)
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

    setModalDropdownVisible(false)
    setDropdownConfig(null)
    setLancamentos(await salvarLancamentosPoker(listaAtualizada))
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

    // Se o modal de novo registro estiver aberto com taxa ativa, recalcula
    if (aplicarTaxa && formValor) {
      const v = parseFloat(formValor.replace(',', '.')) || 0
      if (v > 0) {
        const calculada = Math.round((v * (t / 100)) * 100) / 100
        setFormTaxa(calculada.toFixed(2).replace('.', ','))
      }
    }
  }

  // ==========================================
  // HANDLERS ENTRADAS (BUY-IN)
  // ==========================================
  const abrirModalNovo = (dataSessaoSugerida?: string, mesBaseSugerido?: string) => {
    setItemEditando(null)
    setFormDropdownAberto(null)
    setFormMesBase(mesBaseSugerido ? normalizarMesBase(mesBaseSugerido) || mesBaseHojeKey() : mesFiltro === 'Todos' ? mesBaseHojeKey() : mesFiltro)
    setFormDataCartao(dataSessaoSugerida || dataPokerHoje())
    setFormCartao('')
    setFormLocal('MonteCarlo')
    setFormValor('')
    setAplicarTaxa(true)
    setFormTaxa('')
    setModalNovoVisible(true)
  }

  const abrirModalEditar = (item: LancamentoPoker) => {
    setItemEditando(item)
    setFormDropdownAberto(null)
    setFormMesBase(normalizarMesBase(item.mes_base) || mesBaseHojeKey())
    setFormDataCartao(item.data_cartao)
    setFormCartao(item.cartao_nome)
    setFormLocal(item.local)
    setFormValor(item.valor > 0 ? item.valor.toString().replace('.', ',') : '')
    const temTaxa = Number(item.taxa) > 0
    setAplicarTaxa(temTaxa)
    setFormTaxa(temTaxa ? Number(item.taxa).toFixed(2).replace('.', ',') : '0,00')
    setModalNovoVisible(true)
  }

  const handleMudarValor = (valStr: string) => {
    setFormValor(valStr)
    const v = parseFloat(valStr.replace(',', '.')) || 0
    if (aplicarTaxa && v > 0) {
      const calculada = Math.round((v * (taxaPadraoPercentual / 100)) * 100) / 100
      setFormTaxa(calculada.toFixed(2).replace('.', ','))
    } else {
      setFormTaxa('0,00')
    }
  }

  const handleToggleTaxa = (novoStatus: boolean) => {
    setAplicarTaxa(novoStatus)
    const v = parseFloat(formValor.replace(',', '.')) || 0
    if (novoStatus && v > 0) {
      const calculada = Math.round((v * (taxaPadraoPercentual / 100)) * 100) / 100
      setFormTaxa(calculada.toFixed(2).replace('.', ','))
    } else {
      setFormTaxa('0,00')
    }
  }

  const salvarEntrada = async () => {
    const v = parseFloat(formValor.replace(',', '.')) || 0
    let tx = 0
    if (aplicarTaxa) {
      tx = parseFloat(formTaxa.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0
      if (tx <= 0 && v > 0) {
        tx = Math.round((v * (taxaPadraoPercentual / 100)) * 100) / 100
      }
    }

    if (v <= 0) {
      notify('Atenção', 'Informe um valor válido.')
      return
    }

    const itemSalvo: LancamentoPoker = {
      id: itemEditando ? itemEditando.id : gerarUuidPoker(),
      ordem: itemEditando?.ordem ?? Math.floor(Date.now() / 1000),
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
    listaAtualizada.sort(compararLancamentosRecentes)

    setLancamentos(await salvarLancamentosPoker(listaAtualizada))

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
    const item = lancamentos.find((it) => it.id === id)
    if (item && diasBloqueados[item.data_cartao]) {
      notify('Dia travado', 'Reabra o dia para excluir este lançamento.')
      return
    }
    try {
      await excluirLancamentoPoker(id)
      setLancamentos((anteriores) => anteriores.filter((it) => it.id !== id))
      setModalNovoVisible(false)
      notify('Excluído', 'Lançamento removido.')
    } catch (erro: any) {
      notify('Não foi possível excluir', erro?.message || 'Reabra o dia e tente novamente.')
    }
  }

  const alternarBloqueioDia = async (dataCartao: string, travado: boolean) => {
    try {
      await definirDiaPokerBloqueado(dataCartao, travado)
      setDiasBloqueados((atuais) => {
        const novos = { ...atuais }
        if (travado) novos[dataCartao] = true
        else delete novos[dataCartao]
        return novos
      })
      notify(travado ? 'Dia travado' : 'Dia reaberto', travado ? 'Os lançamentos deste dia não podem ser excluídos.' : 'Os lançamentos podem ser excluídos novamente.')
    } catch (erro: any) {
      notify('Não foi possível alterar o cadeado', erro?.message || 'Tente novamente.')
    }
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
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.btnTaxaTopo} onPress={() => { setTaxaInputVal(taxaPadraoPercentual.toString()); setModalTaxaVisible(true) }}>
              <Ionicons name="pricetag-outline" size={15} color="#854D0E" />
              <Text style={styles.btnTaxaTopoTexto}>{taxaPadraoPercentual}%</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnNovoTopo} onPress={() => abrirModalNovo()}>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.btnNovoTopoTexto}>Nova Entrada</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ======================================================== */}
        {/* CARDS SUPERIORES ADAPTADOS PARA CELULAR */}
        {/* ======================================================== */}
        <View style={styles.kpiRow}>
          {/* Card ValorSacado */}
          <View style={[styles.kpiCard, { borderLeftColor: '#0284C7' }]}>
            <Text style={styles.kpiLabel}>ValorSacado</Text>
            <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.kpiValue, { color: '#0369A1' }]}>
              {formatCurrency(totalSacadoGeral)}
            </Text>
            <Text style={styles.kpiHint}>Total Buy-ins do Mês</Text>
          </View>

          {/* Card ValorTaxa */}
          <View style={[styles.kpiCard, { borderLeftColor: '#D97706' }]}>
            <Text style={styles.kpiLabel}>ValorTaxa</Text>
            <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.kpiValue, { color: '#B45309' }]}>
              {formatCurrency(totalTaxaGeral)}
            </Text>
            <Text style={styles.kpiHint}>Taxas acumuladas</Text>
          </View>
        </View>

        {/* CASH OUT TOTAL e NET com o mesmo padrão dos cards de buy-in e taxa */}
        <View style={styles.kpiSecondRow}>
          <View style={[styles.kpiCard, { borderLeftColor: '#7C3AED' }]}>
            <Text style={styles.kpiLabel}>Cash out total</Text>
            <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.kpiValue, { color: '#6D28D9' }]}>{formatCurrency(totalCashoutGeral)}</Text>
            <Text style={styles.kpiHint}>Total recebido no mês</Text>
          </View>
          <View style={[styles.kpiCard, { borderLeftColor: totalNetGeral >= 0 ? '#16A34A' : '#DC2626' }]}>
            <Text style={styles.kpiLabel}>Líquido (Net)</Text>
            <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.kpiValue, { color: totalNetGeral >= 0 ? '#15803D' : '#DC2626' }]}>
              {totalNetGeral >= 0 ? `+${formatCurrency(totalNetGeral)}` : formatCurrency(totalNetGeral)}
            </Text>
            <Text style={styles.kpiHint}>Resultado do mês</Text>
          </View>
        </View>

        {/* Filtro por ano e mês base */}
        <View style={styles.filtrosRow}>
          <Text style={styles.inputLabel}>Mês base</Text>
          <TouchableOpacity style={styles.filterMonthButton} onPress={() => setFiltroMesAberto((aberto) => !aberto)}>
            <Ionicons name="calendar-outline" size={17} color={colors.primary} />
            <Text style={styles.filterMonthButtonText}>{mesFiltro === 'Todos' ? 'Todos os meses' : rotuloMesBase(mesFiltro)}</Text>
            <Ionicons name={filtroMesAberto ? 'chevron-up' : 'chevron-down'} size={16} color={colors.muted} />
          </TouchableOpacity>
          {filtroMesAberto && <ScrollView nestedScrollEnabled style={styles.monthOptionsList}>
            <TouchableOpacity style={styles.formDropdownOption} onPress={() => { setMesFiltro('Todos'); setFiltroMesAberto(false) }}><Text style={styles.formDropdownOptionText}>Todos os meses</Text></TouchableOpacity>
            {opcoesFiltroMesBase.map((opcao) => <TouchableOpacity key={opcao.valor} style={styles.formDropdownOption} onPress={() => { setMesFiltro(opcao.valor); setFiltroMesAberto(false) }}><Text style={styles.formDropdownOptionText}>{opcao.label}</Text></TouchableOpacity>)}
          </ScrollView>}
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
          const diaTravado = Boolean(diasBloqueados[dataSessao])

          return (
            <View key={dataSessao} style={[styles.sessaoCard, diaTravado ? styles.sessaoCardFechada : styles.sessaoCardAberta]}>
              {/* CABEÇALHO DO DIA */}
              <View style={[styles.sessaoTopBar, diaTravado ? styles.sessaoTopBarFechada : styles.sessaoTopBarAberta]}>
                <View style={styles.sessaoBadgeDia}>
                  <Ionicons name={diaTravado ? 'lock-closed' : 'lock-open-outline'} size={15} color={diaTravado ? '#92400E' : '#166534'} />
                  <Text style={[styles.sessaoDiaTexto, diaTravado && styles.sessaoDiaTextoFechada]}>Sessão: {dataSessao}</Text>
                </View>
                <View style={styles.sessaoTopActions}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={diaTravado ? `Reabrir dia ${dataSessao}` : `Travar dia ${dataSessao}`}
                    style={[styles.sessaoLockButton, diaTravado && styles.sessaoLockButtonActive]}
                    onPress={() => void alternarBloqueioDia(dataSessao, !diaTravado)}
                  >
                    <Ionicons name={diaTravado ? 'lock-closed' : 'lock-open-outline'} size={14} color={diaTravado ? '#B45309' : colors.textSecondary} />
                    <Text style={[styles.sessaoLockText, diaTravado && styles.sessaoLockTextActive]}>{diaTravado ? 'Reabrir' : 'Travar dia'}</Text>
                  </TouchableOpacity>
                  <Text style={styles.sessaoEntradasBadge}>
                    {itens.length} {itens.length === 1 ? 'entrada' : 'entradas'}
                  </Text>
                </View>
              </View>

              {/* ======================================================== */}
              {/* BOX DE RESUMO DA SESSÃO (GRADE 2x2 RESPONSIVA) */}
              {/* ======================================================== */}
              <View style={styles.resumoSessaoEmCimaContainer}>
                <View style={styles.resumoGridCards}>
                  {/* Linha 1: BuyIN e Taxa */}
                  <View style={styles.resumoGridRow}>
                    <View style={styles.resumoMiniBox}>
                      <Text style={styles.resumoMiniLabel}>BuyIN</Text>
                      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.resumoMiniValor}>
                        {formatCurrency(buyInSessao)}
                      </Text>
                    </View>

                    <View style={styles.resumoMiniBox}>
                      <Text style={styles.resumoMiniLabel}>Taxa</Text>
                      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.resumoMiniValor, { color: '#B45309' }]}>
                        {formatCurrency(taxaSessao)}
                      </Text>
                    </View>
                  </View>

                  {/* Linha 2: CASHout (editável) e NET */}
                  <View style={[styles.resumoGridRow, { marginTop: 8 }]}>
                    <TouchableOpacity
                      style={styles.cashoutMiniBoxAmarelo}
                      onPress={() => abrirModalCashout(dataSessao, itens)}
                    >
                      <View style={styles.cashoutMiniTop}>
                        <Text style={styles.cashoutMiniLabel}>CASHout</Text>
                        <Ionicons name="pencil" size={12} color="#854D0E" />
                      </View>
                      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.cashoutMiniValor}>
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

                    <View
                      style={[
                        styles.resumoMiniBox,
                        {
                          borderLeftWidth: 3.5,
                          borderLeftColor: netSessao >= 0 ? '#16A34A' : '#DC2626'
                        }
                      ]}
                    >
                      <Text style={styles.resumoMiniLabel}>NET (Sessão)</Text>
                      <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        style={[
                          styles.resumoMiniValor,
                          { color: netSessao >= 0 ? '#15803D' : '#DC2626', fontWeight: '900' }
                        ]}
                      >
                        {netSessao >= 0 ? `+${formatCurrency(netSessao)}` : formatCurrency(netSessao)}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Dica de rolagem lateral para celular */}
              <View style={styles.tableDicaContainer}>
                <Ionicons name="swap-horizontal" size={12} color={colors.muted} />
                <Text style={styles.tableDicaTexto}>Deslize lateralmente para ver todas as colunas</Text>
              </View>

              {/* ======================================================== */}
              {/* TABELA DE ENTRADAS (LINHAS UNIFORMES, SEM DISTORÇÃO) */}
              {/* ======================================================== */}
              <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={{ paddingRight: 12 }} style={styles.tableScroll}>
                <View style={[styles.tableContainer, { minWidth: 535 }]}>
                  {/* Header da Tabela */}
                  <View style={styles.tableHeader}>
                    <Text style={[styles.th, { width: 42 }]}>Ação</Text>
                    <Text style={[styles.th, { width: 85 }]}>DataCartão</Text>
                    <Text style={[styles.th, { width: 100 }]}>Cartão</Text>
                    <Text style={[styles.th, { width: 110 }]}>Local</Text>
                    <Text style={[styles.th, styles.thRight, { width: 100 }]}>Valor</Text>
                    <Text style={[styles.th, styles.thRight, { width: 85 }]}>Taxa</Text>
                  </View>

                  {/* Linhas Uniformes de Entradas */}
                  {itens.map((item, idx) => (
                    <View key={item.id} style={[styles.tr, idx % 2 === 1 && styles.trAlt]}>
                      <TouchableOpacity
                        disabled={diaTravado}
                        accessibilityRole="button"
                        accessibilityLabel={diaTravado ? 'Lançamento protegido pelo cadeado do dia' : `Excluir lançamento de ${item.data_cartao}`}
                        style={[styles.rowDeleteButton, diaTravado && styles.rowDeleteButtonDisabled]}
                        onPress={() => setItemExcluirConfirmar(item)}
                      >
                        <Ionicons name={diaTravado ? 'lock-closed' : 'trash-outline'} size={15} color={diaTravado ? '#92400E' : '#DC2626'} />
                      </TouchableOpacity>
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
                  onPress={() => abrirModalNovo(dataSessao, itens[0]?.mes_base)}
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
      <Modal visible={modalDropdownVisible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setModalDropdownVisible(false)}>
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
                  <TouchableOpacity style={styles.formMonthButton} onPress={() => setFormDropdownAberto((aberto) => aberto === 'mesBase' ? null : 'mesBase')}>
                    <Text numberOfLines={1} style={styles.formMonthButtonText}>{rotuloMesBase(formMesBase)}</Text>
                    <Ionicons name={formDropdownAberto === 'mesBase' ? 'chevron-up' : 'chevron-down'} size={16} color={colors.primary} />
                  </TouchableOpacity>
                  {formDropdownAberto === 'mesBase' && <ScrollView nestedScrollEnabled style={styles.monthOptionsList}>{opcoesMesBase.map((opcao) => <TouchableOpacity key={opcao.valor} style={styles.formDropdownOption} onPress={() => { setFormMesBase(opcao.valor); setFormDropdownAberto(null) }}><Text style={styles.formDropdownOptionText}>{opcao.label}</Text></TouchableOpacity>)}</ScrollView>}
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
                  <View style={styles.formPickerRow}>
                    <TextInput style={[styles.input, styles.formPickerInput]} placeholder="Nome do cartão" value={formCartao} onChangeText={setFormCartao} />
                    <TouchableOpacity style={styles.formPickerButton} accessibilityLabel="Escolher cartão cadastrado" onPress={() => abrirDropdownFormulario('cartao')}><Ionicons name={formDropdownAberto === 'cartao' ? 'chevron-up' : 'chevron-down'} size={16} color={colors.primary} /></TouchableOpacity>
                  </View>
                  {formDropdownAberto === 'cartao' && <ScrollView nestedScrollEnabled style={styles.formDropdownOptions}>{['', ...cartoesCadastrados].map((op) => <TouchableOpacity key={op || 'nenhum'} style={styles.formDropdownOption} onPress={() => { setFormCartao(op); setFormDropdownAberto(null) }}><Text style={styles.formDropdownOptionText}>{op || 'Nenhum cartão'}</Text></TouchableOpacity>)}</ScrollView>}
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Local:</Text>
                  <View style={styles.formPickerRow}>
                    <TextInput style={[styles.input, styles.formPickerInput]} placeholder="Nome do clube" value={formLocal} onChangeText={setFormLocal} />
                    <TouchableOpacity style={styles.formPickerButton} accessibilityLabel="Escolher clube cadastrado" onPress={() => abrirDropdownFormulario('local')}><Ionicons name={formDropdownAberto === 'local' ? 'chevron-up' : 'chevron-down'} size={16} color={colors.primary} /></TouchableOpacity>
                  </View>
                  {formDropdownAberto === 'local' && <ScrollView nestedScrollEnabled style={styles.formDropdownOptions}>{locaisCadastrados.map((op) => <TouchableOpacity key={op} style={styles.formDropdownOption} onPress={() => { setFormLocal(op); setFormDropdownAberto(null) }}><Text style={styles.formDropdownOptionText}>{op}</Text></TouchableOpacity>)}</ScrollView>}
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
                    style={[styles.input, styles.inputTaxaSomenteLeitura]}
                    placeholder="0,00"
                    value={formTaxa}
                    editable={false}
                    selectTextOnFocus={false}
                  />
                </View>
              </View>

              <View style={[styles.aplicarTaxaRow, aplicarTaxa ? styles.aplicarTaxaRowAtiva : styles.aplicarTaxaRowInativa]}>
                <View style={[styles.aplicarTaxaIcon, aplicarTaxa && styles.aplicarTaxaIconAtivo]}><Ionicons name="pricetag-outline" size={17} color={aplicarTaxa ? '#15803D' : colors.muted} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.aplicarTaxaTitulo}>{aplicarTaxa ? 'Taxa ativada' : 'Taxa desativada'}</Text>
                  <Text style={styles.aplicarTaxaSub}>{aplicarTaxa ? `${taxaPadraoPercentual}% calculados automaticamente sobre o buy-in` : 'Nenhuma taxa será adicionada'}</Text>
                </View>
                <View style={styles.aplicarTaxaControle}>
                  <Switch value={aplicarTaxa} onValueChange={handleToggleTaxa} trackColor={{ false: '#CBD5E1', true: '#22C55E' }} thumbColor="#fff" />
                  <Text style={[styles.aplicarTaxaEstado, aplicarTaxa && styles.aplicarTaxaEstadoAtivo]}>{aplicarTaxa ? 'Sim' : 'Não'}</Text>
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
                {itemEditando && !diasBloqueados[itemEditando.data_cartao] && (
                  <TouchableOpacity
                    style={styles.btnExcluir}
                    onPress={() => excluirEntrada(itemEditando.id)}
                  >
                    <Ionicons name="trash-outline" size={16} color="#DC2626" />
                    <Text style={styles.btnExcluirTexto}>Excluir</Text>
                  </TouchableOpacity>
                )}
                {itemEditando && diasBloqueados[itemEditando.data_cartao] && <Text style={styles.avisoDiaTravado}>Dia travado: reabra para excluir.</Text>}

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
      <Modal visible={Boolean(itemExcluirConfirmar)} transparent animationType="fade" onRequestClose={() => setItemExcluirConfirmar(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.deleteConfirmIcon}><Ionicons name="trash-outline" size={23} color="#DC2626" /></View>
            <Text style={styles.modalTitulo}>Excluir lançamento?</Text>
            <Text style={styles.modalSub}>O lançamento de {itemExcluirConfirmar?.data_cartao} será removido permanentemente.</Text>
            <View style={styles.modalBotoes}>
              <TouchableOpacity style={styles.btnCancelar} onPress={() => setItemExcluirConfirmar(null)}><Text style={styles.btnCancelarTexto}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={styles.btnExcluirConfirmar} onPress={() => { const id = itemExcluirConfirmar?.id; setItemExcluirConfirmar(null); if (id) void excluirEntrada(id) }}><Text style={styles.btnExcluirConfirmarTexto}>Excluir lançamento</Text></TouchableOpacity>
            </View>
          </View>
        </View>
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
    padding: 14,
    paddingBottom: 110
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7
  },
  btnTaxaTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#FEF08A',
    borderColor: '#FACC15',
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 8,
    borderRadius: 8
  },
  btnTaxaTopoTexto: {
    color: '#854D0E',
    fontWeight: '800',
    fontSize: 12
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
    marginBottom: 10
  },
  kpiCard: {
    flex: 1,
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
  kpiSecondRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
    alignItems: 'stretch'
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
    flex: 1,
    backgroundColor: '#FEF08A',
    borderColor: '#FACC15',
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
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
    flex: 2,
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'space-around'
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
  filterMonthButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface
  },
  filterMonthButtonText: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: '700'
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
  sessaoCardAberta: {
    borderColor: '#86EFAC'
  },
  sessaoCardFechada: {
    borderColor: '#FBBF24',
    backgroundColor: '#FFFBEB'
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
  sessaoTopBarAberta: {
    backgroundColor: '#F0FDF4',
    borderBottomColor: '#BBF7D0'
  },
  sessaoTopBarFechada: {
    backgroundColor: '#FEF3C7',
    borderBottomColor: '#FCD34D'
  },
  sessaoTopActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9
  },
  sessaoLockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface
  },
  sessaoLockButtonActive: {
    borderColor: '#F59E0B',
    backgroundColor: '#FEF3C7'
  },
  sessaoLockText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700'
  },
  sessaoLockTextActive: {
    color: '#92400E'
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
  sessaoDiaTextoFechada: {
    color: '#78350F'
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
    flexDirection: 'column'
  },
  resumoGridRow: {
    flexDirection: 'row',
    gap: 8
  },
  tableDicaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  tableDicaTexto: {
    fontSize: 10,
    color: colors.muted,
    fontWeight: '600'
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
    flex: 1,
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
  rowDeleteButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#FEE2E2'
  },
  rowDeleteButtonDisabled: {
    backgroundColor: '#FEF3C7'
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
  formPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5
  },
  formPickerInput: {
    flex: 1,
    minWidth: 0
  },
  formPickerButton: {
    width: 40,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 8
  },
  formMonthButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.background
  },
  formMonthButtonText: {
    flex: 1,
    color: colors.text,
    fontSize: 12,
    fontWeight: '600'
  },
  monthOptionsList: {
    maxHeight: 190,
    marginTop: 5,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface
  },
  formDropdownOptions: {
    maxHeight: 140,
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface
  },
  formDropdownOption: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  formDropdownOptionText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600'
  },
  inputTaxaSomenteLeitura: {
    backgroundColor: colors.surfaceHover,
    color: colors.textSecondary
  },
  aplicarTaxaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1
  },
  aplicarTaxaRowAtiva: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0'
  },
  aplicarTaxaRowInativa: {
    backgroundColor: colors.background,
    borderColor: colors.border
  },
  aplicarTaxaIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: colors.surfaceHover
  },
  aplicarTaxaIconAtivo: {
    backgroundColor: '#DCFCE7'
  },
  aplicarTaxaControle: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 50
  },
  aplicarTaxaTitulo: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700'
  },
  aplicarTaxaSub: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2
  },
  aplicarTaxaEstado: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    marginTop: -2
  },
  aplicarTaxaEstadoAtivo: {
    color: '#15803D'
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
  deleteConfirmIcon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 23,
    backgroundColor: '#FEE2E2',
    marginBottom: 12
  },
  btnExcluirConfirmar: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#DC2626'
  },
  btnExcluirConfirmarTexto: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700'
  },
  avisoDiaTravado: {
    flex: 1,
    color: '#92400E',
    fontSize: 11,
    fontWeight: '600'
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
