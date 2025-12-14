package page

import (
	"context"
	"fmt"
	"strings"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
)

// Service 页面服务接口
type Service interface {
	// Create 创建页面
	Create(ctx context.Context, options *model.CreatePageOptions) (*model.Page, error)

	// GetByID 根据ID获取页面
	GetByID(ctx context.Context, id string) (*model.Page, error)

	// GetByPath 根据路径获取页面
	GetByPath(ctx context.Context, path string) (*model.Page, error)

	// List 列出页面
	List(ctx context.Context, options *model.ListPagesOptions) ([]*model.Page, int, error)

	// Update 更新页面
	Update(ctx context.Context, id string, options *model.UpdatePageOptions) (*model.Page, error)

	// Delete 删除页面
	Delete(ctx context.Context, id string) error

	// InitializeDefaultPages 初始化默认页面
	InitializeDefaultPages(ctx context.Context) error
}

// service 页面服务实现
type service struct {
	pageRepo repository.PageRepository
}

// NewService 创建页面服务
func NewService(pageRepo repository.PageRepository) Service {
	return &service{
		pageRepo: pageRepo,
	}
}

// Create 创建页面
func (s *service) Create(ctx context.Context, options *model.CreatePageOptions) (*model.Page, error) {
	// 验证路径格式
	if err := s.validatePath(options.Path); err != nil {
		return nil, err
	}

	// 检查路径是否已存在
	exists, err := s.pageRepo.ExistsByPath(ctx, options.Path, "")
	if err != nil {
		return nil, fmt.Errorf("检查路径是否存在失败: %w", err)
	}
	if exists {
		return nil, fmt.Errorf("路径 %s 已存在", options.Path)
	}

	// 创建页面
	page, err := s.pageRepo.Create(ctx, options)
	if err != nil {
		return nil, fmt.Errorf("创建页面失败: %w", err)
	}

	return page, nil
}

// GetByID 根据ID获取页面
func (s *service) GetByID(ctx context.Context, id string) (*model.Page, error) {
	page, err := s.pageRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("获取页面失败: %w", err)
	}
	return page, nil
}

// GetByPath 根据路径获取页面
func (s *service) GetByPath(ctx context.Context, path string) (*model.Page, error) {
	page, err := s.pageRepo.GetByPath(ctx, path)
	if err != nil {
		return nil, fmt.Errorf("获取页面失败: %w", err)
	}
	return page, nil
}

// List 列出页面
func (s *service) List(ctx context.Context, options *model.ListPagesOptions) ([]*model.Page, int, error) {
	pages, total, err := s.pageRepo.List(ctx, options)
	if err != nil {
		return nil, 0, fmt.Errorf("获取页面列表失败: %w", err)
	}
	return pages, total, nil
}

// Update 更新页面
func (s *service) Update(ctx context.Context, id string, options *model.UpdatePageOptions) (*model.Page, error) {
	// 获取当前页面
	currentPage, err := s.pageRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("获取页面失败: %w", err)
	}

	// 如果修改了路径，检查新路径是否已存在
	if options.Path != nil && *options.Path != currentPage.Path {
		if err := s.validatePath(*options.Path); err != nil {
			return nil, err
		}

		exists, err := s.pageRepo.ExistsByPath(ctx, *options.Path, id)
		if err != nil {
			return nil, fmt.Errorf("检查路径是否存在失败: %w", err)
		}
		if exists {
			return nil, fmt.Errorf("路径 %s 已存在", *options.Path)
		}
	}

	// 更新页面
	page, err := s.pageRepo.Update(ctx, id, options)
	if err != nil {
		return nil, fmt.Errorf("更新页面失败: %w", err)
	}

	return page, nil
}

// Delete 删除页面
func (s *service) Delete(ctx context.Context, id string) error {
	// 删除页面
	if err := s.pageRepo.Delete(ctx, id); err != nil {
		return fmt.Errorf("删除页面失败: %w", err)
	}

	return nil
}

// InitializeDefaultPages 初始化默认页面
func (s *service) InitializeDefaultPages(ctx context.Context) error {
	defaultPages := []*model.CreatePageOptions{
		{
			Title: "隐私政策",
			Path:  "/privacy",
			MarkdownContent: `# 隐私政策

本站非常重视用户的隐私和个人信息保护。你在使用网站时，可能会收集和使用你的相关信息。通过《隐私政策》向你说明在你访问 ` + "`blog.anheyu.com`" + ` 网站时，如何收集、使用、保存、共享和转让这些信息。

## 最新更新时间

协议最新更新时间为：2025-10-04

## 一、在访问时如何收集和使用你的个人信息

### 在访问时，收集访问信息的服务会收集不限于以下信息：

**网络身份标识信息**（浏览器 UA、IP 地址）

**设备信息**

**浏览过程**（操作方式、浏览方式与时长、性能与网络加载情况）。

### 在访问时，本站内置的第三方服务会通过以下或更多途径，来获取你的以下或更多信息：

- **腾讯云** 会收集你的访问信息 <a href="https://www.tencentcloud.com/zh/document/product/301/17345" target="_blank" rel="noopener noreferrer">腾讯云隐私政策</a>
- **阿里 cdn（iconfont）** 会收集你的访问信息 <a href="https://terms.alicdn.com/legal-agreement/terms/suit_bu1_ali_mama_division/suit_bu1_ali_mama_division202108270850_24757.html?spm=a313x.home_2025.i7.2.58a33a81yB9jAv" target="_blank" rel="noopener noreferrer">阿里iconfont隐私政策</a>
- **网易云 音乐** 会收集你的访问信息 <a href="https://terms.alicdn.com/legal-agreement/terms/suit_bu1_ali_mama_division/suit_bu1_ali_mama_division202108270850_24757.html?spm=a313x.home_2025.i7.2.58a33a81yB9jAv" target="_blank" rel="noopener noreferrer">网易云音乐隐私政策</a>

### 在访问时，本人仅会处于以下目的，使用你的个人信息：

- 用于网站的优化与文章分类，用户优化文章
- 恶意访问识别，用于维护网站
- 恶意攻击排查，用于维护网站
- 网站点击情况监测，用于优化网站页面
- 网站加载情况监测，用于优化网站性能
- 用于网站搜索结果优化
- 浏览数据的展示

### 第三方信息获取方将您的数据用于以下用途：

第三方可能会用于其他目的，详情请访问对应第三方服务提供的隐私协议。

### 你应该知道在你访问的时候不限于以下信息会被第三方获取并使用：

此页面获取地址信息展示使用的是 <a href="https://v1.nsuuu.com/" target="_blank" rel="noopener noreferrer">NSUUU</a> 提供的API。

第三方部分为了抵抗攻击、使用不同节点 cdn 加速等需求会收集不限于以下信息

<table>
  <thead>
    <tr>
      <th>类型<div style="width:100px"></div></th>
      <th>信息</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td colspan="2"><b>网络信息</b></td>
    </tr>
    <tr>
      <td>IP地址</td>
      <td><div id="userAgentIp">加载中...</div></td>
    </tr>
    <tr>
      <td>国家</td>
      <td><div id="userAgentCountry">加载中...</div></td>
    </tr>
    <tr>
      <td>省份</td>
      <td><div id="userAgentRegion">加载中...</div></td>
    </tr>
    <tr>
      <td>城市</td>
      <td><div id="userAgentCity">加载中...</div></td>
    </tr>
    <tr>
      <td>运营商</td>
      <td><div id="userAgentIsp">加载中...</div></td>
    </tr>
    <tr>
      <td colspan="2"><b>设备信息</b></td>
    </tr>
    <tr>
      <td>设备</td>
      <td><div id="userAgentDevice">加载中...</div></td>
    </tr>
  </tbody>
</table>

<div style="color: var(--anzhiyu-gray);font-size: 14px;">
此页面如果未能获取到信息并不代表无法读取上述信息，以实际情况为准。
    </div>

<script>
// 获取IP信息
function getIpInfo() {
  console.log('开始获取IP信息...');
  
  // 设置设备信息
  var deviceElement = document.getElementById('userAgentDevice');
  if (deviceElement) {
    deviceElement.innerHTML = navigator.userAgent;
  }
  
  // 请求IP地理位置信息 - 使用 NSUUU API
  // 请将下面的 YOUR_API_KEY 替换为您在 https://v1.nsuuu.com 获取的 API Key
  // 如果未配置有效的 Key，IP 信息将无法正常获取
  var fetchUrl = 'https://v1.nsuuu.com/api/ipip?key=YOUR_API_KEY';
  
  fetch(fetchUrl)
    .then(function(res) {
      console.log('收到响应，状态:', res.status);
      return res.json();
    })
    .then(function(json) {
      console.log('API返回数据:', json);
      
      if (json.code === 200 && json.data) {
        // 根据新的API返回格式填充数据
        document.getElementById('userAgentIp').innerHTML = json.ip || json.data.ip || '未知';
        document.getElementById('userAgentCountry').innerHTML = json.data.country || '未知';
        document.getElementById('userAgentRegion').innerHTML = json.data.province || '未知';
        document.getElementById('userAgentCity').innerHTML = json.data.city || '未知';
        document.getElementById('userAgentIsp').innerHTML = json.data.isp || '未知';
        
        console.log('所有信息已填充完成');
      } else {
        console.error('API返回错误:', json.msg || '未知错误');
        showError('获取失败: ' + (json.msg || '未知错误'));
      }
    })
    .catch(function(error) {
      console.error('请求失败:', error);
      showError('请求失败: ' + error.message);
    });
}

// 显示错误信息
function showError(msg) {
  var ids = ['userAgentIp', 'userAgentCountry', 'userAgentRegion', 
             'userAgentCity', 'userAgentIsp'];
  ids.forEach(function(id) {
    var element = document.getElementById(id);
    if (element) {
      element.innerHTML = msg;
      element.style.color = 'var(--anzhiyu-red)';
    }
  });
}

// 执行获取信息
getIpInfo();
</script>

## 二、在评论时如何收集和使用你的个人信息

评论使用的是无登陆系统的匿名评论系统，你可以自愿填写真实的、或者虚假的信息作为你评论的展示信息。

` + "`鼓励你使用不易被人恶意识别的昵称进行评论`，但是建议你填写`真实的邮箱`" + `以便收到回复（邮箱信息不会被公开）。

在你评论时，会额外收集你的个人信息。

### 在评论时，本站内置的第三方服务会通过以下或更多途径，来获取你的相关信息：

- ` + "`cravatar`" + ` 会收集你的访问信息、评论填写的个人信息用于展示头像

### 在访问时，本人仅会处于以下目的，收集并使用以下信息：

- 评论时会记录你的 QQ 帐号（如果在邮箱位置填写 QQ 邮箱或 QQ 号），方便获取你的 QQ 头像。如果使用 QQ 邮箱但不想展示 QQ 头像，可以填写不含 QQ 号的 QQ 邮箱。（主动，存储）
- 评论时会记录你的邮箱，当我回复后会通过邮件通知你（主动，存储，不会公开邮箱）
- 评论时会记录你的网址，用于点击头像时快速进入你的网站（主动，存储）
- 评论时会记录你的 IP 地址，作为反垃圾的用户判别依据（被动，存储，不会公开 IP，会公开 IP 所在城市）
- 评论会记录你的浏览器代理，用作展示系统版本、浏览器版本方便展示你使用的设备，快速定位问题（被动，存储）

## 三、如何使用 Cookies 和本地 LocalStorage 存储

本站为实现无账号评论、深色模式切换，不蒜子的 uv 统计等功能，会在你的浏览器中进行本地存储，你可以随时清除浏览器中保存的所有 Cookies 以及 LocalStorage，不影响你的正常使用。

本博客中的以下业务会在你的计算机上主动存储数据：

` + "`内置服务`" + `

- 评论系统
- 中控台
- 胶囊音乐

关于如何使用你的 Cookies，请访问 [Cookies 政策](/cookies/)。

关于如何<a target="_blank" rel="noopener external nofollow" href="https://support.google.com/chrome/answer/95647?co=GENIE.Platform=Desktop&amp;hl=zh-Hans">在 Chrome 中清除、启用和管理 Cookie</a>。

## 四、如何共享、转让你的个人信息

本人不会与任何公司、组织和个人共享你的隐私信息

本人不会将你的个人信息转让给任何公司、组织和个人

第三方服务的共享、转让情况详见对应服务的隐私协议

## 五、附属协议

当监测到存在恶意访问、恶意请求、恶意攻击、恶意评论的行为时，为了防止增大受害范围，可能会临时将你的 ip 地址及访问信息短期内添加到黑名单，短期内禁止访问。

此黑名单可能被公开，并共享给其他站点（主体并非本人）使用，包括但不限于：IP 地址、设备信息、地理位置。`,
			Content:     `<h1 data-line="0" id="隐私政策">隐私政策</h1> <p data-line="2">本站非常重视用户的隐私和个人信息保护。你在使用网站时，可能会收集和使用你的相关信息。通过《隐私政策》向你说明在你访问 <code>blog.anheyu.com</code> 网站时，如何收集、使用、保存、共享和转让这些信息。</p> <h2 data-line="4" id="最新更新时间">最新更新时间</h2> <p data-line="6">协议最新更新时间为：2025-10-04</p> <h2 data-line="8" id="一、在访问时如何收集和使用你的个人信息">一、在访问时如何收集和使用你的个人信息</h2> <h3 data-line="10" id="在访问时，收集访问信息的服务会收集不限于以下信息：">在访问时，收集访问信息的服务会收集不限于以下信息：</h3> <p data-line="12"><strong>网络身份标识信息</strong>（浏览器 UA、IP 地址）</p> <p data-line="14"><strong>设备信息</strong></p> <p data-line="16"><strong>浏览过程</strong>（操作方式、浏览方式与时长、性能与网络加载情况）。</p> <h3 data-line="18" id="在访问时，本站内置的第三方服务会通过以下或更多途径，来获取你的以下或更多信息：">在访问时，本站内置的第三方服务会通过以下或更多途径，来获取你的以下或更多信息：</h3> <ul data-line="20"> <li data-line="20"><strong>腾讯云</strong> 会收集你的访问信息 <a href="https://www.tencentcloud.com/zh/document/product/301/17345" target="_blank" rel="noopener noreferrer">腾讯云隐私政策</a></li> <li data-line="21"><strong>阿里 cdn（iconfont）</strong> 会收集你的访问信息 <a href="https://terms.alicdn.com/legal-agreement/terms/suit_bu1_ali_mama_division/suit_bu1_ali_mama_division202108270850_24757.html?spm=a313x.home_2025.i7.2.58a33a81yB9jAv" target="_blank" rel="noopener noreferrer">阿里iconfont隐私政策</a></li> <li data-line="22"><strong>网易云 音乐</strong> 会收集你的访问信息 <a href="https://terms.alicdn.com/legal-agreement/terms/suit_bu1_ali_mama_division/suit_bu1_ali_mama_division202108270850_24757.html?spm=a313x.home_2025.i7.2.58a33a81yB9jAv" target="_blank" rel="noopener noreferrer">网易云音乐隐私政策</a></li> </ul> <h3 data-line="24" id="在访问时，本人仅会处于以下目的，使用你的个人信息：">在访问时，本人仅会处于以下目的，使用你的个人信息：</h3> <ul data-line="26"> <li data-line="26">用于网站的优化与文章分类，用户优化文章</li> <li data-line="27">恶意访问识别，用于维护网站</li> <li data-line="28">恶意攻击排查，用于维护网站</li> <li data-line="29">网站点击情况监测，用于优化网站页面</li> <li data-line="30">网站加载情况监测，用于优化网站性能</li> <li data-line="31">用于网站搜索结果优化</li> <li data-line="32">浏览数据的展示</li> </ul> <h3 data-line="34" id="第三方信息获取方将您的数据用于以下用途：">第三方信息获取方将您的数据用于以下用途：</h3> <p data-line="36">第三方可能会用于其他目的，详情请访问对应第三方服务提供的隐私协议。</p> <h3 data-line="38" id="你应该知道在你访问的时候不限于以下信息会被第三方获取并使用：">你应该知道在你访问的时候不限于以下信息会被第三方获取并使用：</h3> <p data-line="40">此页面获取地址信息展示使用的是 <a href="https://v1.nsuuu.com/" target="_blank" rel="noopener noreferrer">NSUUU</a> 提供的API。</p> <p data-line="42">第三方部分为了抵抗攻击、使用不同节点 cdn 加速等需求会收集不限于以下信息</p> <div class="table-container"><table> <thead> <tr> <th>类型<div style="width:100px"></div></th> <th>信息</th> </tr> </thead> <tbody> <tr> <td colspan="2"><b>网络信息</b></td> </tr> <tr> <td>IP地址</td> <td><div id="userAgentIp">加载中...</div></td> </tr> <tr> <td>国家</td> <td><div id="userAgentCountry">加载中...</div></td> </tr> <tr> <td>省份</td> <td><div id="userAgentRegion">加载中...</div></td> </tr> <tr> <td>城市</td> <td><div id="userAgentCity">加载中...</div></td> </tr> <tr> <td>运营商</td> <td><div id="userAgentIsp">加载中...</div></td> </tr> <tr> <td colspan="2"><b>设备信息</b></td> </tr> <tr> <td>设备</td> <td><div id="userAgentDevice">加载中...</div></td> </tr> </tbody> </table></div> <div style="color: var(--anzhiyu-gray);font-size: 14px;"> 此页面如果未能获取到信息并不代表无法读取上述信息，以实际情况为准。 </div> <script> // 获取IP信息 function getIpInfo() { console.log('开始获取IP信息...'); // 设置设备信息 var deviceElement = document.getElementById('userAgentDevice'); if (deviceElement) { deviceElement.innerHTML = navigator.userAgent; } // 请求IP地理位置信息 - 使用 NSUUU API // 请将 YOUR_API_KEY 替换为您在 https://v1.nsuuu.com 获取的 API Key var fetchUrl = 'https://v1.nsuuu.com/api/ipip?key=YOUR_API_KEY'; fetch(fetchUrl) .then(function(res) { console.log('收到响应，状态:', res.status); return res.json(); }) .then(function(json) { console.log('API返回数据:', json); if (json.code === 200 && json.data) { // 根据新的API返回格式填充数据 document.getElementById('userAgentIp').innerHTML = json.ip || json.data.ip || '未知'; document.getElementById('userAgentCountry').innerHTML = json.data.country || '未知'; document.getElementById('userAgentRegion').innerHTML = json.data.province || '未知'; document.getElementById('userAgentCity').innerHTML = json.data.city || '未知'; document.getElementById('userAgentIsp').innerHTML = json.data.isp || '未知'; console.log('所有信息已填充完成'); } else { console.error('API返回错误:', json.msg || '未知错误'); showError('获取失败: ' + (json.msg || '未知错误')); } }) .catch(function(error) { console.error('请求失败:', error); showError('请求失败: ' + error.message); }); } // 显示错误信息 function showError(msg) { var ids = ['userAgentIp', 'userAgentCountry', 'userAgentRegion', 'userAgentCity', 'userAgentIsp']; ids.forEach(function(id) { var element = document.getElementById(id); if (element) { element.innerHTML = msg; element.style.color = 'var(--anzhiyu-red)'; } }); } // 执行获取信息 getIpInfo(); </script> <h2 data-line="148" id="二、在评论时如何收集和使用你的个人信息">二、在评论时如何收集和使用你的个人信息</h2> <p data-line="150">评论使用的是无登陆系统的匿名评论系统，你可以自愿填写真实的、或者虚假的信息作为你评论的展示信息。</p> <p data-line="152"><code>鼓励你使用不易被人恶意识别的昵称进行评论</code>，但是建议你填写<code>真实的邮箱</code>以便收到回复（邮箱信息不会被公开）。</p> <p data-line="154">在你评论时，会额外收集你的个人信息。</p> <h3 data-line="156" id="在评论时，本站内置的第三方服务会通过以下或更多途径，来获取你的相关信息：">在评论时，本站内置的第三方服务会通过以下或更多途径，来获取你的相关信息：</h3> <ul data-line="158"> <li data-line="158"><code>cravatar</code> 会收集你的访问信息、评论填写的个人信息用于展示头像</li> </ul> <h3 data-line="160" id="在访问时，本人仅会处于以下目的，收集并使用以下信息：">在访问时，本人仅会处于以下目的，收集并使用以下信息：</h3> <ul data-line="162"> <li data-line="162">评论时会记录你的 QQ 帐号（如果在邮箱位置填写 QQ 邮箱或 QQ 号），方便获取你的 QQ 头像。如果使用 QQ 邮箱但不想展示 QQ 头像，可以填写不含 QQ 号的 QQ 邮箱。（主动，存储）</li> <li data-line="163">评论时会记录你的邮箱，当我回复后会通过邮件通知你（主动，存储，不会公开邮箱）</li> <li data-line="164">评论时会记录你的网址，用于点击头像时快速进入你的网站（主动，存储）</li> <li data-line="165">评论时会记录你的 IP 地址，作为反垃圾的用户判别依据（被动，存储，不会公开 IP，会公开 IP 所在城市）</li> <li data-line="166">评论会记录你的浏览器代理，用作展示系统版本、浏览器版本方便展示你使用的设备，快速定位问题（被动，存储）</li> </ul> <h2 data-line="168" id="三、如何使用 Cookies 和本地 LocalStorage 存储">三、如何使用 Cookies 和本地 LocalStorage 存储</h2> <p data-line="170">本站为实现无账号评论、深色模式切换，不蒜子的 uv 统计等功能，会在你的浏览器中进行本地存储，你可以随时清除浏览器中保存的所有 Cookies 以及 LocalStorage，不影响你的正常使用。</p> <p data-line="172">本博客中的以下业务会在你的计算机上主动存储数据：</p> <p data-line="174"><code>内置服务</code></p> <ul data-line="176"> <li data-line="176">评论系统</li> <li data-line="177">中控台</li> <li data-line="178">胶囊音乐</li> </ul> <p data-line="180">关于如何使用你的 Cookies，请访问 <a href="/cookies/">Cookies 政策</a>。</p> <p data-line="182">关于如何<a target="_blank" rel="noopener external nofollow" href="https://support.google.com/chrome/answer/95647?co=GENIE.Platform=Desktop&amp;hl=zh-Hans">在 Chrome 中清除、启用和管理 Cookie</a>。</p> <h2 data-line="184" id="四、如何共享、转让你的个人信息">四、如何共享、转让你的个人信息</h2> <p data-line="186">本人不会与任何公司、组织和个人共享你的隐私信息</p> <p data-line="188">本人不会将你的个人信息转让给任何公司、组织和个人</p> <p data-line="190">第三方服务的共享、转让情况详见对应服务的隐私协议</p> <h2 data-line="192" id="五、附属协议">五、附属协议</h2> <p data-line="194">当监测到存在恶意访问、恶意请求、恶意攻击、恶意评论的行为时，为了防止增大受害范围，可能会临时将你的 ip 地址及访问信息短期内添加到黑名单，短期内禁止访问。</p> <p data-line="196">此黑名单可能被公开，并共享给其他站点（主体并非本人）使用，包括但不限于：IP 地址、设备信息、地理位置。</p>`,
			Description: "本站的隐私政策说明",
			IsPublished: true,
			Sort:        1,
		},
		{
			Title: "Cookie 政策",
			Path:  "/cookies",
			MarkdownContent: `# Cookie 政策

## 更新日期

本政策的最近更新日期为：2025-10-04

为了确保网站和我开发的软件的可靠性、安全性和个性化，我使用 Cookies。当你接受 Cookies 时，这有助于通过识别你的身份、记住你的偏好或提供个性化用户体验来帮助我改善网站。

本政策应与我的[隐私政策](/privacy/)一起阅读，该隐私政策解释了我如何使用个人信息。

如果你对我使用你的个人信息或 Cookies 的方式有任何疑问，请通过 ` + "`anzhiyu-c@qq.com`" + ` 与我联系。

如果你想管理你的 Cookies，请按照下面"如何管理 Cookies"部分中的说明进行操作。

## 什么是 Cookies？

Cookies 是一种小型文本文件，当你访问网站时，网站可能会将这些文件放在你的计算机或设备上。Cookies 会帮助网站或其他网站在你下次访问时识别你的设备。网站信标、像素或其他类似文件也可以做同样的事情。我在此政策中使用术语"Cookies"来指代以这种方式收集信息的所有文件。

Cookies 提供许多功能。例如，他们可以帮助我记住你喜欢深色模式还是浅色模式，分析我网站的效果。

大多数网站使用 Cookies 来收集和保留有关其访问者的个人信息。大多数 Cookies 收集一般信息，例如访问者如何到达和使用我的网站，他们使用的设备，他们的互联网协议地址（IP 地址），他们正在查看的页面及其大致位置（例如，我将能够认识到你正在从长沙访问我的网站）。

## Cookies 的目的

我将 Cookies 分为以下类别:

| 用途                 |                                                                                         说明                                                                                          |
| :------------------- | :-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: |
| 授权                 | 你访问我的网站时，我可通过 Cookie 提供正确信息，为你打造个性化的体验。例如：Cookie 会告知你通过搜索引擎搜索的具体内容来改善文章的标题优化关键词、或者创建更符合你搜索需求的文章内容。 |
| 安全措施             |                                                我通过 Cookie 启用及支持安全功能，监控和防止可疑活动、欺诈性流量和违反版权协议的行为。                                                 |
| 偏好、功能和服务     |                                                  我使用功能性 Cookies 来让我记住你的偏好，或保存你向我提供的有关你的喜好或其他信息。                                                  |
| 个性化广告           |                                                                           本站涉及 GoogleADS 个性化广告服务                                                                           |
| 网站性能、分析和研究 |                                           我使用这些 cookie 来监控网站性能。这使我能够通过快速识别和解决出现的任何问题来提供高质量的体验。                                            |

## 我的网站上的第三方 Cookies

我还在我的网站上使用属于上述类别的第三方 Cookies，用于以下目的：

- 帮助我监控网站上的流量；
- 识别欺诈或非人为性流量；
- 协助市场调研；
- 改善网站功能；
- 监督我的版权协议和隐私政策的遵守情况。

## 如何管理 Cookies？

在将 Cookie 放置在你的计算机或设备上之前，系统会显示一个弹出窗口，要求你同意设置这些 Cookie。通过同意放置 Cookies，你可以让我为你提供最佳的体验和服务。如果你愿意，你可以通过浏览器设置关闭本站的 Cookie 来拒绝同意放置 Cookies；但是，我网站的部分功能可能无法完全或按预期运行。你有机会允许和/或拒绝使用 Cookie。你可以通过访问浏览器设置随时返回到你的 Cookie 偏好设置以查看和/或删除它们。

除了我提供的控件之外，你还可以选择在 Internet 浏览器中启用或禁用 Cookie。大多数互联网浏览器还允许你选择是要禁用所有 Cookie 还是仅禁用第三方 Cookie。默认情况下，大多数互联网浏览器都接受 Cookie，但这可以更改。有关详细信息，请参阅 Internet 浏览器中的帮助菜单或设备随附的文档。

以下链接提供了有关如何在所有主流浏览器中控制 Cookie 的说明：

[Google Chrome](https://support.google.com/chrome/answer/95647?hl=en)
[IE](https://support.microsoft.com/en-us/help/260971/description-of-cookies)
[Safari（mac 桌面版）](https://support.apple.com/guide/safari/manage-cookies-and-website-data-sfri11471/mac)
[Safari（移动版）](https://support.apple.com/en-us/HT201265)
[火狐浏览器](https://support.mozilla.org/en-US/kb/Cookies-information-websites-store-on-your-computer)
[Android 浏览器](http://support.google.com/ics/nexus/bin/answer.py?hl=en&answer=2425067)

如你使用其他浏览器，请参阅浏览器制造商提供的文档。
有关 Cookies 以及如何管理 Cookies 的更多信息，请访问：

[wikipedia.org](https://zh.wikipedia.org/wiki/Cookie) 、 [allaboutCookies.org](https://www.allaboutcookies.org/) 或 [aboutCookies.org](https://www.aboutcookies.org)

## 更多信息

有关我数据处理的更多信息，请参阅我的[隐私政策](/privacy/)。如果你对此 Cookie 政策有任何疑问，请通过` + "`anzhiyu-c@qq.com`" + `与我联系。

## 对此 Cookie 政策的更改

我可能对此 Cookie 政策所做的任何更改都将发布在此页面上。如果更改很重要，我会在我的主页或应用上明确指出该政策已更新。`,
			Content:     `<h2 data-line="1" id="更新日期">更新日期</h2> <p data-line="3">本政策的最近更新日期为：2025-10-04</p> <p data-line="5">为了确保网站和我开发的软件的可靠性、安全性和个性化，我使用 Cookies。当你接受 Cookies 时，这有助于通过识别你的身份、记住你的偏好或提供个性化用户体验来帮助我改善网站。</p> <p data-line="7">本政策应与我的<a href="/privacy/">隐私政策</a>一起阅读，该隐私政策解释了我如何使用个人信息。</p> <p data-line="9">如果你对我使用你的个人信息或 Cookies 的方式有任何疑问，请通过 <code>anzhiyu-c@qq.com</code> 与我联系。</p> <p data-line="11">如果你想管理你的 Cookies，请按照下面"如何管理 Cookies"部分中的说明进行操作。</p> <h2 data-line="13" id="什么是 Cookies？">什么是 Cookies？</h2> <p data-line="15">Cookies 是一种小型文本文件，当你访问网站时，网站可能会将这些文件放在你的计算机或设备上。Cookies 会帮助网站或其他网站在你下次访问时识别你的设备。网站信标、像素或其他类似文件也可以做同样的事情。我在此政策中使用术语"Cookies"来指代以这种方式收集信息的所有文件。</p> <p data-line="17">Cookies 提供许多功能。例如，他们可以帮助我记住你喜欢深色模式还是浅色模式，分析我网站的效果。</p> <p data-line="19">大多数网站使用 Cookies 来收集和保留有关其访问者的个人信息。大多数 Cookies 收集一般信息，例如访问者如何到达和使用我的网站，他们使用的设备，他们的互联网协议地址（IP 地址），他们正在查看的页面及其大致位置（例如，我将能够认识到你正在从长沙访问我的网站）。</p> <h2 data-line="21" id="Cookies 的目的">Cookies 的目的</h2> <p data-line="23">我将 Cookies 分为以下类别:</p> <div class="table-container"><table data-line="25"> <thead data-line="25"> <tr data-line="25"> <th style="text-align:left">用途</th> <th style="text-align:center">说明</th> </tr> </thead> <tbody data-line="27"> <tr data-line="27"> <td style="text-align:left">授权</td> <td style="text-align:center">你访问我的网站时，我可通过 Cookie 提供正确信息，为你打造个性化的体验。例如：Cookie 会告知你通过搜索引擎搜索的具体内容来改善文章的标题优化关键词、或者创建更符合你搜索需求的文章内容。</td> </tr> <tr data-line="28"> <td style="text-align:left">安全措施</td> <td style="text-align:center">我通过 Cookie 启用及支持安全功能，监控和防止可疑活动、欺诈性流量和违反版权协议的行为。</td> </tr> <tr data-line="29"> <td style="text-align:left">偏好、功能和服务</td> <td style="text-align:center">我使用功能性 Cookies 来让我记住你的偏好，或保存你向我提供的有关你的喜好或其他信息。</td> </tr> <tr data-line="30"> <td style="text-align:left">个性化广告</td> <td style="text-align:center">本站涉及 GoogleADS 个性化广告服务</td> </tr> <tr data-line="31"> <td style="text-align:left">网站性能、分析和研究</td> <td style="text-align:center">我使用这些 cookie 来监控网站性能。这使我能够通过快速识别和解决出现的任何问题来提供高质量的体验。</td> </tr> </tbody> </table></div> <h2 data-line="33" id="我的网站上的第三方 Cookies">我的网站上的第三方 Cookies</h2> <p data-line="35">我还在我的网站上使用属于上述类别的第三方 Cookies，用于以下目的：</p> <ul data-line="37"> <li data-line="37">帮助我监控网站上的流量；</li> <li data-line="38">识别欺诈或非人为性流量；</li> <li data-line="39">协助市场调研；</li> <li data-line="40">改善网站功能；</li> <li data-line="41">监督我的版权协议和隐私政策的遵守情况。</li> </ul> <h2 data-line="43" id="如何管理 Cookies？">如何管理 Cookies？</h2> <p data-line="45">在将 Cookie 放置在你的计算机或设备上之前，系统会显示一个弹出窗口，要求你同意设置这些 Cookie。通过同意放置 Cookies，你可以让我为你提供最佳的体验和服务。如果你愿意，你可以通过浏览器设置关闭本站的 Cookie 来拒绝同意放置 Cookies；但是，我网站的部分功能可能无法完全或按预期运行。你有机会允许和/或拒绝使用 Cookie。你可以通过访问浏览器设置随时返回到你的 Cookie 偏好设置以查看和/或删除它们。</p> <p data-line="47">除了我提供的控件之外，你还可以选择在 Internet 浏览器中启用或禁用 Cookie。大多数互联网浏览器还允许你选择是要禁用所有 Cookie 还是仅禁用第三方 Cookie。默认情况下，大多数互联网浏览器都接受 Cookie，但这可以更改。有关详细信息，请参阅 Internet 浏览器中的帮助菜单或设备随附的文档。</p> <p data-line="49">以下链接提供了有关如何在所有主流浏览器中控制 Cookie 的说明：</p> <p data-line="51"><a href="https://support.google.com/chrome/answer/95647?hl=en">Google Chrome</a><br> <a href="https://support.microsoft.com/en-us/help/260971/description-of-cookies">IE</a><br> <a href="https://support.apple.com/guide/safari/manage-cookies-and-website-data-sfri11471/mac">Safari（mac 桌面版）</a><br> <a href="https://support.apple.com/en-us/HT201265">Safari（移动版）</a><br> <a href="https://support.mozilla.org/en-US/kb/Cookies-information-websites-store-on-your-computer">火狐浏览器</a><br> <a href="http://support.google.com/ics/nexus/bin/answer.py?hl=en&amp;answer=2425067">Android 浏览器</a></p> <p data-line="58">如你使用其他浏览器，请参阅浏览器制造商提供的文档。<br> 有关 Cookies 以及如何管理 Cookies 的更多信息，请访问：</p> <p data-line="61"><a href="https://zh.wikipedia.org/wiki/Cookie">wikipedia.org</a> 、 <a href="https://www.allaboutcookies.org/">allaboutCookies.org</a> 或 <a href="https://www.aboutcookies.org">aboutCookies.org</a></p> <h2 data-line="63" id="更多信息">更多信息</h2> <p data-line="65">有关我数据处理的更多信息，请参阅我的<a href="/privacy/">隐私政策</a>。如果你对此 Cookie 政策有任何疑问，请通过<code>anzhiyu-c@qq.com</code>与我联系。</p> <h2 data-line="67" id="对此 Cookie 政策的更改">对此 Cookie 政策的更改</h2> <p data-line="69">我可能对此 Cookie 政策所做的任何更改都将发布在此页面上。如果更改很重要，我会在我的主页或应用上明确指出该政策已更新。</p>`,
			Description: "本站的 Cookie 使用政策",
			IsPublished: true,
			Sort:        2,
		},
		{
			Title: "版权声明",
			Path:  "/copyright",
			MarkdownContent: `# 版权声明

为了保持文章质量，并保持互联网的开放共享精神，保持页面流量的稳定，综合考虑下本站的所有原创文章均采用 cc 协议中比较严格的[署名-非商业性使用-禁止演绎 4.0 国际标准](https://creativecommons.org/licenses/by-nc-nd/4.0/deed.zh)。这篇文章主要想能够更加清楚明白的介绍本站的协议标准和要求。方便你合理的使用本站的文章。

本站无广告嵌入和商业行为。违反协议的行为不仅会损害原作者的创作热情，而且会影响整个版权环境。强烈呼吁你能够在转载时遵守协议。遵守协议的行为几乎不会对你的目标产生负面影响，鼓励创作环境是每个创作者的期望。

## 哪些文章适于本协议？

所有原创内容均在文章标题顶部，以及文章结尾的版权说明部分展示。

原创内容的非商用转载必须为完整转载且标注出处的` + "`带有完整 url 链接`或`访问原文`" + `之类字样的超链接。

作为参考资料的情况可以无需完整转载，摘录所需要的部分内容即可，但需标注出处。

## 你可以做什么？

只要你遵守本页的许可，你可以自由地共享文章的内容 — 在任何媒介以任何形式复制、发行本作品。并且无需通知作者。

## 你需要遵守什么样的许可？

### 署名

你必须标注内容的来源，你需要在文章开头部分（或者明显位置）标注原文章链接（建议使用超链接提升阅读体验）。

### 禁止商用

本站内容免费向互联网所有用户提供，分享本站文章时禁止商业性使用、禁止在转载页面中插入广告（例如谷歌广告、百度广告）、禁止阅读的拦截行为（例如关注公众号、下载 App 后观看文章）。

### 禁止演绎

- 分享全部内容（无修改）
  你需要在文章开头部分（或者明显位置）标注原文章链接（建议使用超链接）

- 分享部分截取内容或者衍生创作
  目前本站全部原创文章的衍生品禁止公开分享和分发。如有更好的修改建议，可以在对应文章下留言。如有衍生创作需求，可以在评论中联系。

- 作为参考资料截取部分内容
  作为参考资料的情况可以无需完整转载，摘录所需要的部分内容即可，但需标注出处。

## 什么内容会被版权保护

包括但不限于：

- 文章封面图片
- 文章标题和正文
- 站点图片素材（不含主题自带素材）

## 例外情况

本着友好互相进步的原则，被本站友链收录的博客允许博客文章内容的衍生品的分享和分发，但仍需标注出处。

本着互联网开放精神，你可以在博客文章下方留言要求授权博文的衍生品的分享和分发，标注你的网站地址。

关于主题样式的版权信息，可以详见 [安和鱼应用说明](/update/)

## 网站源代码协议

网站源代码（仅包含 css、js）的代码部分采用 GPL 协议。`,
			Content:     `<p data-line="1">为了保持文章质量，并保持互联网的开放共享精神，保持页面流量的稳定，综合考虑下本站的所有原创文章均采用 cc 协议中比较严格的<a href="https://creativecommons.org/licenses/by-nc-nd/4.0/deed.zh">署名-非商业性使用-禁止演绎 4.0 国际标准</a>。这篇文章主要想能够更加清楚明白的介绍本站的协议标准和要求。方便你合理的使用本站的文章。</p> <p data-line="3">本站无广告嵌入和商业行为。违反协议的行为不仅会损害原作者的创作热情，而且会影响整个版权环境。强烈呼吁你能够在转载时遵守协议。遵守协议的行为几乎不会对你的目标产生负面影响，鼓励创作环境是每个创作者的期望。</p> <h2 data-line="5" id="哪些文章适于本协议？">哪些文章适于本协议？</h2> <p data-line="7">所有原创内容均在文章标题顶部，以及文章结尾的版权说明部分展示。</p> <p data-line="9">原创内容的非商用转载必须为完整转载且标注出处的<code>带有完整 url 链接</code>或<code>访问原文</code>之类字样的超链接。</p> <p data-line="11">作为参考资料的情况可以无需完整转载，摘录所需要的部分内容即可，但需标注出处。</p> <h2 data-line="13" id="你可以做什么？">你可以做什么？</h2> <p data-line="15">只要你遵守本页的许可，你可以自由地共享文章的内容 — 在任何媒介以任何形式复制、发行本作品。并且无需通知作者。</p> <h2 data-line="17" id="你需要遵守什么样的许可？">你需要遵守什么样的许可？</h2> <h3 data-line="19" id="署名">署名</h3> <p data-line="21">你必须标注内容的来源，你需要在文章开头部分（或者明显位置）标注原文章链接（建议使用超链接提升阅读体验）。</p> <h3 data-line="23" id="禁止商用">禁止商用</h3> <p data-line="25">本站内容免费向互联网所有用户提供，分享本站文章时禁止商业性使用、禁止在转载页面中插入广告（例如谷歌广告、百度广告）、禁止阅读的拦截行为（例如关注公众号、下载 App 后观看文章）。</p> <h3 data-line="27" id="禁止演绎">禁止演绎</h3> <ul data-line="29"> <li data-line="29"> <p data-line="29">分享全部内容（无修改）<br> 你需要在文章开头部分（或者明显位置）标注原文章链接（建议使用超链接）</p> </li> <li data-line="32"> <p data-line="32">分享部分截取内容或者衍生创作<br> 目前本站全部原创文章的衍生品禁止公开分享和分发。如有更好的修改建议，可以在对应文章下留言。如有衍生创作需求，可以在评论中联系。</p> </li> <li data-line="35"> <p data-line="35">作为参考资料截取部分内容<br> 作为参考资料的情况可以无需完整转载，摘录所需要的部分内容即可，但需标注出处。</p> </li> </ul> <h2 data-line="38" id="什么内容会被版权保护">什么内容会被版权保护</h2> <p data-line="40">包括但不限于：</p> <ul data-line="42"> <li data-line="42">文章封面图片</li> <li data-line="43">文章标题和正文</li> <li data-line="44">站点图片素材（不含主题自带素材）</li> </ul> <h2 data-line="46" id="例外情况">例外情况</h2> <p data-line="48">本着友好互相进步的原则，被本站友链收录的博客允许博客文章内容的衍生品的分享和分发，但仍需标注出处。</p> <p data-line="50">本着互联网开放精神，你可以在博客文章下方留言要求授权博文的衍生品的分享和分发，标注你的网站地址。</p> <p data-line="52">关于主题样式的版权信息，可以详见 <a href="/update/">安和鱼应用说明</a></p> <h2 data-line="54" id="网站源代码协议">网站源代码协议</h2> <p data-line="56">网站源代码（仅包含 css、js）的代码部分采用 GPL 协议。</p>`,
			Description: "本站的版权声明",
			IsPublished: true,
			Sort:        3,
		},
	}

	for _, pageOptions := range defaultPages {
		// 检查页面是否已存在
		existingPage, err := s.pageRepo.GetByPath(ctx, pageOptions.Path)
		if err == nil && existingPage != nil {
			// 页面已存在，跳过
			continue
		}

		// 创建默认页面
		_, err = s.pageRepo.Create(ctx, pageOptions)
		if err != nil {
			return fmt.Errorf("创建默认页面 %s 失败: %w", pageOptions.Title, err)
		}
	}

	return nil
}

// validatePath 验证路径格式
func (s *service) validatePath(path string) error {
	if path == "" {
		return fmt.Errorf("路径不能为空")
	}

	if !strings.HasPrefix(path, "/") {
		return fmt.Errorf("路径必须以 / 开头")
	}

	if strings.Contains(path, " ") {
		return fmt.Errorf("路径不能包含空格")
	}

	// 检查是否包含特殊字符
	for _, char := range []string{"<", ">", "\"", "'", "&", "?", "#", "=", "+", ";"} {
		if strings.Contains(path, char) {
			return fmt.Errorf("路径不能包含特殊字符: %s", char)
		}
	}

	return nil
}
