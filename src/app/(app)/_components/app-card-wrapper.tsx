import { Card } from "@/components/components-app/ui/card";

export function AppCardWrapper({ children }: { children: React.ReactNode }) {
  return (
    // `100svh - 2rem`, not `min-h-screen`: the card lives inside
    // `<main className="p-4">` and the window scrolls. A 100vh minimum would add
    // to the padding and leave ~32px of dead scroll on every short page.
    <Card className="h-full min-h-[calc(100svh-2rem)] w-full max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:p-0 max-md:shadow-none max-md:ring-0">
      {children}
    </Card>
  );
}
