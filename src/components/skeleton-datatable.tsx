/** Placeholder for a `DataTable` while its rows load: toolbar, empty body and pagination, as in the Fundsys app. */
const SkeletonDatatable = () => {
  return (
    <div className="w-full overflow-hidden rounded-lg border border-border">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
        <div className="flex gap-2">
          <div className="h-8 w-20 animate-pulse rounded-md bg-muted" />
          <div className="h-8 w-20 animate-pulse rounded-md bg-muted" />
        </div>
      </div>
      {/* Empty body */}
      <div className="h-40" />
      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-border">
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
        <div className="flex gap-1.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="size-7 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      </div>
    </div>
  );
};

export default SkeletonDatatable;
