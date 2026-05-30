import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2, ShoppingBasket, ClipboardList, Store } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/PageHeader";
import { BottomNav } from "@/components/BottomNav";
import { BlockedScreen } from "@/components/BlockedScreen";
import { ListSkeleton } from "@/components/SkeletonScreens";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useApproval } from "@/hooks/use-approval";
import {
  toggleShoppingStockItem,
  deleteShoppingStockItem,
} from "@/lib/store";
import { cn } from "@/lib/utils";

interface StockItem {
  id: string;
  itemName: string;
  checked: boolean;
  quantity: number;
}

export const Route = createFileRoute("/estoque")({
  component: EstoquePage,
});

function EstoquePage() {
  const { user, loading: authLoading } = useAuth();
  const { isApproved, loading: approvalLoading } = useApproval(user?.id);
  const navigate = useNavigate();

  const [items, setItems] = useState<StockItem[]>([]);
  const [newItemName, setNewItemName] = useState("");
  const [dataLoading, setDataLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [user, authLoading, navigate]);

  async function fetchItems() {
    setDataLoading(true);
    try {
      const { data, error } = await supabase
        .from("estoque_compras")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      const mapped = (data ?? []).map((row: any) => ({
        id: row.id,
        itemName: row.item_name,
        checked: row.checked,
        quantity: row.quantity ?? 1,
      }));
      
      setItems(mapped);
    } catch (error) {
      toast.error("Erro ao carregar listas.");
    } finally {
      setDataLoading(false);
    }
  }

  useEffect(() => {
    if (user) void fetchItems();
  }, [user]);

  // Função para adicionar item (usando a coluna 'quantity' já existente no banco)
  async function handleAddItem(isInventory: boolean) {
    if (!newItemName.trim() || !user) return;
    setSaving(true);
    try {
      // Itens de estoque vamos marcar com um check "oculto" ou apenas gerenciar pela lista
      const { error } = await (supabase.from("estoque_compras") as any).insert({
        user_id: user.id,
        item_name: newItemName.trim(),
        checked: isInventory, // Se for estoque, já nasce "marcado" para o código separar
        quantity: 1
      });
      if (error) throw error;

      setNewItemName("");
      await fetchItems();
      toast.success("Adicionado!");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao adicionar. Verifique a conexão.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateQuantity(id: string, newQty: number) {
    if (newQty < 0) return;
    try {
      setItems(prev => prev.map(item => item.id === id ? { ...item, quantity: newQty } : item));
      await (supabase.from("estoque_compras") as any).update({ quantity: newQty }).eq("id", id);
    } catch (error) {
      toast.error("Erro na quantidade.");
    }
  }

  const handleToggleItem = async (id: string, checked: boolean) => {
    try {
      await toggleShoppingStockItem(id, checked);
      setItems(prev => prev.map(item => item.id === id ? { ...item, checked } : item));
    } catch (err) { toast.error("Erro ao marcar."); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteShoppingStockItem(id);
      setItems(prev => prev.filter(i => i.id !== id));
      toast.success("Removido");
    } catch (err) { toast.error("Erro ao remover."); }
  };

  if (authLoading || approvalLoading || dataLoading || !user) return <ListSkeleton />;
  if (isApproved === false) return <BlockedScreen />;

  // SEPARAÇÃO DAS LISTAS USANDO O ESTADO DO CHECKBOX QUE JÁ EXISTE NO BANCO
  const shoppingList = items.filter(i => !i.checked);
  const inventoryList = items.filter(i => i.checked);

  return (
    <div className="min-h-screen bg-background pb-32 font-sans text-foreground">
      <PageHeader title="Meu Controle" subtitle="Compras e Estoque manual" />

      <div className="mx-4 mb-8 rounded-3xl border border-[#bc834e]/20 bg-card p-5 shadow-lg">
        <p className="text-[10px] font-black uppercase text-[#bc834e] mb-2 tracking-widest text-center">O que deseja anotar?</p>
        <Input
          placeholder="Nome do produto..."
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          className="h-12 border-[#bc834e]/20 rounded-2xl bg-white mb-3 text-center font-bold"
        />
        <div className="flex gap-2">
          <Button onClick={() => handleAddItem(false)} disabled={saving} className="flex-1 h-11 rounded-xl bg-[#bc834e] text-white text-[10px] font-bold uppercase">
             🛒 + Lista Compras
          </Button>
          <Button onClick={() => handleAddItem(true)} disabled={saving} className="flex-1 h-11 rounded-xl bg-slate-700 text-white text-[10px] font-bold uppercase">
             📦 + Meu Estoque
          </Button>
        </div>
      </div>

      {/* QUADRO 1: LISTA DE COMPRAS */}
      <div className="px-4 mb-10">
        <h2 className="flex items-center gap-2 font-black uppercase text-xs text-[#bc834e] mb-4 ml-2 tracking-tighter">
          <ShoppingBasket size={16}/> Comprar (Checklist)
        </h2>
        <div className="space-y-2">
          {shoppingList.map(item => (
            <div key={item.id} className="flex items-center justify-between p-3 rounded-2xl bg-white shadow-sm border border-[#bc834e]/10">
              <div className="flex items-center gap-3 flex-1">
                <Checkbox checked={item.checked} onCheckedChange={(val) => handleToggleItem(item.id, !!val)} className="border-[#bc834e]/50" />
                <span className="font-bold text-sm">{item.itemName}</span>
              </div>
              <div className="flex items-center gap-3">
                <input type="number" value={item.quantity} onChange={(e) => handleUpdateQuantity(item.id, parseInt(e.target.value) || 0)} className="w-8 h-7 text-center font-black bg-[#bc834e]/10 rounded-lg text-xs text-[#bc834e]" />
                <Trash2 size={14} className="text-red-300" onClick={() => handleDelete(item.id)} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* QUADRO 2: MEU ESTOQUE */}
      <div className="px-4">
        <h2 className="flex items-center gap-2 font-black uppercase text-xs text-slate-600 mb-4 ml-2 tracking-tighter border-t pt-6 border-slate-100">
          <ClipboardList size={16}/> Insumos em Estoque (Anotação)
        </h2>
        <div className="space-y-2">
          {inventoryList.map(item => (
            <div key={item.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="font-bold text-sm text-slate-700 flex-1 ml-2">{item.itemName}</span>
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-center">
                  <span className="text-[7px] font-bold uppercase text-slate-400">Tem</span>
                  <input type="number" value={item.quantity} onChange={(e) => handleUpdateQuantity(item.id, parseInt(e.target.value) || 0)} className="w-10 h-7 text-center font-black bg-white border border-slate-200 rounded-lg text-xs" />
                </div>
                <Trash2 size={14} className="text-slate-300" onClick={() => handleDelete(item.id)} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}