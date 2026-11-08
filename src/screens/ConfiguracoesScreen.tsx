import { useCallback, useState } from 'react'
import { ScrollView, Share, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../services/supabase'
import { useAuth } from '../services/AuthProvider'
import { colors } from '../theme'
import { Button } from '../components/Button'
import { notify } from '../utils/notify'
import { APP_INFO } from '../constants/version'
import { useModuleAccess } from '../services/ModuleAccessProvider'
import { carregarCartoesPoker, carregarLocaisPoker, limparCacheDadosRemotos, salvarCartoesPoker, salvarLocaisPoker } from '../services/planilhasService'
import type { ModuleKey } from '../services/ModuleAccessProvider'

type ConviteRecebido = { convite_id: string; agenda_id: string; agenda_nome: string; remetente: string; criado_em: string }
type ConviteEnviado = { id: string; email: string; status: string; criado_em: string }
const CORES = ['#2563EB', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#64748B']
type CategoriaConfiguracao = 'agenda' | 'poker' | 'admin'

export function ConfiguracoesScreen() {
  const { session, signOut } = useAuth()
  const { acesso, carregado: acessoCarregado, definirAcesso } = useModuleAccess()
  const [email, setEmail] = useState('')
  const [cor, setCor] = useState('#2563EB')
  const [recebidos, setRecebidos] = useState<ConviteRecebido[]>([])
  const [enviados, setEnviados] = useState<ConviteEnviado[]>([])
  const [enviando, setEnviando] = useState(false)
  const [aceitando, setAceitando] = useState('')
  const [inicioDia, setInicioDia] = useState(7)
  const [fimDia, setFimDia] = useState(20)
  const [atualizandoDados, setAtualizandoDados] = useState(false)
  const [categoria, setCategoria] = useState<CategoriaConfiguracao>('agenda')
  const [cartoesPoker, setCartoesPoker] = useState(carregarCartoesPoker())
  const [locaisPoker, setLocaisPoker] = useState(carregarLocaisPoker())
  const [novoCartaoPoker, setNovoCartaoPoker] = useState('')
  const [novoLocalPoker, setNovoLocalPoker] = useState('')

  const carregar = useCallback(async () => {
    const [resRecebidos, resEnviados, resCor, resHorario] = await Promise.all([
      supabase.rpc('listar_convites_recebidos'),
      supabase.from('agenda_convites').select('id, email, status, criado_em').order('criado_em', { ascending: false }),
      supabase.from('agenda_membros').select('cor').eq('usuario_id', session?.user.id || '').limit(1).maybeSingle(),
      supabase.from('agenda_preferencias').select('inicio_dia, fim_dia').eq('usuario_id', session?.user.id || '').maybeSingle()
    ])
    if (!resRecebidos.error && resRecebidos.data) setRecebidos(resRecebidos.data as ConviteRecebido[])
    if (!resEnviados.error && resEnviados.data) setEnviados(resEnviados.data as ConviteEnviado[])
    if (!resCor.error && resCor.data?.cor) setCor(resCor.data.cor)
    if (!resHorario.error && resHorario.data) {
      setInicioDia(Number(resHorario.data.inicio_dia.slice(0, 2)))
      setFimDia(Number(resHorario.data.fim_dia.slice(0, 2)))
    }
  }, [session?.user.id])
  useFocusEffect(useCallback(() => { void carregar() }, [carregar]))

  async function convidar() {
    if (!email.trim()) { notify('Informe um e-mail', 'Digite o e-mail da pessoa que você quer convidar.'); return }
    const emailConvidado = email.trim()
    setEnviando(true)
    const { error } = await supabase.rpc('convidar_para_agenda', { p_email: emailConvidado })
    setEnviando(false)
    if (error) { notify('Não foi possível enviar o convite', error.message); return }
    setEmail('')
    notify('Convite criado', 'Escolha como avisar a pessoa. Ela poderá aceitar em Configurações ao entrar no app com este e-mail.')
    try {
      await Share.share({ message: `Olá! Te convidei para compartilhar uma agenda no App Financeiro. Abra o app ou crie sua conta com ${emailConvidado} e aceite o convite na aba Configurações.` })
    } catch { /* O convite continua salvo mesmo se o compartilhamento for fechado. */ }
    void carregar()
  }

  async function aceitar(conviteId: string) {
    setAceitando(conviteId)
    const { error } = await supabase.rpc('aceitar_convite_agenda', { p_convite_id: conviteId })
    setAceitando('')
    if (error) { notify('Não foi possível aceitar', error.message); return }
    notify('Agenda compartilhada', 'Você já pode ver os compromissos desta agenda.')
    void carregar()
  }

  async function alterarCor(novaCor: string) {
    setCor(novaCor)
    const { error } = await supabase.rpc('atualizar_cor_agendas', { p_cor: novaCor })
    if (error) notify('Não foi possível alterar a cor', error.message)
  }

  async function salvarHorario(inicio: number, fim: number) {
    setInicioDia(inicio); setFimDia(fim)
    const { error } = await supabase.from('agenda_preferencias').upsert({ usuario_id: session!.user.id, inicio_dia: `${String(inicio).padStart(2, '0')}:00`, fim_dia: `${String(fim).padStart(2, '0')}:00` })
    if (error) notify('Não foi possível salvar o horário', error.message)
  }

  async function atualizarDadosDoBanco() {
    if (!session?.user.id) { notify('Sessão necessária', 'Entre na sua conta para atualizar os dados.'); return }
    setAtualizandoDados(true)
    const { error } = await supabase.from('profiles').select('id').eq('id', session.user.id).maybeSingle()
    if (error) {
      setAtualizandoDados(false)
      notify('Não foi possível conectar', 'O cache foi mantido. Confira a conexão e tente novamente.')
      return
    }
    limparCacheDadosRemotos()
    if (typeof window !== 'undefined') {
      window.location.reload()
      return
    }
    setAtualizandoDados(false)
    notify('Cache atualizado', 'Feche e reabra o aplicativo para carregar os dados do Supabase.')
  }

  function adicionarOpcaoPoker(tipo: 'cartao' | 'local') {
    const valor = (tipo === 'cartao' ? novoCartaoPoker : novoLocalPoker).trim()
    if (!valor) return
    if (tipo === 'cartao') {
      if (cartoesPoker.some((item) => item.toLowerCase() === valor.toLowerCase())) { notify('Cartão já cadastrado', 'Use outro nome ou selecione o cartão existente.'); return }
      const atualizados = [...cartoesPoker, valor]
      setCartoesPoker(atualizados); salvarCartoesPoker(atualizados); setNovoCartaoPoker('')
    } else {
      if (locaisPoker.some((item) => item.toLowerCase() === valor.toLowerCase())) { notify('Local já cadastrado', 'Use outro nome ou selecione o local existente.'); return }
      const atualizados = [...locaisPoker, valor]
      setLocaisPoker(atualizados); salvarLocaisPoker(atualizados); setNovoLocalPoker('')
    }
  }

  function removerOpcaoPoker(tipo: 'cartao' | 'local', nome: string) {
    if (tipo === 'cartao') {
      const atualizados = cartoesPoker.filter((item) => item !== nome)
      setCartoesPoker(atualizados); salvarCartoesPoker(atualizados)
    } else {
      const atualizados = locaisPoker.filter((item) => item !== nome)
      setLocaisPoker(atualizados); salvarLocaisPoker(atualizados)
    }
  }

  return <View style={styles.page}>
    <View style={styles.fixedHeader}>
      <Text style={styles.title}>Configurações</Text>
      <Text style={styles.subtitle}>Preferências, compartilhamento e dados do aplicativo.</Text>
      <View style={styles.card}>
        <View style={styles.heading}><View style={styles.icon}><Ionicons name="information-circle-outline" size={20} color={colors.primary} /></View><View style={styles.headingText}><Text style={styles.sectionTitle}>Sobre o Aplicativo</Text><Text style={styles.itemSub}>{APP_INFO.name}</Text></View><View style={styles.versionBadge}><Text style={styles.versionBadgeText}>v{APP_INFO.version}</Text></View></View>
        <View style={styles.versionContainer}>
          <View style={styles.versionRow}><Text style={styles.versionLabel}>Último deploy · São Paulo</Text><Text style={styles.versionValue}>{APP_INFO.buildDate}</Text></View>
          <View style={styles.versionRow}><Text style={styles.versionLabel}>Ambiente</Text><Text style={styles.versionValue}>{APP_INFO.env}</Text></View>
        </View>
      </View>
      <View style={styles.categoryTabs}>
        {([['agenda', 'Agenda', 'calendar-outline'], ['poker', 'Poker', 'trophy-outline'], ['admin', 'Admin', 'settings-outline']] as [CategoriaConfiguracao, string, keyof typeof Ionicons.glyphMap][]).map(([id, label, icon]) => <TouchableOpacity key={id} onPress={() => setCategoria(id)} style={[styles.categoryTab, categoria === id && styles.categoryTabActive]}><Ionicons name={icon} size={16} color={categoria === id ? '#fff' : colors.muted} /><Text style={[styles.categoryTabText, categoria === id && styles.categoryTabTextActive]}>{label}</Text></TouchableOpacity>)}
      </View>
    </View>

    <ScrollView style={styles.categoryContent} contentContainerStyle={styles.container}>
      {categoria === 'agenda' && <>
        <View style={styles.card}><View style={styles.heading}><View style={styles.icon}><Ionicons name="time-outline" size={20} color={colors.primary} /></View><View style={styles.headingText}><Text style={styles.sectionTitle}>Duração do dia</Text><Text style={styles.itemSub}>Define as horas visíveis na agenda</Text></View></View>
          <Text style={styles.timeLabel}>Início · {String(inicioDia).padStart(2, '0')}:00</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hourOptions}>{Array.from({ length: 23 }, (_, hour) => <TouchableOpacity key={hour} onPress={() => { const fim = hour >= fimDia ? Math.min(hour + 1, 23) : fimDia; void salvarHorario(hour, fim) }} style={[styles.hourOption, inicioDia === hour && styles.hourOptionActive]}><Text style={[styles.hourOptionText, inicioDia === hour && styles.hourOptionTextActive]}>{String(hour).padStart(2, '0')}</Text></TouchableOpacity>)}</ScrollView>
          <Text style={styles.timeLabel}>Fim · {String(fimDia).padStart(2, '0')}:00</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hourOptions}>{Array.from({ length: 23 - inicioDia }, (_, index) => index + inicioDia + 1).map((hour) => <TouchableOpacity key={hour} onPress={() => void salvarHorario(inicioDia, hour)} style={[styles.hourOption, fimDia === hour && styles.hourOptionActive]}><Text style={[styles.hourOptionText, fimDia === hour && styles.hourOptionTextActive]}>{String(hour).padStart(2, '0')}</Text></TouchableOpacity>)}</ScrollView>
        </View>
        {recebidos.length > 0 && <View style={styles.card}><Text style={styles.sectionTitle}>Convites recebidos</Text>{recebidos.map((convite) => <View key={convite.convite_id} style={styles.invite}><View style={styles.inviteInfo}><Text style={styles.itemTitle}>{convite.agenda_nome}</Text><Text style={styles.itemSub}>Convite de {convite.remetente}</Text></View><TouchableOpacity disabled={aceitando === convite.convite_id} onPress={() => aceitar(convite.convite_id)} style={styles.accept}><Text style={styles.acceptText}>{aceitando === convite.convite_id ? '...' : 'Aceitar'}</Text></TouchableOpacity></View>)}</View>}
        <View style={styles.card}><View style={styles.heading}><View style={styles.icon}><Ionicons name="people-outline" size={20} color={colors.primary} /></View><View style={styles.headingText}><Text style={styles.sectionTitle}>Compartilhar agenda</Text><Text style={styles.itemSub}>Convide alguém pelo e-mail</Text></View></View>
          <TextInput autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="nome@exemplo.com" placeholderTextColor={colors.muted} style={styles.input} />
          <Button title={enviando ? 'Enviando…' : 'Criar convite'} onPress={convidar} loading={enviando} />
          <Text style={styles.hint}>Depois de criar o convite, você pode avisar a pessoa pelo menu de compartilhamento do celular. Ela aceitará em Configurações usando este e-mail.</Text>
          {enviados.length > 0 && <View style={styles.sentList}><Text style={styles.listTitle}>Convites enviados</Text>{enviados.map((item) => <View key={item.id} style={styles.sentRow}><Text style={styles.itemSub}>{item.email}</Text><Text style={[styles.status, item.status === 'aceito' && styles.accepted]}>{item.status === 'aceito' ? 'Aceito' : 'Pendente'}</Text></View>)}</View>}
        </View>
        <View style={styles.card}><View style={styles.heading}><View style={[styles.icon, { backgroundColor: cor + '20' }]}><Ionicons name="color-palette-outline" size={20} color={cor} /></View><View style={styles.headingText}><Text style={styles.sectionTitle}>Minha cor</Text><Text style={styles.itemSub}>Identifica suas atividades no calendário compartilhado</Text></View></View><View style={styles.colors}>{CORES.map((c) => <TouchableOpacity key={c} accessibilityLabel={`Selecionar cor ${c}`} onPress={() => alterarCor(c)} style={[styles.colorOption, { backgroundColor: c }, cor === c && styles.colorSelected]}>{cor === c ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}</TouchableOpacity>)}</View></View>
      </>}

      {categoria === 'poker' && <>
        <View style={styles.card}><View style={styles.heading}><View style={[styles.icon, { backgroundColor: '#F3E8FF' }]}><Ionicons name="card-outline" size={20} color="#77158D" /></View><View style={styles.headingText}><Text style={styles.sectionTitle}>Cartões</Text><Text style={styles.itemSub}>Opções disponíveis nos lançamentos</Text></View></View>
          <View style={styles.pokerOptions}>{cartoesPoker.map((nome) => <View key={nome} style={styles.pokerOption}><Text style={styles.pokerOptionText}>{nome}</Text><TouchableOpacity accessibilityLabel={`Remover cartão ${nome}`} onPress={() => removerOpcaoPoker('cartao', nome)}><Ionicons name="close-circle" size={18} color={colors.muted} /></TouchableOpacity></View>)}</View>
          <View style={styles.addPokerRow}><TextInput value={novoCartaoPoker} onChangeText={setNovoCartaoPoker} placeholder="Nome do cartão" placeholderTextColor={colors.muted} style={[styles.input, { flex: 1 }]} onSubmitEditing={() => adicionarOpcaoPoker('cartao')} /><TouchableOpacity accessibilityRole="button" accessibilityLabel="Adicionar cartão" style={styles.addPokerButton} onPress={() => adicionarOpcaoPoker('cartao')}><Ionicons name="add" size={20} color="#fff" /></TouchableOpacity></View>
        </View>
        <View style={styles.card}><View style={styles.heading}><View style={[styles.icon, { backgroundColor: '#F3E8FF' }]}><Ionicons name="location-outline" size={20} color="#77158D" /></View><View style={styles.headingText}><Text style={styles.sectionTitle}>Locais</Text><Text style={styles.itemSub}>Clubes e locais das sessões</Text></View></View>
          <View style={styles.pokerOptions}>{locaisPoker.map((nome) => <View key={nome} style={styles.pokerOption}><Text style={styles.pokerOptionText}>{nome}</Text><TouchableOpacity accessibilityLabel={`Remover local ${nome}`} onPress={() => removerOpcaoPoker('local', nome)}><Ionicons name="close-circle" size={18} color={colors.muted} /></TouchableOpacity></View>)}</View>
          <View style={styles.addPokerRow}><TextInput value={novoLocalPoker} onChangeText={setNovoLocalPoker} placeholder="Nome do local" placeholderTextColor={colors.muted} style={[styles.input, { flex: 1 }]} onSubmitEditing={() => adicionarOpcaoPoker('local')} /><TouchableOpacity accessibilityRole="button" accessibilityLabel="Adicionar local" style={styles.addPokerButton} onPress={() => adicionarOpcaoPoker('local')}><Ionicons name="add" size={20} color="#fff" /></TouchableOpacity></View>
        </View>
      </>}

      {categoria === 'admin' && <>
        <View style={styles.card}><View style={styles.heading}><View style={styles.icon}><Ionicons name="apps-outline" size={20} color={colors.primary} /></View><View style={styles.headingText}><Text style={styles.sectionTitle}>Acesso às telas</Text><Text style={styles.itemSub}>As abas ficam no menu; desative para bloquear o acesso.</Text></View></View>
          {([['todo', 'Todo List', 'Lista de tarefas'], ['agenda', 'Agenda', 'Calendário compartilhado'], ['financeiro', 'Financeiro', 'Resumo, cartões e Poker']] as [ModuleKey, string, string][]).map(([modulo, titulo, descricao]) => <View key={modulo} style={styles.accessRow}><View style={styles.accessInfo}><Text style={styles.accessTitle}>{titulo}</Text><Text style={styles.itemSub}>{descricao}</Text></View><Switch accessibilityLabel={`Acesso a ${titulo}`} disabled={!acessoCarregado} value={acesso[modulo]} onValueChange={(ativo) => void definirAcesso(modulo, ativo)} trackColor={{ false: '#CBD5E1', true: colors.primary }} thumbColor="#fff" /></View>)}
        </View>
        <View style={styles.card}><View style={styles.heading}><View style={styles.icon}><Ionicons name="sync-outline" size={20} color={colors.primary} /></View><View style={styles.headingText}><Text style={styles.sectionTitle}>Sincronizar dados</Text><Text style={styles.itemSub}>Limpa caches remotos locais e recarrega os dados do Supabase.</Text></View></View><Button title={atualizandoDados ? 'Atualizando…' : 'Atualizar dados do banco'} onPress={() => void atualizarDadosDoBanco()} loading={atualizandoDados} /></View>
        <View style={styles.card}><Text style={styles.sectionTitle}>Conta</Text><Text style={styles.itemSub}>{session?.user.email}</Text><TouchableOpacity onPress={() => void signOut()} style={styles.signOut}><Ionicons name="log-out-outline" size={18} color={colors.expense} /><Text style={styles.signOutText}>Sair da conta</Text></TouchableOpacity></View>
      </>}
    </ScrollView>
  </View>
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background }, fixedHeader: { paddingHorizontal: 18, paddingTop: 16, gap: 10, backgroundColor: colors.background }, categoryContent: { flex: 1 }, container: { padding: 18, paddingTop: 10, gap: 14, paddingBottom: 50 }, title: { fontSize: 27, fontWeight: '800', color: colors.text }, subtitle: { fontSize: 13, color: colors.muted, marginTop: -9 },
  categoryTabs: { flexDirection: 'row', gap: 8, paddingVertical: 4 }, categoryTab: { flex: 1, minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 11 }, categoryTabActive: { backgroundColor: colors.primary, borderColor: colors.primary }, categoryTabText: { fontSize: 12, color: colors.muted, fontWeight: '700' }, categoryTabTextActive: { color: '#fff' },
  card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 13 }, heading: { flexDirection: 'row', alignItems: 'center', gap: 11 }, icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight }, headingText: { flex: 1, gap: 3 }, sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text }, itemSub: { fontSize: 12, color: colors.muted },
  accessRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 58, paddingVertical: 7, borderTopWidth: 1, borderTopColor: colors.border }, accessInfo: { flex: 1, gap: 3 }, accessTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  timeLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '600', marginTop: 3 }, hourOptions: { flexDirection: 'row', gap: 7 }, hourOption: { minWidth: 38, paddingVertical: 8, alignItems: 'center', borderRadius: 9, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, hourOptionActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight }, hourOptionText: { color: colors.muted, fontSize: 12, fontWeight: '600' }, hourOptionTextActive: { color: colors.primary, fontWeight: '700' }, input: { minHeight: 46, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 13, color: colors.text, backgroundColor: colors.surface, fontSize: 14 }, hint: { fontSize: 11, lineHeight: 16, color: colors.muted }, sentList: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, gap: 9 }, listTitle: { fontSize: 12, fontWeight: '700', color: colors.text }, sentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, status: { fontSize: 10, fontWeight: '700', color: colors.warning }, accepted: { color: colors.income }, colors: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingTop: 4 }, colorOption: { width: 31, height: 31, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }, colorSelected: { borderWidth: 3, borderColor: colors.text, transform: [{ scale: 1.08 }] }, invite: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderTopWidth: 1, borderTopColor: colors.border }, inviteInfo: { flex: 1, gap: 3 }, itemTitle: { fontSize: 13, color: colors.text, fontWeight: '700' }, accept: { backgroundColor: colors.primary, paddingHorizontal: 13, paddingVertical: 8, borderRadius: 9 }, acceptText: { color: '#fff', fontSize: 12, fontWeight: '700' }, signOut: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 11, borderTopWidth: 1, borderTopColor: colors.border }, signOutText: { color: colors.expense, fontSize: 13, fontWeight: '700' },
  versionContainer: { backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 8 },
  versionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  versionLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  versionValue: { fontSize: 12, fontWeight: '600', color: colors.text },
  versionBadge: { backgroundColor: colors.primaryLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#BFDBFE' },
  versionBadgeText: { fontSize: 11, fontWeight: '700', color: colors.primary }
  ,pokerOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, pokerOption: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingLeft: 11, paddingRight: 7, paddingVertical: 6 }, pokerOptionText: { color: colors.text, fontWeight: '600', fontSize: 12 }, addPokerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, addPokerButton: { width: 44, height: 44, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }
})
