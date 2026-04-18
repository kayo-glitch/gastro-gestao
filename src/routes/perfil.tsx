import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/PageHeader";
import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/hooks/use-auth";
import { useApproval } from "@/hooks/use-approval";
import { BlockedScreen } from "@/components/BlockedScreen";
import { KeyRound, CheckCircle, LogOut, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/perfil")({
  head: () => ({
    meta: [
      { title: "Perfil — GastroGestão📈" },
      { name: "description", content: "Gerencie seu perfil e altere sua senha" },
    ],
  }),
  component: PerfilPage,
});

function PerfilPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { isApproved, loading: approvalLoading } = useApproval(user?.id);
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [user, authLoading, navigate]);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setSuccess("Senha alterada com sucesso!");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao alterar senha");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteAccount() {
    setError("");
    setSuccess("");
    setDeleting(true);

    try {
      const { error } = await supabase.rpc("delete_user_account");
      if (error) throw error;
      setDeleteDialogOpen(false);
      await signOut();
      navigate({ to: "/login" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao excluir conta");
    } finally {
      setDeleting(false);
    }
  }

  if (authLoading || approvalLoading || !user) return null;
  if (isApproved === false) return <BlockedScreen />;

  return (
    <div className="min-h-screen bg-background pb-24">
      <PageHeader title="Perfil" subtitle="Gerencie sua conta" />

      <div className="space-y-4 px-4">
        {/* Info do Usuário */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">{user.email}</p>
              <p className="text-sm text-muted-foreground">Conta ativa</p>
            </div>
          </div>
        </div>

        {/* Alterar Senha */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-foreground">Alterar Senha</h2>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-3">
            <Input
              type="password"
              placeholder="Nova senha (mín. 6 caracteres)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              className="h-12 text-base"
            />
            <Input
              type="password"
              placeholder="Confirmar nova senha"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className="h-12 text-base"
            />

            {error && (
              <p className="rounded-xl bg-destructive/10 p-3 text-center text-sm text-destructive">
                {error}
              </p>
            )}
            {success && (
              <p className="flex items-center justify-center gap-2 rounded-xl bg-green-100 p-3 text-center text-sm text-green-700 dark:bg-green-900/30 dark:text-green-400">
                <CheckCircle className="h-4 w-4" /> {success}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Salvando..." : "Alterar Senha"}
            </Button>
          </form>
        </div>

        {/* Sair */}
        <Button
          variant="outline"
          className="w-full gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4" /> Sair da conta
        </Button>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="w-full" disabled={deleting}>
              {deleting ? "Excluindo..." : "Excluir Conta"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir conta permanentemente?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acao remove sua conta e os dados relacionados. Esta operacao nao pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={(event) => {
                  event.preventDefault();
                  void handleDeleteAccount();
                }}
                disabled={deleting}
              >
                {deleting ? "Excluindo..." : "Sim, excluir conta"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <BottomNav />
    </div>
  );
}
