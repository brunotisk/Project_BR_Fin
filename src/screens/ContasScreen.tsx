import { useCallback, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { supabase } from '../services/supabase'
import { Conta } from '../types'
import { colors } from '../theme'
import { formatCurrency } from '../utils/formatCurrency'
import { Button } from '../components/Button'

export function ContasScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>()
  const [contas, setContas] = useState<Conta[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const carregarContas = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('contas')
        .select('*')
        .order('criado_em', { ascending: true })

      if (error) throw error
      setContas((data as Conta[]) || [])
    } catch (err) {
      console.error('Erro ao buscar contas:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      carregarContas()
    }, [carregarContas])
  )

  const saldoTotal = contas.reduce((acc, c) => acc + (Number(c.saldo_inicial) || 0), 0)

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Minhas Contas</Text>
          <Text style={styles.subtitle}>Gerencie suas carteiras e bancos</Text>
        </View>
        <Button
          title="+ Nova Conta"
          onPress={() => navigation.navigate('NovaConta')}
        />
      </View>

      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Saldo em Contas</Text>
        <Text style={styles.totalValue}>{formatCurrency(saldoTotal)}</Text>
        <Text style={styles.totalHint}>{contas.length} {contas.length === 1 ? 'conta cadastrada' : 'contas cadastradas'}</Text>
      </View>

      <FlatList
        data={contas}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregarContas() }} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>Nenhuma conta cadastrada</Text>
              <Text style={styles.emptyText}>Cadastre sua primeira conta para poder lançar receitas e despesas!</Text>
              <View style={{ marginTop: 12 }}>
                <Button
                  title="Cadastrar Primeira Conta"
                  onPress={() => navigation.navigate('NovaConta')}
                />
              </View>
            </View>
          ) : undefined
        }
        renderItem={({ item }) => (
          <View style={styles.contaCard}>
            <View style={[styles.corIndicador, { backgroundColor: item.cor || colors.primary }]} />
            <View style={styles.contaInfo}>
              <Text style={styles.contaNome}>{item.nome}</Text>
              <Text style={styles.contaTipo}>
                {item.instituicao ? `${item.instituicao} • ` : ''}
                {item.tipo.toUpperCase()}
              </Text>
            </View>
            <View style={styles.contaSaldo}>
              <Text style={styles.saldoLabel}>Saldo Inicial</Text>
              <Text style={styles.saldoValor}>{formatCurrency(Number(item.saldo_inicial))}</Text>
            </View>
          </View>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 16
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text
  },
  subtitle: {
    fontSize: 13,
    color: colors.muted
  },
  totalCard: {
    backgroundColor: colors.surface,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16
  },
  totalLabel: {
    fontSize: 13,
    color: colors.muted,
    fontWeight: '500'
  },
  totalValue: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    marginVertical: 4
  },
  totalHint: {
    fontSize: 12,
    color: colors.muted
  },
  list: {
    gap: 10,
    paddingBottom: 24
  },
  contaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border
  },
  corIndicador: {
    width: 12,
    height: 38,
    borderRadius: 6,
    marginRight: 14
  },
  contaInfo: {
    flex: 1
  },
  contaNome: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text
  },
  contaTipo: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2
  },
  contaSaldo: {
    alignItems: 'flex-end'
  },
  saldoLabel: {
    fontSize: 11,
    color: colors.muted
  },
  saldoValor: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text
  },
  emptyContainer: {
    backgroundColor: colors.surface,
    padding: 24,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    marginTop: 20
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6
  },
  emptyText: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 18
  }
})
