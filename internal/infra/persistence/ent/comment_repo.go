// internal/infra/persistence/ent/comment_repo.go
package ent

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/anzhiyu-c/anheyu-app/ent"
	entcomment "github.com/anzhiyu-c/anheyu-app/ent/comment"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"

	"entgo.io/ent/dialect/sql"
)

type commentRepo struct {
	db     *ent.Client
	dbType string
}

func NewCommentRepo(db *ent.Client, dbType string) repository.CommentRepository {
	return &commentRepo{
		db:     db,
		dbType: dbType,
	}
}

func toDomain(c *ent.Comment) *model.Comment {
	if c == nil {
		return nil
	}
	var ua, loc string
	if c.UserAgent != nil {
		ua = *c.UserAgent
	}
	if c.IPLocation != nil {
		loc = *c.IPLocation
	}

	// 转换关联的用户信息
	var user *model.User
	if c.Edges.User != nil {
		user = toDomainUser(c.Edges.User)
	}

	domainComment := &model.Comment{
		ID:            c.ID,
		TargetPath:    c.TargetPath,
		TargetTitle:   c.TargetTitle,
		ParentID:      c.ParentID,
		ReplyToID:     c.ReplyToID, // 添加 reply_to_id 映射
		UserID:        c.UserID,
		User:          user, // 添加关联的用户信息
		Author:        model.Author{Nickname: c.Nickname, Email: c.Email, Website: c.Website, IP: c.IPAddress, UserAgent: ua, Location: loc},
		Content:       c.Content,
		ContentHTML:   c.ContentHTML,
		LikeCount:     c.LikeCount,
		Status:        model.Status(c.Status),
		IsAdminAuthor: c.IsAdminComment,
		IsAnonymous:   c.IsAnonymous,
		CreatedAt:     c.CreatedAt,
		UpdatedAt:     c.UpdatedAt,
		PinnedAt:      c.PinnedAt,
	}
	return domainComment
}

func (r *commentRepo) Create(ctx context.Context, params *repository.CreateCommentParams) (*model.Comment, error) {
	creator := r.db.Comment.Create().
		SetTargetPath(params.TargetPath).
		SetNickname(params.Nickname).
		SetEmailMd5(params.EmailMD5).
		SetContent(params.Content).
		SetContentHTML(params.ContentHTML).
		SetIPAddress(params.IPAddress).
		SetIPLocation(params.IPLocation).
		SetStatus(params.Status).
		SetIsAdminComment(params.IsAdminComment).
		SetIsAnonymous(params.IsAnonymous)

	if params.TargetTitle != nil {
		creator.SetTargetTitle(*params.TargetTitle)
	}
	if params.UserID != nil {
		creator.SetUserID(*params.UserID)
	}
	if params.ParentID != nil {
		creator.SetParentID(*params.ParentID)
	}
	if params.ReplyToID != nil {
		creator.SetReplyToID(*params.ReplyToID)
	}
	if params.Email != nil {
		creator.SetEmail(*params.Email)
	}
	if params.Website != nil {
		creator.SetWebsite(*params.Website)
	}
	if params.UserAgent != nil {
		creator.SetUserAgent(*params.UserAgent)
	}

	newEntComment, err := creator.Save(ctx)
	if err != nil {
		return nil, err
	}
	return r.FindByID(ctx, newEntComment.ID)
}

func (r *commentRepo) FindAllPublishedByPath(ctx context.Context, path string) ([]*model.Comment, error) {
	log.Printf("[DEBUG] Repo.FindAllPublishedByPath: 开始查询路径 '%s' 的所有已发布评论", path)

	query := r.db.Comment.Query().
		Where(
			entcomment.TargetPath(path),
			entcomment.StatusEQ(int(model.StatusPublished)),
			entcomment.DeletedAtIsNil(),
		).
		WithUser() // 预加载关联的用户信息

	// 按置顶状态和创建时间排序：置顶的在前，然后按创建时间降序
	entComments, err := query.Modify(func(s *sql.Selector) {
		switch r.dbType {
		case "mysql":
			s.OrderExpr(sql.Expr(fmt.Sprintf("`%s` IS NULL ASC", entcomment.FieldPinnedAt)))
			s.OrderExpr(sql.Expr(fmt.Sprintf("`%s` DESC", entcomment.FieldPinnedAt)))
			s.OrderExpr(sql.Expr(fmt.Sprintf("`%s` DESC", entcomment.FieldCreatedAt)))
		case "sqlite", "sqlite3":
			// SQLite 不支持 NULLS LAST，使用 CASE WHEN 实现相同效果
			s.OrderExpr(sql.Expr(fmt.Sprintf(`CASE WHEN "%s" IS NULL THEN 1 ELSE 0 END`, entcomment.FieldPinnedAt)))
			s.OrderExpr(sql.Expr(fmt.Sprintf(`"%s" DESC`, entcomment.FieldPinnedAt)))
			s.OrderExpr(sql.Expr(fmt.Sprintf(`"%s" DESC`, entcomment.FieldCreatedAt)))
		default:
			// PostgreSQL 等支持 NULLS LAST 的数据库
			s.OrderExpr(sql.Expr(fmt.Sprintf(`"%s" DESC NULLS LAST`, entcomment.FieldPinnedAt)))
			s.OrderExpr(sql.Expr(fmt.Sprintf(`"%s" DESC`, entcomment.FieldCreatedAt)))
		}
	}).All(ctx)
	if err != nil {
		log.Printf("[ERROR] Repo.FindAllPublishedByPath: 查询失败: %v", err)
		return nil, err
	}
	log.Printf("[DEBUG] Repo.FindAllPublishedByPath: 查询成功，共找到 %d 条评论", len(entComments))

	domainComments := make([]*model.Comment, len(entComments))
	for i, c := range entComments {
		domainComments[i] = toDomain(c)
	}
	return domainComments, nil
}

// FindByID 根据数据库ID查找单条评论。
func (r *commentRepo) FindByID(ctx context.Context, id uint) (*model.Comment, error) {
	entComment, err := r.db.Comment.Query().
		Where(entcomment.ID(id)).
		WithUser(). // 预加载关联的用户信息
		Only(ctx)
	if err != nil {
		return nil, err
	}
	return toDomain(entComment), nil
}

// FindManyByIDs 根据一组数据库ID查找多条评论，用于批量查询。
func (r *commentRepo) FindManyByIDs(ctx context.Context, ids []uint) ([]*model.Comment, error) {
	// 如果传入的id列表为空，直接返回空切片，避免无效的数据库查询
	if len(ids) == 0 {
		return []*model.Comment{}, nil
	}

	entComments, err := r.db.Comment.Query().
		Where(entcomment.IDIn(ids...)).
		WithUser(). // 预加载关联的用户信息
		All(ctx)
	if err != nil {
		return nil, err
	}

	domainComments := make([]*model.Comment, len(entComments))
	for i, c := range entComments {
		domainComments[i] = toDomain(c)
	}
	return domainComments, nil
}

// FindAllPublishedPaginated 分页查找所有已发布的评论，按创建时间降序。
func (r *commentRepo) FindAllPublishedPaginated(ctx context.Context, page, pageSize int) ([]*model.Comment, int64, error) {
	// 构建基础查询，筛选未删除的、已发布的评论
	query := r.db.Comment.Query().
		Where(
			entcomment.StatusEQ(int(model.StatusPublished)),
			entcomment.DeletedAtIsNil(),
		)

	// 克隆查询以计算总数（在应用分页之前）
	total, err := query.Clone().Count(ctx)
	if err != nil {
		return nil, 0, err
	}

	// 在原查询上应用排序和分页
	entComments, err := query.
		WithUser().                                 // 预加载关联的用户信息
		Order(ent.Desc(entcomment.FieldCreatedAt)). // 按创建时间降序排序
		Limit(pageSize).
		Offset((page - 1) * pageSize).
		All(ctx)

	if err != nil {
		return nil, 0, err
	}

	// 将 ent 对象转换为领域模型对象
	domainComments := make([]*model.Comment, len(entComments))
	for i, c := range entComments {
		domainComments[i] = toDomain(c)
	}

	return domainComments, int64(total), nil
}

func (r *commentRepo) IncrementLikeCount(ctx context.Context, id uint) (*model.Comment, error) {
	_, err := r.db.Comment.UpdateOneID(id).AddLikeCount(1).Save(ctx)
	if err != nil {
		return nil, err
	}
	return r.FindByID(ctx, id)
}
func (r *commentRepo) DecrementLikeCount(ctx context.Context, id uint) (*model.Comment, error) {
	_, err := r.db.Comment.UpdateOneID(id).AddLikeCount(-1).Save(ctx)
	if err != nil {
		return nil, err
	}
	return r.FindByID(ctx, id)
}
func (r *commentRepo) FindWithConditions(ctx context.Context, params repository.AdminListParams) ([]*model.Comment, int64, error) {
	query := r.db.Comment.Query().Where(entcomment.DeletedAtIsNil())

	if params.Nickname != nil && *params.Nickname != "" {
		query = query.Where(entcomment.NicknameContains(*params.Nickname))
	}
	if params.Email != nil && *params.Email != "" {
		query = query.Where(entcomment.EmailContains(*params.Email))
	}
	if params.Website != nil && *params.Website != "" {
		query = query.Where(entcomment.WebsiteContains(*params.Website))
	}
	if params.IPAddress != nil && *params.IPAddress != "" {
		query = query.Where(entcomment.IPAddressContains(*params.IPAddress))
	}
	if params.Content != nil && *params.Content != "" {
		query = query.Where(entcomment.ContentContains(*params.Content))
	}
	if params.TargetPath != nil && *params.TargetPath != "" {
		query = query.Where(entcomment.TargetPathContains(*params.TargetPath))
	}
	if params.Status != nil {
		query = query.Where(entcomment.StatusEQ(*params.Status))
	}

	total, err := query.Count(ctx)
	if err != nil {
		return nil, 0, err
	}

	query = query.
		WithUser(). // 预加载关联的用户信息
		Modify(func(s *sql.Selector) {
			switch r.dbType {
			case "mysql":
				s.OrderExpr(sql.Expr(fmt.Sprintf("`%s` IS NULL ASC", entcomment.FieldPinnedAt)))
				s.OrderExpr(sql.Expr(fmt.Sprintf("`%s` DESC", entcomment.FieldPinnedAt)))
				s.OrderExpr(sql.Expr(fmt.Sprintf("`%s` DESC", entcomment.FieldCreatedAt)))
			case "sqlite", "sqlite3":
				// SQLite 不支持 NULLS LAST，使用 CASE WHEN 实现相同效果
				s.OrderExpr(sql.Expr(fmt.Sprintf(`CASE WHEN "%s" IS NULL THEN 1 ELSE 0 END`, entcomment.FieldPinnedAt)))
				s.OrderExpr(sql.Expr(fmt.Sprintf(`"%s" DESC`, entcomment.FieldPinnedAt)))
				s.OrderExpr(sql.Expr(fmt.Sprintf(`"%s" DESC`, entcomment.FieldCreatedAt)))
			default:
				// PostgreSQL 等支持 NULLS LAST 的数据库
				s.OrderExpr(sql.Expr(fmt.Sprintf(`"%s" DESC NULLS LAST`, entcomment.FieldPinnedAt)))
				s.OrderExpr(sql.Expr(fmt.Sprintf(`"%s" DESC`, entcomment.FieldCreatedAt)))
			}
		}).
		Limit(params.PageSize).
		Offset((params.Page - 1) * params.PageSize)

	entComments, err := query.All(ctx)
	if err != nil {
		return nil, 0, err
	}

	domainComments := make([]*model.Comment, len(entComments))
	for i, c := range entComments {
		domainComments[i] = toDomain(c)
	}

	return domainComments, int64(total), nil
}
func (r *commentRepo) DeleteByIDs(ctx context.Context, ids []uint) (int, error) {
	info, err := r.db.Comment.Update().
		Where(entcomment.IDIn(ids...)).
		SetDeletedAt(time.Now()).
		Save(ctx)
	if err != nil {
		return 0, err
	}
	return info, nil
}
func (r *commentRepo) UpdateStatus(ctx context.Context, id uint, status model.Status) (*model.Comment, error) {
	_, err := r.db.Comment.UpdateOneID(id).SetStatus(int(status)).Save(ctx)
	if err != nil {
		return nil, err
	}
	return r.FindByID(ctx, id)
}
func (r *commentRepo) SetPin(ctx context.Context, id uint, pinTime *time.Time) (*model.Comment, error) {
	updater := r.db.Comment.UpdateOneID(id)
	if pinTime != nil {
		updater.SetPinnedAt(*pinTime)
	} else {
		updater.ClearPinnedAt()
	}
	_, err := updater.Save(ctx)
	if err != nil {
		return nil, err
	}
	return r.FindByID(ctx, id)
}
func (r *commentRepo) UpdateContent(ctx context.Context, id uint, content, contentHTML string) (*model.Comment, error) {
	_, err := r.db.Comment.UpdateOneID(id).
		SetContent(content).
		SetContentHTML(contentHTML).
		Save(ctx)
	if err != nil {
		return nil, err
	}
	return r.FindByID(ctx, id)
}
func (r *commentRepo) UpdatePath(ctx context.Context, oldPath, newPath string) (int, error) {
	info, err := r.db.Comment.Update().
		Where(entcomment.TargetPath(oldPath)).
		SetTargetPath(newPath).
		Save(ctx)
	return info, err
}
func (r *commentRepo) FindPublishedChildrenByParentID(ctx context.Context, parentID uint, page, pageSize int) ([]*model.Comment, int64, error) {
	query := r.db.Comment.Query().
		Where(
			entcomment.ParentID(parentID),
			entcomment.StatusEQ(int(model.StatusPublished)),
			entcomment.DeletedAtIsNil(),
		)

	total, err := query.Clone().Count(ctx)
	if err != nil {
		return nil, 0, err
	}

	entComments, err := query.
		Order(ent.Desc(entcomment.FieldCreatedAt)).
		Limit(pageSize).
		Offset((page - 1) * pageSize).
		All(ctx)
	if err != nil {
		return nil, 0, err
	}

	domainComments := make([]*model.Comment, len(entComments))
	for i, c := range entComments {
		domainComments[i] = toDomain(c)
	}

	return domainComments, int64(total), nil
}

// min 辅助函数
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// CountByTargetPaths 批量统计多个文章的评论数量
func (r *commentRepo) CountByTargetPaths(ctx context.Context, targetPaths []string) (map[string]int, error) {
	if len(targetPaths) == 0 {
		return make(map[string]int), nil
	}

	// 查询所有已发布的评论，按target_path分组统计数量
	var results []struct {
		TargetPath string `json:"target_path"`
		Count      int    `json:"count"`
	}

	err := r.db.Comment.Query().
		Where(
			entcomment.TargetPathIn(targetPaths...),
			entcomment.StatusEQ(int(model.StatusPublished)),
			entcomment.DeletedAtIsNil(),
		).
		Modify(func(s *sql.Selector) {
			s.Select(entcomment.FieldTargetPath, "COUNT(*) as count").
				GroupBy(entcomment.FieldTargetPath)
		}).
		Scan(ctx, &results)

	if err != nil {
		log.Printf("[ERROR] CountByTargetPaths: 查询失败: %v", err)
		return nil, err
	}

	// 转换为map
	countMap := make(map[string]int)
	for _, result := range results {
		countMap[result.TargetPath] = result.Count
	}

	log.Printf("[DEBUG] CountByTargetPaths: 统计结果: %+v", countMap)
	return countMap, nil
}
