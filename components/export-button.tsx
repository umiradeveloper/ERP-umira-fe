'use client';

import { FileDown, FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from './ui';
import { apiDownload } from '@/lib/api';

/** Tombol unduh laporan Excel / dokumen PDF dari API */
export function ExportButton({ path, label = 'Excel', kind = 'xlsx', size = 'md', variant = 'secondary' }: {
  path: string; label?: string; kind?: 'xlsx' | 'pdf'; size?: 'sm' | 'md'; variant?: 'secondary' | 'ghost';
}) {
  const [busy, setBusy] = useState(false);
  const Icon = kind === 'pdf' ? FileDown : FileSpreadsheet;
  return (
    <Button
      variant={variant}
      size={size}
      loading={busy}
      icon={<Icon className="size-4" />}
      onClick={async () => {
        setBusy(true);
        try {
          await apiDownload(path);
        } catch (e: any) {
          toast.error(e.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {label}
    </Button>
  );
}
