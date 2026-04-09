/**
 * UI 状态管理
 * 用于管理快捷键、右键菜单等前端 UI 状态
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UiState {
  // 快捷键功能是否启用
  isShortcutsEnabled: boolean;
  // 是否使用自定义右键菜单
  useCustomContextMenu: boolean;
  // 音乐播放器是否可见
  isMusicPlayerVisible: boolean;
  // 评论弹幕是否可见
  isCommentBarrageVisible: boolean;
  // 切换快捷键启用状态
  toggleShortcuts: (value?: boolean) => void;
  // 切换右键菜单模式
  toggleContextMenuMode: (value?: boolean) => void;
  // 切换音乐播放器可见状态
  toggleMusicPlayer: (value?: boolean) => void;
  // 切换评论弹幕可见状态
  toggleCommentBarrage: (value?: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      isShortcutsEnabled: true,
      useCustomContextMenu: true,
      isMusicPlayerVisible: true,
      isCommentBarrageVisible: true,

      toggleShortcuts: (value?: boolean) => {
        if (typeof value === "boolean") {
          set({ isShortcutsEnabled: value });
        } else {
          set({ isShortcutsEnabled: !get().isShortcutsEnabled });
        }
      },

      toggleContextMenuMode: (value?: boolean) => {
        if (typeof value === "boolean") {
          set({ useCustomContextMenu: value });
        } else {
          set({ useCustomContextMenu: !get().useCustomContextMenu });
        }
      },

      toggleMusicPlayer: (value?: boolean) => {
        if (typeof value === "boolean") {
          set({ isMusicPlayerVisible: value });
        } else {
          set({ isMusicPlayerVisible: !get().isMusicPlayerVisible });
        }
      },

      toggleCommentBarrage: (value?: boolean) => {
        if (typeof value === "boolean") {
          set({ isCommentBarrageVisible: value });
        } else {
          set({ isCommentBarrageVisible: !get().isCommentBarrageVisible });
        }
      },
    }),
    {
      name: "anheyu-ui-store",
      partialize: state => ({
        isShortcutsEnabled: state.isShortcutsEnabled,
        useCustomContextMenu: state.useCustomContextMenu,
        isMusicPlayerVisible: state.isMusicPlayerVisible,
        isCommentBarrageVisible: state.isCommentBarrageVisible,
      }),
    }
  )
);
