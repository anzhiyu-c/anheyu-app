"use client";

import Image from "next/image";
import { Chip, Tooltip, Button } from "@heroui/react";
import { motion } from "framer-motion";
import { ExternalLink, CheckCircle, XCircle, Edit, Trash2 } from "lucide-react";
import type { LinkItem, LinkStatus } from "@/types/friends";

const STATUS_CONFIG: Record<LinkStatus, { label: string; color: "success" | "warning" | "danger" | "default" }> = {
  APPROVED: { label: "已通过", color: "success" },
  PENDING: { label: "待审核", color: "warning" },
  REJECTED: { label: "已拒绝", color: "danger" },
  INVALID: { label: "已失效", color: "default" },
};

interface FriendsCardViewProps {
  links: LinkItem[];
  onEdit: (item: LinkItem) => void;
  onDelete: (item: LinkItem) => void;
  onReview: (item: LinkItem, action: "APPROVED" | "REJECTED") => void;
}

export function FriendsCardView({ links, onEdit, onDelete, onReview }: FriendsCardViewProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {links.map((link, index) => {
        const statusCfg = STATUS_CONFIG[link.status];
        return (
          <motion.div
            key={link.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.03 }}
            className="group bg-card border border-border/50 rounded-xl p-4 hover:shadow-lg hover:border-primary/30 transition-all"
          >
            <div className="flex items-start gap-3">
              {link.logo ? (
                <Image
                  src={link.logo}
                  alt={link.name}
                  width={48}
                  height={48}
                  className="w-12 h-12 rounded-full object-cover border border-border/60 shrink-0"
                  unoptimized
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-linear-to-br from-primary/20 to-primary/40 flex items-center justify-center text-primary font-semibold text-lg shrink-0">
                  {link.name[0]}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold truncate text-sm">{link.name}</h3>
                  <Chip size="sm" variant="flat" color={statusCfg.color} className="text-[10px] h-5">
                    {statusCfg.label}
                  </Chip>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{link.description || "暂无描述"}</p>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-0.5 mt-1"
                >
                  {link.url}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {(link.category || link.tag) && (
              <div className="flex items-center gap-1.5 mt-2.5">
                {link.category && (
                  <Chip size="sm" variant="flat" color="primary" className="text-[10px] h-5">
                    {link.category.name}
                  </Chip>
                )}
                {link.tag && (
                  <Chip
                    size="sm"
                    variant="flat"
                    className="text-[10px] h-5"
                    startContent={
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: link.tag.color || "#999" }} />
                    }
                  >
                    {link.tag.name}
                  </Chip>
                )}
              </div>
            )}

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
              <span className="text-xs text-muted-foreground">排序: {link.sort_order}</span>
              <div className="flex items-center gap-1">
                {link.status === "PENDING" && (
                  <>
                    <Tooltip content="通过">
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        color="success"
                        onPress={() => onReview(link, "APPROVED")}
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                      </Button>
                    </Tooltip>
                    <Tooltip content="拒绝">
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        color="danger"
                        onPress={() => onReview(link, "REJECTED")}
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </Button>
                    </Tooltip>
                  </>
                )}
                <Tooltip content="编辑">
                  <Button isIconOnly size="sm" variant="light" onPress={() => onEdit(link)}>
                    <Edit className="w-3.5 h-3.5" />
                  </Button>
                </Tooltip>
                <Tooltip content="删除">
                  <Button isIconOnly size="sm" variant="light" color="danger" onPress={() => onDelete(link)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </Tooltip>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
