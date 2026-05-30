import { supabase } from "@/integrations/supabase/client";
import { getUnitPrice, type Insumo, type Produto, type SalesChannel, type RecipeIngredient, type GastoAdicional } from "./types";

export interface ShoppingStockItem { 
  id: string; 
  itemName: string; 
  checked: boolean; 
}

async function getAuthenticatedUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

// ── INSUMOS ──

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
    recipeId: row.recipe_id ?? null,
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
    recipeId: (data as any).recipe_id ?? null,
  };
}

export async function updateInsumo(id: string, insumo: Partial<Insumo>): Promise<void> {
  const userId = await getAuthenticatedUserId();
  await supabase.from("insumos").update({
    name: insumo.name,
    type: insumo.type,
    purchase_price: insumo.purchasePrice,
    package_size: insumo.packageSize,
    unit: insumo.unit,
  }).eq("id", id).eq("user_id", userId);
}

export async function deleteInsumo(id: string): Promise<void> {
  const userId = await getAuthenticatedUserId();
  await supabase.from("insumos").delete().eq("id", id).eq("user_id", userId);
}

// ── CANAIS DE VENDA ──

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
  await supabase.from("canais_venda").delete().eq("id", id).eq("user_id", userId);
}

// ── PRODUTOS ──

// Helper: converte a string "id1,id2,id3" salva no banco em array
function parseChannelIds(rawChannelId: string | null | undefined): string[] {
  if (!rawChannelId) return [];
  return rawChannelId.includes(",")
    ? rawChannelId.split(",").map(s => s.trim()).filter(Boolean)
    : [rawChannelId.trim()];
}

// Helper: converte o array de channelIds em string para salvar no banco
function serializeChannelIds(channelIds?: string[], channelId?: string): string | null {
  if (channelIds && channelIds.length > 0) return channelIds.join(",");
  if (channelId) return channelId;
  return null;
}

function isBaseRecipe(produto: Partial<Produto>): boolean {
  return Boolean(produto.isBaseRecipe ?? produto.is_base_recipe);
}

async function getLaborCostPerHourForUser(userId: string): Promise<number> {
  const { data } = await supabase
    .from("user_settings")
    .select("labor_cost_per_hour")
    .eq("user_id", userId)
    .maybeSingle();
  return Number((data as any)?.labor_cost_per_hour ?? 0);
}

async function calculateBaseRecipeUnitCost(produto: Partial<Produto>, userId: string): Promise<number> {
  const ingredients = produto.ingredients ?? [];
  if (ingredients.length === 0) return 0;

  const { data, error } = await supabase
    .from("insumos")
    .select("*")
    .eq("user_id", userId)
    .in("id", ingredients.map((ing) => ing.insumoId));
  if (error) throw error;

  const insumos = (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    type: row.type as Insumo["type"],
    purchasePrice: Number(row.purchase_price),
    packageSize: Number(row.package_size),
    unit: row.unit as Insumo["unit"],
    recipeId: row.recipe_id ?? null,
  }));

  const baseCost = ingredients.reduce((total, ing) => {
    const insumo = insumos.find((item) => item.id === ing.insumoId);
    if (!insumo) return total;
    return total + getUnitPrice(insumo) * ing.quantity;
  }, 0);
  const materialCost = baseCost * (1 + (produto.wastePercent ?? 0) / 100);
  const laborCostPerHour = await getLaborCostPerHourForUser(userId);
  const labor = produto.prepTime && laborCostPerHour > 0
    ? (produto.prepTime / 60) * laborCostPerHour
    : 0;
  const rendimento = produto.rendimento_total && produto.rendimento_total > 0 ? produto.rendimento_total : 1;
  return (materialCost + labor) / rendimento;
}

async function syncBaseRecipeInsumo(produtoId: string, produto: Partial<Produto>, userId: string): Promise<void> {
  if (!isBaseRecipe(produto)) {
    await (supabase as any).from("insumos").delete().eq("recipe_id", produtoId).eq("user_id", userId);
    return;
  }

  const unitCost = await calculateBaseRecipeUnitCost(produto, userId);
  const payload = {
    user_id: userId,
    name: produto.name ?? "Receita Base",
    type: "ingrediente",
    purchase_price: unitCost,
    package_size: 1,
    unit: "un",
    recipe_id: produtoId,
  };

  const { data: existing, error: existingError } = await (supabase as any)
    .from("insumos")
    .select("id")
    .eq("user_id", userId)
    .eq("recipe_id", produtoId)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing?.id) {
    const { error } = await (supabase as any)
      .from("insumos")
      .update(payload)
      .eq("id", existing.id)
      .eq("user_id", userId);
    if (error) throw error;
    return;
  }

  const { error } = await (supabase as any).from("insumos").insert(payload);
  if (error) throw error;
}

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
    // ── CORREÇÃO: reconstruir channelIds a partir do campo channel_id ──
    const channelIds = parseChannelIds(row.channel_id);

    return {
      id: row.id,
      name: row.name,
      ingredients: (compData ?? [])
        .filter((c: any) => c.produto_id === row.id)
        .map((c: any) => ({ insumoId: c.insumo_id, quantity: Number(c.quantity) })),
      sellPrice: row.sell_price != null ? Number(row.sell_price) : undefined,
      wastePercent: row.waste_percent != null ? Number(row.waste_percent) : undefined,
      channelId: channelIds[0] ?? undefined,       // retrocompatibilidade
      channelIds: channelIds,                       // ← array completo dos canais
      desiredMargin: row.desired_margin != null ? Number(row.desired_margin) : undefined,
      prepTime: row.prep_time != null ? Number(row.prep_time) : 0,
      quantidadePadrao: Number(row.quantidade_padrao ?? 0),
      rendimento_total: row.rendimento_total != null ? Number(row.rendimento_total) : 1,
      quantidade_venda: row.quantidade_venda != null ? Number(row.quantidade_venda) : 1,
      isBaseRecipe: Boolean(row.is_base_recipe),
      is_base_recipe: Boolean(row.is_base_recipe),
    };
  });
}

export async function saveProduto(produto: Omit<Produto, "id">): Promise<Produto> {
  const userId = await getAuthenticatedUserId();

  // ── CORREÇÃO: serializar channelIds como string separada por vírgula ──
  const channelIdValue = serializeChannelIds(
    (produto as any).channelIds,
    produto.channelId
  );

  const { data, error } = await (supabase as any).from("produtos")
    .insert({
      user_id: userId,
      name: produto.name,
      sell_price: produto.sellPrice ?? null,
      waste_percent: produto.wastePercent ?? null,
      channel_id: channelIdValue,
      prep_time: (produto as any).prepTime ?? 0,
      quantidade_padrao: (produto as any).quantidadePadrao ?? 0,
      rendimento_total: (produto as any).rendimento_total ?? 1,
      quantidade_venda: (produto as any).quantidade_venda ?? 1,
      desired_margin: (produto as any).desiredMargin ?? 0,
      is_base_recipe: isBaseRecipe(produto),
    })
    .select().single();
  if (error) throw error;

  if (produto.ingredients.length > 0) {
    await supabase.from("composicao_receita").insert(
      produto.ingredients.map((ing) => ({
        produto_id: data.id,
        insumo_id: ing.insumoId,
        quantity: ing.quantity,
      }))
    );
  }
  await syncBaseRecipeInsumo(data.id, { ...produto, isBaseRecipe: isBaseRecipe(produto) }, userId);
  return { id: data.id, ...produto };
}

export async function updateProduto(id: string, produto: Partial<Produto>): Promise<void> {
  const userId = await getAuthenticatedUserId();

  // ── CORREÇÃO: serializar channelIds como string separada por vírgula ──
  const channelIdValue = serializeChannelIds(
    (produto as any).channelIds,
    produto.channelId
  );

  const updateData: any = {
    name: produto.name,
    sell_price: produto.sellPrice ?? null,
    waste_percent: produto.wastePercent ?? null,
    channel_id: channelIdValue,
    prep_time: (produto as any).prepTime,
    quantidade_padrao: (produto as any).quantidadePadrao,
    rendimento_total: (produto as any).rendimento_total,
    quantidade_venda: (produto as any).quantidade_venda,
    desired_margin: (produto as any).desiredMargin,
    is_base_recipe: isBaseRecipe(produto),
  };
  await (supabase as any).from("produtos").update(updateData).eq("id", id).eq("user_id", userId);

  if (produto.ingredients !== undefined) {
    await supabase.from("composicao_receita").delete().eq("produto_id", id);
    if (produto.ingredients.length > 0) {
      await supabase.from("composicao_receita").insert(
        produto.ingredients.map((ing) => ({
          produto_id: id,
          insumo_id: ing.insumoId,
          quantity: ing.quantity,
        }))
      );
    }
  }
  await syncBaseRecipeInsumo(id, { ...produto, isBaseRecipe: isBaseRecipe(produto) }, userId);
}

export async function deleteProduto(id: string): Promise<void> {
  const userId = await getAuthenticatedUserId();
  await (supabase as any).from("insumos").delete().eq("recipe_id", id).eq("user_id", userId);
  await (supabase as any).from("produtos").delete().eq("id", id).eq("user_id", userId);
}

// ── ENCOMENDAS ──

export interface Encomenda {
  id: string; customerName: string; deliveryDate: string; orderDescription: string; extraInsumos: string; createdAt: string; arquivada?: boolean;
}

export async function loadEncomendas(): Promise<Encomenda[]> {
  const userId = await getAuthenticatedUserId();
  const { data, error } = await (supabase.from("encomendas") as any).select("*").eq("user_id", userId).eq("arquivada", false);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id, customerName: row.cliente_nome, deliveryDate: row.data_entrega, orderDescription: row.order_description ?? "", extraInsumos: row.extra_insumos ?? "", createdAt: row.created_at, arquivada: !!row.arquivada,
  }));
}

export async function saveEncomenda(input: Omit<Encomenda, "id" | "createdAt">): Promise<void> {
  const userId = await getAuthenticatedUserId();
  await (supabase.from("encomendas") as any).insert({
    user_id: userId,
    cliente_nome: input.customerName,
    data_entrega: input.deliveryDate,
    order_description: input.orderDescription,
    extra_insumos: input.extraInsumos,
    arquivada: false
  });
}

export async function arquivarEncomenda(id: string): Promise<void> {
  await (supabase as any).from("encomendas").update({ arquivada: true }).eq("id", id);
}

export async function desarquivarEncomenda(id: string): Promise<void> {
  await (supabase as any).from("encomendas").update({ arquivada: false }).eq("id", id);
}

export async function loadEncomendasArquivadas(): Promise<Encomenda[]> {
  const userId = await getAuthenticatedUserId();
  const { data, error } = await (supabase as any).from("encomendas")
    .select("*")
    .eq("user_id", userId)
    .eq("arquivada", true);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id, customerName: row.cliente_nome, deliveryDate: row.data_entrega, orderDescription: row.order_description ?? "", extraInsumos: row.extra_insumos ?? "", createdAt: row.created_at, arquivada: true,
  }));
}

export async function deleteEncomenda(id: string): Promise<void> {
  await (supabase as any).from("encomendas").delete().eq("id", id);
}

// ── GASTOS ADICIONAIS ──

export async function loadGastosMensais(): Promise<Record<string, GastoAdicional[]>> {
  const userId = await getAuthenticatedUserId();
  const { data, error } = await (supabase as any).from("gastos_adicionais").select("*").eq("user_id", userId).order("data_gasto", { ascending: false });
  if (error) return {};
  const grupos: Record<string, GastoAdicional[]> = {};
  (data ?? []).forEach((row: any) => {
    const mesAno = new Date(row.data_gasto).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const chave = mesAno.charAt(0).toUpperCase() + mesAno.slice(1);
    if (!grupos[chave]) grupos[chave] = [];
    grupos[chave].push({ id: row.id, descricao: row.descricao, valor: Number(row.valor), tipo: row.tipo, dataGasto: row.data_gasto });
  });
  return grupos;
}

export async function salvarGasto(gasto: Omit<GastoAdicional, "id">): Promise<void> {
  const userId = await getAuthenticatedUserId();
  await (supabase as any).from("gastos_adicionais").insert({ user_id: userId, ...gasto });
}

export async function deleteGasto(id: string): Promise<void> {
  await (supabase as any).from("gastos_adicionais").delete().eq("id", id);
}

// ── VENDAS ──

export interface Venda { id: string; produtoNome: string; valorVenda: number; lucro: number; dataVenda: string; }

function getNextMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const next = new Date(year, month, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthlySnapshotDate(monthKey: string): string {
  return `${monthKey}-15T12:00:00.000Z`;
}

function getProductChannelTaxPercent(produto: Produto, channels: SalesChannel[]): number {
  const ids = produto.channelIds ?? (produto.channelId ? [produto.channelId] : []);
  return ids.reduce((sum, id) => {
    const channel = channels.find((c) => c.id === id);
    return sum + (channel?.taxPercent ?? 0);
  }, 0);
}

function calculateSaleSnapshot(produto: Produto, insumos: Insumo[], channels: SalesChannel[], laborCostPerHour: number) {
  const quantidadeVendida = produto.quantidadePadrao ?? 0;
  const rendimentoTotal = produto.rendimento_total || 1;
  const quantidadeVenda = produto.quantidade_venda || 1;
  const baseCost = produto.ingredients.reduce((total, ing) => {
    const insumo = insumos.find((i) => i.id === ing.insumoId);
    if (!insumo) return total;
    return total + getUnitPrice(insumo) * ing.quantity;
  }, 0);
  const materialCost = baseCost * (1 + (produto.wastePercent ?? 0) / 100);
  const laborCost = produto.prepTime && laborCostPerHour > 0
    ? (produto.prepTime / 60) * laborCostPerHour
    : 0;
  const custoProducaoTotal = materialCost + laborCost;
  const custoPorVenda = (custoProducaoTotal / rendimentoTotal) * quantidadeVenda;
  const precoVenda = produto.sellPrice || 0;
  const taxaPorVenda = precoVenda * (getProductChannelTaxPercent(produto, channels) / 100);
  const custoTotalPorVenda = custoPorVenda + taxaPorVenda;
  const lucroPorVenda = precoVenda - custoTotalPorVenda;

  return {
    quantidadeVendida,
    valorVenda: precoVenda * quantidadeVendida,
    lucro: lucroPorVenda * quantidadeVendida,
    custoTotal: custoTotalPorVenda * quantidadeVendida,
  };
}

export async function registrarVenda(venda: Omit<Venda, "id" | "dataVenda"> & { produtoId: string; custoTotal?: number }): Promise<void> {
  const userId = await getAuthenticatedUserId();
  const dataVenda = new Date().toISOString();
  const payload = {
    user_id: userId,
    produto_id: venda.produtoId,
    produto_nome: venda.produtoNome,
    valor_venda: venda.valorVenda,
    lucro: venda.lucro,
    data_venda: dataVenda,
  };

  const { error } = await (supabase as any).from("vendas").insert(payload);
  if (!error) return;

  const legacyPayload = {
    user_id: userId,
    cliente_nome: "Venda direta",
    produto_nome: venda.produtoNome,
    valor_venda: venda.valorVenda,
    custo_total: venda.custoTotal ?? venda.valorVenda - venda.lucro,
    lucro: venda.lucro,
    data_venda: dataVenda,
  };

  const { error: legacyError } = await (supabase as any).from("vendas").insert(legacyPayload);
  if (legacyError) throw legacyError;
}

export async function loadVendasHistorico(): Promise<Record<string, Venda[]>> {
  const userId = await getAuthenticatedUserId();
  const { data, error } = await (supabase as any).from("vendas").select("*").eq("user_id", userId).order("data_venda", { ascending: false });
  if (error) {
    console.error("Erro ao carregar histórico de vendas", error);
    return {};
  }
  const grupos: Record<string, Venda[]> = {};
  (data ?? []).forEach((row: any) => {
    const dataObj = new Date(row.data_venda);
    const mesAno = dataObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const chave = mesAno.charAt(0).toUpperCase() + mesAno.slice(1);
    if (!grupos[chave]) grupos[chave] = [];
    grupos[chave].push({ id: row.id, produtoNome: row.produto_nome, valorVenda: Number(row.valor_venda), lucro: Number(row.lucro), dataVenda: row.data_venda });
  });
  return grupos;
}

export async function fecharHistoricoMensalProdutos(
  produtos: Produto[],
  insumos: Insumo[],
  channels: SalesChannel[],
  laborCostPerHour: number,
  monthKey: string
): Promise<void> {
  const userId = await getAuthenticatedUserId();
  const monthStart = `${monthKey}-01T00:00:00.000Z`;
  const nextMonthStart = `${getNextMonthKey(monthKey)}-01T00:00:00.000Z`;
  const dataVenda = getMonthlySnapshotDate(monthKey);

  const { error: deleteError } = await (supabase as any)
    .from("vendas")
    .delete()
    .eq("user_id", userId)
    .gte("data_venda", monthStart)
    .lt("data_venda", nextMonthStart);
  if (deleteError) throw deleteError;

  const snapshots = produtos
    .map((produto) => ({ produto, snapshot: calculateSaleSnapshot(produto, insumos, channels, laborCostPerHour) }))
    .filter(({ snapshot }) => snapshot.quantidadeVendida > 0);

  if (snapshots.length === 0) return;

  const payload = snapshots.map(({ produto, snapshot }) => ({
    user_id: userId,
    produto_id: produto.id,
    produto_nome: `${produto.name} (${snapshot.quantidadeVendida}x)`,
    valor_venda: snapshot.valorVenda,
    lucro: snapshot.lucro,
    data_venda: dataVenda,
  }));

  const { error } = await (supabase as any).from("vendas").insert(payload);
  if (!error) return;

  const legacyPayload = snapshots.map(({ produto, snapshot }) => ({
    user_id: userId,
    cliente_nome: "Fechamento mensal",
    produto_nome: `${produto.name} (${snapshot.quantidadeVendida}x)`,
    valor_venda: snapshot.valorVenda,
    custo_total: snapshot.custoTotal,
    lucro: snapshot.lucro,
    data_venda: dataVenda,
  }));

  const { error: legacyError } = await (supabase as any).from("vendas").insert(legacyPayload);
  if (legacyError) throw legacyError;
}

export async function zerarVendasMensaisProdutos(produtos: Produto[]): Promise<void> {
  const userId = await getAuthenticatedUserId();
  await Promise.all(
    produtos
      .filter((produto) => (produto.quantidadePadrao ?? 0) > 0)
      .map((produto) =>
        (supabase as any)
          .from("produtos")
          .update({ quantidade_padrao: 0 })
          .eq("id", produto.id)
          .eq("user_id", userId)
      )
  );
}

// ── ESTOQUE E CONFIGS ──

export async function loadShoppingStockItems(): Promise<ShoppingStockItem[]> {
  const userId = await getAuthenticatedUserId();
  const { data } = await supabase.from("estoque_compras").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  return (data ?? []).map((row: any) => ({ id: row.id, itemName: row.item_name, checked: row.checked }));
}

export async function saveShoppingStockItem(item: { itemName: string; checked: boolean }) {
  const userId = await getAuthenticatedUserId();
  await supabase.from("estoque_compras").insert([{ user_id: userId, item_name: item.itemName, checked: item.checked }]);
}

export async function toggleShoppingStockItem(id: string, checked: boolean) { 
  await supabase.from("estoque_compras").update({ checked }).eq("id", id); 
}

export async function deleteShoppingStockItem(id: string) { 
  await supabase.from("estoque_compras").delete().eq("id", id); 
}

export async function loadUserSettings() {
  const userId = await getAuthenticatedUserId();
  const { data } = await supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle();
  const row = data as any;
  return { 
    laborCostPerHour: Number(row?.labor_cost_per_hour ?? 0),
    profit_goal: Number(row?.profit_goal ?? 0),
  };
}

export async function saveUserSettings(settings: { 
  laborCostPerHour?: number; 
  profit_goal?: number;
}) {
  const userId = await getAuthenticatedUserId();
  const { data: existing } = await supabase.from("user_settings").select("id").eq("user_id", userId).maybeSingle();

  const payload: any = {};
  if (settings.laborCostPerHour !== undefined) payload.labor_cost_per_hour = settings.laborCostPerHour;
  if (settings.profit_goal !== undefined) payload.profit_goal = settings.profit_goal;

  if (existing) {
    await supabase.from("user_settings").update(payload).eq("id", existing.id);
  } else {
    await supabase.from("user_settings").insert({
      user_id: userId,
      labor_cost_per_hour: settings.laborCostPerHour ?? 0,
      profit_goal: settings.profit_goal ?? 0,
    });
  }
}

// ── SEED (VER EXEMPLOS) ──

export async function seedExampleData(): Promise<void> {
  try {
    const userId = await getAuthenticatedUserId();
    const dataHoje = new Date().toISOString();

    const { data: channel } = await (supabase as any).from("canais_venda").insert([{ user_id: userId, name: "Instagram", tax_percent: 0 }]).select().single();

    const ins1 = await saveInsumo({ name: "Farinha", type: "ingrediente" as any, purchasePrice: 20, packageSize: 5000, unit: "g" });
    const ins2 = await saveInsumo({ name: "Chocolate", type: "ingrediente" as any, purchasePrice: 40, packageSize: 1000, unit: "g" });

    const { data: produto } = await (supabase as any).from("produtos").insert([{ 
      user_id: userId, name: "Bolo de Chocolate Exemplo", sell_price: 100, channel_id: channel?.id,
      rendimento_total: 1, quantidade_venda: 1, prep_time: 60, quantidade_padrao: 1 
    }]).select().single();

    if (produto && ins1.id && ins2.id) {
      await (supabase as any).from("composicao_receita").insert([
        { produto_id: produto.id, insumo_id: ins1.id, quantity: 500 },
        { produto_id: produto.id, insumo_id: ins2.id, quantity: 200 }
      ]);
    }

    await (supabase as any).from("vendas").insert([{ user_id: userId, produto_id: produto?.id, produto_nome: produto?.name, valor_venda: 100, lucro: 60, data_venda: dataHoje }]);
    await (supabase as any).from("gastos_adicionais").insert([{ user_id: userId, descricao: "Energia Exemplo", valor: 50, tipo: "Fixo", data_gasto: dataHoje.split('T')[0] }]);
    await (supabase as any).from("encomendas").insert([{ user_id: userId, cliente_nome: "Exemplo Cliente", data_entrega: dataHoje, order_description: "Bolo Chocolate", arquivada: false }]);
    await (supabase as any).from("estoque_compras").insert([{ user_id: userId, item_name: "Comprar Farinha", checked: false }]);

    window.location.reload();
  } catch (e) { 
    console.error("Erro Seed:", e); 
    alert("Erro ao carregar exemplos. Se a tela voltou, agora tente rodar o comando SQL para liberar as tabelas.");
  }
}
