export type StaffUser = {
  id: number;
  username: string;
  email: string | null;
  role: string;
  is_active: number;
  failed_attempts?: number;
  locked_until?: string | null;
  created_at: string;
};
