alter table public.produtos
add column if not exists is_base_recipe boolean not null default false;

alter table public.insumos
add column if not exists recipe_id uuid null references public.produtos(id) on delete cascade;

create unique index if not exists idx_insumos_recipe_id
on public.insumos(recipe_id)
where recipe_id is not null;
