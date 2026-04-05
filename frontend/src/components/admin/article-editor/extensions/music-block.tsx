/**
 * MusicBlock 扩展
 * 网易云音乐播放器节点
 * 编辑器中渲染与文章详情一致的唱片机播放器视图
 */
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useState, useRef, useEffect, useCallback } from "react";
import { Pencil } from "lucide-react";

/** 网易云音乐装饰图 */
const NETEASE_DECORATION_IMG =
  "https://upload-bbs.miyoushe.com/upload/2025/11/04/125766904/606ad4f7e660998724ec17f4114085aa_6429154021753184587.png";

/** 默认的音乐 API 地址 */
const DEFAULT_MUSIC_API = "https://metings.qjqq.cn";

/** 确保 URL 使用 HTTPS */
function ensureHttps(url: string): string {
  if (!url) return url;
  return url.startsWith("http://") ? url.replace("http://", "https://") : url;
}

/**
 * 通过第三方 API 获取网易云音乐歌曲详情
 * 返回歌名、歌手、封面图等信息
 */
async function fetchMusicDetail(neteaseId: string): Promise<{ name: string; artist: string; pic: string } | null> {
  if (!neteaseId || !/^\d+$/.test(neteaseId)) return null;

  try {
    const formData = new URLSearchParams();
    formData.append("url", neteaseId);
    formData.append("level", "exhigh");
    formData.append("type", "json");

    let response = await fetch(`${DEFAULT_MUSIC_API}/Song_V1`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData,
    });
    let data = await response.json();

    // exhigh 失败则尝试 standard
    if (!response.ok || data.status !== 200 || !data.success) {
      const stdForm = new URLSearchParams();
      stdForm.append("url", neteaseId);
      stdForm.append("level", "standard");
      stdForm.append("type", "json");

      response = await fetch(`${DEFAULT_MUSIC_API}/Song_V1`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: stdForm,
      });
      data = await response.json();
    }

    if (data.status === 200 && data.success) {
      return {
        name: data.data.name || "未知歌曲",
        artist: data.data.ar_name || "未知艺术家",
        pic: ensureHttps(data.data.pic || ""),
      };
    }
    return null;
  } catch (error) {
    console.error("[音乐播放器] 获取歌曲详情失败:", error);
    return null;
  }
}

// ---- React NodeView 组件 ----
function MusicBlockView({ node, updateAttributes }: NodeViewProps) {
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const helpRef = useRef<HTMLDivElement>(null);
  const neteaseId = (node.attrs.neteaseId as string) || "";
  const name = (node.attrs.name as string) || "";
  const artist = (node.attrs.artist as string) || "";
  const pic = (node.attrs.pic as string) || "";

  const displayName = name || (neteaseId ? "加载中..." : "未设置歌曲");
  const displayArtist = artist || (neteaseId ? "..." : "请双击编辑");
  const displayPic = pic || "/static/img/music-vinyl-background.png";

  // 根据 neteaseId 加载歌曲信息
  const loadSongInfo = useCallback(
    async (id: string) => {
      if (!id || !/^\d+$/.test(id)) return;
      if (name && artist && pic) return;

      setLoading(true);
      try {
        const detail = await fetchMusicDetail(id);
        if (detail) {
          updateAttributes({ name: detail.name, artist: detail.artist, pic: detail.pic });
        }
      } finally {
        setLoading(false);
      }
    },
    [name, artist, pic, updateAttributes]
  );

  // neteaseId 变化且缺少歌曲信息时自动加载
  useEffect(() => {
    if (neteaseId && (!name || !artist || !pic)) {
      loadSongInfo(neteaseId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [neteaseId]);

  // 点击外部关闭编辑 / 帮助提示
  useEffect(() => {
    if (!editing && !showHelp) return;
    const handler = (e: MouseEvent) => {
      if (editing && wrapperRef.current && !wrapperRef.current.contains(e.target as globalThis.Node)) {
        setEditing(false);
      }
      if (showHelp && helpRef.current && !helpRef.current.contains(e.target as globalThis.Node)) {
        setShowHelp(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [editing, showHelp]);

  /** 完成编辑并触发加载 */
  const handleFinishEdit = () => {
    setEditing(false);
    if (neteaseId && (!name || !artist || !pic)) {
      loadSongInfo(neteaseId);
    }
  };

  if (editing) {
    return (
      <NodeViewWrapper className="music-block-wrapper my-3">
        <div ref={wrapperRef} className="editor-music-edit-panel">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-muted-foreground font-medium">编辑音乐播放器</span>
          </div>
          {/* 网易云 ID 输入 + 帮助按钮 */}
          <div className="relative">
            <div className="flex items-center gap-1">
              <input
                value={neteaseId}
                onChange={e => updateAttributes({ neteaseId: e.target.value.trim() })}
                placeholder="网易云音乐 ID（纯数字）"
                className="w-full px-2 py-1 text-sm border border-border rounded bg-background outline-none focus:border-primary"
                autoFocus
              />
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  setShowHelp(prev => !prev);
                }}
                className="editor-music-help-btn"
                title="如何获取网易云音乐 ID？"
              >
                ?
              </button>
            </div>
            {showHelp && (
              <div ref={helpRef} className="editor-music-help-tooltip">
                <div className="font-medium mb-1">如何获取网易云音乐 ID？</div>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>
                    打开{""}
                    <a href="https://music.163.com" target="_blank" rel="noreferrer" className="text-primary underline">
                      网易云音乐
                    </a>
                    {""}
                    网页版
                  </li>
                  <li>找到想要的歌曲，点击进入歌曲详情页</li>
                  <li>
                    查看浏览器地址栏，格式如：
                    <code className="text-xs bg-muted px-1 rounded">
                      music.163.com/song?id=<b>554241732</b>
                    </code>
                  </li>
                  <li>
                    其中 <code className="text-xs bg-muted px-1 rounded font-bold">554241732</code> 就是歌曲 ID
                  </li>
                </ol>
              </div>
            )}
          </div>
          <input
            value={name}
            onChange={e => updateAttributes({ name: e.target.value })}
            placeholder="歌曲名称（自动获取，可手动修改）"
            className="w-full px-2 py-1 text-sm border border-border rounded bg-background outline-none focus:border-primary"
          />
          <input
            value={artist}
            onChange={e => updateAttributes({ artist: e.target.value })}
            placeholder="歌手（自动获取，可手动修改）"
            className="w-full px-2 py-1 text-sm border border-border rounded bg-background outline-none focus:border-primary"
          />
          <div className="flex items-center gap-2">
            <button onClick={handleFinishEdit} className="px-3 py-1 text-xs bg-primary text-white rounded">
              完成
            </button>
            {loading && <span className="text-xs text-muted-foreground animate-pulse">正在加载歌曲信息...</span>}
          </div>
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper className="music-block-wrapper my-3">
      <div className="editor-node-hover-wrap" contentEditable={false}>
        <div
          className="editor-node-edit-btn"
          onClick={e => {
            e.stopPropagation();
            setEditing(true);
          }}
          contentEditable={false}
        >
          <Pencil /> 编辑
        </div>
        <div className="markdown-music-player">
          <div className="music-player-container">
            {/* 加载中遮罩 */}
            {loading && (
              <div className="music-loading">
                <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray="31.4"
                    strokeLinecap="round"
                  />
                </svg>
                <span>加载中...</span>
              </div>
            )}

            {/* 唱片机 artwork 区域 */}
            <div className="music-artwork-container">
              <div className="music-artwork-wrapper">
                {/* eslint-disable @next/next/no-img-element */}
                <img src="/static/img/music-vinyl-background.png" alt="唱片背景" className="vinyl-background" />
                <img
                  src="/static/img/music-vinyl-outer.png"
                  alt="唱片外圈"
                  className="artwork-image-vinyl-background"
                />
                <img
                  src="/static/img/music-vinyl-inner.png"
                  alt="唱片内圈"
                  className="artwork-image-vinyl-inner-background"
                />
                <img src="/static/img/music-vinyl-needle.png" alt="撞针" className="artwork-image-needle-background" />
                <img
                  src="/static/img/music-vinyl-groove.png"
                  alt="凹槽背景"
                  className="artwork-image-groove-background"
                />
                <div className="artwork-transition-wrapper">
                  <img src={displayPic} alt="专辑封面" className="artwork-image" />
                  <img src={displayPic} alt="模糊背景" className="artwork-image-blur" />
                  <div className="artwork-border-ring" />
                </div>
                {/* eslint-enable @next/next/no-img-element */}
                {/* 播放/暂停覆盖层（编辑器中仅作装饰） */}
                <div className="music-play-overlay">
                  <div className="music-play-button-overlay">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* 歌曲信息 */}
            <div className="music-info-container">
              <div className="music-text-info">
                <div className="music-name">{displayName}</div>
                <div className="music-artist">{displayArtist}</div>
              </div>
              <span className="nmsingle-playtime">
                <span className="current-time">00:00</span> / <span className="duration">00:00</span>
              </span>
            </div>

            {/* 网易云音乐装饰图 */}
            <div className="music-decoration-image">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={NETEASE_DECORATION_IMG} alt="音乐装饰" />
            </div>

            {/* 进度条（编辑器中仅作装饰） */}
            <div className="music-progress-bar">
              <div className="music-progress-track">
                <div className="music-progress-fill" style={{ width: "0%" }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </NodeViewWrapper>
  );
}

// ---- Tiptap 扩展 ----

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    musicBlock: {
      /** 插入音乐播放器 */
      insertMusicBlock: (attrs?: {
        neteaseId?: string;
        name?: string;
        artist?: string;
        pic?: string;
        color?: string;
      }) => ReturnType;
    };
  }
}

export const MusicBlock = Node.create({
  name: "musicBlock",

  group: "block",

  atom: true,

  addAttributes() {
    return {
      neteaseId: { default: "" },
      name: { default: "" },
      artist: { default: "" },
      pic: { default: "" },
      color: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div.markdown-music-player",
        getAttrs: (element: HTMLElement) => {
          const neteaseId = element.getAttribute("data-music-id") || "";
          const musicDataRaw = element.getAttribute("data-music-data") || "";

          let name = "";
          let artist = "";
          let pic = "";
          let color = "";

          if (musicDataRaw) {
            try {
              const data = JSON.parse(musicDataRaw);
              name = data.name || "";
              artist = data.artist || "";
              pic = data.pic || "";
              color = data.color || "";
            } catch {
              // JSON 解析失败，忽略
            }
          }

          return { neteaseId, name, artist, pic, color };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const neteaseId = (node.attrs.neteaseId as string) || "";
    const name = (node.attrs.name as string) || "";
    const artist = (node.attrs.artist as string) || "";
    const pic = (node.attrs.pic as string) || "";
    const color = (node.attrs.color as string) || "";

    const musicData = JSON.stringify({ name, artist, pic, color });

    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        class: "markdown-music-player",
        "data-music-id": neteaseId,
        "data-music-data": musicData,
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MusicBlockView);
  },

  addCommands() {
    return {
      insertMusicBlock:
        (attrs = {}) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              neteaseId: attrs?.neteaseId ?? "",
              name: attrs?.name ?? "",
              artist: attrs?.artist ?? "",
              pic: attrs?.pic ?? "",
              color: attrs?.color ?? "",
            },
          });
        },
    };
  },
});
