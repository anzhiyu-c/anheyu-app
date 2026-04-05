"use client";

import { useMemo } from "react";
import { useSiteConfigStore } from "@/store/site-config-store";
import { Spinner } from "@/components/ui";
import type { AboutPageConfig, AboutEnableConfig } from "@/types/about";
import { AuthorBox } from "./AuthorBox";
import { AuthorPageContent } from "./AuthorPageContent";
import { SkillsCard } from "./SkillsCard";
import { CareersCard } from "./CareersCard";
import { StatisticCard } from "./StatisticCard";
import { MapAndInfoCard } from "./MapAndInfoCard";
import { PersonalityCard } from "./PersonalityCard";
import { PhotoCard } from "./PhotoCard";
import { MaximCard } from "./MaximCard";
import { BuffCard } from "./BuffCard";
import { GameCard } from "./GameCard";
import { ComicCard } from "./ComicCard";
import { LikeTechCard } from "./LikeTechCard";
import { MusicCard } from "./MusicCard";
import { RewardCard } from "./RewardCard";
import styles from "../about.module.css";

export function AboutPageContent() {
  const siteConfig = useSiteConfigStore(state => state.siteConfig);
  const isLoaded = useSiteConfigStore(state => state.isLoaded);

  const aboutConfig = useMemo(() => {
    const raw = (siteConfig as Record<string, unknown>)?.about;
    if (raw && typeof raw === "object" && "page" in (raw as Record<string, unknown>)) {
      return (raw as { page: AboutPageConfig }).page;
    }
    return null;
  }, [siteConfig]);

  const enable: AboutEnableConfig = useMemo(() => {
    const e = aboutConfig?.enable;
    return {
      author_box: e?.author_box !== false,
      page_content: e?.page_content !== false,
      skills: e?.skills !== false,
      careers: e?.careers !== false,
      statistic: e?.statistic !== false,
      map_and_info: e?.map_and_info !== false,
      personality: e?.personality !== false,
      photo: e?.photo !== false,
      maxim: e?.maxim !== false,
      buff: e?.buff !== false,
      game: e?.game !== false,
      comic: e?.comic !== false,
      like_tech: e?.like_tech !== false,
      music: e?.music !== false,
      custom_code: e?.custom_code !== false,
      reward: e?.reward !== false,
      comment: e?.comment !== false,
    };
  }, [aboutConfig?.enable]);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!aboutConfig) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-20 text-center text-muted-foreground">
        关于页面配置未找到，请在管理后台配置。
      </div>
    );
  }

  return (
    <div className={styles.aboutContainer}>
      {/* 作者头像框 */}
      {enable.author_box && aboutConfig.avatar_img && (
        <AuthorBox
          avatarImg={aboutConfig.avatar_img}
          avatarSkillsLeft={aboutConfig.avatar_skills_left || []}
          avatarSkillsRight={aboutConfig.avatar_skills_right || []}
        />
      )}
      <div className={styles.authorTitle}>关于本站</div>
      {/* 基础介绍内容 */}
      {enable.page_content && aboutConfig.name && (
        <AuthorPageContent
          name={aboutConfig.name}
          description={aboutConfig.description}
          aboutSiteTips={aboutConfig.about_site_tips}
        />
      )}
      {/* 技能 + 职业经历 */}
      {(enable.skills || enable.careers) && (
        <div className={styles.authorContent}>
          {enable.skills && aboutConfig.skills_tips && <SkillsCard skillsTips={aboutConfig.skills_tips} />}
          {enable.careers && aboutConfig.careers && <CareersCard careers={aboutConfig.careers} />}
        </div>
      )}
      {/* 统计 + 地图信息 */}
      {(enable.statistic || enable.map_and_info) && (
        <div className={styles.authorContent}>
          {enable.statistic && aboutConfig.statistics_background && (
            <StatisticCard cover={aboutConfig.statistics_background} />
          )}
          {enable.map_and_info && aboutConfig.map && aboutConfig.self_info && (
            <MapAndInfoCard map={aboutConfig.map} selfInfo={aboutConfig.self_info} />
          )}
        </div>
      )}
      {/* 性格 + 照片 */}
      {(enable.personality || enable.photo) && (
        <div className={styles.authorContent}>
          {enable.personality && aboutConfig.personalities && (
            <PersonalityCard personalities={aboutConfig.personalities} />
          )}
          {enable.photo && aboutConfig.personalities?.photoUrl && (
            <PhotoCard photoUrl={aboutConfig.personalities.photoUrl} />
          )}
        </div>
      )}
      {/* 座右铭 + Buff */}
      {(enable.maxim || enable.buff) && (
        <div className={styles.authorContent}>
          {enable.maxim && aboutConfig.maxim && <MaximCard maxim={aboutConfig.maxim} />}
          {enable.buff && aboutConfig.buff && <BuffCard buff={aboutConfig.buff} />}
        </div>
      )}
      {/* 游戏 + 追番 */}
      {(enable.game || enable.comic) && (
        <div className={styles.authorContent}>
          {enable.game && aboutConfig.game && <GameCard game={aboutConfig.game} />}
          {enable.comic && aboutConfig.comic && <ComicCard comic={aboutConfig.comic} />}
        </div>
      )}
      {/* 技术偏好 + 音乐 */}
      {(enable.like_tech || enable.music) && (
        <div className={styles.authorContent}>
          {enable.like_tech && aboutConfig.like && <LikeTechCard like={aboutConfig.like} />}
          {enable.music && aboutConfig.music && <MusicCard music={aboutConfig.music} authorName={aboutConfig.name} />}
        </div>
      )}
      {/* 自定义内容块 */}
      {enable.custom_code && aboutConfig.custom_code_html && (
        <div
          className={styles.customContentBlock}
          data-custom-block=""
          dangerouslySetInnerHTML={{ __html: aboutConfig.custom_code_html }}
        />
      )}
      {/* 赞赏名单 */}
      {enable.reward && <RewardCard />}
    </div>
  );
}
