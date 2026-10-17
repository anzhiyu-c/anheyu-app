/*
 * @Description: 文章历史版本服务
 * @Author: 安知鱼
 * @Date: 2026-01-13
 */
package article_history

import (
	"context"
	"fmt"
	"log"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/parser"
)

// 历史版本保留策略配置
const (
	DefaultMaxHistoryVersions = 10 // 默认最多保留10个版本
	MinHistoryVersions        = 3  // 最少保留3个版本
)

// Service 定义了文章历史版本服务的接口
type Service interface {
	GetArticleOwnerID(ctx context.Context, articlePublicID string) (uint, error)
	// CreateHistory 创建历史版本（内部调用，由文章发布时触发）
	CreateHistory(ctx context.Context, article *model.Article, editorID uint, editorNickname, changeNote string) error

	// CreateHistoryWithExtra 创建历史版本（带扩展数据，PRO版本使用）
	CreateHistoryWithExtra(ctx context.Context, article *model.Article, editorID uint, editorNickname, changeNote string, extraData map[string]interface{}) error

	// ListHistory 获取文章历史版本列表
	ListHistory(ctx context.Context, articlePublicID string, page, pageSize int) (*model.ArticleHistoryListResponse, error)

	// GetHistoryVersion 获取指定版本详情
	GetHistoryVersion(ctx context.Context, articlePublicID string, version int) (*model.ArticleHistory, error)

	// CompareVersions 对比两个版本
	CompareVersions(ctx context.Context, articlePublicID string, v1, v2 int) (*model.ArticleHistoryCompareResponse, error)

	// RestoreVersion 恢复到指定版本（返回恢复后的文章数据，由调用方执行实际更新）
	RestoreVersion(ctx context.Context, articlePublicID string, version int) (*model.ArticleHistory, error)

	// GetHistoryCount 获取文章的历史版本数量
	GetHistoryCount(ctx context.Context, articlePublicID string) (int, error)

	// DeleteArticleHistories 删除文章的所有历史版本（文章被删除时调用）
	DeleteArticleHistories(ctx context.Context, articlePublicID string) error

	// CleanupAllOldVersions 清理所有文章的旧历史版本（定时任务调用）
	CleanupAllOldVersions(ctx context.Context) (int, error)
}

func (s *serviceImpl) GetArticleOwnerID(ctx context.Context, articlePublicID string) (uint, error) {
	article, err := s.articleRepo.GetByID(ctx, articlePublicID)
	if err != nil {
		return 0, err
	}
	return article.OwnerID, nil
}

type serviceImpl struct {
	historyRepo repository.ArticleHistoryRepository
	articleRepo repository.ArticleRepository
	userRepo    repository.UserRepository
	maxVersions int
}

// NewService 创建 ArticleHistoryService 实例
func NewService(
	historyRepo repository.ArticleHistoryRepository,
	articleRepo repository.ArticleRepository,
	userRepo repository.UserRepository,
) Service {
	return &serviceImpl{
		historyRepo: historyRepo,
		articleRepo: articleRepo,
		userRepo:    userRepo,
		maxVersions: DefaultMaxHistoryVersions,
	}
}

// CreateHistory 创建历史版本
func (s *serviceImpl) CreateHistory(ctx context.Context, article *model.Article, editorID uint, editorNickname, changeNote string) error {
	return s.CreateHistoryWithExtra(ctx, article, editorID, editorNickname, changeNote, nil)
}

// CreateHistoryWithExtra 创建历史版本（带扩展数据）
func (s *serviceImpl) CreateHistoryWithExtra(ctx context.Context, article *model.Article, editorID uint, editorNickname, changeNote string, extraData map[string]interface{}) error {
	// 1. 解码文章ID
	articleDBID, _, err := idgen.DecodePublicID(article.ID)
	if err != nil {
		return fmt.Errorf("解码文章ID失败: %w", err)
	}

	// 2. 获取当前最新版本号
	latestVersion, err := s.historyRepo.GetLatestVersion(ctx, articleDBID)
	if err != nil {
		return fmt.Errorf("获取最新版本号失败: %w", err)
	}
	newVersion := latestVersion + 1

	// 3. 创建历史记录
	params := &model.CreateArticleHistoryParams{
		ArticleDBID:    articleDBID,
		Version:        newVersion,
		Title:          article.Title,
		ContentMd:      article.ContentMd,
		ContentHTML:    article.ContentHTML,
		CoverURL:       article.CoverURL,
		TopImgURL:      article.TopImgURL,
		PrimaryColor:   article.PrimaryColor,
		Summaries:      article.Summaries,
		WordCount:      article.WordCount,
		Keywords:       article.Keywords,
		EditorID:       editorID,
		EditorNickname: editorNickname,
		ChangeNote:     changeNote,
		ExtraData:      extraData,
	}

	_, err = s.historyRepo.Create(ctx, params)
	if err != nil {
		return fmt.Errorf("创建历史版本失败: %w", err)
	}

	log.Printf("[ArticleHistoryService] 创建历史版本成功: 文章=%s, 版本=%d, 编辑者=%s",
		article.ID, newVersion, editorNickname)

	// 4. 异步清理旧版本（保留最近10个）
	go func() {
		if cleanErr := s.historyRepo.DeleteOldVersions(context.Background(), articleDBID, s.maxVersions); cleanErr != nil {
			log.Printf("[ArticleHistoryService] 清理旧版本失败: %v", cleanErr)
		}
	}()

	return nil
}

// ListHistory 获取文章历史版本列表
func (s *serviceImpl) ListHistory(ctx context.Context, articlePublicID string, page, pageSize int) (*model.ArticleHistoryListResponse, error) {
	// 解码文章ID
	articleDBID, _, err := idgen.DecodePublicID(articlePublicID)
	if err != nil {
		return nil, fmt.Errorf("解码文章ID失败: %w", err)
	}

	// 验证文章是否存在
	_, err = s.articleRepo.GetByID(ctx, articlePublicID)
	if err != nil {
		return nil, fmt.Errorf("文章不存在: %w", err)
	}

	// 获取历史版本列表
	items, total, err := s.historyRepo.ListByArticle(ctx, articleDBID, page, pageSize)
	if err != nil {
		return nil, fmt.Errorf("获取历史版本列表失败: %w", err)
	}

	return &model.ArticleHistoryListResponse{
		List:     items,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	}, nil
}

// GetHistoryVersion 获取指定版本详情
func (s *serviceImpl) GetHistoryVersion(ctx context.Context, articlePublicID string, version int) (*model.ArticleHistory, error) {
	// 解码文章ID
	articleDBID, _, err := idgen.DecodePublicID(articlePublicID)
	if err != nil {
		return nil, fmt.Errorf("解码文章ID失败: %w", err)
	}

	// 获取指定版本
	history, err := s.historyRepo.GetByArticleAndVersion(ctx, articleDBID, version)
	if err != nil {
		return nil, fmt.Errorf("获取历史版本失败: %w", err)
	}

	return sanitizedHistory(history), nil
}

// CompareVersions 对比两个版本
func (s *serviceImpl) CompareVersions(ctx context.Context, articlePublicID string, v1, v2 int) (*model.ArticleHistoryCompareResponse, error) {
	// 解码文章ID
	articleDBID, _, err := idgen.DecodePublicID(articlePublicID)
	if err != nil {
		return nil, fmt.Errorf("解码文章ID失败: %w", err)
	}

	// 确保 v1 < v2（旧版本在前）
	if v1 > v2 {
		v1, v2 = v2, v1
	}

	// 获取两个版本
	oldVersion, err := s.historyRepo.GetByArticleAndVersion(ctx, articleDBID, v1)
	if err != nil {
		return nil, fmt.Errorf("获取旧版本失败: %w", err)
	}

	newVersion, err := s.historyRepo.GetByArticleAndVersion(ctx, articleDBID, v2)
	if err != nil {
		return nil, fmt.Errorf("获取新版本失败: %w", err)
	}

	return &model.ArticleHistoryCompareResponse{
		OldVersion: sanitizedHistory(oldVersion),
		NewVersion: sanitizedHistory(newVersion),
	}, nil
}

// RestoreVersion 恢复到指定版本
func (s *serviceImpl) RestoreVersion(ctx context.Context, articlePublicID string, version int) (*model.ArticleHistory, error) {
	// 解码文章ID
	articleDBID, _, err := idgen.DecodePublicID(articlePublicID)
	if err != nil {
		return nil, fmt.Errorf("解码文章ID失败: %w", err)
	}

	// 获取指定版本
	history, err := s.historyRepo.GetByArticleAndVersion(ctx, articleDBID, version)
	if err != nil {
		return nil, fmt.Errorf("获取历史版本失败: %w", err)
	}

	log.Printf("[ArticleHistoryService] 准备恢复到版本: 文章=%s, 版本=%d", articlePublicID, version)

	// 返回历史版本数据，由调用方执行实际的文章更新
	return sanitizedHistory(history), nil
}

func sanitizedHistory(history *model.ArticleHistory) *model.ArticleHistory {
	if history == nil {
		return nil
	}
	result := *history
	result.ContentHTML = parser.SanitizeArticleHTML(history.ContentHTML, history.ContentMd)
	return &result
}

// GetHistoryCount 获取文章的历史版本数量
func (s *serviceImpl) GetHistoryCount(ctx context.Context, articlePublicID string) (int, error) {
	// 解码文章ID
	articleDBID, _, err := idgen.DecodePublicID(articlePublicID)
	if err != nil {
		return 0, fmt.Errorf("解码文章ID失败: %w", err)
	}

	count, err := s.historyRepo.CountByArticle(ctx, articleDBID)
	if err != nil {
		return 0, fmt.Errorf("获取历史版本数量失败: %w", err)
	}

	return count, nil
}

// DeleteArticleHistories 删除文章的所有历史版本
func (s *serviceImpl) DeleteArticleHistories(ctx context.Context, articlePublicID string) error {
	// 解码文章ID
	articleDBID, _, err := idgen.DecodePublicID(articlePublicID)
	if err != nil {
		return fmt.Errorf("解码文章ID失败: %w", err)
	}

	err = s.historyRepo.DeleteByArticle(ctx, articleDBID)
	if err != nil {
		return fmt.Errorf("删除文章历史版本失败: %w", err)
	}

	log.Printf("[ArticleHistoryService] 删除文章历史版本成功: 文章=%s", articlePublicID)
	return nil
}

// CleanupAllOldVersions 清理所有文章的旧历史版本
func (s *serviceImpl) CleanupAllOldVersions(ctx context.Context) (int, error) {
	// 获取所有有历史记录的文章ID
	articleIDs, err := s.historyRepo.GetAllArticleIDsWithHistory(ctx)
	if err != nil {
		return 0, fmt.Errorf("获取文章ID列表失败: %w", err)
	}

	if len(articleIDs) == 0 {
		log.Printf("[ArticleHistoryService] 没有需要清理的历史版本")
		return 0, nil
	}

	log.Printf("[ArticleHistoryService] 开始清理历史版本，共有 %d 篇文章有历史记录", len(articleIDs))

	cleanedCount := 0
	errorCount := 0

	// 遍历每篇文章，清理旧版本
	for _, articleDBID := range articleIDs {
		// 检查当前版本数量
		count, err := s.historyRepo.CountByArticle(ctx, articleDBID)
		if err != nil {
			log.Printf("[ArticleHistoryService] 获取文章 %d 历史版本数量失败: %v", articleDBID, err)
			errorCount++
			continue
		}

		// 如果版本数超过限制，执行清理
		if count > s.maxVersions {
			if err := s.historyRepo.DeleteOldVersions(ctx, articleDBID, s.maxVersions); err != nil {
				log.Printf("[ArticleHistoryService] 清理文章 %d 旧版本失败: %v", articleDBID, err)
				errorCount++
				continue
			}
			cleanedCount++
		}
	}

	log.Printf("[ArticleHistoryService] 历史版本清理完成: 清理了 %d 篇文章的旧版本，%d 个错误", cleanedCount, errorCount)
	return cleanedCount, nil
}
