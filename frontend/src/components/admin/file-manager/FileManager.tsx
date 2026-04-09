"use client";

import { motion, AnimatePresence } from "framer-motion";
import { FileHeader } from "./FileHeader";
import { FileToolbar } from "./FileToolbar";
import { FileBreadcrumb } from "./FileBreadcrumb";
import { FileGridView } from "./FileGridView";
import { FileListView } from "./FileListView";
import { ContextMenu } from "./ContextMenu";
import { SearchOverlay } from "./SearchOverlay";
import { UploadProgress } from "./UploadProgress";
import { FileDetailsPanel } from "./FileDetailsPanel";
import { MoveModal } from "./modals/MoveModal";
import { ShareModal } from "./modals/ShareModal";
import { DirectLinksModal } from "./modals/DirectLinksModal";
import { ImagePreview } from "./previews/ImagePreview";
import { VideoPreview } from "./previews/VideoPreview";
import { TextPreview } from "./previews/TextPreview";
import { PromptDialog } from "./dialogs/PromptDialog";
import { ConfirmDialog } from "./dialogs/ConfirmDialog";
import { useFileManager } from "@/hooks/file-manager/use-file-manager";
import { fadeInUp, gentleSpring, dragOverlayVariants, normalTransition } from "@/lib/motion";
import styles from "./FileManager.module.css";

export function FileManager() {
  const {
    containerRef,
    dragHandlers,
    handleContextMenuTrigger,
    handleContainerClick,
    hasSelection,
    isSingleSelection,
    selectionCountLabel,
    openBlankMenu,
    openSearchFromElement,
    clearSelection,
    onActionRename,
    onActionDelete,
    onActionDownload,
    onActionShare,
    onActionGetDirectLink,
    onActionCopy,
    onActionMove,
    path,
    parentInfo,
    handleNavigate,
    handleShowDetailsForId,
    handleDownloadFolder,
    fileToolbarRef,
    viewMode,
    sortKey,
    pageSize,
    columns,
    handleRefresh,
    selectAll,
    invertSelection,
    handleSetViewMode,
    handleSetPageSize,
    handleSetSortKey,
    handleSetColumns,
    handleOpenColumnSettings,
    onActionRegenerateDirectoryThumbnails,
    loading,
    sortedFiles,
    isMoreLoading,
    hasMore,
    selectedFiles,
    selectSingle,
    selectRange,
    toggleSelection,
    handleLoadMore,
    handlePreviewFile,
    formatRelativeTime,
    isDragging,
    isDestinationModalVisible,
    itemsForAction,
    destinationModalMode,
    handleActionSuccess,
    setDestinationModalVisible,
    isShareModalVisible,
    shareItems,
    setShareModalVisible,
    handleShareSuccess,
    handleCreateShare,
    detailsPanelFile,
    closeDetailsPanel,
    isSearchVisible,
    searchOrigin,
    setIsSearchVisible,
    contextMenuTrigger,
    onMenuSelect,
    handleContextMenuClosed,
    uploadQueue,
    isPanelVisible,
    isPanelCollapsed,
    speedDisplayMode,
    globalOverwrite,
    handlePanelClose,
    setPanelCollapsed,
    handleUploadFile,
    retryItem,
    removeItem,
    resolveConflict,
    handleUploadGlobalCommand,
    imagePreviewRef,
    videoPreviewRef,
    textPreviewRef,
    promptDialog,
    confirmDialog,
    directLinks,
    setDirectLinks,
  } = useFileManager();

  return (
    <motion.div
      ref={containerRef}
      className={styles["file-management-container"]}
      variants={fadeInUp}
      initial="initial"
      animate="animate"
      transition={gentleSpring}
      onDragEnter={dragHandlers.onDragEnter}
      onDragOver={dragHandlers.onDragOver}
      onDragLeave={dragHandlers.onDragLeave}
      onDrop={dragHandlers.onDrop}
      onContextMenu={event => {
        event.preventDefault();
        handleContextMenuTrigger(event.nativeEvent);
      }}
      onClick={handleContainerClick}
    >
      <FileHeader
        hasSelection={hasSelection}
        isSingleSelection={isSingleSelection}
        selectionCountLabel={selectionCountLabel}
        onOpenNewMenu={openBlankMenu}
        onTriggerSearch={openSearchFromElement}
        onClearSelection={clearSelection}
        onRename={onActionRename}
        onDelete={onActionDelete}
        onDownload={onActionDownload}
        onShare={onActionShare}
        onGetDirectLink={onActionGetDirectLink}
        onCopy={onActionCopy}
        onMove={onActionMove}
      />

      <div className={styles["breadcrumb-toolbar-row"]}>
        <FileBreadcrumb
          path={path}
          parentInfo={parentInfo}
          showDropdown
          onNavigate={handleNavigate}
          onShowDetails={handleShowDetailsForId}
          onDownloadFolder={handleDownloadFolder}
        />
        <FileToolbar
          ref={fileToolbarRef}
          viewMode={viewMode}
          sortKey={sortKey}
          pageSize={pageSize}
          hasSelection={hasSelection}
          isSimplified={false}
          columns={columns}
          onRefresh={handleRefresh}
          onSelectAll={selectAll}
          onClearSelection={clearSelection}
          onInvertSelection={invertSelection}
          onSetViewMode={handleSetViewMode}
          onSetPageSize={handleSetPageSize}
          onSetSortKey={handleSetSortKey}
          onSetColumns={handleSetColumns}
          onRegenerateThumbnails={onActionRegenerateDirectoryThumbnails}
        />
      </div>

      <div className={styles["file-management-main"]}>
        {loading && sortedFiles.length === 0 ? (
          <div className={styles["loading-overlay"]}>
            <div className={styles["loading-spinner"]} />
          </div>
        ) : null}

        <div className={styles["file-content-area"]}>
          {viewMode === "grid" ? (
            <FileGridView
              files={sortedFiles}
              loading={loading}
              selectedFileIds={selectedFiles}
              isMoreLoading={isMoreLoading}
              hasMore={hasMore}
              onSelectSingle={selectSingle}
              onSelectRange={selectRange}
              onToggleSelection={toggleSelection}
              onSelectAll={selectAll}
              onNavigateTo={handleNavigate}
              onScrollToLoad={handleLoadMore}
              onPreviewFile={handlePreviewFile}
              onContextMenu={handleContextMenuTrigger}
            />
          ) : (
            <FileListView
              files={sortedFiles}
              loading={loading}
              selectedFileIds={selectedFiles}
              isMoreLoading={isMoreLoading}
              hasMore={hasMore}
              columns={columns}
              sortKey={sortKey}
              onSelectSingle={selectSingle}
              onSelectRange={selectRange}
              onToggleSelection={toggleSelection}
              onSelectAll={selectAll}
              onNavigateTo={handleNavigate}
              onScrollToLoad={handleLoadMore}
              onPreviewFile={handlePreviewFile}
              onContextMenu={handleContextMenuTrigger}
              onSetSortKey={handleSetSortKey}
              onSetColumns={handleSetColumns}
              onOpenColumnSettings={handleOpenColumnSettings}
              formatRelativeTime={formatRelativeTime}
            />
          )}
        </div>
      </div>

      <AnimatePresence>
        {isDragging ? (
          <motion.div
            className={styles["drag-overlay"]}
            variants={dragOverlayVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={normalTransition}
          >
            <motion.div
              className={styles["drag-content"]}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={gentleSpring}
            >
              <span className={styles["drag-title"]}>松开鼠标开始上传</span>
              <p className={styles["drag-desc"]}>将文件或目录拖拽至此</p>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <MoveModal
        open={isDestinationModalVisible}
        itemsForAction={itemsForAction}
        mode={destinationModalMode}
        onSuccess={handleActionSuccess}
        onClose={() => setDestinationModalVisible(false)}
      />

      <ShareModal
        open={isShareModalVisible}
        items={shareItems}
        onClose={() => setShareModalVisible(false)}
        onSuccess={handleShareSuccess}
        onCreateShare={handleCreateShare}
      />

      <FileDetailsPanel fileInfo={detailsPanelFile} onClose={closeDetailsPanel} />

      <SearchOverlay visible={isSearchVisible} origin={searchOrigin} onClose={() => setIsSearchVisible(false)} />

      <ContextMenu
        trigger={contextMenuTrigger}
        selectedFileIds={selectedFiles}
        onSelect={onMenuSelect}
        onClosed={handleContextMenuClosed}
      />

      <UploadProgress
        visible={isPanelVisible}
        isCollapsed={isPanelCollapsed}
        queue={uploadQueue}
        speedMode={speedDisplayMode}
        isGlobalOverwrite={globalOverwrite}
        onClose={handlePanelClose}
        onToggleCollapse={() => setPanelCollapsed(!isPanelCollapsed)}
        onAddFiles={handleUploadFile}
        onRetryItem={retryItem}
        onRemoveItem={removeItem}
        onResolveConflict={resolveConflict}
        onGlobalCommand={handleUploadGlobalCommand}
      />

      <ImagePreview ref={imagePreviewRef} />
      <VideoPreview ref={videoPreviewRef} />
      <TextPreview ref={textPreviewRef} />

      <PromptDialog
        key={promptDialog?.id ?? "prompt"}
        open={!!promptDialog}
        title={promptDialog?.title || ""}
        description={promptDialog?.description}
        defaultValue={promptDialog?.defaultValue}
        confirmText={promptDialog?.confirmText}
        cancelText={promptDialog?.cancelText}
        validator={promptDialog?.validator}
        onConfirm={value => promptDialog?.onConfirm(value)}
        onCancel={() => promptDialog?.onCancel()}
      />

      <ConfirmDialog
        open={!!confirmDialog}
        title={confirmDialog?.title || ""}
        description={confirmDialog?.description || ""}
        confirmText={confirmDialog?.confirmText}
        cancelText={confirmDialog?.cancelText}
        tone={confirmDialog?.tone}
        onConfirm={() => confirmDialog?.onConfirm()}
        onCancel={() => confirmDialog?.onCancel()}
      />

      <DirectLinksModal links={directLinks} onClose={() => setDirectLinks(null)} />
    </motion.div>
  );
}
