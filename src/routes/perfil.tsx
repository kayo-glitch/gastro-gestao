import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { KeyRound, CheckCircle, LogOut, User, MessageCircle, MessageSquare, Send, ShieldCheck, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { APP_CURRENCIES, type AppLanguage, usePreferences } from "@/lib/preferences";

export const Route = createFileRoute("/perfil")({
  head: () => ({
    meta: [
      { title: "Perfil — GastroGestão📈" },
      { name: "description", content: "Gerencie seu perfil e fale conosco" },
    ],
  }),
  component: PerfilPage,
});

function PerfilPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { isApproved, loading: approvalLoading } = useApproval(user?.id);
  const { preferences, setPreferences } = usePreferences();
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sendingFeedback, setSendingFeedback] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [language, setLanguage] = useState<AppLanguage>(preferences.language);
  const [currency, setCurrency] = useState(preferences.currency);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const SEU_WHATSAPP = "543417819916"; 

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
      toast.success("Senha atualizada!");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao alterar senha");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendFeedback() {
    if (!feedback.trim()) return;
    setSendingFeedback(true);
    try {
      const { error } = await (supabase.from("feedbacks") as any).insert({
        user_id: user?.id,
        user_email: user?.email,
        message: feedback.trim()
      });
      if (error) throw error;
      toast.success("Feedback enviado! Obrigado.");
      setFeedback("");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao enviar feedback.");
    } finally {
      setSendingFeedback(false);
    }
  }

  const handleSupportClick = () => {
    const msg = encodeURIComponent("Olá! Preciso de suporte com o GastroGestão.");
    window.open(`https://wa.me/${SEU_WHATSAPP}?text=${msg}`, "_blank");
  };

  function handleSavePreferences() {
    setPreferences({ language, currency });
    toast.success("Preferências atualizadas!");
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      // Chamada da função RPC que você criou no SQL do Supabase
      const { error } = await (supabase.rpc as any)("delete_user_account");
      
      if (error) throw error;

      toast.success("Conta excluída com sucesso.");
      await signOut();
      navigate({ to: "/login" });
    } catch (err: unknown) {
      console.error(err);
      toast.error("Erro ao excluir conta. Tente novamente.");
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  }

  if (authLoading || approvalLoading || !user) return null;
  if (isApproved === false) return <BlockedScreen />;

  return (
    <div className="min-h-screen bg-[#faf7f2] pb-32 font-sans">
      <PageHeader title="Perfil" subtitle="Gerencie sua conta e fale conosco" />

      <div className="space-y-6 px-4 max-w-md mx-auto mt-4">
        {/* INFO DO USUÁRIO */}
        <div className="rounded-[32px] border border-[#bc834e]/10 bg-white p-6 shadow-sm flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#bc834e]/10 text-[#bc834e]">
            <User className="h-7 w-7" />
          </div>
          <div className="overflow-hidden">
            <p className="font-black text-slate-900 truncate tracking-tight">{user.email}</p>
            <div className="flex items-center gap-1">
                <ShieldCheck size={12} className="text-green-600" />
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Acesso Ativo</p>
            </div>
          </div>
        </div>

        {/* IDIOMA E MOEDA */}
        <div className="rounded-[32px] border border-[#bc834e]/10 bg-white p-6 shadow-sm space-y-4">
          <div>
            <p className="text-[10px] font-black uppercase text-[#bc834e] mb-2 tracking-widest">Idioma do app</p>
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value as AppLanguage)}
              className="h-12 w-full rounded-xl border border-[#bc834e]/20 bg-[#faf7f2] px-3 text-sm font-bold text-slate-700 outline-none"
            >
              <option value="pt-BR">Português</option>
              <option value="es">Español</option>
            </select>
          </div>

          <div>
            <p className="text-[10px] font-black uppercase text-[#bc834e] mb-2 tracking-widest">Moeda</p>
            <select
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              className="h-12 w-full rounded-xl border border-[#bc834e]/20 bg-[#faf7f2] px-3 text-sm font-bold text-slate-700 outline-none"
            >
              {APP_CURRENCIES.map((item) => (
                <option key={item.code} value={item.code}>{item.label}</option>
              ))}
            </select>
          </div>

          <Button onClick={handleSavePreferences} className="w-full h-12 bg-[#bc834e] text-white font-black rounded-xl active:scale-95 transition-all">
            Salvar idioma e moeda
          </Button>
        </div>

        {/* AJUDA E FEEDBACK */}
        <div className="space-y-3">
            <p className="text-[10px] font-black uppercase text-[#bc834e] ml-4 tracking-[0.2em]">Atendimento</p>
            
            <button onClick={handleSupportClick} className="w-full flex items-center justify-between bg-white p-5 rounded-[24px] border border-[#bc834e]/10 shadow-sm hover:shadow-md transition-all active:scale-95 group">
                <div className="flex items-center gap-4">
                    <div className="bg-green-100 p-3 rounded-2xl text-green-600"><MessageCircle size={24} /></div>
                    <div className="text-left">
                        <p className="font-black text-slate-900 text-sm uppercase">Suporte WhatsApp</p>
                        <p className="text-[11px] text-slate-400 font-medium">Tire suas dúvidas agora</p>
                    </div>
                </div>
            </button>

            <div className="bg-white p-6 rounded-[32px] border border-[#bc834e]/10 shadow-sm space-y-4">
                <div className="flex items-center gap-3 text-blue-600">
                    <MessageSquare size={20} />
                    <h3 className="font-black text-sm uppercase tracking-tight">Dar Feedback</h3>
                </div>
                <Textarea 
                  placeholder="Como podemos melhorar o app para você?" 
                  value={feedback} 
                  onChange={(e) => setFeedback(e.target.value)} 
                  className="min-h-[100px] rounded-2xl border-slate-100 bg-[#faf7f2] focus-visible:ring-[#bc834e] text-sm font-medium" 
                />
                <Button onClick={handleSendFeedback} disabled={sendingFeedback || !feedback.trim()} className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl gap-2 active:scale-95 transition-all">
                    <Send size={16} /> {sendingFeedback ? "Enviando..." : "Enviar Sugestão"}
                </Button>
            </div>
        </div>

        {/* SEGURANÇA */}
        <div className="rounded-[32px] border border-[#bc834e]/10 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="bg-[#bc834e]/10 p-2 rounded-lg"><KeyRound className="h-5 w-5 text-[#bc834e]" /></div>
            <h2 className="font-black text-slate-900 uppercase text-xs tracking-widest">Alterar Senha</h2>
          </div>
          <form onSubmit={handleChangePassword} className="space-y-3">
            <Input type="password" placeholder="Nova senha" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required className="h-12 rounded-xl bg-[#faf7f2] border-none" />
            <Input type="password" placeholder="Confirme a senha" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="h-12 rounded-xl bg-[#faf7f2] border-none" />
            {error && <p className="rounded-xl bg-red-50 p-3 text-center text-xs font-bold text-red-600 border border-red-100">{error}</p>}
            {success && <p className="rounded-xl bg-green-50 p-3 text-center text-xs font-bold text-green-700 border border-green-100">{success}</p>}
            <Button type="submit" className="w-full h-12 bg-[#bc834e] text-white font-black rounded-xl active:scale-95 transition-all" disabled={submitting}>
              {submitting ? "Salvando..." : "Atualizar Senha"}
            </Button>
          </form>
        </div>

        {/* BOTÕES DE SAÍDA */}
        <div className="space-y-3 pt-4">
            <Button variant="outline" className="w-full h-12 gap-2 text-slate-500 border-slate-200 rounded-xl font-bold active:scale-95 transition-all" onClick={signOut}>
                <LogOut className="h-4 w-4" /> Sair da conta
            </Button>

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogTrigger asChild>
                    <button className="w-full flex items-center justify-center gap-2 text-center text-[10px] font-black text-red-400 uppercase tracking-widest hover:text-red-600 py-2 transition-colors">
                       <Trash2 size={12} /> Excluir minha conta permanentemente
                    </button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-[32px] border-[#bc834e]/20">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="font-black text-slate-900">Atenção total!</AlertDialogTitle>
                        <AlertDialogDescription className="font-medium text-slate-500">
                            Ao excluir sua conta, **todos os seus dados** (insumos, receitas e histórico de lucro) serão apagados para sempre. Não há como desfazer isso.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex flex-col gap-2 sm:flex-row">
                        <AlertDialogCancel className="rounded-xl font-bold border-slate-200">Cancelar</AlertDialogCancel>
                        <AlertDialogAction 
                          className="bg-red-600 text-white hover:bg-red-700 rounded-xl font-bold" 
                          onClick={(event) => { event.preventDefault(); void handleDeleteAccount(); }} 
                          disabled={deleting}
                        >
                            {deleting ? "Excluindo..." : "Sim, excluir tudo"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
