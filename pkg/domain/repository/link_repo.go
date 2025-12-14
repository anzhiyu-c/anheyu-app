/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-08-18 15:09:15
 * @LastEditTime: 2025-08-18 18:17:05
 * @LastEditors: 安知鱼
 */
package repository

import (
	"context"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

type LinkRepository interface {
	Create(ctx context.Context, req *model.ApplyLinkRequest, categoryID int) (*model.LinkDTO, error)
	List(ctx context.Context, req *model.ListLinksRequest) ([]*model.LinkDTO, int, error)
	ListPublic(ctx context.Context, req *model.ListPublicLinksRequest) ([]*model.LinkDTO, int, error)
	UpdateStatus(ctx context.Context, id int, status string, siteshot *string) error
	GetByID(ctx context.Context, id int) (*model.LinkDTO, error)
	Update(ctx context.Context, id int, req *model.AdminUpdateLinkRequest) (*model.LinkDTO, error)
	Delete(ctx context.Context, id int) error
	AdminCreate(ctx context.Context, req *model.AdminCreateLinkRequest) (*model.LinkDTO, error)
	GetRandomPublic(ctx context.Context, num int) ([]*model.LinkDTO, error)
	// 为导入功能添加的方法
	ExistsByURL(ctx context.Context, url string) (bool, error)
	GetByURL(ctx context.Context, url string) (*model.LinkDTO, error)
	// 为友链健康检查添加的方法
	GetAllApprovedLinks(ctx context.Context) ([]*model.LinkDTO, error)
	GetAllInvalidLinks(ctx context.Context) ([]*model.LinkDTO, error)
	BatchUpdateStatus(ctx context.Context, linkIDs []int, status string) error
	// 批量更新友链排序
	BatchUpdateSortOrder(ctx context.Context, items []model.LinkSortItem) error
	// 获取所有友链申请（公开接口）
	ListAllApplications(ctx context.Context, req *model.ListPublicLinksRequest) ([]*model.LinkDTO, int, error)
}
