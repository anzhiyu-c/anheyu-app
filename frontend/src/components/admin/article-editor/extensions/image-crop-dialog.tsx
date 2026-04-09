/**
 * ImageCropDialog - 图片裁剪对话框
 * 使用 Canvas API 实现基础裁剪功能
 */
"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { ModalBody, ModalFooter, Button } from "@heroui/react";
import { Crop, RotateCcw } from "lucide-react";
import { AdminDialog } from "@/components/admin/AdminDialog";

interface ImageCropDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  imageSrc: string;
  onCropComplete: (croppedBlob: Blob) => void;
}

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function ImageCropDialog({ isOpen, onOpenChange, imageSrc, onCropComplete }: ImageCropDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [cropArea, setCropArea] = useState<CropArea | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const scaleRef = useRef(1);
  const [loadError, setLoadError] = useState(false);

  // 打开时重置状态（渲染阶段调整状态，React 推荐模式）
  const [prevIsOpen, setPrevIsOpen] = useState(false);
  if (isOpen && !prevIsOpen) {
    setLoadError(false);
    setCropArea(null);
    setImage(null);
    setPrevIsOpen(true);
  } else if (!isOpen && prevIsOpen) {
    setPrevIsOpen(false);
  }

  // 加载图片
  useEffect(() => {
    if (!isOpen || !imageSrc) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setImage(img);
    };
    img.onerror = () => {
      setLoadError(true);
    };
    img.src = imageSrc;
  }, [isOpen, imageSrc]);

  // 绘制画布
  useEffect(() => {
    if (!image || !canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const containerWidth = containerRef.current.clientWidth || 500;
    const containerHeight = 400;

    // 计算缩放比例以适应容器
    const scaleX = containerWidth / image.width;
    const scaleY = containerHeight / image.height;
    const fitScale = Math.min(scaleX, scaleY, 1);
    scaleRef.current = fitScale;

    canvas.width = image.width * fitScale;
    canvas.height = image.height * fitScale;

    // 绘制图片
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    // 绘制裁剪区域
    if (cropArea) {
      // 暗化非裁剪区域
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 清除裁剪区域（显示原图）
      ctx.clearRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height);
      ctx.drawImage(
        image,
        cropArea.x / fitScale,
        cropArea.y / fitScale,
        cropArea.width / fitScale,
        cropArea.height / fitScale,
        cropArea.x,
        cropArea.y,
        cropArea.width,
        cropArea.height
      );

      // 绘制裁剪边框
      ctx.strokeStyle = "#4259ef";
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.strokeRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height);

      // 绘制网格线（三分法）
      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      ctx.lineWidth = 1;
      const thirdW = cropArea.width / 3;
      const thirdH = cropArea.height / 3;
      for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(cropArea.x + thirdW * i, cropArea.y);
        ctx.lineTo(cropArea.x + thirdW * i, cropArea.y + cropArea.height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cropArea.x, cropArea.y + thirdH * i);
        ctx.lineTo(cropArea.x + cropArea.width, cropArea.y + thirdH * i);
        ctx.stroke();
      }
    }
  }, [image, cropArea]);

  const getCanvasCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const coords = getCanvasCoords(e);
      setIsDragging(true);
      setDragStart(coords);
      setCropArea({ x: coords.x, y: coords.y, width: 0, height: 0 });
    },
    [getCanvasCoords]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDragging) return;
      const coords = getCanvasCoords(e);
      const canvas = canvasRef.current;
      if (!canvas) return;

      const x = Math.max(0, Math.min(dragStart.x, coords.x));
      const y = Math.max(0, Math.min(dragStart.y, coords.y));
      const width = Math.min(Math.abs(coords.x - dragStart.x), canvas.width - x);
      const height = Math.min(Math.abs(coords.y - dragStart.y), canvas.height - y);

      setCropArea({ x, y, width, height });
    },
    [isDragging, dragStart, getCanvasCoords]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleReset = useCallback(() => {
    setCropArea(null);
  }, []);

  const handleCrop = useCallback(() => {
    if (!image || !cropArea || cropArea.width < 10 || cropArea.height < 10) return;

    // 在原始尺寸上裁剪
    const currentScale = scaleRef.current;
    const cropCanvas = document.createElement("canvas");
    const realX = cropArea.x / currentScale;
    const realY = cropArea.y / currentScale;
    const realW = cropArea.width / currentScale;
    const realH = cropArea.height / currentScale;

    cropCanvas.width = realW;
    cropCanvas.height = realH;
    const ctx = cropCanvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(image, realX, realY, realW, realH, 0, 0, realW, realH);

    cropCanvas.toBlob(
      blob => {
        if (blob) {
          onCropComplete(blob);
          onOpenChange(false);
        }
      },
      "image/png",
      0.92
    );
  }, [image, cropArea, onCropComplete, onOpenChange]);

  const hasCrop = cropArea && cropArea.width > 10 && cropArea.height > 10;

  return (
    <AdminDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="2xl"
      classNames={{ wrapper: "z-[200]", backdrop: "z-[199]" }}
      header={{ title: "裁剪图片", description: "拖拽选择区域并生成新的裁剪图片", icon: Crop }}
    >
      {onClose => (
        <>
          <ModalBody>
            {loadError ? (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                无法加载图片，可能存在跨域限制
              </div>
            ) : (
              <div
                ref={containerRef}
                className="flex items-center justify-center bg-muted/30 rounded-lg overflow-hidden"
              >
                <canvas
                  ref={canvasRef}
                  className="cursor-crosshair"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                />
              </div>
            )}
            {hasCrop && (
              <div className="text-xs text-muted-foreground text-center mt-2">
                裁剪区域: {Math.round(cropArea.width / scaleRef.current)} x{""}
                {Math.round(cropArea.height / scaleRef.current)} px
              </div>
            )}
          </ModalBody>

          <ModalFooter>
            <Button variant="flat" size="sm" startContent={<RotateCcw className="w-3.5 h-3.5" />} onPress={handleReset}>
              重置
            </Button>
            <Button variant="flat" onPress={onClose} size="sm">
              取消
            </Button>
            <Button color="primary" onPress={handleCrop} isDisabled={!hasCrop} size="sm">
              确认裁剪
            </Button>
          </ModalFooter>
        </>
      )}
    </AdminDialog>
  );
}
