import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { Plus, X, Check, Trash2, Pencil, CakeSlice, FileText, Settings, ChefHat, Clock, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/PageHeader";
import { BottomNav } from "@/components/BottomNav";
import type { Insumo, Produto, RecipeIngredient, SalesChannel } from "@/lib/types";
import {
  calculateProductCost, calculateNetProfit, calculateNetMargin,
  calculateSuggestedPrice, getUnitPrice, getMarginColor,
} from "@/lib/types";
import {
  loadInsumos, loadProdutos, saveProduto, updateProduto, deleteProduto,
  loadChannels, saveChannel, deleteChannel, loadUserSettings,
} from "@/lib/store";
import { useAuth } from "@/hooks/use-auth";
import { useApproval } from "@/hooks/use-approval";
import { BlockedScreen } from "@/components/BlockedScreen";
import { ListSkeleton } from "@/components/SkeletonScreens";
import { cn } from "@/lib/utils";

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
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ── FUNÇÃO DE PDF ──
function generatePDF(produto: Produto, insumos: Insumo[], channels: SalesChannel[]) {
  const cost = calculateProductCost(produto, insumos);
  const channel = channels.find((c) => c.id === produto.channelId);
  const channelTax = channel?.taxPercent ?? 0;

  let html = `<html><head><meta charset="utf-8"><title>Ficha Técnica - ${produto.name}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 32px; color: #333; max-width: 600px; margin: 0 auto; }
    h1 { color: #7c3aed; border-bottom: 2px solid #7c3aed; padding-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
    th { background: #f3f4f6; font-size: 13px; }
    .summary { display: flex; gap: 16px; margin-top: 16px; }
    .summary-box { flex: 1; padding: 12px; border-radius: 8px; text-align: center; }
    .cost-box { background: #ede9fe; }
    .sell-box { background: #f3f4f6; }
    .profit-box { background: #d1fae5; }
    .label { font-size: 11px; color: #666; }
    .value { font-size: 18px; font-weight: bold; }
    .footer { margin-top: 24px; font-size: 11px; color: #999; text-align: center; }
  </style></head><body>`;
  html += `<h1>🧁 Ficha Técnica</h1><h2>${produto.name}</h2>`;
  html += `<table><thead><tr><th>Insumo</th><th>Qtd</th><th>Custo Unit.</th><th>Subtotal</th></tr></thead><tbody>`;
  for (const ing of produto.ingredients) {
    const insumo = insumos.find((i) => i.id === ing.insumoId);
    if (!insumo) continue;
    const up = getUnitPrice(insumo);
    const sub = up * ing.quantity;
    html += `<tr><td>${insumo.name}</td><td>${ing.quantity}${insumo.unit}</td><td>${formatBRL(up)}/${insumo.unit}</td><td>${formatBRL(sub)}</td></tr>`;
  }
  html += `</tbody></table>`;
  html += `<div class="summary">`;
  html += `<div class="summary-box cost-box"><div class="label">Custo Unitário</div><div class="value">${formatBRL(cost)}</div></div>`;
  html += `</div></body></html>`;
  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 300); }
}

// ── MODO PREPARO ──
function KitchenMode({ produto, insumos, onClose }: { produto: Produto; insumos: Insumo[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-4">
        <div className="flex items-center gap-2">
          <ChefHat className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-bold text-foreground">Modo Preparo</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="h-6 w-6" /></Button>
      </div>
      <div className="flex-1 overflow-auto px-6 py-6">
        <h3 className="mb-6 text-center text-2xl font-bold text-foreground">{produto.name}</h3>
        <div className="space-y-4">
          {produto.ingredients.map((ing) => {
            const insumo = insumos.find((i) => i.id === ing.insumoId);
            if (!insumo) return null;
            return (
              <div key={ing.insumoId} className="flex items-center justify-between rounded-2xl border border-border bg-card px-6 py-5 shadow-sm">
                <span className="text-xl font-semibold text-foreground">{insumo.name}</span>
                <span className="text-2xl font-bold text-primary">{ing.quantity}{insumo.unit}</span>
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
  const [showForm, setShowForm] = useState(false);
  const [showChannelForm, setShowChannelForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [name, setName] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [wastePercent, setWastePercent] = useState("");
  const [channelId, setChannelId] = useState("");
  const [desiredMargin, setDesiredMargin] = useState("");
  const [prepTime, setPrepTime] = useState("");
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [quantidadePadrao, setQuantidadePadrao] = useState("1"); // ESTADO NOVO PARA O FORMULÁRIO
  const [kitchenProduto, setKitchenProduto] = useState<Produto | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelTax, setNewChannelTax] = useState("");

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user]);

  async function fetchData() {
    setDataLoading(true);
    try {
      const [i, p, c, s] = await Promise.all([loadInsumos(), loadProdutos(), loadChannels(), loadUserSettings()]);
      setInsumos(i);
      setProdutos(p);
      setChannels(c);
      setLaborCost(s.laborCostPerHour);
    } catch (err) { console.error(err); } finally { setDataLoading(false); }
  }

  function resetForm() {
    setName(""); setSellPrice(""); setWastePercent(""); setChannelId("");
    setDesiredMargin(""); setPrepTime(""); setIngredients([]); setEditingId(null); 
    setQuantidadePadrao("1"); setShowForm(false);
  }

  async function handleSave() {
    if (!name.trim() || ingredients.length === 0) return;
    const produtoData = {
      name: name.trim(), 
      ingredients,
      sellPrice: parseFloat(sellPrice) || undefined,
      wastePercent: parseFloat(wastePercent) || undefined,
      channelId: channelId || undefined,
      desiredMargin: parseFloat(desiredMargin) || undefined,
      prepTime: parseFloat(prepTime) || undefined,
      quantidadePadrao: parseInt(quantidadePadrao) || 1, // SALVANDO NO BANCO
    };
    setSaving(true);
    try {
      if (editingId) await updateProduto(editingId, produtoData);
      else await saveProduto(produtoData);
      await fetchData();
      resetForm();
    } catch (err) { console.error(err); } finally { setSaving(false); }
  }

  function handleEdit(produto: Produto) {
    setEditingId(produto.id); 
    setName(produto.name);
    setSellPrice(produto.sellPrice ? String(produto.sellPrice) : "");
    setWastePercent(produto.wastePercent ? String(produto.wastePercent) : "");
    setChannelId(produto.channelId ?? "");
    setDesiredMargin(produto.desiredMargin ? String(produto.desiredMargin) : "");
    setPrepTime(produto.prepTime ? String(produto.prepTime) : "");
    setQuantidadePadrao(String(produto.quantidadePadrao || 1)); // CARREGANDO PARA O FORMULÁRIO
    setIngredients([...produto.ingredients]); 
    setShowForm(true);
  }

  // Função para salvar a quantidade rapidamente pelo card
  async function handleQuickQtySave(produto: Produto, newQty: number) {
    try {
      await updateProduto(produto.id, { ...produto, quantidadePadrao: newQty });
      await fetchData();
    } catch (err) { console.error(err); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir receita?")) return;
    await deleteProduto(id);
    await fetchData();
  }

  async function handleAddChannel() {
    if (!newChannelName.trim()) return;
    await saveChannel({ name: newChannelName.trim(), taxPercent: parseFloat(newChannelTax) || 0 });
    await fetchData();
    setNewChannelName(""); setNewChannelTax(""); setShowChannelForm(false);
  }

  const availableInsumos = insumos.filter(i => !ingredients.find(ing => ing.insumoId === i.id));
  
  const formCost = useMemo(() => {
    const base = ingredients.reduce((total, ing) => {
      const insumo = insumos.find(i => i.id === ing.insumoId);
      return total + (insumo ? getUnitPrice(insumo) * ing.quantity : 0);
    }, 0);
    const material = base * (1 + (parseFloat(wastePercent) || 0) / 100);
    const labor = ((parseFloat(prepTime) || 0) / 60) * laborCost;
    return material + labor;
  }, [ingredients, wastePercent, prepTime, laborCost, insumos]);

  if (kitchenProduto) return <KitchenMode produto={kitchenProduto} insumos={insumos} onClose={() => setKitchenProduto(null)} />;
  if (authLoading || approvalLoading || dataLoading || !user) return <ListSkeleton />;
  if (isApproved === false) return <BlockedScreen />;

  return (
    <div className="min-h-screen bg-background pb-24 text-foreground">
      <PageHeader title="Receitas" subtitle={`${produtos.length} receitas`}
        action={!showForm && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowChannelForm(!showChannelForm)}><Settings className="h-4 w-4" /></Button>
            <Button size="sm" onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> Nova</Button>
          </div>
        )}
      />

      {/* CANAIS DE VENDA */}
      {showChannelForm && !showForm && (
        <div className="mx-4 mb-4 rounded-2xl border bg-card p-4 shadow-sm">
           <div className="flex justify-between items-center mb-3 text-sm font-bold uppercase tracking-wider"><span>Canais de Venda</span><X className="h-5 w-5" onClick={() => setShowChannelForm(false)}/></div>
           {channels.map(ch => (
             <div key={ch.id} className="flex justify-between items-center mb-2 bg-muted/50 p-2.5 rounded-xl">
               <span className="text-sm font-medium">{ch.name} ({ch.taxPercent}%)</span>
               <Trash2 className="h-4 w-4 text-destructive" onClick={() => deleteChannel(ch.id).then(fetchData)}/>
             </div>
           ))}
           <div className="flex gap-2 mt-4">
             <Input placeholder="Canal" value={newChannelName} onChange={e => setNewChannelName(e.target.value)} className="h-9" />
             <Input placeholder="Taxa%" value={newChannelTax} onChange={e => setNewChannelTax(e.target.value)} className="w-20 h-9" />
             <Button onClick={handleAddChannel} size="sm"><Plus /></Button>
           </div>
        </div>
      )}

      {/* FORMULÁRIO */}
      {showForm && (
        <div className="mx-4 mb-6 rounded-3xl border bg-card p-5 shadow-lg animate-in fade-in zoom-in-95">
          <div className="flex justify-between items-center mb-4"><h2 className="font-bold">Configurar Receita</h2><X onClick={resetForm}/></div>
          
          <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Informações Básicas</p>
          <Input placeholder="Nome da receita" value={name} onChange={e => setName(e.target.value)} className="mb-4 h-11" />
          
          <div className="space-y-2 mb-4">
            <p className="text-[10px] font-bold uppercase text-muted-foreground">Ingredientes</p>
            {ingredients.map(ing => {
              const insumo = insumos.find(i => i.id === ing.insumoId);
              return (
                <div key={ing.insumoId} className="flex items-center gap-2 bg-muted/30 p-2 rounded-xl border">
                  <span className="flex-1 text-xs font-bold truncate">{insumo?.name}</span>
                  <Input type="number" value={ing.quantity || ""} onChange={e => setIngredients(ingredients.map(i => i.insumoId === ing.insumoId ? {...i, quantity: parseFloat(e.target.value) || 0} : i))} className="w-16 h-8 text-center text-xs p-0" />
                  <span className="text-[10px] font-bold">{insumo?.unit}</span>
                  <X className="h-4 w-4 text-destructive" onClick={() => setIngredients(ingredients.filter(i => i.insumoId !== ing.insumoId))}/>
                </div>
              );
            })}
            <div className="flex flex-wrap gap-2 mt-3">
              {availableInsumos.map(i => <Button key={i.id} variant="secondary" size="sm" className="h-7 text-[10px]" onClick={() => setIngredients([...ingredients, {insumoId: i.id, quantity: 0}])}>+ {i.name}</Button>)}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
             <div>
                <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Qtd Produzida</p>
                <Input type="number" placeholder="Ex: 10" value={quantidadePadrao} onChange={e => setQuantidadePadrao(e.target.value)} className="h-10" />
             </div>
             <div>
                <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Preparo (min)</p>
                <Input type="number" placeholder="Minutos" value={prepTime} onChange={e => setPrepTime(e.target.value)} className="h-10" />
             </div>
          </div>

          <div className="bg-primary/10 p-4 rounded-2xl text-center mb-4 border border-primary/20">
             <p className="text-[10px] text-muted-foreground uppercase font-black">Custo por Unidade</p>
             <p className="text-2xl font-black text-primary">{formatBRL(formCost)}</p>
          </div>

          <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Preço de Venda Unitário</p>
          <Input placeholder="R$ 0,00" value={sellPrice} onChange={e => setSellPrice(e.target.value)} className="h-11 mb-5" />
          
          <Button className="w-full h-12 rounded-2xl font-bold" onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Gravar Receita e Quantidade"}</Button>
        </div>
      )}

      {/* LISTA DE RECEITAS */}
      <div className="px-4 space-y-6">
        {produtos.map((produto) => {
          const qty = produto.quantidadePadrao || 1; // LENDO DO BANCO
          const custoUnit = calculateProductCost(produto, insumos, laborCost);
          const custoTotal = custoUnit * qty;
          const vendaTotal = (produto.sellPrice || 0) * qty;
          const lucroTotal = vendaTotal - custoTotal;
          
          const channel = channels.find(c => c.id === produto.channelId);
          const netMargin = produto.sellPrice ? calculateNetMargin(custoUnit, produto.sellPrice, channel?.taxPercent || 0) : null;
          const marginColors = netMargin !== null ? getMarginColor(netMargin) : null;

          return (
            <div key={produto.id} className="rounded-3xl border border-border bg-card overflow-hidden shadow-sm transition-all">
              <div className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold leading-tight">{produto.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold">{produto.ingredients.length} itens • {produto.prepTime || 0}m</p>
                      {netMargin !== null && marginColors && (
                        <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full", marginColors.bg, marginColors.text)}>{netMargin.toFixed(0)}% margem</span>
                      )}
                    </div>
                  </div>
                  
                  {/* MULTIPLICADOR (AGORA COM BOTÃO DE SALVAR RÁPIDO) */}
                  <div className="flex flex-col items-end gap-1 ml-4">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Qtd Produção</span>
                    <div className="bg-muted rounded-xl p-1 border border-border flex items-center gap-1 shadow-inner">
                      <Input 
                        type="number" 
                        value={qty} 
                        onChange={(e) => handleQuickQtySave(produto, parseInt(e.target.value) || 1)} 
                        className="w-12 h-7 text-center font-black bg-transparent border-none p-0 focus-visible:ring-0 text-xs" 
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-orange-50/50 dark:bg-orange-950/10 p-3 rounded-2xl text-center border border-orange-100/50">
                    <p className="text-[9px] font-bold text-orange-600 uppercase">Custo Total ({qty}x)</p>
                    <p className="text-base font-black text-orange-700 dark:text-orange-400">{formatBRL(custoTotal)}</p>
                  </div>
                  <div className="bg-stone-50/50 dark:bg-stone-900/40 p-3 rounded-2xl text-center border border-stone-200/50">
                    <p className="text-[9px] font-bold text-stone-600 uppercase">Venda Total</p>
                    <p className="text-base font-black">{formatBRL(vendaTotal)}</p>
                  </div>
                  <div className="bg-green-50/50 dark:bg-green-950/10 p-4 rounded-2xl text-center col-span-2 border border-green-100 dark:border-green-900/30">
                    <p className="text-[9px] font-bold text-green-600 uppercase flex items-center justify-center gap-1"><TrendingUp className="h-3 w-3"/> Lucro Líquido Total</p>
                    <p className="text-2xl font-black text-green-700 dark:text-green-400">{formatBRL(lucroTotal)}</p>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-border/50">
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setKitchenProduto(produto)}><ChefHat className="h-4 w-4"/></Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => generatePDF(produto, insumos, channels)}><FileText className="h-4 w-4"/></Button>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => handleEdit(produto)}><Pencil className="h-4 w-4"/></Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => handleDelete(produto.id)}><Trash2 className="h-4 w-4"/></Button>
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