import { cn } from "@/lib/cn";
import { descriptionPoints } from "@/src/lib/library";

/**
 * A sense description, one bullet per line. A single point reads as plain
 * text; `max` keeps a row short, and `pointClassName` clamps each point.
 */
export function DescriptionPoints({
  text,
  max,
  className,
  pointClassName,
}: {
  text: string;
  max?: number;
  className?: string;
  pointClassName?: string;
}) {
  const points = descriptionPoints(text).slice(0, max);
  if (points.length <= 1)
    return (
      <span className={cn("block", className, pointClassName)}>
        {points[0]}
      </span>
    );
  return (
    <span className={cn("grid", className)}>
      {points.map((point, index) => (
        <span key={index} className="flex gap-1.5">
          <span aria-hidden>•</span>
          <span className={cn("min-w-0", pointClassName)}>{point}</span>
        </span>
      ))}
    </span>
  );
}
