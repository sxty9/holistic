// Plugin contract + helpers
export * from './plugin/contract';
export { cn } from './lib/cn';

// i18n (locales, provider, hooks, message registry)
export * from './i18n';

// Icons
export * from './icons';

// Primitives
export {
  Stack,
  Box,
  Grid,
  Panel,
  Text,
  Heading,
  Divider,
  Spinner,
  Badge,
  ProgressBar,
  ScrollArea,
  Avatar,
  EmptyState,
} from './primitives';
export type { StackProps, BoxProps, GridProps, PanelProps, TextProps, HeadingProps, EmptyStateProps } from './primitives';

// Controls
export {
  Button,
  IconButton,
  Input,
  PasswordInput,
  Textarea,
  Field,
  SegmentedControl,
  SearchField,
  Checkbox,
  Switch,
  InlineLink,
} from './controls';
export type { ButtonProps, IconButtonProps, InputProps, TextareaProps, FieldProps, SegmentedOption } from './controls';

// Overlays
export { Modal, Sheet } from './overlay/modal';
export type { ModalProps, SheetProps } from './overlay/modal';
export { DropdownMenu, ContextMenu } from './overlay/menu';
export type { MenuItem } from './overlay/menu';
export { toast, dismissToast, Toaster } from './overlay/toast';
export type { ToastVariant, ToastItem } from './overlay/toast';
export { confirm, ConfirmRoot } from './overlay/confirm';
export type { ConfirmOptions } from './overlay/confirm';
export { Tooltip } from './overlay/tooltip';
export type { TooltipProps } from './overlay/tooltip';
export { HoverPanel } from './overlay/hovercard';
export type { HoverPanelProps } from './overlay/hovercard';
export { Marquee } from './marquee';
export type { MarqueeProps } from './marquee';

// Shell
export { AppShell, Sidebar, TopBar, ContentRegion, useTheme } from './shell';
export type { AppShellProps, SidebarProps, SidebarServiceItem, TopBarProps, ContentRegionProps } from './shell';

// Auth
export { AuthScene, AuthCard, HolisticMark } from './auth';

// Code
export { CodeBlock } from './code';

// Terminal (interactive shell over a WebSocket; owns the xterm.js dependency)
export { Terminal } from './terminal';
export type { TerminalProps } from './terminal';

// Metrics & data visualization
export { LineChart, Sparkline, Legend, StreamGraph } from './charts';
export type { ChartSeries, LineChartProps, SparklineProps, LegendItem, LegendProps, StreamSeries, StreamGraphProps, RefLine } from './charts';
export { Gauge, Donut, toneForLoad } from './gauge';
export type { Tone, GaugeProps, DonutProps, DonutSegment } from './gauge';
export { Stat } from './stat';
export type { StatProps, StatDelta } from './stat';
export { DataTable } from './table';
export type { Column, DataTableProps, SortDir } from './table';

// Formatting & data hooks
export { formatPercent, formatRate, formatDuration } from './lib/format';
export { useLiveQuery } from './lib/useLiveQuery';
export type { LiveQuery } from './lib/useLiveQuery';

// Safe email HTML viewer (sandboxed iframe; the only sanctioned way to render untrusted HTML)
export { SafeHtmlEmail } from './safehtml';
export type { SafeHtmlEmailProps } from './safehtml';

// Rich-text editor (dependency-free WYSIWYG; emits sanitised HTML + plain text)
export { RichTextEditor } from './richtext';
export type { RichTextEditorProps } from './richtext';

// Drag-and-drop nestable navigation tree (reorder + nest by dragging)
export { TreeNav } from './treenav';
export type { TreeNavProps, TreeNavNode } from './treenav';

// Files (cloud-style file manager)
export { FileEntryIcon, Breadcrumb, UploadControl } from './files/parts';
export type { BreadcrumbSegment } from './files/parts';
export { FileBrowser, formatBytes, formatDate } from './files/FileBrowser';
export type { FileBrowserProps, FileActionId } from './files/FileBrowser';
export { FileToolbar } from './files/FileToolbar';
export type { FileToolbarProps } from './files/FileToolbar';
export { NewFolderDialog, RenameDialog, MoveDialog } from './files/dialogs';
export { FilePreview } from './files/viewers';
export type { FilePreviewProps, TextPayload } from './files/viewers';
