import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

/** Whether the signed-in account may open the admin screen; the Worker decides. */
export const useIsAdministrator = () =>
  useQuery({ queryKey: ["admin", "status"], queryFn: () => api<{ admin: boolean }>("/admin/status").then((r) => r.admin), staleTime: Infinity }).data === true;
