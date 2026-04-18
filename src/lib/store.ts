import { supabase } from "@/integrations/supabase/client";
import type { Insumo, Produto, SalesChannel, RecipeIngredient } from "./types";

async function getAuthenticatedUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

// ── Insumos ──

export async function loadInsumos(): Promise<Insumo[]> {
  const userId = await getAuthenticatedUserId();
  const { data, error } = await supabase
    .from("insumos")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    type: row.type as Insumo["type"],
    purchasePrice: Number(row.purchase_price),
    packageSize: Number(row.package_size),
    unit: row.unit as Insumo["unit"],
  }));
}

export async function saveInsumo(insumo: Omit<Insumo, "id">): Promise<Insumo> {
  const userId = await getAuthenticatedUserId();
  const { data, error } = await supabase
    .from("insumos")
    .insert({
      user_id: userId,
      name: insumo.name,
      type: insumo.type,
      purchase_price: insumo.purchasePrice,
      package_size: insumo.packageSize,
      unit: insumo.unit,
    })
    .select()
    .single();
  if (error) throw error;
  return {
    id: data.id,
    name: data.name,
    type: data.type as Insumo["type"],
    purchasePrice: Number(data.purchase_price),
    packageSize: Number(data.package_size),
    unit: data.unit as Insumo["unit"],
  };
}

export async function updateInsumo(id: string, insumo: Partial<Insumo>): Promise<void> {
  const userId = await getAuthenticatedUserId();
  const { error } = await supabase.from("insumos").update({
    name: insumo.name,
    type: insumo.type,
    purchase_price: insumo.purchasePrice,
    package_size: insumo.packageSize,
    unit: insumo.unit,
  }).eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

export async function deleteInsumo(id: string): Promise<void> {
  const userId = await getAuthenticatedUserId();
  const { error } = await supabase.from("insumos").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

// ── Channels ──

export async function loadChannels(): Promise<SalesChannel[]> {
  const userId = await getAuthenticatedUserId();
  const { data, error } = await supabase
    .from("canais_venda")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    taxPercent: Number(row.tax_percent),
  }));
}

export async function saveChannel(channel: Omit<SalesChannel, "id">): Promise<SalesChannel> {
  const userId = await getAuthenticatedUserId();
  const { data, error } = await supabase
    .from("canais_venda")
    .insert({ user_id: userId, name: channel.name, tax_percent: channel.taxPercent })
    .select()
    .single();
  if (error) throw error;
  return { id: data.id, name: data.name, taxPercent: Number(data.tax_percent) };
}

export async function deleteChannel(id: string): Promise<void> {
  const userId = await getAuthenticatedUserId();
  const { error } = await supabase.from("canais_venda").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

// ── Produtos (Receitas) ──

export async function loadProdutos(): Promise<Produto[]> {
  const userId = await getAuthenticatedUserId();
  const { data: prodData, error: prodError } = await supabase
    .from("produtos")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (prodError) throw prodError;

  const productIds = (prodData ?? []).map((row: any) => row.id);
  if (productIds.length === 0) return [];

  const { data: compData, error: compError } = await supabase
    .from("composicao_receita")
    .select("*")
    .in("produto_id", productIds);
  if (compError) throw compError;

  return (prodData ?? []).map((row: any) => {
    const ingredients: RecipeIngredient[] = (compData ?? [])
      .filter((c: any) => c.produto_id === row.id)
      .map((c: any) => ({ insumoId: c.insumo_id, quantity: Number(c.quantity) }));
    return {
      id: row.id,
      name: row.name,
      ingredients,
      sellPrice: row.sell_price != null ? Number(row.sell_price) : undefined,
      wastePercent: row.waste_percent != null ? Number(row.waste_percent) : undefined,
      channelId: row.channel_id ?? undefined,
      desiredMargin: row.desired_margin != null ? Number(row.desired_margin) : undefined,
      prepTime: row.prep_time != null ? Number(row.prep_time) : undefined,
      quantidadePadrao: Number(row.quantidade_padrao || 1), 
    };
  });
}

export async function saveProduto(produto: Omit<Produto, "id">): Promise<Produto> {
  const userId = await getAuthenticatedUserId();

  const { data, error } = await (supabase as any)
    .from("produtos")
    .insert({
      user_id: userId,
      name: produto.name,
      sell_price: produto.sellPrice ?? null,
      waste_percent: produto.wastePercent ?? null,
      channel_id: produto.channelId ?? null,
      desired_margin: produto.desiredMargin ?? null,
      prep_time: produto.prepTime ?? null,
      quantidade_padrao: produto.quantidadePadrao || 1,
    })
    .select()
    .single();
  if (error) throw error;

  if (produto.ingredients.length > 0) {
    const { error: compError } = await supabase.from("composicao_receita").insert(
      produto.ingredients.map((ing) => ({
        produto_id: data.id,
        insumo_id: ing.insumoId,
        quantity: ing.quantity,
      }))
    );
    if (compError) throw compError;
  }

  return { id: data.id, ...produto };
}

export async function updateProduto(id: string, produto: Partial<Produto>): Promise<void> {
  const userId = await getAuthenticatedUserId();
  const { error } = await (supabase as any).from("produtos").update({
    name: produto.name,
    sell_price: produto.sellPrice ?? null,
    waste_percent: produto.wastePercent ?? null,
    channel_id: produto.channelId ?? null,
    desired_margin: produto.desiredMargin ?? null,
    prep_time: produto.prepTime ?? null,
    quantidade_padrao: produto.quantidadePadrao || 1,
  }).eq("id", id).eq("user_id", userId);
  if (error) throw error;

  if (produto.ingredients !== undefined) {
    await supabase.from("composicao_receita").delete().eq("produto_id", id);
    if (produto.ingredients.length > 0) {
      const { error } = await supabase.from("composicao_receita").insert(
        produto.ingredients.map((ing) => ({
          produto_id: id,
          insumo_id: ing.insumoId,
          quantity: ing.quantity,
        }))
      );
      if (error) throw error;
    }
  }
}

export async function deleteProduto(id: string): Promise<void> {
  const userId = await getAuthenticatedUserId();
  const { error } = await supabase.from("produtos").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

// ── User Settings ──

export interface UserSettings {
  laborCostPerHour: number;
}

export async function loadUserSettings(): Promise<UserSettings> {
  const userId = await getAuthenticatedUserId();
  const { data, error } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { laborCostPerHour: 0 };
  return { laborCostPerHour: Number(data.labor_cost_per_hour) };
}

export async function saveUserSettings(settings: UserSettings): Promise<void> {
  const userId = await getAuthenticatedUserId();

  const { data: existing } = await supabase
    .from("user_settings")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("user_settings").update({
      labor_cost_per_hour: settings.laborCostPerHour,
    }).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("user_settings").insert({
      user_id: userId,
      labor_cost_per_hour: settings.laborCostPerHour,
    });
    if (error) throw error;
  }
}

// ── Encomendas ──

export interface Encomenda {
  id: string;
  customerName: string;
  deliveryDate: string;
  orderDescription: string;
  extraInsumos: string;
  createdAt: string;
  arquivada?: boolean;
}

export async function loadEncomendas(): Promise<Encomenda[]> {
  const userId = await getAuthenticatedUserId();
  const { data, error } = await (supabase.from("encomendas") as any)
    .select("*")
    .eq("user_id", userId)
    .eq("arquivada", false);
    
  if (error) throw error;
  
  return ((data as any) ?? []).map((row: any) => ({
    id: row.id,
    customerName: row.cliente_nome,
    deliveryDate: row.data_entrega,
    orderDescription: row.order_description ?? "",
    extraInsumos: row.extra_insumos ?? "",
    createdAt: row.created_at,
    arquivada: !!row.arquivada,
  }));
}

export async function saveEncomenda(input: Omit<Encomenda, "id" | "createdAt">): Promise<void> {
  const userId = await getAuthenticatedUserId();
  const { error } = await (supabase.from("encomendas") as any).insert({
    user_id: userId,
    cliente_nome: input.customerName,
    data_entrega: input.deliveryDate,
    order_description: input.orderDescription,
    extra_insumos: input.extraInsumos,
    arquivada: false
  });
  if (error) throw error;
}

export async function deleteEncomenda(id: string): Promise<void> {
  const userId = await getAuthenticatedUserId();
  const { error } = await supabase.from("encomendas").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

export async function arquivarEncomenda(id: string): Promise<void> {
  const userId = await getAuthenticatedUserId();
  const { error } = await (supabase.from("encomendas") as any)
    .update({ arquivada: true })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function loadEncomendasArquivadas(): Promise<Encomenda[]> {
  const userId = await getAuthenticatedUserId();
  const { data, error } = await (supabase.from("encomendas") as any)
    .select("*")
    .eq("user_id", userId)
    .eq("arquivada", true)
    .order("data_entrega", { ascending: false });
    
  if (error) throw error;
  
  return ((data as any) ?? []).map((row: any) => ({
    id: row.id,
    customerName: row.cliente_nome,
    deliveryDate: row.data_entrega,
    orderDescription: row.order_description ?? "",
    extraInsumos: row.extra_insumos ?? "",
    createdAt: row.created_at,
    arquivada: true,
  }));
}

export async function desarquivarEncomenda(id: string): Promise<void> {
  const { error } = await (supabase.from("encomendas") as any)
    .update({ arquivada: false })
    .eq("id", id);
  if (error) throw error;
}

// ── Estoque para compras ──

export interface ShoppingStockItem {
  id: string;
  itemName: string;
  checked: boolean;
  createdAt: string;
}

export async function loadShoppingStockItems(): Promise<ShoppingStockItem[]> {
  const userId = await getAuthenticatedUserId();
  const { data, error } = await supabase
    .from("estoque_compras")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    itemName: row.item_name,
    checked: row.checked,
    createdAt: row.created_at,
  }));
}

export async function toggleShoppingStockItem(id: string, checked: boolean): Promise<void> {
  const userId = await getAuthenticatedUserId();
  const { error } = await supabase
    .from("estoque_compras")
    .update({ checked })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function deleteShoppingStockItem(id: string): Promise<void> {
  const userId = await getAuthenticatedUserId();
  const { error } = await supabase.from("estoque_compras").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

// ── Vendas e Histórico Mensal ──

export interface Venda {
  id: string;
  clienteNome: string;
  produtoNome: string;
  valorVenda: number;
  custoTotal: number;
  lucro: number;
  dataVenda: string;
}

export async function registrarVenda(venda: Omit<Venda, "id">): Promise<void> {
  const userId = await getAuthenticatedUserId();
  const { error } = await (supabase as any)
    .from("vendas")
    .insert({
      user_id: userId,
      cliente_nome: venda.clienteNome,
      produto_nome: venda.produtoNome,
      valor_venda: venda.valorVenda,
      custo_total: venda.custoTotal,
      lucro: venda.lucro,
      data_venda: venda.dataVenda
    });
  if (error) throw error;
}

export async function loadVendasMensais(): Promise<Record<string, Venda[]>> {
  const userId = await getAuthenticatedUserId();
  const { data, error } = await (supabase as any)
    .from("vendas")
    .select("*")
    .eq("user_id", userId)
    .order("data_venda", { ascending: false });

  if (error) throw error;

  const grupos: Record<string, Venda[]> = {};
  (data ?? []).forEach((row: any) => {
    const dataObj = new Date(row.data_venda);
    const mesAno = dataObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const chave = mesAno.charAt(0).toUpperCase() + mesAno.slice(1);
    
    if (!grupos[chave]) grupos[chave] = [];
    grupos[chave].push({
      id: row.id,
      clienteNome: row.cliente_nome,
      produtoNome: row.produto_nome,
      valorVenda: Number(row.valor_venda),
      custoTotal: Number(row.custo_total),
      lucro: Number(row.lucro),
      dataVenda: row.data_venda,
    });
  });

  return grupos;
}

export async function seedExampleData(): Promise<void> {
  try {
    const userId = await getAuthenticatedUserId();

    // 1. Cadastra uma lista maior de Insumos
    const { data: ins, error: insError } = await supabase.from("insumos").insert([
      { user_id: userId, name: "Farinha de Trigo Premium", type: "ingrediente", purchase_price: 32.00, package_size: 5000, unit: "g" },
      { user_id: userId, name: "Açúcar Mascavo", type: "ingrediente", purchase_price: 18.50, package_size: 1000, unit: "g" },
      { user_id: userId, name: "Manteiga de Primeira", type: "ingrediente", purchase_price: 15.90, package_size: 200, unit: "g" },
      { user_id: userId, name: "Chocolate 70% Cacau", type: "ingrediente", purchase_price: 85.00, package_size: 1050, unit: "g" },
      { user_id: userId, name: "Ovos Caipira", type: "ingrediente", purchase_price: 15.00, package_size: 12, unit: "un" },
      { user_id: userId, name: "Caixa para Presente", type: "embalagem", purchase_price: 45.00, package_size: 10, unit: "un" },
      { user_id: userId, name: "Saco de Confeitar", type: "embalagem", purchase_price: 25.00, package_size: 50, unit: "un" }
    ]).select();

    if (insError || !ins) throw insError;

    // 2. Cadastra 2 Receitas (para comparar no gráfico)
    const { data: prods, error: prodError } = await (supabase as any).from("produtos").insert([
      {
        user_id: userId,
        name: "Brownie de Chocolate",
        sell_price: 18.00,
        prep_time: 40,
        waste_percent: 5,
        quantidade_padrao: 15 
      },
      {
        user_id: userId,
        name: "Cookies de Baunilha",
        sell_price: 8.50,
        prep_time: 30,
        waste_percent: 2,
        quantidade_padrao: 24
      }
    ]).select();

    if (prodError || !prods) throw prodError;

    // 3. Liga os Insumos às Receitas (Composição)
    await supabase.from("composicao_receita").insert([
      // Composição do Brownie
      { produto_id: prods[0].id, insumo_id: ins[0].id, quantity: 200 },
      { produto_id: prods[0].id, insumo_id: ins[2].id, quantity: 150 },
      { produto_id: prods[0].id, insumo_id: ins[3].id, quantity: 300 },
      { produto_id: prods[0].id, insumo_id: ins[5].id, quantity: 1 },
      // Composição do Cookie
      { produto_id: prods[1].id, insumo_id: ins[0].id, quantity: 300 },
      { produto_id: prods[1].id, insumo_id: ins[1].id, quantity: 150 },
      { produto_id: prods[1].id, insumo_id: ins[4].id, quantity: 2 }
    ]);

    // 4. Preenche o Estoque de Compras
    await supabase.from("estoque_compras").insert([
      { user_id: userId, item_name: "Comprar mais Chocolate 70%", checked: false },
      { user_id: userId, item_name: "Repor estoque de Caixas", checked: true },
      { user_id: userId, item_name: "Farinha de Trigo", checked: false }
    ]);

    // 5. Preenche Encomendas Ativas
    await (supabase.from("encomendas") as any).insert([
      { 
        user_id: userId, 
        cliente_nome: "Maria Oliveira", 
        data_entrega: new Date(Date.now() + 86400000).toISOString(), // Amanhã
        order_description: "20 Cookies e 1 Brownie Médio",
        extra_insumos: "Laço de fita rosa",
        arquivada: false
      },
      { 
        user_id: userId, 
        cliente_nome: "João Silva", 
        data_entrega: new Date(Date.now() + 172800000).toISOString(), // Depois de amanhã
        order_description: "Kit Presente completo",
        extra_insumos: "Cartão de aniversário",
        arquivada: false
      }
    ]);

    window.location.reload(); 

  } catch (err: any) {
    console.error("ERRO NO SEED COMPLETO:", err.message);
    alert("Erro ao gerar cenário completo: " + err.message);
  }
}