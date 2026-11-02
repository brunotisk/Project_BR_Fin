import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../services/supabase'
import { CartaoCredito, Categoria, Conta } from '../types'
import { colors } from '../theme'
import { formatCurrency } from '../utils/formatCurrency'
import { formatarData, hojeISO } from '../utils/datas'
import { ItemFaturaExtraido, processarFatura, projetarParcelasFuturas } from '../utils/faturaParser'
import { Button } from '../components/Button'
import { notify } from '../utils/notify'

export function ImportarFaturaScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>()
  const [modo, setModo] = useState<'texto' | 'arquivo'>('texto')
  const [textoColado, setTextoColado] = useState('')
  const [dataCompetencia, setDataCompetencia] = useState(hojeISO())
  const [cartoes, setCartoes] = useState<CartaoCredito[]>([])
  const [cartaoId, setCartaoId] = useState<string>('')
  const [contas, setContas] = useState<Conta[]>([])
  const [contaId, setContaId] = useState<string>('')
  const [categorias, setCategorias] = useState<Categoria[]>([])

  // Modal para escolher categoria de um item
  const [modalCategoriaAberto, setModalCategoriaAberto] = useState(false)
  const [itemEditandoId, setItemEditandoId] = useState<string | null>(null)

  // Itens extraídos da fatura
  const [itens, setItens] = useState<ItemFaturaExtraido[]>([])
  const [processando, setProcessando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null)

  useEffect(() => {
    async function carregarDados() {
      const [resCartoes, resContas, resCategorias] = await Promise.all([
        supabase.from('cartoes_credito').select('*').order('nome'),
        supabase.from('contas').select('*').order('nome'),
        supabase.from('categorias').select('*').eq('tipo', 'despesa').order('nome')
      ])

      if (resCartoes.data && resCartoes.data.length > 0) {
        setCartoes(resCartoes.data as CartaoCredito[])
        setCartaoId(resCartoes.data[0].id)
      }

      if (resContas.data && resContas.data.length > 0) {
        setContas(resContas.data as Conta[])
        setContaId(resContas.data[0].id)
      }

      if (resCategorias.data) {
        setCategorias(resCategorias.data as Categoria[])
      }
    }

    carregarDados()
  }, [])

  // Selecionar arquivo
  async function handleSelecionarArquivo() {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['*/*'],
        copyToCacheDirectory: true
      })

      if (res.canceled || !res.assets || res.assets.length === 0) return

      const file = res.assets[0]
      setNomeArquivo(file.name)
      setProcessando(true)

      let texto = ''
      if (Platform.OS === 'web') {
        const blob = (file as any).file || (await fetch(file.uri).then((r) => r.blob()))
        texto = await blob.text()
      } else {
        const response = await fetch(file.uri)
        texto = await response.text()
      }

      const resultado = processarFatura(texto, categorias)
      setItens(resultado)

      if (resultado.length === 0) {
        notify('Aviso', 'Nenhum lançamento foi reconhecido no arquivo selecionado.')
      } else {
        notify('Sucesso!', `${resultado.length} lançamentos encontrados na fatura.`)
      }
    } catch (err: any) {
      console.error(err)
      notify('Erro ao ler arquivo', err?.message || 'Não foi possível ler o arquivo.')
    } finally {
      setProcessando(false)
    }
  }

  // Analisar texto
  function handleAnalisarTexto() {
    if (!textoColado.trim()) {
      notify('Aviso', 'Cole as linhas da fatura ou extrato para analisar.')
      return
    }

    setProcessando(true)
    try {
      const resultado = processarFatura(textoColado, categorias)
      setItens(resultado)

      if (resultado.length === 0) {
        notify('Aviso', 'Não conseguimos identificar lançamentos no texto colado. Verifique os dados.')
      } else {
        notify('Sucesso!', `${resultado.length} lançamentos identificados no texto.`)
      }
    } finally {
      setProcessando(false)
    }
  }

  function toggleItem(id: string) {
    setItens((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selecionado: !item.selecionado } : item))
    )
  }

  function toggleTodos(selecionar: boolean) {
    setItens((prev) => prev.map((item) => ({ ...item, selecionado: selecionar })))
  }

  // Atribuir categoria a um item específico
  function selecionarCategoriaParaItem(catId: string | null) {
    if (itemEditandoId) {
      setItens((prev) =>
        prev.map((item) => (item.id === itemEditandoId ? { ...item, categoriaId: catId } : item))
      )
    }
    setModalCategoriaAberto(false)
    setItemEditandoId(null)
  }

  // Atribuir categoria em lote para todos os itens selecionados
  function aplicarCategoriaEmLote(catId: string | null) {
    setItens((prev) =>
      prev.map((item) => (item.selecionado ? { ...item, categoriaId: catId } : item))
    )
    notify('Categoria aplicada', 'Categoria definida para todos os lançamentos selecionados.')
  }

  const itensSelecionados = itens.filter((i) => i.selecionado)
  const totalFatura = itensSelecionados.reduce((acc, i) => acc + i.valor, 0)
  const totalParceladas = itensSelecionados.filter((i) => i.isParcelado)
  const totalParcelasFuturas = totalParceladas.reduce((acc, i) => acc + (i.parcelasRestantes || 0), 0)

  // Salvar no Supabase
  async function handleSalvarLancamentos() {
    if (itensSelecionados.length === 0) {
      notify('Aviso', 'Selecione ao menos um lançamento para importar.')
      return
    }

    if (!contaId) {
      notify('Aviso', 'Selecione uma conta para associar os lançamentos.')
      return
    }

    setSalvando(true)

    try {
      const cartaoSelecionado = cartoes.find((c) => c.id === cartaoId)
      const diaVencimento = cartaoSelecionado?.dia_vencimento || 10

      for (const item of itensSelecionados) {
        const dadosTransacao: any = {
          conta_id: contaId,
          tipo: 'despesa',
          descricao: item.descricaoOriginal,
          valor: item.valor,
          data: item.data || dataCompetencia,
          categoria_id: item.categoriaId || null,
          status: 'confirmado',
          observacao: `Fatura: ${cartaoSelecionado?.nome || 'Cartão de Crédito'}`
        }

        if (cartaoId) {
          dadosTransacao.cartao_id = cartaoId
        }

        const { data: transacaoInserida, error: errTransacao } = await supabase
          .from('transacoes')
          .insert(dadosTransacao)
          .select('id')
          .single()

        if (errTransacao) {
          if (errTransacao.message?.includes('cartao_id')) {
            delete dadosTransacao.cartao_id
            await supabase.from('transacoes').insert(dadosTransacao)
          } else {
            throw errTransacao
          }
        }

        // Se for compra parcelada (ex: Amazon 9/10), gera a parcela 10/10 no mês seguinte!
        if (item.isParcelado && transacaoInserida?.id) {
          const parcelasProjetadas = projetarParcelasFuturas(item, diaVencimento)

          for (const parc of parcelasProjetadas) {
            await supabase.from('parcelas').insert({
              transacao_id: transacaoInserida.id,
              numero: parc.numeroParcela,
              total_parcelas: parc.totalParcelas,
              valor: parc.valor,
              data_vencimento: parc.dataVencimentoAprox,
              status: 'pendente'
            })
          }
        }
      }

      notify(
        'Fatura Importada e Categorizada! 🎉',
        `${itensSelecionados.length} lançamentos salvos com categoria. O fluxo de ${totalParcelasFuturas} parcelas futuras foi gerado automaticamente!`
      )

      navigation.navigate('ProjecaoParcelas')
    } catch (err: any) {
      console.error(err)
      notify('Erro ao importar', err?.message || 'Falha ao registrar fatura.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Subir Fatura & Classificar</Text>
      <Text style={styles.subtitle}>
        Importe seus gastos, classifique por categorias e projete o fluxo das próximas faturas
      </Text>

      {/* Seleção do Cartão */}
      <View style={styles.cardSecao}>
        <Text style={styles.labelSecao}>1. Cartão e Conta de Cobrança</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
          {cartoes.map((c) => {
            const selecionado = c.id === cartaoId
            return (
              <TouchableOpacity
                key={c.id}
                onPress={() => setCartaoId(c.id)}
                style={[
                  styles.chip,
                  selecionado && { borderColor: c.cor, backgroundColor: c.cor + '20' }
                ]}
              >
                <View style={[styles.pontoCor, { backgroundColor: c.cor }]} />
                <Text style={[styles.chipTexto, selecionado && { fontWeight: '700', color: colors.text }]}>
                  {c.nome} (Venc: dia {c.dia_vencimento})
                </Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      </View>

      {/* Modo de Entrada */}
      <View style={styles.cardSecao}>
        <Text style={styles.labelSecao}>2. Cole o Extrato ou Suba o Arquivo</Text>

        <View style={styles.modoTabs}>
          <TouchableOpacity
            onPress={() => setModo('texto')}
            style={[styles.modoTab, modo === 'texto' && styles.modoTabAtivo]}
          >
            <Ionicons name="clipboard-outline" size={18} color={modo === 'texto' ? colors.primary : colors.muted} />
            <Text style={[styles.modoTexto, modo === 'texto' && styles.modoTextoAtivo]}>
              Colar Linhas do Extrato
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setModo('arquivo')}
            style={[styles.modoTab, modo === 'arquivo' && styles.modoTabAtivo]}
          >
            <Ionicons name="document-text-outline" size={18} color={modo === 'arquivo' ? colors.primary : colors.muted} />
            <Text style={[styles.modoTexto, modo === 'arquivo' && styles.modoTextoAtivo]}>
              Arquivo OFX / CSV
            </Text>
          </TouchableOpacity>
        </View>

        {modo === 'texto' ? (
          <View style={styles.textoArea}>
            <Text style={styles.inputDica}>
              Cole o texto copiado da fatura (ex: Amazon (9/10) Parcela sem juros UWF7HH 5181):
            </Text>
            <TextInput
              style={styles.textArea}
              placeholder="Exemplo:&#10;Amazon (9/10)    Parcela sem juros    UWF7HH    5181&#10;Uber *Trip    15/10    24,90&#10;Ifood Restaurante    18/10    68,00"
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={6}
              value={textoColado}
              onChangeText={setTextoColado}
            />
            <Button
              title="Reconhecer Lançamentos e Parcelas"
              onPress={handleAnalisarTexto}
              loading={processando}
            />
          </View>
        ) : (
          <View style={styles.uploadArea}>
            <Ionicons name="cloud-upload-outline" size={44} color={colors.primary} />
            <Text style={styles.uploadTitulo}>Selecione a Fatura (.ofx, .csv ou .txt)</Text>
            {nomeArquivo && (
              <View style={styles.arquivoInfo}>
                <Ionicons name="checkmark-circle" size={16} color={colors.income} />
                <Text style={styles.arquivoNome}>{nomeArquivo}</Text>
              </View>
            )}
            <View style={{ marginTop: 8 }}>
              <Button
                title={processando ? 'Lendo Arquivo...' : 'Escolher Arquivo no Dispositivo'}
                onPress={handleSelecionarArquivo}
                loading={processando}
              />
            </View>
          </View>
        )}
      </View>

      {/* Resultados e Classificação por Categoria */}
      {itens.length > 0 && (
        <View style={styles.cardSecao}>
          <View style={styles.headerResultados}>
            <View>
              <Text style={styles.labelSecao}>3. Classificar e Confirmar Gastos</Text>
              <Text style={styles.subResultados}>
                Toque na categoria de cada item para alterar
              </Text>
            </View>
            <View style={styles.acoesSelecao}>
              <TouchableOpacity onPress={() => toggleTodos(true)}>
                <Text style={styles.linkAcao}>Marcar Todos</Text>
              </TouchableOpacity>
              <Text style={{ color: colors.border }}>|</Text>
              <TouchableOpacity onPress={() => toggleTodos(false)}>
                <Text style={styles.linkAcao}>Desmarcar</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Resumo com Total da Fatura e Parcelas Futuras */}
          <View style={styles.faturaResumoCard}>
            <View>
              <Text style={styles.resumoFaturaLabel}>Total Desta Fatura</Text>
              <Text style={styles.resumoFaturaValor}>{formatCurrency(totalFatura)}</Text>
            </View>
            {totalParcelasFuturas > 0 && (
              <View style={styles.badgeParcelas}>
                <Ionicons name="trending-up" size={16} color={colors.warning} />
                <Text style={styles.badgeParcelasTexto}>
                  +{totalParcelasFuturas} parcelas futuras no fluxo!
                </Text>
              </View>
            )}
          </View>

          {/* Lista de Itens com Seletor de Categoria */}
          <View style={styles.itensLista}>
            {itens.map((item) => {
              const categoriaObj = categorias.find((c) => c.id === item.categoriaId)

              return (
                <View
                  key={item.id}
                  style={[
                    styles.itemLinha,
                    item.selecionado && styles.itemLinhaSelecionado
                  ]}
                >
                  <TouchableOpacity onPress={() => toggleItem(item.id)}>
                    <Ionicons
                      name={item.selecionado ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={item.selecionado ? colors.primary : colors.muted}
                    />
                  </TouchableOpacity>

                  <View style={styles.itemConteudo}>
                    <Text style={styles.itemDesc}>{item.descricaoLimpa}</Text>

                    <View style={styles.itemDetalhes}>
                      <Text style={styles.itemData}>{formatarData(item.data)}</Text>

                      {item.isParcelado && (
                        <View style={styles.itemTagParcela}>
                          <Text style={styles.itemTagParcelaTexto}>
                            Parc {item.parcelaAtual}/{item.totalParcelas}
                            {item.parcelasRestantes ? ` (${item.parcelasRestantes} futura para mês seguinte)` : ''}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Botão de Classificar Categoria do Item */}
                    <TouchableOpacity
                      style={styles.categoriaBtn}
                      onPress={() => {
                        setItemEditandoId(item.id)
                        setModalCategoriaAberto(true)
                      }}
                    >
                      <Ionicons
                        name={(categoriaObj?.icone as any) || 'pricetag-outline'}
                        size={14}
                        color={categoriaObj?.cor || colors.primary}
                      />
                      <Text
                        style={[
                          styles.categoriaBtnTexto,
                          { color: categoriaObj?.cor || colors.primary }
                        ]}
                      >
                        {categoriaObj ? categoriaObj.nome : 'Sem Categoria (Toque para definir)'}
                      </Text>
                      <Ionicons name="chevron-down" size={12} color={colors.muted} />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.itemValor}>-{formatCurrency(item.valor)}</Text>
                </View>
              )
            })}
          </View>

          {/* Botão de Finalização */}
          <View style={styles.acoesFinais}>
            <Button
              title={`Confirmar e Lançar ${itensSelecionados.length} Itens no Fluxo`}
              onPress={handleSalvarLancamentos}
              loading={salvando}
            />
          </View>
        </View>
      )}

      {/* Modal para Escolher Categoria */}
      <Modal
        visible={modalCategoriaAberto}
        transparent
        animationType="fade"
        onRequestClose={() => setModalCategoriaAberto(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Classificar Categoria</Text>
              <TouchableOpacity onPress={() => setModalCategoriaAberto(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 300 }}>
              <TouchableOpacity
                style={styles.modalItem}
                onPress={() => selecionarCategoriaParaItem(null)}
              >
                <Text style={styles.modalItemTexto}>Nenhuma (Sem categoria)</Text>
              </TouchableOpacity>

              {categorias.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={styles.modalItem}
                  onPress={() => selecionarCategoriaParaItem(cat.id)}
                >
                  <View style={[styles.iconeMiniBox, { backgroundColor: (cat.cor || colors.primary) + '20' }]}>
                    <Ionicons name={(cat.icone as any) || 'pricetag'} size={18} color={cat.cor || colors.primary} />
                  </View>
                  <Text style={styles.modalItemTexto}>{cat.nome}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: colors.background,
    minHeight: '100%',
    gap: 16,
    paddingBottom: 40
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4
  },
  subtitle: {
    fontSize: 14,
    color: colors.muted,
    marginBottom: 4
  },
  cardSecao: {
    backgroundColor: colors.surface,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12
  },
  labelSecao: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text
  },
  chipsScroll: {
    gap: 8,
    paddingVertical: 4
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  pontoCor: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8
  },
  chipTexto: {
    fontSize: 13,
    color: colors.muted
  },
  modoTabs: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    padding: 4,
    borderRadius: 10,
    gap: 4
  },
  modoTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6
  },
  modoTabAtivo: {
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1
  },
  modoTexto: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.muted
  },
  modoTextoAtivo: {
    color: colors.text,
    fontWeight: '700'
  },
  uploadArea: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.primary + '50',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    backgroundColor: colors.primaryLight + '30',
    gap: 8
  },
  uploadTitulo: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text
  },
  arquivoInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4
  },
  arquivoNome: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.income
  },
  textoArea: {
    gap: 10
  },
  inputDica: {
    fontSize: 13,
    color: colors.muted
  },
  textArea: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    color: colors.text,
    textAlignVertical: 'top',
    minHeight: 120
  },
  headerResultados: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  subResultados: {
    fontSize: 12,
    color: colors.muted
  },
  acoesSelecao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  linkAcao: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary
  },
  faturaResumoCard: {
    backgroundColor: colors.primaryLight,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  resumoFaturaLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.primary
  },
  resumoFaturaValor: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.primary,
    marginTop: 2
  },
  badgeParcelas: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.warningLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8
  },
  badgeParcelasTexto: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.warning
  },
  itensLista: {
    gap: 10
  },
  itemLinha: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    gap: 12
  },
  itemLinhaSelecionado: {
    backgroundColor: colors.surface,
    borderColor: colors.primary + '50'
  },
  itemConteudo: {
    flex: 1,
    gap: 4
  },
  itemDesc: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text
  },
  itemDetalhes: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8
  },
  itemData: {
    fontSize: 12,
    color: colors.muted
  },
  itemTagParcela: {
    backgroundColor: colors.warningLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  itemTagParcelaTexto: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.warning
  },
  categoriaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 4
  },
  categoriaBtnTexto: {
    fontSize: 12,
    fontWeight: '600'
  },
  itemValor: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.expense
  },
  acoesFinais: {
    marginTop: 8
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    gap: 14
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12
  },
  iconeMiniBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalItemTexto: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text
  }
})
