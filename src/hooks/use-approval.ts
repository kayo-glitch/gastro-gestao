import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useApproval(userId: string | undefined) {
  const [isApproved, setIsApproved] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    async function check() {
      const { data, error } = await supabase
        .from("profiles")
        .select("is_approved")
        .eq("user_id", userId!)
        .maybeSingle();

      if (error) {
        console.error("Failed to check approval", error);
        setIsApproved(false);
      } else if (!data) {
        // Profile not yet created by trigger — treat as not approved
        setIsApproved(false);
      } else {
        setIsApproved(data.is_approved);
      }
      setLoading(false);
    }

    check();
  }, [userId]);

  return { isApproved, loading };
}
