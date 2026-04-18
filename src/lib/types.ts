export type Unit = "g" | "ml" | "un";
export type InsumoType = "ingrediente" | "embalagem";

export interface Insumo {
  id: string;
  name: string;
  type: InsumoType;
  purchasePrice: number;
  packageSize: number;
  unit: Unit;
  /** @deprecated old format */
  price?: number;
}

/** Preço por unidade mínima (g, ml ou un) */
export function getUnitPrice(insumo: Insumo): number {
  if (insumo.purchasePrice != null && insumo.packageSize) {
    return insumo.purchasePrice / insumo.packageSize;
  }
  return insumo.price ?? 0;
}

/** Migra unidades antigas (kg→g, L→ml) */
export function migrateInsumo(insumo: Insumo): Insumo {
  const raw = insumo as unknown as Record<string, unknown>;
  if (raw.unit === "kg") {
    return {
      ...insumo,
      unit: "g",
      packageSize: (insumo.packageSize ?? 1) * 1000,
      purchasePrice: insumo.purchasePrice ?? (insumo.price ?? 0),
    };
  }
  if (raw.unit === "L") {
    return {
      ...insumo,
      unit: "ml",
      packageSize: (insumo.packageSize ?? 1) * 1000,
      purchasePrice: insumo.purchasePrice ?? (insumo.price ?? 0),
    };
  }
  if (insumo.purchasePrice == null && insumo.price != null) {
    return { ...insumo, type: insumo.type ?? "ingrediente", purchasePrice: insumo.price, packageSize: insumo.packageSize ?? 1 };
  }
  return { ...insumo, type: insumo.type ?? "ingrediente" };
}

export interface SalesChannel {
  id: string;
  name: string;
  taxPercent: number; // % de taxa do canal
}

export interface RecipeIngredient {
  insumoId: string;
  quantity: number;
}

export interface Produto {
  id: string;
  name: string;
  ingredients: RecipeIngredient[];
  sellPrice?: number;
  wastePercent?: number;
  channelId?: string;
  desiredMargin?: number;
  prepTime?: number; // tempo de preparo em minutos
  quantidadePadrao?: number; // ADICIONE ESTA LINHA AQUI
}

/** Calcula preço de venda sugerido baseado no custo e margem desejada */
export function calculateSuggestedPrice(
  cost: number,
  desiredMarginPercent: number,
  channelTaxPercent: number = 0
): number {
  if (desiredMarginPercent >= 100) return 0;
  const divisor = 1 - desiredMarginPercent / 100 - channelTaxPercent / 100;
  if (divisor <= 0) return 0;
  return cost / divisor;
}

/** Calcula custo de produção incluindo mão de obra */
export function calculateProductCost(
  produto: Produto,
  insumos: Insumo[],
  laborCostPerHour: number = 0
): number {
  const baseCost = produto.ingredients.reduce((total, ing) => {
    const insumo = insumos.find((i) => i.id === ing.insumoId);
    if (!insumo) return total;
    return total + getUnitPrice(insumo) * ing.quantity;
  }, 0);
  const waste = produto.wastePercent ?? 0;
  const materialCost = baseCost * (1 + waste / 100);
  const laborCost = produto.prepTime && laborCostPerHour > 0
    ? (produto.prepTime / 60) * laborCostPerHour
    : 0;
  return materialCost + laborCost;
}

/** Lucro líquido real: Venda - Custo - Taxa do canal */
export function calculateNetProfit(
  cost: number,
  sellPrice: number,
  channelTaxPercent: number
): number {
  const channelTax = sellPrice * (channelTaxPercent / 100);
  return sellPrice - cost - channelTax;
}

/** Margem líquida real */
export function calculateNetMargin(
  cost: number,
  sellPrice: number,
  channelTaxPercent: number
): number {
  if (sellPrice <= 0) return 0;
  const netProfit = calculateNetProfit(cost, sellPrice, channelTaxPercent);
  return (netProfit / sellPrice) * 100;
}

export function calculateMargin(cost: number, sellPrice: number): number {
  if (sellPrice <= 0) return 0;
  return ((sellPrice - cost) / sellPrice) * 100;
}

export function calculateProfit(cost: number, sellPrice: number): number {
  return sellPrice - cost;
}

/** Retorna classe de cor baseada na margem */
export function getMarginColor(margin: number): {
  bg: string;
  text: string;
} {
  if (margin >= 30) return { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400" };
  if (margin >= 15) return { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-400" };
  return { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-600 dark:text-red-400" };
}

/** Calcula contribuição de custo de cada insumo em todas receitas */
export function getTopCostInsumos(
  produtos: Produto[],
  insumos: Insumo[],
  top = 3
): { insumo: Insumo; totalCost: number }[] {
  const costMap = new Map<string, number>();

  for (const produto of produtos) {
    for (const ing of produto.ingredients) {
      const insumo = insumos.find((i) => i.id === ing.insumoId);
      if (!insumo) continue;
      const cost = getUnitPrice(insumo) * ing.quantity;
      costMap.set(ing.insumoId, (costMap.get(ing.insumoId) ?? 0) + cost);
    }
  }

  return Array.from(costMap.entries())
    .map(([id, totalCost]) => ({
      insumo: insumos.find((i) => i.id === id)!,
      totalCost,
    }))
    .filter((x) => x.insumo)
    .sort((a, b) => b.totalCost - a.totalCost)
    .slice(0, top);
}
