import { useCallback, useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../services/supabase'
import { useAuth } from '../services/AuthProvider'
import { Conta, Transacao } from '../types'
import { colors } from '../theme'
import { formatCurrency } from '../utils/formatCurrency'
import { formatarData } from '../utils/datas'

interface TransacaoComRelacoes extends Transacao {
  contas?: { nome: string; cor: string | null } | null
  categorias?: { nome: string; cor: string | null; icone: string | null } | null
}

export function HomeScreen() {
  const { session, signOut } = useAuth()
  const navigation = useNavigation<NativeStackNavigationProp<any>>()
  const [contas, setContas] = useState<Conta[]>([])
  const [transacoesRecentes, setTransacoesRecentes] = useState<TransacaoComRelacoes[]>([])
  const [totalReceitas, setTotalReceitas] = useState(0)
  const [totalDespesas, setTotalDespesas] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const carregarDashboard = useCallback(async () => {
    try {
      const [resContas, resTransacoes] = await Promise.all([
        supabase.from('contas').select('*').eq('ativa', true).order('saldo_inicial', { ascending: false }),
        supabase.from('transacoes')
          .select('*, contas (nome, cor), categorias (nome, cor, icone)')
          .order('data', { ascending: false })
          .order('criado_em', { ascending: false })
          .limit(5)
      ])

      if (resContas.data) setContas(resContas.data as Conta[])
      if (resTransacoes.data) setTransacoesRecentes(resTransacoes.data as unknown as TransacaoComRelacoes[])

      // Totais gerais
      const { data: todasTransacoes } = await supabase.from('transacoes').select('tipo, valor')
      if (todasTransacoes) {
        let rec = 0
        let desp = 0
        todasTransacoes.forEach((t) => {
          if (t.tipo === 'receita') rec += Number(t.valor)
          else desp += Number(t.valor)
        })
        setTotalReceitas(rec)
        setTotalDespesas(desp)
      }
    } catch (err) {
      console.error('Erro ao carregar dados da Home:', err)
    } finally {
      setRefreshing(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      carregarDashboard()
    }, [carregarDashboard])
  )

  const saldoContas = contas.reduce((acc, c) => acc + (Number(c.saldo_inicial) || 0), 0)
  const patrimonioTotal = saldoContas + totalReceitas - totalDespesas

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregarDashboard() }} />}
    >
      {/* Topo do Usuário */}
      <View style={styles.userHeader}>
        <View>
          <Text style={styles.saudacao}>Olá 👋</Text>
          <Text style={styles.userEmail}>{session?.user.email}</Text>
        </View>
        <TouchableOpacity style={styles.sairBtn} onPress={signOut}>
          <Ionicons name="log-out-outline" size={20} color={colors.muted} />
        </TouchableOpacity>
      </View>

      {/* Card Principal: Saldo e Comprometimento */}
      <View style={styles.saldoCard}>
        <Text style={styles.saldoCardLabel}>Patrimônio Total Estimado</Text>
        <Text style={styles.saldoCardValor}>{formatCurrency(patrimonioTotal)}</Text>

        <View style={styles.divisor} />

        <View style={styles.saldoCardRow}>
          <View style={styles.saldoCardItem}>
            <View style={[styles.dotPequeno, { backgroundColor: colors.income }]} />
            <Text style={styles.saldoCardItemLabel}>Receitas: </Text>
            <Text style={[styles.saldoCardItemValor, { color: colors.income }]}>
              +{formatCurrency(totalReceitas)}
            </Text>
          </View>
          <View style={styles.saldoCardItem}>
            <View style={[styles.dotPequeno, { backgroundColor: colors.expense }]} />
            <Text style={styles.saldoCardItemLabel}>Despesas: </Text>
            <Text style={[styles.saldoCardItemValor, { color: colors.expense }]}>
              -{formatCurrency(totalDespesas)}
            </Text>
          </View>
        </View>

      </View>

      {/* Últimas Movimentações */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Últimas Transações</Text>
        <TouchableOpacity onPress={() => navigation.navigate('TransacoesTab')}>
          <Text style={styles.verMais}>Ver todas</Text>
        </TouchableOpacity>
      </View>

      {transacoesRecentes.length === 0 ? (
        <View style={styles.cardAviso}>
          <Text style={styles.avisoTexto}>Nenhuma movimentação registrada.</Text>
          <TouchableOpacity onPress={() => navigation.navigate('NovaTransacao')}>
            <Text style={styles.avisoLink}>+ Criar Transação</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.transacoesLista}>
          {transacoesRecentes.map((item) => {
            const isReceita = item.tipo === 'receita'
            const iconeNome = (item.categorias?.icone as any) || (isReceita ? 'trending-up' : 'trending-down')
            const corBadge = item.categorias?.cor || (isReceita ? colors.income : colors.expense)

            return (
              <View key={item.id} style={styles.transacaoItem}>
                <View style={[styles.iconeBox, { backgroundColor: corBadge + '18' }]}>
                  <Ionicons name={iconeNome} size={18} color={corBadge} />
                </View>
                <View style={styles.transacaoInfo}>
                  <Text style={styles.transacaoDesc} numberOfLines={1}>{item.descricao}</Text>
                  <Text style={styles.transacaoSub}>
                    {formatarData(item.data)} {item.contas?.nome ? `• ${item.contas.nome}` : ''}
                  </Text>
                </View>
                <Text style={[styles.transacaoValor, { color: isReceita ? colors.income : colors.expense }]}>
                  {isReceita ? '+' : '-'} {formatCurrency(Number(item.valor))}
                </Text>
              </View>
            )
          })}
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 16
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4
  },
  saudacao: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text
  },
  userEmail: {
    fontSize: 13,
    color: colors.muted
  },
  sairBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border
  },
  saldoCard: {
    backgroundColor: colors.surface,
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2
  },
  saldoCardLabel: {
    fontSize: 13,
    color: colors.muted,
    fontWeight: '500'
  },
  saldoCardValor: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.text,
    marginVertical: 6
  },
  divisor: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12
  },
  saldoCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  saldoCardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  dotPequeno: {
    width: 6,
    height: 6,
    borderRadius: 3
  },
  saldoCardItemLabel: {
    fontSize: 12,
    color: colors.muted
  },
  saldoCardItemValor: {
    fontSize: 13,
    fontWeight: '700'
  },
  alertaParcelas: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.warningLight,
    padding: 10,
    borderRadius: 8
  },
  alertaParcelasTexto: {
    fontSize: 12,
    color: colors.text
  },
  faturaDestaqueCard: {
    backgroundColor: colors.primaryLight,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.primary + '30',
    gap: 12
  },
  faturaDestaqueInfo: {
    gap: 4
  },
  faturaDestaqueTitulo: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.primary
  },
  faturaDestaqueSub: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18
  },
  faturaDestaqueBotoes: {
    flexDirection: 'row',
    gap: 10
  },
  btnDestaque: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6
  },
  btnDestaqueTexto: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff'
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text
  },
  verMais: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600'
  },
  cartoesScroll: {
    gap: 12,
    paddingVertical: 4
  },
  cartaoItem: {
    padding: 16,
    borderRadius: 14,
    minWidth: 180,
    minHeight: 120,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2
  },
  cartaoItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  cartaoItemBandeira: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  cartaoItemNome: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginVertical: 8
  },
  cartaoItemBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  cartaoItemLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 8,
    fontWeight: '600'
  },
  cartaoItemValor: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 1
  },
  acoesScroll: {
    gap: 10,
    paddingVertical: 4
  },
  acaoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8
  },
  acaoTexto: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text
  },
  transacoesLista: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden'
  },
  transacaoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  iconeBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  transacaoInfo: {
    flex: 1
  },
  transacaoDesc: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text
  },
  transacaoSub: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2
  },
  transacaoValor: {
    fontSize: 14,
    fontWeight: '700'
  },
  cardAviso: {
    backgroundColor: colors.surface,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: 8
  },
  avisoTexto: {
    fontSize: 13,
    color: colors.muted
  },
  avisoLink: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary
  }
})
