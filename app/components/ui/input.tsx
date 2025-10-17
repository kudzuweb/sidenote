import * as React from "react"

import { cn } from "~/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-cyan-500 dark:selection:bg-cyan-400 selection:text-white dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-all outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-cyan-500 dark:focus-visible:border-cyan-400 focus-visible:ring-cyan-500/30 dark:focus-visible:ring-cyan-400/30 focus-visible:ring-[3px] focus-visible:shadow-lg focus-visible:shadow-cyan-500/10",
        "aria-invalid:ring-pink-500/20 dark:aria-invalid:ring-pink-400/40 aria-invalid:border-pink-500 dark:aria-invalid:border-pink-400",
        className
      )}
      {...props}
    />
  )
}

export { Input }
