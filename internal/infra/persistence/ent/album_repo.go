package ent

import (
	"context"
	"fmt"
	"strings"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"

	"github.com/anzhiyu-c/anheyu-app/ent"
	"github.com/anzhiyu-c/anheyu-app/ent/album"
	"github.com/anzhiyu-c/anheyu-app/ent/privacy"
)

type entAlbumRepository struct {
	client *ent.Client
}

// NewEntAlbumRepository 是 entAlbumRepository 的构造函数
func NewEntAlbumRepository(client *ent.Client) repository.AlbumRepository {
	return &entAlbumRepository{client: client}
}

func (r *entAlbumRepository) Create(ctx context.Context, domainAlbum *model.Album) error {
	create := r.client.Album.
		Create().
		SetImageURL(domainAlbum.ImageUrl).
		SetBigImageURL(domainAlbum.BigImageUrl).
		SetDownloadURL(domainAlbum.DownloadUrl).
		SetThumbParam(domainAlbum.ThumbParam).
		SetBigParam(domainAlbum.BigParam).
		SetTags(domainAlbum.Tags).
		SetViewCount(domainAlbum.ViewCount).
		SetDownloadCount(domainAlbum.DownloadCount).
		SetWidth(domainAlbum.Width).
		SetHeight(domainAlbum.Height).
		SetFileSize(domainAlbum.FileSize).
		SetFormat(domainAlbum.Format).
		SetAspectRatio(domainAlbum.AspectRatio).
		SetFileHash(domainAlbum.FileHash).
		SetDisplayOrder(domainAlbum.DisplayOrder).
		SetTitle(domainAlbum.Title).
		SetDescription(domainAlbum.Description).
		SetLocation(domainAlbum.Location)

	if domainAlbum.CategoryID != nil {
		create = create.SetCategoryID(*domainAlbum.CategoryID)
	}

	if !domainAlbum.CreatedAt.IsZero() {
		create = create.SetCreatedAt(domainAlbum.CreatedAt)
	}

	if domainAlbum.PublishedAt != nil {
		create = create.SetNillablePublishedAt(domainAlbum.PublishedAt)
	}

	created, err := create.Save(ctx)
	if err != nil {
		return err
	}
	domainAlbum.ID = created.ID
	domainAlbum.CreatedAt = created.CreatedAt
	return nil
}

func (r *entAlbumRepository) CreateOrRestore(ctx context.Context, domainAlbum *model.Album) (finalAlbum *model.Album, status repository.CreationStatus, err error) {
	tx, err := r.client.Tx(ctx)
	if err != nil {
		return nil, repository.StatusError, fmt.Errorf("开启事务失败: %w", err)
	}

	// 使用 defer 来确保事务的提交或回滚
	defer func() {
		if p := recover(); p != nil {
			tx.Rollback()
			panic(p)
		}
		if err != nil {
			if rerr := tx.Rollback(); rerr != nil {
				err = fmt.Errorf("%w: 回滚事务失败: %v", err, rerr)
			}
			return
		}
		if cerr := tx.Commit(); cerr != nil {
			err = fmt.Errorf("提交事务失败: %w", cerr)
		}
	}()

	// 允许查询被软删除的记录
	allowCtx := privacy.DecisionContext(ctx, privacy.Allow)
	existingPO, err := tx.Album.Query().
		Where(album.FileHash(domainAlbum.FileHash)).
		Only(allowCtx)

	if err != nil && !ent.IsNotFound(err) {
		return nil, repository.StatusError, err
	}

	if ent.IsNotFound(err) {
		// 不存在，创建新的
		create := tx.Album.Create().
			SetImageURL(domainAlbum.ImageUrl).
			SetBigImageURL(domainAlbum.BigImageUrl).
			SetDownloadURL(domainAlbum.DownloadUrl).
			SetThumbParam(domainAlbum.ThumbParam).
			SetBigParam(domainAlbum.BigParam).
			SetTags(domainAlbum.Tags).
			SetViewCount(domainAlbum.ViewCount).
			SetDownloadCount(domainAlbum.DownloadCount).
			SetWidth(domainAlbum.Width).
			SetHeight(domainAlbum.Height).
			SetFileSize(domainAlbum.FileSize).
			SetFormat(domainAlbum.Format).
			SetAspectRatio(domainAlbum.AspectRatio).
			SetFileHash(domainAlbum.FileHash).
			SetDisplayOrder(domainAlbum.DisplayOrder).
			SetTitle(domainAlbum.Title).
			SetDescription(domainAlbum.Description).
			SetLocation(domainAlbum.Location)

		// 处理可选的 CategoryID
		if domainAlbum.CategoryID != nil {
			create = create.SetCategoryID(*domainAlbum.CategoryID)
		}

		// 如果传入了自定义的创建时间，则使用它
		if !domainAlbum.CreatedAt.IsZero() {
			create = create.SetCreatedAt(domainAlbum.CreatedAt)
		}

		if domainAlbum.PublishedAt != nil {
			create = create.SetNillablePublishedAt(domainAlbum.PublishedAt)
		}

		newAlbumPO, createErr := create.Save(ctx)
		if createErr != nil {
			err = createErr
			return nil, repository.StatusError, err
		}
		status = repository.StatusCreated
		finalAlbum = toDomainAlbum(newAlbumPO)
		return finalAlbum, status, nil
	}

	// 已存在
	if existingPO.DeletedAt != nil {
		// 被软删除了，恢复并用最新数据覆盖
		restore := tx.Album.UpdateOne(existingPO).
			ClearDeletedAt().
			SetImageURL(domainAlbum.ImageUrl).
			SetBigImageURL(domainAlbum.BigImageUrl).
			SetDownloadURL(domainAlbum.DownloadUrl).
			SetThumbParam(domainAlbum.ThumbParam).
			SetBigParam(domainAlbum.BigParam).
			SetTags(domainAlbum.Tags).
			SetWidth(domainAlbum.Width).
			SetHeight(domainAlbum.Height).
			SetFileSize(domainAlbum.FileSize).
			SetFormat(domainAlbum.Format).
			SetAspectRatio(domainAlbum.AspectRatio).
			SetDisplayOrder(domainAlbum.DisplayOrder).
			SetTitle(domainAlbum.Title).
			SetDescription(domainAlbum.Description).
			SetLocation(domainAlbum.Location)

		if domainAlbum.CategoryID != nil {
			restore = restore.SetCategoryID(*domainAlbum.CategoryID)
		} else {
			restore = restore.ClearCategoryID()
		}

		if domainAlbum.PublishedAt != nil {
			restore = restore.SetNillablePublishedAt(domainAlbum.PublishedAt)
		} else {
			restore = restore.ClearPublishedAt()
		}

		updatedPO, updateErr := restore.Save(ctx)
		if updateErr != nil {
			err = updateErr
			return nil, repository.StatusError, err
		}
		status = repository.StatusRestored
		finalAlbum = toDomainAlbum(updatedPO)
	} else {
		// 未被删除，直接返回
		status = repository.StatusExisted
		finalAlbum = toDomainAlbum(existingPO)
	}

	return finalAlbum, status, nil
}

func (r *entAlbumRepository) Update(ctx context.Context, domainAlbum *model.Album) error {
	update := r.client.Album.
		UpdateOneID(domainAlbum.ID).
		SetImageURL(domainAlbum.ImageUrl).
		SetBigImageURL(domainAlbum.BigImageUrl).
		SetDownloadURL(domainAlbum.DownloadUrl).
		SetThumbParam(domainAlbum.ThumbParam).
		SetBigParam(domainAlbum.BigParam).
		SetTags(domainAlbum.Tags).
		SetViewCount(domainAlbum.ViewCount).
		SetDownloadCount(domainAlbum.DownloadCount).
		SetWidth(domainAlbum.Width).
		SetHeight(domainAlbum.Height).
		SetFileSize(domainAlbum.FileSize).
		SetFormat(domainAlbum.Format).
		SetAspectRatio(domainAlbum.AspectRatio).
		SetFileHash(domainAlbum.FileHash).
		SetDisplayOrder(domainAlbum.DisplayOrder).
		SetTitle(domainAlbum.Title).
		SetDescription(domainAlbum.Description).
		SetLocation(domainAlbum.Location)

	// 处理可选的 CategoryID
	if domainAlbum.CategoryID != nil {
		update = update.SetCategoryID(*domainAlbum.CategoryID)
	} else {
		update = update.ClearCategoryID()
	}

	// 处理可选的 PublishedAt
	if domainAlbum.PublishedAt != nil {
		update = update.SetNillablePublishedAt(domainAlbum.PublishedAt)
	} else {
		update = update.ClearPublishedAt()
	}

	_, err := update.Save(ctx)
	return err
}

func (r *entAlbumRepository) FindListByOptions(ctx context.Context, opts repository.AlbumQueryOptions) (*repository.PageResult[model.Album], error) {
	query := r.client.Album.Query()

	// 应用过滤条件
	if opts.CategoryID != nil {
		query = query.Where(album.CategoryID(*opts.CategoryID))
	}
	if opts.Tag != "" {
		// Ent 负责各数据库的占位符和 LIKE 转义，避免 PostgreSQL 的裸 ?
		// 以及用户提供的 %/_ 被解释为通配符。
		query = query.Where(album.Or(
			album.TagsEQ(opts.Tag),
			album.TagsHasPrefix(opts.Tag+","),
			album.TagsHasSuffix(","+opts.Tag),
			album.TagsContains(","+opts.Tag+","),
		))
	}
	if opts.Start != nil {
		query = query.Where(album.CreatedAtGTE(*opts.Start))
	}
	if opts.End != nil {
		query = query.Where(album.CreatedAtLTE(*opts.End))
	}

	// 克隆查询用于计算总数，避免排序和分页影响
	total, err := query.Clone().Count(ctx)
	if err != nil {
		return nil, fmt.Errorf("计算总数失败: %w", err)
	}
	if total == 0 {
		return &repository.PageResult[model.Album]{Items: []*model.Album{}, Total: 0}, nil
	}

	// 应用排序
	switch opts.Sort {
	case "display_order_asc":
		query = query.Order(ent.Asc(album.FieldDisplayOrder), ent.Desc(album.FieldCreatedAt))
	case "created_at_asc":
		query = query.Order(ent.Asc(album.FieldCreatedAt))
	case "created_at_desc":
		query = query.Order(ent.Desc(album.FieldCreatedAt))
	case "view_count_desc":
		query = query.Order(ent.Desc(album.FieldViewCount), ent.Desc(album.FieldCreatedAt))
	default:
		query = query.Order(ent.Asc(album.FieldDisplayOrder), ent.Desc(album.FieldCreatedAt))
	}

	// 应用分页
	offset := (opts.Page - 1) * opts.PageSize
	albumPOs, err := query.Limit(opts.PageSize).Offset(offset).All(ctx)
	if err != nil {
		return nil, fmt.Errorf("查询列表失败: %w", err)
	}

	domainAlbums := make([]*model.Album, len(albumPOs))
	for i, po := range albumPOs {
		domainAlbums[i] = toDomainAlbum(po)
	}

	return &repository.PageResult[model.Album]{
		Items: domainAlbums,
		Total: int64(total),
	}, nil
}

func (r *entAlbumRepository) SearchPublicAlbums(ctx context.Context, opts repository.AlbumSearchOptions) (*repository.PageResult[model.Album], error) {
	queryText := strings.TrimSpace(opts.Query)
	if queryText == "" {
		return &repository.PageResult[model.Album]{Items: []*model.Album{}, Total: 0}, nil
	}
	limit := opts.Limit
	if limit <= 0 {
		limit = 10
	}
	if limit > 50 {
		limit = 50
	}

	query := r.client.Album.Query().
		Where(album.Or(
			album.TitleContainsFold(queryText),
			album.DescriptionContainsFold(queryText),
			album.TagsContainsFold(queryText),
			album.LocationContainsFold(queryText),
		))

	total, err := query.Clone().Count(ctx)
	if err != nil {
		return nil, fmt.Errorf("计算相册搜索总数失败: %w", err)
	}
	if total == 0 {
		return &repository.PageResult[model.Album]{Items: []*model.Album{}, Total: 0}, nil
	}

	albumPOs, err := query.
		Order(ent.Asc(album.FieldDisplayOrder), ent.Desc(album.FieldCreatedAt)).
		Limit(limit).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("搜索相册失败: %w", err)
	}

	domainAlbums := make([]*model.Album, len(albumPOs))
	for i, po := range albumPOs {
		domainAlbums[i] = toDomainAlbum(po)
	}

	return &repository.PageResult[model.Album]{
		Items: domainAlbums,
		Total: int64(total),
	}, nil
}

func (r *entAlbumRepository) FindByID(ctx context.Context, id uint) (*model.Album, error) {
	albumPO, err := r.client.Album.Query().Where(album.ID(id)).Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, nil
		}
		return nil, err
	}
	return toDomainAlbum(albumPO), nil
}

func (r *entAlbumRepository) Delete(ctx context.Context, id uint) error {
	return r.client.Album.DeleteOneID(id).Exec(ctx)
}

func (r *entAlbumRepository) IncrementViewCount(ctx context.Context, id uint) error {
	_, err := r.client.Album.UpdateOneID(id).AddViewCount(1).Save(ctx)
	return err
}

func (r *entAlbumRepository) IncrementDownloadCount(ctx context.Context, id uint) error {
	_, err := r.client.Album.UpdateOneID(id).AddDownloadCount(1).Save(ctx)
	return err
}

func (r *entAlbumRepository) BatchDelete(ctx context.Context, ids []uint) (int, error) {
	deleted, err := r.client.Album.Delete().Where(album.IDIn(ids...)).Exec(ctx)
	return deleted, err
}

// toDomainAlbum 将 *ent.Album 转换为 *model.Album.
func toDomainAlbum(po *ent.Album) *model.Album {
	if po == nil {
		return nil
	}

	bigImageUrl := po.BigImageURL
	if bigImageUrl == "" {
		bigImageUrl = po.ImageURL
	}
	downloadUrl := po.DownloadURL
	if downloadUrl == "" {
		downloadUrl = po.ImageURL
	}

	// 处理 CategoryID：将 uint 转换为 *uint
	var categoryID *uint
	if po.CategoryID != 0 {
		categoryID = &po.CategoryID
	}

	return &model.Album{
		ID:            po.ID,
		CategoryID:    categoryID,
		CreatedAt:     po.CreatedAt,
		UpdatedAt:     po.UpdatedAt,
		ImageUrl:      po.ImageURL,
		BigImageUrl:   bigImageUrl,
		DownloadUrl:   downloadUrl,
		ThumbParam:    po.ThumbParam,
		BigParam:      po.BigParam,
		Tags:          po.Tags,
		ViewCount:     po.ViewCount,
		DownloadCount: po.DownloadCount,
		Width:         po.Width,
		Height:        po.Height,
		FileSize:      po.FileSize,
		Format:        po.Format,
		AspectRatio:   po.AspectRatio,
		FileHash:      po.FileHash,
		DisplayOrder:  po.DisplayOrder,
		Title:         po.Title,
		Description:   po.Description,
		Location:      po.Location,
		PublishedAt:   po.PublishedAt,
	}
}
