import { TableView } from "@/components/data-browser/table-view";

export default async function TablePage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  return <TableView key={name} name={decodeURIComponent(name)} />;
}
