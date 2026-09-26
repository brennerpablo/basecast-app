import { FileView } from "@/components/data-browser/file-view";
import { FolderView } from "@/components/data-browser/folder-view";
import { isFileKey, keyFromSegments } from "@/components/data-browser/lake-path";

/** The bucket, path for path: `/data/lake/raw/source=ercot_gis/dt=2026-08-01/<file>`. */
export default async function LakePage({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  const key = keyFromSegments(path);
  // A key per screen: moving between folders and files starts each one fresh.
  return isFileKey(key) ? <FileView key={key} lakeKey={key} /> : <FolderView key={key} lakeKey={key} />;
}
