/*
 * @Description: Meilisearch 搜索引擎插件 - 可作为独立二进制运行，也可编译时内嵌
 * @Author: 安知鱼
 * @Date: 2026-04-09
 */
package meilisearch

import (
	"context"
	"fmt"
	"log"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/plugin"
	"github.com/anzhiyu-c/anheyu-app/pkg/plugin/sdk"
	ms "github.com/meilisearch/meilisearch-go"
)

var reHTMLTags = regexp.MustCompile(`<[^>]*>`)

const indexName = "articles"

// Searcher 基于 Meilisearch 的搜索引擎实现
type Searcher struct {
	client ms.ServiceManager
	index  ms.IndexManager
}

func (s *Searcher) PluginMetadata() plugin.Metadata {
	return plugin.Metadata{
		ID:          "search-meilisearch",
		Name:        "Meilisearch 搜索引擎",
		Version:     "1.0.0",
		Description: "基于 Meilisearch 的全文搜索引擎，支持中文分词与高亮",
		Author:      "安知鱼",
		Type:        "search",
	}
}

// NewSearcher 创建 Meilisearch 搜索器
func NewSearcher(host, apiKey string) (*Searcher, error) {
	if host == "" {
		return nil, fmt.Errorf("Meilisearch 地址不能为空")
	}

	client := ms.New(host, ms.WithAPIKey(apiKey))
	_, err := client.GetIndex(indexName)
	if err != nil {
		log.Printf("Meilisearch 索引 '%s' 不存在，创建中...", indexName)
		taskInfo, createErr := client.CreateIndex(&ms.IndexConfig{
			Uid:        indexName,
			PrimaryKey: "id",
		})
		if createErr != nil {
			return nil, fmt.Errorf("创建 Meilisearch 索引失败: %w", createErr)
		}
		_, _ = client.WaitForTask(taskInfo.TaskUID, 30*time.Second)
	}

	index := client.Index(indexName)
	if err != nil {
		configureIndex(client, index)
	}

	return &Searcher{client: client, index: index}, nil
}

func configureIndex(client ms.ServiceManager, index ms.IndexManager) {
	timeout := 30 * time.Second
	waitAndLog := func(taskUID int64, label string) {
		if _, err := client.WaitForTask(taskUID, timeout); err != nil {
			log.Printf("⚠️ Meilisearch 等待 %s 任务完成超时: %v", label, err)
		}
	}

	if taskInfo, err := index.UpdateSearchableAttributes(&[]string{"title", "content", "tags", "category", "author"}); err == nil {
		waitAndLog(taskInfo.TaskUID, "searchableAttributes")
	}
	filterableAttrs := []interface{}{"category", "tags", "is_doc", "created_at"}
	if taskInfo, err := index.UpdateFilterableAttributes(&filterableAttrs); err == nil {
		waitAndLog(taskInfo.TaskUID, "filterableAttributes")
	}
	if taskInfo, err := index.UpdateSortableAttributes(&[]string{"created_at", "view_count"}); err == nil {
		waitAndLog(taskInfo.TaskUID, "sortableAttributes")
	}
	if taskInfo, err := index.UpdateRankingRules(&[]string{"words", "typo", "proximity", "attribute", "sort", "exactness"}); err == nil {
		waitAndLog(taskInfo.TaskUID, "rankingRules")
	}
}

// --- model.Searcher 接口实现 ---

type meiliDoc struct {
	ID          string   `json:"id"`
	Title       string   `json:"title"`
	Content     string   `json:"content"`
	Author      string   `json:"author"`
	Category    string   `json:"category"`
	Tags        []string `json:"tags"`
	CoverURL    string   `json:"cover_url"`
	Abbrlink    string   `json:"abbrlink"`
	ViewCount   int      `json:"view_count"`
	WordCount   int      `json:"word_count"`
	ReadingTime int      `json:"reading_time"`
	IsDoc       bool     `json:"is_doc"`
	DocSeriesID string   `json:"doc_series_id"`
	CreatedAt   int64    `json:"created_at"`
	Formatted   *struct {
		Content string `json:"content"`
		Title   string `json:"title"`
	} `json:"_formatted,omitempty"`
}

func (s *Searcher) Search(ctx context.Context, query string, page int, size int) (*model.SearchResult, error) {
	if page < 1 {
		page = 1
	}
	if size < 1 {
		size = 10
	} else if size > 100 {
		size = 100
	}

	if query == "" {
		return &model.SearchResult{
			Pagination: &model.SearchPagination{Total: 0, Page: page, Size: size, TotalPages: 0},
			Hits:       []*model.SearchHit{},
		}, nil
	}

	offset := int64((page - 1) * size)
	limit := int64(size)

	searchRes, err := s.index.Search(query, &ms.SearchRequest{
		Offset:                offset,
		Limit:                 limit,
		AttributesToRetrieve:  []string{"*"},
		AttributesToHighlight: []string{"title", "content"},
		HighlightPreTag:       "<mark>",
		HighlightPostTag:      "</mark>",
		AttributesToCrop:      []string{"content:150"},
		CropMarker:            "...",
		ShowMatchesPosition:   true,
	})
	if err != nil {
		return nil, fmt.Errorf("Meilisearch 查询失败: %w", err)
	}

	hits := make([]*model.SearchHit, 0, len(searchRes.Hits))
	for _, rawHit := range searchRes.Hits {
		var doc meiliDoc
		if err := rawHit.DecodeInto(&doc); err != nil {
			continue
		}
		hit := docToHit(&doc)
		hits = append(hits, hit)
	}

	total := searchRes.EstimatedTotalHits
	totalPages := (int(total) + size - 1) / size

	return &model.SearchResult{
		Pagination: &model.SearchPagination{Total: total, Page: page, Size: size, TotalPages: totalPages},
		Hits:       hits,
	}, nil
}

func (s *Searcher) IndexArticle(ctx context.Context, article *model.Article) error {
	content := reHTMLTags.ReplaceAllString(article.ContentHTML, " ")
	content = strings.TrimSpace(content)

	author := article.CopyrightAuthor

	category := ""
	if len(article.PostCategories) > 0 {
		category = article.PostCategories[0].Name
	}
	tags := make([]string, len(article.PostTags))
	for i, tag := range article.PostTags {
		tags[i] = tag.Name
	}

	doc := meiliDoc{
		ID: article.ID, Title: article.Title, Content: content,
		Author: author, Category: category, Tags: tags,
		CoverURL: article.CoverURL, Abbrlink: article.Abbrlink,
		ViewCount: article.ViewCount, WordCount: article.WordCount,
		ReadingTime: article.ReadingTime, IsDoc: article.IsDoc,
		CreatedAt: article.CreatedAt.Unix(),
	}

	pk := "id"
	_, err := s.index.AddDocuments([]meiliDoc{doc}, &ms.DocumentOptions{PrimaryKey: &pk})
	if err != nil {
		return fmt.Errorf("Meilisearch 索引文章失败: %w", err)
	}
	return nil
}

func (s *Searcher) DeleteArticle(ctx context.Context, articleID string) error {
	_, err := s.index.DeleteDocument(articleID, nil)
	if err != nil {
		return fmt.Errorf("Meilisearch 删除文章索引失败: %w", err)
	}
	return nil
}

func (s *Searcher) ClearAllDocuments(ctx context.Context) error {
	_, err := s.index.DeleteAllDocuments(nil)
	if err != nil {
		return fmt.Errorf("清理 Meilisearch 索引失败: %w", err)
	}
	log.Println("Meilisearch 索引已清理")
	return nil
}

func (s *Searcher) HealthCheck(ctx context.Context) error {
	health, err := s.client.Health()
	if err != nil {
		return fmt.Errorf("Meilisearch 健康检查失败: %w", err)
	}
	if health.Status != "available" {
		return fmt.Errorf("Meilisearch 状态异常: %s", health.Status)
	}
	return nil
}

func docToHit(doc *meiliDoc) *model.SearchHit {
	snippet := ""
	if doc.Formatted != nil && doc.Formatted.Content != "" {
		snippet = doc.Formatted.Content
	} else {
		contentRunes := []rune(doc.Content)
		if len(contentRunes) > 150 {
			snippet = string(contentRunes[:150]) + "..."
		} else {
			snippet = doc.Content
		}
	}
	var publishDate time.Time
	if doc.CreatedAt > 0 {
		publishDate = time.Unix(doc.CreatedAt, 0)
	}
	return &model.SearchHit{
		ID: doc.ID, Title: doc.Title, Snippet: snippet,
		Author: doc.Author, Category: doc.Category, Tags: doc.Tags,
		PublishDate: publishDate, CoverURL: doc.CoverURL,
		Abbrlink: doc.Abbrlink, ViewCount: doc.ViewCount,
		WordCount: doc.WordCount, ReadingTime: doc.ReadingTime,
		IsDoc: doc.IsDoc, DocSeriesID: doc.DocSeriesID,
	}
}

// Serve 作为 go-plugin 服务端运行（供独立二进制的 main 函数调用）
// 配置优先级：管理后台下发的插件配置 > 主进程环境变量（旧部署方式兼容）
func Serve() {
	cfg := sdk.LoadConfig()
	host := cfg.StringDefault("host", os.Getenv("ANHEYU_MEILISEARCH_HOST"))
	apiKey := cfg.StringDefault("api_key", os.Getenv("ANHEYU_MEILISEARCH_API_KEY"))

	searcher, err := NewSearcher(host, apiKey)
	if err != nil {
		log.Fatalf("Meilisearch 初始化失败: %v", err)
	}

	sdk.Serve(sdk.Options{
		Metadata: searcher.PluginMetadata(),
		Searcher: searcher,
	})
}
