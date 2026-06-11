import type { ReactNode } from 'react';
import { cn } from './lib/cn';

export interface IconProps {
  className?: string;
}

function icon(path: ReactNode) {
  return function Icon({ className }: IconProps) {
    return (
      <svg
        viewBox="0 0 24 24"
        className={cn('h-5 w-5', className)}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {path}
      </svg>
    );
  };
}

export const FolderIcon = icon(<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />);
export const FileIcon = icon(<><path d="M6 3h8l4 4v14a0 0 0 0 1 0 0H6a0 0 0 0 1 0 0V3Z" /><path d="M14 3v4h4" /></>);
export const ImageIcon = icon(<><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="m4 18 5-5 4 4 3-3 4 4" /></>);
export const MusicIcon = icon(<><path d="M9 18V6l10-2v12" /><circle cx="6" cy="18" r="3" /><circle cx="16" cy="16" r="3" /></>);
export const VideoIcon = icon(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m10 9 5 3-5 3V9Z" /></>);
export const FileTextIcon = icon(<><path d="M6 3h8l4 4v14H6V3Z" /><path d="M14 3v4h4" /><path d="M8 12h8M8 16h6" /></>);
export const PdfIcon = icon(<><path d="M6 3h8l4 4v14H6V3Z" /><path d="M14 3v4h4" /><path d="M8 13h1.5a1.5 1.5 0 0 1 0 3H8v-3Zm0 0v5" /></>);
export const UploadIcon = icon(<><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M5 20h14" /></>);
export const DownloadIcon = icon(<><path d="M12 4v12" /><path d="m7 11 5 5 5-5" /><path d="M5 20h14" /></>);
export const TrashIcon = icon(<><path d="M4 7h16" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /><path d="M6 7l1 13h10l1-13" /></>);
export const PencilIcon = icon(<path d="M4 20h4L20 8l-4-4L4 16v4Z" />);
export const FolderPlusIcon = icon(<><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /><path d="M12 11v5M9.5 13.5h5" /></>);
export const PlusIcon = icon(<path d="M12 5v14M5 12h14" />);
export const ChevronRightIcon = icon(<path d="m9 6 6 6-6 6" />);
export const ChevronLeftIcon = icon(<path d="m15 6-6 6 6 6" />);
export const ChevronDownIcon = icon(<path d="m6 9 6 6 6-6" />);
export const GridIcon = icon(<><rect x="4" y="4" width="6" height="6" rx="1.4" /><rect x="14" y="4" width="6" height="6" rx="1.4" /><rect x="4" y="14" width="6" height="6" rx="1.4" /><rect x="14" y="14" width="6" height="6" rx="1.4" /></>);
export const ListIcon = icon(<><path d="M8 6h12M8 12h12M8 18h12" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></>);
export const SearchIcon = icon(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>);
export const XIcon = icon(<path d="M6 6l12 12M18 6 6 18" />);
export const UserIcon = icon(<><circle cx="12" cy="8" r="4" /><path d="M4 20a8 8 0 0 1 16 0" /></>);
export const SignOutIcon = icon(<><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 12H3" /><path d="m6 8-4 4 4 4" /></>);
export const SunIcon = icon(<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" /></>);
export const MoonIcon = icon(<path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10Z" />);
export const EyeIcon = icon(<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>);
export const EyeOffIcon = icon(<><path d="m4 4 16 16" /><path d="M9.5 9.5a3 3 0 0 0 4 4" /><path d="M6.7 6.7C4 8.3 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 4.3-1M14 5.2A9.6 9.6 0 0 0 12 5C5.5 5 2 12 2 12" /></>);
export const MoveIcon = icon(<><path d="M12 3v18M3 12h18" /><path d="m9 6 3-3 3 3M9 18l3 3 3-3M6 9 3 12l3 3M18 9l3 3-3 3" /></>);
export const CopyIcon = icon(<><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></>);
export const InfoIcon = icon(<><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>);
export const FilesIcon = icon(<><path d="M7 3h7l4 4v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M14 3v4h4" /></>);
export const CheckIcon = icon(<path d="m5 12 5 5 9-11" />);
export const AlertIcon = icon(<><path d="M12 4 2 20h20L12 4Z" /><path d="M12 10v5M12 18h.01" /></>);
