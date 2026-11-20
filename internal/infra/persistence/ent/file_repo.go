package ent

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	"github.com/anzhiyu-c/anheyu-app/internal/pkg/types"
	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"

	"github.com/anzhiyu-c/anheyu-app/ent"
	"github.com/anzhiyu-c/anheyu-app/ent/file"
	"github.com/anzhiyu-c/anheyu-app/ent/privacy"
)

type entFileRepository struct {
	client *ent.Client
	db     *sql.DB
	dbType string
}

func NewEntFileRepository(client *ent.Client, db *sql.DB, dbType string) repository.FileRepository {
	return &entFileRepository{
		client: client,
		db:     db,
		dbType: dbType,
	}
}

// --- 基础 CRUD ---

func (r *entFileRepository) Create(ctx context.Context, domainFile *model.File) error {
	createBuilder := r.client.File.
		Create().
		SetType(int(domainFile.Type)).
		SetOwnerID(domainFile.OwnerID).
		SetName(domainFile.Name).
		SetSize(domainFile.Size).
		SetChildrenCount(domainFile.ChildrenCount)

	if domainFile.ParentID.Valid {
		createBuilder.SetParentID(uint(domainFile.ParentID.Int64))
	}
	if domainFile.PrimaryEntityID.Valid {
		createBuilder.SetPrimaryEntityID(uint(domainFile.PrimaryEntityID.Uint64))
	}
	if domainFile.ViewConfig.Valid {
		createBuilder.SetViewConfig(domainFile.ViewConfig.String)
	}

	created, err := createBuilder.Save(ctx)
	if err != nil {
		return err
	}
	domainFile.ID = created.ID
	domainFile.CreatedAt = created.CreatedAt
	domainFile.UpdatedAt = created.UpdatedAt
	return nil
}

func (r *entFileRepository) Update(ctx context.Context, domainFile *model.File) error {
	updateBuilder := r.client.File.
		UpdateOneID(domainFile.ID).
		SetType(int(domainFile.Type)).
		SetName(domainFile.Name).
		SetSize(domainFile.Size).
		SetChildrenCount(domainFile.ChildrenCount)

	if domainFile.ParentID.Valid {
		updateBuilder.SetParentID(uint(domainFile.ParentID.Int64))
	} else {
		updateBuilder.ClearParentID()
	}
	if domainFile.PrimaryEntityID.Valid {
		updateBuilder.SetPrimaryEntityID(uint(domainFile.PrimaryEntityID.Uint64))
	} else {
		updateBuilder.ClearPrimaryEntityID()
	}
	if domainFile.ViewConfig.Valid {
		updateBuilder.SetViewConfig(domainFile.ViewConfig.String)
	} else {
		updateBuilder.ClearViewConfig()
	}

	_, err := updateBuilder.Save(ctx)
	return err
}

func (r *entFileRepository) Delete(ctx context.Context, id uint) error {
	return r.client.File.DeleteOneID(id).Exec(ctx)
}

func (r *entFileRepository) SoftDelete(ctx context.Context, id uint) error {
	now := time.Now()
	return r.client.File.UpdateOneID(id).SetDeletedAt(now).Exec(ctx)
}

func (r *entFileRepository) HardDelete(ctx context.Context, id uint) error {
	allowCtx := privacy.DecisionContext(ctx, privacy.Allow)
	return r.client.File.DeleteOneID(id).Exec(allowCtx)
}

func (r *entFileRepository) FindByID(ctx context.Context, id uint) (*model.File, error) {
	entFile, err := r.client.File.Query().
		Where(
			file.ID(id),
			file.DeletedAtIsNil(), // 过滤掉已软删除的文件
		).
		WithPrimaryEntity().
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, constant.ErrNotFound
		}
		return nil, err
	}
	return toDomainFile(entFile), nil
}

func (r *entFileRepository) FindBatchByIDs(ctx context.Context, ids []uint) ([]*model.File, error) {
	if len(ids) == 0 {
		return []*model.File{}, nil
	}
	entFiles, err := r.client.File.Query().Where(file.IDIn(ids...)).All(ctx)
	if err != nil {
		return nil, err
	}
	domainFiles := make([]*model.File, len(entFiles))
	for i, f := range entFiles {
		domainFiles[i] = toDomainFile(f)
	}
	return domainFiles, nil
}

func (r *entFileRepository) FindByParentIDAndName(ctx context.Context, parentID uint, name string) (*model.File, error) {
	query := r.client.File.Query().
		Where(file.Name(name)).
		WithPrimaryEntity()

	if parentID == 0 {
		query = query.Where(file.ParentIDIsNil())
	} else {
		query = query.Where(file.ParentID(parentID))
	}

	entFile, err := query.Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, constant.ErrNotFound
		}
		return nil, err
	}
	return toDomainFile(entFile), nil
}

// --- 复杂查询和操作 ---

func (r *entFileRepository) FindByPath(ctx context.Context, ownerID uint, path string) (*model.File, error) {
	currentItem, err := r.client.File.Query().
		Where(
			file.OwnerID(ownerID),
			file.ParentIDIsNil(),
			file.Name(""),         // 根目录的名称必须为空字符串
			file.DeletedAtIsNil(), // 过滤掉已软删除的文件
		).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, constant.ErrNotFound
		}
		return nil, err
	}

	normalizedPath := strings.Trim(path, "/")
	if normalizedPath == "" || normalizedPath == "." {
		return toDomainFile(currentItem), nil
	}

	pathSegments := strings.Split(normalizedPath, "/")
	for _, segment := range pathSegments {
		nextItem, err := r.client.File.Query().
			Where(
				file.OwnerID(ownerID),
				file.ParentID(currentItem.ID),
				file.Name(segment),
				file.DeletedAtIsNil(), // 过滤掉已软删除的文件
			).
			WithPrimaryEntity().
			Only(ctx)
		if err != nil {
			if ent.IsNotFound(err) {
				return nil, constant.ErrNotFound
			}
			return nil, err
		}
		currentItem = nextItem
	}
	return toDomainFile(currentItem), nil
}

// FindAncestors 使用原生SQL递归查询，根据注入的数据库方言动态选择正确的占位符，
// 以查找一个文件或文件夹的所有祖先节点（父、父的父，依此类推）。
func (r *entFileRepository) FindAncestors(ctx context.Context, fileID uint) ([]*model.File, error) {
	var ancestors []*ent.File
	var rawQuery string

	// 根据在创建 repository 时注入的数据库方言，选择正确的SQL查询语句
	switch r.dbType {
	case "postgres":
		// PostgreSQL 使用 $1, $2, ... 作为参数占位符
		rawQuery = `
			WITH RECURSIVE ancestors (id, created_at, updated_at, deleted_at, type, owner_id, parent_id, name, size, primary_entity_id, children_count, view_config) AS (
			  SELECT id, created_at, updated_at, deleted_at, type, owner_id, parent_id, name, size, primary_entity_id, children_count, view_config
			  FROM files
			  WHERE id = $1
			  UNION ALL
			  SELECT f.id, f.created_at, f.updated_at, f.deleted_at, f.type, f.owner_id, f.parent_id, f.name, f.size, f.primary_entity_id, f.children_count, f.view_config
			  FROM files f JOIN ancestors a ON f.id = a.parent_id
			)
			SELECT * FROM ancestors;
		`
	case "mysql", "sqlite", "sqlite3":
		// MySQL 和 SQLite 使用 ? 作为参数占位符
		// 注意: MySQL 8.0+ 和 SQLite 3.8.3+ 才支持 WITH RECURSIVE
		rawQuery = `
			WITH RECURSIVE ancestors (id, created_at, updated_at, deleted_at, type, owner_id, parent_id, name, size, primary_entity_id, children_count, view_config) AS (
			  SELECT id, created_at, updated_at, deleted_at, type, owner_id, parent_id, name, size, primary_entity_id, children_count, view_config
			  FROM files
			  WHERE id = ?
			  UNION ALL
			  SELECT f.id, f.created_at, f.updated_at, f.deleted_at, f.type, f.owner_id, f.parent_id, f.name, f.size, f.primary_entity_id, f.children_count, f.view_config
			  FROM files f JOIN ancestors a ON f.id = a.parent_id
			)
			SELECT * FROM ancestors;
		`
	default:
		// 如果遇到不支持的数据库类型，返回错误
		return nil, fmt.Errorf("FindAncestors: 不支持的数据库方言: %s", r.dbType)
	}

	// 执行原生SQL查询
	rows, err := r.db.QueryContext(ctx, rawQuery, fileID)
	if err != nil {
		return nil, fmt.Errorf("执行递归查询失败: %w", err)
	}
	defer rows.Close()

	// 遍历查询结果并手动扫描到 ent.File 结构体中
	for rows.Next() {
		var f ent.File
		// 必须准备好接收所有可能的 NULL 值的变量
		var parentID, primaryEntityID sql.NullInt64
		var viewConfig sql.NullString
		var deletedAt sql.NullTime

		// 确保 Scan 的字段顺序和数量与 SELECT * 严格对应
		if err := rows.Scan(
			&f.ID, &f.CreatedAt, &f.UpdatedAt, &deletedAt, &f.Type, &f.OwnerID,
			&parentID, &f.Name, &f.Size, &primaryEntityID, &f.ChildrenCount, &viewConfig,
		); err != nil {
			return nil, fmt.Errorf("扫描祖先节点数据失败: %w", err)
		}

		// 将可能为 NULL 的值赋给 ent.File 的指针字段
		if parentID.Valid {
			pid := uint(parentID.Int64)
			f.ParentID = &pid
		}
		if primaryEntityID.Valid {
			peid := uint(primaryEntityID.Int64)
			f.PrimaryEntityID = &peid
		}
		if viewConfig.Valid {
			f.ViewConfig = &viewConfig.String
		}
		if deletedAt.Valid {
			f.DeletedAt = &deletedAt.Time
		}

		ancestors = append(ancestors, &f)
	}

	// 检查遍历过程中是否发生错误
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("遍历查询结果时出错: %w", err)
	}

	if len(ancestors) == 0 {
		return nil, constant.ErrNotFound
	}

	domainFiles := make([]*model.File, len(ancestors))
	for i, p := range ancestors {
		domainFiles[i] = toDomainFile(p)
	}

	return domainFiles, nil
}

func (r *entFileRepository) ListByParentIDWithCursor(
	ctx context.Context, parentID uint, orderBy string, direction string,
	limit int, token *repository.PaginationToken,
) ([]*model.File, error) {
	query := r.client.File.Query()

	if parentID == 0 {
		query = query.Where(
			file.ParentIDIsNil(),
			file.DeletedAtIsNil(), // 过滤掉已软删除的文件
		)
	} else {
		query = query.Where(
			file.ParentID(parentID),
			file.DeletedAtIsNil(), // 过滤掉已软删除的文件
		)
	}

	isDesc := strings.ToLower(direction) == "desc"
	query = query.Order(ent.Desc(file.FieldType))
	if isDesc {
		query = query.Order(ent.Desc(orderBy))
	} else {
		query = query.Order(ent.Asc(orderBy))
	}
	query = query.Order(ent.Asc(file.FieldID))

	if token != nil {
		query = query.Where(file.IDGT(token.LastID))
	}

	entFiles, err := query.Limit(limit).All(ctx)
	if err != nil {
		return nil, err
	}

	domainFiles := make([]*model.File, len(entFiles))
	for i, p := range entFiles {
		domainFiles[i] = toDomainFile(p)
	}
	return domainFiles, nil
}

// FindOrCreateDirectory 尝试查找一个目录，如果不存在则创建它。
func (r *entFileRepository) FindOrCreateDirectory(ctx context.Context, parentID uint, name string, ownerID uint) (*model.File, error) {
	// 1. 构建基础查询条件
	baseQuery := r.client.File.Query().
		Where(
			file.OwnerID(ownerID),
			file.Name(name),
		)
	if parentID == 0 {
		baseQuery.Where(file.ParentIDIsNil())
	} else {
		baseQuery.Where(file.ParentID(parentID))
	}

	// 2. 优先查找未软删除的目录
	existing, err := baseQuery.Where(file.DeletedAtIsNil()).Only(ctx)

	// 如果找到了未软删除的目录，直接返回
	if err == nil {
		return toDomainFile(existing), nil
	}

	// 如果不是 "Not Found" 错误，说明有多个未软删除的记录（数据异常）
	if !ent.IsNotFound(err) {
		return nil, fmt.Errorf("查找目录时出错（可能存在重复记录）: %w", err)
	}

	// 3. 未找到未软删除的记录，尝试查找软删除的记录
	allowCtx := privacy.DecisionContext(ctx, privacy.Allow)
	existing, err = baseQuery.Only(allowCtx)

	// 如果发生未知错误（不是 "Not Found"），则直接返回错误
	if err != nil && !ent.IsNotFound(err) {
		return nil, fmt.Errorf("查找目录时出错: %w", err)
	}

	// 4. 根据查找结果进行处理
	if existing != nil {
		// 如果找到的是软删除的目录，则恢复它
		if existing.DeletedAt != nil {
			log.Printf("[Repo] INFO: 目录 '%s' (ID: %d) 被软删除，正在恢复...", name, existing.ID)
			updated, err := r.client.File.UpdateOne(existing).ClearDeletedAt().Save(ctx)
			if err != nil {
				return nil, fmt.Errorf("恢复软删除目录失败: %w", err)
			}
			return toDomainFile(updated), nil
		}
		// 正常情况下不应该走到这里（因为前面已经查找过未软删除的记录）
		return toDomainFile(existing), nil
	}

	// 5. 如果目录完全不存在，则创建新的
	createBuilder := r.client.File.Create().
		SetOwnerID(ownerID).
		SetName(name).
		SetType(int(model.FileTypeDir))

	if parentID != 0 {
		createBuilder.SetParentID(parentID)
	}

	created, err := createBuilder.Save(ctx)
	if err != nil {
		return nil, fmt.Errorf("创建新目录失败: %w", err)
	}

	return toDomainFile(created), nil
}
func toDomainFile(f *ent.File) *model.File {
	if f == nil {
		return nil
	}
	domainFile := &model.File{
		ID:            f.ID,
		CreatedAt:     f.CreatedAt,
		UpdatedAt:     f.UpdatedAt,
		OwnerID:       f.OwnerID,
		Name:          f.Name,
		Size:          f.Size,
		Type:          model.FileType(f.Type),
		ChildrenCount: f.ChildrenCount,
		Metas:         make(map[string]string),
	}

	if f.ParentID != nil {
		domainFile.ParentID = sql.NullInt64{Int64: int64(*f.ParentID), Valid: true}
	}
	if f.PrimaryEntityID != nil {
		domainFile.PrimaryEntityID = types.NullUint64{Uint64: uint64(*f.PrimaryEntityID), Valid: true}
	}
	if f.ViewConfig != nil {
		domainFile.ViewConfig = sql.NullString{String: *f.ViewConfig, Valid: true}
	}

	if f.Edges.PrimaryEntity != nil {
		domainFile.PrimaryEntity = toDomainEntity(f.Edges.PrimaryEntity)
	}

	return domainFile
}

func (r *entFileRepository) FindOrCreateRootDirectory(ctx context.Context, ownerID uint) (*model.File, error) {
	return r.FindOrCreateDirectory(ctx, 0, "", ownerID)
}

// CreateOrUpdate 实现了“创建/更新/恢复”的原子性操作。
// 它会根据文件是否存在以及是否被软删除，返回不同的 CreationStatus。
func (r *entFileRepository) CreateOrUpdate(ctx context.Context, domainFile *model.File) (*model.File, repository.CreationStatus, error) {
	var parentID uint = 0
	if domainFile.ParentID.Valid {
		parentID = uint(domainFile.ParentID.Int64)
	}

	// 1. 使用 Allow 策略来查找，以便能找到被软删除的文件
	allowCtx := privacy.DecisionContext(ctx, privacy.Allow)
	existingEntFile, err := r.client.File.Query().
		Where(
			file.OwnerID(domainFile.OwnerID),
			file.ParentID(parentID),
			file.Name(domainFile.Name),
		).Only(allowCtx)

	// a. 如果发生未知错误，直接返回
	if err != nil && !ent.IsNotFound(err) {
		return nil, repository.StatusError, fmt.Errorf("查找现有文件时出错: %w", err)
	}

	// b. 如果文件已存在 (err == nil)
	if err == nil {
		// i. 如果文件是被软删除的，则恢复并更新
		if existingEntFile.DeletedAt != nil {
			updatedFile, updateErr := r.client.File.UpdateOne(existingEntFile).
				ClearDeletedAt(). // 恢复文件
				SetSize(domainFile.Size).
				SetPrimaryEntityID(uint(domainFile.PrimaryEntityID.Uint64)).
				Save(ctx)

			if updateErr != nil {
				return nil, repository.StatusError, fmt.Errorf("恢复并更新文件失败: %w", updateErr)
			}
			return toDomainFile(updatedFile), repository.StatusRestored, nil
		}

		// ii. 如果文件是活动的，则直接更新
		domainFile.ID = existingEntFile.ID
		if updateErr := r.Update(ctx, domainFile); updateErr != nil {
			return nil, repository.StatusError, fmt.Errorf("更新现有文件记录失败: %w", updateErr)
		}

		return domainFile, repository.StatusExisted, nil
	}

	// c. 如果文件不存在 (err is ErrNotFound)，则创建新文件
	if createErr := r.Create(ctx, domainFile); createErr != nil {
		return nil, repository.StatusError, fmt.Errorf("创建新文件记录失败: %w", createErr)
	}

	// 返回新创建的文件和 "Created" 状态
	return domainFile, repository.StatusCreated, nil
}

func (r *entFileRepository) FindByIDUnscoped(ctx context.Context, fileID uint) (*model.File, error) {
	allowCtx := privacy.DecisionContext(ctx, privacy.Allow)
	entFile, err := r.client.File.Query().Where(file.ID(fileID)).Only(allowCtx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, constant.ErrNotFound
		}
		return nil, err
	}
	return toDomainFile(entFile), nil
}

func (r *entFileRepository) Restore(ctx context.Context, fileID uint) error {
	allowCtx := privacy.DecisionContext(ctx, privacy.Allow)
	_, err := r.client.File.UpdateOneID(fileID).ClearDeletedAt().Save(allowCtx)
	return err
}

// rebindPlaceholders 将原生 SQL 中的 ? 占位符转换为当前方言格式。
// 直接通过 *sql.DB 执行的语句不会经过 Ent 的方言适配，PostgreSQL 需要 $1, $2, ...。
func (r *entFileRepository) rebindPlaceholders(query string) string {
	if r.dbType != "postgres" {
		return query
	}
	var builder strings.Builder
	builder.Grow(len(query) + 8)
	index := 0
	for _, ch := range query {
		if ch == '?' {
			index++
			builder.WriteString("$")
			builder.WriteString(strconv.Itoa(index))
			continue
		}
		builder.WriteRune(ch)
	}
	return builder.String()
}

func (r *entFileRepository) IsDescendant(ctx context.Context, ancestorID, potentialDescendantID uint) (bool, error) {
	rawQuery := `
		WITH RECURSIVE descendants (id) AS (
		  SELECT id FROM files WHERE parent_id = ? AND deleted_at IS NULL
		  UNION ALL
		  SELECT f.id FROM files f JOIN descendants d ON f.parent_id = d.id WHERE f.deleted_at IS NULL
		)
		SELECT EXISTS (SELECT 1 FROM descendants WHERE id = ?);
	`
	var exists bool
	err := r.db.QueryRowContext(ctx, r.rebindPlaceholders(rawQuery), ancestorID, potentialDescendantID).Scan(&exists)
	return exists, err
}

func (r *entFileRepository) GetDescendantFileInfo(ctx context.Context, folderID uint) ([]*model.FileInfoTuple, error) {
	var results []*model.FileInfoTuple
	rawQuery := `
		WITH RECURSIVE descendant_files (id, parent_id, type, size, primary_entity_id) AS (
		  SELECT id, parent_id, type, size, primary_entity_id FROM files WHERE parent_id = ? AND deleted_at IS NULL
		  UNION ALL
		  SELECT f.id, f.parent_id, f.type, f.size, f.primary_entity_id FROM files f INNER JOIN descendant_files df ON f.parent_id = df.id WHERE f.deleted_at IS NULL
		)
		SELECT size, primary_entity_id FROM descendant_files WHERE type = 1;
	`
	rows, err := r.db.QueryContext(ctx, r.rebindPlaceholders(rawQuery), folderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var tuple model.FileInfoTuple
		if err := rows.Scan(&tuple.Size, &tuple.PrimaryEntityID); err != nil {
			return nil, err
		}
		results = append(results, &tuple)
	}
	return results, rows.Err()
}

func (r *entFileRepository) ListByParentID(ctx context.Context, parentID uint) ([]*model.File, error) {
	query := r.client.File.Query()
	if parentID == 0 {
		query = query.Where(
			file.ParentIDIsNil(),
			file.DeletedAtIsNil(), // 过滤掉已软删除的文件
		)
	} else {
		query = query.Where(
			file.ParentID(parentID),
			file.DeletedAtIsNil(), // 过滤掉已软删除的文件
		)
	}
	entFiles, err := query.All(ctx)
	if err != nil {
		return nil, err
	}
	domainFiles := make([]*model.File, len(entFiles))
	for i, f := range entFiles {
		domainFiles[i] = toDomainFile(f)
	}
	return domainFiles, nil
}

func (r *entFileRepository) ListByParentIDUnscoped(ctx context.Context, parentID uint) ([]repository.SyncItem, error) {
	allowCtx := privacy.DecisionContext(ctx, privacy.Allow)
	query := r.client.File.Query()
	if parentID == 0 {
		query = query.Where(file.ParentIDIsNil())
	} else {
		query = query.Where(file.ParentID(parentID))
	}
	entFiles, err := query.All(allowCtx)
	if err != nil {
		return nil, err
	}
	syncItems := make([]repository.SyncItem, len(entFiles))
	for i, p := range entFiles {
		syncItems[i] = repository.SyncItem{
			File:      toDomainFile(p),
			IsDeleted: p.DeletedAt != nil,
		}
	}
	return syncItems, nil
}

func (r *entFileRepository) Count(ctx context.Context) (int64, error) {
	c, err := r.client.File.Query().Count(ctx)
	return int64(c), err
}

func (r *entFileRepository) UpdateViewConfig(ctx context.Context, fileID uint, viewConfigJSON string) error {
	_, err := r.client.File.UpdateOneID(fileID).SetViewConfig(viewConfigJSON).Save(ctx)
	return err
}

func (r *entFileRepository) Transaction(ctx context.Context, fn func(repo repository.FileRepository) error) error {
	tx, err := r.client.Tx(ctx)
	if err != nil {
		return err
	}

	txRepo := NewEntFileRepository(tx.Client(), r.db, r.dbType)
	defer func() {
		if v := recover(); v != nil {
			tx.Rollback()
			panic(v)
		}
	}()
	if err := fn(txRepo); err != nil {
		if rerr := tx.Rollback(); rerr != nil {
			err = fmt.Errorf("事务执行失败: %w, 回滚事务也失败: %v", err, rerr)
		}
		return err
	}
	return tx.Commit()
}

func (r *entFileRepository) SoftDeleteByOwnerID(ctx context.Context, ownerID uint) error {
	now := time.Now()
	_, err := r.client.File.Update().
		Where(file.OwnerID(ownerID), file.DeletedAtIsNil()).
		SetDeletedAt(now).
		Save(ctx)
	return err
}
