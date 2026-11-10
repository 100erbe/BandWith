/**
 * BandWith Custom Icon System
 * Drop-in compatible with Lucide icon API (size, color, strokeWidth, className)
 */

export * from './IconBase';
export * from './brand-icons';
export * from './custom-icons';

// Aliases matching Lucide exports used across shadcn / radix wrappers
import {
  Check,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Circle,
  Minus,
  MoreHorizontal,
  GripVertical,
  PanelLeft,
  X,
} from './custom-icons';

export const CheckIcon = Check;
export const SearchIcon = Search;
export const ChevronDownIcon = ChevronDown;
export const ChevronLeftIcon = ChevronLeft;
export const ChevronRightIcon = ChevronRight;
export const ChevronUpIcon = ChevronUp;
export const CircleIcon = Circle;
export const MinusIcon = Minus;
export const MoreHorizontalIcon = MoreHorizontal;
export const GripVerticalIcon = GripVertical;
export const PanelLeftIcon = PanelLeft;
export const XIcon = X;
export * from './CurrencyIcon';
