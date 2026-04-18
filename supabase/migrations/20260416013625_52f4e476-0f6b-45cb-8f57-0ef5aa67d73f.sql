-- Allow admin to read all insumos (for counting usage)
CREATE POLICY "Admin can view all insumos"
ON public.insumos
FOR SELECT
USING (public.is_admin(auth.uid()));

-- Allow admin to read all produtos (for counting usage)
CREATE POLICY "Admin can view all produtos"
ON public.produtos
FOR SELECT
USING (public.is_admin(auth.uid()));
