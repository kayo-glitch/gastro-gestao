import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
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
  loadShoppingStockItems,
  toggleShoppingStockItem,
  deleteShoppingStockItem,
  type ShoppingStockItem,
} from "@/lib/store";

export const Route = createFileRoute("/estoque")({
  head: () => ({
    meta: [
      { title: "Estoque — GastroGestão📈" },
      { name: "description", content: "Lista de insumos para comprar" },
    ],
  }),
  component: EstoquePage,
});

function EstoquePage() {
  const { user, loading: authLoading } = useAuth();
  const { isApproved, loading: approvalLoading } = useApproval(user?.id);
  const navigate = useNavigate();

  const [items, setItems] = useState<ShoppingStockItem[]>([]);
  const [newItemName, setNewItemName] = useState("");
  const [dataLoading, setDataLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [user, authLoading, navigate]);

  async function fetchItems() {
    setDataLoading(true);
    try {
      const data = await loadShoppingStockItems();
      setItems(data);
    } catch (error) {
      console.error("Failed to load stock items", error);
      toast.error("Não foi possível carregar a lista.");
    } finally {
      setDataLoading(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    void fetchItems();
  }, [user]);

  async function handleAddItem() {
    if (!newItemName.trim() || !user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("estoque_compras").insert({
        user_id: user.id,
        item_name: newItemName.trim(),
        checked: false,
      });
      if (error) throw error;

      setNewItemName("");
      await fetchItems();
      toast.success("Item adicionado!");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao adicionar item.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleItem(id: string, checked: boolean) {
    try {
      await toggleShoppingStockItem(id, checked);
      setItems((previous) =>
        previous.map((item) => (item.id === id ? { ...item, checked } : item))
      );
    } catch (error) {
      toast.error("Erro ao atualizar item.");
    }
  }

  async function handleDeleteItem(id: string) {
    try {
      await deleteShoppingStockItem(id);
      setItems((previous) => previous.filter((item) => item.id !== id));
      toast.success("Item removido");
    } catch (error) {
      toast.error("Erro ao remover item.");
    }
  }

  if (authLoading || approvalLoading || dataLoading || !user) return <ListSkeleton />;
  if (isApproved === false) return <BlockedScreen />;

  return (
    <div className="min-h-screen bg-background pb-24">
      <PageHeader title="Estoque" subtitle={`${items.length} itens na lista`} />

      <div className="mx-4 mb-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex gap-2">
          <Input
            placeholder="Adicionar item para comprar"
            value={newItemName}
            onChange={(event) => setNewItemName(event.target.value)}
            className="h-11"
            onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
          />
          <Button onClick={handleAddItem} disabled={saving} className="h-11 w-11 p-0">
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="space-y-2 px-4">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Sua lista de compras está vazia.
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <Checkbox
                  id={`item-${item.id}`}
                  checked={item.checked}
                  onCheckedChange={(value) => handleToggleItem(item.id, Boolean(value))}
                />
                <label
                  htmlFor={`item-${item.id}`}
                  className={cn(
                    "truncate font-medium transition-all cursor-pointer",
                    item.checked ? "text-muted-foreground line-through" : "text-foreground"
                  )}
                >
                  {item.itemName}
                </label>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={() => handleDeleteItem(item.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>

      <BottomNav />
    </div>
  );
}

// Função auxiliar para classes (caso não esteja importada)
function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}