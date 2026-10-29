import { memo } from "react";
import { NodeProps } from "@xyflow/react";
import type { CommentNode as CommentFlowNode } from "@/types";
import { COMMENT_CONFIG } from "@/constants";
import { cn } from "@/lib/utils";
import { useDiagramStore } from "@/store/diagramStore";
import {
  ChatBubbleBottomCenterTextIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";

export const CommentNode = memo(
  ({ data: commentData, selected, id }: NodeProps<CommentFlowNode>) => {
    const { updateNodeData } = useDiagramStore();
    const isMinimized = commentData.minimized || false;
    const color = commentData.color || "yellow";
    const colorConfig = COMMENT_CONFIG.colors[color];

    // Format timestamp if available
    const formattedDate = commentData.createdAt
      ? new Date(commentData.createdAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : null;

    const handleToggleMinimize = () => {
      updateNodeData(id, { minimized: !isMinimized });
    };

    return (
      <div
        data-node-id={id}
        className={cn(
          "rounded-lg border-2 shadow-lg transition-all backdrop-blur-sm min-w-[200px] max-w-[300px]",
          colorConfig.bg,
          colorConfig.border,
          selected && "ring-2 ring-zinc-400 dark:ring-zinc-500 ring-offset-2",
        )}
      >
        {/* Header */}
        <div className={cn("flex items-center gap-2 px-3 py-2 border-b", colorConfig.border)}>
          <div className={cn("p-1 rounded", colorConfig.iconBg)}>
            <ChatBubbleBottomCenterTextIcon className="w-3 h-3 text-zinc-700 dark:text-zinc-300" />
          </div>
          <span className="text-[10px] font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide flex-1">
            Comment
          </span>
          <button
            type="button"
            onClick={handleToggleMinimize}
            className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
            title={isMinimized ? "Expand comment" : "Minimize comment"}
          >
            {isMinimized ? (
              <ChevronDownIcon className="w-4 h-4" />
            ) : (
              <ChevronUpIcon className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Content */}
        {!isMinimized && (
          <div className="p-3">
            <div className={cn("text-sm whitespace-pre-wrap break-words", colorConfig.text)}>
              {commentData.text || "Add your note here..."}
            </div>

            {/* Footer with metadata */}
            {(commentData.author || formattedDate) && (
              <div className="mt-3 pt-2 border-t border-zinc-200 dark:border-zinc-700 flex items-center gap-2 text-[10px] text-zinc-500 dark:text-zinc-400">
                {commentData.author && <span>{commentData.author}</span>}
                {commentData.author && formattedDate && <span>•</span>}
                {formattedDate && <span>{formattedDate}</span>}
              </div>
            )}
          </div>
        )}

        {/* Minimized state */}
        {isMinimized && (
          <div className="px-3 py-2">
            <div className={cn("text-xs truncate", colorConfig.text)}>
              {commentData.text || "Comment"}
            </div>
          </div>
        )}

        {/* No handles - comments don't connect to anything */}
      </div>
    );
  },
);

CommentNode.displayName = "CommentNode";
