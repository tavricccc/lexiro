import type { Icon } from "@phosphor-icons/react";
import {
  Archive,
  ArrowCounterClockwise,
  ArrowClockwise,
  ArrowCircleRight,
  ArrowRight,
  BookOpenText,
  Books,
  Brain,
  CaretLeft,
  CaretRight,
  ChartBar,
  Check,
  CircleNotch,
  ChatCenteredText,
  Cloud,
  CloudSlash,
  Coins,
  Copy,
  Database,
  DotsThree,
  DownloadSimple,
  Exam,
  Eye,
  EyeSlash,
  FileMagnifyingGlass,
  Fire,
  Flag,
  FlagCheckered,
  Folder,
  GameController,
  FolderOpen,
  LinkSimple,
  MagnifyingGlass,
  PencilSimple,
  Play,
  Plus,
  Question,
  Robot,
  ShieldCheck,
  SignOut,
  SkipForward,
  SlidersHorizontal,
  Sparkle,
  SpeakerHigh,
  Stack,
  SunHorizon,
  Trash,
  Trophy,
  UploadSimple,
  User,
  WarningCircle,
  X,
} from "@phosphor-icons/react/ssr";

/** Any glyph from the map; primitives that take an icon accept this. */
export type AppIcon = Icon;

/**
 * One icon per concept, for the whole app.
 *
 * Rules that go with this map:
 *  - A concept keeps the same glyph everywhere. Before reaching for a Phosphor
 *    import in a feature component, add the concept here instead.
 *  - A button carries an icon exactly when its counterpart in the app does,
 *    and the glyph is the nearest match to the app's SF Symbol. Quiet ways
 *    out (離開, 返回今天, 完成) and the choice between resuming and
 *    restarting stay text alone, as they are there.
 *  - Icon-only buttons are allowed for secondary and destructive actions inside
 *    list rows and toolbars only, and always need an `aria-label`.
 *  - Icons inherit their colour from the text beside them. Do not tint one
 *    instance of a concept differently from another.
 */
export const Icons = {
  account: User,
  admin: ShieldCheck,
  ai: Robot,
  // The app's chevron.left: iOS goes back with a chevron, never an arrow.
  back: CaretLeft,
  backup: Archive,
  cancel: X,
  copy: Copy,
  create: Plus,
  credit: Coins,
  data: Database,
  delete: Trash,
  edit: PencilSimple,
  error: WarningCircle,
  export: DownloadSimple,
  folder: Folder,
  folderEmpty: FolderOpen,
  generate: Sparkle,
  hide: EyeSlash,
  import: UploadSimple,
  incorrect: X,
  /** Finding where a blank sits in its passage. */
  locate: FileMagnifyingGlass,
  /** The library holding a set of your own. */
  ownSet: Stack,
  levelUp: Trophy,
  library: Books,
  loading: CircleNotch,
  mark: Flag,
  more: DotsThree,
  next: CaretRight,
  /** Moving on to the next question once this one is answered. */
  advance: ArrowRight,
  /** The last question's way on, to the result. */
  finish: FlagCheckered,
  open: CaretRight,
  practice: Exam,
  /** Back from the passage to the question being answered. */
  prompt: ChatCenteredText,
  question: Question,
  reading: BookOpenText,
  refresh: ArrowClockwise,
  retry: ArrowCounterClockwise,
  reveal: Eye,
  review: Brain,
  rooms: GameController,
  /** Keeping a copy of someone else's shared set. */
  saveCopy: DownloadSimple,
  search: MagnifyingGlass,
  settings: SlidersHorizontal,
  signIn: ArrowCircleRight,
  shareLink: LinkSimple,
  signOut: SignOut,
  skip: SkipForward,
  speak: SpeakerHigh,
  start: Play,
  stats: ChartBar,
  streak: Fire,
  success: Check,
  sync: Cloud,
  syncOff: CloudSlash,
  today: SunHorizon,
  up: CaretLeft,
} as const;
