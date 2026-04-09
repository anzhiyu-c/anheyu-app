import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi } from "vitest";
import { CommentForm } from "./CommentForm";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
};

describe("CommentForm", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("为匿名用户的昵称/邮箱/网址提供可访问的 label 和 name", () => {
    render(
      <CommentForm
        targetPath="/post/hello"
        pageSize={10}
        config={{
          limitLength: 1000,
          loginRequired: false,
          anonymousEmail: "",
          allowImageUpload: false,
        }}
      />,
      { wrapper: createWrapper() }
    );

    const nicknameInput = screen.getByLabelText("昵称");
    const emailInput = screen.getByLabelText("邮箱");
    const websiteInput = screen.getByLabelText("网址");

    expect(nicknameInput).toHaveAttribute("name", "nickname");
    expect(emailInput).toHaveAttribute("name", "email");
    expect(websiteInput).toHaveAttribute("name", "website");
  });

  it("表情按钮支持键盘并暴露 aria 状态", async () => {
    const emojiPayload = {
      '<span title="默认"></span>': {
        type: "emoji",
        container: [{ icon: '<img src="https://example.com/1.png">', text: "smile" }],
      },
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => emojiPayload,
      }))
    );

    const user = userEvent.setup();
    render(
      <CommentForm
        targetPath="/post/hello"
        pageSize={10}
        config={{
          limitLength: 1000,
          loginRequired: false,
          anonymousEmail: "",
          allowImageUpload: false,
          emojiCdn: "https://example.com/emoji.json",
        }}
      />,
      { wrapper: createWrapper() }
    );

    const toggle = await screen.findByRole("button", { name: "打开表情面板" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    toggle.focus();
    await user.keyboard("{Enter}");
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    const controlsId = toggle.getAttribute("aria-controls");
    expect(controlsId).toBeTruthy();
    expect(document.getElementById(controlsId as string)).toBeInTheDocument();
  });
});
