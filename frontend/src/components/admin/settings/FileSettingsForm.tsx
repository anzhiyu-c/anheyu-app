"use client";

import { FormInput } from "@/components/ui/form-input";
import { FormSwitch } from "@/components/ui/form-switch";
import { SettingsSection, SettingsFieldGroup } from "./SettingsSection";
import { Spinner } from "@/components/ui/spinner";
import {
  KEY_UPLOAD_ALLOWED_EXTENSIONS,
  KEY_UPLOAD_DENIED_EXTENSIONS,
  KEY_ENABLE_VIPS_GENERATOR,
  KEY_VIPS_PATH,
  KEY_VIPS_MAX_FILE_SIZE,
  KEY_VIPS_SUPPORTED_EXTS,
  KEY_ENABLE_MUSIC_COVER_GENERATOR,
  KEY_MUSIC_COVER_MAX_FILE_SIZE,
  KEY_MUSIC_COVER_SUPPORTED_EXTS,
  KEY_ENABLE_FFMPEG_GENERATOR,
  KEY_FFMPEG_PATH,
  KEY_FFMPEG_MAX_FILE_SIZE,
  KEY_FFMPEG_SUPPORTED_EXTS,
  KEY_FFMPEG_CAPTURE_TIME,
  KEY_ENABLE_LIBRAW_GENERATOR,
  KEY_LIBRAW_PATH,
  KEY_LIBRAW_MAX_FILE_SIZE,
  KEY_LIBRAW_SUPPORTED_EXTS,
  KEY_ENABLE_BUILTIN_GENERATOR,
  KEY_BUILTIN_MAX_FILE_SIZE,
  KEY_BUILTIN_DIRECT_SERVE_EXTS,
  KEY_QUEUE_THUMB_CONCURRENCY,
  KEY_QUEUE_THUMB_MAX_EXEC_TIME,
  KEY_QUEUE_THUMB_BACKOFF_FACTOR,
  KEY_QUEUE_THUMB_MAX_BACKOFF,
  KEY_QUEUE_THUMB_MAX_RETRIES,
  KEY_QUEUE_THUMB_RETRY_DELAY,
  KEY_ENABLE_EXIF_EXTRACTOR,
  KEY_EXIF_MAX_SIZE_LOCAL,
  KEY_EXIF_MAX_SIZE_REMOTE,
  KEY_EXIF_USE_BRUTE_FORCE,
  KEY_ENABLE_MUSIC_EXTRACTOR,
  KEY_MUSIC_MAX_SIZE_LOCAL,
  KEY_MUSIC_MAX_SIZE_REMOTE,
} from "@/lib/settings/setting-keys";

interface FileSettingsFormProps {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  loading?: boolean;
}

export function FileSettingsForm({ values, onChange, loading }: FileSettingsFormProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 上传限制 */}
      <SettingsSection title="上传限制">
        <FormInput
          label="允许的文件扩展名"
          placeholder=".jpg,.png,.gif,.webp,.mp4,.mp3,.pdf"
          value={values[KEY_UPLOAD_ALLOWED_EXTENSIONS]}
          onValueChange={v => onChange(KEY_UPLOAD_ALLOWED_EXTENSIONS, v)}
          description="留空表示允许所有类型，多个扩展名用英文逗号分隔"
        />
        <FormInput
          label="禁止的文件扩展名"
          placeholder=".exe,.bat,.sh,.cmd"
          value={values[KEY_UPLOAD_DENIED_EXTENSIONS]}
          onValueChange={v => onChange(KEY_UPLOAD_DENIED_EXTENSIONS, v)}
          description="优先级高于允许列表，多个扩展名用英文逗号分隔"
        />
      </SettingsSection>

      {/* VIPS 图片处理 */}
      <SettingsSection title="VIPS 图片处理">
        <FormSwitch
          label="启用 VIPS 处理"
          description="使用 libvips 生成图片缩略图（需要安装 vips 库）"
          checked={values[KEY_ENABLE_VIPS_GENERATOR] === "true"}
          onCheckedChange={v => onChange(KEY_ENABLE_VIPS_GENERATOR, String(v))}
        />
        <FormInput
          label="VIPS 路径"
          placeholder="/usr/bin/vips"
          value={values[KEY_VIPS_PATH]}
          onValueChange={v => onChange(KEY_VIPS_PATH, v)}
          description="vips 可执行文件路径"
        />
        <SettingsFieldGroup cols={2}>
          <FormInput
            label="最大文件大小（MB）"
            placeholder="20"
            value={values[KEY_VIPS_MAX_FILE_SIZE]}
            onValueChange={v => onChange(KEY_VIPS_MAX_FILE_SIZE, v)}
          />
          <FormInput
            label="支持的扩展名"
            placeholder=".jpg,.jpeg,.png,.webp,.gif,.bmp,.tiff"
            value={values[KEY_VIPS_SUPPORTED_EXTS]}
            onValueChange={v => onChange(KEY_VIPS_SUPPORTED_EXTS, v)}
          />
        </SettingsFieldGroup>
      </SettingsSection>

      {/* 音乐封面提取 */}
      <SettingsSection title="音乐封面提取">
        <FormSwitch
          label="启用音乐封面提取"
          description="从音乐文件中提取内嵌封面作为缩略图"
          checked={values[KEY_ENABLE_MUSIC_COVER_GENERATOR] === "true"}
          onCheckedChange={v => onChange(KEY_ENABLE_MUSIC_COVER_GENERATOR, String(v))}
        />
        <SettingsFieldGroup cols={2}>
          <FormInput
            label="最大文件大小（MB）"
            placeholder="50"
            value={values[KEY_MUSIC_COVER_MAX_FILE_SIZE]}
            onValueChange={v => onChange(KEY_MUSIC_COVER_MAX_FILE_SIZE, v)}
          />
          <FormInput
            label="支持的扩展名"
            placeholder=".mp3,.flac,.ogg,.m4a"
            value={values[KEY_MUSIC_COVER_SUPPORTED_EXTS]}
            onValueChange={v => onChange(KEY_MUSIC_COVER_SUPPORTED_EXTS, v)}
          />
        </SettingsFieldGroup>
      </SettingsSection>

      {/* FFmpeg 视频处理 */}
      <SettingsSection title="FFmpeg 视频处理">
        <FormSwitch
          label="启用 FFmpeg 处理"
          description="使用 FFmpeg 截取视频帧生成缩略图（需要安装 ffmpeg）"
          checked={values[KEY_ENABLE_FFMPEG_GENERATOR] === "true"}
          onCheckedChange={v => onChange(KEY_ENABLE_FFMPEG_GENERATOR, String(v))}
        />
        <FormInput
          label="FFmpeg 路径"
          placeholder="/usr/bin/ffmpeg"
          value={values[KEY_FFMPEG_PATH]}
          onValueChange={v => onChange(KEY_FFMPEG_PATH, v)}
          description="ffmpeg 可执行文件路径"
        />
        <SettingsFieldGroup cols={2}>
          <FormInput
            label="最大文件大小（MB）"
            placeholder="500"
            value={values[KEY_FFMPEG_MAX_FILE_SIZE]}
            onValueChange={v => onChange(KEY_FFMPEG_MAX_FILE_SIZE, v)}
          />
          <FormInput
            label="支持的扩展名"
            placeholder=".mp4,.avi,.mov,.mkv,.webm"
            value={values[KEY_FFMPEG_SUPPORTED_EXTS]}
            onValueChange={v => onChange(KEY_FFMPEG_SUPPORTED_EXTS, v)}
          />
        </SettingsFieldGroup>
        <FormInput
          label="截取时间（秒）"
          placeholder="3"
          value={values[KEY_FFMPEG_CAPTURE_TIME]}
          onValueChange={v => onChange(KEY_FFMPEG_CAPTURE_TIME, v)}
          description="在视频的第几秒截取帧作为缩略图"
        />
      </SettingsSection>

      {/* LibRaw 图片处理 */}
      <SettingsSection title="LibRaw 图片处理">
        <FormSwitch
          label="启用 LibRaw 处理"
          description="使用 libraw 处理 RAW 图片并生成缩略图"
          checked={values[KEY_ENABLE_LIBRAW_GENERATOR] === "true"}
          onCheckedChange={v => onChange(KEY_ENABLE_LIBRAW_GENERATOR, String(v))}
        />
        <FormInput
          label="LibRaw 路径"
          placeholder="/usr/bin/libraw"
          value={values[KEY_LIBRAW_PATH]}
          onValueChange={v => onChange(KEY_LIBRAW_PATH, v)}
          description="libraw 可执行文件路径"
        />
        <SettingsFieldGroup cols={2}>
          <FormInput
            label="最大文件大小（MB）"
            placeholder="50"
            value={values[KEY_LIBRAW_MAX_FILE_SIZE]}
            onValueChange={v => onChange(KEY_LIBRAW_MAX_FILE_SIZE, v)}
          />
          <FormInput
            label="支持的扩展名"
            placeholder=".cr2,.nef,.arw,.dng"
            value={values[KEY_LIBRAW_SUPPORTED_EXTS]}
            onValueChange={v => onChange(KEY_LIBRAW_SUPPORTED_EXTS, v)}
          />
        </SettingsFieldGroup>
      </SettingsSection>

      {/* 内建处理器 */}
      <SettingsSection title="内建处理器">
        <FormSwitch
          label="启用内建处理器"
          description="使用内建的 Go 图片处理生成缩略图"
          checked={values[KEY_ENABLE_BUILTIN_GENERATOR] === "true"}
          onCheckedChange={v => onChange(KEY_ENABLE_BUILTIN_GENERATOR, String(v))}
        />
        <FormInput
          label="最大文件大小（MB）"
          placeholder="10"
          value={values[KEY_BUILTIN_MAX_FILE_SIZE]}
          onValueChange={v => onChange(KEY_BUILTIN_MAX_FILE_SIZE, v)}
        />
        <FormInput
          label="直接服务的扩展名"
          placeholder=".svg,.ico"
          value={values[KEY_BUILTIN_DIRECT_SERVE_EXTS]}
          onValueChange={v => onChange(KEY_BUILTIN_DIRECT_SERVE_EXTS, v)}
          description="这些格式不生成缩略图，直接使用原文件"
        />
      </SettingsSection>

      {/* 缩略图队列 */}
      <SettingsSection title="缩略图队列">
        <SettingsFieldGroup cols={2}>
          <FormInput
            label="并发数"
            placeholder="3"
            value={values[KEY_QUEUE_THUMB_CONCURRENCY]}
            onValueChange={v => onChange(KEY_QUEUE_THUMB_CONCURRENCY, v)}
          />
          <FormInput
            label="最大执行时间（秒）"
            placeholder="60"
            value={values[KEY_QUEUE_THUMB_MAX_EXEC_TIME]}
            onValueChange={v => onChange(KEY_QUEUE_THUMB_MAX_EXEC_TIME, v)}
          />
        </SettingsFieldGroup>
        <SettingsFieldGroup cols={2}>
          <FormInput
            label="退避因子"
            placeholder="2"
            value={values[KEY_QUEUE_THUMB_BACKOFF_FACTOR]}
            onValueChange={v => onChange(KEY_QUEUE_THUMB_BACKOFF_FACTOR, v)}
          />
          <FormInput
            label="最大退避时间（秒）"
            placeholder="300"
            value={values[KEY_QUEUE_THUMB_MAX_BACKOFF]}
            onValueChange={v => onChange(KEY_QUEUE_THUMB_MAX_BACKOFF, v)}
          />
        </SettingsFieldGroup>
        <SettingsFieldGroup cols={2}>
          <FormInput
            label="最大重试次数"
            placeholder="3"
            value={values[KEY_QUEUE_THUMB_MAX_RETRIES]}
            onValueChange={v => onChange(KEY_QUEUE_THUMB_MAX_RETRIES, v)}
          />
          <FormInput
            label="重试延迟（秒）"
            placeholder="5"
            value={values[KEY_QUEUE_THUMB_RETRY_DELAY]}
            onValueChange={v => onChange(KEY_QUEUE_THUMB_RETRY_DELAY, v)}
          />
        </SettingsFieldGroup>
      </SettingsSection>

      {/* EXIF 提取 */}
      <SettingsSection title="EXIF 提取">
        <FormSwitch
          label="启用 EXIF 提取"
          description="从图片文件中提取 EXIF 元数据（拍摄参数、GPS 等）"
          checked={values[KEY_ENABLE_EXIF_EXTRACTOR] === "true"}
          onCheckedChange={v => onChange(KEY_ENABLE_EXIF_EXTRACTOR, String(v))}
        />
        <SettingsFieldGroup cols={2}>
          <FormInput
            label="本地文件最大大小（MB）"
            placeholder="50"
            value={values[KEY_EXIF_MAX_SIZE_LOCAL]}
            onValueChange={v => onChange(KEY_EXIF_MAX_SIZE_LOCAL, v)}
          />
          <FormInput
            label="远程文件最大大小（MB）"
            placeholder="20"
            value={values[KEY_EXIF_MAX_SIZE_REMOTE]}
            onValueChange={v => onChange(KEY_EXIF_MAX_SIZE_REMOTE, v)}
          />
        </SettingsFieldGroup>
        <FormSwitch
          label="使用暴力解析"
          description="对损坏的 EXIF 数据使用暴力解析模式"
          checked={values[KEY_EXIF_USE_BRUTE_FORCE] === "true"}
          onCheckedChange={v => onChange(KEY_EXIF_USE_BRUTE_FORCE, String(v))}
        />
      </SettingsSection>

      {/* 音乐信息提取 */}
      <SettingsSection title="音乐信息提取">
        <FormSwitch
          label="启用音乐信息提取"
          description="从音乐文件中提取标题、艺术家、专辑等元数据"
          checked={values[KEY_ENABLE_MUSIC_EXTRACTOR] === "true"}
          onCheckedChange={v => onChange(KEY_ENABLE_MUSIC_EXTRACTOR, String(v))}
        />
        <SettingsFieldGroup cols={2}>
          <FormInput
            label="本地文件最大大小（MB）"
            placeholder="100"
            value={values[KEY_MUSIC_MAX_SIZE_LOCAL]}
            onValueChange={v => onChange(KEY_MUSIC_MAX_SIZE_LOCAL, v)}
          />
          <FormInput
            label="远程文件最大大小（MB）"
            placeholder="50"
            value={values[KEY_MUSIC_MAX_SIZE_REMOTE]}
            onValueChange={v => onChange(KEY_MUSIC_MAX_SIZE_REMOTE, v)}
          />
        </SettingsFieldGroup>
      </SettingsSection>
    </div>
  );
}
