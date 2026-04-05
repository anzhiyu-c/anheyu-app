"use client";

import { FormInput } from "@/components/ui/form-input";
import { FormSwitch } from "@/components/ui/form-switch";
import { FormImageUpload } from "@/components/ui/form-image-upload";
import { FormStringList } from "@/components/ui/form-string-list";
import { RichContentEditor } from "./editors/rich-content-editor";
import { VisualArrayEditor, type FieldDef } from "./editors/VisualArrayEditor";
import { SettingsSection, SettingsFieldGroup } from "./SettingsSection";
import { Spinner } from "@/components/ui/spinner";
import {
  KEY_ABOUT_NAME,
  KEY_ABOUT_DESCRIPTION,
  KEY_ABOUT_AVATAR_IMG,
  KEY_ABOUT_SUBTITLE,
  KEY_ABOUT_AVATAR_SKILLS_LEFT,
  KEY_ABOUT_AVATAR_SKILLS_RIGHT,
  KEY_ABOUT_SITE_TIPS,
  KEY_ABOUT_MAP,
  KEY_ABOUT_SELF_INFO,
  KEY_ABOUT_PERSONALITIES,
  KEY_ABOUT_MAXIM,
  KEY_ABOUT_BUFF,
  KEY_ABOUT_GAME,
  KEY_ABOUT_COMIC,
  KEY_ABOUT_LIKE,
  KEY_ABOUT_MUSIC,
  KEY_ABOUT_CAREERS,
  KEY_ABOUT_SKILLS_TIPS,
  KEY_ABOUT_STATISTICS_BG,
  KEY_ABOUT_CUSTOM_CODE,
  KEY_ABOUT_CUSTOM_CODE_HTML,
  KEY_ABOUT_ENABLE_AUTHOR_BOX,
  KEY_ABOUT_ENABLE_PAGE_CONTENT,
  KEY_ABOUT_ENABLE_SKILLS,
  KEY_ABOUT_ENABLE_CAREERS,
  KEY_ABOUT_ENABLE_STATISTIC,
  KEY_ABOUT_ENABLE_MAP_INFO,
  KEY_ABOUT_ENABLE_PERSONALITY,
  KEY_ABOUT_ENABLE_PHOTO,
  KEY_ABOUT_ENABLE_MAXIM,
  KEY_ABOUT_ENABLE_BUFF,
  KEY_ABOUT_ENABLE_GAME,
  KEY_ABOUT_ENABLE_COMIC,
  KEY_ABOUT_ENABLE_LIKE_TECH,
  KEY_ABOUT_ENABLE_MUSIC,
  KEY_ABOUT_ENABLE_CUSTOM_CODE,
  KEY_ABOUT_ENABLE_COMMENT,
} from "@/lib/settings/setting-keys";

interface AboutPageFormProps {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  loading?: boolean;
}

const comicListFields: FieldDef[] = [
  { key: "name", label: "番剧名称", type: "text", placeholder: "例如：进击的巨人" },
  { key: "cover", label: "封面", type: "url", placeholder: "https://.../cover.jpg" },
  { key: "href", label: "链接", type: "url", placeholder: "https://..." },
];

const careersListFields: FieldDef[] = [
  { key: "desc", label: "经历描述", type: "textarea", placeholder: "例如：2024 - 至今，专注前端工程化。", colSpan: 2 },
  { key: "color", label: "强调色", type: "color", placeholder: "#357ef5" },
];

function parseObjectJson(raw: string | undefined): Record<string, unknown> {
  if (!raw || raw.trim() === "") return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {}
  return {};
}

function patchObjectJsonValue(raw: string | undefined, key: string, value: unknown): string {
  const base = parseObjectJson(raw);
  const next = { ...base, [key]: value };
  return JSON.stringify(next, null, 2);
}

function parseJsonArray(raw: string | undefined): unknown[] {
  if (!raw || raw.trim() === "") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toStringArrayJson(value: unknown): string {
  if (!Array.isArray(value)) return "[]";
  return JSON.stringify(value.map(item => String(item ?? "")));
}

function toObjectArrayJson(value: unknown): string {
  if (!Array.isArray(value)) return "[]";
  return JSON.stringify(value.filter(item => item && typeof item === "object" && !Array.isArray(item)));
}

function hasMeaningfulValue(raw: string | undefined): boolean {
  const value = (raw ?? "").trim();
  if (!value) return false;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) return parsed.length > 0;
    if (parsed && typeof parsed === "object") return Object.keys(parsed as Record<string, unknown>).length > 0;
    if (typeof parsed === "string") return parsed.trim().length > 0;
    return true;
  } catch {
    return true;
  }
}

export function AboutPageForm({ values, onChange, loading }: AboutPageFormProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner />
      </div>
    );
  }

  const skillsTipsObject = parseObjectJson(values[KEY_ABOUT_SKILLS_TIPS]);
  const siteTipsObject = parseObjectJson(values[KEY_ABOUT_SITE_TIPS]);
  const mapObject = parseObjectJson(values[KEY_ABOUT_MAP]);
  const selfInfoObject = parseObjectJson(values[KEY_ABOUT_SELF_INFO]);
  const personalityObject = parseObjectJson(values[KEY_ABOUT_PERSONALITIES]);
  const maximObject = parseObjectJson(values[KEY_ABOUT_MAXIM]);
  const buffObject = parseObjectJson(values[KEY_ABOUT_BUFF]);
  const gameObject = parseObjectJson(values[KEY_ABOUT_GAME]);
  const comicObject = parseObjectJson(values[KEY_ABOUT_COMIC]);
  const likeObject = parseObjectJson(values[KEY_ABOUT_LIKE]);
  const musicObject = parseObjectJson(values[KEY_ABOUT_MUSIC]);
  const careersObject = parseObjectJson(values[KEY_ABOUT_CAREERS]);
  const enableSkills = values[KEY_ABOUT_ENABLE_SKILLS] === "true";
  const enableCareers = values[KEY_ABOUT_ENABLE_CAREERS] === "true";
  const enableStatistic = values[KEY_ABOUT_ENABLE_STATISTIC] === "true";
  const enableMapInfo = values[KEY_ABOUT_ENABLE_MAP_INFO] === "true";
  const enablePersonality = values[KEY_ABOUT_ENABLE_PERSONALITY] === "true";
  const enableMaxim = values[KEY_ABOUT_ENABLE_MAXIM] === "true";
  const enableBuff = values[KEY_ABOUT_ENABLE_BUFF] === "true";
  const enableGame = values[KEY_ABOUT_ENABLE_GAME] === "true";
  const enableComic = values[KEY_ABOUT_ENABLE_COMIC] === "true";
  const enableLikeTech = values[KEY_ABOUT_ENABLE_LIKE_TECH] === "true";
  const enableMusic = values[KEY_ABOUT_ENABLE_MUSIC] === "true";
  const aboutCustomCodeEnabled = values[KEY_ABOUT_ENABLE_CUSTOM_CODE] === "true";
  const hasAboutCustomCodeHistory =
    hasMeaningfulValue(values[KEY_ABOUT_CUSTOM_CODE]) || hasMeaningfulValue(values[KEY_ABOUT_CUSTOM_CODE_HTML]);
  const hasHistory = (keys: string[]) => keys.map(key => values[key] ?? "").some(value => hasMeaningfulValue(value));
  const hasSkillsHistory = hasHistory([
    KEY_ABOUT_AVATAR_SKILLS_LEFT,
    KEY_ABOUT_AVATAR_SKILLS_RIGHT,
    KEY_ABOUT_SKILLS_TIPS,
  ]);
  const hasMapInfoHistory = hasHistory([KEY_ABOUT_SITE_TIPS, KEY_ABOUT_MAP, KEY_ABOUT_SELF_INFO]);
  const hasPersonalityHistory = hasHistory([KEY_ABOUT_PERSONALITIES]);
  const hasMaximHistory = hasHistory([KEY_ABOUT_MAXIM]);
  const hasBuffHistory = hasHistory([KEY_ABOUT_BUFF]);
  const hasGameHistory = hasHistory([KEY_ABOUT_GAME]);
  const hasComicHistory = hasHistory([KEY_ABOUT_COMIC]);
  const hasLikeHistory = hasHistory([KEY_ABOUT_LIKE]);
  const hasMusicHistory = hasHistory([KEY_ABOUT_MUSIC]);
  const hasCareersHistory = hasHistory([KEY_ABOUT_CAREERS]);
  const hasStatisticHistory = hasHistory([KEY_ABOUT_STATISTICS_BG]);

  return (
    <div className="space-y-8">
      {/* 基本信息 */}
      <SettingsSection title="基本信息">
        <SettingsFieldGroup cols={2}>
          <FormInput
            label="名称"
            placeholder="请输入名称"
            value={values[KEY_ABOUT_NAME]}
            onValueChange={v => onChange(KEY_ABOUT_NAME, v)}
          />
          <FormInput
            label="副标题"
            placeholder="请输入副标题"
            value={values[KEY_ABOUT_SUBTITLE]}
            onValueChange={v => onChange(KEY_ABOUT_SUBTITLE, v)}
          />
        </SettingsFieldGroup>
        <FormInput
          label="描述"
          placeholder="请输入个人描述"
          value={values[KEY_ABOUT_DESCRIPTION]}
          onValueChange={v => onChange(KEY_ABOUT_DESCRIPTION, v)}
        />
        <FormImageUpload
          label="头像"
          value={values[KEY_ABOUT_AVATAR_IMG]}
          onValueChange={v => onChange(KEY_ABOUT_AVATAR_IMG, v)}
          placeholder="请输入头像图片 URL"
          rounded
        />
      </SettingsSection>

      {/* 板块开关 */}
      <SettingsSection title="板块开关">
        <SettingsFieldGroup cols={2}>
          <FormSwitch
            label="作者信息"
            checked={values[KEY_ABOUT_ENABLE_AUTHOR_BOX] === "true"}
            onCheckedChange={v => onChange(KEY_ABOUT_ENABLE_AUTHOR_BOX, String(v))}
          />
          <FormSwitch
            label="页面正文"
            checked={values[KEY_ABOUT_ENABLE_PAGE_CONTENT] === "true"}
            onCheckedChange={v => onChange(KEY_ABOUT_ENABLE_PAGE_CONTENT, String(v))}
          />
          <FormSwitch
            label="技能"
            checked={values[KEY_ABOUT_ENABLE_SKILLS] === "true"}
            onCheckedChange={v => onChange(KEY_ABOUT_ENABLE_SKILLS, String(v))}
          />
          <FormSwitch
            label="职业经历"
            checked={values[KEY_ABOUT_ENABLE_CAREERS] === "true"}
            onCheckedChange={v => onChange(KEY_ABOUT_ENABLE_CAREERS, String(v))}
          />
          <FormSwitch
            label="统计"
            checked={values[KEY_ABOUT_ENABLE_STATISTIC] === "true"}
            onCheckedChange={v => onChange(KEY_ABOUT_ENABLE_STATISTIC, String(v))}
          />
          <FormSwitch
            label="地图与信息"
            checked={values[KEY_ABOUT_ENABLE_MAP_INFO] === "true"}
            onCheckedChange={v => onChange(KEY_ABOUT_ENABLE_MAP_INFO, String(v))}
          />
          <FormSwitch
            label="性格"
            checked={values[KEY_ABOUT_ENABLE_PERSONALITY] === "true"}
            onCheckedChange={v => onChange(KEY_ABOUT_ENABLE_PERSONALITY, String(v))}
          />
          <FormSwitch
            label="相册"
            checked={values[KEY_ABOUT_ENABLE_PHOTO] === "true"}
            onCheckedChange={v => onChange(KEY_ABOUT_ENABLE_PHOTO, String(v))}
          />
          <FormSwitch
            label="座右铭"
            checked={values[KEY_ABOUT_ENABLE_MAXIM] === "true"}
            onCheckedChange={v => onChange(KEY_ABOUT_ENABLE_MAXIM, String(v))}
          />
          <FormSwitch
            label="Buff"
            checked={values[KEY_ABOUT_ENABLE_BUFF] === "true"}
            onCheckedChange={v => onChange(KEY_ABOUT_ENABLE_BUFF, String(v))}
          />
          <FormSwitch
            label="游戏"
            checked={values[KEY_ABOUT_ENABLE_GAME] === "true"}
            onCheckedChange={v => onChange(KEY_ABOUT_ENABLE_GAME, String(v))}
          />
          <FormSwitch
            label="追番"
            checked={values[KEY_ABOUT_ENABLE_COMIC] === "true"}
            onCheckedChange={v => onChange(KEY_ABOUT_ENABLE_COMIC, String(v))}
          />
          <FormSwitch
            label="喜欢的技术"
            checked={values[KEY_ABOUT_ENABLE_LIKE_TECH] === "true"}
            onCheckedChange={v => onChange(KEY_ABOUT_ENABLE_LIKE_TECH, String(v))}
          />
          <FormSwitch
            label="音乐"
            checked={values[KEY_ABOUT_ENABLE_MUSIC] === "true"}
            onCheckedChange={v => onChange(KEY_ABOUT_ENABLE_MUSIC, String(v))}
          />
          <FormSwitch
            label="自定义代码"
            checked={values[KEY_ABOUT_ENABLE_CUSTOM_CODE] === "true"}
            onCheckedChange={v => onChange(KEY_ABOUT_ENABLE_CUSTOM_CODE, String(v))}
          />
          <FormSwitch
            label="评论"
            checked={values[KEY_ABOUT_ENABLE_COMMENT] === "true"}
            onCheckedChange={v => onChange(KEY_ABOUT_ENABLE_COMMENT, String(v))}
          />
        </SettingsFieldGroup>
      </SettingsSection>

      {/* 内容配置 */}
      <SettingsSection title="内容配置">
        {enableSkills ? (
          <>
            <FormStringList
              label="头像左侧技能"
              description="每行一个技能标签，可拖拽排序。"
              value={values[KEY_ABOUT_AVATAR_SKILLS_LEFT]}
              onValueChange={v => onChange(KEY_ABOUT_AVATAR_SKILLS_LEFT, v)}
              placeholder="例如：前端开发"
              addButtonText="添加技能"
            />
            <FormStringList
              label="头像右侧技能"
              description="每行一个技能标签，可拖拽排序。"
              value={values[KEY_ABOUT_AVATAR_SKILLS_RIGHT]}
              onValueChange={v => onChange(KEY_ABOUT_AVATAR_SKILLS_RIGHT, v)}
              placeholder="例如：开源爱好者"
              addButtonText="添加技能"
            />
            <SettingsFieldGroup cols={2}>
              <FormInput
                label="技能提示文案"
                placeholder="例如：技能"
                value={String(skillsTipsObject.tips ?? "")}
                onValueChange={v =>
                  onChange(KEY_ABOUT_SKILLS_TIPS, patchObjectJsonValue(values[KEY_ABOUT_SKILLS_TIPS], "tips", v))
                }
              />
              <FormInput
                label="技能标题"
                placeholder="例如：开启创造力"
                value={String(skillsTipsObject.title ?? "")}
                onValueChange={v =>
                  onChange(KEY_ABOUT_SKILLS_TIPS, patchObjectJsonValue(values[KEY_ABOUT_SKILLS_TIPS], "title", v))
                }
              />
            </SettingsFieldGroup>
          </>
        ) : (
          hasSkillsHistory && (
            <div className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-700 dark:text-warning-300">
              技能板块当前关闭，但检测到历史配置已保留；重新开启后可继续编辑并生效。
            </div>
          )
        )}

        {enableMapInfo ? (
          <>
            <SettingsFieldGroup cols={2}>
              <FormInput
                label="关于站点提示文案"
                placeholder="例如：追求"
                value={String(siteTipsObject.tips ?? "")}
                onValueChange={v =>
                  onChange(KEY_ABOUT_SITE_TIPS, patchObjectJsonValue(values[KEY_ABOUT_SITE_TIPS], "tips", v))
                }
              />
              <FormInput
                label="关于站点标题1"
                placeholder="例如：源于"
                value={String(siteTipsObject.title1 ?? "")}
                onValueChange={v =>
                  onChange(KEY_ABOUT_SITE_TIPS, patchObjectJsonValue(values[KEY_ABOUT_SITE_TIPS], "title1", v))
                }
              />
            </SettingsFieldGroup>
            <FormInput
              label="关于站点标题2"
              placeholder="例如：热爱而去 感受"
              value={String(siteTipsObject.title2 ?? "")}
              onValueChange={v =>
                onChange(KEY_ABOUT_SITE_TIPS, patchObjectJsonValue(values[KEY_ABOUT_SITE_TIPS], "title2", v))
              }
            />
            <FormStringList
              label="关于站点关键词"
              description="轮播关键词列表，每行一条。"
              value={toStringArrayJson(siteTipsObject.word)}
              onValueChange={v =>
                onChange(
                  KEY_ABOUT_SITE_TIPS,
                  patchObjectJsonValue(
                    values[KEY_ABOUT_SITE_TIPS],
                    "word",
                    parseJsonArray(v).map(item => String(item ?? ""))
                  )
                )
              }
              placeholder="例如：学习"
              addButtonText="添加关键词"
            />
            <SettingsFieldGroup cols={2}>
              <FormInput
                label="地图标题"
                placeholder="例如：我现在住在"
                value={String(mapObject.title ?? "")}
                onValueChange={v => onChange(KEY_ABOUT_MAP, patchObjectJsonValue(values[KEY_ABOUT_MAP], "title", v))}
              />
              <FormInput
                label="地图副标题"
                placeholder="例如：中国，长沙市"
                value={String(mapObject.strengthenTitle ?? "")}
                onValueChange={v =>
                  onChange(KEY_ABOUT_MAP, patchObjectJsonValue(values[KEY_ABOUT_MAP], "strengthenTitle", v))
                }
              />
            </SettingsFieldGroup>
            <FormImageUpload
              label="地图背景图（亮色）"
              value={String(mapObject.background ?? "")}
              onValueChange={v => onChange(KEY_ABOUT_MAP, patchObjectJsonValue(values[KEY_ABOUT_MAP], "background", v))}
              placeholder="请输入地图背景图 URL"
            />
            <FormImageUpload
              label="地图背景图（暗色）"
              value={String(mapObject.backgroundDark ?? "")}
              onValueChange={v =>
                onChange(KEY_ABOUT_MAP, patchObjectJsonValue(values[KEY_ABOUT_MAP], "backgroundDark", v))
              }
              placeholder="请输入地图暗色背景图 URL"
            />
            <SettingsFieldGroup cols={2}>
              <FormInput
                label="个人信息标签1"
                placeholder="例如：生于"
                value={String(selfInfoObject.tips1 ?? "")}
                onValueChange={v =>
                  onChange(KEY_ABOUT_SELF_INFO, patchObjectJsonValue(values[KEY_ABOUT_SELF_INFO], "tips1", v))
                }
              />
              <FormInput
                label="个人信息内容1"
                placeholder="例如：2002"
                value={String(selfInfoObject.contentYear ?? "")}
                onValueChange={v =>
                  onChange(KEY_ABOUT_SELF_INFO, patchObjectJsonValue(values[KEY_ABOUT_SELF_INFO], "contentYear", v))
                }
              />
            </SettingsFieldGroup>
            <SettingsFieldGroup cols={2}>
              <FormInput
                label="个人信息标签2"
                placeholder="例如：湖南信息学院"
                value={String(selfInfoObject.tips2 ?? "")}
                onValueChange={v =>
                  onChange(KEY_ABOUT_SELF_INFO, patchObjectJsonValue(values[KEY_ABOUT_SELF_INFO], "tips2", v))
                }
              />
              <FormInput
                label="个人信息内容2"
                placeholder="例如：软件工程"
                value={String(selfInfoObject.content2 ?? "")}
                onValueChange={v =>
                  onChange(KEY_ABOUT_SELF_INFO, patchObjectJsonValue(values[KEY_ABOUT_SELF_INFO], "content2", v))
                }
              />
            </SettingsFieldGroup>
            <SettingsFieldGroup cols={2}>
              <FormInput
                label="个人信息标签3"
                placeholder="例如：现在职业"
                value={String(selfInfoObject.tips3 ?? "")}
                onValueChange={v =>
                  onChange(KEY_ABOUT_SELF_INFO, patchObjectJsonValue(values[KEY_ABOUT_SELF_INFO], "tips3", v))
                }
              />
              <FormInput
                label="个人信息内容3"
                placeholder="例如：软件工程师👨"
                value={String(selfInfoObject.content3 ?? "")}
                onValueChange={v =>
                  onChange(KEY_ABOUT_SELF_INFO, patchObjectJsonValue(values[KEY_ABOUT_SELF_INFO], "content3", v))
                }
              />
            </SettingsFieldGroup>
          </>
        ) : (
          hasMapInfoHistory && (
            <div className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-700 dark:text-warning-300">
              地图与信息板块当前关闭，但检测到历史配置已保留；重新开启后可继续编辑并生效。
            </div>
          )
        )}

        {enablePersonality ? (
          <>
            <SettingsFieldGroup cols={2}>
              <FormInput
                label="性格提示"
                placeholder="例如：性格"
                value={String(personalityObject.tips ?? "")}
                onValueChange={v =>
                  onChange(KEY_ABOUT_PERSONALITIES, patchObjectJsonValue(values[KEY_ABOUT_PERSONALITIES], "tips", v))
                }
              />
              <FormInput
                label="作者称号"
                placeholder="例如：执政官"
                value={String(personalityObject.authorName ?? "")}
                onValueChange={v =>
                  onChange(
                    KEY_ABOUT_PERSONALITIES,
                    patchObjectJsonValue(values[KEY_ABOUT_PERSONALITIES], "authorName", v)
                  )
                }
              />
            </SettingsFieldGroup>
            <SettingsFieldGroup cols={2}>
              <FormInput
                label="性格类型"
                placeholder="例如：ESFJ-A"
                value={String(personalityObject.personalityType ?? "")}
                onValueChange={v =>
                  onChange(
                    KEY_ABOUT_PERSONALITIES,
                    patchObjectJsonValue(values[KEY_ABOUT_PERSONALITIES], "personalityType", v)
                  )
                }
              />
              <FormInput
                label="性格颜色"
                placeholder="例如：#ac899c"
                value={String(personalityObject.personalityTypeColor ?? "")}
                onValueChange={v =>
                  onChange(
                    KEY_ABOUT_PERSONALITIES,
                    patchObjectJsonValue(values[KEY_ABOUT_PERSONALITIES], "personalityTypeColor", v)
                  )
                }
              />
            </SettingsFieldGroup>
            <FormInput
              label="人格类型链接"
              placeholder="https://www.16personalities.com/..."
              value={String(personalityObject.nameUrl ?? "")}
              onValueChange={v =>
                onChange(KEY_ABOUT_PERSONALITIES, patchObjectJsonValue(values[KEY_ABOUT_PERSONALITIES], "nameUrl", v))
              }
            />
            <SettingsFieldGroup cols={2}>
              <FormImageUpload
                label="人格图"
                value={String(personalityObject.personalityImg ?? "")}
                onValueChange={v =>
                  onChange(
                    KEY_ABOUT_PERSONALITIES,
                    patchObjectJsonValue(values[KEY_ABOUT_PERSONALITIES], "personalityImg", v)
                  )
                }
                placeholder="请输入人格图 URL"
              />
              <FormImageUpload
                label="照片图"
                value={String(personalityObject.photoUrl ?? "")}
                onValueChange={v =>
                  onChange(
                    KEY_ABOUT_PERSONALITIES,
                    patchObjectJsonValue(values[KEY_ABOUT_PERSONALITIES], "photoUrl", v)
                  )
                }
                placeholder="请输入照片图 URL"
              />
            </SettingsFieldGroup>
          </>
        ) : (
          hasPersonalityHistory && (
            <div className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-700 dark:text-warning-300">
              性格板块当前关闭，但检测到历史配置已保留；重新开启后可继续编辑并生效。
            </div>
          )
        )}

        {enableMaxim ? (
          <>
            <SettingsFieldGroup cols={2}>
              <FormInput
                label="座右铭提示"
                placeholder="例如：座右铭"
                value={String(maximObject.tips ?? "")}
                onValueChange={v => onChange(KEY_ABOUT_MAXIM, patchObjectJsonValue(values[KEY_ABOUT_MAXIM], "tips", v))}
              />
              <FormInput
                label="座右铭上行"
                placeholder="例如：生活明朗"
                value={String(maximObject.top ?? "")}
                onValueChange={v => onChange(KEY_ABOUT_MAXIM, patchObjectJsonValue(values[KEY_ABOUT_MAXIM], "top", v))}
              />
            </SettingsFieldGroup>
            <FormInput
              label="座右铭下行"
              placeholder="例如：万物可爱"
              value={String(maximObject.bottom ?? "")}
              onValueChange={v => onChange(KEY_ABOUT_MAXIM, patchObjectJsonValue(values[KEY_ABOUT_MAXIM], "bottom", v))}
            />
          </>
        ) : (
          hasMaximHistory && (
            <div className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-700 dark:text-warning-300">
              座右铭板块当前关闭，但检测到历史配置已保留；重新开启后可继续编辑并生效。
            </div>
          )
        )}

        {enableBuff ? (
          <>
            <SettingsFieldGroup cols={2}>
              <FormInput
                label="Buff 提示"
                placeholder="例如：特长"
                value={String(buffObject.tips ?? "")}
                onValueChange={v => onChange(KEY_ABOUT_BUFF, patchObjectJsonValue(values[KEY_ABOUT_BUFF], "tips", v))}
              />
              <FormInput
                label="Buff 上行"
                placeholder="例如：全栈开发"
                value={String(buffObject.top ?? "")}
                onValueChange={v => onChange(KEY_ABOUT_BUFF, patchObjectJsonValue(values[KEY_ABOUT_BUFF], "top", v))}
              />
            </SettingsFieldGroup>
            <FormInput
              label="Buff 下行"
              placeholder="例如：架构设计"
              value={String(buffObject.bottom ?? "")}
              onValueChange={v => onChange(KEY_ABOUT_BUFF, patchObjectJsonValue(values[KEY_ABOUT_BUFF], "bottom", v))}
            />
          </>
        ) : (
          hasBuffHistory && (
            <div className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-700 dark:text-warning-300">
              Buff 板块当前关闭，但检测到历史配置已保留；重新开启后可继续编辑并生效。
            </div>
          )
        )}

        {enableGame ? (
          <>
            <SettingsFieldGroup cols={2}>
              <FormInput
                label="游戏提示"
                placeholder="例如：爱好游戏"
                value={String(gameObject.tips ?? "")}
                onValueChange={v => onChange(KEY_ABOUT_GAME, patchObjectJsonValue(values[KEY_ABOUT_GAME], "tips", v))}
              />
              <FormInput
                label="游戏标题"
                placeholder="例如：原神"
                value={String(gameObject.title ?? "")}
                onValueChange={v => onChange(KEY_ABOUT_GAME, patchObjectJsonValue(values[KEY_ABOUT_GAME], "title", v))}
              />
            </SettingsFieldGroup>
            <FormInput
              label="游戏 UID"
              placeholder="例如：123456789"
              value={String(gameObject.uid ?? "")}
              onValueChange={v => onChange(KEY_ABOUT_GAME, patchObjectJsonValue(values[KEY_ABOUT_GAME], "uid", v))}
            />
            <FormImageUpload
              label="游戏背景图"
              value={String(gameObject.background ?? "")}
              onValueChange={v =>
                onChange(KEY_ABOUT_GAME, patchObjectJsonValue(values[KEY_ABOUT_GAME], "background", v))
              }
              placeholder="请输入游戏背景图 URL"
            />
          </>
        ) : (
          hasGameHistory && (
            <div className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-700 dark:text-warning-300">
              游戏板块当前关闭，但检测到历史配置已保留；重新开启后可继续编辑并生效。
            </div>
          )
        )}

        {enableComic ? (
          <>
            <SettingsFieldGroup cols={2}>
              <FormInput
                label="追番提示"
                placeholder="例如：追番"
                value={String(comicObject.tips ?? "")}
                onValueChange={v => onChange(KEY_ABOUT_COMIC, patchObjectJsonValue(values[KEY_ABOUT_COMIC], "tips", v))}
              />
              <FormInput
                label="追番标题"
                placeholder="例如：最近在看"
                value={String(comicObject.title ?? "")}
                onValueChange={v =>
                  onChange(KEY_ABOUT_COMIC, patchObjectJsonValue(values[KEY_ABOUT_COMIC], "title", v))
                }
              />
            </SettingsFieldGroup>
            <VisualArrayEditor
              label="追番列表"
              value={toObjectArrayJson(comicObject.list)}
              onValueChange={v =>
                onChange(KEY_ABOUT_COMIC, patchObjectJsonValue(values[KEY_ABOUT_COMIC], "list", parseJsonArray(v)))
              }
              description="追番条目列表，可拖拽排序。"
              fields={comicListFields}
              defaultItem={{ name: "", cover: "", href: "" }}
              itemLabel={item => (item.name as string) || "未命名追番项"}
              addButtonText="添加追番项"
            />
          </>
        ) : (
          hasComicHistory && (
            <div className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-700 dark:text-warning-300">
              追番板块当前关闭，但检测到历史配置已保留；重新开启后可继续编辑并生效。
            </div>
          )
        )}

        {enableLikeTech ? (
          <>
            <SettingsFieldGroup cols={2}>
              <FormInput
                label="技术提示"
                placeholder="例如：关注技术"
                value={String(likeObject.tips ?? "")}
                onValueChange={v => onChange(KEY_ABOUT_LIKE, patchObjectJsonValue(values[KEY_ABOUT_LIKE], "tips", v))}
              />
              <FormInput
                label="技术标题"
                placeholder="例如：喜欢的技术栈"
                value={String(likeObject.title ?? "")}
                onValueChange={v => onChange(KEY_ABOUT_LIKE, patchObjectJsonValue(values[KEY_ABOUT_LIKE], "title", v))}
              />
            </SettingsFieldGroup>
            <FormInput
              label="技术描述"
              placeholder="例如：热爱前端与工程化"
              value={String(likeObject.bottom ?? "")}
              onValueChange={v => onChange(KEY_ABOUT_LIKE, patchObjectJsonValue(values[KEY_ABOUT_LIKE], "bottom", v))}
            />
            <FormImageUpload
              label="技术背景图"
              value={String(likeObject.background ?? "")}
              onValueChange={v =>
                onChange(KEY_ABOUT_LIKE, patchObjectJsonValue(values[KEY_ABOUT_LIKE], "background", v))
              }
              placeholder="请输入技术背景图 URL"
            />
          </>
        ) : (
          hasLikeHistory && (
            <div className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-700 dark:text-warning-300">
              喜欢的技术板块当前关闭，但检测到历史配置已保留；重新开启后可继续编辑并生效。
            </div>
          )
        )}

        {enableMusic ? (
          <>
            <SettingsFieldGroup cols={2}>
              <FormInput
                label="音乐提示"
                placeholder="例如：音乐"
                value={String(musicObject.tips ?? "")}
                onValueChange={v => onChange(KEY_ABOUT_MUSIC, patchObjectJsonValue(values[KEY_ABOUT_MUSIC], "tips", v))}
              />
              <FormInput
                label="音乐标题"
                placeholder="例如：最近循环"
                value={String(musicObject.title ?? "")}
                onValueChange={v =>
                  onChange(KEY_ABOUT_MUSIC, patchObjectJsonValue(values[KEY_ABOUT_MUSIC], "title", v))
                }
              />
            </SettingsFieldGroup>
            <FormInput
              label="音乐链接"
              placeholder="https://..."
              value={String(musicObject.link ?? "")}
              onValueChange={v => onChange(KEY_ABOUT_MUSIC, patchObjectJsonValue(values[KEY_ABOUT_MUSIC], "link", v))}
            />
            <FormImageUpload
              label="音乐背景图"
              value={String(musicObject.background ?? "")}
              onValueChange={v =>
                onChange(KEY_ABOUT_MUSIC, patchObjectJsonValue(values[KEY_ABOUT_MUSIC], "background", v))
              }
              placeholder="请输入音乐背景图 URL"
            />
          </>
        ) : (
          hasMusicHistory && (
            <div className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-700 dark:text-warning-300">
              音乐板块当前关闭，但检测到历史配置已保留；重新开启后可继续编辑并生效。
            </div>
          )
        )}

        {enableCareers ? (
          <>
            <SettingsFieldGroup cols={2}>
              <FormInput
                label="职业经历提示"
                placeholder="例如：经历"
                value={String(careersObject.tips ?? "")}
                onValueChange={v =>
                  onChange(KEY_ABOUT_CAREERS, patchObjectJsonValue(values[KEY_ABOUT_CAREERS], "tips", v))
                }
              />
              <FormInput
                label="职业经历标题"
                placeholder="例如：我的职业路径"
                value={String(careersObject.title ?? "")}
                onValueChange={v =>
                  onChange(KEY_ABOUT_CAREERS, patchObjectJsonValue(values[KEY_ABOUT_CAREERS], "title", v))
                }
              />
            </SettingsFieldGroup>
            <FormImageUpload
              label="职业经历配图"
              value={String(careersObject.img ?? "")}
              onValueChange={v =>
                onChange(KEY_ABOUT_CAREERS, patchObjectJsonValue(values[KEY_ABOUT_CAREERS], "img", v))
              }
              placeholder="请输入职业经历配图 URL"
            />
            <VisualArrayEditor
              label="职业经历列表"
              value={toObjectArrayJson(careersObject.list)}
              onValueChange={v =>
                onChange(KEY_ABOUT_CAREERS, patchObjectJsonValue(values[KEY_ABOUT_CAREERS], "list", parseJsonArray(v)))
              }
              description="每条职业经历包含描述与颜色，可拖拽排序。"
              fields={careersListFields}
              defaultItem={{ desc: "", color: "" }}
              itemLabel={item => (item.desc as string) || "未命名经历"}
              addButtonText="添加经历项"
            />
          </>
        ) : (
          hasCareersHistory && (
            <div className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-700 dark:text-warning-300">
              职业经历板块当前关闭，但检测到历史配置已保留；重新开启后可继续编辑并生效。
            </div>
          )
        )}

        {enableStatistic ? (
          <FormImageUpload
            label="统计背景图"
            value={values[KEY_ABOUT_STATISTICS_BG]}
            onValueChange={v => onChange(KEY_ABOUT_STATISTICS_BG, v)}
            placeholder="请输入统计板块背景图 URL"
          />
        ) : (
          hasStatisticHistory && (
            <div className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-700 dark:text-warning-300">
              统计板块当前关闭，但检测到历史配置已保留；重新开启后可继续编辑并生效。
            </div>
          )
        )}
      </SettingsSection>

      {/* 自定义代码 */}
      <SettingsSection title="自定义代码">
        {aboutCustomCodeEnabled ? (
          <RichContentEditor
            label="关于页自定义内容"
            description="使用 Markdown/HTML 编写关于页底部自定义内容，系统会自动同步生成 HTML。"
            markdownValue={values[KEY_ABOUT_CUSTOM_CODE] || values[KEY_ABOUT_CUSTOM_CODE_HTML]}
            htmlValue={values[KEY_ABOUT_CUSTOM_CODE_HTML]}
            onMarkdownChange={v => onChange(KEY_ABOUT_CUSTOM_CODE, v)}
            onHtmlChange={v => onChange(KEY_ABOUT_CUSTOM_CODE_HTML, v)}
          />
        ) : (
          hasAboutCustomCodeHistory && (
            <div className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-700 dark:text-warning-300">
              自定义代码开关当前关闭，但检测到历史配置已保留。重新开启后可继续编辑并生效。
            </div>
          )
        )}
      </SettingsSection>
    </div>
  );
}
