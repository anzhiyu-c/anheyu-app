import { render } from "@testing-library/react";
import { CommentItem } from "./CommentItem";
import type { Comment } from "@/lib/api/comment";

const baseComment = (overrides: Partial<Comment>): Comment => ({
  id: "base",
  created_at: "2024-01-01T00:00:00Z",
  nickname: "Base",
  email_md5: "md5",
  content_html: "<p>content</p>",
  is_admin_comment: false,
  is_anonymous: false,
  target_path: "/post/hello",
  like_count: 0,
  total_children: 0,
  pinned_at: null,
  ...overrides,
});

const config = {
  gravatarUrl: "https://cravatar.cn/",
  defaultGravatarType: "mp",
  masterTag: "博主",
  showRegion: false,
  showUA: false,
};

const formConfig = {
  limitLength: 1000,
  loginRequired: false,
  anonymousEmail: "",
  allowImageUpload: false,
};

describe("CommentItem", () => {
  it("加载更多子评论时保持链头顺序稳定", () => {
    const childA = baseComment({
      id: "a",
      nickname: "A",
      created_at: "2024-01-02T00:00:00Z",
      reply_to_id: "root",
      parent_id: "root",
    });
    const childB = baseComment({
      id: "b",
      nickname: "B",
      created_at: "2024-01-01T00:00:00Z",
      reply_to_id: "root",
      parent_id: "root",
    });

    const root = baseComment({
      id: "root",
      nickname: "Root",
      children: [childA, childB],
      total_children: 2,
    });

    const { container, rerender } = render(
      <CommentItem
        comment={root}
        config={config}
        formConfig={formConfig}
        targetPath="/post/hello"
        pageSize={10}
        rootId="root"
        activeReplyId={null}
        replyTarget={null}
        likedIds={new Set()}
        isLoadingChildren={false}
        onReply={() => undefined}
        onCancelReply={() => undefined}
        onSubmitted={() => undefined}
        onToggleLike={() => undefined}
        onLoadMoreChildren={() => undefined}
      />
    );

    const readOrder = () =>
      Array.from(container.querySelectorAll("button"))
        .map(button => button.textContent?.trim())
        .filter(text => text === "A" || text === "B");

    expect(readOrder()).toEqual(["A", "B"]);

    const extraReplies = Array.from({ length: 5 }).map((_, index) =>
      baseComment({
        id: `b-${index}`,
        nickname: `B${index}`,
        created_at: `2024-01-03T00:00:0${index}Z`,
        reply_to_id: "b",
        parent_id: "root",
      })
    );

    const updatedRoot = {
      ...root,
      children: [childA, childB, ...extraReplies],
      total_children: 7,
    };

    rerender(
      <CommentItem
        comment={updatedRoot}
        config={config}
        formConfig={formConfig}
        targetPath="/post/hello"
        pageSize={10}
        rootId="root"
        activeReplyId={null}
        replyTarget={null}
        likedIds={new Set()}
        isLoadingChildren={false}
        onReply={() => undefined}
        onCancelReply={() => undefined}
        onSubmitted={() => undefined}
        onToggleLike={() => undefined}
        onLoadMoreChildren={() => undefined}
      />
    );

    expect(readOrder()).toEqual(["A", "B"]);
  });
});
