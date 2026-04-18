import { cn } from "@/lib/utils";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import {
  Package, CakeSlice, TrendingUp,
  DollarSign, BarChart3, LogOut, Settings, Clock, 
  Calendar, ChevronDown, ChevronUp, Wallet, Sparkles
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BottomNav } from "@/components/BottomNav";
import { 
  loadInsumos, loadProdutos, loadChannels, 
  loadUserSettings, saveUserSettings, seedExampleData
} from "@/lib/store";
import {
  calculateProductCost, calculateNetMargin, getMarginColor,
} from "@/lib/types";
import type { Insumo, Produto, SalesChannel } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import { useApproval } from "@/hooks/use-approval";
import { BlockedScreen } from "@/components/BlockedScreen";
import { DashboardSkeleton } from "@/components/SkeletonScreens";

// IMPORTAÇÕES DO GRÁFICO (RECHARTS)
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';

export const Route = createFileRoute("/")({
  component: HomePage,
});

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function HomePage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { isApproved, loading: approvalLoading } = useApproval(user?.id);
  const navigate = useNavigate();

  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [channels, setChannels] = useState<SalesChannel[]>([]);
  const [laborCost, setLaborCost] = useState(0);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  const [laborInput, setLaborInput] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [user, authLoading, navigate]);

  async function fetchData() {
    try {
      const [i, p, c, s] = await Promise.all([
        loadInsumos(), 
        loadProdutos(), 
        loadChannels(), 
        loadUserSettings()
      ]);
      setInsumos(i);
      setProdutos(p);
      setChannels(c);
      setLaborCost(s.laborCostPerHour);
      setLaborInput(s.laborCostPerHour > 0 ? String(s.laborCostPerHour) : "");
    } catch (err) {
      console.error("Failed to load data", err);
    } finally {
      setDataLoading(false);
    }
  }

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  // FUNÇÃO PARA GERAR EXEMPLOS (POPULAR O APP)
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

  // --- LÓGICA DO HISTÓRICO BASEADO NAS RECEITAS E SUAS QUANTIDADES ---
  const historyFromProducts = useMemo(() => {
    const groups: Record<string, { name: string; lucro: number }[]> = {};
    
    produtos.forEach((p) => {
      const custoUnitario = calculateProductCost(p, insumos, laborCost);
      const precoVendaUnitario = p.sellPrice || 0;
      
      const qtd = p.quantidadePadrao || 1;
      const lucroTotalReceita = (precoVendaUnitario - custoUnitario) * qtd;
      
      const dataObj = new Date(); 
      const mesAno = dataObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      const chave = mesAno.charAt(0).toUpperCase() + mesAno.slice(1);
  
      if (!groups[chave]) groups[chave] = [];
      groups[chave].push({ name: `${p.name} (${qtd}x)`, lucro: lucroTotalReceita });
    });
  
    return groups;
  }, [produtos, insumos, laborCost]);

  // --- DADOS PARA O GRÁFICO (TOP 5 MAIORES LUCROS) ---
  const chartData = useMemo(() => {
    return produtos
      .map(p => {
        const custoUnit = calculateProductCost(p, insumos, laborCost);
        const lucroTotal = ((p.sellPrice || 0) - custoUnit) * (p.quantidadePadrao || 1);
        return { name: p.name, lucro: lucroTotal };
      })
      .sort((a, b) => b.lucro - a.lucro)
      .slice(0, 5);
  }, [produtos, insumos, laborCost]);

  const lucroTotalRealizado = useMemo(() => {
    return Object.values(historyFromProducts).flat().reduce((acc, p) => acc + p.lucro, 0);
  }, [historyFromProducts]);

  useEffect(() => {
    const meses = Object.keys(historyFromProducts);
    if (meses.length > 0 && !expandedMonth) setExpandedMonth(meses[0]);
  }, [historyFromProducts]);

  const totalRevenue = useMemo(() => 
    produtos.reduce((sum, p) => sum + ((p.sellPrice || 0) * (p.quantidadePadrao || 1)), 0), 
  [produtos]);
  
  const avgMargin = useMemo(() => {
    const withSell = produtos.filter((p) => p.sellPrice && p.sellPrice > 0);
    if (withSell.length === 0) return null;
    const totalMargin = withSell.reduce((sum, p) => {
      const cost = calculateProductCost(p, insumos, laborCost);
      const ch = channels.find((c) => c.id === p.channelId);
      return sum + calculateNetMargin(cost, p.sellPrice!, ch?.taxPercent ?? 0);
    }, 0);
    return totalMargin / withSell.length;
  }, [produtos, insumos, channels, laborCost]);

  const handleSaveLaborCost = async () => {
    const val = parseFloat(laborInput) || 0;
    try {
      await saveUserSettings({ laborCostPerHour: val });
      setLaborCost(val);
      setShowSettings(false);
    } catch (err) { console.error(err); }
  };

  if (authLoading || dataLoading || approvalLoading) return <DashboardSkeleton />;
  if (isApproved === false) return <BlockedScreen />;

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* HEADER */}
      <div className="px-4 pb-4 pt-8 flex justify-between items-start">
        <div>
          <p className="text-sm text-muted-foreground">Bem-vinda ao</p>
          <h1 className="text-3xl font-bold text-foreground">GastroGestão📈</h1>
        </div>
        <div className="flex gap-1">
          {/* BOTÃO DE EXEMPLO - Só aparece se o app estiver vazio */}
          {produtos.length === 0 && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSeed}
              disabled={seeding}
              className="text-[#C88242] border-[#C88242] hover:bg-[#C88242]/10"
            >
              <Sparkles className={cn("mr-2 h-4 w-4", seeding && "animate-spin")} />
              {seeding ? "Gerando..." : "Ver Exemplos"}
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => setShowSettings(!showSettings)}><Settings className="h-5 w-5" /></Button>
          <Button variant="ghost" size="icon" onClick={signOut}><LogOut className="h-5 w-5" /></Button>
        </div>
      </div>

      {showSettings && (
        <div className="mx-4 mb-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-primary" />
            <span className="font-semibold text-xs">Custo da Mão de Obra</span>
          </div>
          <div className="flex gap-2">
            <Input type="number" value={laborInput} onChange={(e) => setLaborInput(e.target.value)} className="h-10 flex-1" />
            <Button size="sm" onClick={handleSaveLaborCost}>Salvar</Button>
          </div>
        </div>
      )}

      {/* CARD DE LUCRO TOTAL */}
      <div className="px-4 mb-6">
        <div className="rounded-3xl bg-[#C88242] p-6 text-white shadow-lg shadow-[#C88242]/20">
          <div className="flex items-center gap-2 opacity-80 mb-1">
            <Wallet className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Lucro das Receitas</span>
          </div>
          <p className="text-4xl font-black">{formatBRL(lucroTotalRealizado)}</p>
          <p className="text-[10px] opacity-70 mt-1 uppercase font-bold tracking-tighter">Soma do lucro multiplicada pela quantidade produzida</p>
        </div>
      </div>

      {/* QUICK NAV */}
      <div className="grid grid-cols-2 gap-3 px-4 mb-8">
        <Link to="/insumos" className="bg-card border flex flex-col items-center gap-2 rounded-2xl p-4 shadow-sm">
          <Package className="h-6 w-6 text-[#C88242]" />
          <span className="text-xl font-bold">{insumos.length} Insumos</span>
        </Link>
        <Link to="/produtos" className="bg-card border flex flex-col items-center gap-2 rounded-2xl p-4 shadow-sm">
          <CakeSlice className="h-6 w-6 text-[#C88242]" />
          <span className="text-xl font-bold">{produtos.length} Receitas</span>
        </Link>
      </div>

      {/* GRÁFICO DE PERFORMANCE (Só aparece se houver produtos) */}
      {produtos.length > 0 && (
        <div className="mx-4 mb-8 p-5 bg-card rounded-3xl border border-border shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="h-5 w-5 text-[#C88242]" />
            <h2 className="font-bold text-foreground uppercase text-xs tracking-widest">Ranking de Lucro (Top 5)</h2>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: -20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={80} 
                  style={{ fontSize: '10px', fontWeight: 'bold', fill: '#666' }} 
                />
                <Tooltip 
                  formatter={(value: number) => formatBRL(value)}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="lucro" radius={[0, 4, 4, 0]} barSize={25}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#C88242' : '#E5A663'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* HISTÓRICO MENSAL */}
      <div className="px-4 mb-10">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-5 w-5 text-primary" />
          <h2 className="font-bold text-foreground uppercase text-xs tracking-widest">Histórico de Receitas</h2>
        </div>
        <div className="space-y-3">
          {Object.keys(historyFromProducts).length === 0 ? (
            <p className="text-xs text-muted-foreground bg-muted/30 p-4 rounded-xl text-center">Nenhuma receita encontrada.</p>
          ) : (
            Object.entries(historyFromProducts).map(([mes, itens]) => {
              const isExpanded = expandedMonth === mes;
              const lucroNoMes = itens.reduce((sum, v) => sum + v.lucro, 0);
              return (
                <div key={mes} className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
                  <button onClick={() => setExpandedMonth(isExpanded ? null : mes)} className="w-full flex items-center justify-between p-4">
                    <div className="text-left">
                      <p className="font-bold text-sm">{mes}</p>
                      <p className="text-[10px] text-green-600 font-bold uppercase tracking-tighter">LUCRO TOTAL: {formatBRL(lucroNoMes)}</p>
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  {isExpanded && (
                    <div className="px-3 pb-3 space-y-2 bg-muted/10 border-t border-border pt-3">
                      {itens.map((v, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-card p-3 rounded-xl border border-border text-[11px]">
                          <span className="font-medium text-foreground">{v.name}</span>
                          <span className="font-bold text-green-600">+{formatBRL(v.lucro)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* PERFORMANCE E CUSTOS */}
      <div className="px-4 space-y-6">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <span className="text-[10px] text-muted-foreground font-bold uppercase block mb-1 tracking-wider">Faturamento</span>
            <p className="text-lg font-bold">{formatBRL(totalRevenue)}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <span className="text-[10px] text-muted-foreground font-bold uppercase block mb-1 tracking-wider">Margem Média</span>
            <p className={cn("text-lg font-bold", avgMargin ? getMarginColor(avgMargin).text : "")}>
              {avgMargin ? `${avgMargin.toFixed(1)}%` : "—"}
            </p>
          </div>
        </div>

        {/* RESUMO DE CUSTOS DE RECEITAS */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <CakeSlice className="h-5 w-5 text-primary" />
            <h2 className="font-bold text-foreground uppercase text-xs tracking-widest">Resumo de Custos</h2>
          </div>
          <div className="space-y-2">
            {produtos.map((produto) => {
              const cost = calculateProductCost(produto, insumos, laborCost);
              return (
                <div key={produto.id} className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
                  <span className="text-xs font-medium text-foreground">{produto.name}</span>
                  <span className="text-xs font-bold text-primary">{formatBRL(cost)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}