import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/utils/initials";

/** A user's photo, or their initials on the brand fill while there is none (or it fails to load). */
export function UserAvatar({
  name,
  image,
  className,
}: {
  name: string;
  image?: string | null;
  className?: string;
}) {
  return (
    <Avatar className={cn("size-6", className)}>
      {image ? <AvatarImage src={image} alt={name} className="object-cover" /> : null}
      <AvatarFallback className="bg-brand text-[10px] font-medium text-brand-foreground">
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
