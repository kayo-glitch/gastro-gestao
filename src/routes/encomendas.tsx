import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Calendar as CalendarIcon, Plus, Trash2, CheckCircle2, Archive, RotateCcw, X, Pencil } from "lucide-react";
import { format, parseISO, isValid, isToday, isTomorrow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PageHeader } from "@/components/PageHeader";
import { BottomNav } from "@/components/BottomNav";
import { BlockedScreen } from "@/components/BlockedScreen";
import { ListSkeleton } from "@/components/SkeletonScreens";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useApproval } from "@/hooks/use-approval";
import { 
  loadEncomendas, 
  deleteEncomenda, 
  arquivarEncomenda, 
  loadEncomendasArquivadas, 
  desarquivarEncomenda,
  type Encomenda 
} from "@/lib/store";

export const Route = createFileRoute("/encomendas")({
  head: () => ({
    meta: [
      { title: "Encomendas — GastroGestão📈" },
      { name: "description", content: "Gerencie encomendas por cliente e data de entrega" },
    ],
  }),
  component: EncomendasPage,
});

function EncomendasPage() {
  const { user, loading: authLoading } = useAuth();
  const { isApproved, loading: approvalLoading } = useApproval(user?.id);
  const navigate = useNavigate();

  // Estados principais
  const [orders, setOrders] = useState<Encomenda[]>([]);
  const [archivedOrders, setArchivedOrders] = useState<Encomenda[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Encomenda | null>(null);

  // Estados do formulário e edição
  const [editingId, setEditingId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [deliveryDate, setDeliveryDate] = useState<Date | undefined>(undefined);
  const [orderDescription, setOrderDescription] = useState("");
  const [extraInsumos, setExtraInsumos] = useState("");
  
  const [dataLoading, setDataLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [user, authLoading, navigate]);

  async function fetchOrders() {
    setDataLoading(true);
    try {
      const [ativas, arquivadas] = await Promise.all([
        loadEncomendas(),
        loadEncomendasArquivadas()
      ]);
      setOrders(ativas);
      setArchivedOrders(arquivadas);
    } catch (error) {
      console.error("Failed to load encomendas", error);
      toast.error("Não foi possível carregar as encomendas.");
    } finally {
      setDataLoading(false);
    }
  }

  useEffect(() => {
    if (user) void fetchOrders();
  }, [user]);

  // Função para carregar dados no formulário para editar
  function handleEdit(order: Encomenda) {
    setEditingId(order.id);
    setCustomerName(order.customerName);
    setDeliveryDate(parseISO(order.deliveryDate));
    setOrderDescription(order.orderDescription || "");
    setExtraInsumos(order.extraInsumos || "");
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetForm() {
    setEditingId(null);
    setCustomerName("");
    setDeliveryDate(undefined);
    setOrderDescription("");
    setExtraInsumos("");
  }

  async function handleSaveOrder() {
    if (!customerName.trim() || !deliveryDate || !user) {
      toast.error("Preencha o nome e a data!");
      return;
    }

    setSaving(true);
    try {
      const orderData = {
        user_id: user.id,
        cliente_nome: customerName.trim(),
        data_entrega: format(deliveryDate, "yyyy-MM-dd"),
        order_description: orderDescription.trim(),
        extra_insumos: extraInsumos.trim(),
      };

      let error;
      if (editingId) {
        // Lógica de Update
        const { error: updateError } = await (supabase.from("encomendas") as any)
          .update(orderData)
          .eq('id', editingId);
        error = updateError;
      } else {
        // Lógica de Insert
        const { error: insertError } = await (supabase.from("encomendas") as any)
          .insert({ ...orderData, arquivada: false });
        error = insertError;
      }

      if (error) throw error;

      resetForm();
      await fetchOrders();
      toast.success(editingId ? "Encomenda atualizada!" : "Encomenda salva com sucesso!");
    } catch (error) {
      console.error("Save failed", error);
      toast.error("Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja excluir esta encomenda?")) return;
    try {
      await deleteEncomenda(id);
      await fetchOrders();
      toast.success("Encomenda excluída!");
    } catch (error) {
      toast.error("Erro ao excluir.");
    }
  }

  async function handleArchive(id: string) {
    try {
      await arquivarEncomenda(id);
      await fetchOrders();
      toast.success("Encomenda entregue e arquivada! 🍰");
    } catch (error) {
      toast.error("Erro ao arquivar.");
    }
  }

  async function handleRestore(id: string) {
    try {
      await desarquivarEncomenda(id);
      await fetchOrders();
      toast.success("Encomenda restaurada!");
    } catch (error) {
      toast.error("Erro ao restaurar.");
    }
  }

  const groupedByDate = useMemo(() => {
    const groups = new Map<string, Encomenda[]>();
    for (const order of orders) {
      const dateKey = order.deliveryDate;
      if (!dateKey) continue;
      if (!groups.has(dateKey)) groups.set(dateKey, []);
      groups.get(dateKey)?.push(order);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [orders]);

  if (authLoading || approvalLoading || dataLoading || !user) return <ListSkeleton />;
  if (isApproved === false) return <BlockedScreen />;

  return (
    <div className="min-h-screen bg-background pb-24">
      <PageHeader title="Encomendas" subtitle={`${orders.length} pendentes`} />

      {/* FORMULÁRIO (USA A MESMA UI PARA ADICIONAR OU EDITAR) */}
      <div className="mx-4 mb-4 rounded-2xl border border-[#bc834e]/20 bg-card p-4 shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <p className="text-sm font-semibold text-foreground">
            {editingId ? "Editando encomenda" : "Nova encomenda"}
          </p>
          {editingId && (
            <button onClick={resetForm} className="text-xs text-destructive font-bold">Cancelar</button>
          )}
        </div>
        <div className="space-y-3">
          <Input
            placeholder="Nome do Cliente"
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            className="h-11"
          />

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn("h-11 w-full justify-start text-left font-normal", !deliveryDate && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {deliveryDate ? format(deliveryDate, "dd/MM/yyyy", { locale: ptBR }) : "Data de Entrega"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={deliveryDate}
                onSelect={setDeliveryDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <Textarea
            placeholder="Descrição do Pedido"
            value={orderDescription}
            onChange={(event) => setOrderDescription(event.target.value)}
            className="min-h-20"
          />
          <Input
            placeholder="Insumos Extras (ex: Topo de bolo)"
            value={extraInsumos}
            onChange={(event) => setExtraInsumos(event.target.value)}
            className="h-11"
          />

          <Button className="w-full h-11 bg-[#bc834e] hover:bg-[#a67243]" onClick={handleSaveOrder} disabled={saving}>
            <CheckCircle2 className={cn("mr-2 h-4 w-4", saving && "animate-spin")} />
            {saving ? "Salvando..." : editingId ? "Atualizar Encomenda" : "Adicionar Encomenda"}
          </Button>
        </div>
      </div>

      {/* LISTA ATIVA */}
      <div className="space-y-6 px-4">
        {groupedByDate.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground font-medium">
            Nenhuma encomenda pendente.
          </div>
        ) : (
          groupedByDate.map(([date, items]) => {
            const parsedDate = parseISO(date);
            const isNear = isToday(parsedDate) || isTomorrow(parsedDate);

            return (
              <div key={date} className="space-y-2">
                <p className={cn(
                  "text-[10px] font-black uppercase tracking-widest",
                  isNear ? "text-green-600" : "text-muted-foreground"
                )}>
                  {isValid(parsedDate) 
                    ? format(parsedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })
                    : "Data inválida"}
                  {isToday(parsedDate) && " • HOJE"}
                  {isTomorrow(parsedDate) && " • AMANHÃ"}
                </p>
                
                {items.map((item) => (
                  <div 
                    key={item.id} 
                    className={cn(
                      "relative rounded-2xl border bg-card p-4 shadow-sm transition-all",
                      isNear ? "border-green-500/30 bg-green-50/50" : "border-border"
                    )}
                  >
                    <div className="flex justify-between items-start">
                      <div className="pr-20 cursor-pointer flex-1" onClick={() => setSelectedOrder(item)}>
                        <p className="font-bold text-foreground text-lg">{item.customerName}</p>
                        {item.orderDescription && (
                          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{item.orderDescription}</p>
                        )}
                      </div>

                      <div className="flex gap-1">
                        {/* BOTÃO EDITAR */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-blue-600 hover:bg-blue-50"
                          onClick={() => handleEdit(item)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-green-600 hover:bg-green-100"
                          onClick={() => handleArchive(item.id)}
                        >
                          <CheckCircle2 className="h-5 w-5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>

      {/* SEÇÃO DE ARQUIVADOS E MODAL DE DETALHES (CONTINUAM IGUAIS AO ANTERIOR) */}
      <div className="mt-12 px-4 pb-12">
        <Button 
          variant="ghost" 
          className="w-full border-t border-dashed border-border pt-6 text-muted-foreground flex justify-between rounded-none hover:bg-transparent"
          onClick={() => setShowArchived(!showArchived)}
        >
          <span className="text-xs font-bold uppercase tracking-widest">
            {showArchived ? "Ocultar Histórico" : "Ver Entregues (Arquivados)"}
          </span>
          <Archive className="h-4 w-4" />
        </Button>

        {showArchived && (
          <div className="mt-4 space-y-3">
            {archivedOrders.length === 0 ? (
              <p className="text-center text-xs py-8 text-muted-foreground">Nenhuma encomenda arquivada.</p>
            ) : (
              archivedOrders.map((item) => (
                <div key={item.id} className="rounded-xl border border-dashed bg-muted/20 p-3 flex justify-between items-center opacity-70">
                  <div className="overflow-hidden flex-1 cursor-pointer" onClick={() => setSelectedOrder(item)}>
                    <p className="font-bold text-sm truncate underline decoration-primary/30">{item.customerName}</p>
                    <p className="text-[10px] text-muted-foreground">Ver detalhes</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-7 px-2 text-[10px] gap-1 border-primary/30 text-primary"
                    onClick={() => handleRestore(item.id)}
                  >
                    <RotateCcw className="h-3 w-3" />
                    Restaurar
                  </Button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setSelectedOrder(null)}>
          <div className="w-full max-w-sm rounded-3xl bg-[#faf7f2] p-6 shadow-2xl animate-in zoom-in-95 duration-200 border border-[#bc834e]/20" onClick={e => e.stopPropagation()}>
            <div className="mb-5 flex justify-between items-center border-b border-[#bc834e]/10 pb-4">
              <h3 className="text-lg font-bold text-foreground">Detalhes do Pedido</h3>
              <Button variant="ghost" size="icon" onClick={() => setSelectedOrder(null)} className="rounded-full">
                <X className="h-5 w-5 text-muted-foreground" />
              </Button>
            </div>
            
            <div className="space-y-6">
              <section>
                <p className="text-[10px] uppercase font-bold text-[#bc834e] tracking-widest mb-1">Cliente</p>
                <p className="text-xl font-bold text-foreground">{selectedOrder.customerName}</p>
              </section>

              <section>
                <p className="text-[10px] uppercase font-bold text-[#bc834e] tracking-widest mb-1">O que foi pedido</p>
                <div className="bg-white p-4 rounded-2xl italic text-sm text-foreground leading-relaxed border border-[#bc834e]/10 shadow-sm">
                  {selectedOrder.orderDescription || "Sem descrição detalhada."}
                </div>
              </section>

              {selectedOrder.extraInsumos && (
                <section>
                  <p className="text-[10px] uppercase font-bold text-[#bc834e] tracking-widest mb-1">Insumos Extras</p>
                  <div className="bg-[#bc834e]/10 px-4 py-3 rounded-xl border border-[#bc834e]/30">
                    <p className="text-sm text-[#a67243] font-bold">
                      {selectedOrder.extraInsumos}
                    </p>
                  </div>
                </section>
              )}

              <section className="flex justify-between items-center pt-4 border-t border-[#bc834e]/10">
                <div>
                  <p className="text-[10px] uppercase font-bold text-[#bc834e] tracking-widest">Entrega prevista</p>
                  <p className="text-sm font-bold text-foreground">
                    {isValid(parseISO(selectedOrder.deliveryDate)) 
                      ? format(parseISO(selectedOrder.deliveryDate), "dd/MM/yyyy")
                      : selectedOrder.deliveryDate}
                  </p>
                </div>
                <div className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tighter shadow-sm",
                  selectedOrder.arquivada ? "bg-muted text-muted-foreground" : "bg-green-500 text-white"
                )}>
                  {selectedOrder.arquivada ? "Entregue" : "Pendente"}
                </div>
              </section>
            </div>
            
            <Button className="w-full mt-8 h-12 rounded-2xl text-base font-bold bg-[#bc834e] text-white" onClick={() => setSelectedOrder(null)}>
              Fechar Detalhes
            </Button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}