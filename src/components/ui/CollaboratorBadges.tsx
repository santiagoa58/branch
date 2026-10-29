import type { CollaboratorUser } from "@/hooks/useCollaboration";

interface CollaboratorBadgesProps {
  users: CollaboratorUser[];
  maxVisible?: number;
}

export function CollaboratorBadges({ users, maxVisible = 5 }: CollaboratorBadgesProps) {
  if (users.length === 0) {
    return null;
  }

  const visible = users.slice(0, maxVisible);
  const overflow = users.length - maxVisible;

  return (
    <div className="flex items-center gap-1">
      <div className="flex -space-x-1.5">
        {visible.map((user) => (
          <div
            key={`${user.name}-${user.color}`}
            title={user.name}
            className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white ring-2 ring-white dark:ring-zinc-950 transition-transform hover:scale-110 hover:z-10"
            style={{ backgroundColor: user.color }}
          >
            {user.name.charAt(0).toUpperCase()}
          </div>
        ))}
        {overflow > 0 && (
          <div
            title={`${overflow} more`}
            className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-medium bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 ring-2 ring-white dark:ring-zinc-950"
          >
            +{overflow}
          </div>
        )}
      </div>
      <span className="text-xs text-zinc-500 dark:text-zinc-400 ml-1">{users.length} online</span>
    </div>
  );
}
