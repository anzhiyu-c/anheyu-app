package configdef

import (
	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

// Definition 定义了单个配置项的所有属性。
type Definition struct {
	Key      constant.SettingKey
	Value    string
	Comment  string
	IsPublic bool
}

// UserGroupDefinition 定义了单个用户组的所有属性。
type UserGroupDefinition struct {
	ID          uint
	Name        string
	Description string
	Permissions model.Boolset
	MaxStorage  int64
	SpeedLimit  int64
	Settings    model.GroupSettings
}

// AllSettings 是我们系统中所有配置项的"单一事实来源"
var AllSettings = []Definition{
	// --- 站点基础配置 ---
	{Key: constant.KeyAppName, Value: "安和鱼", Comment: "应用名称", IsPublic: true},
	{Key: constant.KeySubTitle, Value: "生活明朗，万物可爱", Comment: "应用副标题", IsPublic: true},
	{Key: constant.KeySiteURL, Value: "https://anheyu.com", Comment: "应用URL", IsPublic: true},
	{Key: constant.KeyAppVersion, Value: "1.0.0", Comment: "应用版本", IsPublic: true},
	{Key: constant.KeyApiURL, Value: "/", Comment: "API地址", IsPublic: true},
	{Key: constant.KeyAboutLink, Value: "https://github.com/anzhiyu-c/anheyu-app", Comment: "关于链接", IsPublic: true},
	{Key: constant.KeyIcpNumber, Value: "湘ICP备2023015794号-2", Comment: "ICP备案号", IsPublic: true},
	{Key: constant.KeyPoliceRecordNumber, Value: "", Comment: "公安联网备案号", IsPublic: true},
	{Key: constant.KeyPoliceRecordIcon, Value: "https://www.beian.gov.cn/img/new/gongan.png", Comment: "公安联网备案号图标URL，显示在备案号前面", IsPublic: true},
	{Key: constant.KeyUserAvatar, Value: "/static/img/avatar.jpg", Comment: "用户默认头像URL", IsPublic: true},
	{Key: constant.KeyLogoURL, Value: "/static/img/logo.svg", Comment: "Logo图片URL (通用)", IsPublic: true},
	{Key: constant.KeyLogoURL192, Value: "/static/img/logo-192x192.png", Comment: "Logo图片URL (192x192)", IsPublic: true},
	{Key: constant.KeyLogoURL512, Value: "/static/img/logo-512x512.png", Comment: "Logo图片URL (512x512)", IsPublic: true},
	{Key: constant.KeyLogoHorizontalDay, Value: "/static/img/logo-horizontal-day.png", Comment: "横向Logo (白天模式)", IsPublic: true},
	{Key: constant.KeyLogoHorizontalNight, Value: "/static/img/logo-horizontal-night.png", Comment: "横向Logo (暗色模式)", IsPublic: true},
	{Key: constant.KeyIconURL, Value: "/favicon.ico", Comment: "Icon图标URL", IsPublic: true},
	{Key: constant.KeySiteKeywords, Value: "安和鱼,博客,blog,搭建博客,服务器,搭建网站,建站,相册,图片管理", Comment: "站点关键词", IsPublic: true},
	{Key: constant.KeySiteDescription, Value: "新一代博客，就这么搭，Vue渲染颜值，Go守护性能，SSR打破加载瓶颈。", Comment: "站点描述", IsPublic: true},
	{Key: constant.KeyAppearanceSkin, Value: "brand_blue", Comment: "前台换肤预设 ID（内置方案，如 brand_blue、emerald）", IsPublic: true},
	{Key: constant.KeyAppearanceTokens, Value: "{}", Comment: "前台颜色令牌 JSON 覆盖：{\"light\":{...},\"dark\":{...}}，字段含 primary、primaryForeground、success、warning、danger、info、accent", IsPublic: true},
	{Key: constant.KeySiteAnnouncement, Value: "", Comment: "站点公告（HTML 片段），展示在导航栏下方；留空不显示", IsPublic: true},
	{Key: constant.KeyCustomHeaderHTML, Value: "", Comment: "自定义头部HTML代码，将插入到 <head> 标签内", IsPublic: true},
	{Key: constant.KeyCustomFooterHTML, Value: "", Comment: "自定义底部HTML代码，将插入到 </body> 标签前", IsPublic: true},
	{Key: constant.KeyCustomCSS, Value: "", Comment: "自定义CSS样式，无需填写 <style> 标签", IsPublic: true},
	{Key: constant.KeyCustomJS, Value: "", Comment: "自定义JavaScript代码（如网站统计等），无需填写 <script> 标签", IsPublic: true},
	{Key: constant.KeyCustomSidebar, Value: "[]", Comment: "自定义侧边栏块配置 (JSON数组格式，支持0-3个块，每个块包含title和content字段)", IsPublic: true},
	{Key: constant.KeyCustomPostTopHTML, Value: "", Comment: "自定义文章顶部HTML代码，将插入到文章内容区域顶部", IsPublic: true},
	{Key: constant.KeyCustomPostBottomHTML, Value: "", Comment: "自定义文章底部HTML代码，将插入到文章内容区域底部", IsPublic: true},
	{Key: constant.KeyDefaultThemeMode, Value: "light", Comment: "默认主题模式 (light/dark/auto)，auto 按访客设备本地时间定时切换", IsPublic: true},
	{Key: constant.KeyThemeLightStartTime, Value: "08:00", Comment: "自动主题浅色模式开始时间 (HH:mm，访客设备本地时间)", IsPublic: true},
	{Key: constant.KeyThemeDarkStartTime, Value: "20:00", Comment: "自动主题深色模式开始时间 (HH:mm，访客设备本地时间)", IsPublic: true},
	{Key: constant.KeyDefaultThumbParam, Value: "", Comment: "默认缩略图处理参数", IsPublic: true},
	{Key: constant.KeyDefaultBigParam, Value: "", Comment: "默认大图处理参数", IsPublic: true},
	{Key: constant.KeyGravatarURL, Value: "https://cravatar.cn/", Comment: "Gravatar 服务器地址", IsPublic: true},
	{Key: constant.KeyDefaultGravatarType, Value: "mp", Comment: "Gravatar默认头像类型", IsPublic: true},
	{Key: constant.KeyUploadAllowedExtensions, Value: "", Comment: "允许上传的文件后缀名白名单，逗号分隔", IsPublic: true},
	{Key: constant.KeyUploadDeniedExtensions, Value: "", Comment: "禁止上传的文件后缀名黑名单，在白名单未启用时生效", IsPublic: true},
	{Key: constant.KeyEnableExternalLinkWarning, Value: "false", Comment: "是否开启外链跳转提示 (true/false)，开启后跳转外链会显示中间提示页面", IsPublic: true},
	{Key: constant.KeyDisableRightMenu, Value: "false", Comment: "是否全站关闭本站自定义右键菜单 (true/false)，开启后前台右键使用浏览器原生菜单", IsPublic: true},
	{Key: constant.KeyRespectReducedMotion, Value: "false", Comment: "是否尊重系统减弱动效偏好，开启后在用户开启了系统减弱动效时降低前台动画 (true/false)", IsPublic: true},
	// --- 缩略图生成器配置 ---
	{Key: constant.KeyEnableVipsGenerator, Value: "false", Comment: "是否启用 VIPS 缩略图生成器 (true/false)", IsPublic: true},
	{Key: constant.KeyVipsPath, Value: "vips", Comment: "VIPS 命令的路径或名称 (默认 'vips'，让系统自动搜索)", IsPublic: false},
	{Key: constant.KeyVipsMaxFileSize, Value: "78643200", Comment: "VIPS 生成器可处理的最大原始文件大小(单位:字节)，0为不限制", IsPublic: true},
	{Key: constant.KeyVipsSupportedExts, Value: "3fr,ari,arw,bay,braw,crw,cr2,cr3,cap,data,dcs,dcr,dng,drf,eip,erf,fff,gpr,iiq,k25,kdc,mdc,mef,mos,mrw,nef,nrw,obm,orf,pef,ptx,pxn,r3d,raf,raw,rwl,rw2,rwz,sr2,srf,srw,tif,x3f,csv,mat,img,hdr,pbm,pgm,ppm,pfm,pnm,svg,svgz,j2k,jp2,jpt,j2c,jpc,gif,png,jpg,jpeg,jpe,webp,tif,tiff,fits,fit,fts,exr,jxl,pdf,heic,heif,avif,svs,vms,vmu,ndpi,scn,mrxs,svslide,bif", Comment: "VIPS 此生成器可用的文件扩展名列表", IsPublic: true},
	{Key: constant.KeyEnableMusicCoverGenerator, Value: "true", Comment: "是否启用歌曲封面提取生成器 (true/false)", IsPublic: true},
	{Key: constant.KeyMusicCoverMaxFileSize, Value: "1073741824", Comment: "歌曲封面生成器可处理的最大原始文件大小(单位:字节, 默认1GB)，0为不限制", IsPublic: true},
	{Key: constant.KeyMusicCoverSupportedExts, Value: "mp3,m4a,ogg,flac", Comment: "歌曲封面提取器可用的文件扩展名列表", IsPublic: true},
	{Key: constant.KeyEnableFfmpegGenerator, Value: "false", Comment: "是否启用 FFmpeg 视频缩略图生成器 (true/false)", IsPublic: true},
	{Key: constant.KeyFfmpegPath, Value: "ffmpeg", Comment: "FFmpeg 命令的路径或名称 (默认 'ffmpeg'，让系统自动搜索)", IsPublic: false},
	{Key: constant.KeyFfmpegMaxFileSize, Value: "10737418240", Comment: "FFmpeg 生成器可处理的最大原始文件大小(单位:字节, 默认10GB)，0为不限制", IsPublic: true},
	{Key: constant.KeyFfmpegSupportedExts, Value: "3g2,3gp,asf,asx,avi,divx,flv,m2ts,m2v,m4v,mkv,mov,mp4,mpeg,mpg,mts,mxf,ogv,rm,swf,webm,wmv", Comment: "FFmpeg 此生成器可用的文件扩展名列表", IsPublic: true},
	{Key: constant.KeyFfmpegCaptureTime, Value: "00:00:01.00", Comment: "FFmpeg 定义缩略图截取的时间点", IsPublic: true},
	{Key: constant.KeyEnableBuiltinGenerator, Value: "true", Comment: "是否启用内置缩略图生成器 (true/false)", IsPublic: true},
	{Key: constant.KeyBuiltinMaxFileSize, Value: "78643200", Comment: "内置生成器可处理的最大原始文件大小(单位:字节)，0为不限制", IsPublic: true},
	{Key: constant.KeyBuiltinDirectServeExts, Value: "avif,webp", Comment: "内置生成器支持的直接服务扩展名列表", IsPublic: true},
	{Key: constant.KeyEnableLibrawGenerator, Value: "false", Comment: "是否启用 LibRaw/DCRaw 缩略图生成器 (true/false)", IsPublic: true},
	{Key: constant.KeyLibrawPath, Value: "simple_dcraw", Comment: "LibRaw/DCRaw 命令的路径或名称", IsPublic: false},
	{Key: constant.KeyLibrawMaxFileSize, Value: "78643200", Comment: "LibRaw/DCRaw 生成器可处理的最大原始文件大小(单位:字节, 75MB)", IsPublic: true},
	{Key: constant.KeyLibrawSupportedExts, Value: "3fr,ari,arw,bay,braw,crw,cr2,cr3,cap,data,dcs,dcr,dng,drf,eip,erf,fff,gpr,iiq,k25,kdc,mdc,mef,mos,mrw,nef,nrw,obm,orf,pef,ptx,pxn,r3d,raf,raw,rwl,rw2,rwz,sr2,srf,srw,tif,x3f", Comment: "LibRaw/DCRaw 此生成器可用的文件扩展名列表", IsPublic: true},

	// --- 图片样式缓存配置 ---
	{Key: constant.KeyImageStyleCachePath, Value: "./data/cache/image_styles", Comment: "图片样式缓存根目录", IsPublic: false},
	{Key: constant.KeyImageStyleCacheMaxMB, Value: "1024", Comment: "单策略图片样式缓存上限 (MB)，0 为不限制", IsPublic: false},
	{Key: constant.KeyImageStyleCacheCleanupInterval, Value: "600", Comment: "图片样式缓存清理周期 (秒)，0 关闭后台清理", IsPublic: false},

	// --- 队列配置 ---
	{Key: constant.KeyQueueThumbConcurrency, Value: "15", Comment: "缩略图生成队列的工作线程数", IsPublic: false},
	{Key: constant.KeyQueueThumbMaxExecTime, Value: "300", Comment: "单个缩略图生成任务的最大执行时间（秒）", IsPublic: false},
	{Key: constant.KeyQueueThumbBackoffFactor, Value: "2", Comment: "任务重试时间间隔的指数增长因子", IsPublic: false},
	{Key: constant.KeyQueueThumbMaxBackoff, Value: "60", Comment: "任务重试的最大退避时间（秒）", IsPublic: false},
	{Key: constant.KeyQueueThumbMaxRetries, Value: "3", Comment: "任务失败后的最大重试次数（0表示不重试）", IsPublic: false},
	{Key: constant.KeyQueueThumbRetryDelay, Value: "5", Comment: "任务重试的初始延迟时间（秒）", IsPublic: false},

	// --- 媒体信息提取配置 ---
	{Key: constant.KeyEnableExifExtractor, Value: "true", Comment: "是否启用 EXIF 提取 (true/false)", IsPublic: true},
	{Key: constant.KeyExifMaxSizeLocal, Value: "1073741824", Comment: "本地存储EXIF提取最大文件大小(单位:字节, 默认1GB)", IsPublic: true},
	{Key: constant.KeyExifMaxSizeRemote, Value: "104857600", Comment: "远程存储EXIF提取最大文件大小(单位:字节, 默认100MB)", IsPublic: true},
	{Key: constant.KeyExifUseBruteForce, Value: "true", Comment: "是否启用EXIF暴力搜索 (true/false)", IsPublic: true},
	{Key: constant.KeyEnableMusicExtractor, Value: "true", Comment: "是否启用音乐元数据提取 (true/false)", IsPublic: true},
	{Key: constant.KeyMusicMaxSizeLocal, Value: "1073741824", Comment: "本地存储音乐元数据提取最大文件大小(单位:字节, 默认1GB)", IsPublic: true},
	{Key: constant.KeyMusicMaxSizeRemote, Value: "1073741824", Comment: "远程存储音乐元数据提取最大文件大小(单位:字节, 默认1GB)", IsPublic: true},

	// --- Header/Nav 配置 ---
	{Key: constant.KeyHeaderMenu, Value: `[{"title":"文库","items":[{"title":"全部文章","path":"/archives","icon":"fa6-solid:book","isExternal":false},{"title":"分类列表","path":"/categories","icon":"fa6-solid:shapes","isExternal":false},{"title":"标签列表","path":"/tags","icon":"fa6-solid:tags","isExternal":false}]},{"title":"友链","items":[{"title":"友情链接","path":"/link","icon":"fa6-solid:link","isExternal":false},{"title":"宝藏博主","path":"/travelling","icon":"fa6-solid:cube","isExternal":false}]},{"title":"我的","items":[{"title":"音乐馆","path":"/music","icon":"fa6-solid:music","isExternal":false},{"title":"小空调","path":"/air-conditioner","icon":"fa6-solid:fan","isExternal":false},{"title":"相册集","path":"/album","icon":"fa6-solid:images","isExternal":false}]},{"title":"关于","items":[{"title":"随便逛逛","path":"/random-post","icon":"fa6-solid:shoe-prints","isExternal":false},{"title":"关于本站","path":"/about","icon":"fa6-solid:paper-plane","isExternal":false},{"title":"我的装备","path":"/equipment","icon":"fa6-solid:dice-d20","isExternal":false}]}]`, Comment: "主菜单配置 (有序数组结构)", IsPublic: true},
	{Key: constant.KeyHeaderNavTravel, Value: "false", Comment: "是否开启开往项目链接(火车图标)", IsPublic: true},
	{Key: constant.KeyHeaderNavClock, Value: "false", Comment: "导航栏和风天气开关", IsPublic: true},
	{Key: constant.KeyHeaderNavMenu, Value: `[{"title":"网页","items":[{"name":"个人主页","link":"https://index.anheyu.com/","icon":"https://upload-bbs.miyoushe.com/upload/2025/09/22/125766904/0a908742ef6ca443860071f8a338e26d_3396385191921661874.jpg?x-oss-process=image/format,avif"},{"name":"博客","link":"https://blog.anheyu.com/","icon":"https://upload-bbs.miyoushe.com/upload/2025/08/21/125766904/ff8efb94f09b751a46b331ca439e9e62_2548658293798175481.png?x-oss-process=image/format,avif"},{"name":"安知鱼图床","link":"https://image.anheyu.com/","icon":"https://upload-bbs.miyoushe.com/upload/2025/08/21/125766904/308b0ee69851998d44566a3420e6f9f2_2603983075304804470.png?x-oss-process=image/format,avif"}]},{"title":"项目","items":[{"name":"安和鱼框架","link":"https://dev.anheyu.com/","icon":"https://upload-bbs.miyoushe.com/upload/2025/08/21/125766904/6bc70317b1001fe739ffb6189d878bbc_5557049562284776022.png?x-oss-process=image/format,avif"}]}]`, Comment: "导航栏下拉菜单配置 (结构化JSON)", IsPublic: true},
	{Key: constant.KeyHomeTop, Value: `{"title":"生活明朗","subTitle":"万物可爱。","siteText":"ANHEYU.COM","category":[{"name":"前端","path":"/categories/前端开发/","background":"linear-gradient(to right,#358bff,#15c6ff)","icon":"fa6-solid:dove","isExternal":false},{"name":"大学","path":"/categories/大学生涯","background":"linear-gradient(to right,#f65,#ffbf37)","icon":"fa6-solid:fire","isExternal":false},{"name":"生活","path":"/categories/生活日常","background":"linear-gradient(to right,#18e7ae,#1eebeb)","icon":"fa6-solid:book","isExternal":false}],"banner":{"tips":"新品框架","title":"Theme-AnHeYu","image":"","link":"https://dev.anheyu.com/","isExternal":true}}`, Comment: "首页顶部UI配置 (JSON格式)", IsPublic: true},
	{Key: constant.KeyCreativity, Value: `{"title":"技能","subtitle":"开启创造力","creativity_list":[{"name":"Java","color":"#fff","icon":"https://upload-bbs.miyoushe.com/upload/2025/07/29/125766904/26ba17ce013ecde9afc8b373e2fc0b9d_1804318147854602575.jpg"},{"name":"Docker","color":"#57b6e6","icon":"https://upload-bbs.miyoushe.com/upload/2025/07/29/125766904/544b2d982fd5c4ede6630b29d86f3cae_7350393908531420887.png"},{"name":"Photoshop","color":"#4082c3","icon":"https://upload-bbs.miyoushe.com/upload/2025/07/29/125766904/4ce1d081b9b37b06e3714bee95e58589_1613929877388832041.png"},{"name":"Node","color":"#333","icon":"https://npm.elemecdn.com/anzhiyu-blog@2.1.1/img/svg/node-logo.svg"},{"name":"Webpack","color":"#2e3a41","icon":"https://upload-bbs.miyoushe.com/upload/2025/07/29/125766904/32dc115fbfd1340f919f0234725c6fb4_4060605986539473613.png"},{"name":"Pinia","color":"#fff","icon":"https://npm.elemecdn.com/anzhiyu-blog@2.0.8/img/svg/pinia-logo.svg"},{"name":"Python","color":"#fff","icon":"https://upload-bbs.miyoushe.com/upload/2025/07/29/125766904/02c9c621414cc2ca41035d809a4154be_7912546659792951301.png"},{"name":"Vite","color":"#937df7","icon":"https://npm.elemecdn.com/anzhiyu-blog@2.0.8/img/svg/vite-logo.svg"},{"name":"Flutter","color":"#4499e4","icon":"https://upload-bbs.miyoushe.com/upload/2025/07/29/125766904/b5aa93e0b61d8c9784cf76d14886ea46_4590392178423108088.png"},{"name":"Vue","color":"#b8f0ae","icon":"https://upload-bbs.miyoushe.com/upload/2025/07/29/125766904/cf23526f451784ff137f161b8fe18d5a_692393069314581413.png"},{"name":"React","color":"#222","icon":"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9Ii0xMS41IC0xMC4yMzE3NCAyMyAyMC40NjM0OCI+PHRpdGxlPlJlYWN0IExvZ288L3RpdGxlPjxjaXJjbGUgY3g9IjAiIGN5PSIwIiByPSIyLjA1IiBmaWxsPSIjNjFkYWZiIi8+PGcgc3Ryb2tlPSIjNjFkYWZiIiBzdHJva2Utd2lkdGg9IjEiIGZpbGw9Im5vbmUiPjxlbGxpcHNlIHJ4PSIxMSIgcnk9IjQuMiIvPjxlbGxpcHNlIHJ4PSIxMSIgcnk9IjQuMiIgdHJhbnNmb3JtPSJyb3RhdGUoNjApIi8+PGVsbGlwc2Ugcng9IjExIiByeT0iNC4yIiB0cmFuc2Zvcm09InJvdGF0ZSgxMjApIi8+PC9nPjwvc3ZnPg=="},{"name":"CSS3","color":"#2c51db","icon":"https://upload-bbs.miyoushe.com/upload/2025/08/02/125766904/948767d87de7c5733b5f59b036d28b4b_3573026798828830876.png"},{"name":"JS","color":"#f7cb4f","icon":"https://upload-bbs.miyoushe.com/upload/2025/07/29/125766904/06216e7fddb6704b57cb89be309443f9_7269407781142156006.png"},{"name":"HTML","color":"#e9572b","icon":"https://upload-bbs.miyoushe.com/upload/2025/08/02/125766904/f774c401c8bc2707e1df1323bdc9e423_1926035231499717029.png"},{"name":"Git","color":"#df5b40","icon":"https://upload-bbs.miyoushe.com/upload/2025/07/29/125766904/fcc0dbbfe206b4436097a8362d64b558_6981541002497327189.webp"},{"name":"Apifox","color":"#e65164","icon":"https://upload-bbs.miyoushe.com/upload/2025/08/02/125766904/b61bc7287d7f7f89bd30079c7f04360e_2465770520170903938.png"}]}`, Comment: "首页技能/创造力模块配置 (JSON格式)", IsPublic: true},

	// --- 页面一图流配置 ---
	{Key: constant.KeyPageOneImageConfig, Value: `{"home":{"enable":false,"background":"","mediaType":"image","mainTitle":"安和鱼","subTitle":"生活明朗，万物可爱","typingEffect":false,"hitokoto":false,"videoAutoplay":true,"videoLoop":true,"videoMuted":true,"mobileBackground":"","mobileMediaType":"image","mobileVideoAutoplay":true,"mobileVideoLoop":true,"mobileVideoMuted":true},"categories":{"enable":false,"background":"","mediaType":"image","mainTitle":"安和鱼","subTitle":"生活明朗，万物可爱","typingEffect":false,"hitokoto":false,"videoAutoplay":true,"videoLoop":true,"videoMuted":true,"mobileBackground":"","mobileMediaType":"image","mobileVideoAutoplay":true,"mobileVideoLoop":true,"mobileVideoMuted":true},"tags":{"enable":false,"background":"","mediaType":"image","mainTitle":"安和鱼","subTitle":"生活明朗，万物可爱","typingEffect":false,"hitokoto":false,"videoAutoplay":true,"videoLoop":true,"videoMuted":true,"mobileBackground":"","mobileMediaType":"image","mobileVideoAutoplay":true,"mobileVideoLoop":true,"mobileVideoMuted":true},"archives":{"enable":false,"background":"","mediaType":"image","mainTitle":"安和鱼","subTitle":"生活明朗，万物可爱","typingEffect":false,"hitokoto":false,"videoAutoplay":true,"videoLoop":true,"videoMuted":true,"mobileBackground":"","mobileMediaType":"image","mobileVideoAutoplay":true,"mobileVideoLoop":true,"mobileVideoMuted":true}}`, Comment: "页面一图流配置 (JSON格式) - mediaType可选值: image(图片)/video(视频)，支持为移动设备单独配置", IsPublic: true},
	{Key: constant.KeyHitokotoAPI, Value: "https://v1.hitokoto.cn/", Comment: "一言API地址", IsPublic: true},
	{Key: constant.KeyTypingSpeed, Value: "100", Comment: "打字机效果速度（毫秒/字符）", IsPublic: true},

	// --- FrontDesk 配置 ---
	{Key: constant.KeyFrontDeskSiteOwnerName, Value: "安知鱼", Comment: "前台网站拥有者名", IsPublic: true},
	{Key: constant.KeyFrontDeskSiteOwnerEmail, Value: "anzhiyu-c@qq.com", Comment: "前台网站拥有者邮箱", IsPublic: true},
	{Key: constant.KeyFooterOwnerName, Value: "安知鱼", Comment: "页脚版权所有者名", IsPublic: true},
	{Key: constant.KeyFooterOwnerSince, Value: "2020", Comment: "页脚版权起始年份", IsPublic: true},
	{Key: constant.KeyFooterCustomText, Value: "", Comment: "页脚自定义文本", IsPublic: true},
	{Key: constant.KeyFooterRuntimeEnable, Value: "false", Comment: "页脚网站运行时间模块是否启用", IsPublic: true},
	{Key: constant.KeyFooterRuntimeLaunchTime, Value: "04/01/2021 00:00:00", Comment: "网站上线时间", IsPublic: true},
	{Key: constant.KeyFooterRuntimeWorkImg, Value: "https://npm.elemecdn.com/anzhiyu-blog@2.0.4/img/badge/安知鱼-上班摸鱼中.svg", Comment: "上班状态图", IsPublic: true},
	{Key: constant.KeyFooterRuntimeWorkDesc, Value: "距离月入25k也就还差一个大佬带我~", Comment: "上班状态描述", IsPublic: true},
	{Key: constant.KeyFooterRuntimeOffDutyImg, Value: "https://npm.elemecdn.com/anzhiyu-blog@2.0.4/img/badge/安知鱼-下班啦.svg", Comment: "下班状态图", IsPublic: true},
	{Key: constant.KeyFooterRuntimeOffDutyDesc, Value: "下班了就该开开心心的玩耍，嘿嘿~", Comment: "下班状态描述", IsPublic: true},
	{Key: constant.KeyFooterSocialBarCenterImg, Value: "https://upload-bbs.miyoushe.com/upload/2025/07/26/125766904/3acc3fb80887f4df723ff6842fdfe063_8129797316116697018.gif", Comment: "社交链接栏中间图片", IsPublic: true},
	{Key: constant.KeyFooterListRandomFriends, Value: "3", Comment: "页脚列表随机友链数量", IsPublic: true},
	{Key: constant.KeyFooterBarAuthorLink, Value: "/about", Comment: "底部栏作者链接", IsPublic: true},
	{Key: constant.KeyFooterBarCCLink, Value: "/copyright", Comment: "底部栏CC协议链接", IsPublic: true},
	{Key: constant.KeyFooterBadgeEnable, Value: "false", Comment: "是否启用徽标列表", IsPublic: true},
	{Key: constant.KeyFooterBadgeList, Value: `[{"link":"https://blog.anheyu.com/","shields":"https://npm.elemecdn.com/anzhiyu-theme-static@1.0.9/img/Theme-AnZhiYu-2E67D3.svg","message":"本站使用AnHeYu框架"},{"link":"https://www.dogecloud.com/","shields":"https://npm.elemecdn.com/anzhiyu-blog@2.2.0/img/badge/CDN-多吉云-3693F3.svg","message":"本站使用多吉云为静态资源提供CDN加速"},{"link":"http://creativecommons.org/licenses/by-nc-sa/4.0/","shields":"https://npm.elemecdn.com/anzhiyu-blog@2.2.0/img/badge/Copyright-BY-NC-SA.svg","message":"本站采用知识共享署名-非商业性使用-相同方式共享4.0国际许可协议进行许可"}]`, Comment: "徽标列表 (JSON格式)", IsPublic: true},
	{Key: constant.KeyFooterSocialBarLeft, Value: `[{"title":"email","link":"http://mail.qq.com/cgi-bin/qm_share?t=qm_mailme&email=VDU6Ljw9LSF5NxQlJXo3Ozk","icon":"fa6-solid:envelope"},{"title":"微博","link":"https://weibo.com/u/6378063631","icon":"fa6-brands:weibo"},{"title":"facebook","link":"https://www.facebook.com/profile.php?id=100092208016287&sk=about","icon":"fa6-brands:facebook"},{"title":"RSS","link":"atom.xml","icon":"fa6-solid:rss"}]`, Comment: "社交链接栏左侧列表 (JSON格式)", IsPublic: true},
	{Key: constant.KeyFooterSocialBarRight, Value: `[{"title":"Github","link":"https://github.com/anzhiyu-c","icon":"fa6-brands:github"},{"title":"Bilibili","link":"https://space.bilibili.com/372204786","icon":"fa6-brands:bilibili"},{"title":"抖音","link":"https://v.douyin.com/DwCpMEy/","icon":"fa6-brands:tiktok"},{"title":"CC","link":"/copyright","icon":"fa6-regular:copyright"}]`, Comment: "社交链接栏右侧列表 (JSON格式)", IsPublic: true},
	{Key: constant.KeyFooterProjectList, Value: `[{"title":"服务","links":[{"title":"站点地图","link":"/sitemap.xml"},{"title":"十年之约","link":"https://foreverblog.cn/go.html"},{"title":"开往","link":"https://www.travellings.cn/go.html"}]},{"title":"框架","links":[{"title":"文档","link":"https://dev.anheyu.com"},{"title":"源码","link":"https://github.com/anzhiyu-c/anheyu-app"},{"title":"更新日志","link":"/update"}]},{"title":"导航","links":[{"title":"小空调","link":"/air-conditioner"},{"title":"相册集","link":"/album"},{"title":"音乐馆","link":"/music"}]},{"title":"协议","links":[{"title":"隐私协议","link":"/privacy"},{"title":"Cookies","link":"/cookies"},{"title":"版权协议","link":"/copyright"}]}]`, Comment: "页脚链接列表 (JSON格式)", IsPublic: true},
	{Key: constant.KeyFooterBarLinkList, Value: `[{"link":"/about#post-comment","text":"留言"},{"link":"https://github.com/anzhiyu-c/anheyu-app","text":"框架"},{"link":"https://index.anheyu.com","text":"主页"}]`, Comment: "底部栏链接列表 (JSON格式)", IsPublic: true},

	// --- Uptime Kuma 状态监控配置 ---
	{Key: constant.KeyFooterUptimeKumaEnable, Value: "false", Comment: "是否启用 Uptime Kuma 状态显示 (true/false)", IsPublic: true},
	{Key: constant.KeyFooterUptimeKumaPageURL, Value: "", Comment: "Uptime Kuma 状态页完整地址（例如：https://status.example.com/status/main）", IsPublic: true},

	{Key: constant.KeyIPAPI, Value: `https://v1.nsuuu.com/api/ipip`, Comment: "获取IP信息 API 地址（全球IPv4/IPv6信息查询）", IsPublic: false},
	{Key: constant.KeyIPAPIToKen, Value: ``, Comment: "获取IP信息 API Token", IsPublic: false},
	{Key: constant.KeyPostDefaultCover, Value: ``, Comment: "文章默认封面", IsPublic: true},
	{Key: constant.KeyPostDefaultDoubleColumn, Value: "true", Comment: "文章默认双栏", IsPublic: true},
	{Key: constant.KeyPostDefaultPageSize, Value: "12", Comment: "文章默认分页大小", IsPublic: true},
	{Key: constant.KeyPostDefaultEnablePrimaryColorTag, Value: "false", Comment: "文章列表封面启用主色调标签", IsPublic: true},
	{Key: constant.KeyPostExpirationTime, Value: "365", Comment: "文章过期时间(单位天)", IsPublic: true},
	{Key: constant.Key404PageDefaultImage, Value: "/static/img/background-effect.gif", Comment: "404页面默认图片", IsPublic: true},
	{Key: constant.KeyPostRewardEnable, Value: "true", Comment: "文章打赏功能是否启用", IsPublic: true},
	{Key: constant.KeyPostRewardWeChatQR, Value: "https://npm.elemecdn.com/anzhiyu-blog@1.1.6/img/post/common/qrcode-weichat.png", Comment: "微信打赏二维码图片URL", IsPublic: true},
	{Key: constant.KeyPostRewardAlipayQR, Value: "https://npm.elemecdn.com/anzhiyu-blog@1.1.6/img/post/common/qrcode-alipay.png", Comment: "支付宝打赏二维码图片URL", IsPublic: true},
	{Key: constant.KeyPostRewardWeChatEnable, Value: "true", Comment: "微信打赏是否启用", IsPublic: true},
	{Key: constant.KeyPostRewardAlipayEnable, Value: "true", Comment: "支付宝打赏是否启用", IsPublic: true},
	{Key: constant.KeyPostRewardButtonText, Value: "打赏作者", Comment: "打赏按钮文案", IsPublic: true},
	{Key: constant.KeyPostRewardTitle, Value: "感谢你赐予我前进的力量", Comment: "打赏弹窗标题文案", IsPublic: true},
	{Key: constant.KeyPostRewardWeChatLabel, Value: "微信", Comment: "微信标签文案", IsPublic: true},
	{Key: constant.KeyPostRewardAlipayLabel, Value: "支付宝", Comment: "支付宝标签文案", IsPublic: true},
	{Key: constant.KeyPostRewardListButtonText, Value: "打赏者名单", Comment: "打赏者名单按钮文案", IsPublic: true},
	{Key: constant.KeyPostRewardListButtonDesc, Value: "因为你们的支持让我意识到写文章的价值", Comment: "打赏者名单按钮描述文案", IsPublic: true},
	{Key: constant.KeyPostCodeBlockCodeMaxLines, Value: "10", Comment: "代码块最大行数（超过会折叠）", IsPublic: true},
	{Key: constant.KeyPostCodeBlockMacStyle, Value: "false", Comment: "是否启用Mac样式代码块 (true/false)，启用后显示红黄绿三个装饰圆点", IsPublic: true},

	// 文章复制版权配置
	{Key: constant.KeyPostCopyEnable, Value: "true", Comment: "是否允许复制文章内容 (true/false)，默认允许", IsPublic: true},
	{Key: constant.KeyPostCopyCopyrightEnable, Value: "false", Comment: "复制时是否携带版权信息 (true/false)，默认不携带", IsPublic: true},
	{Key: constant.KeyPostCopyCopyrightOriginal, Value: "本文来自 {siteName}，作者 {author}，转载请注明出处。\n原文地址：{url}", Comment: "原创文章版权信息模板，支持变量：{siteName}站点名称、{author}作者、{url}当前链接", IsPublic: true},
	{Key: constant.KeyPostCopyCopyrightReprint, Value: "本文转载自 {originalAuthor}，原文地址：{originalUrl}\n当前页面：{currentUrl}", Comment: "转载文章版权信息模板，支持变量：{originalAuthor}原作者、{originalUrl}原文链接、{currentUrl}当前链接", IsPublic: true},

	// 文章目录 Hash 更新配置
	{Key: constant.KeyPostTocHashUpdateMode, Value: "replace", Comment: "目录滚动是否更新URL Hash: replace(启用), none(禁用)", IsPublic: true},

	// 文章页面波浪区域配置
	{Key: constant.KeyPostWavesEnable, Value: "true", Comment: "是否显示文章页面波浪区域 (true/false)，默认显示", IsPublic: true},

	// 文章底部版权声明配置
	{Key: constant.KeyPostCopyrightOriginalTemplate, Value: "", Comment: "原创文章版权声明模板，支持变量：{license}许可协议、{licenseUrl}协议链接、{author}作者、{siteUrl}站点链接", IsPublic: true},
	{Key: constant.KeyPostCopyrightReprintTemplateWithUrl, Value: "", Comment: "转载文章版权声明模板（有原文链接），支持变量：{originalAuthor}原作者、{originalUrl}原文链接", IsPublic: true},
	{Key: constant.KeyPostCopyrightReprintTemplateWithoutUrl, Value: "", Comment: "转载文章版权声明模板（无原文链接），支持变量：{originalAuthor}原作者", IsPublic: true},

	// 版权区域按钮全局开关
	{Key: constant.KeyPostCopyrightShowRewardButton, Value: "true", Comment: "是否显示打赏按钮 (true/false)，全局控制所有文章底部是否显示打赏按钮", IsPublic: true},
	{Key: constant.KeyPostCopyrightShowShareButton, Value: "true", Comment: "是否显示分享按钮 (true/false)，全局控制所有文章底部是否显示分享按钮", IsPublic: true},
	{Key: constant.KeyPostCopyrightShowSubscribeButton, Value: "true", Comment: "是否显示订阅按钮 (true/false)，全局控制所有文章底部是否显示订阅按钮", IsPublic: true},

	// 文章订阅配置
	{Key: constant.KeyPostSubscribeEnable, Value: "false", Comment: "是否启用文章订阅功能 (true/false)", IsPublic: true},
	{Key: constant.KeyPostSubscribeButtonText, Value: "订阅", Comment: "订阅按钮文案", IsPublic: true},
	{Key: constant.KeyPostSubscribeDialogTitle, Value: "订阅博客更新", Comment: "订阅弹窗标题", IsPublic: true},
	{Key: constant.KeyPostSubscribeDialogDesc, Value: "输入您的邮箱，获取最新文章推送", Comment: "订阅弹窗描述", IsPublic: true},
	{Key: constant.KeyPostSubscribeMailSubject, Value: "【{{.SITE_NAME}}】新文章发布：{{.TITLE}}", Comment: "订阅邮件主题模板，支持变量：{{.SITE_NAME}}站点名称、{{.TITLE}}文章标题", IsPublic: false},
	{Key: constant.KeyPostSubscribeMailTemplate, Value: `<div style="max-width:600px;margin:0 auto;padding:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"><div style="text-align:center;padding:20px 0;border-bottom:1px solid #eee;"><h1 style="margin:0;color:#333;font-size:24px;">{{.SITE_NAME}}</h1></div><div style="padding:30px 0;"><h2 style="margin:0 0 20px;color:#333;font-size:20px;">📝 新文章发布</h2><div style="background:#f8f9fa;border-radius:8px;padding:20px;margin-bottom:20px;"><h3 style="margin:0 0 10px;color:#333;"><a href="{{.POST_URL}}" style="color:#1a73e8;text-decoration:none;">{{.TITLE}}</a></h3><p style="margin:0;color:#666;font-size:14px;line-height:1.6;">{{.SUMMARY}}</p></div><a href="{{.POST_URL}}" style="display:inline-block;background:#1a73e8;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:500;">阅读全文</a></div><div style="padding:20px 0;border-top:1px solid #eee;text-align:center;color:#999;font-size:12px;"><p style="margin:0 0 10px;">您收到此邮件是因为您订阅了 {{.SITE_NAME}} 的文章更新。</p><p style="margin:0;"><a href="{{.UNSUBSCRIBE_URL}}" style="color:#999;">取消订阅</a></p></div></div>`, Comment: "订阅邮件HTML模板，支持变量：{{.SITE_NAME}}站点名称、{{.TITLE}}文章标题、{{.SUMMARY}}文章摘要、{{.POST_URL}}文章链接、{{.UNSUBSCRIBE_URL}}退订链接", IsPublic: false},

	// --- 装备页面配置 ---
	{Key: constant.KeyPostEquipmentBannerBackground, Value: "https://upload-bbs.miyoushe.com/upload/2025/08/20/125766904/27160402b1840dbc85ccf9bec2665f0d_5042209802832493877.png", Comment: "装备页面横幅背景图", IsPublic: true},
	{Key: constant.KeyPostEquipmentBannerTitle, Value: "好物", Comment: "装备页面横幅标题", IsPublic: true},
	{Key: constant.KeyPostEquipmentBannerDescription, Value: "实物装备推荐", Comment: "装备页面横幅描述", IsPublic: true},
	{Key: constant.KeyPostEquipmentBannerTip, Value: "跟 安知鱼 一起享受科技带来的乐趣", Comment: "装备页面横幅提示", IsPublic: true},
	{Key: constant.KeyPostEquipmentList, Value: `[{"title":"生产力","description":"提升自己生产效率的硬件设备","equipment_list":[{"name":"MacBook Pro 2021 16 英寸","specification":"M1 Max 64G / 1TB","description":"屏幕显示效果好、色彩准确、对比度强、性能强劲、续航优秀。可以用来开发和设计。","image":"https://upload-bbs.miyoushe.com/upload/2025/08/20/125766904/b95852537e96a482957b8e5ff647ff4c_764505066454514675.png","link":"https://support.apple.com/zh-cn/111901"},{"name":"iPad 2020","specification":"深空灰 / 128G","description":"事事玩得转，买前生产力，买后爱奇艺。","image":"https://upload-bbs.miyoushe.com/upload/2025/08/20/125766904/bf9219494c6da12fdfd844987a369360_291371561164874211.png","link":"https://www.apple.com.cn/ipad-10.2/"},{"name":"iPhone 15 Pro Max","specification":"白色 / 512G","description":"钛金属，坚固轻盈，Pro 得真材实料，人生第一台这么贵的手机，心疼的一批，不过确实好用，续航，大屏都很爽，缺点就是信号信号差。","image":"https://upload-bbs.miyoushe.com/upload/2023/11/06/125766904/89059eb5043ced7a38ddbe7d9141927e_6382001755098640538..png","link":"https://www.apple.com.cn/iphone-15-pro/"},{"name":"iPhone 12 mini","specification":"绿色 / 128G","description":"超瓷晶面板，玻璃背板搭配铝金属边框，曲线优美的圆角设计，mini大小正好一只手就抓住，深得我心，唯一缺点大概就是续航不够。","image":"https://upload-bbs.miyoushe.com/upload/2025/08/20/125766904/ca85003734c7ae16e0885de6ddf70edf_5092364343528935349.png","link":"https://www.apple.com.cn/iphone-12/specs/"},{"name":"AirPods（第三代）","specification":"标准版","description":"第三代对比第二代提升很大，和我一样不喜欢入耳式耳机的可以入，空间音频等功能确实新颖，第一次使用有被惊艳到。","image":"https://upload-bbs.miyoushe.com/upload/2025/08/20/125766904/e95d49a35c4ada2e347e148db21bd8b2_6597868370689784858.png","link":"https://www.apple.com.cn/airpods-3rd-generation/"}]},{"title":"出行","description":"用来出行的实物及设备","equipment_list":[{"name":"Apple Watch Series 8","specification":"黑色","description":"始终为我的健康放哨，深夜弹出站立提醒，不过确实有效的提高了我的运动频率，配合apple全家桶还是非常棒的产品，缺点依然是续航。","image":"https://upload-bbs.miyoushe.com/upload/2025/08/20/125766904/3106e7079e4c2bacacc90d0511aa64a9_2946560183649110408.png","link":"https://www.apple.com.cn/apple-watch-series-8/"},{"name":"NATIONAL GEOGRAPHIC双肩包","specification":"黑色","description":"国家地理黑色大包，正好装下16寸 Macbook Pro，并且背起来很舒适，底部自带防雨罩也好用，各种奇怪的小口袋深得我心。","image":"https://upload-bbs.miyoushe.com/upload/2025/08/20/125766904/35c080f680dc41ce62915f9f3ffa425c_7289389531712378214.png","link":"https://item.jd.com/100011269828.html"},{"name":"NATIONAL GEOGRAPHIC学生书包🎒","specification":"红白色","description":"国家地理黑色大包，冰冰🧊同款，颜值在线且实用。","image":"https://upload-bbs.miyoushe.com/upload/2025/08/20/125766904/c56fc8e461a855f8fe1b040bec559f42_4252151225488526637.png","link":"https://item.jd.com/100005889786.html"}]}]`, Comment: "装备列表配置 (JSON格式)", IsPublic: true},

	{Key: constant.KeyRecentCommentsBannerBackground, Value: "https://upload-bbs.miyoushe.com/upload/2025/09/03/125766904/ef4aa528bb9eec3b4a288d1ca2190145_4127101134334568741.jpg?x-oss-process=image/format,avif", Comment: "最近评论页面横幅背景图", IsPublic: true},
	{Key: constant.KeyRecentCommentsBannerTitle, Value: "评论", Comment: "最近评论页面横幅标题", IsPublic: true},
	{Key: constant.KeyRecentCommentsBannerDescription, Value: "最近评论", Comment: "最近评论页面横幅描述", IsPublic: true},
	{Key: constant.KeyRecentCommentsBannerTip, Value: "发表你的观点和看法，让更多人看到", Comment: "最近评论页面横幅提示", IsPublic: true},
	{Key: constant.KeyCommentEnable, Value: "true", Comment: "是否启用评论功能", IsPublic: true},
	{Key: constant.KeyCommentBarrageEnable, Value: "true", Comment: "是否启用文章详情页评论弹幕（热评）", IsPublic: true},
	{Key: constant.KeyCommentLoginRequired, Value: "false", Comment: "是否开启登录后评论", IsPublic: true},
	{Key: constant.KeyCommentPageSize, Value: "10", Comment: "评论每页数量", IsPublic: true},
	{Key: constant.KeyCommentMasterTag, Value: "博主", Comment: "管理员评论专属标签文字", IsPublic: true},
	{Key: constant.KeyCommentPlaceholder, Value: "欢迎留下宝贵的建议啦～", Comment: "评论框占位文字", IsPublic: true},
	{Key: constant.KeyCommentEmojiCDN, Value: "https://npm.elemecdn.com/anzhiyu-theme-static@1.1.3/twikoo/twikoo.json", Comment: "评论表情 cdn链接", IsPublic: true},
	{Key: constant.KeyCommentBloggerEmail, Value: "me@anheyu.com", Comment: "博主邮箱，用于博主标识", IsPublic: true},
	{Key: constant.KeyCommentAnonymousEmail, Value: "", Comment: "收取匿名评论邮箱，为空时使用前台网站拥有者邮箱", IsPublic: true},
	{Key: constant.KeyCommentShowUA, Value: "true", Comment: "是否显示评论者操作系统和浏览器信息", IsPublic: true},
	{Key: constant.KeyCommentShowRegion, Value: "true", Comment: "是否显示评论者IP归属地", IsPublic: true},
	{Key: constant.KeyCommentAllowImageUpload, Value: "true", Comment: "是否允许在评论中上传图片", IsPublic: true},
	{Key: constant.KeyCommentLimitPerMinute, Value: "5", Comment: "单个IP每分钟允许提交的评论数", IsPublic: false},
	{Key: constant.KeyCommentLimitLength, Value: "10000", Comment: "单条评论最大字数", IsPublic: true},
	{Key: constant.KeyCommentForbiddenWords, Value: "习近平,空包,毛泽东,代发", Comment: "违禁词列表，逗号分隔，匹配到的评论将进入待审", IsPublic: false},
	{Key: constant.KeyCommentAIDetectEnable, Value: "false", Comment: "是否启用AI违禁词检测", IsPublic: false},
	{Key: constant.KeyCommentAIDetectAPIURL, Value: "https://v1.nsuuu.com/api/AiDetect", Comment: "AI违禁词检测API地址", IsPublic: false},
	{Key: constant.KeyCommentAIDetectAction, Value: "pending", Comment: "检测到违禁词时的处理方式: pending(待审), reject(拒绝)", IsPublic: false},
	{Key: constant.KeyCommentAIDetectRiskLevel, Value: "medium", Comment: "触发处理的最低风险等级: high(仅高风险), medium(中高风险), low(所有风险)", IsPublic: false},
	{Key: constant.KeyCommentQQAPIURL, Value: "https://v1.nsuuu.com/api/qqname", Comment: "QQ信息查询API地址", IsPublic: false},
	{Key: constant.KeyCommentQQAPIKey, Value: "", Comment: "QQ信息查询API密钥", IsPublic: false},
	{Key: constant.KeyCommentNotifyAdmin, Value: "false", Comment: "是否在收到评论时邮件通知博主", IsPublic: false},
	{Key: constant.KeyCommentNotifyReply, Value: "true", Comment: "是否开启评论回复邮件通知功能", IsPublic: false},
	{Key: constant.KeyPushooChannel, Value: "", Comment: "即时消息推送平台名称，支持：bark, webhook", IsPublic: false},
	{Key: constant.KeyPushooURL, Value: "", Comment: "即时消息推送URL地址 (支持模板变量)", IsPublic: false},
	{Key: constant.KeyWebhookRequestBody, Value: `{"title":"#{TITLE}","content":"#{BODY}","site_name":"#{SITE_NAME}","comment_author":"#{NICK}","comment_content":"#{COMMENT}","parent_author":"#{PARENT_NICK}","parent_content":"#{PARENT_COMMENT}","post_url":"#{POST_URL}","author_email":"#{MAIL}","author_ip":"#{IP}","time":"#{TIME}"}`, Comment: "Webhook自定义请求体模板，支持变量替换：#{TITLE}, #{BODY}, #{SITE_NAME}, #{NICK}, #{COMMENT}, #{PARENT_NICK}, #{PARENT_COMMENT}, #{POST_URL}, #{MAIL}, #{IP}, #{TIME}", IsPublic: false},
	{Key: constant.KeyWebhookHeaders, Value: "", Comment: "Webhook自定义请求头，每行一个，格式：Header-Name: Header-Value", IsPublic: false},
	{Key: constant.KeyScMailNotify, Value: "false", Comment: "是否同时通过IM和邮件2种方式通知博主 (默认仅IM)", IsPublic: false},
	{Key: constant.KeyCommentMailSubject, Value: "您在 [{{.SITE_NAME}}] 上的评论收到了新回复", Comment: "用户收到回复的邮件主题模板", IsPublic: false},
	{Key: constant.KeyCommentMailSubjectAdmin, Value: "您的博客 [{{.SITE_NAME}}] 上有新评论了", Comment: "博主收到新评论的邮件主题模板", IsPublic: false},
	{Key: constant.KeyCommentMailTemplate, Value: `<div class="flex-col page"><div class="flex-col box_3" style="display: flex;position: relative;width: 100%;height: 206px;background: #ef859d2e;top: 0;left: 0;justify-content: center;"><div class="flex-col section_1" style="background-image: url('{{.PARENT_IMG}}');position: absolute;width: 152px;height: 152px;display: flex;top: 130px;background-size: cover;border-radius: 50%;"></div></div><div class="flex-col box_4" style="margin-top: 92px;display: flex;flex-direction: column;align-items: center;"><div class="flex-col justify-between text-group_5" style="display: flex;flex-direction: column;align-items: center;margin: 0 20px;"><span class="text_1" style="font-size: 26px;font-family: PingFang-SC-Bold, PingFang-SC;font-weight: bold;color: #000000;line-height: 37px;text-align: center;">嘿！你在&nbsp;{{.SITE_NAME}}&nbsp;博客中收到一条新回复。</span><span class="text_2" style="font-size: 16px;font-family: PingFang-SC-Bold, PingFang-SC;font-weight: bold;color: #00000030;line-height: 22px;margin-top: 21px;text-align: center;">你之前的评论&nbsp;在&nbsp;{{.SITE_NAME}} 博客中收到来自&nbsp;{{.NICK}}&nbsp;的回复</span></div><div class="flex-row box_2" style="margin: 0 20px;min-height: 128px;background: #F7F7F7;border-radius: 12px;margin-top: 34px;display: flex;flex-direction: column;align-items: flex-start;padding: 32px 16px;width: calc(100% - 40px);"><div class="flex-col justify-between text-wrapper_4" style="display: flex;flex-direction: column;margin-left: 30px;margin-bottom: 16px;"><span class="text_3" style="height: 22px;font-size: 16px;font-family: PingFang-SC-Bold, PingFang-SC;font-weight: bold;color: #C5343E;line-height: 22px;">{{.PARENT_NICK}}</span><span class="text_4" style="margin-top: 6px;margin-right: 22px;font-size: 16px;font-family: PingFangSC-Regular, PingFang SC;font-weight: 400;color: #000000;line-height: 22px;">{{.PARENT_COMMENT}}</span></div><hr style="display: flex;position: relative;border: 1px dashed #ef859d2e;box-sizing: content-box;height: 0px;overflow: visible;width: 100%;"><div class="flex-col justify-between text-wrapper_4" style="display: flex;flex-direction: column;margin-left: 30px;"><hr><span class="text_3" style="height: 22px;font-size: 16px;font-family: PingFang-SC-Bold, PingFang-SC;font-weight: bold;color: #C5343E;line-height: 22px;">{{.NICK}}</span><span class="text_4" style="margin-top: 6px;margin-right: 22px;font-size: 16px;font-family: PingFangSC-Regular, PingFang SC;font-weight: 400;color: #000000;line-height: 22px;">{{.COMMENT}}</span></div><a class="flex-col text-wrapper_2" style="min-width: 106px;height: 38px;background: #ef859d38;border-radius: 32px;display: flex;align-items: center;justify-content: center;text-decoration: none;margin: auto;margin-top: 32px;" href="{{.POST_URL}}"><span class="text_5" style="color: #DB214B;">查看详情</span></a></div><div class="flex-col justify-between text-group_6" style="display: flex;flex-direction: column;align-items: center;margin-top: 34px;"><span class="text_6" style="height: 17px;font-size: 12px;font-family: PingFangSC-Regular, PingFang SC;font-weight: 400;color: #00000045;line-height: 17px;">此邮件由评论服务自动发出，直接回复无效。</span><a class="text_7" style="height: 17px;font-size: 12px;font-family: PingFangSC-Regular, PingFang SC;font-weight: 400;color: #DB214B;line-height: 17px;margin-top: 6px;text-decoration: none;" href="{{.SITE_URL}}">前往博客</a></div></div></div>`, Comment: "用户收到回复的邮件HTML模板", IsPublic: false},
	{Key: constant.KeyCommentMailTemplateAdmin, Value: `<div class="flex-col page"><div class="flex-col box_3" style="display: flex;position: relative;width: 100%;height: 206px;background: #ef859d2e;top: 0;left: 0;justify-content: center;"><div class="flex-col section_1" style="background-image: url('{{.IMG}}');position: absolute;width: 152px;height: 152px;display: flex;top: 130px;background-size: cover;border-radius: 50%;"></div></div><div class="flex-col box_4" style="margin-top: 92px;display: flex;flex-direction: column;align-items: center;"><div class="flex-col justify-between text-group_5" style="display: flex;flex-direction: column;align-items: center;margin: 0 20px;"><span class="text_1" style="font-size: 26px;font-family: PingFang-SC-Bold, PingFang-SC;font-weight: bold;color: #000000;line-height: 37px;text-align: center;">嘿！你的&nbsp;{{.SITE_NAME}}&nbsp;博客中收到一条新消息。</span></div><div class="flex-row box_2" style="margin: 0 20px;min-height: 128px;background: #F7F7F7;border-radius: 12px;margin-top: 34px;display: flex;flex-direction: column;align-items: flex-start;padding: 32px 16px;"><div class="flex-col justify-between text-wrapper_4" style="display: flex;flex-direction: column;margin-left: 30px;"><hr><span class="text_3" style="height: 22px;font-size: 16px;font-family: PingFang-SC-Bold, PingFang-SC;font-weight: bold;color: #C5343E;line-height: 22px;">{{.NICK}} ({{.MAIL}}, {{.IP}})</span><span class="text_4" style="margin-top: 6px;margin-right: 22px;font-size: 16px;font-family: PingFangSC-Regular, PingFang SC;font-weight: 400;color: #000000;line-height: 22px;">{{.COMMENT}}</span></div><a class="flex-col text-wrapper_2" style="min-width: 106px;height: 38px;background: #ef859d38;border-radius: 32px;display: flex;align-items: center;justify-content: center;text-decoration: none;margin: auto;margin-top: 32px;" href="{{.POST_URL}}"><span class="text_5" style="color: #DB214B;">查看详情</span></a></div><div class="flex-col justify-between text-group_6" style="display: flex;flex-direction: column;align-items: center;margin-top: 34px;"><span class="text_6" style="height: 17px;font-size: 12px;font-family: PingFangSC-Regular, PingFang SC;font-weight: 400;color: #00000045;line-height: 17px;">此邮件由评论服务自动发出，直接回复无效。</span><a class="text_7" style="height: 17px;font-size: 12px;font-family: PingFangSC-Regular, PingFang SC;font-weight: 400;color: #DB214B;line-height: 17px;margin-top: 6px;text-decoration: none;" href="{{.SITE_URL}}">前往博客</a></div></div></div>`, Comment: "博主收到新评论的邮件HTML模板", IsPublic: false},

	// 评论 SMTP 配置（独立于系统SMTP，用于评论通知）
	{Key: constant.KeyCommentSmtpSenderName, Value: "", Comment: "评论邮件发送人名称（留空使用系统SMTP配置）", IsPublic: false},
	{Key: constant.KeyCommentSmtpSenderEmail, Value: "", Comment: "评论邮件发送人邮箱地址（留空使用系统SMTP配置）", IsPublic: false},
	{Key: constant.KeyCommentSmtpHost, Value: "", Comment: "评论SMTP服务器地址（留空使用系统SMTP配置）", IsPublic: false},
	{Key: constant.KeyCommentSmtpPort, Value: "", Comment: "评论SMTP服务器端口（留空使用系统SMTP配置）", IsPublic: false},
	{Key: constant.KeyCommentSmtpUser, Value: "", Comment: "评论SMTP登录用户名（留空使用系统SMTP配置）", IsPublic: false},
	{Key: constant.KeyCommentSmtpPass, Value: "", Comment: "评论SMTP登录密码（留空使用系统SMTP配置）", IsPublic: false},
	{Key: constant.KeyCommentSmtpSecure, Value: "false", Comment: "评论SMTP是否强制使用SSL (true/false)", IsPublic: false},

	{Key: constant.KeySidebarAuthorEnable, Value: "true", Comment: "是否启用侧边栏作者卡片", IsPublic: true},
	{Key: constant.KeySidebarAuthorDescription, Value: `<div style="line-height:1.38;margin:0.6rem 0;text-align:justify;color:rgba(255, 255, 255, 0.8);">这有关于<b style="color:#fff">产品、设计、开发</b>相关的问题和看法，还有<b style="color:#fff">文章翻译</b>和<b style="color:#fff">分享</b>。</div><div style="line-height:1.38;margin:0.6rem 0;text-align:justify;color:rgba(255, 255, 255, 0.8);">相信你可以在这里找到对你有用的<b style="color:#fff">知识</b>和<b style="color:#fff">教程</b>。</div>`, Comment: "作者卡片描述 (HTML)", IsPublic: true},
	{Key: constant.KeySidebarAuthorStatusImg, Value: "https://upload-bbs.miyoushe.com/upload/2025/08/04/125766904/e3433dc6f4f78a9257060115e339f018_1105042150723011388.png?x-oss-process=image/format,avif", Comment: "作者卡片状态图片URL", IsPublic: true},
	{Key: constant.KeySidebarAuthorSkills, Value: `["🤖️ 数码科技爱好者","🔍 分享与热心帮助","🏠 智能家居小能手","🔨 设计开发一条龙","🤝 专修交互与设计","🏃 脚踏实地行动派","🧱 团队小组发动机","💢 壮汉人狠话不多"]`, Comment: "作者卡片技能列表 (JSON数组)", IsPublic: true},
	{Key: constant.KeySidebarAuthorSocial, Value: `{"Github":{"link":"https://github.com/anzhiyu-c","icon":"fa6-brands:github"},"BiliBili":{"link":"https://space.bilibili.com/372204786","icon":"fa6-brands:bilibili"}}`, Comment: "作者卡片社交链接 (JSON对象)", IsPublic: true},
	{Key: constant.KeySidebarWechatEnable, Value: "true", Comment: "是否启用侧边栏微信卡片", IsPublic: true},
	{Key: constant.KeySidebarWechatFace, Value: "https://upload-bbs.miyoushe.com/upload/2025/08/06/125766904/cf92d0f791458c288c7e308e9e8df1f5_5078983739960715024.png", Comment: "微信卡片正面图片URL", IsPublic: true},
	{Key: constant.KeySidebarWechatBackFace, Value: "https://upload-bbs.miyoushe.com/upload/2025/08/06/125766904/ed37b3b3c45bccaa11afa7c538e20b58_8343041924448947243.png?x-oss-process=image/format,avif", Comment: "微信卡片背面图片URL", IsPublic: true},
	{Key: constant.KeySidebarWechatBlurBackground, Value: "https://upload-bbs.miyoushe.com/upload/2025/08/06/125766904/92d74a9ef6ceb9465fec923e90dff04d_3079701216996731938.png", Comment: "微信卡片图片URL", IsPublic: true},
	{Key: constant.KeySidebarWechatLink, Value: "", Comment: "微信卡片点击链接URL（为空时不跳转）", IsPublic: true},
	{Key: constant.KeySidebarTagsEnable, Value: "true", Comment: "是否启用侧边栏标签卡片", IsPublic: true},
	{Key: constant.KeySidebarTagsHighlight, Value: "[]", Comment: "侧边栏高亮标签", IsPublic: true},
	{Key: constant.KeySidebarSiteInfoRuntimeEnable, Value: "true", Comment: "是否在侧边栏显示建站天数", IsPublic: true},
	{Key: constant.KeySidebarSiteInfoTotalPostCount, Value: "0", Comment: "侧边栏网站信息-文章总数 (此值由系统自动更新)", IsPublic: true},
	{Key: constant.KeySidebarSiteInfoTotalWordCount, Value: "0", Comment: "侧边栏网站信息-全站总字数 (此值由系统自动更新)", IsPublic: true},
	{Key: constant.KeySidebarArchiveCount, Value: "0", Comment: "侧边栏归档个数", IsPublic: true},
	{Key: constant.KeySidebarCustomShowInPost, Value: "false", Comment: "自定义侧边栏是否在文章页显示", IsPublic: true},
	{Key: constant.KeySidebarTocCollapseMode, Value: "false", Comment: "目录折叠模式 (true/false)，开启后目录会根据当前阅读位置自动折叠展开子标题", IsPublic: true},
	{Key: constant.KeySidebarSeriesPostCount, Value: "5", Comment: "侧边栏系列文章显示数量", IsPublic: true},
	{Key: constant.KeySidebarRecentPostEnable, Value: "true", Comment: "是否在文章详情页侧边栏显示最近发布文章 (true/false)", IsPublic: true},
	{Key: constant.KeySidebarRecentPostCount, Value: "5", Comment: "侧边栏最近文章显示数量", IsPublic: true},

	{Key: constant.KeyFriendLinkApplyCondition, Value: `["我已添加 <b>安知鱼</b> 博客的友情链接","我的链接主体为 <b>个人</b>，网站类型为<b>博客</b>","我的网站现在可以在中国大陆区域正常访问","网站内容符合中国大陆法律法规","我的网站可以在1分钟内加载完成首屏"]`, Comment: "申请友链条件 (JSON数组格式，用于动态生成勾选框)", IsPublic: true},
	{Key: constant.KeyFriendLinkApplyCustomCode, Value: `::: folding
友情链接页免责声明

## 免责声明

本博客遵守中华人民共和国相关法律。本页内容仅作为方便学习而产生的快速链接的链接方式，对与友情链接中存在的链接、好文推荐链接等均为其他网站。我本人能力有限无法逐个甄别每篇文章的每个字，并无法获知是否在收录后原作者是否对链接增加了违反法律甚至其他破坏用户计算机等行为。因为部分友链网站甚至没有做备案、域名并未做实名认证等，所以友链网站均可能存在风险，请你须知。

所以在我力所能及的情况下，我会包括但不限于：

- 针对收录的博客中的绝大多数内容通过标题来鉴别是否存在有风险的内容
- 在收录的友链好文推荐中检查是否存在风险内容

但是你在访问的时候，仍然无法避免，包括但不限于：

- 作者更换了超链接的指向，替换成了其他内容
- 作者的服务器被恶意攻击、劫持、被注入恶意内容
- 作者的域名到期，被不法分子用作他用
- 作者修改了文章内容，增加钓鱼网站、广告等无效信息
- 不完善的隐私保护对用户的隐私造成了侵害、泄漏

最新文章部分为机器抓取，本站作者未经过任何审核和筛选，本着友链信任原则添加的。如果你发现其中包含违反中华人民共和国法律的内容，请即使联系和举报。该友链会被拉黑。

如果因为从本页跳转给你造成了损失，深表歉意，并且建议用户如果发现存在问题在本页面进行回复。通常会很快处理。如果长时间无法得到处理，` + "`me@anheyu.com`" + `。

:::

## 友情链接申请

很高兴能和非常多的朋友们交流，如果你也想加入友链，可以在下方留言，我会在不忙的时候统一添加。**（从历史经验上看，90%的友链在3个工作日内被添加）**

::: folding open
✅ 友链相关须知

## 你提交的信息有可能被修改

1. 为了友链相关页面和组件的统一性和美观性，可能会对你的昵称进行缩短处理，例如昵称包含` + "`博客`" + `、` + "`XX的XX`" + `等内容或形式将被简化。
2. 为了图片加载速度和内容安全性考虑，头像实际展示图片均使用博客自己图床，所以无法收到贵站自己的头像更新，如果有迫切的更改信息需求，请在本页的评论中添加。

## 友情链接曝光
本站注重每一个友情链接的曝光，如果你在意本站给贵站提供的曝光资源，那么你可能在以下地方看到贵站。

1. 页脚每次刷新会随机展示3个友情链接（高曝光）
页脚「更多」链接跳转到友链页面
2. 导航栏「友链」分组中跳转到「友链鱼塘」查看所有3. 友链最新的文章（使用友链朋友圈项目）
3. 导航栏「友链」分组中跳转到「友情链接」查看所有友情链接
4. 导航栏「友链」分组中跳转到「宝藏博主」随机跳转到一个友情链接
5. [友情链接](/link)页面日UV平均在20左右。

## 关于推荐分类

推荐分类包含参与本站开发、提供设计灵感、捐助本站的优秀博主。


:::`, Comment: "申请友链自定义 Markdown 内容 (用于后台编辑)", IsPublic: true},
	{Key: constant.KeyFriendLinkApplyCustomCodeHtml, Value: `<details class="folding-tag">
  <summary> 友情链接页免责声明 </summary>
  <div class="content">
<h2 data-line="0" id="免责声明">免责声明</h2>
<p data-line="2">本博客遵守中华人民共和国相关法律。本页内容仅作为方便学习而产生的快速链接的链接方式，对与友情链接中存在的链接、好文推荐链接等均为其他网站。我本人能力有限无法逐个甄别每篇文章的每个字，并无法获知是否在收录后原作者是否对链接增加了违反法律甚至其他破坏用户计算机等行为。因为部分友链网站甚至没有做备案、域名并未做实名认证等，所以友链网站均可能存在风险，请你须知。</p>
<p data-line="4">所以在我力所能及的情况下，我会包括但不限于：</p>
<ul data-line="6">
<li data-line="6">针对收录的博客中的绝大多数内容通过标题来鉴别是否存在有风险的内容</li>
<li data-line="7">在收录的友链好文推荐中检查是否存在风险内容</li>
</ul>
<p data-line="9">但是你在访问的时候，仍然无法避免，包括但不限于：</p>
<ul data-line="11">
<li data-line="11">作者更换了超链接的指向，替换成了其他内容</li>
<li data-line="12">作者的服务器被恶意攻击、劫持、被注入恶意内容</li>
<li data-line="13">作者的域名到期，被不法分子用作他用</li>
<li data-line="14">作者修改了文章内容，增加钓鱼网站、广告等无效信息</li>
<li data-line="15">不完善的隐私保护对用户的隐私造成了侵害、泄漏</li>
</ul>
<p data-line="17">最新文章部分为机器抓取，本站作者未经过任何审核和筛选，本着友链信任原则添加的。如果你发现其中包含违反中华人民共和国法律的内容，请即使联系和举报。该友链会被拉黑。</p>
<p data-line="19">如果因为从本页跳转给你造成了损失，深表歉意，并且建议用户如果发现存在问题在本页面进行回复。通常会很快处理。如果长时间无法得到处理，<code>me@anheyu.com</code>。</p>

  </div>
</details><h2 data-line="26" id="友情链接申请">友情链接申请</h2>
<p data-line="28">很高兴能和非常多的朋友们交流，如果你也想加入友链，可以在下方留言，我会在不忙的时候统一添加。<strong>（从历史经验上看，90%的友链在3个工作日内被添加）</strong></p>
<details class="folding-tag" open="">
  <summary>友链相关须知 </summary>
  <div class="content">
<h2 data-line="0" id="你提交的信息有可能被修改">你提交的信息有可能被修改</h2>
<ol data-line="2">
<li data-line="2">为了友链相关页面和组件的统一性和美观性，可能会对你的昵称进行缩短处理，例如昵称包含<code>博客</code>、<code>XX的XX</code>等内容或形式将被简化。</li>
<li data-line="3">为了图片加载速度和内容安全性考虑，头像实际展示图片均使用博客自己图床，所以无法收到贵站自己的头像更新，如果有迫切的更改信息需求，请在本页的评论中添加。</li>
</ol>
<h2 data-line="5" id="友情链接曝光">友情链接曝光</h2>
<p data-line="6">本站注重每一个友情链接的曝光，如果你在意本站给贵站提供的曝光资源，那么你可能在以下地方看到贵站。</p>
<ol data-line="8">
<li data-line="8">页脚每次刷新会随机展示3个友情链接（高曝光）<br>
页脚「更多」链接跳转到友链页面</li>
<li data-line="10">导航栏「友链」分组中跳转到「友链鱼塘」查看所有3. 友链最新的文章（使用友链朋友圈项目）</li>
<li data-line="11">导航栏「友链」分组中跳转到「友情链接」查看所有友情链接</li>
<li data-line="12">导航栏「友链」分组中跳转到「宝藏博主」随机跳转到一个友情链接</li>
<li data-line="13"><a href="/link">友情链接</a>页面日UV平均在20左右。</li>
</ol>
<h2 data-line="15" id="关于推荐分类">关于推荐分类</h2>
<p data-line="17">推荐分类包含参与本站开发、提供设计灵感、捐助本站的优秀博主。</p>

  </div>
</details>`, Comment: "申请友链自定义 HTML 内容 (用于前台展示)", IsPublic: true},
	{Key: constant.KeyFriendLinkDefaultCategory, Value: "2", Comment: "友链默认分类", IsPublic: true},
	{Key: constant.KeyFriendLinkPlaceholderName, Value: "例如：安知鱼", Comment: "友链申请表单-网站名称输入框提示文字", IsPublic: true},
	{Key: constant.KeyFriendLinkPlaceholderURL, Value: "https://blog.anheyu.com/", Comment: "友链申请表单-网站链接输入框提示文字", IsPublic: true},
	{Key: constant.KeyFriendLinkPlaceholderLogo, Value: "https://npm.elemecdn.com/anzhiyu-blog-static@1.0.4/img/avatar.jpg", Comment: "友链申请表单-网站LOGO输入框提示文字", IsPublic: true},
	{Key: constant.KeyFriendLinkPlaceholderDescription, Value: "生活明朗，万物可爱", Comment: "友链申请表单-网站描述输入框提示文字", IsPublic: true},
	{Key: constant.KeyFriendLinkPlaceholderSiteshot, Value: "https://example.com/siteshot.png (可选)", Comment: "友链申请表单-网站快照输入框提示文字", IsPublic: true},
	{Key: constant.KeyFriendLinkNotifyAdmin, Value: "false", Comment: "是否在收到友链申请时通知站长", IsPublic: false},
	{Key: constant.KeyFriendLinkScMailNotify, Value: "false", Comment: "是否同时通过邮件和IM通知站长（友链申请）", IsPublic: false},
	{Key: constant.KeyFriendLinkPushooChannel, Value: "", Comment: "友链申请即时消息推送平台名称，支持：bark, webhook", IsPublic: false},
	{Key: constant.KeyFriendLinkPushooURL, Value: "", Comment: "友链申请即时消息推送URL地址 (支持模板变量)", IsPublic: false},
	{Key: constant.KeyFriendLinkWebhookRequestBody, Value: ``, Comment: "友链申请Webhook自定义请求体模板", IsPublic: false},
	{Key: constant.KeyFriendLinkWebhookHeaders, Value: "", Comment: "友链申请Webhook自定义请求头，每行一个，格式：Header-Name: Header-Value", IsPublic: false},
	{Key: constant.KeyFriendLinkMailSubjectAdmin, Value: "{{.SITE_NAME}} 收到了来自 {{.LINK_NAME}} 的友链申请", Comment: "站长收到新友链申请的邮件主题模板", IsPublic: false},
	{Key: constant.KeyFriendLinkMailTemplateAdmin, Value: `<p>您好！</p><p>您的网站 <strong>{{.SITE_NAME}}</strong> 收到了一个新的友链申请：</p><ul><li>网站名称：{{.LINK_NAME}}</li><li>网站地址：{{.LINK_URL}}</li><li>网站描述：{{.LINK_DESC}}</li><li>申请时间：{{.TIME}}</li></ul><p><a href="{{.ADMIN_URL}}">点击前往管理</a></p>`, Comment: "站长收到新友链申请的邮件HTML模板", IsPublic: false},
	// 友链审核邮件通知配置
	{Key: constant.KeyFriendLinkReviewMailEnable, Value: "false", Comment: "是否开启友链审核邮件通知功能 (true/false)", IsPublic: false},
	{Key: constant.KeyFriendLinkReviewMailSubjectApproved, Value: "【{{.SITE_NAME}}】友链申请已通过", Comment: "友链审核通过邮件主题模板", IsPublic: false},
	{Key: constant.KeyFriendLinkReviewMailTemplateApproved, Value: "", Comment: "友链审核通过邮件HTML模板（留空使用默认模板）", IsPublic: false},
	{Key: constant.KeyFriendLinkReviewMailSubjectRejected, Value: "【{{.SITE_NAME}}】友链申请未通过", Comment: "友链审核拒绝邮件主题模板", IsPublic: false},
	{Key: constant.KeyFriendLinkReviewMailTemplateRejected, Value: "", Comment: "友链审核拒绝邮件HTML模板（留空使用默认模板）", IsPublic: false},

	// --- 内部或敏感配置 ---
	{Key: constant.KeyJWTSecret, Value: "", Comment: "JWT密钥", IsPublic: false},
	{Key: constant.KeyLocalFileSigningSecret, Value: "", Comment: "本地文件签名密钥", IsPublic: false},
	{Key: constant.KeyResetPasswordSubject, Value: "【{{.AppName}}】重置您的账户密码", Comment: "重置密码邮件主题模板", IsPublic: false},
	{Key: constant.KeyResetPasswordTemplate, Value: `<!DOCTYPE html><html><head><title>重置密码</title></head><body><p>您好, {{.Nickname}}！</p><p>您正在请求重置您在 <strong>{{.AppName}}</strong> 的账户密码。</p><p>请点击以下链接以完成重置（此链接24小时内有效）：</p><p><a href="{{.ResetLink}}">重置我的密码</a></p><p>如果链接无法点击，请将其复制到浏览器地址栏中打开。</p><p>如果您没有请求重置密码，请忽略此邮件。</p><br/><p>感谢, <br/>{{.AppName}} 团队</p></body></html>`, Comment: "重置密码邮件HTML模板", IsPublic: false},
	{Key: constant.KeyActivateAccountSubject, Value: "【{{.AppName}}】激活您的账户", Comment: "用户激活邮件主题模板", IsPublic: false},
	{Key: constant.KeyActivateAccountTemplate, Value: `<!DOCTYPE html><html><head><title>激活您的账户</title></head><body><p>您好, {{.Nickname}}！</p><p>欢迎注册 <strong>{{.AppName}}</strong>！</p><p>请点击以下链接以激活您的账户（此链接24小时内有效）：</p><p><a href="{{.ActivateLink}}">激活我的账户</a></p><p>如果链接无法点击，请将其复制到浏览器地址栏中打开。</p><p>如果您并未注册，请忽略此邮件。</p><br/><p>感谢, <br/>{{.AppName}} 团队</p></body></html>`, Comment: "用户激活邮件HTML模板", IsPublic: false},
	{Key: constant.KeyEnableUserActivation, Value: "false", Comment: "是否开启新用户邮箱激活功能 (true/false)", IsPublic: false},
	{Key: constant.KeyEnableRegistration, Value: "true", Comment: "是否开启用户注册功能 (true/false)", IsPublic: true},
	{Key: constant.KeySmtpHost, Value: "smtp.qq.com", Comment: "SMTP 服务器地址", IsPublic: false},
	{Key: constant.KeySmtpPort, Value: "587", Comment: "SMTP 服务器端口 (587 for STARTTLS, 465 for SSL)", IsPublic: false},
	{Key: constant.KeySmtpUsername, Value: "user@example.com", Comment: "SMTP 登录用户名", IsPublic: false},
	{Key: constant.KeySmtpPassword, Value: "", Comment: "SMTP 登录密码", IsPublic: false},
	{Key: constant.KeySmtpSenderName, Value: "安和鱼", Comment: "邮件发送人名称", IsPublic: false},
	{Key: constant.KeySmtpSenderEmail, Value: "user@example.com", Comment: "邮件发送人邮箱地址", IsPublic: false},
	{Key: constant.KeySmtpReplyToEmail, Value: "", Comment: "回信邮箱地址", IsPublic: false},
	{Key: constant.KeySmtpForceSSL, Value: "false", Comment: "是否强制使用 SSL (设为true通常配合465端口)", IsPublic: false},

	// --- 关于页面配置 ---
	{Key: constant.KeyAboutPageName, Value: "安知鱼", Comment: "关于页面姓名", IsPublic: true},
	{Key: constant.KeyAboutPageDescription, Value: "是一名 前端工程师、学生、独立开发者、博主", Comment: "关于页面描述", IsPublic: true},
	{Key: constant.KeyAboutPageAvatarImg, Value: "https://npm.elemecdn.com/anzhiyu-blog-static@1.0.4/img/avatar.jpg", Comment: "关于页面头像图片URL", IsPublic: true},
	{Key: constant.KeyAboutPageSubtitle, Value: "生活明朗，万物可爱✨", Comment: "关于页面副标题", IsPublic: true},
	{Key: constant.KeyAboutPageAvatarSkillsLeft, Value: `["🤖️ 数码科技爱好者","🔍 分享与热心帮助","🏠 智能家居小能手","🔨 设计开发一条龙"]`, Comment: "头像左侧技能标签列表 (JSON数组)", IsPublic: true},
	{Key: constant.KeyAboutPageAvatarSkillsRight, Value: `["专修交互与设计 🤝","脚踏实地行动派 🏃","团队小组发动机 🧱","壮汉人狠话不多 💢"]`, Comment: "头像右侧技能标签列表 (JSON数组)", IsPublic: true},
	{Key: constant.KeyAboutPageAboutSiteTips, Value: `{"tips":"追求","title1":"源于","title2":"热爱而去 感受","word":["学习","生活","程序","体验"]}`, Comment: "关于网站提示配置 (JSON格式)", IsPublic: true},
	{Key: constant.KeyAboutPageStatisticsBackground, Value: "https://upload-bbs.miyoushe.com/upload/2025/08/20/125766904/0d61be5d781e63642743883eb5580024_4597572337700501322.png", Comment: "个人信息配置 (JSON格式)", IsPublic: true},
	{Key: constant.KeyAboutPageMap, Value: `{"title":"我现在住在","strengthenTitle":"中国，长沙市","background":"https://upload-bbs.miyoushe.com/upload/2025/08/21/125766904/29da8e2cd0e5f5e5bb50d2110ef71575_4355468272920245477.png","backgroundDark":"https://upload-bbs.miyoushe.com/upload/2025/08/21/125766904/d8d89f53ce2e7b368a0ac03092be3f78_3149317008469616077.png"}`, Comment: "地图信息配置 (JSON格式)", IsPublic: true},
	{Key: constant.KeyAboutPageSelfInfo, Value: `{"tips1":"生于","contentYear":"2002","tips2":"湖南信息学院","content2":"软件工程","tips3":"现在职业","content3":"软件工程师👨"}`, Comment: "个人信息配置 (JSON格式)", IsPublic: true},
	{Key: constant.KeyAboutPagePersonalities, Value: `{"tips":"性格","authorName":"执政官","personalityType":"ESFJ-A","personalityTypeColor":"#ac899c","personalityImg":"https://npm.elemecdn.com/anzhiyu-blog@2.0.8/img/svg/ESFJ-A.svg","nameUrl":"https://www.16personalities.com/ch/esfj-%E4%BA%BA%E6%A0%BC","photoUrl":"https://upload-bbs.miyoushe.com/upload/2025/08/21/125766904/c4aa8dcbeef6362c65e0266ab9dd5b19_7893582960672134962.png?x-oss-process=image/format,avif"}`, Comment: "性格信息配置 (JSON格式)", IsPublic: true},
	{Key: constant.KeyAboutPageMaxim, Value: `{"tips":"座右铭","top":"生活明朗，","bottom":"万物可爱。"}`, Comment: "格言配置 (JSON格式)", IsPublic: true},
	{Key: constant.KeyAboutPageBuff, Value: `{"tips":"特长","top":"脑回路新奇的 酸菜鱼","bottom":"二次元指数 MAX"}`, Comment: "增益配置 (JSON格式)", IsPublic: true},
	{Key: constant.KeyAboutPageGame, Value: `{"tips":"爱好游戏","title":"原神","uid":"UID: 125766904","background":"https://upload-bbs.miyoushe.com/upload/2025/08/21/125766904/df170ee157232de18d1a990e72333f65_3745939416973154749.png?x-oss-process=image/format,avif"}`, Comment: "游戏信息配置 (JSON格式)", IsPublic: true},
	{Key: constant.KeyAboutPageComic, Value: `{"tips":"爱好番剧","title":"追番","list":[{"name":"约定的梦幻岛","cover":"https://upload-bbs.miyoushe.com/upload/2025/08/21/125766904/40398029fd438c90395e3f6363be9210_3056370406171442679.png?x-oss-process=image/format,avif","href":"https://www.bilibili.com/bangumi/media/md5267750/?spm_id_from=666.25.b_6d656469615f6d6f64756c65.1"},{"name":"咒术回战","cover":"https://upload-bbs.miyoushe.com/upload/2025/08/21/125766904/9e8c4fd98c7d2c58ba9f58074f6b31d4_8434426529088986040.png?x-oss-process=image/format,avif","href":"https://www.bilibili.com/bangumi/media/md28229899/?spm_id_from=666.25.b_6d656469615f6d6f64756c65.1"},{"name":"紫罗兰永恒花园","cover":"https://upload-bbs.miyoushe.com/upload/2025/08/21/125766904/c654e3823523369aa9ac3f2d9ac14471_8582606285447891616.png?x-oss-process=image/format,avif","href":"https://www.bilibili.com/bangumi/media/md8892/?spm_id_from=666.25.b_6d656469615f6d6f64756c65.1"},{"name":"鬼灭之刃","cover":"https://upload-bbs.miyoushe.com/upload/2025/08/21/125766904/3ce8719fa9414801fb81654c7cee7549_4007505277882210341.png?x-oss-process=image/format,avif","href":"https://www.bilibili.com/bangumi/media/md22718131/?spm_id_from=666.25.b_6d656469615f6d6f64756c65.1"},{"name":"JOJO的奇妙冒险 黄金之风","cover":"https://upload-bbs.miyoushe.com/upload/2025/08/21/125766904/ea1fc16baccef3f3d04e1dced0a8eb39_6591444362443588368.png?x-oss-process=image/format,avif","href":"https://www.bilibili.com/bangumi/media/md135652/?spm_id_from=666.25.b_6d656469615f6d6f64756c65.1"}]}`, Comment: "漫画信息配置 (JSON格式)", IsPublic: true},
	{Key: constant.KeyAboutPageLike, Value: `{"tips":"关注偏好","title":"数码科技","bottom":"手机、电脑软硬件","background":"https://upload-bbs.miyoushe.com/upload/2025/08/21/125766904/b30e2d6a8cfaa36b8110b5034080adf6_5639323093964199346.png?x-oss-process=image/format,avif"}`, Comment: "喜欢的技术配置 (JSON格式)", IsPublic: true},
	{Key: constant.KeyAboutPageMusic, Value: `{"tips":"音乐偏好","title":"许嵩、民谣、华语流行","link":"/music","background":"https://p2.music.126.net/Mrg1i7DwcwjWBvQPIMt_Mg==/79164837213438.jpg"}`, Comment: "音乐配置 (JSON格式)", IsPublic: true},
	{Key: constant.KeyAboutPageCareers, Value: `{"tips":"生涯","title":"无限进步","img":"https://upload-bbs.miyoushe.com/upload/2025/08/21/125766904/a0c75864c723d53d3b9967e8c19a99c6_2075143858961311655.png?x-oss-process=image/format,avif","list":[{"desc":"EDU,软件工程专业","color":"#357ef5"}]}`, Comment: "职业经历配置 (JSON格式)", IsPublic: true},
	{Key: constant.KeyAboutPageSkillsTips, Value: `{"tips":"技能","title":"开启创造力"}`, Comment: "技能信息提示配置 (JSON格式)", IsPublic: true},
	{Key: constant.KeyAboutPageCustomCode, Value: ``, Comment: "关于页自定义 Markdown 内容（用于后台编辑）", IsPublic: true},
	{Key: constant.KeyAboutPageCustomCodeHtml, Value: ``, Comment: "关于页自定义 HTML 内容（用于前台展示）", IsPublic: true},

	// --- 关于页面板块开关配置 ---
	{Key: constant.KeyAboutPageEnableAuthorBox, Value: "true", Comment: "是否启用作者头像框板块 (true/false)", IsPublic: true},
	{Key: constant.KeyAboutPageEnablePageContent, Value: "true", Comment: "是否启用基础介绍内容板块 (true/false)", IsPublic: true},
	{Key: constant.KeyAboutPageEnableSkills, Value: "true", Comment: "是否启用技能卡片板块 (true/false)", IsPublic: true},
	{Key: constant.KeyAboutPageEnableCareers, Value: "true", Comment: "是否启用职业经历卡片板块 (true/false)", IsPublic: true},
	{Key: constant.KeyAboutPageEnableStatistic, Value: "true", Comment: "是否启用访问统计卡片板块 (true/false)", IsPublic: true},
	{Key: constant.KeyAboutPageEnableMapAndInfo, Value: "true", Comment: "是否启用地图和个人信息卡片板块 (true/false)", IsPublic: true},
	{Key: constant.KeyAboutPageEnablePersonality, Value: "true", Comment: "是否启用性格卡片板块 (true/false)", IsPublic: true},
	{Key: constant.KeyAboutPageEnablePhoto, Value: "true", Comment: "是否启用照片卡片板块 (true/false)", IsPublic: true},
	{Key: constant.KeyAboutPageEnableMaxim, Value: "true", Comment: "是否启用格言卡片板块 (true/false)", IsPublic: true},
	{Key: constant.KeyAboutPageEnableBuff, Value: "true", Comment: "是否启用特长卡片板块 (true/false)", IsPublic: true},
	{Key: constant.KeyAboutPageEnableGame, Value: "true", Comment: "是否启用游戏卡片板块 (true/false)", IsPublic: true},
	{Key: constant.KeyAboutPageEnableComic, Value: "true", Comment: "是否启用漫画/番剧卡片板块 (true/false)", IsPublic: true},
	{Key: constant.KeyAboutPageEnableLikeTech, Value: "true", Comment: "是否启用技术偏好卡片板块 (true/false)", IsPublic: true},
	{Key: constant.KeyAboutPageEnableMusic, Value: "true", Comment: "是否启用音乐卡片板块 (true/false)", IsPublic: true},
	{Key: constant.KeyAboutPageEnableCustomCode, Value: "true", Comment: "是否启用自定义内容块 (true/false)", IsPublic: true},
	{Key: constant.KeyAboutPageEnableComment, Value: "true", Comment: "是否启用评论板块 (true/false)", IsPublic: true},

	// --- 音乐播放器配置 ---
	{Key: constant.KeyMusicPlayerEnable, Value: "false", Comment: "是否启用音乐播放器功能 (true/false)", IsPublic: true},
	{Key: constant.KeyMusicPlayerPlaylistID, Value: "8152976493", Comment: "音乐播放器播放列表ID (网易云歌单ID)", IsPublic: true},
	{Key: constant.KeyMusicPlayerCustomPlaylist, Value: "", Comment: "自定义音乐歌单JSON文件链接（音乐馆页面使用）", IsPublic: true},
	{Key: constant.KeyMusicCapsuleCustomPlaylist, Value: "", Comment: "音乐胶囊自定义歌单JSON文件链接（胶囊播放器使用，独立于音乐馆配置）", IsPublic: true},
	{Key: constant.KeyMusicAPIBaseURL, Value: "https://metings.qjqq.cn", Comment: "音乐API基础地址（不带末尾斜杠）", IsPublic: true},
	{Key: constant.KeyMusicVinylBackground, Value: "/static/img/music-vinyl-background.png", Comment: "音乐播放器唱片背景图", IsPublic: true},
	{Key: constant.KeyMusicVinylOuter, Value: "/static/img/music-vinyl-outer.png", Comment: "音乐播放器唱片外圈图", IsPublic: true},
	{Key: constant.KeyMusicVinylInner, Value: "/static/img/music-vinyl-inner.png", Comment: "音乐播放器唱片内圈图", IsPublic: true},
	{Key: constant.KeyMusicVinylNeedle, Value: "/static/img/music-vinyl-needle.png", Comment: "音乐播放器撞针图", IsPublic: true},
	{Key: constant.KeyMusicVinylGroove, Value: "/static/img/music-vinyl-groove.png", Comment: "音乐播放器凹槽背景图", IsPublic: true},

	// --- CDN缓存清除配置 ---
	{Key: constant.KeyCDNEnable, Value: "false", Comment: "是否启用CDN缓存清除功能 (true/false)", IsPublic: false},
	{Key: constant.KeyCDNProvider, Value: "", Comment: "CDN提供商 (tencent/edgeone)", IsPublic: false},
	{Key: constant.KeyCDNSecretID, Value: "", Comment: "腾讯云API密钥ID", IsPublic: false},
	{Key: constant.KeyCDNSecretKey, Value: "", Comment: "腾讯云API密钥Key", IsPublic: false},
	{Key: constant.KeyCDNRegion, Value: "ap-beijing", Comment: "腾讯云地域 (如: ap-beijing, ap-shanghai)", IsPublic: false},
	{Key: constant.KeyCDNDomain, Value: "", Comment: "腾讯云CDN加速域名", IsPublic: false},
	{Key: constant.KeyCDNZoneID, Value: "", Comment: "EdgeOne站点ID", IsPublic: false},
	{Key: constant.KeyCDNBaseURL, Value: "", Comment: "CDNFLY网站URL", IsPublic: false},

	// --- 相册页面配置 ---
	{Key: constant.KeyAlbumPageBannerBackground, Value: "", Comment: "相册页面横幅背景图/视频URL", IsPublic: true},
	{Key: constant.KeyAlbumPageBannerTitle, Value: "相册", Comment: "相册页面横幅标题", IsPublic: true},
	{Key: constant.KeyAlbumPageBannerDescription, Value: "记录生活的美好瞬间", Comment: "相册页面横幅描述", IsPublic: true},
	{Key: constant.KeyAlbumPageBannerTip, Value: "分享精彩图片", Comment: "相册页面横幅提示文字", IsPublic: true},
	{Key: constant.KeyAlbumPageLayoutMode, Value: "waterfall", Comment: "相册布局模式 (grid/waterfall)", IsPublic: true},
	{Key: constant.KeyAlbumPageWaterfallColumnCount, Value: `{"large":4,"medium":3,"small":1}`, Comment: "瀑布流列数配置 (JSON格式)", IsPublic: true},
	{Key: constant.KeyAlbumPageWaterfallGap, Value: "16", Comment: "瀑布流间距 (像素)", IsPublic: true},
	{Key: constant.KeyAlbumPageSize, Value: "24", Comment: "相册每页显示数量", IsPublic: true},
	{Key: constant.KeyAlbumPageEnableComment, Value: "false", Comment: "是否启用相册页评论 (true/false)", IsPublic: true},
	{Key: constant.KeyAlbumPageApiURL, Value: "", Comment: "相册API地址", IsPublic: true},
	{Key: constant.KeyAlbumPageDefaultThumbParam, Value: "", Comment: "相册缩略图处理参数", IsPublic: true},
	{Key: constant.KeyAlbumPageDefaultBigParam, Value: "", Comment: "相册大图处理参数", IsPublic: true},
	{Key: constant.KeyAlbumPageAboutLink, Value: "", Comment: "相册页面关于按钮链接，留空则使用全局关于链接", IsPublic: true},

	// --- 人机验证配置 ---
	{Key: constant.KeyCaptchaProvider, Value: "none", Comment: "人机验证方式: none(不启用) / turnstile(Cloudflare Turnstile) / geetest(极验4.0) / image(系统图形验证码)", IsPublic: true},

	// --- 微信分享配置 ---
	{Key: constant.KeyWechatShareEnable, Value: "false", Comment: "是否启用微信分享功能 (true/false)", IsPublic: true},
	{Key: constant.KeyWechatShareAppID, Value: "", Comment: "微信公众号 AppID", IsPublic: true},
	{Key: constant.KeyWechatShareAppSecret, Value: "", Comment: "微信公众号 AppSecret（用于生成 JS-SDK 签名）", IsPublic: false},

	// --- Cloudflare Turnstile 人机验证配置 ---
	{Key: constant.KeyTurnstileEnable, Value: "false", Comment: "是否启用 Cloudflare Turnstile 人机验证 (true/false)，已废弃，请使用 captcha.provider", IsPublic: true},
	{Key: constant.KeyTurnstileSiteKey, Value: "", Comment: "Turnstile Site Key（公钥，前端使用，从 Cloudflare 控制台获取）", IsPublic: true},
	{Key: constant.KeyTurnstileSecretKey, Value: "", Comment: "Turnstile Secret Key（私钥，后端验证使用，从 Cloudflare 控制台获取）", IsPublic: false},

	// --- 极验 GeeTest 4.0 人机验证配置 ---
	{Key: constant.KeyGeetestCaptchaId, Value: "", Comment: "极验验证 ID（公钥，前端使用，从极验后台获取）", IsPublic: true},
	{Key: constant.KeyGeetestCaptchaKey, Value: "", Comment: "极验验证 Key（私钥，后端验证使用，从极验后台获取）", IsPublic: false},

	// --- 系统图形验证码配置 ---
	{Key: constant.KeyImageCaptchaLength, Value: "4", Comment: "图形验证码字符长度 (默认4位)", IsPublic: true},
	{Key: constant.KeyImageCaptchaExpire, Value: "300", Comment: "图形验证码过期时间（秒，默认300秒/5分钟）", IsPublic: true},

	// --- 顶栏用户面板配置 ---
	{Key: constant.KeyUserPanelShowUserCenter, Value: "true", Comment: "是否显示用户中心按钮 (true/false)", IsPublic: true},
	{Key: constant.KeyUserPanelShowNotifications, Value: "true", Comment: "是否显示通知中心按钮 (true/false)", IsPublic: true},
	{Key: constant.KeyUserPanelShowPublishArticle, Value: "true", Comment: "是否显示发布文章按钮 (true/false)", IsPublic: true},
	{Key: constant.KeyUserPanelShowAdminDashboard, Value: "true", Comment: "是否显示进入后台按钮 (true/false)", IsPublic: true},
}

// AllUserGroups 是所有默认用户组的"单一事实来源"
var AllUserGroups = []UserGroupDefinition{
	{
		ID:          1,
		Name:        "管理员",
		Description: "拥有所有权限的系统管理员",
		Permissions: model.NewBoolset(model.PermissionAdmin, model.PermissionCreateShare, model.PermissionAccessShare, model.PermissionUploadFile, model.PermissionDeleteFile),
		MaxStorage:  0, // 0 代表无限容量
		SpeedLimit:  0,
		Settings:    model.GroupSettings{SourceBatch: 100, PolicyOrdering: []uint{1}, RedirectedSource: true},
	},
	{
		ID:          2,
		Name:        "普通用户",
		Description: "标准用户组，拥有基本上传和分享权限",
		Permissions: model.NewBoolset(model.PermissionCreateShare, model.PermissionAccessShare, model.PermissionUploadFile),
		MaxStorage:  5 * 1024 * 1024 * 1024, // 默认 5 GB
		SpeedLimit:  0,
		Settings:    model.GroupSettings{SourceBatch: 10, PolicyOrdering: []uint{1}, RedirectedSource: true},
	},
	{
		ID:          3,
		Name:        "匿名用户组",
		Description: "未登录用户或游客，仅能访问公开的分享",
		Permissions: model.NewBoolset(model.PermissionAccessShare),
		MaxStorage:  0,
		SpeedLimit:  0,
		Settings:    model.GroupSettings{SourceBatch: 0, PolicyOrdering: []uint{}, RedirectedSource: false},
	},
}
