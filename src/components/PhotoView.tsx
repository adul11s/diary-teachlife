import { useEffect, useState } from 'react';
import { fetchPhotoDataUri } from '../utils/upload';
import { Spinner } from './Spinner';

interface Props {
  fileId?: string | null;
  alt?: string;
  className?: string;
}

export function PhotoView({ fileId, alt = 'Foto', className = '' }: Props) {
  const [dataUri, setDataUri] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!fileId) return;
    setDataUri(null);
    setError(false);
    fetchPhotoDataUri(fileId).then(setDataUri).catch(() => setError(true));
  }, [fileId]);

  if (!fileId) return null;
  if (error) {
    return (
      <div className={`flex items-center justify-center rounded-xl bg-rose-50 text-xs text-rose-500 ${className}`}>
        Foto gagal dimuat
      </div>
    );
  }
  if (!dataUri) {
    return (
      <div className={`flex items-center justify-center rounded-xl bg-slate-100 ${className}`}>
        <Spinner className="border-slate-300 border-t-brand-600" />
      </div>
    );
  }
  return (
    <img
      src={dataUri}
      alt={alt}
      className={`aspect-square w-full rounded-xl object-cover ${className}`}
    />
  );
}
