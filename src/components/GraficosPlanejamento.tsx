import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, G, Path, Polyline, Text as SvgText, TSpan } from 'react-native-svg'
import { colors } from '../theme'

export type TotalMesPlanejamento = { mes: string; ent: number; gas: number; saldo: number; acumulado: number }
/** Um item de gasto do mês; `ordem` é a posição no plano (define a cor, não o tamanho). */
export type ItemGastoGrafico = { nome: string; valor: number; ordem?: number }
export type LinhaGastoGrafico = { nome: string; grupo: string | null; valor: number }

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const pctFmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })
// Par validado para daltonismo (verde x laranja-avermelhado), mantendo o sentido entrada/gasto.
const COR_ENTRADA = '#1F8A5B'
const COR_GASTO = '#D9480F'
// Paleta categórica validada (ordem fixa, sem repetir cores); o excedente vira "Outros" em cinza.
const CORES_GRUPOS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6']
const COR_OUTROS = '#94A3B8'
// KPI: verde para resultado positivo, vermelho para negativo; tom mais forte no saldo e mais escuro no acumulado.
const TONS_KPI = { saldo: { positivo: '#15803D', negativo: '#DC2626' }, acumulado: { positivo: '#166534', negativo: '#991B1B' } }
const corKpi = (tipo: keyof typeof TONS_KPI, valor: number) => valor < 0 ? TONS_KPI[tipo].negativo : valor > 0 ? TONS_KPI[tipo].positivo : colors.text
// Fonte sem serifa nos textos do SVG (o padrão do navegador seria serifada).
const FONTE_GRAFICO = 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

type Props = {
  total: TotalMesPlanejamento
  /** Gastos do mês por grupo (ou linha solta), na ordem do plano. */
  itens: ItemGastoGrafico[]
  /** Cada gasto individual do mês, para o top 5. */
  linhas: LinhaGastoGrafico[]
  /** Celular: os cartões ficam um embaixo do outro em vez de lado a lado. */
  empilhar?: boolean
}

/** Gráficos de um único mês. */
export function GraficosMes({ total, itens, linhas, empilhar }: Props) {
  // Proporção da linha (80/20, 50/50) no computador; largura total no celular.
  const largura = (peso: number) => empilhar ? { width: '100%' as const } : { flex: peso, flexBasis: 0 }
  const maiorFluxo = Math.max(1, total.ent, total.gas)
  const usoRenda = total.ent > 0 ? (total.gas / total.ent) * 100 : null

  // Pizza: até 7 fatias (as maiores), coloridas pela ordem do plano; o resto vira "Outros".
  const positivos = itens.map((i, idx) => ({ ...i, ordem: i.ordem ?? idx })).filter((i) => i.valor > 0)
  const maiores = [...positivos].sort((a, b) => b.valor - a.valor)
  const mostrados = maiores.slice(0, CORES_GRUPOS.length).sort((a, b) => a.ordem - b.ordem)
  const resto = maiores.slice(CORES_GRUPOS.length).reduce((acc, i) => acc + i.valor, 0)
  const fatias = mostrados.map((i, idx) => ({ nome: i.nome, valor: i.valor, cor: CORES_GRUPOS[idx] }))
  if (resto > 0) fatias.push({ nome: 'Outros', valor: resto, cor: COR_OUTROS })
  const somaFatias = fatias.reduce((acc, f) => acc + f.valor, 0)

  const top5 = linhas.filter((l) => l.valor > 0).sort((a, b) => b.valor - a.valor).slice(0, 5)

  return (
    <View style={{ gap: 14 }}>
      {/* Linha 1: Entradas x Gastos (80%) e KPI de saldo (20%) */}
      <View style={styles.linha}>
        <View style={[styles.cartao, largura(4)]}>
          <Text style={styles.secao}>Entradas x gastos</Text>
          {[{ rotulo: 'Entradas', valor: total.ent, cor: COR_ENTRADA }, { rotulo: 'Gastos', valor: total.gas, cor: COR_GASTO }].map((b) => (
            <View key={b.rotulo} style={styles.barraLinha} accessibilityLabel={`${b.rotulo}: ${moeda.format(b.valor)}`}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, width: 78 }}>
                <View style={[styles.legendaCor, { backgroundColor: b.cor }]} />
                <Text style={styles.textoPequeno}>{b.rotulo}</Text>
              </View>
              <View style={styles.barraArea}><View style={[styles.barra, { width: `${Math.max(1, (b.valor / maiorFluxo) * 100)}%`, backgroundColor: b.cor }]} /></View>
              <Text style={styles.barraValor}>{moeda.format(b.valor)}</Text>
            </View>
          ))}
          {usoRenda !== null && <Text style={styles.textoSecundario}>Os gastos consomem <Text style={styles.forte}>{Math.round(usoRenda)}%</Text> das entradas.</Text>}
        </View>
        <View style={[styles.cartao, styles.kpi, largura(1)]}>
          <Text style={styles.secao}>Saldo do mês</Text>
          <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.kpiValor, { color: corKpi('saldo', total.saldo) }]}>{moeda.format(total.saldo)}</Text>
          <Text style={styles.textoSecundario}>Acumulado</Text>
          <Text style={[styles.forte, { fontSize: 16, fontWeight: '800', color: corKpi('acumulado', total.acumulado) }]}>{moeda.format(total.acumulado)}</Text>
        </View>
      </View>

      {/* Linha 2: pizza de gastos por grupo (50%) e top 5 gastos (50%) */}
      <View style={styles.linha}>
        <View style={[styles.cartao, largura(1)]}>
          <Text style={styles.secao}>Gastos por grupo</Text>
          {fatias.length === 0 ? <Text style={styles.textoSecundario}>Sem gastos neste mês.</Text> : (
            <PizzaComRotulos fatias={fatias} total={somaFatias} />
          )}
        </View>
        <View style={[styles.cartao, largura(1)]}>
          <Text style={styles.secao}>Top 5 gastos</Text>
          {top5.length === 0 ? <Text style={styles.textoSecundario}>Sem gastos neste mês.</Text> : <>
            <View style={[styles.tabelaLinha, styles.tabelaCabecalho]}>
              <Text style={[styles.tabelaCab, { width: 22 }]}>#</Text>
              <Text style={[styles.tabelaCab, { flex: 1 }]}>Gasto</Text>
              <Text style={[styles.tabelaCab, styles.direita, { width: 92 }]}>Valor</Text>
              <Text style={[styles.tabelaCab, styles.direita, { width: 48 }]}>%</Text>
            </View>
            {top5.map((l, i) => (
              <View key={`${l.nome}-${i}`} style={styles.tabelaLinha}>
                <Text style={[styles.textoSecundario, { width: 22 }]}>{i + 1}</Text>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={styles.textoPequeno}>{l.nome || '(sem nome)'}</Text>
                  {l.grupo && <Text numberOfLines={1} style={styles.tabelaGrupo}>{l.grupo}</Text>}
                </View>
                <Text style={[styles.forte, styles.direita, { width: 92, fontSize: 12 }]}>{moeda.format(l.valor)}</Text>
                <Text style={[styles.legendaPct, styles.direita, { width: 48 }]}>{total.gas ? `${pctFmt.format((l.valor / total.gas) * 100)}%` : '–'}</Text>
              </View>
            ))}
            <Text style={styles.textoSecundario}>% sobre o total de gastos do mês.</Text>
          </>}
        </View>
      </View>
    </View>
  )
}

type Fatia = { nome: string; valor: number; cor: string }

/** Rosca centralizada, do tamanho do cartão, com nome, valor e % de cada fatia ao lado do segmento. */
function PizzaComRotulos({ fatias, total }: { fatias: Fatia[]; total: number }) {
  const [largura, setLargura] = useState(0)
  return (
    <View style={{ width: '100%', alignItems: 'center' }} onLayout={(e) => setLargura(e.nativeEvent.layout.width)}>
      {largura > 0 && <Pizza fatias={fatias} total={total} largura={Math.min(largura, 560)} />}
    </View>
  )
}

const ESPACO_ROTULO = 132 // largura reservada para os rótulos de cada lado
const ALTURA_ROTULO = 40
const LARGURA_MIN_ROTULO_FORA = 500 // abaixo disso (celular) os rótulos vão dentro dos segmentos
// Cores claras pedem texto escuro dentro do segmento; as demais, texto branco.
const CORES_CLARAS = new Set(['#1baf7a', '#eda100', '#e87ba4', '#94A3B8'])

function Pizza({ fatias, total, largura }: { fatias: Fatia[]; total: number; largura: number }) {
  if (largura < LARGURA_MIN_ROTULO_FORA) return <PizzaRotulosDentro fatias={fatias} total={total} largura={largura} />
  const altura = Math.max(240, Math.min(320, largura * 0.62))
  const cx = largura / 2
  const cy = altura / 2
  const r = Math.max(60, Math.min(altura / 2 - 18, (largura - ESPACO_ROTULO * 2) / 2 - 18))
  const raioInterno = r * 0.56
  const ponto = (raio: number, a: number) => ({ x: cx + raio * Math.cos(a), y: cy + raio * Math.sin(a) })

  // Geometria das fatias e posição inicial de cada rótulo (no ângulo do meio da fatia).
  let angulo = -Math.PI / 2
  const segmentos = fatias.map((f) => {
    const delta = (f.valor / total) * Math.PI * 2
    const inicio = angulo
    angulo += delta
    const meio = inicio + delta / 2
    const direita = Math.cos(meio) >= 0
    return { ...f, inicio, fim: angulo, delta, meio, direita, yRotulo: ponto(r + 14, meio).y }
  })

  // Evita rótulos sobrepostos: em cada lado, empurra para baixo e depois ajusta para caber na altura.
  for (const lado of [true, false]) {
    const doLado = segmentos.filter((sg) => sg.direita === lado).sort((a, b) => a.yRotulo - b.yRotulo)
    for (let k = 1; k < doLado.length; k++) doLado[k].yRotulo = Math.max(doLado[k].yRotulo, doLado[k - 1].yRotulo + ALTURA_ROTULO)
    const excesso = (doLado[doLado.length - 1]?.yRotulo ?? 0) - (altura - ALTURA_ROTULO / 2)
    if (excesso > 0) doLado.forEach((sg) => { sg.yRotulo -= excesso })
    for (let k = doLado.length - 2; k >= 0; k--) doLado[k].yRotulo = Math.min(doLado[k].yRotulo, doLado[k + 1].yRotulo - ALTURA_ROTULO)
    doLado.forEach((sg) => { sg.yRotulo = Math.max(ALTURA_ROTULO / 2, sg.yRotulo) })
  }

  const caminho = (sg: typeof segmentos[number]) => {
    if (fatias.length === 1) return null
    const grande = sg.delta > Math.PI ? 1 : 0
    const a = ponto(r, sg.inicio), b = ponto(r, sg.fim), c = ponto(raioInterno, sg.fim), d = ponto(raioInterno, sg.inicio)
    return `M ${a.x} ${a.y} A ${r} ${r} 0 ${grande} 1 ${b.x} ${b.y} L ${c.x} ${c.y} A ${raioInterno} ${raioInterno} 0 ${grande} 0 ${d.x} ${d.y} Z`
  }

  return (
    <Svg width={largura} height={altura} accessibilityLabel={segmentos.map((sg) => `${sg.nome}: ${moeda.format(sg.valor)}, ${pctFmt.format((sg.valor / total) * 100)}%`).join('; ')}>
      <G>
        {fatias.length === 1
          ? <Circle cx={cx} cy={cy} r={(r + raioInterno) / 2} stroke={fatias[0].cor} strokeWidth={r - raioInterno} fill="none" />
          : segmentos.map((sg) => <Path key={sg.nome} d={caminho(sg)!} fill={sg.cor} stroke={colors.surface} strokeWidth={2} strokeLinejoin="round" />)}
      </G>
      {/* Total no centro da rosca */}
      <SvgText fontFamily={FONTE_GRAFICO} x={cx} y={cy - 6} fontSize={12} fill={colors.muted} textAnchor="middle">Total</SvgText>
      <SvgText fontFamily={FONTE_GRAFICO} x={cx} y={cy + 14} fontSize={17} fontWeight="800" fill={colors.text} textAnchor="middle">{moeda.format(total)}</SvgText>
      {/* Rótulos: linha guia saindo do segmento + nome, valor e % */}
      {segmentos.map((sg) => {
        const borda = ponto(r - 2, sg.meio)
        const cotovelo = ponto(r + 12, sg.meio)
        const xFim = sg.direita ? cx + r + 22 : cx - r - 22
        const xTexto = sg.direita ? xFim + 4 : xFim - 4
        const ancora = sg.direita ? 'start' : 'end'
        return (
          <G key={`r-${sg.nome}`}>
            <Polyline points={`${borda.x},${borda.y} ${cotovelo.x},${sg.yRotulo} ${xFim},${sg.yRotulo}`} fill="none" stroke={sg.cor} strokeWidth={1.5} />
            <SvgText fontFamily={FONTE_GRAFICO} x={xTexto} y={sg.yRotulo - 3} fontSize={14} fontWeight="700" fill={colors.text} textAnchor={ancora}>{sg.nome.length > 16 ? `${sg.nome.slice(0, 15)}…` : sg.nome}</SvgText>
            <SvgText fontFamily={FONTE_GRAFICO} x={xTexto} y={sg.yRotulo + 14} fontSize={13} fill={colors.textSecondary} textAnchor={ancora}>
              <TSpan fontWeight="600" fill={colors.text}>{moeda.format(sg.valor)}</TSpan>
              <TSpan fontWeight="800" fill={colors.text}>{`  ${pctFmt.format((sg.valor / total) * 100)}%`}</TSpan>
            </SvgText>
          </G>
        )
      })}
    </Svg>
  )
}

/** Versão estreita (celular): rosca maior, com nome, valor e % escritos sobre cada segmento. */
function PizzaRotulosDentro({ fatias, total, largura }: { fatias: Fatia[]; total: number; largura: number }) {
  const tamanho = Math.min(largura, 340)
  const c = tamanho / 2
  const r = c - 4
  const raioInterno = r * 0.4
  const raioTexto = (r + raioInterno) / 2
  const ponto = (raio: number, a: number) => ({ x: c + raio * Math.cos(a), y: c + raio * Math.sin(a) })
  let angulo = -Math.PI / 2
  const segmentos = fatias.map((f) => {
    const delta = (f.valor / total) * Math.PI * 2
    const inicio = angulo
    angulo += delta
    return { ...f, inicio, fim: angulo, delta, meio: inicio + delta / 2 }
  })
  return (
    <Svg width={tamanho} height={tamanho} accessibilityLabel={segmentos.map((sg) => `${sg.nome}: ${moeda.format(sg.valor)}, ${pctFmt.format((sg.valor / total) * 100)}%`).join('; ')}>
      {segmentos.length === 1
        ? <Circle cx={c} cy={c} r={raioTexto} stroke={segmentos[0].cor} strokeWidth={r - raioInterno} fill="none" />
        : segmentos.map((sg) => {
          const grande = sg.delta > Math.PI ? 1 : 0
          const a = ponto(r, sg.inicio), b = ponto(r, sg.fim), d1 = ponto(raioInterno, sg.fim), d2 = ponto(raioInterno, sg.inicio)
          return <Path key={sg.nome} d={`M ${a.x} ${a.y} A ${r} ${r} 0 ${grande} 1 ${b.x} ${b.y} L ${d1.x} ${d1.y} A ${raioInterno} ${raioInterno} 0 ${grande} 0 ${d2.x} ${d2.y} Z`} fill={sg.cor} stroke={colors.surface} strokeWidth={2} strokeLinejoin="round" />
        })}
      <SvgText fontFamily={FONTE_GRAFICO} x={c} y={c - 6} fontSize={12} fill={colors.muted} textAnchor="middle">Total</SvgText>
      <SvgText fontFamily={FONTE_GRAFICO} x={c} y={c + 13} fontSize={15} fontWeight="800" fill={colors.text} textAnchor="middle">{moeda.format(total)}</SvgText>
      {segmentos.map((sg) => {
        const p = ponto(raioTexto, sg.meio)
        const cor = CORES_CLARAS.has(sg.cor) ? '#1F2937' : '#FFFFFF'
        const pct = `${pctFmt.format((sg.valor / total) * 100)}%`
        // Segmentos pequenos mostram só o %; os demais, nome, valor e %.
        if (sg.delta < 0.45) return <SvgText fontFamily={FONTE_GRAFICO} key={`t-${sg.nome}`} x={p.x} y={p.y + 5} fontSize={13} fontWeight="800" fill={cor} textAnchor="middle">{pct}</SvgText>
        return (
          <G key={`t-${sg.nome}`}>
            <SvgText fontFamily={FONTE_GRAFICO} x={p.x} y={p.y - 10} fontSize={12} fontWeight="800" fill={cor} textAnchor="middle">{sg.nome.length > 12 ? `${sg.nome.slice(0, 11)}…` : sg.nome}</SvgText>
            <SvgText fontFamily={FONTE_GRAFICO} x={p.x} y={p.y + 5} fontSize={12} fontWeight="600" fill={cor} textAnchor="middle">{moeda.format(sg.valor)}</SvgText>
            <SvgText fontFamily={FONTE_GRAFICO} x={p.x} y={p.y + 21} fontSize={13} fontWeight="800" fill={cor} textAnchor="middle">{pct}</SvgText>
          </G>
        )
      })}
    </Svg>
  )
}

const styles = StyleSheet.create({
  linha: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'stretch' },
  cartao: { gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, minWidth: 0 },
  kpi: { justifyContent: 'center', gap: 4 },
  kpiValor: { fontSize: 26, fontWeight: '900', color: colors.text },
  secao: { fontSize: 12, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase' },
  barraLinha: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barraArea: { flex: 1, height: 18, justifyContent: 'center' },
  barra: { height: 16, borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  barraValor: { minWidth: 96, textAlign: 'right', fontSize: 13, fontWeight: '700', color: colors.text },
  legendaCor: { width: 10, height: 10, borderRadius: 3 },
  legendaPct: { fontSize: 11, fontWeight: '600', color: colors.muted, minWidth: 40, textAlign: 'right' },
  tabelaLinha: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: colors.border },
  tabelaCabecalho: { paddingVertical: 2 },
  tabelaCab: { fontSize: 11, fontWeight: '800', color: colors.muted, textTransform: 'uppercase' },
  tabelaGrupo: { fontSize: 10, color: colors.muted },
  direita: { textAlign: 'right' },
  textoPequeno: { fontSize: 12, color: colors.text },
  textoSecundario: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  forte: { fontWeight: '700', color: colors.text }
})
