-- Encomendas table
create table if not exists public.encomendas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cliente_nome text not null,
  data_entrega date not null,
  order_description text,
  extra_insumos text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.encomendas enable row level security;

drop policy if exists "Users can view own encomendas" on public.encomendas;
create policy "Users can view own encomendas"
on public.encomendas for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own encomendas" on public.encomendas;
create policy "Users can insert own encomendas"
on public.encomendas for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own encomendas" on public.encomendas;
create policy "Users can update own encomendas"
on public.encomendas for update
using (auth.uid() = user_id);

drop policy if exists "Users can delete own encomendas" on public.encomendas;
create policy "Users can delete own encomendas"
on public.encomendas for delete
using (auth.uid() = user_id);

drop trigger if exists update_encomendas_updated_at on public.encomendas;
create trigger update_encomendas_updated_at
before update on public.encomendas
for each row execute function public.update_updated_at_column();

create index if not exists idx_encomendas_user_id on public.encomendas(user_id);
create index if not exists idx_encomendas_data_entrega on public.encomendas(data_entrega);

-- Estoque de compras table
create table if not exists public.estoque_compras (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_name text not null,
  checked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.estoque_compras enable row level security;

drop policy if exists "Users can view own estoque compras" on public.estoque_compras;
create policy "Users can view own estoque compras"
on public.estoque_compras for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own estoque compras" on public.estoque_compras;
create policy "Users can insert own estoque compras"
on public.estoque_compras for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own estoque compras" on public.estoque_compras;
create policy "Users can update own estoque compras"
on public.estoque_compras for update
using (auth.uid() = user_id);

drop policy if exists "Users can delete own estoque compras" on public.estoque_compras;
create policy "Users can delete own estoque compras"
on public.estoque_compras for delete
using (auth.uid() = user_id);

drop trigger if exists update_estoque_compras_updated_at on public.estoque_compras;
create trigger update_estoque_compras_updated_at
before update on public.estoque_compras
for each row execute function public.update_updated_at_column();

create index if not exists idx_estoque_compras_user_id on public.estoque_compras(user_id);
