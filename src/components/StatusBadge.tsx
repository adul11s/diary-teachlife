/** Komponen UI kecil untuk menampilkan badge status */
export function StatusBadge({ status }: { status: 'Draft' | 'Published' }) {
  const isPublished = status === 'Published';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        isPublished
          ? 'bg-brand-100 text-brand-700'
          : 'bg-amber-100 text-amber-700'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          isPublished ? 'bg-brand-500' : 'bg-amber-500'
        }`}
      />
      {isPublished ? 'Published' : 'Draft'}
    </span>
  );
}