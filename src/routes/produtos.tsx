import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { 
  Plus, X, Check, Trash2, Pencil,
  FileText, Settings, ChefHat, Clock, TrendingUp, 
  Store, Scale, ShoppingBag, Copy
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/PageHeader";
import { BottomNav } from "@/components/BottomNav";
import type { Insumo, Produto, RecipeIngredient, SalesChannel } from "@/lib/types";
import { getUnitPrice } from "@/lib/types";
import {
  loadInsumos, loadProdutos, saveProduto, updateProduto, deleteProduto,
  loadChannels, saveChannel, deleteChannel, loadUserSettings,
  saveUserSettings, registrarVenda, fecharHistoricoMensalProdutos, zerarVendasMensaisProdutos,
} from "@/lib/store";
import { useAuth } from "@/hooks/use-auth";
import { useApproval } from "@/hooks/use-approval";
import { BlockedScreen } from "@/components/BlockedScreen";
import { ListSkeleton } from "@/components/SkeletonScreens";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/preferences";

export const Route = createFileRoute("/produtos")({
  head: () => ({
    meta: [
      { title: "Receitas — GastroGestão📈" },
      { name: "description", content: "Crie receitas e calcule custos automaticamente" },
    ],
  }),
  component: ProdutosPage,
});

function formatBRL(value: number): string {
  return formatCurrency(value);
}

function calcCustoProducao(
  produto: Produto,
  insumos: Insumo[],
  laborCostPerHour: number = 0
): number {
  const base = produto.ingredients.reduce((total, ing) => {
    const insumo = insumos.find(i => i.id === ing.insumoId);
    return total + (insumo ? getUnitPrice(insumo) * ing.quantity : 0);
  }, 0);
  const material = base * (1 + (produto.wastePercent ?? 0) / 100);
  const labor = produto.prepTime && laborCostPerHour > 0
    ? (produto.prepTime / 60) * laborCostPerHour
    : 0;
  return material + labor;
}

function getTaxaCanal(produto: Produto, channels: SalesChannel[]): number {
  const ids = produto.channelIds ?? (produto.channelId ? [produto.channelId] : []);
  return ids.reduce((sum, id) => {
    const ch = channels.find(c => c.id === id);
    return sum + (ch?.taxPercent ?? 0);
  }, 0);
}

function calcValorTaxa(precoVenda: number, taxaPercent: number): number {
  return precoVenda * (taxaPercent / 100);
}

function getMonthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthlyResetStorageKey(userId: string): string {
  return `gastrogestao:last-sales-month:${userId}`;
}

async function resetMonthlyProductSalesIfNeeded(
  userId: string,
  produtos: Produto[],
  insumos: Insumo[],
  channels: SalesChannel[],
  laborCost: number
): Promise<Produto[]> {
  const currentMonth = getMonthKey();
  const storageKey = getMonthlyResetStorageKey(userId);
  const lastMonth = window.localStorage.getItem(storageKey);

  if (!lastMonth) {
    window.localStorage.setItem(storageKey, currentMonth);
    return produtos;
  }

  if (lastMonth === currentMonth) return produtos;

  await fecharHistoricoMensalProdutos(produtos, insumos, channels, laborCost, lastMonth);
  await zerarVendasMensaisProdutos(produtos);
  window.localStorage.setItem(storageKey, currentMonth);
  toast.info("Novo mês iniciado: o histórico foi gravado e os vendidos foram zerados.");
  return produtos.map((produto) => ({ ...produto, quantidadePadrao: 0 }));
}

function generatePDF(produto: Produto, insumos: Insumo[], channels: SalesChannel[]) {
  const custoProducao = calcCustoProducao(produto, insumos);
  const taxaPercent = getTaxaCanal(produto, channels);
  const precoVenda = produto.sellPrice || 0;
  const valorTaxa = calcValorTaxa(precoVenda, taxaPercent);
  const custoReal = custoProducao + valorTaxa;

  let html = `<html><head><meta charset="utf-8"><title>Ficha Técnica - ${produto.name}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 32px; color: #333; max-width: 600px; margin: 0 auto; background: #faf7f2; }
    h1 { color: #bc834e; border-bottom: 2px solid #bc834e; padding-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; background: white; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
    th { background: #fdfaf7; font-size: 13px; color: #bc834e; }
    .summary-box { padding: 12px; border-radius: 8px; text-align: center; background: #bc834e; color: white; margin-top: 16px; }
    .value { font-size: 20px; font-weight: bold; }
  </style></head><body>`;
  html += `<h1>🧁 Ficha Técnica</h1><h2>${produto.name}</h2>`;
  html += `<table><thead><tr><th>Insumo</th><th>Qtd</th><th>Subtotal</th></tr></thead><tbody>`;
  for (const ing of produto.ingredients) {
    const insumo = insumos.find(i => i.id === ing.insumoId);
    if (!insumo) continue;
    const sub = getUnitPrice(insumo) * ing.quantity;
    html += `<tr><td>${insumo.name}</td><td>${ing.quantity}${insumo.unit}</td><td>${formatBRL(sub)}</td></tr>`;
  }
  html += `</tbody></table>`;
  if (taxaPercent > 0) {
    html += `<p style="font-size:12px;color:#bc834e;font-weight:bold;">Custo produção: ${formatBRL(custoProducao)} + Taxa ${taxaPercent}% s/ venda (${formatBRL(valorTaxa)}) = Custo real: ${formatBRL(custoReal)}</p>`;
  }
  html += `<div class="summary-box"><div>Custo Real (c/ taxas sobre venda)</div><div class="value">${formatBRL(custoReal)}</div></div></body></html>`;
  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 300); }
}

function KitchenMode({ produto, insumos, onClose }: { produto: Produto; insumos: Insumo[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-4">
        <div className="flex items-center gap-2">
          <ChefHat className="h-6 w-6 text-[#bc834e]" />
          <h2 className="text-xl font-bold text-foreground">Modo Preparo</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="h-6 w-6" /></Button>
      </div>
      <div className="flex-1 overflow-auto px-6 py-6">
        <h3 className="mb-6 text-center text-2xl font-bold text-foreground">{produto.name}</h3>
        <div className="space-y-4">
          {produto.ingredients.map(ing => {
            const insumo = insumos.find(i => i.id === ing.insumoId);
            if (!insumo) return null;
            return (
              <div key={ing.insumoId} className="flex items-center justify-between rounded-2xl border border-border bg-card px-6 py-5 shadow-sm">
                <span className="text-xl font-semibold text-foreground">{insumo.name}</span>
                <span className="text-2xl font-bold text-[#bc834e]">{ing.quantity}{insumo.unit}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ProdutosPage() {
  const { user, loading: authLoading } = useAuth();
  const { isApproved, loading: approvalLoading } = useApproval(user?.id);
  const navigate = useNavigate();

  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [channels, setChannels] = useState<SalesChannel[]>([]);
  const [laborCost, setLaborCost] = useState(0);
  const [laborInput, setLaborInput] = useState("");
  
  const [showForm, setShowForm] = useState(false);
  const [showChannelSettings, setShowChannelSettings] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [name, setName] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [wastePercent, setWastePercent] = useState("0");
  const [channelIds, setChannelIds] = useState<string[]>([]);
  const [isBaseRecipe, setIsBaseRecipe] = useState(false);
  const [prepTime, setPrepTime] = useState("");
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [quantidadePadrao, setQuantidadePadrao] = useState("0");
  const [rendimentoTotal, setRendimentoTotal] = useState("1");
  const [quantidadeVenda, setQuantidadeVenda] = useState("1");
  const [margemDesejada, setMargemDesejada] = useState("40");
  
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelTax, setNewChannelTax] = useState("");

  const [kitchenProduto, setKitchenProduto] = useState<Produto | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  async function fetchData() {
    setDataLoading(true);
    try {
      const [i, p, c, s] = await Promise.all([
        loadInsumos(), loadProdutos(), loadChannels(), loadUserSettings()
      ]);
      const produtosDoMes = user ? await resetMonthlyProductSalesIfNeeded(user.id, p, i, c, s.laborCostPerHour) : p;
      setInsumos(i);
      setProdutos(produtosDoMes);
      setChannels(c);
      setLaborCost(s.laborCostPerHour);
      setLaborInput(s.laborCostPerHour > 0 ? String(s.laborCostPerHour) : "");
    } catch (err) { console.error(err); } finally { setDataLoading(false); }
  }

  function resetForm() {
    setName(""); setSellPrice(""); setWastePercent("0"); setChannelIds([]);
    setIsBaseRecipe(false);
    setPrepTime(""); setIngredients([]); setEditingId(null);
    setQuantidadePadrao("0"); setRendimentoTotal("1"); setQuantidadeVenda("1");
    setMargemDesejada("40"); setShowForm(false);
  }

  async function handleSave() {
    if (!name.trim() || ingredients.length === 0) return;
    const qtdNum = parseInt(quantidadePadrao);
    const qtdFinal = isNaN(qtdNum) ? 0 : qtdNum;

    const produtoData = {
      name: name.trim(),
      ingredients,
      sellPrice: parseFloat(sellPrice) || 0,
      wastePercent: parseFloat(wastePercent) || 0,
      channelIds, // Mantenha este, que é o array com todos[cite: 1]
      // REMOVA a linha do channelId: channelIds[0], pois ela força o salvamento de apenas um no banco.
      is_base_recipe: isBaseRecipe,
      isBaseRecipe,
      prepTime: parseFloat(prepTime) || 0,
      quantidadePadrao: qtdFinal,
      rendimento_total: parseFloat(rendimentoTotal) || 1,
      quantidade_venda: parseFloat(quantidadeVenda) || 1,
      desiredMargin: parseFloat(margemDesejada) || 0,
    };
    
    setSaving(true);
    try {
      if (editingId) await updateProduto(editingId, produtoData as any);
      else await saveProduto(produtoData as any);
      toast.success("Receita salva com sucesso!");
      await fetchData();
      resetForm();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar receita.");
    } finally { setSaving(false); }
  }

  function handleDuplicate(produto: Produto) {
    setEditingId(null);
    setName(`${produto.name} (Cópia)`);
    setSellPrice(produto.sellPrice ? String(produto.sellPrice) : "");
    setWastePercent(produto.wastePercent ? String(produto.wastePercent) : "0");
    setChannelIds(produto.channelIds ?? (produto.channelId ? [produto.channelId] : []));
    setIsBaseRecipe(false);
    setPrepTime(produto.prepTime ? String(produto.prepTime) : "");
    setQuantidadePadrao("0");
    setRendimentoTotal(String((produto as any).rendimento_total ?? 1));
    setQuantidadeVenda(String((produto as any).quantidade_venda ?? 1));
    setMargemDesejada(String(produto.desiredMargin ?? (produto as any).desired_margin ?? 40));
    setIngredients([...produto.ingredients]);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast.info("Receita clonada! Ajuste o que precisar e salve.");
  }

  async function handleAddChannel() {
    if (!newChannelName.trim()) return;
    try {
      await saveChannel({ name: newChannelName.trim(), taxPercent: parseFloat(newChannelTax) || 0 });
      setNewChannelName(""); setNewChannelTax("");
      await fetchData();
      toast.success("Canal adicionado!");
    } catch (err) { console.error(err); }
  }

  async function handleDeleteChannel(id: string) {
    if (!confirm("Excluir este canal de venda?")) return;
    try {
      await deleteChannel(id);
      await fetchData();
    } catch (err) { console.error(err); }
  }

  async function handleSaveLaborCost() {
    const nextLaborCost = parseFloat(laborInput) || 0;
    try {
      await saveUserSettings({ laborCostPerHour: nextLaborCost });
      setLaborCost(nextLaborCost);
      toast.success("Custo de mão de obra atualizado!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar custo de mão de obra.");
    }
  }

  function handleEdit(produto: Produto) {
    setEditingId(produto.id);
    setName(produto.name);
    setSellPrice(produto.sellPrice ? String(produto.sellPrice) : "");
    setWastePercent(produto.wastePercent ? String(produto.wastePercent) : "0");
    setChannelIds(produto.channelIds ?? (produto.channelId ? [produto.channelId] : []));
    setIsBaseRecipe(Boolean(produto.isBaseRecipe ?? (produto as any).is_base_recipe));
    setPrepTime(produto.prepTime ? String(produto.prepTime) : "");
    setQuantidadePadrao(String(produto.quantidadePadrao ?? 0));
    setRendimentoTotal(String((produto as any).rendimento_total ?? 1));
    setQuantidadeVenda(String((produto as any).quantidade_venda ?? 1));
    setMargemDesejada(String(produto.desiredMargin ?? (produto as any).desired_margin ?? 40));
    setIngredients([...produto.ingredients]);
    setShowForm(true);
  }

  async function handleQuickQtySave(produto: Produto, val: string) {
    const newQty = val === "" ? 0 : parseInt(val);
    if (isNaN(newQty)) return;
    const currentQty = produto.quantidadePadrao ?? 0;
    const delta = newQty - currentQty;
    try {
      setProdutos(prev => prev.map(p => p.id === produto.id ? { ...p, quantidadePadrao: newQty } : p));
      await updateProduto(produto.id, { ...produto, quantidadePadrao: newQty } as any);
      if (delta !== 0) {
        const rend = (produto as any).rendimento_total || 1;
        const qtdV = (produto as any).quantidade_venda || 1;
        const custoProducaoTotal = calcCustoProducao(produto, insumos, laborCost);
        const custoProducaoPorVenda = (custoProducaoTotal / rend) * qtdV;
        const taxaPercent = getTaxaCanal(produto, channels);
        const vendaUnit = produto.sellPrice || 0;
        const custoPorVenda = custoProducaoPorVenda + calcValorTaxa(vendaUnit, taxaPercent);
        const lucroUnitarioReal = vendaUnit - custoPorVenda;

        await registrarVenda({
          produtoId: produto.id,
          produtoNome: produto.name,
          valorVenda: vendaUnit * delta,
          lucro: lucroUnitarioReal * delta,
          custoTotal: custoPorVenda * delta,
        });
        toast.success(delta > 0 ? "Venda registrada no Dashboard!" : "Ajuste removido do Dashboard!");
      }
    } catch (err) {
      console.error(err);
      toast.error("Quantidade atualizada, mas não consegui registrar no histórico.");
      fetchData();
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir receita?")) return;
    await deleteProduto(id);
    await fetchData();
  }

  const formCustoProducao = useMemo(() => {
    const base = ingredients.reduce((total, ing) => {
      const insumo = insumos.find(i => i.id === ing.insumoId);
      return total + (insumo ? getUnitPrice(insumo) * ing.quantity : 0);
    }, 0);
    const material = base * (1 + (parseFloat(wastePercent) || 0) / 100);
    const labor = ((parseFloat(prepTime) || 0) / 60) * laborCost;
    return material + labor;
  }, [ingredients, wastePercent, prepTime, laborCost, insumos]);

  const taxaTotalForm = useMemo(() => {
    return channelIds.reduce((sum, id) => {
      const ch = channels.find(c => c.id === id);
      return sum + (ch?.taxPercent ?? 0);
    }, 0);
  }, [channelIds, channels]);

  const custoPorVendaProducao = useMemo(() => {
    return (formCustoProducao / (parseFloat(rendimentoTotal) || 1)) * (parseFloat(quantidadeVenda) || 1);
  }, [formCustoProducao, rendimentoTotal, quantidadeVenda]);

  const custoPorVendaReal = useMemo(() => {
    const precoVenda = parseFloat(sellPrice) || 0;
    return custoPorVendaProducao + calcValorTaxa(precoVenda, taxaTotalForm);
  }, [custoPorVendaProducao, taxaTotalForm, sellPrice]);

  if (kitchenProduto) return <KitchenMode produto={kitchenProduto} insumos={insumos} onClose={() => setKitchenProduto(null)} />;
  if (authLoading || approvalLoading || dataLoading || !user) return <ListSkeleton />;
  if (isApproved === false) return <BlockedScreen />;

  return (
    <div className="min-h-screen bg-background pb-24 text-foreground font-sans">
      <PageHeader title="Receitas" subtitle={`${produtos.length} receitas cadastradas`}
        action={!showForm && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowChannelSettings(!showChannelSettings)} className="border-[#bc834e] text-[#bc834e]">
              <Settings className={cn("h-4 w-4 transition-transform", showChannelSettings && "rotate-90")} />
            </Button>
            <Button size="sm" onClick={() => { setShowForm(true); setShowChannelSettings(false); }} className="bg-[#bc834e] hover:bg-[#a67243] text-white font-bold">
              <Plus className="h-4 w-4 mr-1" /> Nova
            </Button>
          </div>
        )}
      />

      {showChannelSettings && !showForm && (
        <div className="mx-4 mb-6 rounded-3xl border border-[#bc834e]/30 bg-[#bc834e]/5 p-5 shadow-inner animate-in slide-in-from-top duration-300">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2 text-[#bc834e]">
              <Store size={18} />
              <h2 className="font-bold uppercase text-xs tracking-widest">Custos, Taxas e Canais</h2>
            </div>
            <X size={20} className="text-muted-foreground cursor-pointer" onClick={() => setShowChannelSettings(false)} />
          </div>
          <div className="mb-5 rounded-2xl border border-[#bc834e]/10 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-black uppercase text-[#bc834e] tracking-widest mb-2">Custo Mão de Obra/Hora</p>
            <div className="flex gap-2">
              <Input
                type="number"
                min="0"
                value={laborInput}
                onChange={(e) => setLaborInput(e.target.value)}
                placeholder="Ex: 25"
                className="h-10 bg-white border-[#bc834e]/20"
              />
              <Button onClick={handleSaveLaborCost} className="bg-[#bc834e] text-white h-10 px-4 font-bold">
                Salvar
              </Button>
            </div>
          </div>
          <div className="space-y-3 mb-5">
            {channels.map(ch => (
              <div key={ch.id} className="flex justify-between items-center bg-white p-3 rounded-2xl border border-[#bc834e]/10 shadow-sm">
                <div>
                  <p className="font-bold text-sm text-foreground">{ch.name}</p>
                  <p className="text-[10px] font-bold text-[#bc834e] uppercase">Taxa: {ch.taxPercent}%</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleDeleteChannel(ch.id)} className="text-destructive hover:bg-red-50">
                  <Trash2 size={16} />
                </Button>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-2">
            <p className="text-[10px] font-black uppercase text-[#bc834e] tracking-widest ml-1">Novo Canal</p>
            <div className="flex gap-2">
              <Input placeholder="Ex: iFood" value={newChannelName} onChange={e => setNewChannelName(e.target.value)} className="h-10 bg-white" />
              <Input placeholder="Taxa %" type="number" value={newChannelTax} onChange={e => setNewChannelTax(e.target.value)} className="h-10 bg-white w-24" />
              <Button onClick={handleAddChannel} className="bg-[#bc834e] text-white h-10 px-4"><Plus size={20} /></Button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="mx-4 mb-6 rounded-3xl border border-[#bc834e]/20 bg-card p-5 shadow-lg animate-in fade-in zoom-in-95">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-[#bc834e]">Configurar Receita</h2>
            <X onClick={resetForm} className="cursor-pointer text-muted-foreground"/>
          </div>

          <p className="text-[10px] font-black uppercase text-[#bc834e] mb-1 tracking-widest">Identificação</p>
          <Input
            placeholder="Nome da receita"
            value={name}
            onChange={e => setName(e.target.value)}
            className="mb-4 h-11 border-[#bc834e]/20 focus-visible:ring-[#bc834e]"
          />

          <label className="mb-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-[#bc834e]/20 bg-[#bc834e]/5 p-4 transition-all hover:bg-[#bc834e]/10">
            <Checkbox
              checked={isBaseRecipe}
              onCheckedChange={(checked) => setIsBaseRecipe(checked === true)}
              className="mt-0.5 border-[#bc834e]/50 data-[state=checked]:bg-[#bc834e] data-[state=checked]:text-white"
            />
            <span className="flex-1">
              <span className="block text-sm font-black text-slate-900">Transformar em Insumo Base?</span>
              <span className="mt-1 block text-xs font-medium leading-relaxed text-muted-foreground">
                Permite utilizar esta receita como ingrediente em outras produções.
              </span>
            </span>
          </label>

          <div className="space-y-2 mb-4">
            <p className="text-[10px] font-black uppercase text-[#bc834e] tracking-widest">Ingredientes da Receita</p>
            {ingredients.map(ing => {
              const insumo = insumos.find(i => i.id === ing.insumoId);
              return (
                <div key={ing.insumoId} className="flex items-center gap-2 bg-white p-2 rounded-xl border border-[#bc834e]/10 shadow-sm">
                  <span className="flex-1 text-xs font-bold text-foreground truncate">{insumo?.name}</span>
                  <Input
                    type="number"
                    value={ing.quantity || ""}
                    onChange={e => setIngredients(ingredients.map(i => i.insumoId === ing.insumoId ? {...i, quantity: parseFloat(e.target.value) || 0} : i))}
                    className="w-16 h-8 text-center text-xs p-0 border-[#bc834e]/20"
                  />
                  <span className="text-[10px] font-bold text-muted-foreground w-6">{insumo?.unit}</span>
                  <X className="h-4 w-4 text-destructive cursor-pointer hover:scale-110 transition-transform" onClick={() => setIngredients(ingredients.filter(i => i.insumoId !== ing.insumoId))}/>
                </div>
              );
            })}
            <div className="flex flex-wrap gap-2 mt-3">
              {insumos
                .filter(i => !editingId || i.recipeId !== editingId)
                .filter(i => !ingredients.find(ing => ing.insumoId === i.id))
                .map(i => (
                <Button
                  key={i.id}
                  variant="outline"
                  size="sm"
                  className="h-7 text-[10px] border-[#bc834e]/30 text-[#bc834e] hover:bg-[#bc834e]/5"
                  onClick={() => setIngredients([...ingredients, {insumoId: i.id, quantity: 0}])}
                >
                  + {i.name}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <p className="text-[10px] font-black uppercase text-[#bc834e] mb-1 tracking-widest leading-none flex gap-1 items-center">
                <Scale size={10}/> Rende em UNIDADES
              </p>
              <Input type="number" min="0" value={rendimentoTotal} onChange={e => setRendimentoTotal(e.target.value)} className="h-10 border-[#bc834e]/20" placeholder="Ex: 1500" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-[#bc834e] mb-1 tracking-widest leading-none flex gap-1 items-center">
                <ShoppingBag size={10}/> Qtd Venda (Pacote/Cento/Un)
              </p>
              <Input type="number" min="0" value={quantidadeVenda} onChange={e => setQuantidadeVenda(e.target.value)} className="h-10 border-[#bc834e]/20" placeholder="Ex: 100" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <p className="text-[10px] font-black uppercase text-[#bc834e] mb-1 tracking-widest leading-none">Preparo em minutos</p>
              <Input type="number" value={prepTime} onChange={e => setPrepTime(e.target.value)} className="h-10 border-[#bc834e]/20" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-[#bc834e] mb-1 tracking-widest leading-none">Desperdício (%)</p>
              <Input type="number" placeholder="Ex: 5" value={wastePercent} onChange={e => setWastePercent(e.target.value)} className="h-10 border-[#bc834e]/20" />
            </div>
          </div>

          {/* ── CANAIS DE VENDA ── */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-black uppercase text-[#bc834e] tracking-widest flex items-center gap-1">
                <Store size={10}/> Canais de Venda
              </p>
              {taxaTotalForm > 0 && (
                <span className="text-[10px] font-black text-white bg-[#bc834e] px-2 py-0.5 rounded-full">
                  Taxa total: {taxaTotalForm}%
                </span>
              )}
            </div>
            {channels.length === 0 ? (
              <p className="text-xs text-muted-foreground italic px-1">
                Nenhum canal cadastrado. Adicione em ⚙️ Configurações.
              </p>
            ) : (
              <div className="space-y-2">
                {channels.map(ch => {
                  const checked = channelIds.includes(ch.id);
                  return (
                    // ── CORREÇÃO: onClick no label inteiro para garantir o toggle ──
                    <div
                      key={ch.id}
                      onClick={() => setChannelIds(prev =>
                        prev.includes(ch.id)
                          ? prev.filter(id => id !== ch.id)
                          : [...prev, ch.id]
                      )}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all select-none",
                        checked
                          ? "border-[#bc834e] bg-[#bc834e]/10 shadow-sm"
                          : "border-[#bc834e]/20 bg-white hover:bg-[#bc834e]/5"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-4 h-4 rounded border-2 flex items-center justify-center transition-colors shrink-0",
                          checked ? "bg-[#bc834e] border-[#bc834e]" : "border-[#bc834e]/40"
                        )}>
                          {checked && <Check size={10} className="text-white" strokeWidth={3} />}
                        </div>
                        <span className="text-sm font-bold text-foreground">{ch.name}</span>
                      </div>
                      <span className="text-[10px] font-black text-[#bc834e] uppercase bg-[#bc834e]/10 px-2 py-0.5 rounded-full">
                        {ch.taxPercent}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── CUSTO REAL DO PACOTE ── */}
          <div className="bg-[#bc834e]/10 p-4 rounded-2xl text-center mb-4 border border-[#bc834e]/20 shadow-inner">
            <p className="text-[10px] text-[#bc834e] uppercase font-black tracking-widest">
              Custo Real do Pacote/Cento/Unidade ({quantidadeVenda} un){taxaTotalForm > 0 ? ` c/ taxa ${taxaTotalForm}% s/ venda` : ""}
            </p>
            <p className="text-2xl font-black text-[#bc834e]">{formatBRL(custoPorVendaReal)}</p>
            {taxaTotalForm > 0 && (
              <p className="text-[8px] font-bold text-slate-400 mt-1 uppercase">
                Produção: {formatBRL(custoPorVendaProducao)} + Taxa s/ venda: {formatBRL(calcValorTaxa(parseFloat(sellPrice) || 0, taxaTotalForm))}
              </p>
            )}
            {taxaTotalForm === 0 && (
              <p className="text-[8px] font-bold text-slate-400 mt-1 uppercase">
                Custo total da receita: {formatBRL(formCustoProducao)}
              </p>
            )}
          </div>

          <p className="text-[10px] font-black uppercase text-[#bc834e] mb-1 tracking-widest">
            Preço de Venda do Pacote/Cento/Unidade
          </p>
          <Input
            placeholder="R$ 0,00"
            value={sellPrice}
            onChange={e => setSellPrice(e.target.value)}
            className="h-11 mb-5 border-[#bc834e]/20 font-bold text-lg shadow-sm"
          />
          <Button
            className="w-full h-12 rounded-2xl font-black bg-[#bc834e] hover:bg-[#a67243] text-white shadow-lg transition-all"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Processando..." : editingId ? "Atualizar Receita" : "Gravar Receita"}
          </Button>
        </div>
      )}

      {/* ── LISTA DE PRODUTOS ── */}
      <div className="px-4 space-y-6">
        {produtos.map(produto => {
          const qtyAcumulada = produto.quantidadePadrao ?? 0;
          const rend = (produto as any).rendimento_total || 1;
          const qtdV = (produto as any).quantidade_venda || 1;

          const custoProducaoTotal = calcCustoProducao(produto, insumos, laborCost);
          const custoProducaoPorVenda = (custoProducaoTotal / rend) * qtdV;
          const taxaPercent = getTaxaCanal(produto, channels);
          const vendaUnit = produto.sellPrice || 0;
          const valorTaxa = calcValorTaxa(vendaUnit, taxaPercent);
          const custoPorVenda = custoProducaoPorVenda + valorTaxa;
          const lucroUnitarioReal = vendaUnit - custoPorVenda;
          const lucroTotalAcumulado = lucroUnitarioReal * qtyAcumulada;
          const netMargin = vendaUnit > 0 ? (lucroUnitarioReal / vendaUnit) * 100 : null;
          const marginColors = netMargin !== null
            ? { bg: netMargin >= 40 ? "bg-green-600" : netMargin >= 20 ? "bg-orange-500" : "bg-red-600", text: "text-white" }
            : null;

          const produtoChannelIds = produto.channelIds ?? (produto.channelId ? [produto.channelId] : []);
          const channelNames = channels
            .filter(c => produtoChannelIds.includes(c.id))
            .map(c => `${c.name} (${c.taxPercent}%)`)
            .join(" + ");

          return (
            <div
              key={produto.id}
              className={cn(
                "rounded-3xl border bg-card overflow-hidden shadow-md transition-all",
                qtyAcumulada === 0
                  ? "opacity-60 grayscale-[0.5] border-dashed border-muted-foreground/40 bg-muted/5"
                  : "border-[#bc834e]/20"
              )}
            >
              <div className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-xl font-black text-foreground leading-tight tracking-tight">{produto.name}</h3>
                      {netMargin !== null && marginColors && (
                        <span className={cn("text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-tighter shadow-sm", marginColors.bg, marginColors.text)}>
                          {netMargin.toFixed(0)}% margem
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock size={10} className="text-[#bc834e]" />
                      <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest leading-none">
                        {produto.prepTime || 0} MIN • Faz {rend} • Vende {qtdV} un
                      </p>
                    </div>
                    <p className="text-[9px] text-muted-foreground uppercase font-bold mt-1 tracking-widest opacity-70">
                      {produto.ingredients.length} itens
                      {taxaPercent > 0 && ` • Taxa: ${channelNames}`}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 ml-4 shrink-0">
                    <span className="text-[10px] font-black text-[#bc834e] uppercase tracking-tighter">Vendidos</span>
                    <div className="bg-[#bc834e]/10 rounded-xl p-1 border border-[#bc834e]/20 flex items-center shadow-inner">
                      <Input
                        type="number"
                        min="0"
                        value={qtyAcumulada}
                        onChange={e => handleQuickQtySave(produto, e.target.value)}
                        className="w-10 h-7 text-center font-black bg-transparent border-none p-0 focus-visible:ring-0 text-xs text-[#bc834e]"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-orange-50 p-3 rounded-2xl text-center border border-orange-100/50 shadow-sm">
                    <p className="text-[9px] font-black text-orange-600 uppercase tracking-widest leading-none mb-1">
                      Custo {qtdV}un{taxaPercent > 0 ? ` c/ taxa s/ venda` : ""}
                    </p>
                    <div className="flex items-center justify-center gap-1 flex-wrap">
                      <p className="text-base font-black text-orange-700">{formatBRL(custoPorVenda)}</p>
                      {qtyAcumulada > 1 && (
                        <span className="text-[10px] font-bold text-orange-400">({formatBRL(custoPorVenda * qtyAcumulada)})</span>
                      )}
                    </div>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-2xl text-center border border-blue-100/50 shadow-sm">
                    <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest leading-none mb-1">
                      Venda Pacote/Cento/Unidade
                    </p>
                    <div className="flex items-center justify-center gap-1 flex-wrap">
                      <p className="text-base font-black text-blue-700">{formatBRL(vendaUnit)}</p>
                      {qtyAcumulada > 1 && (
                        <span className="text-[10px] font-bold text-blue-400">({formatBRL(vendaUnit * qtyAcumulada)})</span>
                      )}
                    </div>
                  </div>
                  <div className={cn(
                    "p-4 rounded-2xl text-center col-span-2 border shadow-sm transition-colors",
                    qtyAcumulada === 0 ? "bg-muted/40 border-muted-foreground/10" : "bg-green-50 border-green-100"
                  )}>
                    <p className={cn(
                      "text-[9px] font-black uppercase flex items-center justify-center gap-1 tracking-widest",
                      qtyAcumulada === 0 ? "text-muted-foreground" : "text-green-600"
                    )}>
                      <TrendingUp className="h-3 w-3"/> Lucro Líquido Real ({qtyAcumulada}x)
                    </p>
                    <p className={cn("text-2xl font-black", qtyAcumulada === 0 ? "text-muted-foreground" : "text-green-700")}>
                      {formatBRL(qtyAcumulada === 0 ? lucroUnitarioReal : lucroTotalAcumulado)}
                    </p>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-[#bc834e]/10">
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-[#bc834e]" onClick={() => setKitchenProduto(produto)} title="Modo Preparo">
                      <ChefHat className="h-4 w-4"/>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-[#bc834e]" onClick={() => generatePDF(produto, insumos, channels)} title="Ficha Técnica">
                      <FileText className="h-4 w-4"/>
                    </Button>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-blue-400 hover:bg-blue-50 rounded-full" onClick={() => handleDuplicate(produto)} title="Duplicar">
                      <Copy className="h-4 w-4"/>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-[#bc834e] hover:bg-[#bc834e]/10 rounded-full" onClick={() => handleEdit(produto)} title="Editar">
                      <Pencil className="h-4 w-4"/>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:bg-destructive/10 rounded-full" onClick={() => handleDelete(produto.id)} title="Excluir">
                      <Trash2 className="h-4 w-4"/>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <BottomNav />
    </div>
  );
}
