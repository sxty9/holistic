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
export const ArrowUpIcon = icon(<><path d="M12 19V5" /><path d="m6 11 6-6 6 6" /></>);
export const GridIcon = icon(<><rect x="4" y="4" width="6" height="6" rx="1.4" /><rect x="14" y="4" width="6" height="6" rx="1.4" /><rect x="4" y="14" width="6" height="6" rx="1.4" /><rect x="14" y="14" width="6" height="6" rx="1.4" /></>);
export const ListIcon = icon(<><path d="M8 6h12M8 12h12M8 18h12" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></>);
export const SearchIcon = icon(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>);
export const XIcon = icon(<path d="M6 6l12 12M18 6 6 18" />);
export const UserIcon = icon(<><circle cx="12" cy="8" r="4" /><path d="M4 20a8 8 0 0 1 16 0" /></>);
export const KeyIcon = icon(<><circle cx="8" cy="15" r="4" /><path d="m10.8 12.2 8.2-8.2" /><path d="m16 7 2.5 2.5" /><path d="m13.5 9.5 2.5 2.5" /></>);
export const SignOutIcon = icon(<><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 12H3" /><path d="m6 8-4 4 4 4" /></>);
export const SunIcon = icon(<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" /></>);
export const MoonIcon = icon(<path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10Z" />);
export const GlobeIcon = icon(<><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3c2.5 2.5 3.8 5.7 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.7-3.8-9S9.5 5.5 12 3Z" /></>);
export const EyeIcon = icon(<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>);
export const EyeOffIcon = icon(<><path d="m4 4 16 16" /><path d="M9.5 9.5a3 3 0 0 0 4 4" /><path d="M6.7 6.7C4 8.3 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 4.3-1M14 5.2A9.6 9.6 0 0 0 12 5C5.5 5 2 12 2 12" /></>);
export const MoveIcon = icon(<><path d="M12 3v18M3 12h18" /><path d="m9 6 3-3 3 3M9 18l3 3 3-3M6 9 3 12l3 3M18 9l3 3-3 3" /></>);
export const CopyIcon = icon(<><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></>);
export const InfoIcon = icon(<><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>);
export const FilesIcon = icon(<><path d="M7 3h7l4 4v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M14 3v4h4" /></>);
export const CheckIcon = icon(<path d="m5 12 5 5 9-11" />);
export const MailIcon = icon(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 7.5 8.5 6 8.5-6" /></>);
export const ReplyIcon = icon(<><path d="M9 7 4 12l5 5" /><path d="M4 12h9a7 7 0 0 1 7 7" /></>);
export const SendIcon = icon(<><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7Z" /></>);
export const AlertIcon = icon(<><path d="M12 4 2 20h20L12 4Z" /><path d="M12 10v5M12 18h.01" /></>);

// Hardware / metrics icons (for hostek's live-server dashboard).
export const CpuIcon = icon(<><rect x="6" y="6" width="12" height="12" rx="1.5" /><rect x="9.5" y="9.5" width="5" height="5" rx="0.5" /><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" /></>);
export const MemoryIcon = icon(<><rect x="2" y="8" width="20" height="9" rx="1.2" /><path d="M6 8v9M10 8v9M14 8v9M18 8v9" /><path d="M5 17v2M19 17v2" /></>);
export const DiskIcon = icon(<><ellipse cx="12" cy="6" rx="8" ry="3" /><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6" /><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></>);
export const NetworkIcon = icon(<><path d="M7 20V8M7 8 4 11M7 8l3 3" /><path d="M17 4v12M17 16l3-3M17 16l-3-3" /></>);
export const GpuIcon = icon(<><rect x="2" y="7" width="20" height="10" rx="1.5" /><circle cx="8" cy="12" r="2.5" /><circle cx="15" cy="12" r="2.5" /><path d="M5 17v3" /></>);
export const ServerIcon = icon(<><rect x="3" y="4" width="18" height="7" rx="1.5" /><rect x="3" y="13" width="18" height="7" rx="1.5" /><path d="M7 7.5h.01M7 16.5h.01" /></>);
export const ThermometerIcon = icon(<><path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0Z" /><path d="M12 9v5.5" /></>);
export const BoltIcon = icon(<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />);
export const ActivityIcon = icon(<path d="M3 12h4l2-6 4 12 2-6h6" />);
export const GaugeIcon = icon(<><path d="M5 18a8 8 0 1 1 14 0" /><path d="m12 13 4-4" /><circle cx="12" cy="13" r="1.2" fill="currentColor" stroke="none" /></>);
export const ClockIcon = icon(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>);
export const PowerIcon = icon(<><path d="M12 3v8" /><path d="M6.6 7a8 8 0 1 0 10.8 0" /></>);
export const SsdIcon = icon(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 9h6M7 12h4" /><circle cx="16.5" cy="14.5" r="1.4" fill="currentColor" stroke="none" /></>);
export const MotherboardIcon = icon(<><rect x="3" y="3" width="18" height="18" rx="2" /><rect x="6.5" y="6.5" width="6" height="6" rx="1" /><path d="M15 7h3M15 10h3M7 16h10" /><circle cx="16" cy="16" r="1.1" fill="currentColor" stroke="none" /><circle cx="19" cy="16" r="1.1" fill="currentColor" stroke="none" /></>);
export const FanIcon = icon(<><circle cx="12" cy="12" r="2" /><path d="M12 10c0-3 .5-6-1-6S8.5 7 12 10ZM14 12c3 0 6-.5 6 1s-3 1.5-6-1ZM12 14c0 3-.5 6 1 6s1.5-3-1-6ZM10 12c-3 0-6 .5-6-1s3-1.5 6 1Z" /></>);
export const EthernetIcon = icon(<><rect x="3" y="8" width="18" height="11" rx="1.5" /><path d="M7 19v-3M10 19v-3M14 19v-3M17 19v-3M9 8V5h6v3" /></>);

// Terminal / remote shell.
export const TerminalIcon = icon(<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m7 9 3 3-3 3" /><path d="M13 15h4" /></>);

// Rich-text editor toolbar glyphs.
export const BoldIcon = icon(<path d="M7 5h6.5a3.5 3.5 0 0 1 0 7H7zM7 12h7.5a3.5 3.5 0 0 1 0 7H7z" />);
export const ItalicIcon = icon(<path d="M11 5h7M6 19h7M14.5 5l-5 14" />);
export const UnderlineIcon = icon(<><path d="M7 5v6a5 5 0 0 0 10 0V5" /><path d="M5 21h14" /></>);
export const StrikethroughIcon = icon(<><path d="M5 12h14" /><path d="M8 8.5C8 6.5 9.8 5 12.2 5c1.8 0 3.2.7 3.8 2M16 15c0 2.2-1.9 3.6-4.2 3.6-2 0-3.6-.8-4.3-2.3" /></>);
export const ListOrderedIcon = icon(<><path d="M10 6h10M10 12h10M10 18h10" /><path d="M4 4.5v3M3 7.5h2M3 11.5h1.6L3 13.5h1.8M3 16.5h1.7M3 18.5h1.7" /></>);
export const LinkIcon = icon(<><path d="M9 15l6-6" /><path d="M10.5 6.5l.8-.8a4 4 0 0 1 5.7 5.7l-.8.8" /><path d="M13.5 17.5l-.8.8a4 4 0 0 1-5.7-5.7l.8-.8" /></>);
export const QuoteIcon = icon(<><path d="M5 6h5v5H5z" /><path d="M5 11c0 3 .6 4 3 5" /><path d="M14 6h5v5h-5z" /><path d="M14 11c0 3 .6 4 3 5" /></>);
export const ClearFormatIcon = icon(<><path d="M8 6h12M13 6l-3.5 9" /><path d="M5 19h6" /><path d="m16 14 5 5M21 14l-5 5" /></>);
