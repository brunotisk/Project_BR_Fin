import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../theme'
import { notify } from '../utils/notify'
import {
  carregarPlanejamento,
  gerarUuidPoker,
  salvarPlanejamento,
  type DadosPlanejamento,
  type GrupoPlanejamento,
  type LinhaPlanejamento,
  type SecaoPlanejamento
} from '../services/planilhasService'
import { useLayoutMode } from '../services/LayoutModeProvider'
import { GraficosMes } from '../components/GraficosPlanejamento'

const ROW_H = 38
const COL_NOME = 168
const COL_MES = 104
const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

const numeroFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function rotuloMes(mes: string) {
  const [ano, m] = mes.split('-')
  return `${MESES_ABREV[Number(m) - 1]}/${ano.slice(2)}`
}

function deslocarMes(mes: string, delta: number) {
  const [ano, m] = mes.split('-').map(Number)
  const d = new Date(ano, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function mesAtual() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Aceita "1.234,56", "1234.56", "-500", "(500)" e "R$ 10". Retorna null se vazio. */
function parseValor(texto: string): number | null {
  let t = texto.replace(/R\$|\s/g, '').trim()
  if (!t || t === '-') return null
  let negativo = false
  if (/^\(.*\)$/.test(t)) { negativo = true; t = t.slice(1, -1) }
  if (t.startsWith('-')) { negativo = !negativo; t = t.slice(1) }
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  const n = Number(t)
  if (!Number.isFinite(n)) return null
  return negativo ? -n : n
}

function formatarCelula(valor: number, secao: SecaoPlanejamento | 'saldo') {
  if (!valor) return '-'
  if (secao === 'gasto') return valor > 0 ? `(${numeroFmt.format(valor)})` : numeroFmt.format(-valor)
  return valor < 0 ? `-${numeroFmt.format(-valor)}` : numeroFmt.format(valor)
}

function CelulaValor({ valor, secao, largura, bloqueado, rotuloPct, centro, passado, onChange }: { valor: number | undefined; secao: SecaoPlanejamento; largura: number; bloqueado: boolean; rotuloPct?: RotuloPct; centro?: boolean; passado?: boolean; onChange: (v: number | null) => void }) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState('')
  const v = valor || 0
  const negativo = v < 0
  // Se a tela for travada com a célula ainda em digitação, grava o que foi digitado.
  const pendenteRef = useRef<{ editando: boolean; texto: string; onChange: typeof onChange }>({ editando: false, texto: '', onChange })
  pendenteRef.current = { editando, texto, onChange }
  useEffect(() => {
    // A célula continua montada quando trava (só troca o campo por texto), então observa a trava.
    const p = pendenteRef.current
    if (bloqueado && p.editando) { setEditando(false); p.onChange(parseValor(p.texto)) }
  }, [bloqueado])
  useEffect(() => () => { const p = pendenteRef.current; if (p.editando) p.onChange(parseValor(p.texto)) }, [])
  if (bloqueado) {
    if (rotuloPct !== undefined) return <CelulaComPercentual largura={largura} centro={centro} texto={formatarCelula(v, secao)} rotuloPct={rotuloPct} estiloTexto={passado ? styles.passado : negativo ? { color: colors.expense } : undefined} />
    return <Text numberOfLines={1} style={[styles.celula, { width: largura }, centro && styles.centro, negativo && { color: colors.expense }, passado && styles.passado]}>{formatarCelula(v, secao)}</Text>
  }
  return (
    <TextInput
      style={[styles.celula, { width: largura }, styles.celulaInput, centro && styles.centro, editando && styles.celulaEditando, !editando && negativo && { color: colors.expense }, !editando && passado && styles.passado]}
      value={editando ? texto : formatarCelula(v, secao)}
      onFocus={() => { setEditando(true); setTexto(v ? String(v).replace('.', ',') : '') }}
      onChangeText={setTexto}
      onBlur={() => { setEditando(false); onChange(parseValor(texto)) }}
      onSubmitEditing={() => { setEditando(false); onChange(parseValor(texto)) }}
      keyboardType="numbers-and-punctuation"
      selectTextOnFocus
      textAlign="right"
    />
  )
}

const percentualFmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

/** Formata um percentual; "–" quando não dá para calcular (todo igual a zero). */
function textoPct(valor: number | null) {
  return valor === null ? '–' : `${percentualFmt.format(valor)}%`
}

/** % dentro do grupo (opcional) e % sobre o total de gastos do mês (global). */
type RotuloPct = { grupo?: string; total: string }

/** Valor com o percentual em letra menor logo abaixo, na mesma altura de linha. */
function CelulaComPercentual({ largura, texto, rotuloPct, estiloTexto, centro, passado }: { largura: number; texto: string; rotuloPct: RotuloPct; estiloTexto?: object; centro?: boolean; passado?: boolean }) {
  return (
    <View style={[styles.celulaDupla, { width: largura }]}>
      <Text numberOfLines={1} style={[styles.celulaDuplaValor, estiloTexto, centro && styles.centro, passado && styles.passado]}>{texto}</Text>
      <Text numberOfLines={1} style={styles.celulaDuplaPct}>
        {rotuloPct.grupo !== undefined && <><Text style={styles.pctGrupo}>{rotuloPct.grupo}</Text><Text style={styles.pctGrupo}> | </Text></>}
        <Text style={styles.pctGlobal}>{rotuloPct.total}</Text>
      </Text>
    </View>
  )
}

type NivelZoom = 'padrao' | 'reduzido' | 'ajustar'
const CHAVE_ZOOM = '@fin_planejamento_zoom'
function lerZoom(): NivelZoom {
  try {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem(CHAVE_ZOOM) : null
    if (v === 'padrao' || v === 'reduzido' || v === 'ajustar') return v
  } catch { /* sem armazenamento local */ }
  return 'padrao'
}

const CHAVE_PERCENTUAIS = '@fin_planejamento_percentuais'
function lerPercentuais(): boolean {
  try { return typeof localStorage !== 'undefined' && localStorage.getItem(CHAVE_PERCENTUAIS) === '1' } catch { return false }
}

type VisaoGastos = 'detalhada' | 'agrupada'
const CHAVE_VISAO_GASTOS = '@fin_planejamento_visao_gastos'
function lerVisaoGastos(): VisaoGastos {
  try { if (typeof localStorage !== 'undefined' && localStorage.getItem(CHAVE_VISAO_GASTOS) === 'agrupada') return 'agrupada' } catch { /* ignora */ }
  return 'detalhada'
}

/** Bloco exibido na seção de gastos: uma linha solta ou um grupo com suas linhas. */
type BlocoGasto = { tipo: 'linha'; linha: LinhaPlanejamento } | { tipo: 'grupo'; grupo: GrupoPlanejamento; linhas: LinhaPlanejamento[] }

type EstadoSalvamento = 'ocioso' | 'salvando' | 'salvo' | 'erro'

export function PlanejamentoFinanceiroScreen() {
  const [plano, setPlano] = useState<DadosPlanejamento | null>(null)
  const [estado, setEstado] = useState<EstadoSalvamento>('ocioso')
  const [linhaEditando, setLinhaEditando] = useState<LinhaPlanejamento | null>(null)
  const [mesEditando, setMesEditando] = useState<string | null>(null)
  const [seletorMeses, setSeletorMeses] = useState(false)
  // A tela abre travada; o botão Editar libera alterações até ser travada de novo.
  const [modoEdicao, setModoEdicao] = useState(false)
  const [ajudaVisivel, setAjudaVisivel] = useState(false)
  // Celular: opções (editar, gastos, filtros, zoom) ficam num menu recolhível que fecha após cada escolha.
  const [menuAberto, setMenuAberto] = useState(false)
  const [gerenciarGrupos, setGerenciarGrupos] = useState(false)
  // Visão dos gastos: detalhada (linha a linha, editável) ou agrupada (um total por grupo, só leitura).
  const [visaoGastos, setVisaoGastosEstado] = useState<VisaoGastos>(lerVisaoGastos)
  // Mostrar % de cada grupo no total de gastos e de cada gasto no seu grupo.
  const [mostrarPct, setMostrarPctEstado] = useState<boolean>(lerPercentuais)
  const alternarPct = () => setMostrarPctEstado((atual) => {
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(CHAVE_PERCENTUAIS, atual ? '0' : '1') } catch { /* ignora */ }
    return !atual
  })
  const definirVisaoGastos = (v: VisaoGastos) => {
    setVisaoGastosEstado(v)
    if (v === 'agrupada') setModoEdicao(false)
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(CHAVE_VISAO_GASTOS, v) } catch { /* ignora */ }
  }
  const { modo } = useLayoutMode()
  // No computador há espaço para colunas mais largas.
  const colMes = modo === 'desktop' ? 132 : COL_MES
  const colNome = modo === 'desktop' ? 240 : COL_NOME
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendente = useRef<DadosPlanejamento | null>(null)
  // Zoom da tabela: escolha guardada neste aparelho.
  const [zoom, setZoomEstado] = useState<NivelZoom>(lerZoom)
  const [larguraArea, setLarguraArea] = useState(0)
  const [alturaTabela, setAlturaTabela] = useState(0)
  const definirZoom = (z: NivelZoom) => {
    setZoomEstado(z)
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(CHAVE_ZOOM, z) } catch { /* ignora */ }
  }

  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null)
  const [tentativa, setTentativa] = useState(0)

  useFocusEffect(useCallback(() => {
    let ativo = true
    setErroCarregamento(null)
    setModoEdicao(false)
    // Sem resposta em 20s, mostra erro em vez de deixar a tela girando para sempre.
    const limite = new Promise<never>((_, rejeitar) => setTimeout(() => rejeitar(new Error('O banco demorou demais para responder.')), 20000))
    Promise.race([carregarPlanejamento(), limite])
      .then((p) => { if (ativo && !pendente.current) setPlano(p) })
      .catch((err) => {
        console.warn('Erro ao carregar planejamento:', err)
        // Não cai para um plano vazio: o salvamento automático poderia sobrescrever o plano do banco.
        if (ativo) setErroCarregamento(err?.message || String(err))
      })
    return () => { ativo = false }
  }, [tentativa]))

  const salvarAgora = useCallback(async () => {
    const alvo = pendente.current
    if (!alvo) return
    pendente.current = null
    setEstado('salvando')
    try {
      await salvarPlanejamento(alvo)
      setEstado(pendente.current ? 'salvando' : 'salvo')
    } catch (err) {
      console.warn('Erro ao salvar planejamento:', err)
      setEstado('erro')
    }
  }, [])

  useEffect(() => () => { if (timer.current) { clearTimeout(timer.current); void salvarAgora() } }, [salvarAgora])

  const atualizar = useCallback((fn: (p: DadosPlanejamento) => DadosPlanejamento) => {
    setPlano((atual) => {
      if (!atual) return atual
      const novo = fn(atual)
      pendente.current = novo
      setEstado('salvando')
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => { timer.current = null; void salvarAgora() }, 700)
      return novo
    })
  }, [salvarAgora])

  const entradas = useMemo(() => plano?.linhas.filter((l) => l.secao === 'entrada') ?? [], [plano])
  const gastos = useMemo(() => plano?.linhas.filter((l) => l.secao === 'gasto') ?? [], [plano])

  const totais = useMemo(() => {
    const meses = plano?.meses ?? []
    const soma = (linhas: LinhaPlanejamento[], mes: string) => linhas.reduce((acc, l) => acc + (l.valores[mes] || 0), 0)
    let acumulado = 0
    return meses.map((mes) => {
      const ent = soma(entradas, mes)
      const gas = soma(gastos, mes)
      const saldo = ent - gas
      const ajuste = plano?.ajustes?.[mes] || 0
      acumulado += saldo + ajuste
      return { mes, ent, gas, saldo, ajuste, acumulado }
    })
  }, [plano, entradas, gastos])

  if (!plano) {
    return <View style={[styles.container, { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }]}>
      {erroCarregamento ? <>
        <Ionicons name="cloud-offline-outline" size={32} color={colors.expense} />
        <Text style={[styles.title, { fontSize: 16, textAlign: 'center' }]}>Não foi possível carregar o planejamento</Text>
        <Text style={[styles.subtitle, { textAlign: 'center' }]}>{erroCarregamento}</Text>
        <TouchableOpacity style={styles.botaoPrimario} onPress={() => { setErroCarregamento(null); setTentativa((t) => t + 1) }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Tentar novamente</Text>
        </TouchableOpacity>
      </> : <ActivityIndicator color={colors.primary} />}
    </View>
  }

  const setAjuste = (mes: string, v: number | null) => atualizar((p) => {
    const ajustes = { ...(p.ajustes ?? {}) }
    if (v) ajustes[mes] = v; else delete ajustes[mes]
    return { ...p, ajustes }
  })
  const setValor = (id: string, mes: string, v: number | null) => atualizar((p) => ({
    ...p,
    linhas: p.linhas.map((l) => {
      if (l.id !== id) return l
      const valores = { ...l.valores }
      if (v === null || v === 0) delete valores[mes]
      else valores[mes] = v
      return { ...l, valores }
    })
  }))

  const adicionarLinha = (secao: SecaoPlanejamento) => {
    const nova: LinhaPlanejamento = { id: gerarUuidPoker(), secao, nome: secao === 'entrada' ? 'Nova entrada' : 'Novo gasto', valores: {} }
    atualizar((p) => {
      // Insere após a última linha da mesma seção para manter o agrupamento.
      const ultimo = p.linhas.map((l) => l.secao).lastIndexOf(secao)
      const linhas = [...p.linhas]
      linhas.splice(ultimo + 1, 0, nova)
      return { ...p, linhas }
    })
    setLinhaEditando(nova)
  }

  const moverLinha = (id: string, direcao: -1 | 1) => atualizar((p) => {
    const linhas = [...p.linhas]
    const i = linhas.findIndex((l) => l.id === id)
    if (i < 0) return p
    // Procura a linha vizinha da mesma seção e do mesmo grupo de gastos.
    const mesmoBloco = (l: LinhaPlanejamento) => l.secao === linhas[i].secao && (l.grupoId ?? null) === (linhas[i].grupoId ?? null)
    let j = i + direcao
    while (j >= 0 && j < linhas.length && !mesmoBloco(linhas[j])) j += direcao
    if (j < 0 || j >= linhas.length) return p
    ;[linhas[i], linhas[j]] = [linhas[j], linhas[i]]
    return { ...p, linhas }
  })

  const adicionarMes = (posicao: 'inicio' | 'fim') => atualizar((p) => {
    const base = p.meses.length ? (posicao === 'inicio' ? p.meses[0] : p.meses[p.meses.length - 1]) : mesAtual()
    if (!p.meses.length) return { ...p, meses: [base] }
    return { ...p, meses: posicao === 'inicio' ? [deslocarMes(base, -1), ...p.meses] : [...p.meses, deslocarMes(base, 1)] }
  })

  const removerMes = (mes: string) => {
    atualizar((p) => {
      const meses = p.meses.filter((m) => m !== mes)
      const ocultosRestantes = (p.mesesOcultos ?? []).filter((m) => m !== mes)
      // Se o mês removido era o único na tela, volta a mostrar todos.
      return { ...p, meses, mesesOcultos: meses.every((m) => ocultosRestantes.includes(m)) ? [] : ocultosRestantes }
    })
    setMesEditando(null)
  }

  const copiarMesParaSeguintes = (mes: string) => {
    atualizar((p) => {
      const idx = p.meses.indexOf(mes)
      const seguintes = p.meses.slice(idx + 1)
      return {
        ...p,
        linhas: p.linhas.map((l) => {
          const valores = { ...l.valores }
          seguintes.forEach((m) => { if (l.valores[mes]) valores[m] = l.valores[mes]; else delete valores[m] })
          return { ...l, valores }
        })
      }
    })
    setMesEditando(null)
  }

  // Meses ocultos continuam no plano (e no saldo acumulado), só não aparecem na grade.
  const ocultos = new Set(plano.mesesOcultos ?? [])
  const visiveisPlano = plano.meses.filter((m) => !ocultos.has(m))
  const mesHoje = mesAtual()
  const visiveis = visiveisPlano
  // Com um único mês no filtro, os gráficos dele aparecem ao lado da tabela.
  const mesUnico = visiveis.length === 1 ? visiveis[0] : null
  const totaisVisiveis = totais.filter((t) => visiveis.includes(t.mes))
  const larguraNatural = colNome + visiveis.length * colMes + 2
  const escalaAjustar = larguraArea > 0 ? Math.min(1, (larguraArea - 24) / larguraNatural) : 1
  const escala = zoom === 'padrao' ? 1 : zoom === 'reduzido' ? 0.5 : escalaAjustar

  // Sempre fica pelo menos um mês na tela: um filtro que ocultaria todos é ignorado.
  const definirOcultos = (fn: (meses: string[]) => string[]) => atualizar((p) => {
    const novos = fn(p.meses)
    return p.meses.length > 0 && p.meses.every((m) => novos.includes(m)) ? p : { ...p, mesesOcultos: novos }
  })
  const alternarMes = (mes: string) => definirOcultos((meses) => {
    const atuais = new Set(plano.mesesOcultos ?? [])
    if (atuais.has(mes)) atuais.delete(mes); else atuais.add(mes)
    return meses.filter((m) => atuais.has(m))
  })
  const mesesFuturos = plano.meses.filter((m) => m >= mesAtual())
  const ocultarMes = (mes: string) => { alternarMes(mes); setMesEditando(null) }
  // "Selecionar mês" = filtro com só esse mês visível (igual a escolher um único mês em Filtros).
  const selecionarSomenteMes = (mes: string) => { definirOcultos((meses) => meses.filter((m) => m !== mes)); setMesEditando(null) }
  const totalDoMes = (mes: string | null) => totais.find((t) => t.mes === mes) ?? { mes: mes ?? '', ent: 0, gas: 0, saldo: 0, acumulado: 0 }

  // Blocos de gastos na ordem da primeira linha de cada grupo; grupos vazios vão ao fim.
  const grupos = plano.grupos ?? []
  const grupoPorId = new Map(grupos.map((g) => [g.id, g]))
  const grupoValido = (l: LinhaPlanejamento) => (l.grupoId && grupoPorId.has(l.grupoId) ? l.grupoId : null)
  const blocosGastos: BlocoGasto[] = []
  const blocoDoGrupo = new Map<string, Extract<BlocoGasto, { tipo: 'grupo' }>>()
  for (const l of gastos) {
    const gid = grupoValido(l)
    if (!gid) { blocosGastos.push({ tipo: 'linha', linha: l }); continue }
    let bloco = blocoDoGrupo.get(gid)
    if (!bloco) { bloco = { tipo: 'grupo', grupo: grupoPorId.get(gid)!, linhas: [] }; blocoDoGrupo.set(gid, bloco); blocosGastos.push(bloco) }
    bloco.linhas.push(l)
  }
  grupos.filter((g) => !blocoDoGrupo.has(g.id)).forEach((g) => blocosGastos.push({ tipo: 'grupo', grupo: g, linhas: [] }))
  const agrupada = visaoGastos === 'agrupada' && grupos.length > 0
  const somaGrupo = (linhas: LinhaPlanejamento[], mes: string) => linhas.reduce((acc, l) => acc + (l.valores[mes] || 0), 0)
  const totalGastosMes = new Map(totais.map((t) => [t.mes, t.gas]))
  const gastosDoMes = (mes: string | null) => !mes ? [] : blocosGastos.map((b) => b.tipo === 'grupo'
    ? { nome: b.grupo.nome, valor: somaGrupo(b.linhas, mes) }
    : { nome: b.linha.nome, valor: b.linha.valores[mes] || 0 })
  /** Parte/todo em %; null quando o todo é zero (não há como dividir). */
  const pct = (parte: number, todo: number) => (todo ? (parte / todo) * 100 : null)
  // Índice/total de cada linha solta entre as linhas soltas, para habilitar as setas.
  const soltas = gastos.filter((l) => !grupoValido(l))

  const criarGrupo = (nome: string) => atualizar((p) => ({ ...p, grupos: [...(p.grupos ?? []), { id: gerarUuidPoker(), nome }] }))
  const renomearGrupo = (id: string, nome: string) => atualizar((p) => ({ ...p, grupos: (p.grupos ?? []).map((g) => g.id === id ? { ...g, nome } : g) }))
  const excluirGrupo = (id: string) => atualizar((p) => ({
    ...p,
    grupos: (p.grupos ?? []).filter((g) => g.id !== id),
    // As linhas do grupo continuam existindo, só ficam sem grupo.
    linhas: p.linhas.map((l) => l.grupoId === id ? { ...l, grupoId: null } : l)
  }))

  const textoEstado = estado === 'salvando' ? 'Salvando…' : estado === 'salvo' ? 'Salvo' : estado === 'erro' ? 'Erro ao salvar (mantido no aparelho)' : ''

  const renderNome = (l: LinhaPlanejamento, idx: number, total: number, recuo = false) => (
    <View key={l.id} style={[styles.nomeLinha, recuo && { paddingLeft: 24 }]}>
      <TouchableOpacity style={{ flex: 1 }} disabled={!modoEdicao} onPress={() => setLinhaEditando(l)}>
        <Text style={styles.nomeTexto} numberOfLines={1}>{l.nome || '(sem nome)'}</Text>
      </TouchableOpacity>
      {modoEdicao && <>
      <TouchableOpacity disabled={idx === 0} onPress={() => moverLinha(l.id, -1)} hitSlop={6} style={styles.seta}>
        <Ionicons name="chevron-up" size={15} color={idx === 0 ? colors.border : colors.muted} />
      </TouchableOpacity>
      <TouchableOpacity disabled={idx === total - 1} onPress={() => moverLinha(l.id, 1)} hitSlop={6} style={styles.seta}>
        <Ionicons name="chevron-down" size={15} color={idx === total - 1 ? colors.border : colors.muted} />
      </TouchableOpacity>
      </>}
    </View>
  )

  const linhaTotal = (valor: (t: typeof totais[number]) => number, secao: SecaoPlanejamento | 'saldo', destaque = false) => (
    <View style={styles.linhaMeses}>
      {totaisVisiveis.map((t) => {
        const v = valor(t)
        return <Text key={t.mes} style={[styles.celula, { width: colMes }, styles.celulaTotal, t.mes === mesHoje && styles.centro, destaque && v < 0 && { color: colors.expense }, destaque && v > 0 && { color: colors.income }, t.mes < mesHoje && styles.passado]}>{formatarCelula(v, secao)}</Text>
      })}
    </View>
  )

  const celular = modo !== 'desktop'
  const mostrarOpcoes = !celular || menuAberto
  const fecharMenu = () => { if (celular) setMenuAberto(false) }
  // Resumo das escolhas atuais, mostrado no botão do menu recolhido.
  const resumoMenu = [
    modoEdicao ? 'Editando' : null,
    grupos.length > 0 ? (visaoGastos === 'agrupada' ? 'Agrupada' : 'Detalhada') : null,
    mostrarPct ? '%' : null,
    `${visiveisPlano.length}/${plano.meses.length} meses`,
    zoom === 'padrao' ? '100%' : zoom === 'reduzido' ? '50%' : 'Tudo',
    textoEstado || null
  ].filter(Boolean).join(' · ')

  return (
    <View style={styles.container}>
      <View style={[styles.header, celular && !menuAberto && { paddingBottom: 6 }]}>
        {/* Título com o box de edição ao lado; Filtros e Zoom à direita na mesma linha. */}
        <View style={styles.linhaTitulo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.title}>Planejamento</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Como usar o planejamento" hitSlop={8} onPress={() => setAjudaVisivel(true)} style={styles.botaoAjuda}>
              <Ionicons name="information-circle-outline" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>
          {celular && <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: menuAberto }} accessibilityLabel="Opções de visualização" onPress={() => setMenuAberto((a) => !a)} style={[styles.botaoMenu, menuAberto && styles.botaoMenuAberto]}>
            <Ionicons name="options-outline" size={16} color={menuAberto ? '#fff' : colors.primary} />
            <Text numberOfLines={1} style={[styles.botaoMenuTexto, menuAberto && { color: '#fff' }]}>{resumoMenu}</Text>
            <Ionicons name={menuAberto ? 'chevron-up' : 'chevron-down'} size={16} color={menuAberto ? '#fff' : colors.primary} />
          </TouchableOpacity>}
          {mostrarOpcoes || modoEdicao ? <View style={[styles.box, modoEdicao && styles.boxEdicaoAtivo]}>
            <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: modoEdicao, disabled: agrupada }} disabled={agrupada} style={[styles.botaoMes, modoEdicao && styles.botaoEdicaoAtivo, agrupada && { opacity: 0.5 }]} onPress={() => { setModoEdicao((e) => !e); fecharMenu() }}>
              <Ionicons name={modoEdicao ? 'lock-open-outline' : agrupada ? 'lock-closed-outline' : 'create-outline'} size={14} color={modoEdicao ? '#fff' : colors.primary} />
              <Text style={[styles.botaoMesTexto, modoEdicao && { color: '#fff' }]}> {modoEdicao ? 'Concluir edição' : agrupada ? 'Editar (só na detalhada)' : 'Editar'}</Text>
            </TouchableOpacity>
            {modoEdicao && <>
              <TouchableOpacity style={styles.botaoMes} onPress={() => adicionarMes('inicio')}>
                <Ionicons name="add" size={14} color={colors.primary} /><Text style={styles.botaoMesTexto}>Mês antes</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.botaoMes} onPress={() => adicionarMes('fim')}>
                <Ionicons name="add" size={14} color={colors.primary} /><Text style={styles.botaoMesTexto}>Mês depois</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.botaoMes} onPress={() => setGerenciarGrupos(true)}>
                <Ionicons name="folder-open-outline" size={14} color={colors.primary} /><Text style={styles.botaoMesTexto}> Grupos ({grupos.length})</Text>
              </TouchableOpacity>
            </>}
          </View> : null}
          {/* Boxes de visualização (não alteram dados), alinhados à direita. */}
          {mostrarOpcoes && <View style={[styles.linhaBoxes, modo !== 'desktop' && styles.linhaBoxesCelular]}>
            <View style={styles.box}>
              <Text style={styles.boxTitulo}>Gastos</Text>
              {grupos.length > 0 && <View style={styles.zoomGrupo}>
                {([['detalhada', 'Detalhada', 'list-outline'], ['agrupada', 'Agrupada', 'folder-outline']] as [VisaoGastos, string, keyof typeof Ionicons.glyphMap][]).map(([valor, rotulo, icone]) => (
                  <TouchableOpacity key={valor} accessibilityRole="button" accessibilityState={{ selected: visaoGastos === valor }} onPress={() => { definirVisaoGastos(valor); fecharMenu() }} style={[styles.zoomOpcao, visaoGastos === valor && styles.zoomOpcaoAtiva]}>
                    <Ionicons name={icone} size={13} color={visaoGastos === valor ? '#fff' : colors.primary} />
                    <Text style={[styles.botaoMesTexto, visaoGastos === valor && { color: '#fff' }]}>{rotulo}</Text>
                  </TouchableOpacity>
                ))}
              </View>}
              <TouchableOpacity accessibilityRole="switch" accessibilityState={{ checked: mostrarPct }} accessibilityLabel="Mostrar percentuais dos gastos" onPress={() => { alternarPct(); fecharMenu() }} style={[styles.botaoMes, mostrarPct && styles.botaoEdicaoAtivo]}>
                <Ionicons name="pie-chart-outline" size={13} color={mostrarPct ? '#fff' : colors.primary} />
                <Text style={[styles.botaoMesTexto, mostrarPct && { color: '#fff' }]}> %</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.box}>
              <Text style={styles.boxTitulo}>Filtros</Text>
              <TouchableOpacity style={styles.botaoMes} onPress={() => { setSeletorMeses(true); fecharMenu() }}>
                <Ionicons name="calendar-outline" size={14} color={colors.primary} /><Text style={styles.botaoMesTexto}> Meses ({visiveisPlano.length}/{plano.meses.length})</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.box}>
              <Text style={styles.boxTitulo}>Zoom</Text>
              <View style={styles.zoomGrupo}>
                {([['padrao', '100%', 'search-outline'], ['reduzido', '50%', 'remove-circle-outline'], ['ajustar', 'Tudo', 'scan-outline']] as [NivelZoom, string, keyof typeof Ionicons.glyphMap][]).map(([valor, rotulo, icone]) => (
                  <TouchableOpacity key={valor} accessibilityRole="button" accessibilityLabel={valor === 'ajustar' ? 'Ajustar a tabela inteira na tela' : `Zoom ${rotulo}`} accessibilityState={{ selected: zoom === valor }} onPress={() => { definirZoom(valor); fecharMenu() }} style={[styles.zoomOpcao, zoom === valor && styles.zoomOpcaoAtiva]}>
                    <Ionicons name={icone} size={13} color={zoom === valor ? '#fff' : colors.primary} />
                    <Text style={[styles.botaoMesTexto, zoom === valor && { color: '#fff' }]}>{rotulo}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>}
        </View>

        {mostrarOpcoes && <Text style={[styles.subtitle, { marginTop: -6 }]}>Projeção mensal de entradas e gastos{textoEstado ? ` · ${textoEstado}` : ''}</Text>}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} onLayout={(e) => setLarguraArea(e.nativeEvent.layout.width)}>
        <View style={mesUnico ? (modo === 'desktop' ? styles.focoLinha : styles.focoColuna) : undefined}>
        <View style={mesUnico && modo === 'desktop' ? { flexShrink: 0 } : undefined}>
        {(() => {
          const conteudoTabela = <>
          {/* Coluna fixa com os nomes */}
          <View style={{ width: colNome }}>
            <View style={[styles.cabecalho, { width: colNome }]} />
            <View style={styles.secaoTitulo}><Text style={styles.secaoTexto}>Total Entradas</Text>
              {modoEdicao && <TouchableOpacity onPress={() => adicionarLinha('entrada')} hitSlop={6}><Ionicons name="add-circle-outline" size={20} color={colors.primary} /></TouchableOpacity>}
            </View>
            {entradas.map((l, i) => renderNome(l, i, entradas.length))}
            <View style={styles.nomeLinha}><Text style={styles.nomeTotal}>Entradas</Text></View>
            <View style={styles.espaco} />
            <View style={styles.secaoTitulo}><Text style={styles.secaoTexto}>Total Gastos</Text>
              {modoEdicao && <TouchableOpacity onPress={() => adicionarLinha('gasto')} hitSlop={6}><Ionicons name="add-circle-outline" size={20} color={colors.primary} /></TouchableOpacity>}
            </View>
            {blocosGastos.map((b) => {
              if (b.tipo === 'linha') return renderNome(b.linha, soltas.indexOf(b.linha), soltas.length)
              const cabecalhoGrupo = (
                <View key={`g-${b.grupo.id}`} style={[styles.nomeLinha, styles.linhaGrupo]}>
                  <Ionicons name={agrupada ? 'folder' : 'folder-open-outline'} size={14} color={colors.primary} />
                  <Text style={[styles.nomeTotal, { flex: 1, marginLeft: 6 }]} numberOfLines={1}>{b.grupo.nome || '(grupo sem nome)'}</Text>
                  <Text style={styles.grupoQtd}>{b.linhas.length}</Text>
                </View>
              )
              if (agrupada) return cabecalhoGrupo
              return [cabecalhoGrupo, ...b.linhas.map((l, i) => renderNome(l, i, b.linhas.length, true))]
            })}
            <View style={styles.nomeLinha}><Text style={styles.nomeTotal}>Gastos</Text></View>
            <View style={styles.espaco} />
            <View style={styles.nomeLinha}><Text style={styles.nomeTotal}>Saldo do mês</Text></View>
            <View style={styles.nomeLinha}><Text style={styles.nomeAjuste}>Ajustes (+/−)</Text></View>
            <View style={styles.nomeLinha}><Text style={styles.nomeTotal}>Saldo acumulado</Text></View>
          </View>

          {/* Colunas de meses com rolagem horizontal */}
          <ScrollView horizontal showsHorizontalScrollIndicator style={{ flex: 1 }}>
            <View>
              {/* Meses passados em cinza e borda em volta do mês atual (não bloqueiam toques). */}
              <View style={[styles.linhaMeses, styles.cabecalho]}>
                {visiveis.map((m) => (
                  <TouchableOpacity key={m} style={[styles.celula, { width: colMes, justifyContent: 'center' }, m === mesHoje && { alignItems: 'flex-end' }]} onPress={() => setMesEditando(m)}>
                    <Text style={[styles.mesTexto, m === mesHoje && [styles.rotuloMesAtual, { color: colors.primary, fontWeight: '900' }], m < mesHoje && styles.passado]}>{rotuloMes(m)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.secaoTitulo} />
              {entradas.map((l) => (
                <View key={l.id} style={styles.linhaMeses}>
                  {visiveis.map((m) => <CelulaValor key={m} centro={m === mesHoje} passado={m < mesHoje} valor={l.valores[m]} secao="entrada" largura={colMes} bloqueado={!modoEdicao} onChange={(v) => setValor(l.id, m, v)} />)}
                </View>
              ))}
              {linhaTotal((t) => t.ent, 'entrada')}
              <View style={styles.espaco} />
              <View style={styles.secaoTitulo} />
              {blocosGastos.map((b) => {
                // % da linha: dentro de grupo mostra "% do grupo | % do total"; solta, só "% do total".
                const linhaValores = (l: LinhaPlanejamento, linhasDoGrupo?: LinhaPlanejamento[]) => (
                  <View key={l.id} style={styles.linhaMeses}>
                    {visiveis.map((m) => <CelulaValor key={m} centro={m === mesHoje} passado={m < mesHoje} valor={l.valores[m]} secao="gasto" largura={colMes} bloqueado={!modoEdicao}
                      rotuloPct={!mostrarPct ? undefined : {
                        grupo: linhasDoGrupo ? textoPct(pct(l.valores[m] || 0, somaGrupo(linhasDoGrupo, m))) : undefined,
                        total: textoPct(pct(l.valores[m] || 0, totalGastosMes.get(m) || 0))
                      }}
                      onChange={(v) => setValor(l.id, m, v)} />)}
                  </View>
                )
                if (b.tipo === 'linha') return linhaValores(b.linha)
                // Na detalhada o subtotal do grupo fica discreto; na agrupada é a própria linha.
                const subtotal = (
                  <View key={`g-${b.grupo.id}`} style={[styles.linhaMeses, styles.linhaGrupo]}>
                    {visiveis.map((m) => mostrarPct
                      ? <CelulaComPercentual key={m} centro={m === mesHoje} passado={m < mesHoje} largura={colMes} texto={formatarCelula(somaGrupo(b.linhas, m), 'gasto')} rotuloPct={{ total: textoPct(pct(somaGrupo(b.linhas, m), totalGastosMes.get(m) || 0)) }} estiloTexto={agrupada ? { fontWeight: '700' } : styles.subtotalGrupo} />
                      : <Text key={m} numberOfLines={1} style={[styles.celula, { width: colMes }, m === mesHoje && styles.centro, agrupada ? { fontWeight: '700' } : styles.subtotalGrupo, m < mesHoje && styles.passado]}>{formatarCelula(somaGrupo(b.linhas, m), 'gasto')}</Text>)}
                  </View>
                )
                if (agrupada) return subtotal
                return [subtotal, ...b.linhas.map((l) => linhaValores(l, b.linhas))]
              })}
              {linhaTotal((t) => t.gas, 'gasto')}
              <View style={styles.espaco} />
              {linhaTotal((t) => t.saldo, 'saldo', true)}
              {/* Ajustes: valor livre por mês que entra no saldo acumulado (negativo subtrai). */}
              <View style={styles.linhaMeses}>
                {visiveis.map((m) => <CelulaValor key={m} centro={m === mesHoje} passado={m < mesHoje} valor={plano.ajustes?.[m]} secao="entrada" largura={colMes} bloqueado={!modoEdicao} onChange={(v) => setAjuste(m, v)} />)}
              </View>
              {linhaTotal((t) => t.acumulado, 'saldo', true)}
            </View>
          </ScrollView>
          </>
          if (escala === 1) return <View style={styles.tabela}>{conteudoTabela}</View>
          // Reduzido/Ajustar: desenha a tabela no tamanho natural e encolhe com scale;
          // a caixa externa ocupa só o tamanho já reduzido.
          const caixa = (
            <View style={{ width: larguraNatural * escala, height: alturaTabela * escala, overflow: 'hidden' }}>
              <View onLayout={(e) => setAlturaTabela(e.nativeEvent.layout.height)} style={[styles.tabela, { marginHorizontal: 0, width: larguraNatural, transform: [{ scale: escala }], transformOrigin: 'top left' }]}>{conteudoTabela}</View>
            </View>
          )
          return <ScrollView horizontal contentContainerStyle={{ paddingHorizontal: 12 }}>{caixa}</ScrollView>
        })()}
        </View>
        {mesUnico && <View style={[styles.painelGraficos, modo === 'desktop' ? { flex: 1, minWidth: 0 } : { marginHorizontal: 12, marginTop: 12 }]}>
          <Text style={styles.painelGraficosTitulo}>Gráficos · {rotuloMes(mesUnico)}</Text>
          <GraficosMes total={totalDoMes(mesUnico)} itens={gastosDoMes(mesUnico)} empilhar={modo !== 'desktop'}
            linhas={gastos.map((l) => ({ nome: l.nome, grupo: grupoValido(l) ? grupoPorId.get(l.grupoId!)!.nome : null, valor: l.valores[mesUnico] || 0 }))} />
        </View>}
        </View>
        {visiveis.length === 0 && <Text style={[styles.dica, { color: colors.expense }]}>Nenhum mês selecionado. Toque em "Meses" para escolher quais aparecem.</Text>}
      </ScrollView>

      <ModalLinha
        linha={linhaEditando}
        grupos={grupos}
        onFechar={() => setLinhaEditando(null)}
        onSalvar={(nova) => { atualizar((p) => ({ ...p, linhas: moverParaSecao(p.linhas, nova) })); setLinhaEditando(null) }}
        onExcluir={(id) => { atualizar((p) => ({ ...p, linhas: p.linhas.filter((l) => l.id !== id) })); setLinhaEditando(null) }}
        onReplicar={(id, valor) => atualizar((p) => ({
          ...p,
          linhas: p.linhas.map((l) => l.id !== id ? l : { ...l, valores: Object.fromEntries(p.meses.map((m) => [m, valor]).filter(([, v]) => v)) })
        }))}
      />

      <ModalGrupos
        visivel={gerenciarGrupos}
        grupos={grupos}
        contagem={(id) => gastos.filter((l) => l.grupoId === id).length}
        onFechar={() => setGerenciarGrupos(false)}
        onCriar={criarGrupo}
        onRenomear={renomearGrupo}
        onExcluir={excluirGrupo}
      />

      <Modal visible={!!mesEditando} transparent animationType="fade" onRequestClose={() => setMesEditando(null)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setMesEditando(null)}>
          <View style={styles.modal}>
            <Text style={styles.modalTitulo}>{mesEditando ? rotuloMes(mesEditando) : ''}</Text>
            {mesUnico ? <>
              {/* Único mês na tela: não pode ser ocultado; oferece voltar a mostrar mais meses. */}
              <TouchableOpacity style={styles.acao} onPress={() => { definirOcultos(() => []); setMesEditando(null) }}>
                <Ionicons name="albums-outline" size={18} color={colors.primary} /><Text style={styles.acaoTexto}>Selecionar todos os meses</Text>
              </TouchableOpacity>
              {mesesFuturos.length > 0 && <TouchableOpacity style={styles.acao} onPress={() => { definirOcultos((meses) => meses.filter((m) => m < mesAtual())); setMesEditando(null) }}>
                <Ionicons name="arrow-forward-circle-outline" size={18} color={colors.primary} /><Text style={styles.acaoTexto}>Selecionar os meses futuros (a partir de {rotuloMes(mesAtual())})</Text>
              </TouchableOpacity>}
            </> : <>
              <TouchableOpacity style={styles.acao} onPress={() => mesEditando && ocultarMes(mesEditando)}>
                <Ionicons name="eye-off-outline" size={18} color={colors.primary} /><Text style={styles.acaoTexto}>Ocultar da tela (mantém os valores)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.acao} onPress={() => mesEditando && selecionarSomenteMes(mesEditando)}>
                <Ionicons name="locate-outline" size={18} color={colors.primary} /><Text style={styles.acaoTexto}>Selecionar mês (mostrar só ele)</Text>
              </TouchableOpacity>
            </>}
            {modoEdicao && <TouchableOpacity style={styles.acao} onPress={() => mesEditando && copiarMesParaSeguintes(mesEditando)}>
              <Ionicons name="copy-outline" size={18} color={colors.primary} /><Text style={styles.acaoTexto}>Copiar valores para os meses seguintes</Text>
            </TouchableOpacity>}
            {modoEdicao && <TouchableOpacity style={styles.acao} onPress={() => mesEditando && removerMes(mesEditando)}>
              <Ionicons name="trash-outline" size={18} color={colors.expense} /><Text style={[styles.acaoTexto, { color: colors.expense }]}>Remover coluna do mês</Text>
            </TouchableOpacity>}
          </View>
        </TouchableOpacity>
      </Modal>


      <Modal visible={ajudaVisivel} transparent animationType="fade" onRequestClose={() => setAjudaVisivel(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setAjudaVisivel(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modal}>
            <Text style={styles.modalTitulo}>Como usar o planejamento</Text>
            <View style={styles.ajudaItem}>
              <Ionicons name="lock-closed-outline" size={16} color={colors.primary} style={{ marginTop: 1 }} />
              <Text style={styles.ajudaTexto}>A tela abre travada: toque em "Editar" para alterar valores, linhas e meses, e em "Concluir edição" para travar de novo.</Text>
            </View>
            <View style={styles.ajudaItem}>
              <Ionicons name="create-outline" size={16} color={colors.primary} style={{ marginTop: 1 }} />
              <Text style={styles.ajudaTexto}>No modo edição, toque no nome da linha para renomear, mudar de tipo ou de grupo, ou excluir. Use as setas para reordenar.</Text>
            </View>
            <View style={styles.ajudaItem}>
              <Ionicons name="pie-chart-outline" size={16} color={colors.primary} style={{ marginTop: 1 }} />
              <Text style={styles.ajudaTexto}>O botão "%" mostra quanto cada grupo representa no total de gastos do mês e, em cada gasto de um grupo, "% do grupo | % do total". Gastos sem grupo mostram só o % do total.</Text>
            </View>
            <View style={styles.ajudaItem}>
              <Ionicons name="folder-open-outline" size={16} color={colors.primary} style={{ marginTop: 1 }} />
              <Text style={styles.ajudaTexto}>Em "Grupos" você cria grupos de gastos. Com grupos criados, escolha a visão Detalhada (editável) ou Agrupada (um total por grupo, só leitura).</Text>
            </View>
            <View style={styles.ajudaItem}>
              <Ionicons name="remove-outline" size={16} color={colors.primary} style={{ marginTop: 1 }} />
              <Text style={styles.ajudaTexto}>Gastos são digitados como valores positivos; em entradas, use "-" para descontos. A linha "Ajustes" (entre o saldo do mês e o acumulado) soma ao acumulado; use "-" para subtrair. O mês atual tem borda e os meses passados ficam em cinza.</Text>
            </View>
            <View style={styles.ajudaItem}>
              <Ionicons name="calendar-outline" size={16} color={colors.primary} style={{ marginTop: 1 }} />
              <Text style={styles.ajudaTexto}>Toque no mês para ocultá-lo ou selecioná-lo (fica só ele na tela, como escolher um único mês em Filtros). Sempre que houver um único mês na tela, os gráficos dele aparecem à direita (no celular, abaixo). No modo edição, também dá para copiar ou remover o mês. Em "Meses" você escolhe quais meses aparecem; o saldo acumulado considera também os ocultos.</Text>
            </View>
            <View style={[styles.modalRodape, { justifyContent: 'flex-end' }]}>
              <TouchableOpacity style={styles.botaoPrimario} onPress={() => setAjudaVisivel(false)}><Text style={{ color: '#fff', fontWeight: '700' }}>Entendi</Text></TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={seletorMeses} transparent animationType="fade" onRequestClose={() => setSeletorMeses(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setSeletorMeses(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modal}>
            <Text style={styles.modalTitulo}>Meses exibidos</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              <TouchableOpacity style={styles.chip} onPress={() => definirOcultos(() => [])}><Text style={styles.chipTexto}>Todos</Text></TouchableOpacity>
              <TouchableOpacity style={styles.chip} onPress={() => definirOcultos((meses) => meses.filter((m) => m < mesAtual()))}><Text style={styles.chipTexto}>A partir deste mês</Text></TouchableOpacity>
              <TouchableOpacity style={styles.chip} onPress={() => definirOcultos((meses) => { const futuros = meses.filter((m) => m >= mesAtual()).slice(0, 3); return meses.filter((m) => !futuros.includes(m)) })}><Text style={styles.chipTexto}>Próximos 3</Text></TouchableOpacity>
              <TouchableOpacity style={styles.chip} onPress={() => definirOcultos((meses) => { const futuros = meses.filter((m) => m >= mesAtual()).slice(0, 6); return meses.filter((m) => !futuros.includes(m)) })}><Text style={styles.chipTexto}>Próximos 6</Text></TouchableOpacity>
            </View>
            <Text style={styles.label}>Toque para mostrar ou ocultar</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {plano.meses.map((m) => {
                const ativo = !ocultos.has(m)
                return (
                  <TouchableOpacity key={m} onPress={() => alternarMes(m)} style={[styles.chip, styles.chipMes, ativo && styles.chipAtivo]}>
                    <Ionicons name={ativo ? 'checkmark' : 'eye-off-outline'} size={13} color={ativo ? '#fff' : colors.muted} />
                    <Text style={[styles.chipTexto, ativo ? { color: '#fff' } : { color: colors.muted }]}>{rotuloMes(m)}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
            <View style={[styles.modalRodape, { justifyContent: 'flex-end' }]}>
              <TouchableOpacity style={styles.botaoPrimario} onPress={() => setSeletorMeses(false)}><Text style={{ color: '#fff', fontWeight: '700' }}>Pronto</Text></TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

/**
 * Atualiza só nome e grupo da linha, preservando os valores atuais do estado
 * (o modal guarda uma cópia antiga da linha, que não inclui o "Aplicar").
 * Se mudou de grupo, move para o fim do novo grupo.
 */
function moverParaSecao(linhas: LinhaPlanejamento[], alteracao: Pick<LinhaPlanejamento, 'id' | 'nome' | 'secao' | 'grupoId'>) {
  const antiga = linhas.find((l) => l.id === alteracao.id)
  if (!antiga) return linhas
  const nova: LinhaPlanejamento = { ...antiga, nome: alteracao.nome, secao: alteracao.secao, grupoId: alteracao.secao === 'gasto' ? alteracao.grupoId ?? null : null }
  if (antiga.secao === nova.secao) return linhas.map((l) => (l.id === nova.id ? nova : l))
  const sem = linhas.filter((l) => l.id !== nova.id)
  const ultimo = sem.map((l) => l.secao).lastIndexOf(nova.secao)
  sem.splice(ultimo + 1, 0, nova)
  return sem
}

function ModalLinha({ linha, grupos, onFechar, onSalvar, onExcluir, onReplicar }: {
  linha: LinhaPlanejamento | null
  grupos: GrupoPlanejamento[]
  onFechar: () => void
  onSalvar: (l: Pick<LinhaPlanejamento, 'id' | 'nome' | 'secao' | 'grupoId'>) => void
  onExcluir: (id: string) => void
  onReplicar: (id: string, valor: number) => void
}) {
  const [nome, setNome] = useState('')
  const [secao, setSecao] = useState<SecaoPlanejamento>('gasto')
  const [grupoId, setGrupoId] = useState<string | null>(null)
  const [replicar, setReplicar] = useState('')
  const [confirmarExclusao, setConfirmarExclusao] = useState(false)

  useEffect(() => {
    if (linha) { setNome(linha.nome); setSecao(linha.secao); setGrupoId(linha.grupoId ?? null); setReplicar(''); setConfirmarExclusao(false) }
  }, [linha])

  if (!linha) return null
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onFechar}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onFechar}>
        <TouchableOpacity activeOpacity={1} style={styles.modal}>
          <Text style={styles.modalTitulo}>Editar linha</Text>
          <Text style={styles.label}>Nome</Text>
          <TextInput style={styles.input} value={nome} onChangeText={setNome} autoFocus selectTextOnFocus />
          <Text style={styles.label}>Tipo</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['entrada', 'gasto'] as const).map((s) => (
              <TouchableOpacity key={s} onPress={() => setSecao(s)} style={[styles.chip, secao === s && styles.chipAtivo]}>
                <Text style={[styles.chipTexto, secao === s && { color: '#fff' }]}>{s === 'entrada' ? 'Entrada' : 'Gasto'}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {secao === 'gasto' && <>
            <Text style={styles.label}>Grupo de gastos</Text>
            {grupos.length === 0
              ? <Text style={styles.dicaModal}>Nenhum grupo criado. Use o botão "Grupos" no modo edição para criar.</Text>
              : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {[{ id: null as string | null, nome: 'Sem grupo' }, ...grupos].map((g) => (
                  <TouchableOpacity key={g.id ?? 'nenhum'} onPress={() => setGrupoId(g.id)} style={[styles.chip, grupoId === g.id && styles.chipAtivo]}>
                    <Text style={[styles.chipTexto, grupoId === g.id && { color: '#fff' }]}>{g.nome || '(sem nome)'}</Text>
                  </TouchableOpacity>
                ))}
              </View>}
          </>}
          <Text style={styles.label}>Mesmo valor em todos os meses</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput style={[styles.input, { flex: 1 }]} value={replicar} onChangeText={setReplicar} placeholder="Ex.: 1.915,00" keyboardType="numbers-and-punctuation" />
            <TouchableOpacity style={styles.botaoSecundario} onPress={() => {
              const v = parseValor(replicar)
              if (v === null) { notify('Valor inválido', 'Digite um número, por exemplo 1.915,00.'); return }
              onReplicar(linha.id, v)
              notify('Pronto', 'Valor aplicado em todos os meses.')
            }}><Text style={styles.botaoSecundarioTexto}>Aplicar</Text></TouchableOpacity>
          </View>
          <View style={styles.modalRodape}>
            <TouchableOpacity onPress={() => confirmarExclusao ? onExcluir(linha.id) : setConfirmarExclusao(true)}>
              <Text style={{ color: colors.expense, fontWeight: '700' }}>{confirmarExclusao ? 'Confirmar exclusão' : 'Excluir linha'}</Text>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={styles.botaoSecundario} onPress={onFechar}><Text style={styles.botaoSecundarioTexto}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={styles.botaoPrimario} onPress={() => onSalvar({ id: linha.id, nome: nome.trim() || linha.nome, secao, grupoId: secao === 'gasto' ? grupoId : null })}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

function CampoNomeGrupo({ grupo, onRenomear }: { grupo: GrupoPlanejamento; onRenomear: (id: string, nome: string) => void }) {
  const [texto, setTexto] = useState(grupo.nome)
  useEffect(() => { setTexto(grupo.nome) }, [grupo.nome])
  const gravar = () => { const n = texto.trim(); if (n && n !== grupo.nome) onRenomear(grupo.id, n) }
  return <TextInput style={[styles.input, { flex: 1, paddingVertical: 6 }]} value={texto} onChangeText={setTexto} onBlur={gravar} onSubmitEditing={gravar} />
}

function ModalGrupos({ visivel, grupos, contagem, onFechar, onCriar, onRenomear, onExcluir }: {
  visivel: boolean
  grupos: GrupoPlanejamento[]
  contagem: (id: string) => number
  onFechar: () => void
  onCriar: (nome: string) => void
  onRenomear: (id: string, nome: string) => void
  onExcluir: (id: string) => void
}) {
  const [novo, setNovo] = useState('')
  const [confirmar, setConfirmar] = useState<string | null>(null)
  useEffect(() => { if (visivel) { setNovo(''); setConfirmar(null) } }, [visivel])
  if (!visivel) return null
  const criar = () => { const nome = novo.trim(); if (!nome) return; onCriar(nome); setNovo('') }
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onFechar}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onFechar}>
        <TouchableOpacity activeOpacity={1} style={styles.modal}>
          <Text style={styles.modalTitulo}>Grupos de gastos</Text>
          <Text style={styles.dicaModal}>Crie grupos e depois escolha o grupo de cada gasto tocando no nome da linha.</Text>
          {grupos.map((g) => (
            <View key={g.id} style={styles.grupoItem}>
              <Ionicons name="folder-outline" size={16} color={colors.primary} />
              <CampoNomeGrupo grupo={g} onRenomear={onRenomear} />
              <Text style={styles.grupoQtd}>{contagem(g.id)}</Text>
              <TouchableOpacity onPress={() => confirmar === g.id ? onExcluir(g.id) : setConfirmar(g.id)} hitSlop={6}>
                {confirmar === g.id
                  ? <Text style={{ color: colors.expense, fontWeight: '700', fontSize: 12 }}>Confirmar</Text>
                  : <Ionicons name="trash-outline" size={18} color={colors.expense} />}
              </TouchableOpacity>
            </View>
          ))}
          {confirmar && <Text style={styles.dicaModal}>Excluir o grupo não apaga os gastos: eles só ficam sem grupo.</Text>}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <TextInput style={[styles.input, { flex: 1 }]} value={novo} onChangeText={setNovo} placeholder="Novo grupo, ex.: Escola" onSubmitEditing={criar} />
            <TouchableOpacity style={styles.botaoSecundario} onPress={criar}><Text style={styles.botaoSecundarioTexto}>Criar</Text></TouchableOpacity>
          </View>
          <View style={[styles.modalRodape, { justifyContent: 'flex-end' }]}>
            <TouchableOpacity style={styles.botaoPrimario} onPress={onFechar}><Text style={{ color: '#fff', fontWeight: '700' }}>Pronto</Text></TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

const styles = StyleSheet.create({
  celulaDupla: { height: ROW_H, paddingHorizontal: 8, alignItems: 'flex-end', justifyContent: 'center' },
  celulaDuplaValor: { fontSize: 12, lineHeight: 15, color: colors.text, textAlign: 'right' },
  // % do grupo em cinza discreto; % global em laranja.
  celulaDuplaPct: { fontSize: 10, lineHeight: 12, fontWeight: '700', textAlign: 'right' },
  pctGrupo: { color: '#64748B' },
  // % global (sobre o total de gastos) em laranja, para diferenciar do % dentro do grupo.
  pctGlobal: { color: '#D97706' },
  linhaGrupo: { backgroundColor: colors.primaryLight },
  grupoQtd: { fontSize: 11, fontWeight: '700', color: colors.muted, marginRight: 6 },
  subtotalGrupo: { color: colors.textSecondary, fontStyle: 'italic', fontSize: 12 },
  grupoItem: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  // Linha inteira abaixo do título, para o resumo das escolhas caber sem cortar.
  botaoMenu: { flexDirection: 'row', alignItems: 'center', gap: 6, width: '100%', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  botaoMenuAberto: { backgroundColor: colors.primary, borderColor: colors.primary },
  botaoMenuTexto: { flex: 1, fontSize: 12, fontWeight: '700', color: colors.primary },
  botaoAjuda: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  ajudaItem: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 8 },
  ajudaTexto: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 18 },
  // Mês atual: valores em negrito (sem borda na coluna) e contorno só no rótulo do mês.
  centro: { fontWeight: '700' },
  // Meses passados: só o texto em cinza, sem preenchimento na coluna.
  passado: { color: '#94A3B8' },
  rotuloMesAtual: { paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: colors.primary, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.surface, textDecorationLine: 'none', lineHeight: 18 },
  nomeAjuste: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, fontStyle: 'italic' },
  focoLinha: { flexDirection: 'row', alignItems: 'flex-start', paddingRight: 16 },
  focoColuna: { flexDirection: 'column' },
  painelGraficos: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16 },
  painelGraficosTitulo: { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: 12 },
  dicaModal: { fontSize: 12, color: colors.muted, lineHeight: 17 },
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: 16, paddingBottom: 10, gap: 10 },
  linhaTitulo: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  linhaBoxes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginLeft: 'auto' },
  // No celular os boxes ocupam uma linha própria e quebram, em vez de sair da tela.
  linhaBoxesCelular: { width: '100%', marginLeft: 0 },
  box: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, maxWidth: '100%', flexShrink: 1, padding: 6, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.primaryLight },
  boxEdicaoAtivo: { borderColor: colors.primary },
  boxTitulo: { fontSize: 11, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', paddingHorizontal: 4 },
  botaoEdicaoAtivo: { backgroundColor: colors.primary, borderColor: colors.primary },
  zoomGrupo: { flexDirection: 'row', borderWidth: 1, borderColor: colors.border, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.surface },
  zoomOpcao: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 9, paddingVertical: 7 },
  zoomOpcaoAtiva: { backgroundColor: colors.primary },
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  botaoMes: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  botaoMesTexto: { fontSize: 12, fontWeight: '700', color: colors.primary },
  tabela: { flexDirection: 'row', marginHorizontal: 12, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  cabecalho: { height: ROW_H, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.primaryLight },
  linhaMeses: { flexDirection: 'row', height: ROW_H },
  celula: { width: COL_MES, height: ROW_H, paddingHorizontal: 8, fontSize: 13, color: colors.text, textAlign: 'right', textAlignVertical: 'center', lineHeight: ROW_H },
  celulaInput: { borderWidth: 0, outlineStyle: 'none' } as any,
  celulaEditando: { backgroundColor: '#FFF8E1', lineHeight: undefined },
  celulaTotal: { fontWeight: '800', borderTopWidth: 1, borderTopColor: colors.text },
  mesTexto: { fontSize: 13, fontWeight: '800', color: colors.text, textAlign: 'right', textDecorationLine: 'underline' },
  secaoTitulo: { height: ROW_H, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10 },
  secaoTexto: { fontSize: 13, fontWeight: '800', color: colors.text, textDecorationLine: 'underline' },
  nomeLinha: { height: ROW_H, flexDirection: 'row', alignItems: 'center', paddingLeft: 10, paddingRight: 4, borderRightWidth: 1, borderRightColor: colors.border },
  nomeTexto: { fontSize: 13, color: colors.text },
  nomeTotal: { fontSize: 13, fontWeight: '800', color: colors.text },
  seta: { paddingHorizontal: 2 },
  espaco: { height: ROW_H / 2 },
  dica: { fontSize: 11, color: colors.muted, marginHorizontal: 16, marginTop: 10, lineHeight: 16 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { width: '100%', maxWidth: 420, backgroundColor: colors.surface, borderRadius: 14, padding: 18, gap: 6 },
  modalTitulo: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 6 },
  label: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginTop: 8 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: colors.text, backgroundColor: colors.background },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  chipAtivo: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipMes: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10 },
  chipTexto: { fontSize: 13, fontWeight: '700', color: colors.text },
  acao: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  acaoTexto: { fontSize: 14, fontWeight: '600', color: colors.text },
  modalRodape: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  botaoPrimario: { backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8 },
  botaoSecundario: { borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8, justifyContent: 'center' },
  botaoSecundarioTexto: { fontWeight: '700', color: colors.text }
})
