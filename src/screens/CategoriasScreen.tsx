import { useCallback, useState } from 'react'
import { Alert, FlatList, Platform, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../services/supabase'
import { Categoria, TipoTransacao } from '../types'
import { colors } from '../theme'
import { Button } from '../components/Button'
import { notify } from '../utils/notify'

export function CategoriasScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>()
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [tipoFiltro, setTipoFiltro] = useState<TipoTransacao>('despesa')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const carregarCategorias = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('categorias')
        .select('*')
        .order('nome', { ascending: true })

      if (error) throw error
      setCategorias((data as Categoria[]) || [])
    } catch (err) {
      console.error('Erro ao buscar categorias:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      carregarCategorias()
    }, [carregarCategorias])
  )

  const categoriasFiltradas = categorias.filter((c) => c.tipo === tipoFiltro)

  async function handleExcluir(categoria: Categoria) {
    const confirmarAcao = async () => {
      try {
        const { error } = await supabase.from('categorias').delete().eq('id', categoria.id)
        if (error) {
          notify('Não foi possível excluir', 'Esta categoria pode estar vinculada a lançamentos existentes.')
        } else {
          notify('Sucesso', `Categoria "${categoria.nome}" excluída com sucesso.`)
          carregarCategorias()
        }
      } catch (err: any) {
        notify('Erro ao excluir', err?.message)
      }
    }

    if (Platform.OS === 'web') {
      if (globalThis.confirm(`Tem certeza que deseja excluir a categoria "${categoria.nome}"?`)) {
        void confirmarAcao()
      }
    } else {
      Alert.alert(
        'Excluir Categoria',
        `Deseja realmente excluir a categoria "${categoria.nome}"?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Excluir', style: 'destructive', onPress: confirmarAcao }
        ]
      )
    }
  }

  return (
    <View style={styles.container}>
      {/* Cabeçalho */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Categorias Cadastradas</Text>
          <Text style={styles.subtitle}>
            Somente as categorias cadastradas abaixo são usadas no app
          </Text>
        </View>
        <Button
          title="+ Nova Categoria"
          onPress={() => navigation.navigate('NovaCategoria')}
        />
      </View>

      {/* Seletor de Tipo (Despesas / Receitas) */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          onPress={() => setTipoFiltro('despesa')}
          style={[styles.tab, tipoFiltro === 'despesa' && styles.tabActiveExpense]}
        >
          <Ionicons
            name="cart-outline"
            size={16}
            color={tipoFiltro === 'despesa' ? colors.expense : colors.muted}
          />
          <Text style={[styles.tabText, tipoFiltro === 'despesa' && styles.tabTextActive]}>
            Despesas ({categorias.filter((c) => c.tipo === 'despesa').length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setTipoFiltro('receita')}
          style={[styles.tab, tipoFiltro === 'receita' && styles.tabActiveIncome]}
        >
          <Ionicons
            name="cash-outline"
            size={16}
            color={tipoFiltro === 'receita' ? colors.income : colors.muted}
          />
          <Text style={[styles.tabText, tipoFiltro === 'receita' && styles.tabTextActive]}>
            Receitas ({categorias.filter((c) => c.tipo === 'receita').length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Lista de Categorias Reais do Usuário */}
      <FlatList
        data={categoriasFiltradas}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregarCategorias() }} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="grid-outline" size={44} color={colors.muted} />
              <Text style={styles.emptyTitle}>Nenhuma categoria cadastrada</Text>
              <Text style={styles.emptyText}>
                Cadastre suas categorias personalizadas (ex: Amazon, Mercado, Combustível, Assinaturas).
                O sistema considerará estritamente as categorias cadastradas por você.
              </Text>
              <View style={{ marginTop: 14 }}>
                <Button
                  title="Cadastrar Primeira Categoria"
                  onPress={() => navigation.navigate('NovaCategoria')}
                />
              </View>
            </View>
          ) : undefined
        }
        renderItem={({ item }) => {
          const iconeNome = (item.icone as any) || (item.tipo === 'receita' ? 'cash-outline' : 'cart-outline')
          const corItem = item.cor || (item.tipo === 'receita' ? colors.income : colors.expense)

          return (
            <View style={styles.categoriaCard}>
              <View style={[styles.iconeBox, { backgroundColor: corItem + '20' }]}>
                <Ionicons name={iconeNome} size={22} color={corItem} />
              </View>

              <View style={styles.categoriaInfo}>
                <Text style={styles.categoriaNome}>{item.nome}</Text>
                <Text style={styles.categoriaTipo}>
                  {item.tipo === 'despesa' ? 'Categoria de Despesa' : 'Categoria de Receita'}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => handleExcluir(item)}
                style={styles.excluirBtn}
                accessibilityLabel={`Excluir categoria ${item.nome}`}
              >
                <Ionicons name="trash-outline" size={18} color={colors.expense} />
              </TouchableOpacity>
            </View>
          )
        }}
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
    color: colors.muted,
    marginTop: 2,
    maxWidth: 240
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6
  },
  tabActiveExpense: {
    backgroundColor: colors.expenseLight,
    borderWidth: 1,
    borderColor: colors.expense + '40'
  },
  tabActiveIncome: {
    backgroundColor: colors.incomeLight,
    borderWidth: 1,
    borderColor: colors.income + '40'
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted
  },
  tabTextActive: {
    color: colors.text,
    fontWeight: '700'
  },
  list: {
    gap: 10,
    paddingBottom: 24
  },
  categoriaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border
  },
  iconeBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  categoriaInfo: {
    flex: 1
  },
  categoriaNome: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text
  },
  categoriaTipo: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2
  },
  excluirBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors.expenseLight,
    marginLeft: 8
  },
  emptyContainer: {
    backgroundColor: colors.surface,
    padding: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    marginTop: 20,
    gap: 8
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text
  },
  emptyText: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 300
  }
})
