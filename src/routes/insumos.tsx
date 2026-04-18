import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, X, Check, Package, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/PageHeader";
import { BottomNav } from "@/components/BottomNav";
import type { Insumo, Unit, InsumoType } from "@/lib/types";
import { getUnitPrice } from "@/lib/types";
import { loadInsumos, saveInsumo, updateInsumo, deleteInsumo } from "@/lib/store";
import { useAuth } from "@/hooks/use-auth";
import { useApproval } from "@/hooks/use-approval";
import { BlockedScreen } from "@/components/BlockedScreen";
import { ListSkeleton } from "@/components/SkeletonScreens";

export const Route = createFileRoute("/insumos")({
  head: () => ({
    meta: [
      { title: "Insumos — GastroGestão📈" },
      { name: "description", content: "Cadastre e gerencie seus insumos de confeitaria" },
    ],
  }),
  component: InsumosPage,
});

const UNITS: { value: Unit; label: string }[] = [
  { value: "g", label: "g" },
  { value: "ml", label: "ml" },
  { value: "un", label: "un" },
];

const INSUMO_TYPES: { value: InsumoType; label: string }[] = [
  { value: "ingrediente", label: "Ingrediente" },
  { value: "embalagem", label: "Embalagem" },
];

function formatUnitLabel(unit: Unit): string {
  if (unit === "ml") return "ml";
  if (unit === "g") return "g";
  return "un";
}

function formatPackageLabel(size: number, unit: Unit): string {
  if (unit === "g" && size >= 1000) return `${(size / 1000).toFixed(size % 1000 === 0 ? 0 : 1)}kg`;
  if (unit === "ml" && size >= 1000) return `${(size / 1000).toFixed(size % 1000 === 0 ? 0 : 1)}L`;
  return `${size}${unit}`;
}

function InsumosPage() {
  const { user, loading: authLoading } = useAuth();
  const { isApproved, loading: approvalLoading } = useApproval(user?.id);
  const navigate = useNavigate();
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [packageSize, setPackageSize] = useState("");
  const [unit, setUnit] = useState<Unit>("g");
  const [insumoType, setInsumoType] = useState<InsumoType>("ingrediente");
  const [saving, setSaving] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    setDataLoading(true);
    loadInsumos()
      .then(setInsumos)
      .catch(console.error)
      .finally(() => setDataLoading(false));
  }, [user]);

  function resetForm() {
    setName("");
    setPurchasePrice("");
    setPackageSize("");
    setUnit("g");
    setInsumoType("ingrediente");
    setEditingId(null);
    setShowForm(false);
  }

  async function handleSave() {
    if (!name.trim() || !purchasePrice || !packageSize) return;
    const priceNum = parseFloat(purchasePrice);
    const sizeNum = parseFloat(packageSize);
    if (isNaN(priceNum) || priceNum < 0 || isNaN(sizeNum) || sizeNum <= 0) return;

    setSaving(true);
    try {
      if (editingId) {
        await updateInsumo(editingId, {
          name: name.trim(), purchasePrice: priceNum, packageSize: sizeNum, unit, type: insumoType,
        });
      } else {
        await saveInsumo({
          name: name.trim(), type: insumoType, purchasePrice: priceNum, packageSize: sizeNum, unit,
        });
      }
      setInsumos(await loadInsumos());
      resetForm();
    } catch (err) {
      console.error("Save failed", err);
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(insumo: Insumo) {
    setEditingId(insumo.id);
    setName(insumo.name);
    setPurchasePrice(String(insumo.purchasePrice));
    setPackageSize(String(insumo.packageSize));
    setUnit(insumo.unit);
    setInsumoType(insumo.type ?? "ingrediente");
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    try {
      await deleteInsumo(id);
      setInsumos(await loadInsumos());
    } catch (err) {
      console.error("Delete failed", err);
    }
  }

  if (authLoading || approvalLoading || dataLoading || !user) return <ListSkeleton />;
  if (isApproved === false) return <BlockedScreen />;

  return (
    <div className="min-h-screen bg-background pb-24">
      {saving && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/50 backdrop-blur-[1px]">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm text-foreground">Processando...</span>
          </div>
        </div>
      )}
      <PageHeader
        title="Insumos"
        subtitle={`${insumos.length} cadastrado${insumos.length !== 1 ? "s" : ""}`}
        action={
          !showForm && (
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus /> Novo
            </Button>
          )
        }
      />

      {showForm && (
        <div className="mx-4 mb-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-semibold text-foreground">
              {editingId ? "Editar insumo" : "Novo insumo"}
            </span>
            <button onClick={resetForm} className="text-muted-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>

          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Tipo de Insumo</p>
          <div className="mb-3 flex overflow-hidden rounded-xl border border-input">
            {INSUMO_TYPES.map((t) => (
              <button key={t.value} onClick={() => setInsumoType(t.value)}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  insumoType === t.value ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          <Input placeholder="Nome do insumo" value={name} onChange={(e) => setName(e.target.value)} className="mb-3 h-12 text-base" />
          <div className="mb-3 flex gap-2">
            <Input type="number" step="0.01" min="0" placeholder="Preço de compra (R$)" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} className="h-12 flex-1 text-base" />
            <Input type="number" step="0.01" min="0.01" placeholder="Qtd. na Embalagem" value={packageSize} onChange={(e) => setPackageSize(e.target.value)} className="h-12 w-32 text-base" />
          </div>

          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Unidade</p>
          <div className="mb-3 flex overflow-hidden rounded-xl border border-input">
            {UNITS.map((u) => (
              <button key={u.value} onClick={() => setUnit(u.value)}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  unit === u.value ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"
                }`}>
                {u.label}
              </button>
            ))}
          </div>

          {purchasePrice && packageSize && parseFloat(packageSize) > 0 && (
            <div className="mb-3 rounded-xl bg-primary/10 p-3 text-center">
              <p className="text-xs text-muted-foreground">Preço por {formatUnitLabel(unit)}</p>
              <p className="text-lg font-bold text-primary">
                R$ {(parseFloat(purchasePrice) / parseFloat(packageSize)).toFixed(4)}
              </p>
            </div>
          )}

          <Button className="w-full" onClick={handleSave} disabled={saving}>
            <Check /> {saving ? "Salvando..." : editingId ? "Salvar" : "Adicionar"}
          </Button>
        </div>
      )}

      <div className="space-y-2 px-4">
        {insumos.length === 0 && !showForm && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="mt-4 text-muted-foreground">Nenhum insumo cadastrado ainda.</p>
            <p className="text-sm text-muted-foreground">Toque em "Novo" para começar!</p>
          </div>
        )}
        {insumos.map((insumo) => {
          const unitPrice = getUnitPrice(insumo);
          return (
            <div key={insumo.id} className="glass-card glass-card-hover flex items-center justify-between rounded-2xl p-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-foreground">{insumo.name}</p>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {insumo.type === "embalagem" ? "Embalagem" : "Ingrediente"}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  R$ {insumo.purchasePrice.toFixed(2)} / {formatPackageLabel(insumo.packageSize, insumo.unit)}
                </p>
                <p className="text-xs text-primary font-medium">
                  R$ {unitPrice.toFixed(4)} / {formatUnitLabel(insumo.unit)}
                </p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => handleEdit(insumo)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(insumo.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <BottomNav />
    </div>
  );
}
