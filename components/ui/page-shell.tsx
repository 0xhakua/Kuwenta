import * as React from "react"
import { cn } from "@/lib/utils"

export type PageShellProps = React.ComponentProps<"div">

export function PageShell({ className, ...props }: PageShellProps) {
  return <div className={cn("space-y-6", className)} {...props} />
}
