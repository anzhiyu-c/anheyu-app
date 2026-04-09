import { afterEach, describe, expect, it } from "vitest";
import { useSiteConfigStore } from "./site-config-store";

const resetState = {
  siteConfig: {},
  isLoaded: false,
  loading: false,
  error: null,
};

describe("site-config-store userPanelConfig", () => {
  afterEach(() => {
    useSiteConfigStore.setState(resetState);
  });

  it("从嵌套 userpanel 配置读取用户面板开关", () => {
    useSiteConfigStore.setState({
      siteConfig: {
        userpanel: {
          show_user_center: "false",
          show_notifications: "true",
          show_publish_article: false,
          show_admin_dashboard: true,
        },
      },
    });

    expect(useSiteConfigStore.getState().userPanelConfig()).toEqual({
      showUserCenter: false,
      showNotifications: true,
      showPublishArticle: false,
      showAdminDashboard: true,
    });
  });
});
