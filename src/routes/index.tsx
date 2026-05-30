import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { cn } from "@/lib/utils";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import {
  Package, CakeSlice, TrendingUp,
  DollarSign, BarChart3, LogOut, Settings, Clock, 
  Calendar, ChevronDown, ChevronUp, Wallet, Sparkles,
  ArrowRight, ShieldCheck, Download, Timer, Smartphone, PlayCircle, CheckCircle2,
  Plus, Trash2, Pencil, TrendingDown, PieChart as PieIcon, Target, Trophy, BellRing
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BottomNav } from "@/components/BottomNav";
import { 
  loadInsumos, loadProdutos, loadChannels, 
  loadUserSettings, saveUserSettings, seedExampleData,
  loadGastosMensais, salvarGasto, deleteGasto,
  loadVendasHistorico, loadEncomendas, fecharHistoricoMensalProdutos, zerarVendasMensaisProdutos,
  type Venda, type Encomenda
} from "@/lib/store";
import {
  calculateProductCost, calculateNetMargin, getMarginColor,
} from "@/lib/types";
import type { Insumo, Produto, SalesChannel, GastoAdicional } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import { useApproval } from "@/hooks/use-approval";
import { BlockedScreen } from "@/components/BlockedScreen";
import { DashboardSkeleton } from "@/components/SkeletonScreens";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/preferences";

// IMPORTAÇÕES DO GRÁFICO (RECHARTS) - INCLUINDO PIE PARA A COMPOSIÇÃO
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid,
  PieChart, Pie, Legend 
} from 'recharts';

export const Route = createFileRoute("/")({
  component: Index,
});

function formatBRL(value: number): string {
  return formatCurrency(value);
}

function getMonthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabel(date = new Date()): string {
  const label = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
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
  toast.info("Novo mês iniciado: o histórico foi gravado e as receitas foram zeradas.");
  return produtos.map((produto) => ({ ...produto, quantidadePadrao: 0 }));
}

function parseDateOnly(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function getDaysUntil(date: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const delivery = parseDateOnly(date);
  delivery.setHours(0, 0, 0, 0);
  return Math.ceil((delivery.getTime() - today.getTime()) / 86400000);
}

function getOrderAlertLabel(daysUntil: number): string {
  if (daysUntil < 0) return `${Math.abs(daysUntil)} dia(s) atrasada`;
  if (daysUntil === 0) return "Entrega hoje";
  if (daysUntil === 1) return "Entrega amanhã";
  if (daysUntil <= 7) return "Até 7 dias";
  if (daysUntil <= 15) return "Até 15 dias";
  if (daysUntil <= 30) return "Até 1 mês";
  return "Até 3 meses";
}

function getProductProductionCost(
  produto: Produto,
  insumos: Insumo[],
  laborCostPerHour: number
): number {
  const baseCost = produto.ingredients.reduce((total, ing) => {
    const insumo = insumos.find((i) => i.id === ing.insumoId);
    if (!insumo) return total;
    return total + (insumo.purchasePrice / insumo.packageSize) * ing.quantity;
  }, 0);
  const materialCost = baseCost * (1 + (produto.wastePercent ?? 0) / 100);
  const labor = produto.prepTime && laborCostPerHour > 0
    ? (produto.prepTime / 60) * laborCostPerHour
    : 0;
  return materialCost + labor;
}

function getProductChannelTaxPercent(produto: Produto, channels: SalesChannel[]): number {
  const ids = produto.channelIds ?? (produto.channelId ? [produto.channelId] : []);
  return ids.reduce((sum, id) => {
    const channel = channels.find((c) => c.id === id);
    return sum + (channel?.taxPercent ?? 0);
  }, 0);
}

// --- 🚀 NOVA LANDING PAGE COM PASSO A PASSO (01, 02, 03) ---
function LandingPage() {
  return (
    <div className="min-h-screen bg-[#faf7f2] font-sans text-foreground overflow-x-hidden">
      {/* 1. HERO SECTION */}
      <section className="relative px-6 pt-20 pb-16 text-center">
        <div className="mx-auto max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 rounded-full bg-[#bc834e]/10 border border-[#bc834e]/20">
            <Sparkles size={14} className="text-[#bc834e]" />
            <span className="text-[10px] font-black uppercase tracking-widest text-[#bc834e]">O braço direito da Gestão</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-slate-900 leading-[1.1] mb-6 tracking-tighter">
            GastroGestão<span className="text-[#bc834e]">📈</span>
          </h1>
          <p className="text-lg text-slate-600 mb-10 font-medium leading-relaxed">
            Pare de perder dinheiro com cálculos errados. Tenha o controle total do seu lucro real e estoque em um só lugar.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to="/login" className="w-full sm:w-auto">
              <Button className="h-16 w-full sm:w-250 px-8 rounded-3xl bg-[#bc834e] hover:bg-[#a67243] text-white font-black text-xl shadow-xl shadow-[#bc834e]/20 transition-all group">
              ACESSAR MINHA CONTA AGORA
                <ArrowRight className="ml-2 h-6 w-6 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* 2. SEÇÃO: COMO FUNCIONA (PASSO A PASSO) */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black text-slate-900 mb-4 tracking-tight">Como funciona?</h2>
            <p className="text-slate-500 font-medium text-lg">Três passos simples para profissionalizar sua cozinha.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* PASSO 01 */}
            <div className="bg-white p-8 rounded-[40px] shadow-xl shadow-[#bc834e]/5 border border-[#bc834e]/10 relative group">
              <div className="w-14 h-14 bg-[#bc834e] text-white rounded-2xl flex items-center justify-center font-black text-2xl mb-8 shadow-lg shadow-[#bc834e]/30 group-hover:rotate-6 transition-transform">
                01
              </div>
              <div className="bg-[#bc834e]/10 w-12 h-12 rounded-full flex items-center justify-center mb-4 text-[#bc834e]">
                 <Package size={24} />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-3 uppercase tracking-tight">Cadastre Insumos</h3>
              <p className="text-slate-600 text-sm leading-relaxed font-medium">
                Adicione os preços que você paga no açúcar, farinha ou embalagens. O app já entende seu custo base de compra.
              </p>
            </div>

            {/* PASSO 02 */}
            <div className="bg-white p-8 rounded-[40px] shadow-xl shadow-[#bc834e]/5 border border-[#bc834e]/10 relative group">
              <div className="w-14 h-14 bg-[#bc834e] text-white rounded-2xl flex items-center justify-center font-black text-2xl mb-8 shadow-lg shadow-[#bc834e]/30 group-hover:rotate-6 transition-transform">
                02
              </div>
              <div className="bg-[#bc834e]/10 w-12 h-12 rounded-full flex items-center justify-center mb-4 text-[#bc834e]">
                 <PlayCircle size={24} />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-3 uppercase tracking-tight">Precifique suas Receitas</h3>
              <p className="text-slate-600 text-sm leading-relaxed font-medium">
                Monte suas receitas em segundos. O app soma ingredientes, sua mão de obra e desconta as taxas do iFood automaticamente.
              </p>
            </div>

            {/* PASSO 03 */}
            <div className="bg-white p-8 rounded-[40px] shadow-xl shadow-[#bc834e]/5 border border-[#bc834e]/10 relative group">
              <div className="w-14 h-14 bg-[#bc834e] text-white rounded-2xl flex items-center justify-center font-black text-2xl mb-8 shadow-lg shadow-[#bc834e]/30 group-hover:rotate-6 transition-transform">
                03
              </div>
              <div className="bg-[#bc834e]/10 w-12 h-12 rounded-full flex items-center justify-center mb-4 text-[#bc834e]">
                 <TrendingUp size={24} />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-3 uppercase tracking-tight">Veja seu Lucro</h3>
              <p className="text-slate-600 text-sm leading-relaxed font-medium">
                No Dashboard você vê o lucro líquido real de cada venda. Sem surpresas negativas no fim do mês.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. SEÇÃO: VANTAGENS */}
      <section className="py-20 px-6 bg-white rounded-t-[60px]">
        <div className="mx-auto max-w-4xl text-center">
            <h2 className="text-3xl font-black text-slate-900 mb-12 uppercase tracking-tighter">Por que usar o GastroGestão?</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                {[
                    "Cálculo automático de desperdício",
                    "Integração com taxas iFood/Cartão",
                    "Relatório pronto para PDF",
                    "Controle de Estoque Inteligente",
                    "Acesso pelo celular ou computador",
                    "Design premium e intuitivo"
                ].map((text, i) => (
                    <div key={i} className="flex items-center gap-3 p-4 bg-[#faf7f2] rounded-2xl border border-[#bc834e]/10">
                        <CheckCircle2 className="text-[#bc834e] h-5 w-5" />
                        <span className="font-bold text-slate-700 text-sm">{text}</span>
                    </div>
                ))}
            </div>
            
            <div className="mt-16">
                <Link to="/login">
                    <Button className="h-14 px-10 rounded-2xl bg-[#bc834e] text-white font-black hover:scale-105 transition-transform shadow-lg">
                    Experimente grátis por 7 dias
                    </Button>
                </Link>
            </div>
        </div>
      </section>

      {/* PREÇO */}
      <section className="px-6 py-16 bg-white">
        <div className="mx-auto max-w-lg bg-slate-900 rounded-[45px] p-8 text-center border-4 border-[#bc834e] shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-[#bc834e] text-white px-5 py-1.5 rounded-bl-2xl font-black text-[10px] uppercase tracking-tighter">
            Mensal
          </div>
          
          <h2 className="text-white text-lg font-black uppercase tracking-tight mb-1">Acesso Profissional</h2>
          <p className="text-slate-400 text-[11px] mb-6 font-bold uppercase tracking-widest">O investimento necessario desde o início</p>
          
          <div className="flex items-center justify-center gap-1 mb-2">
            <span className="text-[#bc834e] text-xl font-black mt-2">R$</span>
            <span className="text-white text-7xl font-black tracking-tighter">9,90</span>
            <span className="text-slate-500 text-sm font-bold self-end mb-3">/mês</span>
          </div>
          
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl py-2 px-4 inline-block mb-8">
            <p className="text-green-400 font-black text-[10px] uppercase tracking-[0.15em]">Menos de R$ 0,34 por dia!</p>
          </div>
          
          <Link to="/login">
            <Button className="w-full h-14 bg-[#bc834e] hover:bg-white hover:text-[#bc834e] text-white font-black text-lg rounded-2xl transition-all">
              ASSINAR AGORA
            </Button>
          </Link>
          <p className="mt-3 text-slate-500 text-[15px] font-black uppercase tracking-widest">Sem fidelidade • Cancele quando quiser</p>
        </div>
      </section>

      <footer className="py-12 text-center text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
        <p>© 2026 GastroGestão📈 — Feito para empreendedores de sucesso.</p>
      </footer>
    </div>
  );
}

// --- LÓGICA DE ROTEAMENTO ---
function Index() {
  const { user, loading: authLoading } = useAuth();
  if (authLoading) return <DashboardSkeleton />;
  if (!user) return <LandingPage />;
  return <HomePage />;
}

// --- DASHBOARD (HOME QUANDO LOGADO) ---
function HomePage() {
  const { user, signOut } = useAuth();
  const { isApproved, loading: approvalLoading } = useApproval(user?.id);
  
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [channels, setChannels] = useState<SalesChannel[]>([]);
  const [gastosExtras, setGastosExtras] = useState<Record<string, GastoAdicional[]>>({});
  const [vendasHistorico, setVendasHistorico] = useState<Record<string, Venda[]>>({});
  const [encomendas, setEncomendas] = useState<Encomenda[]>([]);
  const [laborCost, setLaborCost] = useState(0);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  const [goalInput, setGoalInput] = useState(""); // Novo
  const [profitGoal, setProfitGoal] = useState(0); // Novo
  
  const [showSettings, setShowSettings] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const [descGasto, setDescGasto] = useState("");
  const [valorGasto, setValorGasto] = useState("");
  const [tipoGasto, setTipoGasto] = useState<'Fixo' | 'Variável'>('Variável');
  const [editGastoId, setEditGastoId] = useState<string | null>(null);

  const [selectedProductId, setSelectedProductId] = useState<string>("");

  async function fetchData() {
    try {
      const [i, p, c, s, g, v, e] = await Promise.all([
        loadInsumos(), 
        loadProdutos(), 
        loadChannels(), 
        loadUserSettings(),
        loadGastosMensais(),
        loadVendasHistorico(),
        loadEncomendas()
      ]);
      const produtosDoMes = user ? await resetMonthlyProductSalesIfNeeded(user.id, p, i, c, s.laborCostPerHour) : p;
      setInsumos(i);
      setProdutos(produtosDoMes);
      setChannels(c);
      setLaborCost(s.laborCostPerHour);
      
      // Carrega a meta se existir no banco (profit_goal)
      const meta = (s as any).profit_goal || 0;
      setProfitGoal(meta);
      setGoalInput(meta > 0 ? String(meta) : "");

      setGastosExtras(g);
      setVendasHistorico(v);
      setEncomendas(e);
      if (produtosDoMes.length > 0 && !selectedProductId) setSelectedProductId(produtosDoMes[0].id);
    } catch (err) {
      console.error("Failed to load data", err);
    } finally {
      setDataLoading(false);
    }
  }

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const handleAddGasto = async () => {
    if (!descGasto || !valorGasto) return;
    try {
      await salvarGasto({
        descricao: descGasto,
        valor: parseFloat(valorGasto),
        tipo: tipoGasto,
        dataGasto: new Date().toISOString().split('T')[0]
      });
      setDescGasto(""); setValorGasto("");
      toast.success("Gasto registrado!");
      fetchData();
    } catch (e) { toast.error("Erro ao salvar gasto"); }
  };

  const handleDeleteGasto = async (id: string) => {
    if (!confirm("Excluir este gasto?")) return;
    try {
      await deleteGasto(id);
      toast.success("Gasto removido");
      fetchData();
    } catch (e) { toast.error("Erro ao remover"); }
  };

  const exportToPDF = async () => {
    const dashboard = document.getElementById("dashboard-content");
    if (!dashboard) return;

    const toastElement = document.createElement("div");
    toastElement.innerHTML = "Gerando PDF...";
    toastElement.className = "fixed bottom-20 left-1/2 -translate-x-1/2 bg-[#bc834e] text-white px-4 py-2 rounded-full shadow-lg z-50 text-sm font-bold animate-bounce";
    document.body.appendChild(toastElement);

    try {
      const canvas = await html2canvas(dashboard, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#faf7f2"
      });
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Relatorio-GastroGestao-${new Date().toLocaleDateString()}.pdf`);
    } catch (err) {
      console.error("Erro ao gerar PDF", err);
    } finally {
      toastElement.remove();
    }
  };

  const handleSeed = async () => {
    if (confirm("Deseja gerar dados de exemplo para aprender a usar o app?")) {
      setSeeding(true);
      try {
        await seedExampleData();
        await fetchData();
      } catch (err) {
        console.error("Erro ao gerar exemplos", err);
      } finally {
        setSeeding(false);
      }
    }
  };

  const mesAtualChave = useMemo(() => getMonthLabel(), []);

  const currentMonthSalesFromRecipes = useMemo(() => {
    return produtos
      .map((produto) => {
        const quantidadeVendida = produto.quantidadePadrao ?? 0;
        if (quantidadeVendida <= 0) return null;

        const rendimentoTotal = (produto as any).rendimento_total || 1;
        const quantidadeVenda = (produto as any).quantidade_venda || 1;
        const custoProducaoTotal = getProductProductionCost(produto, insumos, laborCost);
        const custoProducaoPorVenda = (custoProducaoTotal / rendimentoTotal) * quantidadeVenda;
        const precoVenda = produto.sellPrice || 0;
        const taxaPercent = getProductChannelTaxPercent(produto, channels);
        const taxaPorVenda = precoVenda * (taxaPercent / 100);
        const lucroPorVenda = precoVenda - custoProducaoPorVenda - taxaPorVenda;

        return {
          name: `${produto.name} (${quantidadeVendida}x)`,
          lucro: lucroPorVenda * quantidadeVendida,
          valorVenda: precoVenda * quantidadeVendida,
        };
      })
      .filter((item): item is { name: string; lucro: number; valorVenda: number } => item !== null);
  }, [produtos, insumos, laborCost, channels]);

  const historyFromProducts = useMemo(() => {
    const groups: Record<string, { name: string; lucro: number; valorVenda: number }[]> = {};

    Object.entries(vendasHistorico).forEach(([mes, vendas]) => {
      if (mes === mesAtualChave) return;

      const byProduct = new Map<string, { name: string; lucro: number; valorVenda: number }>();

      vendas.forEach((venda) => {
        const current = byProduct.get(venda.produtoNome) ?? {
          name: venda.produtoNome,
          lucro: 0,
          valorVenda: 0,
        };

        current.lucro += venda.lucro;
        current.valorVenda += venda.valorVenda;
        byProduct.set(venda.produtoNome, current);
      });

      groups[mes] = Array.from(byProduct.values()).filter(
        (venda) => Math.abs(venda.lucro) > 0.005 || Math.abs(venda.valorVenda) > 0.005
      );
    });

    if (currentMonthSalesFromRecipes.length > 0) {
      groups[mesAtualChave] = currentMonthSalesFromRecipes;
    }

    return groups;
  }, [currentMonthSalesFromRecipes, mesAtualChave, vendasHistorico]);

  const upcomingOrderAlerts = useMemo(() => {
    return encomendas
      .map((order) => ({ order, daysUntil: getDaysUntil(order.deliveryDate) }))
      .filter(({ daysUntil }) => daysUntil <= 90)
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, 6);
  }, [encomendas]);

  // AJUSTADO: Gráfico agora usa o Lucro Unitário Corrigido
  const chartData = useMemo(() => {
    return produtos
      .map(p => {
        const custoMassaTotal = calculateProductCost(p, insumos, laborCost, channels);
        const rend = (p as any).rendimento_total || 1;
        const qtdV = (p as any).quantidade_venda || 1;
        const custoVendaUnitario = (custoMassaTotal / rend) * qtdV;
        const precoVenda = p.sellPrice || 0;
        const channel = channels.find(c => c.id === p.channelId);
        const taxaPercent = channel?.taxPercent || 0;
        const valorTaxa = (precoVenda * (taxaPercent / 100));
        const lucroPorUnidadeVenda = precoVenda - custoVendaUnitario - valorTaxa;

        return { 
          name: p.name, 
          lucro: lucroPorUnidadeVenda > 0 ? lucroPorUnidadeVenda : 0 
        };
      })
      .filter(item => item.lucro > 0)
      .sort((a, b) => b.lucro - a.lucro)
      .slice(0, 5);
  }, [produtos, insumos, laborCost, channels]);

  // NOVO: Lógica do Gráfico de Pizza Dinâmico
  const compositionData = useMemo(() => {
    const p = produtos.find(prod => prod.id === selectedProductId);
    if (!p) return [];

    const rend = (p as any).rendimento_total || 1;
    const qtdV = (p as any).quantidade_venda || 1;
    const custoMassaTotal = calculateProductCost(p, insumos, laborCost, channels);
    const custoIngredientes = (custoMassaTotal / rend) * qtdV;
    const precoVenda = p.sellPrice || 0;
    const channel = channels.find(c => c.id === p.channelId);
    const taxa = (precoVenda * ((channel?.taxPercent || 0) / 100));
    const lucro = precoVenda - custoIngredientes - taxa;

    return [
      { name: 'Ingredientes', value: custoIngredientes, fill: '#bc834e' },
      { name: 'Taxas/Canais', value: taxa, fill: '#64748b' },
      { name: 'Lucro Líquido', value: lucro > 0 ? lucro : 0, fill: '#22c55e' }
    ];
  }, [produtos, selectedProductId, insumos, laborCost, channels]);

  const lucroTotalRealizado = useMemo(() => {
    return (historyFromProducts[mesAtualChave] || []).reduce((acc, p) => acc + p.lucro, 0);
  }, [historyFromProducts, mesAtualChave]);

  // NOVO: Cálculo da Barra de Progresso
  const progressPercentage = useMemo(() => {
    if (profitGoal <= 0) return 0;
    const perc = (lucroTotalRealizado / profitGoal) * 100;
    return Math.min(perc, 100);
  }, [lucroTotalRealizado, profitGoal]);

  useEffect(() => {
    const meses = Object.keys(historyFromProducts);
    if (meses.length > 0 && !expandedMonth) setExpandedMonth(meses[0]);
  }, [historyFromProducts]);

  const totalRevenue = useMemo(() => 
    (historyFromProducts[mesAtualChave] || []).reduce((sum, venda) => sum + (venda.valorVenda || 0), 0), 
  [historyFromProducts, mesAtualChave]);
  
  // CORRIGIDO: Margem Média agora compara custo unitário vs preço unitário
  const avgMargin = useMemo(() => {
    const withProduction = produtos.filter((p) => (p.quantidadePadrao || 0) > 0 && p.sellPrice && p.sellPrice > 0);
    if (withProduction.length === 0) return null;
    const totalMargin = withProduction.reduce((sum, p) => {
      const rend = (p as any).rendimento_total || 1;
      const qtdV = (p as any).quantidade_venda || 1;
      const costTotal = calculateProductCost(p, insumos, laborCost, channels);
      const costUnit = (costTotal / rend) * qtdV;
      
      const ch = channels.find((c) => c.id === p.channelId);
      const tax = (p.sellPrice || 0) * ((ch?.taxPercent || 0) / 100);
      
      const profitPerUnit = (p.sellPrice || 0) - costUnit - tax;
      return sum + (profitPerUnit / (p.sellPrice || 1)) * 100;
    }, 0);
    return totalMargin / withProduction.length;
  }, [produtos, insumos, channels, laborCost]);

  const handleSaveSettings = async () => {
    const gVal = parseFloat(goalInput) || 0;
    try {
      await saveUserSettings({ 
        profit_goal: gVal // Salvando a meta
      } as any);
      setProfitGoal(gVal);
      setShowSettings(false);
      toast.success("Configurações atualizadas!");
    } catch (err) { console.error(err); }
  };

  if (dataLoading || approvalLoading) return <DashboardSkeleton />;
  if (isApproved === false) return <BlockedScreen />;

  return (
    <div id="dashboard-content" className="min-h-screen bg-[#faf7f2] pb-32">
      <div className="px-4 pb-4 pt-8 flex justify-between items-start">
        <div>
          <p className="text-sm text-muted-foreground font-medium">Bem-vindo ao</p>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">GastroGestão📈</h1>
        </div>
        <div className="flex gap-1">
          {produtos.length === 0 && (
            <Button variant="outline" size="sm" onClick={handleSeed} disabled={seeding} className="text-[#bc834e] border-[#bc834e] hover:bg-[#bc834e]/10">
              <Sparkles className={cn("mr-2 h-4 w-4", seeding && "animate-spin")} />
              Ver Exemplos
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={exportToPDF} title="Baixar Relatório">
            <Download className="h-5 w-5 text-[#bc834e]" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setShowSettings(!showSettings)}><Settings className="h-5 w-5" /></Button>
          <Button variant="ghost" size="icon" onClick={signOut}><LogOut className="h-5 w-5" /></Button>
        </div>
      </div>

      {showSettings && (
        <div className="mx-4 mb-4 rounded-3xl border border-[#bc834e]/20 bg-white p-6 shadow-sm space-y-4">
          <div>
            <label className="text-[10px] font-black uppercase text-[#bc834e] mb-2 block tracking-widest">Meta de Lucro Mensal (R$)</label>
            <Input type="number" value={goalInput} placeholder="Ex: 2000" onChange={(e) => setGoalInput(e.target.value)} className="h-10 border-[#bc834e]/20" />
          </div>
          <Button onClick={handleSaveSettings} className="w-full bg-[#bc834e] text-white font-bold h-10 rounded-xl">Salvar</Button>
        </div>
      )}

      {/* 🎯 BARRA DE PROGRESSO DA META (ADICIONADA) */}
      {profitGoal > 0 && (
        <div className="px-4 mb-6">
          <div className="bg-white rounded-[35px] p-6 border border-[#bc834e]/10 shadow-sm">
            <div className="flex justify-between items-end mb-3">
              <div>
                <span className="text-[9px] font-black uppercase text-slate-400 flex items-center gap-1 tracking-widest"><Trophy size={10} className="text-[#bc834e]"/> Rumo à Meta</span>
                <p className="text-lg font-black text-slate-900">{formatBRL(lucroTotalRealizado)} <span className="text-[10px] text-slate-400 font-medium">de {formatBRL(profitGoal)}</span></p>
              </div>
              <span className="text-xl font-black text-[#22c55e]">{Math.floor(progressPercentage)}%</span>
            </div>
            <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#22c55e] transition-all duration-1000 ease-out shadow-[0_0_12px_rgba(34,197,94,0.4)]" 
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            {progressPercentage >= 100 && <p className="text-[9px] text-[#22c55e] font-black mt-2 uppercase text-center animate-pulse">🎉 META BATIDA! VOCÊ É INCRÍVEL!</p>}
          </div>
        </div>
      )}

      {upcomingOrderAlerts.length > 0 && (
        <div className="px-4 mb-6">
          <div className="bg-white rounded-[32px] p-5 border border-[#bc834e]/20 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BellRing className="h-5 w-5 text-[#bc834e]" />
                <h2 className="font-black text-slate-900 uppercase text-[10px] tracking-widest">Alertas de Encomendas</h2>
              </div>
              <Link to="/encomendas" className="text-[10px] font-black uppercase text-[#bc834e] tracking-widest">
                Ver todas
              </Link>
            </div>
            <div className="space-y-2">
              {upcomingOrderAlerts.map(({ order, daysUntil }) => (
                <div key={order.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[#bc834e]/10 bg-[#faf7f2] px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-900">{order.customerName}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      {parseDateOnly(order.deliveryDate).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <span className={cn(
                    "shrink-0 rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-tighter",
                    daysUntil <= 7 ? "bg-red-100 text-red-600" :
                    daysUntil <= 15 ? "bg-orange-100 text-orange-600" :
                    daysUntil <= 30 ? "bg-[#bc834e]/10 text-[#bc834e]" :
                    "bg-slate-100 text-slate-600"
                  )}>
                    {getOrderAlertLabel(daysUntil)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="px-4 mb-6">
        <div className="rounded-[35px] bg-[#bc834e] p-8 text-white shadow-2xl shadow-[#bc834e]/30">
          <div className="flex items-center gap-2 opacity-80 mb-2">
            <Wallet className="h-4 w-4" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Lucro Líquido Real</span>
          </div>
          <p className="text-4xl font-black tracking-tighter">{formatBRL(lucroTotalRealizado)}</p>
          <p className="text-[10px] opacity-70 mt-3 uppercase font-black tracking-widest">Já descontando custos e taxas de venda</p>
        </div>
      </div>

      {/* --- NOVA SEÇÃO: CUSTOS FIXOS E VARIÁVEIS --- */}
      <div className="mx-4 mb-10 p-6 bg-slate-900 rounded-[35px] shadow-xl">
        <h2 className="text-white font-black uppercase text-[10px] tracking-widest mb-4 flex items-center gap-2">
          <Plus className="text-[#bc834e]" size={16}/> Anotar Custos Fixos/Variáveis
        </h2>
        <div className="space-y-3">
          <Input 
            placeholder="Ex: Aluguel, Luz, Conserto" 
            value={descGasto} 
            onChange={e => setDescGasto(e.target.value)} 
            className="bg-white/10 border-none text-white placeholder:text-slate-500 rounded-2xl h-12" 
          />
          <div className="flex gap-2">
            <Input 
              type="number" 
              placeholder="R$ Valor" 
              value={valorGasto} 
              onChange={e => setValorGasto(e.target.value)} 
              className="bg-white/10 border-none text-white rounded-2xl h-12 flex-1" 
            />
            <select 
              value={tipoGasto} 
              onChange={e => setTipoGasto(e.target.value as any)} 
              className="bg-white/10 text-white rounded-2xl px-3 text-xs font-bold border-none h-12"
            >
              <option value="Variável" className="text-black">Variável</option>
              <option value="Fixo" className="text-black">Fixo</option>
            </select>
          </div>
          <Button onClick={handleAddGasto} className="w-full h-12 rounded-2xl bg-[#bc834e] hover:bg-[#a67243] text-white font-black uppercase text-xs">
            Salvar Gasto
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 px-4 mb-10">
        <Link to="/insumos" className="bg-white border border-slate-100 flex flex-col items-center gap-3 rounded-[24px] sm:rounded-[30px] p-4 sm:p-6 shadow-sm hover:shadow-xl transition-all min-w-0">
          <Package className="h-7 w-7 text-[#bc834e]" />
          <span className="text-center text-base sm:text-xl font-black text-slate-900 break-words">{insumos.length} Insumos</span>
        </Link>
        <Link to="/produtos" className="bg-white border border-slate-100 flex flex-col items-center gap-3 rounded-[24px] sm:rounded-[30px] p-4 sm:p-6 shadow-sm hover:shadow-xl transition-all min-w-0">
          <CakeSlice className="h-7 w-7 text-[#bc834e]" />
          <span className="text-center text-base sm:text-xl font-black text-slate-900 break-words">{produtos.length} Receitas</span>
        </Link>
      </div>

      {chartData.length > 0 && (
        <div className="mx-3 sm:mx-4 mb-10 p-4 sm:p-6 bg-white rounded-[28px] sm:rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-start gap-2 mb-6 sm:mb-8">
            <BarChart3 className="h-5 w-5 text-[#bc834e]" />
            <h2 className="font-black text-slate-900 uppercase text-[10px] sm:text-xs tracking-widest sm:tracking-[0.2em] leading-tight">Ranking de Lucro Real Unitário</h2>
          </div>
          <div className="space-y-3 sm:hidden">
            {chartData.map((item, index) => {
              const maxValue = chartData[0]?.lucro || 1;
              const width = Math.max((item.lucro / maxValue) * 100, 8);
              return (
                <div key={item.name} className="space-y-1">
                  <div className="flex items-center justify-between gap-3 text-[11px] font-black">
                    <span className="min-w-0 truncate text-slate-700">{item.name}</span>
                    <span className="shrink-0 text-[#bc834e]">{formatBRL(item.lucro)}</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-[#faf7f2]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${width}%`, backgroundColor: index === 0 ? "#bc834e" : "#e2b48d" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="hidden h-64 w-full sm:block">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f1f1" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={100} style={{ fontSize: '10px', fontWeight: '900', fill: '#64748b' }} />
                <Tooltip 
                  formatter={(value: any) => formatBRL(Number(value))}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontWeight: 'bold' }} 
                />
                <Bar dataKey="lucro" radius={[0, 6, 6, 0]} barSize={24}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#bc834e' : '#e2b48d'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* PIZZA DINÂMICA */}
      {produtos.length > 0 && (
        <div className="mx-3 sm:mx-4 mb-10 p-4 sm:p-6 bg-white rounded-[28px] sm:rounded-[40px] shadow-sm border border-slate-100 overflow-hidden">
          <div className="flex flex-col gap-4 mb-6">
            <h2 className="font-black text-slate-900 uppercase text-[10px] tracking-widest flex items-center gap-2 leading-tight">
              <PieIcon size={14} className="text-[#bc834e]"/> Composição do Preço
            </h2>
            <select value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)} className="w-full bg-[#faf7f2] border border-[#bc834e]/20 text-slate-700 rounded-xl px-4 h-12 text-sm font-bold">
              {produtos.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
            </select>
          </div>
          <div className="grid gap-3 sm:hidden">
            {compositionData.map((entry) => {
              const total = compositionData.reduce((sum, item) => sum + item.value, 0) || 1;
              const width = Math.max((entry.value / total) * 100, entry.value > 0 ? 6 : 0);
              return (
                <div key={entry.name} className="space-y-1">
                  <div className="flex items-center justify-between gap-3 text-[11px] font-black">
                    <span className="flex items-center gap-2 text-slate-700">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.fill }} />
                      {entry.name}
                    </span>
                    <span className="shrink-0 text-slate-900">{formatBRL(entry.value)}</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-[#faf7f2]">
                    <div className="h-full rounded-full transition-all" style={{ width: `${width}%`, backgroundColor: entry.fill }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="hidden h-64 w-full sm:block">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={compositionData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {compositionData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                </Pie>
                <Tooltip formatter={(v: any) => formatBRL(Number(v))} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: '900', paddingTop: '20px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="px-4 mb-12">
        <div className="flex items-center gap-2 mb-6">
          <Calendar className="h-5 w-5 text-[#bc834e]" />
          <h2 className="font-black text-slate-900 uppercase text-xs tracking-[0.2em]">Histórico Mensal</h2>
        </div>
        <div className="space-y-4">
          {Object.keys({ ...historyFromProducts, ...gastosExtras }).sort().reverse().map((mes) => {
            const isExpanded = expandedMonth === mes;
            const vendas = historyFromProducts[mes] || [];
            const gastos = gastosExtras[mes] || [];
            const totalLucroVendas = vendas.reduce((sum, v) => sum + v.lucro, 0);
            const totalGastosExtras = gastos.reduce((sum, g) => sum + g.valor, 0);

            return (
              <div key={mes} className="rounded-[32px] border border-slate-100 bg-white overflow-hidden shadow-sm">
                <button onClick={() => setExpandedMonth(isExpanded ? null : mes)} className="w-full flex items-center justify-between p-6 text-left">
                  <div>
                    <p className="font-black text-slate-900 text-lg">{mes}</p>
                    <div className="flex gap-3 mt-1">
                      <span className="text-[9px] font-black text-green-600 uppercase tracking-widest">Vendas: +{formatBRL(totalLucroVendas)}</span>
                      <span className="text-[9px] font-black text-red-500 uppercase tracking-widest">Extras: -{formatBRL(totalGastosExtras)}</span>
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
                </button>
                {isExpanded && (
                  <div className="px-5 pb-5 space-y-4 bg-slate-50/50 border-t border-slate-100 pt-5">
                    <div className="space-y-2">
                       <p className="text-[8px] font-black uppercase text-slate-400 ml-1 tracking-widest">Detalhamento de Vendas</p>
                       {vendas.length > 0 ? vendas.map((v, i) => (
                         <div key={i} className="flex justify-between bg-white p-3 rounded-xl border border-slate-100 text-[10px] font-bold shadow-sm">
                           <span className="text-slate-600">{v.name}</span><span className="text-green-600">+{formatBRL(v.lucro)}</span>
                         </div>
                       )) : <p className="text-[9px] text-slate-400 italic ml-1">Nenhuma venda.</p>}
                    </div>
                    <div className="space-y-2">
                       <p className="text-[8px] font-black uppercase text-slate-400 ml-1 tracking-widest">Custos Adicionais</p>
                       {gastos.length > 0 ? gastos.map((g, i) => (
                         <div key={i} className="flex justify-between bg-white p-3 rounded-xl border border-red-50 text-[10px] font-bold shadow-sm">
                           <div className="flex items-center gap-2">
                             <span className="text-slate-600">{g.descricao} ({g.tipo})</span>
                             <Trash2 size={12} className="text-red-300 cursor-pointer" onClick={(e) => { e.stopPropagation(); handleDeleteGasto(g.id); }}/>
                           </div>
                           <span className="text-red-500">-{formatBRL(g.valor)}</span>
                         </div>
                       )) : <p className="text-[9px] text-slate-400 italic ml-1">Nenhum custo extra.</p>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-4 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-[30px] border border-slate-100 bg-white p-6 shadow-sm">
            <span className="text-[10px] text-slate-400 font-black uppercase block mb-2 tracking-widest">Faturamento</span>
            <p className="text-xl font-black text-slate-900">{formatBRL(totalRevenue)}</p>
          </div>
          <div className="rounded-[30px] border border-slate-100 bg-white p-6 shadow-sm">
            <span className="text-[10px] text-slate-400 font-black uppercase block mb-2 tracking-widest">Margem Média</span>
            <p className={cn("text-xl font-black", avgMargin ? getMarginColor(avgMargin).text : "text-slate-400")}>
              {avgMargin ? `${avgMargin.toFixed(1)}%` : "—"}
            </p>
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
