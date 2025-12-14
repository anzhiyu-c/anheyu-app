// anheyu-app/pkg/service/article/import_export_service.go
package article

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"strings"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

// ExportArticleData 定义导出的文章数据结构
type ExportArticleData struct {
	Version  string                 `json:"version"`   // 导出格式版本
	ExportAt time.Time              `json:"export_at"` // 导出时间
	Articles []ExportArticleItem    `json:"articles"`  // 文章列表
	Meta     map[string]interface{} `json:"meta"`      // 元数据信息
}

// ExportArticleItem 单个文章的导出数据
type ExportArticleItem struct {
	// 基础信息
	Title       string    `json:"title"`
	ContentMd   string    `json:"content_md"`
	ContentHTML string    `json:"content_html"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`

	// 封面和图片
	CoverURL  string `json:"cover_url,omitempty"`
	TopImgURL string `json:"top_img_url,omitempty"`

	// 分类和标签
	Categories []string `json:"categories,omitempty"` // 分类名称列表
	Tags       []string `json:"tags,omitempty"`       // 标签名称列表

	// 摘要和元数据
	Summaries []string `json:"summaries,omitempty"`
	Keywords  string   `json:"keywords,omitempty"`

	// 排序和显示
	HomeSort int `json:"home_sort"`
	PinSort  int `json:"pin_sort"`

	// 版权信息
	Copyright           bool   `json:"copyright"`
	CopyrightAuthor     string `json:"copyright_author,omitempty"`
	CopyrightAuthorHref string `json:"copyright_author_href,omitempty"`
	CopyrightURL        string `json:"copyright_url,omitempty"`

	// 主题色
	PrimaryColor         string `json:"primary_color,omitempty"`
	IsPrimaryColorManual bool   `json:"is_primary_color_manual"`

	// 统计信息（仅供参考）
	ViewCount   int `json:"view_count"`
	WordCount   int `json:"word_count"`
	ReadingTime int `json:"reading_time"`

	// 其他
	IPLocation string `json:"ip_location,omitempty"`
	Abbrlink   string `json:"abbrlink,omitempty"`
}

// ImportArticleRequest 导入文章的请求
type ImportArticleRequest struct {
	Data              ExportArticleData `json:"data"`               // 导入的数据
	OverwriteExisting bool              `json:"overwrite_existing"` // 是否覆盖已存在的文章
	CreateCategories  bool              `json:"create_categories"`  // 是否自动创建不存在的分类
	CreateTags        bool              `json:"create_tags"`        // 是否自动创建不存在的标签
	OwnerID           uint              `json:"owner_id"`           // 导入文章的所有者ID
	DefaultStatus     string            `json:"default_status"`     // 默认状态（如果数据中没有指定）
	SkipExisting      bool              `json:"skip_existing"`      // 是否跳过已存在的文章
}

// ImportResult 导入结果
type ImportResult struct {
	TotalCount   int      `json:"total_count"`   // 总数
	SuccessCount int      `json:"success_count"` // 成功数
	SkippedCount int      `json:"skipped_count"` // 跳过数
	FailedCount  int      `json:"failed_count"`  // 失败数
	Errors       []string `json:"errors"`        // 错误信息列表
	CreatedIDs   []string `json:"created_ids"`   // 创建的文章ID列表
}

// ExportArticles 导出文章为 JSON 格式
func (s *serviceImpl) ExportArticles(ctx context.Context, articleIDs []string) (*ExportArticleData, error) {
	log.Printf("[导出文章] 开始导出 %d 篇文章", len(articleIDs))

	exportData := &ExportArticleData{
		Version:  "1.0",
		ExportAt: time.Now(),
		Articles: make([]ExportArticleItem, 0, len(articleIDs)),
		Meta: map[string]interface{}{
			"total_articles": len(articleIDs),
			"export_by":      "anheyu-app",
		},
	}

	for _, articleID := range articleIDs {
		// 获取文章详情（使用 ForPreview 方法，不过滤文章状态，以支持导出草稿文章）
		article, err := s.repo.GetBySlugOrIDForPreview(ctx, articleID)
		if err != nil {
			log.Printf("[导出文章] 获取文章 %s 失败: %v", articleID, err)
			continue
		}

		// 提取分类名称
		categories := make([]string, 0, len(article.PostCategories))
		for _, cat := range article.PostCategories {
			categories = append(categories, cat.Name)
		}

		// 提取标签名称
		tags := make([]string, 0, len(article.PostTags))
		for _, tag := range article.PostTags {
			tags = append(tags, tag.Name)
		}

		// 构建导出项
		exportItem := ExportArticleItem{
			Title:                article.Title,
			ContentMd:            article.ContentMd,
			ContentHTML:          article.ContentHTML,
			Status:               article.Status,
			CreatedAt:            article.CreatedAt,
			UpdatedAt:            article.UpdatedAt,
			CoverURL:             article.CoverURL,
			TopImgURL:            article.TopImgURL,
			Categories:           categories,
			Tags:                 tags,
			Summaries:            article.Summaries,
			Keywords:             article.Keywords,
			HomeSort:             article.HomeSort,
			PinSort:              article.PinSort,
			Copyright:            article.Copyright,
			CopyrightAuthor:      article.CopyrightAuthor,
			CopyrightAuthorHref:  article.CopyrightAuthorHref,
			CopyrightURL:         article.CopyrightURL,
			PrimaryColor:         article.PrimaryColor,
			IsPrimaryColorManual: article.IsPrimaryColorManual,
			ViewCount:            article.ViewCount,
			WordCount:            article.WordCount,
			ReadingTime:          article.ReadingTime,
			IPLocation:           article.IPLocation,
			Abbrlink:             article.Abbrlink,
		}

		exportData.Articles = append(exportData.Articles, exportItem)
	}

	log.Printf("[导出文章] 成功导出 %d 篇文章", len(exportData.Articles))
	return exportData, nil
}

// ExportArticlesToZip 导出文章为 ZIP 压缩包
func (s *serviceImpl) ExportArticlesToZip(ctx context.Context, articleIDs []string) ([]byte, error) {
	// 先导出为 JSON
	exportData, err := s.ExportArticles(ctx, articleIDs)
	if err != nil {
		return nil, err
	}

	// 创建 ZIP buffer
	buf := new(bytes.Buffer)
	zipWriter := zip.NewWriter(buf)

	// 添加 JSON 数据文件
	jsonData, err := json.MarshalIndent(exportData, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("序列化 JSON 失败: %w", err)
	}

	jsonFile, err := zipWriter.Create("articles.json")
	if err != nil {
		return nil, fmt.Errorf("创建 ZIP 文件失败: %w", err)
	}
	if _, err := jsonFile.Write(jsonData); err != nil {
		return nil, fmt.Errorf("写入 JSON 数据失败: %w", err)
	}

	// 为每篇文章创建独立的 Markdown 文件
	for i, article := range exportData.Articles {
		// 生成文件名（使用标题，移除特殊字符）
		filename := sanitizeFilename(article.Title)
		if filename == "" {
			filename = fmt.Sprintf("article_%d", i+1)
		}
		filename = fmt.Sprintf("markdown/%s.md", filename)

		// 创建 Markdown 文件
		mdFile, err := zipWriter.Create(filename)
		if err != nil {
			log.Printf("[导出文章] 创建 Markdown 文件失败: %v", err)
			continue
		}

		// 写入 Markdown 内容（包含元数据）
		mdContent := buildMarkdownWithFrontmatter(article)
		if _, err := mdFile.Write([]byte(mdContent)); err != nil {
			log.Printf("[导出文章] 写入 Markdown 内容失败: %v", err)
		}
	}

	// 添加 README 文件
	readme, err := zipWriter.Create("README.md")
	if err == nil {
		readmeContent := fmt.Sprintf(`# 文章导出包

- 导出时间: %s
- 导出版本: %s
- 文章总数: %d

## 文件说明

- articles.json: 包含所有文章的完整数据（JSON格式）
- markdown/: 包含每篇文章的 Markdown 文件

## 导入说明

使用本系统的导入功能，选择 articles.json 文件即可导入所有文章。
`,
			exportData.ExportAt.Format("2006-01-02 15:04:05"),
			exportData.Version,
			len(exportData.Articles),
		)
		readme.Write([]byte(readmeContent))
	}

	// 关闭 ZIP writer
	if err := zipWriter.Close(); err != nil {
		return nil, fmt.Errorf("关闭 ZIP 文件失败: %w", err)
	}

	return buf.Bytes(), nil
}

// ImportArticles 从导出的数据导入文章
func (s *serviceImpl) ImportArticles(ctx context.Context, req *ImportArticleRequest) (*ImportResult, error) {
	log.Printf("[导入文章] 开始导入 %d 篇文章", len(req.Data.Articles))

	result := &ImportResult{
		TotalCount: len(req.Data.Articles),
		Errors:     make([]string, 0),
		CreatedIDs: make([]string, 0),
	}

	// 创建分类和标签的映射（名称 -> ID）
	categoryMap := make(map[string]string) // 分类名 -> 公共ID
	tagMap := make(map[string]string)      // 标签名 -> 公共ID

	for idx, articleData := range req.Data.Articles {
		log.Printf("[导入文章] 处理第 %d/%d 篇文章: %s", idx+1, result.TotalCount, articleData.Title)

		// 检查是否已存在（通过标题或 abbrlink）
		if req.SkipExisting && articleData.Abbrlink != "" {
			existing, err := s.repo.GetBySlugOrID(ctx, articleData.Abbrlink)
			if err == nil && existing != nil {
				log.Printf("[导入文章] 跳过已存在的文章: %s (abbrlink: %s)", articleData.Title, articleData.Abbrlink)
				result.SkippedCount++
				continue
			}
		}

		// 处理分类
		categoryIDs := make([]string, 0)
		for _, catName := range articleData.Categories {
			if catName == "" {
				continue
			}

			// 检查是否已在映射中
			if catID, ok := categoryMap[catName]; ok {
				categoryIDs = append(categoryIDs, catID)
				continue
			}

			// 查找或创建分类
			// 先尝试查找现有分类
			categories, err := s.postCategoryRepo.List(ctx)
			if err != nil {
				log.Printf("[导入文章] 查询分类失败 %s: %v", catName, err)
				continue
			}
			var category *model.PostCategory
			for _, cat := range categories {
				if cat.Name == catName {
					category = cat
					break
				}
			}

			if category == nil {
				if req.CreateCategories {
					// 创建新分类
					createReq := &model.CreatePostCategoryRequest{
						Name:        catName,
						Description: "",
					}
					category, err = s.postCategoryRepo.Create(ctx, createReq)
					if err != nil {
						log.Printf("[导入文章] 创建分类失败 %s: %v", catName, err)
						continue
					}
					log.Printf("[导入文章] 创建新分类: %s (ID: %s)", catName, category.ID)
				} else {
					log.Printf("[导入文章] 分类不存在且未启用自动创建: %s", catName)
					continue
				}
			}

			categoryMap[catName] = category.ID
			categoryIDs = append(categoryIDs, category.ID)
		}

		// 处理标签
		tagIDs := make([]string, 0)
		for _, tagName := range articleData.Tags {
			if tagName == "" {
				continue
			}

			// 检查是否已在映射中
			if tagID, ok := tagMap[tagName]; ok {
				tagIDs = append(tagIDs, tagID)
				continue
			}

			// 查找或创建标签
			// 先尝试查找现有标签
			tags, err := s.postTagRepo.List(ctx, &model.ListPostTagsOptions{})
			if err != nil {
				log.Printf("[导入文章] 查询标签失败 %s: %v", tagName, err)
				continue
			}
			var tag *model.PostTag
			for _, t := range tags {
				if t.Name == tagName {
					tag = t
					break
				}
			}

			if tag == nil {
				if req.CreateTags {
					// 创建新标签
					createReq := &model.CreatePostTagRequest{
						Name: tagName,
					}
					tag, err = s.postTagRepo.Create(ctx, createReq)
					if err != nil {
						log.Printf("[导入文章] 创建标签失败 %s: %v", tagName, err)
						continue
					}
					log.Printf("[导入文章] 创建新标签: %s (ID: %s)", tagName, tag.ID)
				} else {
					log.Printf("[导入文章] 标签不存在且未启用自动创建: %s", tagName)
					continue
				}
			}

			tagMap[tagName] = tag.ID
			tagIDs = append(tagIDs, tag.ID)
		}

		// 确定文章状态
		status := articleData.Status
		if status == "" && req.DefaultStatus != "" {
			status = req.DefaultStatus
		}
		if status == "" {
			status = "DRAFT" // 默认为草稿
		}

		// 创建文章请求
		createReq := &model.CreateArticleRequest{
			Title:                articleData.Title,
			ContentMd:            articleData.ContentMd,
			ContentHTML:          articleData.ContentHTML,
			Status:               status,
			PostCategoryIDs:      categoryIDs,
			PostTagIDs:           tagIDs,
			CoverURL:             articleData.CoverURL,
			Summaries:            articleData.Summaries,
			IPLocation:           articleData.IPLocation,
			HomeSort:             articleData.HomeSort,
			PinSort:              articleData.PinSort,
			TopImgURL:            articleData.TopImgURL,
			Copyright:            &articleData.Copyright,
			CopyrightAuthor:      articleData.CopyrightAuthor,
			CopyrightAuthorHref:  articleData.CopyrightAuthorHref,
			CopyrightURL:         articleData.CopyrightURL,
			IsPrimaryColorManual: &articleData.IsPrimaryColorManual,
			PrimaryColor:         articleData.PrimaryColor,
			Abbrlink:             articleData.Abbrlink,
			Keywords:             articleData.Keywords,
		}

		// 如果导入数据包含自定义时间，使用它们
		if !articleData.CreatedAt.IsZero() {
			createdAtStr := articleData.CreatedAt.Format(time.RFC3339)
			createReq.CustomPublishedAt = &createdAtStr
		}
		if !articleData.UpdatedAt.IsZero() {
			updatedAtStr := articleData.UpdatedAt.Format(time.RFC3339)
			createReq.CustomUpdatedAt = &updatedAtStr
		}

		// 调用创建方法
		createdArticle, err := s.Create(ctx, createReq, "")
		if err != nil {
			errMsg := fmt.Sprintf("导入文章 '%s' 失败: %v", articleData.Title, err)
			log.Printf("[导入文章] %s", errMsg)
			result.Errors = append(result.Errors, errMsg)
			result.FailedCount++
			continue
		}

		log.Printf("[导入文章] 成功导入文章: %s (ID: %s)", articleData.Title, createdArticle.ID)
		result.CreatedIDs = append(result.CreatedIDs, createdArticle.ID)
		result.SuccessCount++
	}

	log.Printf("[导入文章] 导入完成 - 总数: %d, 成功: %d, 跳过: %d, 失败: %d",
		result.TotalCount, result.SuccessCount, result.SkippedCount, result.FailedCount)

	return result, nil
}

// ImportArticlesFromJSON 从 JSON 数据导入文章
func (s *serviceImpl) ImportArticlesFromJSON(ctx context.Context, jsonData []byte, req *ImportArticleRequest) (*ImportResult, error) {
	var exportData ExportArticleData
	if err := json.Unmarshal(jsonData, &exportData); err != nil {
		return nil, fmt.Errorf("解析 JSON 数据失败: %w", err)
	}

	req.Data = exportData
	return s.ImportArticles(ctx, req)
}

// ImportArticlesFromZip 从 ZIP 压缩包导入文章
func (s *serviceImpl) ImportArticlesFromZip(ctx context.Context, zipData []byte, req *ImportArticleRequest) (*ImportResult, error) {
	// 读取 ZIP 内容
	zipReader, err := zip.NewReader(bytes.NewReader(zipData), int64(len(zipData)))
	if err != nil {
		return nil, fmt.Errorf("读取 ZIP 文件失败: %w", err)
	}

	// 查找 articles.json 文件
	var jsonData []byte
	for _, file := range zipReader.File {
		if file.Name == "articles.json" {
			rc, err := file.Open()
			if err != nil {
				return nil, fmt.Errorf("打开 articles.json 失败: %w", err)
			}
			defer rc.Close()

			jsonData, err = io.ReadAll(rc)
			if err != nil {
				return nil, fmt.Errorf("读取 articles.json 失败: %w", err)
			}
			break
		}
	}

	if jsonData == nil {
		return nil, fmt.Errorf("ZIP 文件中未找到 articles.json")
	}

	return s.ImportArticlesFromJSON(ctx, jsonData, req)
}

// sanitizeFilename 清理文件名，移除特殊字符
func sanitizeFilename(name string) string {
	// 移除或替换不安全的字符
	replacer := strings.NewReplacer(
		"/", "-",
		"\\", "-",
		":", "-",
		"*", "-",
		"?", "-",
		"\"", "-",
		"<", "-",
		">", "-",
		"|", "-",
		"\n", "",
		"\r", "",
	)
	name = replacer.Replace(name)
	name = strings.TrimSpace(name)

	// 限制长度
	if len(name) > 200 {
		name = name[:200]
	}

	return name
}

// buildMarkdownWithFrontmatter 构建带有 frontmatter 的 Markdown 内容
func buildMarkdownWithFrontmatter(article ExportArticleItem) string {
	var buf bytes.Buffer

	// 写入 YAML frontmatter
	buf.WriteString("---\n")
	buf.WriteString(fmt.Sprintf("title: \"%s\"\n", strings.ReplaceAll(article.Title, "\"", "\\\"")))
	buf.WriteString(fmt.Sprintf("date: %s\n", article.CreatedAt.Format("2006-01-02 15:04:05")))
	buf.WriteString(fmt.Sprintf("updated: %s\n", article.UpdatedAt.Format("2006-01-02 15:04:05")))

	if len(article.Tags) > 0 {
		buf.WriteString("tags:\n")
		for _, tag := range article.Tags {
			buf.WriteString(fmt.Sprintf("  - %s\n", tag))
		}
	}

	if len(article.Categories) > 0 {
		buf.WriteString("categories:\n")
		for _, cat := range article.Categories {
			buf.WriteString(fmt.Sprintf("  - %s\n", cat))
		}
	}

	if article.CoverURL != "" {
		buf.WriteString(fmt.Sprintf("cover: %s\n", article.CoverURL))
	}

	if article.Abbrlink != "" {
		buf.WriteString(fmt.Sprintf("abbrlink: %s\n", article.Abbrlink))
	}

	if article.Keywords != "" {
		buf.WriteString(fmt.Sprintf("keywords: %s\n", article.Keywords))
	}

	buf.WriteString("---\n\n")

	// 写入 Markdown 内容
	buf.WriteString(article.ContentMd)

	return buf.String()
}
