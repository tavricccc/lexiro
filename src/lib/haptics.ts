import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

const active = Platform.OS === "ios" || Platform.OS === "android";

/**
 * Unified tactile vocabulary for Lexiro. Every interactive beat has a distinct,
 * restrained physical feel rather than uniform buzzing.
 */
export const haptics = {
  /** Subtle tick: segmented control, folder filter, checkboxes, ordering/matching taps. */
  select() {
    if (active) void Haptics.selectionAsync();
  },
  /** Crisp light tap: buttons, answer option press, expanding review notes, speak button. */
  tap() {
    if (active) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },
  /** Deliberate physical thud: starring a word, starting a round/room, swipe threshold crossed. */
  confirm() {
    if (active) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  },
  /** Celebratory confirmation: right answer, round finished, daily goal hit, sync/backup done. */
  success() {
    if (active) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },
  /** Clear rejection: wrong answer, validation error, rejected write. */
  error() {
    if (active) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  },
  /** Cautionary pulse: destructive confirmation, room countdown final seconds. */
  warning() {
    if (active) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  },
};
