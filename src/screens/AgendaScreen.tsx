import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../services/supabase'
import { colors } from '../theme'
import { hojeISO, formatarData, FUSO_PADRAO } from '../utils/datas'
import type { RootStackParamList } from '../navigation/AppNavigator'

type Item = { id: string; tipo: string; titulo: string; descricao: string | null; data: string; horario: string | null; horario_fim: string | null; mostrar_na_agenda: boolean; mostrar_na_todo: boolean; usuario_id: string; responsavel_id: string | null; prioridade: 'baixa' | 'media' | 'alta' }
type Membro = { usuario_id: string; cor: string }
type Pessoa = { usuario_id: string; nome: string }
const PERIODOS = [{ nome: 'Manhã', inicio: 6, fim: 11, icone: 'sunny-outline' }, { nome: 'Tarde', inicio: 12, fim: 17, icone: 'partly-sunny-outline' }, { nome: 'Noite', inicio: 18, fim: 23, icone: 'moon-outline' }] as const
function addDays(iso: string, days: number) { const [y,m,d] = iso.split('-').map(Number); const date = new Date(y,m-1,d+days); return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}` }
function mondayOf(iso: string) { const [y,m,d] = iso.split('-').map(Number); return addDays(iso, -((new Date(y,m-1,d).getDay()+6)%7)) }
function weekday(iso: string) { const [y,m,d] = iso.split('-').map(Number); return new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(new Date(y,m-1,d)).replace('.', '') }
function hourOf(horario: string | null) { return horario ? Number(horario.slice(0, 2)) : -1 }
const ALTURA_HORA = 64

export function AgendaScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { width } = useWindowDimensions()
  const [data, setData] = useState(hojeISO())
  const [visualizacao, setVisualizacao] = useState<'dia' | 'semana'>('dia')
  const [items, setItems] = useState<Item[]>([])
  const [membros, setMembros] = useState<Membro[]>([])
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [loading, setLoading] = useState(true)
  const [inicioDia, setInicioDia] = useState(7)
  const [fimDia, setFimDia] = useState(20)
  const [agora, setAgora] = useState(() => Date.now())
  const inicio = visualizacao === 'semana' ? mondayOf(data) : data
  const fim = visualizacao === 'semana' ? addDays(inicio, 6) : data
  const datas = visualizacao === 'semana' ? Array.from({ length: 7 }, (_, i) => addDays(inicio, i)) : [data]
  const larguraHora = visualizacao === 'semana' ? 100 : Math.max(width - 86, 250)
  const larguraGrade = 52 + larguraHora * datas.length

  useEffect(() => {
    const timer = setInterval(() => setAgora(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  const carregar = useCallback(async () => {
    setLoading(true)
    const [resItens, resMembros, resPessoas, resHorario] = await Promise.all([
      supabase.from('organizacao_itens').select('*').eq('mostrar_na_agenda', true).gte('data', inicio).lte('data', fim).order('data').order('horario'),
      supabase.from('agenda_membros').select('usuario_id, cor'),
      supabase.rpc('listar_membros_agenda', { p_agenda_id: null }),
      supabase.from('agenda_preferencias').select('inicio_dia, fim_dia').maybeSingle()
    ])
    if (!resItens.error && resItens.data) setItems(resItens.data as Item[])
    if (!resMembros.error && resMembros.data) setMembros(resMembros.data as Membro[])
    if (!resPessoas.error && resPessoas.data) setPessoas(resPessoas.data as Pessoa[])
    if (!resHorario.error && resHorario.data) {
      setInicioDia(Number(resHorario.data.inicio_dia.slice(0, 2)))
      setFimDia(Number(resHorario.data.fim_dia.slice(0, 2)))
    }
    setLoading(false)
  }, [inicio, fim])
  useFocusEffect(useCallback(() => { void carregar() }, [carregar]))

  const corPorUsuario = useMemo(() => new Map(membros.map((m) => [m.usuario_id, m.cor])), [membros])
  const nomePorUsuario = useMemo(() => new Map(pessoas.map((p) => [p.usuario_id, p.nome])), [pessoas])
  const moverPeriodo = (dias: number) => setData(addDays(data, dias))
  const criarNoHorario = (dia: string, hora?: number) => navigation.navigate('NovoItem', { tipo: 'compromisso', data: dia, horario: hora === undefined ? undefined : `${String(hora).padStart(2, '0')}:00`, horarioFim: hora === undefined ? undefined : `${String(Math.min(hora + 1, 23)).padStart(2, '0')}:00` })
  const adicionar = (dia: string) => Alert.alert('Adicionar à agenda', 'Escolha o tipo de atividade.', [
    { text: 'Tarefa', onPress: () => navigation.navigate('NovoItem', { tipo: 'tarefa', data: dia, mostrarNaAgenda: true }) },
    { text: 'Compromisso', onPress: () => navigation.navigate('NovoItem', { tipo: 'compromisso', data: dia }) },
    { text: 'Cancelar', style: 'cancel' }
  ])
  const tituloPeriodo = visualizacao === 'dia'
    ? new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(Number(data.slice(0,4)), Number(data.slice(5,7))-1, Number(data.slice(8,10))))
    : `${formatarData(inicio).slice(0,5)} – ${formatarData(fim).slice(0,5)} ${fim.slice(0,4)}`

  function cartao(item: Item) {
    const pessoaId = item.tipo === 'tarefa' ? item.responsavel_id || item.usuario_id : item.usuario_id
    const cor = corPorUsuario.get(pessoaId) || colors.primary
    const responsavel = nomePorUsuario.get(item.responsavel_id || '') || 'Responsável'
    const prioridade = item.prioridade === 'alta' ? 'Alta' : item.prioridade === 'media' ? 'Média' : 'Baixa'
    return <TouchableOpacity key={item.id} onPress={() => {}} activeOpacity={0.85} style={[styles.event, { borderLeftColor: cor, backgroundColor: `${cor}18` }]}>
      <Text numberOfLines={2} style={[styles.eventTitle, { color: cor }]}>{item.titulo}</Text>
      {item.tipo === 'tarefa' ? <Text numberOfLines={1} style={[styles.eventMeta, { color: cor }]}>{prioridade} · {responsavel}</Text> : null}
      {item.descricao ? <Text numberOfLines={2} style={styles.eventDescription}>{item.descricao}</Text> : null}
    </TouchableOpacity>
  }

  const horasDosItens = items.filter((item) => item.horario).flatMap((item) => [hourOf(item.horario), Math.ceil(Number((item.horario_fim || `${String(hourOf(item.horario) + 1).padStart(2,'0')}:00`).slice(0,2)) + (Number((item.horario_fim || '').slice(3,5)) ? 1 : 0))])
  const primeiraHora = Math.max(0, Math.min(inicioDia, ...horasDosItens.filter((hora) => hora >= 0)))
  const ultimaHora = Math.min(24, Math.max(fimDia, ...horasDosItens.filter((hora) => hora >= 0)))
  const horarios = Array.from({ length: Math.max(1, ultimaHora - primeiraHora) }, (_, i) => primeiraHora + i)
  const alturaGrade = horarios.length * ALTURA_HORA
  const partesHora = new Intl.DateTimeFormat('en-GB', { timeZone: FUSO_PADRAO, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(agora))
  const horaAtual = Number(partesHora.find((p) => p.type === 'hour')?.value || 0)
  const minutoAtual = Number(partesHora.find((p) => p.type === 'minute')?.value || 0)
  const mostrarLinhaAgora = horaAtual + minutoAtual / 60 >= primeiraHora && horaAtual + minutoAtual / 60 < ultimaHora
  return <View style={styles.page}>
    <View style={styles.topArea}>
      <View style={styles.header}><View><Text style={styles.title}>Agenda</Text><Text style={styles.subtitle}>Organize seus compromissos</Text></View><TouchableOpacity style={styles.add} onPress={() => adicionar(data)}><Ionicons name="add" size={23} color="#fff" /></TouchableOpacity></View>
      <View style={styles.toolbar}>
        <View style={styles.viewToggle}>{(['dia','semana'] as const).map((modo) => <TouchableOpacity key={modo} onPress={() => setVisualizacao(modo)} style={[styles.viewOption, visualizacao === modo && styles.viewSelected]}><Text style={[styles.viewText, visualizacao === modo && styles.viewSelectedText]}>{modo === 'dia' ? 'Dia' : 'Semana'}</Text></TouchableOpacity>)}</View>
        <View style={styles.dateActions}><TouchableOpacity onPress={() => moverPeriodo(visualizacao === 'semana' ? -7 : -1)} style={styles.arrow}><Ionicons name="chevron-back" size={19} color={colors.text} /></TouchableOpacity><TouchableOpacity onPress={() => setData(hojeISO())} style={styles.todayButton}><Text style={styles.todayButtonText}>Hoje</Text></TouchableOpacity><TouchableOpacity onPress={() => moverPeriodo(visualizacao === 'semana' ? 7 : 1)} style={styles.arrow}><Ionicons name="chevron-forward" size={19} color={colors.text} /></TouchableOpacity></View>
      </View>
      <Text style={styles.periodTitle}>{tituloPeriodo}</Text>
      <View style={styles.legend}>{pessoas.slice(0, 5).map((p) => <View key={p.usuario_id} style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: corPorUsuario.get(p.usuario_id) || colors.primary }]} /><Text numberOfLines={1} style={styles.legendText}>{p.nome}</Text></View>)}</View>
    </View>
    <ScrollView style={styles.verticalScroll} contentContainerStyle={styles.verticalContent}>
      {loading && items.length === 0 ? <Text style={styles.loading}>Carregando agenda…</Text> : <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator contentContainerStyle={{ minWidth: larguraGrade }}>
        <View style={{ width: larguraGrade }}>
          <View style={styles.dateHeaderRow}><View style={styles.timeGutterHeader}><Ionicons name="time-outline" size={15} color={colors.muted} /></View>{datas.map((dia) => { const hoje = dia === hojeISO(); return <TouchableOpacity key={dia} onPress={() => { if (visualizacao === 'semana') { setData(dia); setVisualizacao('dia') } }} style={[styles.dateHeader, { width: larguraHora }, hoje && styles.dateHeaderToday]}><Text style={[styles.dateHeaderWeekday, hoje && styles.todayText]}>{weekday(dia)}</Text><View style={[styles.dateHeaderNumber, hoje && styles.dateHeaderNumberToday]}><Text style={[styles.dateNumberText, hoje && styles.todayNumberText]}>{Number(dia.slice(-2))}</Text></View></TouchableOpacity> })}</View>
          <View style={[styles.allDayRow, { width: larguraGrade }]}><View style={styles.gutterLabel}><Text style={styles.gutterText}>Dia todo</Text></View>{datas.map((dia) => { const allDayItems = items.filter((i) => i.data === dia && (!i.horario || !i.horario_fim)); return <View key={dia} style={[styles.allDayCell, { width: larguraHora }]}>{allDayItems.map(cartao)}<TouchableOpacity onPress={() => navigation.navigate('NovoItem', { tipo: 'tarefa', data: dia, mostrarNaAgenda: true })} style={styles.allDayAdd}><Ionicons name="add" size={13} color={colors.primary} /><Text style={styles.allDayAddText}>Tarefa</Text></TouchableOpacity></View> })}</View>
          <View style={[styles.timelineGrid, { width: larguraGrade, height: alturaGrade }]}>
            <View style={styles.timelineGutter}>{horarios.map((hora) => { const periodo = hora === primeiraHora ? PERIODOS.find((p) => hora >= p.inicio && hora <= p.fim)?.nome : PERIODOS.find((p) => p.inicio === hora)?.nome; return <View key={hora} style={styles.timelineHourLabel}>{periodo ? <Text style={styles.periodLabel}>{periodo}</Text> : null}<Text style={styles.hourText}>{String(hora).padStart(2,'0')}:00</Text></View> })}</View>
            <View style={styles.timelineColumns}>{datas.map((dia) => {
              const eventos = items.filter((item) => item.data === dia && item.horario && item.horario_fim).sort((a,b) => hourOf(a.horario) - hourOf(b.horario))
              return <View key={dia} style={[styles.timelineDay, { width: larguraHora, height: alturaGrade }]}>
                {horarios.map((hora) => <TouchableOpacity key={hora} activeOpacity={1} onPress={() => criarNoHorario(dia, hora)} style={styles.hourBackground} />)}
                {eventos.map((item) => {
                  const inicioMin = hourOf(item.horario) * 60 + Number(item.horario?.slice(3,5) || 0)
                  const fimMin = Number(item.horario_fim?.slice(0,2) || 0) * 60 + Number(item.horario_fim?.slice(3,5) || 0)
                  const horas = Math.max(1, (fimMin - inicioMin) / 60)
                  const inicioEventos = eventos.filter((e) => hourOf(e.horario) === hourOf(item.horario))
                  const lane = inicioEventos.findIndex((e) => e.id === item.id)
                  const larguraLane = (larguraHora - 6) / inicioEventos.length
                  return <View key={item.id} style={[styles.eventPosition, { top: ((inicioMin / 60) - primeiraHora) * ALTURA_HORA + 2, left: 3 + lane * larguraLane, width: larguraLane - 3, height: horas * ALTURA_HORA - 4 }]}>{cartao(item)}</View>
                })}
                {dia === hojeISO() && mostrarLinhaAgora ? <View pointerEvents="none" style={[styles.currentTimeLine, { top: ((horaAtual + minutoAtual / 60) - primeiraHora) * ALTURA_HORA }]}><View style={styles.currentTimeDot} /></View> : null}
              </View>
            })}</View>
          </View>
        </View>
      </ScrollView>}
    </ScrollView>
    {!loading && items.length === 0 ? <View pointerEvents="none" style={styles.emptyHint}><Text style={styles.emptyHintText}>Toque em um horário para criar um compromisso.</Text></View> : null}
  </View>
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background }, topArea: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 9, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, title: { fontSize: 26, fontWeight: '800', color: colors.text }, subtitle: { color: colors.muted, marginTop: 2, fontSize: 12 }, add: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }, viewToggle: { flexDirection: 'row', backgroundColor: colors.surfaceHover, borderRadius: 9, padding: 3 }, viewOption: { paddingVertical: 6, paddingHorizontal: 13, borderRadius: 7 }, viewSelected: { backgroundColor: colors.surface, elevation: 1 }, viewText: { color: colors.muted, fontSize: 12, fontWeight: '600' }, viewSelectedText: { color: colors.primary, fontWeight: '700' }, dateActions: { flexDirection: 'row', alignItems: 'center', gap: 5 }, arrow: { padding: 5 }, todayButton: { borderColor: colors.border, borderWidth: 1, backgroundColor: colors.surface, borderRadius: 8, paddingVertical: 5, paddingHorizontal: 12 }, todayButtonText: { color: colors.primary, fontSize: 12, fontWeight: '700' }, periodTitle: { marginTop: 10, fontSize: 15, color: colors.text, fontWeight: '700', textTransform: 'capitalize' }, legend: { flexDirection: 'row', gap: 12, marginTop: 9, minHeight: 17 }, legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: 105 }, legendDot: { width: 8, height: 8, borderRadius: 4 }, legendText: { color: colors.muted, fontSize: 10 },
  verticalScroll: { flex: 1 }, verticalContent: { paddingBottom: 24 }, dateHeaderRow: { flexDirection: 'row', backgroundColor: colors.surface }, timeGutterHeader: { width: 52, height: 55, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderColor: colors.border }, dateHeader: { height: 55, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderLeftWidth: 1, borderColor: colors.border, gap: 2 }, dateHeaderToday: { backgroundColor: colors.primaryLight }, dateHeaderWeekday: { color: colors.muted, textTransform: 'capitalize', fontSize: 10, fontWeight: '600' }, todayText: { color: colors.primary }, dateHeaderNumber: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, dateHeaderNumberToday: { backgroundColor: colors.primary }, dateNumberText: { color: colors.text, fontSize: 14, fontWeight: '700' }, todayNumberText: { color: '#fff' },
  allDayRow: { flexDirection: 'row', minHeight: 38, backgroundColor: colors.surface }, allDayCell: { flexDirection: 'column', borderLeftWidth: 1, borderBottomWidth: 1, borderColor: colors.border, padding: 3 }, allDayAdd: { minHeight: 29, flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 4 }, allDayAddText: { color: colors.primary, fontSize: 9, fontWeight: '600' }, gutterLabel: { width: 52, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderColor: colors.border }, gutterText: { color: colors.muted, fontSize: 8, textAlign: 'center' }, timelineGrid: { flexDirection: 'row' }, timelineGutter: { width: 52 }, timelineHourLabel: { height: ALTURA_HORA, alignItems: 'flex-end', justifyContent: 'flex-start', paddingTop: 2, paddingRight: 5, borderTopWidth: 1, borderColor: colors.border }, periodLabel: { color: colors.muted, fontSize: 8, fontWeight: '700', marginBottom: 1 }, hourText: { color: colors.muted, fontSize: 10 }, timelineColumns: { flexDirection: 'row' }, timelineDay: { position: 'relative', borderRightWidth: 1, borderColor: colors.border }, hourBackground: { height: ALTURA_HORA, borderTopWidth: 1, borderLeftWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, eventPosition: { position: 'absolute', zIndex: 1 }, currentTimeLine: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: '#EF4444', zIndex: 5 }, currentTimeDot: { position: 'absolute', left: -4, top: -3, width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' }, event: { flex: 1, borderLeftWidth: 3, borderRadius: 5, paddingVertical: 4, paddingHorizontal: 5, minHeight: 38 }, eventTitle: { fontSize: 10, fontWeight: '700' }, eventMeta: { fontSize: 8, fontWeight: '600', marginTop: 2 }, eventDescription: { fontSize: 8, color: colors.textSecondary, marginTop: 2 }, loading: { color: colors.muted, textAlign: 'center', padding: 24 }, emptyHint: { position: 'absolute', bottom: 8, alignSelf: 'center', backgroundColor: colors.text, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14 }, emptyHintText: { color: '#fff', fontSize: 10 }
})
