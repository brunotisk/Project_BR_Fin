import { hojeISO } from './datas'
import { Categoria } from '../types'

export interface ItemFaturaExtraido {
  id: string
  data: string // YYYY-MM-DD
  descricaoOriginal: string
  descricaoLimpa: string
  valor: number
  isParcelado: boolean
  parcelaAtual?: number
  totalParcelas?: number
  parcelasRestantes?: number
  categoriaId: string | null
  selecionado: boolean
}

/**
 * Detecta se a descrição contém padrão de parcelamento.
 * Ex: "Amazon (9/10)", "LOJA ABC 02/10", "MAGALU (3/6)", "PARC 01/12", "CURSO 2 DE 10"
 */
export function detectarParcelas(descricao: string): {
  isParcelado: boolean
  parcelaAtual?: number
  totalParcelas?: number
  parcelasRestantes?: number
  descricaoLimpa: string
} {
  // Padrão 1: "(9/10)" ou "02/10"
  const regex1 = /(?:^|\s|\()(\d{1,2})\s*[\/]\s*(\d{1,2})(?:\)|\s|$)/i
  // Padrão 2: "parc 2/10" ou "parcela 2 de 10"
  const regex2 = /(?:parc(?:ela)?\.?\s*)(\d{1,2})\s*(?:de|\/)\s*(\d{1,2})/i
  // Padrão 3: "2 de 10"
  const regex3 = /(\d{1,2})\s+de\s+(\d{1,2})/i

  let match = descricao.match(regex2) || descricao.match(regex1) || descricao.match(regex3)

  if (match) {
    const atual = parseInt(match[1], 10)
    const total = parseInt(match[2], 10)

    if (total >= 2 && total <= 60 && atual >= 1 && atual <= total) {
      const restantes = total - atual
      // Remove a indicação de parcelas para obter o nome limpo da loja/serviço (ex: "Amazon")
      const descricaoLimpa = descricao
        .replace(match[0], '')
        .replace(/\(\s*\)/g, '')
        .replace(/\s+/g, ' ')
        .trim()

      return {
        isParcelado: true,
        parcelaAtual: atual,
        totalParcelas: total,
        parcelasRestantes: restantes,
        descricaoLimpa: descricaoLimpa || descricao
      }
    }
  }

  return {
    isParcelado: false,
    descricaoLimpa: descricao.trim()
  }
}

/**
 * Normaliza datas para YYYY-MM-DD
 */
export function normalizarData(textoData: string, dataPadrao: string = hojeISO()): string {
  if (!textoData) return dataPadrao
  const limpa = textoData.replace(/[^\d\/-]/g, '').trim()

  if (/^\d{4}-\d{2}-\d{2}$/.test(limpa)) {
    return limpa
  }

  const matchBR = limpa.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/)
  if (matchBR) {
    const dia = matchBR[1].padStart(2, '0')
    const mes = matchBR[2].padStart(2, '0')
    const ano = matchBR[3]
    return `${ano}-${mes}-${dia}`
  }

  const matchCurto = limpa.match(/^(\d{1,2})[\/-](\d{1,2})$/)
  if (matchCurto) {
    const ano = new Date().getFullYear()
    const dia = matchCurto[1].padStart(2, '0')
    const mes = matchCurto[2].padStart(2, '0')
    return `${ano}-${mes}-${dia}`
  }

  if (/^\d{8}/.test(limpa)) {
    const ano = limpa.substring(0, 4)
    const mes = limpa.substring(4, 6)
    const dia = limpa.substring(6, 8)
    return `${ano}-${mes}-${dia}`
  }

  return dataPadrao
}

/**
 * Normaliza valores em moeda.
 * Lida com "51,81", "51.81", "R$ 51,81" e valores inteiros em centavos "5181" -> 51.81
 */
export function normalizarValor(textoValor: string): number {
  if (!textoValor) return 0
  let limpo = textoValor.replace(/R\$/gi, '').replace(/\s/g, '').trim()

  // Se tiver vírgula como decimal (ex: 51,81 ou 1.250,50)
  if (limpo.includes(',')) {
    limpo = limpo.replace(/\./g, '').replace(',', '.')
    const num = parseFloat(limpo)
    return isNaN(num) ? 0 : Math.abs(num)
  }

  // Se tiver ponto e 2 casas decimais (ex: 51.81)
  if (/^\d+\.\d{2}$/.test(limpo)) {
    const num = parseFloat(limpo)
    return isNaN(num) ? 0 : Math.abs(num)
  }

  // Se for apenas dígitos inteiros (ex: "5181") típico de extrato copiado sem separador decimal
  if (/^\d+$/.test(limpo)) {
    const inteiro = parseInt(limpo, 10)
    // Se tiver 3 a 7 dígitos (ex: 5181 vira 51.81, 15000 vira 150.00)
    if (limpo.length >= 3 && limpo.length <= 7) {
      return inteiro / 100
    }
    return inteiro
  }

  const num = parseFloat(limpo)
  return isNaN(num) ? 0 : Math.abs(num)
}

/**
 * Sugere categoria considerando estritamente as categorias cadastradas pelo usuário
 */
export function sugerirCategoria(descricao: string, categorias: Categoria[]): string | null {
  if (!categorias || categorias.length === 0) return null
  const d = descricao.toLowerCase()

  // 1. Prioridade máxima: nome de uma categoria cadastrada presente na descrição (ex: "Amazon", "iFood", "Uber")
  for (const cat of categorias) {
    const nomeCat = cat.nome.toLowerCase().trim()
    if (nomeCat.length >= 3 && d.includes(nomeCat)) {
      return cat.id
    }
  }

  // 2. Regras de afinidade apenas contra categorias que o usuário cadastrou
  for (const cat of categorias) {
    const nomeCat = cat.nome.toLowerCase()
    if (nomeCat.includes('compra') && (d.includes('amazon') || d.includes('shopee') || d.includes('mercado livre') || d.includes('magalu') || d.includes('loja'))) {
      return cat.id
    }
    if ((nomeCat.includes('aliment') || nomeCat.includes('comida') || nomeCat.includes('restaurante')) && (d.includes('ifood') || d.includes('mercado') || d.includes('padaria') || d.includes('burger'))) {
      return cat.id
    }
    if ((nomeCat.includes('transp') || nomeCat.includes('carro') || nomeCat.includes('combust')) && (d.includes('uber') || d.includes('99') || d.includes('posto') || d.includes('gasolina'))) {
      return cat.id
    }
    if ((nomeCat.includes('assinat') || nomeCat.includes('stream') || nomeCat.includes('lazer')) && (d.includes('netflix') || d.includes('spotify') || d.includes('prime') || d.includes('apple'))) {
      return cat.id
    }
  }

  return null
}

/**
 * Parser de texto colado ou arquivo CSV/TXT de fatura
 * Suporta o padrão: "Amazon (9/10)\tParcela sem juros\tUWF7HH\t5181"
 */
export function parseTextoOuCSV(conteudo: string, categoriasDisponiveis: Categoria[] = []): ItemFaturaExtraido[] {
  const itens: ItemFaturaExtraido[] = []
  const linhas = conteudo.split(/\r?\n/)
  let contador = 0

  for (const linha of linhas) {
    const l = linha.trim()
    if (!l || l.length < 3) continue

    // Ignora cabeçalhos comuns
    if (/^(data|date|descri|valor|hist|lançamento)/i.test(l)) continue
    if (/pagamento\s+(?:de\s+)?fatura|pagto\s+fatura/i.test(l)) continue

    let dataStr = hojeISO()
    let descStr = ''
    let valorNum = 0

    // Caso 1: Linhas separadas por TABULAÇÃO (\t)
    // Exemplo do usuário: "Amazon (9/10)		 	Parcela sem juros	UWF7HH	5181"
    if (linha.includes('\t')) {
      const partes = linha.split(/\t+/).map((p) => p.trim()).filter((p) => p.length > 0)

      if (partes.length >= 2) {
        // A primeira coluna é a descrição (ex: Amazon (9/10))
        descStr = partes[0]

        // Procura a coluna que contém o valor monetário (geralmente a última ou penúltima)
        for (let i = partes.length - 1; i >= 1; i--) {
          const valCandidato = normalizarValor(partes[i])
          if (valCandidato > 0) {
            valorNum = valCandidato
            break
          }
        }

        // Verifica se alguma coluna tem data
        const parteData = partes.find((p) => /\d{1,2}[\/-]\d{1,2}/.test(p))
        if (parteData) {
          dataStr = normalizarData(parteData)
        }
      }
    }

    // Caso 2: Linhas com separador CSV (; ou ,)
    if (!valorNum && (l.includes(';') || (l.includes(',') && (l.match(/,/g) || []).length >= 2))) {
      const separador = l.includes(';') ? ';' : ','
      const colunas = l.split(separador).map((c) => c.replace(/^["']|["']$/g, '').trim())

      if (colunas.length >= 2) {
        const idxData = colunas.findIndex((c) => /\d{1,2}[\/-]\d{1,2}/.test(c))
        const idxValor = colunas.findIndex((c, i) => i !== idxData && /\d+[\.,]?\d*/.test(c))

        if (idxValor !== -1) {
          valorNum = normalizarValor(colunas[idxValor])
          if (idxData !== -1) dataStr = normalizarData(colunas[idxData])
          descStr = colunas.filter((_, i) => i !== idxData && i !== idxValor).join(' ')
        }
      }
    }

    // Caso 3: Texto livre (espaços)
    if (!valorNum) {
      const matchData = l.match(/^(\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?|\d{4}-\d{2}-\d{2})/)
      const matchValor = l.match(/(?:R\$\s*)?([\d\.]+,\d{2}|[\d,]+\.\d{2}|\b\d+,\d{2}\b|\b\d+\.\d{2}\b|\b\d{3,6}\b)/)

      if (matchValor) {
        valorNum = normalizarValor(matchValor[1])
        if (matchData) {
          dataStr = normalizarData(matchData[1])
          descStr = l.replace(matchData[0], '').replace(matchValor[0], '').replace(/R\$/gi, '').trim()
        } else {
          descStr = l.replace(matchValor[0], '').trim()
        }
      }
    }

    if (valorNum > 0 && descStr.length > 0) {
      contador++
      const { isParcelado, parcelaAtual, totalParcelas, parcelasRestantes, descricaoLimpa } = detectarParcelas(descStr)

      const catId = sugerirCategoria(descStr, categoriasDisponiveis)

      itens.push({
        id: `fatura-${contador}-${Date.now()}`,
        data: dataStr,
        descricaoOriginal: descStr,
        descricaoLimpa,
        valor: valorNum,
        isParcelado,
        parcelaAtual,
        totalParcelas,
        parcelasRestantes,
        categoriaId: catId,
        selecionado: true
      })
    }
  }

  return itens
}

/**
 * Parser de OFX
 */
export function parseOFX(conteudo: string, categoriasDisponiveis: Categoria[] = []): ItemFaturaExtraido[] {
  const itens: ItemFaturaExtraido[] = []
  const transacoesRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi

  let match: RegExpExecArray | null
  let contador = 0

  while ((match = transacoesRegex.exec(conteudo)) !== null) {
    contador++
    const bloco = match[1]

    const dtMatch = bloco.match(/<DTPOSTED>\s*(\d+)/i)
    const amtMatch = bloco.match(/<TRNAMT>\s*([\d\.\,\-]+)/i)
    const memoMatch = bloco.match(/<MEMO>\s*([^<\r\n]+)/i) || bloco.match(/<NAME>\s*([^<\r\n]+)/i)

    const rawData = dtMatch ? dtMatch[1] : ''
    const rawAmt = amtMatch ? amtMatch[1] : '0'
    const rawDesc = memoMatch ? memoMatch[1].trim() : `Compra ${contador}`

    const valor = normalizarValor(rawAmt)
    if (valor <= 0) continue
    if (/pagamento\s+(?:de\s+)?fatura/i.test(rawDesc)) continue

    const { isParcelado, parcelaAtual, totalParcelas, parcelasRestantes, descricaoLimpa } = detectarParcelas(rawDesc)
    const catId = sugerirCategoria(rawDesc, categoriasDisponiveis)

    itens.push({
      id: `ofx-${contador}-${Date.now()}`,
      data: normalizarData(rawData),
      descricaoOriginal: rawDesc,
      descricaoLimpa,
      valor,
      isParcelado,
      parcelaAtual,
      totalParcelas,
      parcelasRestantes,
      categoriaId: catId,
      selecionado: true
    })
  }

  return itens
}

/**
 * Processador geral de faturas
 */
export function processarFatura(conteudo: string, categoriasDisponiveis: Categoria[] = []): ItemFaturaExtraido[] {
  if (conteudo.includes('<OFX>') || conteudo.includes('<STMTTRN>')) {
    return parseOFX(conteudo, categoriasDisponiveis)
  }
  return parseTextoOuCSV(conteudo, categoriasDisponiveis)
}

/**
 * Projeta o fluxo de parcelas futuras mês a mês
 */
export interface ParcelaFuturaProjetada {
  compraDescricao: string
  numeroParcela: number
  totalParcelas: number
  valor: number
  mes: number // 1 a 12
  ano: number
  dataVencimentoAprox: string // YYYY-MM-DD
}

export function projetarParcelasFuturas(
  item: ItemFaturaExtraido,
  diaVencimentoCartao: number = 10
): ParcelaFuturaProjetada[] {
  if (!item.isParcelado || !item.parcelaAtual || !item.totalParcelas) {
    return []
  }

  const projecoes: ParcelaFuturaProjetada[] = []
  const dataOrigem = new Date(item.data + 'T12:00:00')

  for (let p = item.parcelaAtual + 1; p <= item.totalParcelas; p++) {
    const mesesNaFrente = p - item.parcelaAtual
    const dataFutura = new Date(dataOrigem.getFullYear(), dataOrigem.getMonth() + mesesNaFrente, 1)

    const mes = dataFutura.getMonth() + 1
    const ano = dataFutura.getFullYear()
    const diaVenc = Math.min(diaVencimentoCartao, 28)
    const dataVencimentoAprox = `${ano}-${String(mes).padStart(2, '0')}-${String(diaVenc).padStart(2, '0')}`

    projecoes.push({
      compraDescricao: item.descricaoLimpa,
      numeroParcela: p,
      totalParcelas: item.totalParcelas,
      valor: item.valor,
      mes,
      ano,
      dataVencimentoAprox
    })
  }

  return projecoes
}
