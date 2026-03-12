export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-8 text-center">
      <h3 className="text-base font-semibold text-[#1E3A5F]">{title}</h3>
      {description ? <p className="text-sm text-gray-500">{description}</p> : null}
    </div>
  );
}
