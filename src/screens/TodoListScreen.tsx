import { useCallback, useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../services/supabase'
import { useAuth } from '../services/AuthProvider'
import { colors } from '../theme'
import { hojeISO, formatarData } from '../utils/datas'
import type { RootStackParamList } from '../navigation/AppNavigator'

type Item = { id: string; tipo: string; titulo: string; descricao: string | null; data: string; horario: string | null; mostrar_na_agenda: boolean; mostrar_na_todo: boolean; concluido: boolean; usuario_id: string; responsavel_id: string | null; prioridade: 'baixa' | 'media' | 'alta' }
function addDays(iso: string, days: number) { const [y,m,d] = iso.split('-').map(Number); const date = new Date(y,m-1,d+days); return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}` }
function inicioSemana(iso: string) { const [y,m,d] = iso.split('-').map(Number); const dt = new Date(y,m-1,d); return addDays(iso, -((dt.getDay()+6)%7)) }

export function TodoListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { session } = useAuth()
  const [items, setItems] = useState<Item[]>([])
  const [membros, setMembros] = useState<{ usuario_id: string; nome: string; email: string | null }[]>([])
  const [filtro, setFiltro] = useState<'minhas' | 'todas'>('minhas')
  const [loading, setLoading] = useState(true)
  const carregar = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('organizacao_itens').select('*').eq('mostrar_na_todo', true).order('data').order('horario')
    if (!error && data) setItems(data as Item[])
    const { data: pessoas } = await supabase.rpc('listar_membros_agenda', { p_agenda_id: null })
    if (pessoas) setMembros(pessoas as typeof membros)
    setLoading(false)
  }, [])
  useFocusEffect(useCallback(() => { void carregar() }, [carregar]))
  const hoje = hojeISO(); const amanha = addDays(hoje, 1); const semana = addDays(inicioSemana(hoje), 7)
  const tarefasVisiveis = filtro === 'todas' ? items : items.filter((item) => item.tipo === 'tarefa' ? item.responsavel_id === session?.user.id : item.usuario_id === session?.user.id)
  const nomePorUsuario = new Map(membros.map((membro) => [membro.usuario_id, membro.nome]))
  const grupos = [
    { titulo: 'Hoje', data: hoje, cor: colors.primary },
    { titulo: 'Amanhã', data: amanha, cor: '#D97706' },
    { titulo: 'Esta Semana', data: '', cor: '#7C3AED' }
  ]
  async function alternar(item: Item) { await supabase.from('organizacao_itens').update({ concluido: !item.concluido }).eq('id', item.id); void carregar() }
  return <ScrollView style={styles.page} contentContainerStyle={styles.container}>
    <View style={styles.header}><View><Text style={styles.title}>Todo List</Text><Text style={styles.subtitle}>Seu foco, organizado por prioridade.</Text></View><TouchableOpacity onPress={() => navigation.navigate('NovoItem', { tipo: 'tarefa' })} style={styles.add}><Ionicons name="add" size={23} color="#fff" /></TouchableOpacity></View>
    <View style={styles.filters}>{(['minhas','todas'] as const).map((value) => <TouchableOpacity key={value} onPress={() => setFiltro(value)} style={[styles.filter, filtro === value && styles.filterActive]}><Text style={[styles.filterText, filtro === value && styles.filterActiveText]}>{value === 'minhas' ? 'Minhas' : 'Todos'}</Text></TouchableOpacity>)}</View>
    {grupos.map((grupo) => {
      const lista = tarefasVisiveis.filter((item) => !item.concluido && (grupo.data ? item.data === grupo.data : item.data > amanha && item.data < semana))
      return <View key={grupo.titulo} style={styles.group}><View style={styles.groupHeading}><View style={[styles.dot, { backgroundColor: grupo.cor }]} /><Text style={styles.groupTitle}>{grupo.titulo}</Text><Text style={styles.count}>{lista.length}</Text><TouchableOpacity onPress={() => navigation.navigate('NovoItem', { tipo: 'tarefa', data: grupo.data || addDays(amanha, 1) })}><Ionicons name="add-circle-outline" size={22} color={grupo.cor} /></TouchableOpacity></View>
        {lista.length === 0 ? <Text style={styles.empty}>{loading ? 'Carregando…' : 'Tudo tranquilo por aqui.'}</Text> : lista.map((item) => { const corPrioridade = item.prioridade === 'alta' ? colors.expense : item.prioridade === 'media' ? colors.warning : colors.income; return <View key={item.id} style={styles.card}><TouchableOpacity onPress={() => alternar(item)}><Ionicons name="ellipse-outline" size={22} color={colors.muted} /></TouchableOpacity><View style={styles.cardInfo}><Text style={styles.cardTitle}>{item.titulo}</Text>{item.descricao ? <Text style={styles.cardDescription}>{item.descricao}</Text> : null}<View style={styles.meta}><Text style={styles.date}>{formatarData(item.data)}</Text>{item.horario ? <Text style={styles.date}> · {item.horario.slice(0,5)}</Text> : null}{item.mostrar_na_agenda ? <Ionicons name="calendar-outline" size={14} color={colors.primary} /> : null}</View>{item.tipo === 'tarefa' ? <View style={styles.taskMeta}><Text style={[styles.priorityBadge, { color: corPrioridade, backgroundColor: corPrioridade + '18' }]}>{item.prioridade === 'alta' ? 'Alta' : item.prioridade === 'media' ? 'Média' : 'Baixa'}</Text><Text style={styles.assignee}><Ionicons name="person-outline" size={12} color={colors.muted} /> {item.responsavel_id === session?.user.id ? 'Você' : nomePorUsuario.get(item.responsavel_id || '') || 'Participante'}</Text></View> : null}</View></View> })}
      </View>
    })}
    <View style={styles.group}><Text style={styles.groupTitle}>Concluídas</Text>{tarefasVisiveis.filter((i) => i.concluido).map((item) => <TouchableOpacity key={item.id} onPress={() => alternar(item)} style={styles.done}><Ionicons name="checkmark-circle" size={20} color={colors.income} /><Text style={styles.doneTitle}>{item.titulo}</Text></TouchableOpacity>)}</View>
  </ScrollView>
}

const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.background }, container: { padding: 20, gap: 14 }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, title: { fontSize: 27, fontWeight: '800', color: colors.text }, subtitle: { color: colors.muted, marginTop: 3 }, add: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }, filters: { flexDirection: 'row', alignSelf: 'flex-start', backgroundColor: colors.surfaceHover, borderRadius: 10, padding: 3 }, filter: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 8 }, filterActive: { backgroundColor: colors.surface }, filterText: { color: colors.muted, fontSize: 12, fontWeight: '600' }, filterActiveText: { color: colors.primary }, group: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 10 }, groupHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }, dot: { width: 9, height: 9, borderRadius: 5 }, groupTitle: { fontSize: 16, fontWeight: '700', color: colors.text, flex: 1 }, count: { color: colors.muted, fontSize: 12 }, empty: { color: colors.muted, fontSize: 13, paddingVertical: 8 }, card: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, paddingVertical: 11, borderTopWidth: 1, borderTopColor: colors.border }, cardInfo: { flex: 1 }, cardTitle: { fontSize: 14, fontWeight: '700', color: colors.text }, cardDescription: { color: colors.muted, marginTop: 3, fontSize: 12 }, meta: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 6 }, date: { fontSize: 11, color: colors.muted }, taskMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 7 }, priorityBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, fontSize: 10, fontWeight: '700', overflow: 'hidden' }, assignee: { fontSize: 11, color: colors.muted }, done: { flexDirection: 'row', gap: 8, alignItems: 'center' }, doneTitle: { color: colors.muted, textDecorationLine: 'line-through' } })
