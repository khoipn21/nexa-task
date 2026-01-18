import { api } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useWorkspace(workspaceId?: string) {
  return useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => api.get(`/workspaces/${workspaceId}`),
    enabled: !!workspaceId,
  });
}

export function useWorkspaces() {
  return useQuery({
    queryKey: ["workspaces"],
    queryFn: () => api.get("/workspaces"),
  });
}

export function useUpdateWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.patch(`/workspaces/${id}`, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["workspace", id] });
    },
  });
}

export type DashboardStats = {
  openTasks: number;
  completedTasks: number;
  projects: number;
  members: number;
};

export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: () => api.get("/dashboard/stats"),
  });
}

// Types for workspace members
export type WorkspaceMember = {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
};

type MembershipResponse = {
  id: string;
  userId: string;
  role: string;
  user: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
};

/**
 * Fetch workspace members for assignee dropdown
 * Transforms API response to UI-expected Member format
 */
export function useWorkspaceMembers(workspaceId?: string) {
  return useQuery<WorkspaceMember[]>({
    queryKey: ["workspace-members", workspaceId],
    queryFn: async () => {
      const memberships: MembershipResponse[] = await api.get(
        `/workspaces/${workspaceId}/members`,
      );

      // Deduplicate members by user ID to prevent "duplicate options" error in Select components
      const uniqueMembers = new Map<string, WorkspaceMember>();
      memberships.forEach((m) => {
        if (!uniqueMembers.has(m.user.id)) {
          uniqueMembers.set(m.user.id, {
            id: m.user.id,
            name: m.user.name,
            avatarUrl: m.user.avatarUrl ?? undefined,
          });
        }
      });

      return Array.from(uniqueMembers.values());
    },
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000, // 5min cache
  });
}
