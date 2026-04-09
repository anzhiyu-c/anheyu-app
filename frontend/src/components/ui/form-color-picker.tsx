"use client";

import { useCallback, useMemo } from "react";
import {
  ColorArea as AriaColorArea,
  ColorSlider as AriaColorSlider,
  ColorThumb,
  ColorField as AriaColorField,
  SliderTrack,
  Input,
  Label,
  parseColor,
  type Color,
} from "react-aria-components";
import { Popover, PopoverTrigger, PopoverContent } from "@heroui/react";
import { Shuffle } from "lucide-react";
import { cn } from "@/lib/utils";

const PRESET_COLORS = ["#E11D48", "#EA580C", "#EAB308", "#16A34A", "#14B8A6", "#2563EB", "#7C3AED", "#DB2777"];

function randomHexColor() {
  return (
    "#" +
    Math.floor(Math.random() * 0xffffff)
      .toString(16)
      .padStart(6, "0")
  );
}

const THUMB_CLASS = cn(
  "w-5 h-5 rounded-full border-2 border-white",
  "shadow-[0_0_0_1px_rgba(0,0,0,0.1),0_2px_4px_rgba(0,0,0,0.2)]",
  "forced-colors:bg-[Highlight]!"
);

function hexEqualsIgnoreCase(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

interface FormColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  className?: string;
  /** 为 true 时不可打开取色面板 */
  disabled?: boolean;
  /** 色块按钮的无障碍标签（默认：选择颜色: ${value}） */
  triggerAriaLabel?: string;
}

export function FormColorPicker({
  value,
  onChange,
  className,
  disabled,
  triggerAriaLabel,
}: FormColorPickerProps) {
  const color = useMemo(() => {
    try {
      return parseColor(value).toFormat("hsb");
    } catch {
      return parseColor("#3B82F6").toFormat("hsb");
    }
  }, [value]);

  const handleColorChange = useCallback((c: Color) => onChange(c.toString("hex")), [onChange]);

  return (
    <Popover placement="bottom" offset={6}>
      <PopoverTrigger>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "shrink-0 w-8 h-8 rounded-lg border-2 border-border/60 cursor-pointer",
            "transition-all hover:scale-110 hover:border-border/80",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            disabled && "opacity-50 cursor-not-allowed hover:scale-100",
            className
          )}
          style={{ backgroundColor: value }}
          aria-label={triggerAriaLabel ?? `选择颜色: ${value}`}
        />
      </PopoverTrigger>
      <PopoverContent className="p-0">
        <div className="p-3 w-[232px] space-y-3">
          {/* Presets */}
          <div className="flex items-center justify-between">
            {PRESET_COLORS.map((preset, i) => (
              <button
                key={`${preset}-${i}`}
                type="button"
                disabled={disabled}
                className={cn(
                  "w-5.5 h-5.5 rounded-full cursor-pointer transition-transform",
                  "hover:scale-115",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100",
                  hexEqualsIgnoreCase(value, preset) && "ring-2 ring-offset-1 ring-default-400 scale-110"
                )}
                style={{ backgroundColor: preset }}
                onClick={() => onChange(preset)}
                aria-label={preset}
              />
            ))}
          </div>

          {/* Color Area */}
          <AriaColorArea
            colorSpace="hsb"
            xChannel="saturation"
            yChannel="brightness"
            value={color}
            onChange={handleColorChange}
            isDisabled={disabled}
            className="w-full h-36 rounded-xl overflow-hidden"
          >
            <ColorThumb className={THUMB_CLASS} />
          </AriaColorArea>

          {/* Hue Slider + Shuffle */}
          <div className="flex items-center gap-2">
            <AriaColorSlider
              channel="hue"
              colorSpace="hsb"
              value={color}
              onChange={handleColorChange}
              isDisabled={disabled}
              className="flex-1"
            >
              <SliderTrack className="h-3 w-full rounded-full">
                <ColorThumb className={cn(THUMB_CLASS, "top-1/2")} />
              </SliderTrack>
            </AriaColorSlider>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(randomHexColor())}
              className={cn(
                "shrink-0 w-7 h-7 flex items-center justify-center rounded-full",
                "bg-muted hover:bg-secondary transition-colors cursor-pointer",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              aria-label="随机颜色"
            >
              <Shuffle className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>

          {/* Hex Input */}
          <div className="flex items-center gap-2 pt-2 border-t border-border/30">
            <div className="w-6 h-6 rounded-md shrink-0" style={{ backgroundColor: value }} />
            <AriaColorField
              value={color}
              onChange={c => {
                if (c) handleColorChange(c);
              }}
              isDisabled={disabled}
              className="flex-1"
            >
              <Label className="sr-only">Hex</Label>
              <Input
                className="w-full h-7 px-2 text-xs font-mono rounded-md border border-border/60 bg-muted/30
 outline-none focus:border-primary transition-colors"
              />
            </AriaColorField>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
