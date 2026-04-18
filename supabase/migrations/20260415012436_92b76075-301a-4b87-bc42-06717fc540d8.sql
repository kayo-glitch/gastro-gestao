-- Insert missing admin profile
INSERT INTO public.profiles (user_id, email, is_approved)
VALUES ('8bcd82b1-de75-4abb-8193-5e10abf2bfd9', 'kayob381@gmail.com', true)
ON CONFLICT (user_id) DO NOTHING;

-- Recreate trigger to ensure it's active for future signups
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();