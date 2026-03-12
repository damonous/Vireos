export function LoadingState({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center p-8 text-sm text-gray-500">
      {label}
    </div>
  );
}
