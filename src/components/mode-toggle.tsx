"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ModeToggleProps = {
  currentMode: "generate" | "edit";
  onModeChange: (mode: "generate" | "edit") => void;
};

export function ModeToggle({ currentMode, onModeChange }: ModeToggleProps) {
  return (
    <Tabs
      value={currentMode}
      onValueChange={(value) => onModeChange(value as "generate" | "edit")}
      className="w-auto"
    >
      <TabsList className="grid grid-cols-2 bg-transparent border-none rounded-md p-0 h-auto gap-1">
        <TabsTrigger
          value="generate"
          className={`
            px-3 py-1 text-sm rounded-md transition-colors
            border
            ${currentMode === 'generate'
              ? 'bg-white text-black border-white'
              : 'bg-transparent text-white/60 border-dashed border-white/30 hover:border-white/50 hover:text-white/80'
            }
          `}
        >
          Generate
        </TabsTrigger>
        <TabsTrigger
          value="edit"
          className={`
            px-3 py-1 text-sm rounded-md transition-colors
            border
            ${currentMode === 'edit'
              ? 'bg-white text-black border-white'
              : 'bg-transparent text-white/60 border-dashed border-white/30 hover:border-white/50 hover:text-white/80'
            }
          `}
        >
          Edit
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}