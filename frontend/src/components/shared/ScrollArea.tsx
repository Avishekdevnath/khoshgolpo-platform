"use client";

import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type ScrollTone = "default" | "subtle" | "strong";
type ScrollSize = "sm" | "md" | "lg";

type ScrollAreaProps = HTMLAttributes<HTMLDivElement> & {
  tone?: ScrollTone;
  size?: ScrollSize;
};

const toneClass: Record<ScrollTone, string> = {
  default: "kg-scroll--default",
  subtle: "kg-scroll--subtle",
  strong: "kg-scroll--strong",
};

const sizeClass: Record<ScrollSize, string> = {
  sm: "kg-scroll--sm",
  md: "kg-scroll--md",
  lg: "kg-scroll--lg",
};

export default function ScrollArea({
  className,
  tone = "default",
  size = "md",
  ...props
}: ScrollAreaProps) {
  return (
    <div
      className={cn("kg-scroll", toneClass[tone], sizeClass[size], className)}
      {...props}
    />
  );
}
