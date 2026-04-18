
-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Insumos table
CREATE TABLE public.insumos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'ingrediente' CHECK (type IN ('ingrediente', 'embalagem')),
  purchase_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  package_size NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'g' CHECK (unit IN ('g', 'ml', 'un')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.insumos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own insumos" ON public.insumos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own insumos" ON public.insumos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own insumos" ON public.insumos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own insumos" ON public.insumos FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_insumos_updated_at BEFORE UPDATE ON public.insumos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Canais de venda table
CREATE TABLE public.canais_venda (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tax_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.canais_venda ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own channels" ON public.canais_venda FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own channels" ON public.canais_venda FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own channels" ON public.canais_venda FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own channels" ON public.canais_venda FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_canais_updated_at BEFORE UPDATE ON public.canais_venda FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Produtos (receitas) table
CREATE TABLE public.produtos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sell_price NUMERIC(10,2),
  waste_percent NUMERIC(5,2) DEFAULT 0,
  channel_id UUID REFERENCES public.canais_venda(id) ON DELETE SET NULL,
  desired_margin NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own produtos" ON public.produtos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own produtos" ON public.produtos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own produtos" ON public.produtos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own produtos" ON public.produtos FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_produtos_updated_at BEFORE UPDATE ON public.produtos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Composição da receita (ingredientes de cada produto)
CREATE TABLE public.composicao_receita (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  insumo_id UUID NOT NULL REFERENCES public.insumos(id) ON DELETE CASCADE,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 0,
  UNIQUE(produto_id, insumo_id)
);

ALTER TABLE public.composicao_receita ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own composicao" ON public.composicao_receita FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.produtos WHERE id = produto_id AND user_id = auth.uid()));
CREATE POLICY "Users can insert own composicao" ON public.composicao_receita FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.produtos WHERE id = produto_id AND user_id = auth.uid()));
CREATE POLICY "Users can update own composicao" ON public.composicao_receita FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.produtos WHERE id = produto_id AND user_id = auth.uid()));
CREATE POLICY "Users can delete own composicao" ON public.composicao_receita FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.produtos WHERE id = produto_id AND user_id = auth.uid()));
