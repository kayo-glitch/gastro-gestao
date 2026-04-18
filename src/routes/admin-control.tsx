import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Shield, Check, X, RefreshCw, Users, Clock, CakeSlice, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AdminSkeleton } from "@/components/SkeletonScreens";

const ADMIN_EMAIL = "kayob381@gmail.com";

export const Route = createFileRoute("/admin-control")({
  head: () => ({
    meta: [{ title: "Admin — GastroGestão📈" }],
  }),
  component: AdminControlPage,
});

interface Profile {
  id: string;
  user_id: string;
  email: string | null;
  is_approved: boolean;
  created_at: string;
}

interface ProfileWithUsage extends Profile {
  total_insumos: number;
  total_receitas: number;
}

function AdminControlPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<ProfileWithUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/login" });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    if (user.email !== ADMIN_EMAIL) {
      navigate({ to: "/" });
      return;
    }
    fetchProfiles();
  }, [user]);

  async function fetchProfiles() {
    setLoading(true);
    try {
      const { data: profilesData, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to load profiles", error);
        setLoading(false);
        return;
      }

      const typedProfiles = (profilesData as Profile[]) ?? [];

      // Fetch usage counts for each user
      const enriched: ProfileWithUsage[] = await Promise.all(
        typedProfiles.map(async (profile) => {
          const [insumosRes, receitasRes] = await Promise.all([
            supabase.from("insumos").select("id", { count: "exact", head: true }).eq("user_id", profile.user_id),
            supabase.from("produtos").select("id", { count: "exact", head: true }).eq("user_id", profile.user_id),
          ]);
          return {
            ...profile,
            total_insumos: insumosRes.count ?? 0,
            total_receitas: receitasRes.count ?? 0,
          };
        })
      );

      setProfiles(enriched);
    } catch (err) {
      console.error("Fetch failed", err);
    }
    setLoading(false);
  }

  async function toggleApproval(profile: ProfileWithUsage) {
    setToggling(profile.id);
    const { error } = await supabase
      .from("profiles")
      .update({ is_approved: !profile.is_approved })
      .eq("id", profile.id);
    if (error) {
      console.error("Toggle failed", error);
    } else {
      setProfiles((prev) =>
        prev.map((p) =>
          p.id === profile.id ? { ...p, is_approved: !p.is_approved } : p
        )
      );
    }
    setToggling(null);
  }

  if (authLoading || !user) return null;
  if (user.email !== ADMIN_EMAIL) return null;

  const totalActive = profiles.filter((p) => p.is_approved).length;
  const totalPending = profiles.filter((p) => !p.is_approved).length;
  const totalReceitas = profiles.reduce((sum, p) => sum + p.total_receitas, 0);

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Painel Admin</h1>
              <p className="text-xs text-muted-foreground">Gerenciar acessos</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={fetchProfiles} className="transition-transform hover:rotate-180 duration-500">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {loading ? (
          <AdminSkeleton />
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="glass-card rounded-2xl p-4 text-center">
                <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                  <Users className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <p className="text-2xl font-bold text-foreground">{totalActive}</p>
                <p className="text-[10px] text-muted-foreground">Ativos</p>
              </div>
              <div className="glass-card rounded-2xl p-4 text-center">
                <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                  <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <p className="text-2xl font-bold text-foreground">{totalPending}</p>
                <p className="text-[10px] text-muted-foreground">Aguardando</p>
              </div>
              <div className="glass-card rounded-2xl p-4 text-center">
                <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                  <CakeSlice className="h-4 w-4 text-primary" />
                </div>
                <p className="text-2xl font-bold text-foreground">{totalReceitas}</p>
                <p className="text-[10px] text-muted-foreground">Receitas (total)</p>
              </div>
            </div>

            {/* User list */}
            {profiles.length === 0 ? (
              <p className="text-center text-muted-foreground">Nenhum usuário cadastrado.</p>
            ) : (
              <div className="space-y-2">
                {profiles.map((profile) => (
                  <div
                    key={profile.id}
                    className="glass-card glass-card-hover flex items-center justify-between rounded-2xl p-4"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {profile.email ?? "Sem e-mail"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(profile.created_at).toLocaleDateString("pt-BR")}
                      </p>
                      <div className="flex gap-3 mt-1">
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Package className="h-3 w-3" /> {profile.total_insumos} insumos
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <CakeSlice className="h-3 w-3" /> {profile.total_receitas} receitas
                        </span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={profile.is_approved ? "default" : "outline"}
                      disabled={toggling === profile.id}
                      onClick={() => toggleApproval(profile)}
                      className="gap-1.5 shrink-0 ml-3"
                    >
                      {profile.is_approved ? (
                        <>
                          <Check className="h-4 w-4" /> Ativo
                        </>
                      ) : (
                        <>
                          <X className="h-4 w-4" /> Bloqueado
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
