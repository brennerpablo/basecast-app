import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/utils/initials";

/**
 * A user's initials on the brand fill. There is no image: the `User` model
 * has no picture field.
 */
export function UserAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <Avatar className={cn("size-6", className)}>
      <AvatarFallback className="bg-brand text-[10px] font-medium text-brand-foreground">
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
