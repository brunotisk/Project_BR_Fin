import { useCallback, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../services/supabase'
import { CartaoCredito } from '../types'
import { colors } from '../theme'
import { formatCurrency } from '../utils/formatCurrency'
import { Button } from '../components/Button'

export function CartoesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>()
  const [cartoes, setCartoes] = useState<CartaoCredito[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const carregarCartoes = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('cartoes_credito')
        .select('*')
        .order('criado_em', { ascending: true })

      if (error) {
        console.warn('Aviso ao buscar cartões:', error.message)
        setCartoes([])
        return
      }
      setCartoes((data as CartaoCredito[]) || [])
    } catch (err) {
      console.warn('Erro ao buscar cartões:', err)
      setCartoes([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      carregarCartoes()
    }, [carregarCartoes])
  )

  const limiteTotalGeral = cartoes.reduce((acc, c) => acc + (Number(c.limite) || 0), 0)

  return (
    <View style={styles.container}>
      {/* Cabeçalho */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Cartões de Crédito</Text>
          <Text style={styles.subtitle}>Faturas, limites e datas de corte</Text>
        </View>
        <Button
          title="+ Novo Cartão"
          onPress={() => navigation.navigate('NovoCartao')}
        />
      </View>

      {/* Ações Especiais de Cartão */}
      <View style={styles.atalhosGrid}>
        <TouchableOpacity
          style={styles.atalhoCard}
          onPress={() => navigation.navigate('ImportarFatura')}
        >
          <View style={[styles.atalhoIcone, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="cloud-upload" size={20} color={colors.primary} />
          </View>
          <View style={styles.atalhoInfo}>
            <Text style={styles.atalhoTitulo}>Subir Fatura</Text>
            <Text style={styles.atalhoSub}>Importe arquivo ou texto</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.atalhoCard}
          onPress={() => navigation.navigate('ProjecaoParcelas')}
        >
          <View style={[styles.atalhoIcone, { backgroundColor: colors.warningLight }]}>
            <Ionicons name="trending-up" size={20} color={colors.warning} />
          </View>
          <View style={styles.atalhoInfo}>
            <Text style={styles.atalhoTitulo}>Projeção Futura</Text>
            <Text style={styles.atalhoSub}>Parcelas dos próximos meses</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Limite Total */}
      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Limite Total em Cartões</Text>
        <Text style={styles.totalValue}>{formatCurrency(limiteTotalGeral)}</Text>
        <Text style={styles.totalHint}>
          {cartoes.length} {cartoes.length === 1 ? 'cartão ativo' : 'cartões ativos'}
        </Text>
      </View>

      {/* Lista de Cartões Visuais */}
      <FlatList
        data={cartoes}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregarCartoes() }} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="card-outline" size={44} color={colors.muted} />
              <Text style={styles.emptyTitle}>Nenhum cartão cadastrado</Text>
              <Text style={styles.emptyText}>
                Cadastre seus cartões de crédito para importar faturas e projetar as parcelas futuras!
              </Text>
              <View style={{ marginTop: 12 }}>
                <Button
                  title="Cadastrar Primeiro Cartão"
                  onPress={() => navigation.navigate('NovoCartao')}
                />
              </View>
            </View>
          ) : undefined
        }
        renderItem={({ item }) => (
          <View style={[styles.cartaoCard, { backgroundColor: item.cor || colors.primary }]}>
            <View style={styles.cartaoTop}>
              <View style={styles.chipRow}>
                <Ionicons name="hardware-chip-outline" size={28} color="#fff" />
                <Ionicons name="wifi" size={18} color="rgba(255,255,255,0.7)" style={{ marginLeft: 6 }} />
              </View>
              <Text style={styles.bandeiraTexto}>{item.bandeira.toUpperCase()}</Text>
            </View>

            <Text style={styles.cartaoNome}>{item.nome}</Text>

            <View style={styles.cartaoBottom}>
              <View>
                <Text style={styles.cartaoMiniLabel}>LIMITE TOTAL</Text>
                <Text style={styles.cartaoMiniValor}>{formatCurrency(Number(item.limite))}</Text>
              </View>
              <View>
                <Text style={styles.cartaoMiniLabel}>FECHAMENTO</Text>
                <Text style={styles.cartaoMiniValor}>Dia {item.dia_fechamento}</Text>
              </View>
              <View>
                <Text style={styles.cartaoMiniLabel}>VENCIMENTO</Text>
                <Text style={styles.cartaoMiniValor}>Dia {item.dia_vencimento}</Text>
              </View>
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
    marginBottom: 14
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
  atalhosGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14
  },
  atalhoCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10
  },
  atalhoIcone: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  atalhoInfo: {
    flex: 1
  },
  atalhoTitulo: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text
  },
  atalhoSub: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 1
  },
  totalCard: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14
  },
  totalLabel: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '500'
  },
  totalValue: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    marginVertical: 4
  },
  totalHint: {
    fontSize: 12,
    color: colors.muted
  },
  list: {
    gap: 14,
    paddingBottom: 24
  },
  cartaoCard: {
    borderRadius: 16,
    padding: 18,
    minHeight: 160,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3
  },
  cartaoTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  bandeiraTexto: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 1
  },
  cartaoNome: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginVertical: 12
  },
  cartaoBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  cartaoMiniLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 9,
    fontWeight: '600'
  },
  cartaoMiniValor: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2
  },
  emptyContainer: {
    backgroundColor: colors.surface,
    padding: 24,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    marginTop: 10,
    gap: 8
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text
  },
  emptyText: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 18
  }
})
