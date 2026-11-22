import { useQuery } from "@tanstack/react-query";

import { api } from "./api";

export const useIsAdministrator = () =>
  useQuery({
    queryKey: ["admin", "status"],
    queryFn: () => api<{ admin: boolean }>("/admin/status").then((r) => r.admin),
    staleTime: Infinity,
  }).data === true;
