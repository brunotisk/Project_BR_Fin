# App Financeiro

Aplicativo mobile-first para controle financeiro pessoal/SaaS, com React Native + Expo (SDK 57) + TypeScript + Supabase.

## Estrutura

- `src/screens`: telas
- `src/components`: componentes reutilizáveis
- `src/services`: Supabase e autenticação
- `src/navigation`: navegação (React Navigation)
- `src/types`: tipos compartilhados (`database.ts` = tipos do banco)
- `src/utils`: utilitários (`notify` funciona em mobile e Web; `datas` trabalha em America/Sao_Paulo)
- `src/theme`: identidade visual
- `supabase/migrations`: banco versionado

## Criar o ambiente

1. Tenha Node.js LTS instalado.
2. Copie `.env.example` para `.env`.
3. Preencha `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` com os dados do projeto Supabase
   (Project Settings → API). Use apenas a chave **publicável**; nunca coloque a `secret`/`service_role` no app.
4. Instale as dependências:

```bash
npm install
npx expo install --check   # confirma que as versões batem com o SDK
npx expo-doctor            # diagnóstico geral do projeto
```

## Rodar

```bash
npm run start
```

Depois use Expo Go, Android, iOS ou Web. Se mudar o `.env`, reinicie com `npx expo start -c`.

## Banco de dados (Supabase CLI)

```bash
npx supabase init                      # só na primeira vez (cria supabase/config.toml)
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase migration list            # compara migrations locais x remotas
npx supabase db push                   # aplica as pendentes em supabase/migrations
```

Depois de aplicar as migrations, gere os tipos do banco:

```bash
npx supabase gen types typescript --linked > src/types/database.ts
```

### Migrations

| Arquivo | O que faz |
| --- | --- |
| `0001_initial.sql` | Tabela `profiles` mínima com RLS |
| `0002_profile_trigger_and_policy_fix.sql` | Trigger que cria o perfil no cadastro |
| `003_correcoes_e_padronizacao.sql` | Modelo financeiro completo (contas, categorias, transações, parcelas, metas, orçamentos), colunas em português, fuso e integridade |
| `004_cartoes_credito.sql` | Cartões de crédito |
| `005_todo_agenda.sql` | Tarefas e compromissos compartilhados entre Todo List e Agenda |
| `006_agendas_compartilhadas.sql` | Agendas por usuário, convites, participantes e cores por pessoa |
| `007_tarefas_responsaveis.sql` | Responsável por tarefa, prioridades e conclusão pelo responsável |
| `008_preferencias_horario.sql` | Horário inicial/final dos eventos, dia todo e preferências de duração do dia |
| `009_modulo_financeiro_planilhas.sql` | Fechamento mensal (necessidade de caixa), controle de cartões MA e lançamentos MA com múltiplas entradas |
| `010_poker_dias_bloqueados.sql` | Cadeado por dia de Poker e bloqueio de exclusão dos lançamentos enquanto travado |
| `011_preferencias_acesso_modulos.sql` | Preferências por usuário para habilitar ou bloquear Todo List, Agenda e Financeiro |
| `012_excluir_sessao_poker.sql` | Exclusão atômica de uma sessão Poker inteira, incluindo lançamentos e cash out, respeitando o cadeado |
| `013_sessoes_poker_locais.sql` | Sessões de Poker por mês da fatura e data, com locais e exclusão segmentada |
| `014_excluir_local_sessao_poker.sql` | Exclusão protegida de um local e seus lançamentos dentro da sessão |
| `015_poker_fotos.sql` | Anexos de fotos privados por sessão/local no Supabase Storage |
| `016_exclusao_fotos_poker.sql` | Exclusão de fotos protegida pelo estado aberto do dia |

- Não edite migrations já aplicadas: mudanças entram como uma nova migration.
  Para as próximas, use `npx supabase migration new nome`, que gera o prefixo com timestamp
  (ele ordena depois da `003`).
- A `003` é idempotente e preserva dados existentes.
- Se existir um `001_initial_schema.sql` solto na pasta: ele foi substituído pela `003`.
  Veja `npx supabase migration list`; se ele **não** aparecer na coluna *Remote*, apague o arquivo local.

### Fuso horário (America/Sao_Paulo)

- Datas de calendário (`transacoes.data`, `parcelas.data_vencimento`) são `date`, sem fuso.
  O padrão de `transacoes.data` é `public.hoje()`, que calcula "hoje" em America/Sao_Paulo
  (e não em UTC, que viraria o dia às 21h).
- `criado_em` e `atualizado_em` são `timestamptz` (instante absoluto); o app converte para exibir
  (`formatarDataHora` em `src/utils/datas.ts`).
- Não use `new Date('2026-10-03')` para exibir colunas `date`: use `formatarData`.

### Parcelamento

Crie compras parceladas pela função `criar_transacao_parcelada` (RPC), que grava a transação e as
parcelas de forma atômica (a 1ª parcela absorve o resto da divisão):

```ts
const { data: transacaoId, error } = await supabase.rpc('criar_transacao_parcelada', {
  p_conta_id: contaId,
  p_categoria_id: categoriaId,
  p_descricao: 'TV',
  p_valor_total: 100,
  p_total_parcelas: 3,
  p_primeiro_vencimento: '2026-11-10'
})
```

O banco rejeita parcelas cuja soma ou quantidade não feche com a transação (checado no commit).

## Autenticação

- Sessão persistida via `expo-sqlite/localStorage`.
- O token é renovado só com o app em primeiro plano (`AppState` em `src/services/supabase.ts`).
- Um trigger cria a linha em `profiles` e as categorias padrão a cada novo usuário.
- O nome vem de `options: { data: { nome } }` no `signUp` (ainda não enviado pelo app).

## Navegação

A navegação principal tem três módulos: Todo List, Agenda e Financeiro. Tarefas e compromissos podem ser exibidos em ambos os módulos de organização; as telas financeiras existentes ficam no menu interno de Financeiro.



## Reset do Banco de Dados (Ambiente de Testes)

Caso precise zerar os dados para testes, execute no **SQL Editor** do Supabase:

### Opção 1: Zerar apenas dados financeiros (mantém os logins):
```sql
TRUNCATE TABLE 
  public.parcelas,
  public.transacoes,
  public.orcamentos,
  public.metas,
  public.cartoes_credito,
  public.contas,
  public.categorias
CASCADE;
```

### Opção 2: Zerar tudo (inclusive usuários):
```sql
TRUNCATE TABLE 
  public.parcelas,
  public.transacoes,
  public.orcamentos,
  public.metas,
  public.cartoes_credito,
  public.contas,
  public.categorias,
  public.profiles
CASCADE;

DELETE FROM auth.users;
```
> *Nota: Ao usar a Opção 2, clique em "Sair" no app e crie uma nova conta, pois a sessão salva no dispositivo pertencerá a um usuário já excluído.*
