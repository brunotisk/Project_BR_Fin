alter table public.cartoes_controle_ma
  add column if not exists situacao_pagamento text not null default 'nao_pago';

alter table public.cartoes_controle_ma
  drop constraint if exists cartoes_controle_ma_situacao_pagamento_check;

alter table public.cartoes_controle_ma
  add constraint cartoes_controle_ma_situacao_pagamento_check
  check (situacao_pagamento in ('pago', 'nao_pago', 'vencida'));
